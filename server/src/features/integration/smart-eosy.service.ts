import axios from "axios";
import {
  smartEosySectionResponseSchema,
  type SmartEosyLearnerOutcome,
} from "@enrollpro/shared";
import { Prisma } from "../../generated/prisma/index.js";
import { AppError } from "../../lib/AppError.js";
import { prisma } from "../../lib/prisma.js";
import {
  buildSmartOutcomeEnvelope,
  mergeSmartOutcomeIntoReportedGrades,
  replaceSmartOutcomeWithIssue,
  type SmartSyncIssueStatus,
} from "./smart-outcome-envelope.js";

interface SmartSyncResult {
  schoolYearId: number;
  sectionId: number;
  sectionName: string;
  syncedCount: number;
  unmatchedSmartLrns: string[];
  missingSmartLrns: string[];
  unresolvedOutcomes: Array<{
    lrn: string;
    status: SmartSyncIssueStatus;
    reason: string;
  }>;
  learnerIds: number[];
}

const sectionSyncLocks = new Map<number, Promise<SmartSyncResult>>();
const SMART_TRANSPORT_ATTEMPTS = 3;

function isRetryableSmartTransportError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;
  const code = error.code ?? "";
  return status === 502
    || status === 503
    || status === 504
    || [
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ECONNABORTED",
      "ENOTFOUND",
      "ERR_NETWORK",
    ].includes(code)
    || error.message.toLowerCase().includes("timeout");
}

type AcademicStatus = "PROMOTED" | "RETAINED" | "CONDITIONALLY_PROMOTED";

interface NormalizedSmartOutcome {
  lrn: string;
  studentName?: string;
  finalGeneralAverage: number;
  finalOutcome: AcademicStatus;
  learningAreas: Array<{
    code: string;
    name: string;
    finalGrade: number;
    result: "PASSED" | "FAILED" | "INCOMPLETE";
  }>;
  reportedGradesObj: Record<string, {
    T1?: number | null;
    T2?: number | null;
    T3?: number | null;
    Final?: number | null;
    remarks?: string | null;
  }>;
  publishedAt: string | null;
  revision: string | null;
}

class SmartOutcomeValidationError extends Error {
  constructor(
    public readonly status: SmartSyncIssueStatus,
    message: string,
  ) {
    super(message);
    this.name = "SmartOutcomeValidationError";
  }
}

function normalizePromotionStatus(
  value: string | null | undefined,
): AcademicStatus | null {
  if (!value) return null;

  switch (value.trim().toUpperCase().replace(/\s+/g, "_")) {
    case "PROMOTED":
      return "PROMOTED";
    case "RETAINED":
      return "RETAINED";
    case "CONDITIONALLY_PROMOTED":
      return "CONDITIONALLY_PROMOTED";
    default:
      return null;
  }
}

function getExpectedGradeNumber(gradeLevelName: string | null | undefined): number | null {
  const match = gradeLevelName?.match(/(?:GRADE[\s_-]*)?(10|[7-9])(?:\D|$)/i);
  return match ? Number(match[1]) : null;
}

function normalizePersonName(value: string): string[] {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort();
}

function learnerNamesMatch(
  smartName: string,
  learner: {
    firstName: string;
    middleName: string | null;
    lastName: string;
    extensionName: string | null;
  },
): boolean {
  const smartTokens = new Set(normalizePersonName(smartName));
  const requiredTokens = normalizePersonName(
    `${learner.firstName} ${learner.lastName}`,
  );
  return requiredTokens.every((token) => smartTokens.has(token));
}

function subjectBelongsToGrade(subjectName: string, expectedGrade: number | null): boolean {
  if (expectedGrade === null) return true;
  const match = subjectName.match(/\b(7|8|9|10)\s*$/);
  return match === null || Number(match[1]) === expectedGrade;
}

function assertSmartOutcomeGradeScope(
  outcome: SmartEosyLearnerOutcome,
  expectedGrade: number | null,
): void {
  const mismatchedSubjects = [
    ...(outcome.subjectGrades ?? []).map((subject) => subject.subjectName),
    ...(outcome.learningAreas ?? []).map((area) => area.name),
  ].filter((subjectName) => !subjectBelongsToGrade(subjectName, expectedGrade));

  if (mismatchedSubjects.length > 0) {
    throw new Error(
      `SMART returned subjects from another grade level: ${mismatchedSubjects.join(", ")}.`,
    );
  }
}

function normalizedSubjectKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function assertUniqueSubjects(
  subjects: Array<{ subjectCode: string; subjectName: string }>,
): void {
  const subjectCodes = new Set<string>();
  const subjectNames = new Set<string>();
  for (const subject of subjects) {
    const code = normalizedSubjectKey(subject.subjectCode);
    const name = normalizedSubjectKey(subject.subjectName);
    if (subjectCodes.has(code)) {
      throw new Error(`SMART returned duplicate subject code ${subject.subjectCode}.`);
    }
    if (subjectNames.has(name)) {
      throw new Error(`SMART returned duplicate subject ${subject.subjectName}.`);
    }
    subjectCodes.add(code);
    subjectNames.add(name);
  }
}

function assertFinalSubjectGrade(subject: SmartEosyLearnerOutcome["subjectGrades"][number]): void {
  if (
    subject.status !== "GRADED"
    || subject.T1 === null
    || subject.T2 === null
    || subject.T3 === null
    || subject.finalRating === null
  ) {
    throw new SmartOutcomeValidationError(
      "INCOMPLETE_SUBJECT_GRADES",
      `Subject ${subject.subjectName} is not fully graded (${subject.status ?? "UNKNOWN"}).`,
    );
  }

  const calculatedFinal = Math.round((subject.T1 + subject.T2 + subject.T3) / 3);
  if (subject.finalRating !== calculatedFinal) {
    throw new SmartOutcomeValidationError(
      "SMART_DATA_NEEDS_REVIEW",
      `Subject ${subject.subjectName} final rating does not match its term grades.`,
    );
  }

  const expectedRemark = subject.finalRating >= 75 ? "PASSED" : "FAILED";
  if (subject.remarks?.trim().toUpperCase() !== expectedRemark) {
    throw new SmartOutcomeValidationError(
      "SMART_DATA_NEEDS_REVIEW",
      `Subject ${subject.subjectName} remarks do not match its final rating.`,
    );
  }
}

function normalizeSmartOutcome(
  outcome: SmartEosyLearnerOutcome,
  expectedGrade: number | null,
): NormalizedSmartOutcome {
  const subjectGrades = outcome.subjectGrades;
  assertSmartOutcomeGradeScope(outcome, expectedGrade);
  assertUniqueSubjects(subjectGrades);

  const reportedGradesObj: Record<string, {
    T1?: number | null;
    T2?: number | null;
    T3?: number | null;
    Final?: number | null;
    remarks?: string | null;
  }> = {};

  for (const subject of subjectGrades) {
    assertFinalSubjectGrade(subject);
    reportedGradesObj[subject.subjectName] = {
      T1: subject.T1,
      T2: subject.T2,
      T3: subject.T3,
      Final: subject.finalRating,
      remarks: subject.remarks,
    };
  }

  const learningAreas: NormalizedSmartOutcome["learningAreas"] = subjectGrades.map(
    (subject) => ({
      code: subject.subjectCode,
      name: subject.subjectName,
      finalGrade: subject.finalRating as number,
      result: (subject.finalRating as number) >= 75 ? "PASSED" : "FAILED",
    }),
  );

  const calculatedAverage = Math.round(
    learningAreas.reduce((total, area) => total + area.finalGrade, 0)
      / learningAreas.length,
  );
  if (outcome.generalAverage === null) {
    throw new SmartOutcomeValidationError(
      "WAITING_FOR_SMART_FINALIZATION",
      "SMART has not finalized the learner general average.",
    );
  }
  const finalGeneralAverage = outcome.generalAverage;

  if (finalGeneralAverage !== calculatedAverage) {
    throw new SmartOutcomeValidationError(
      "SMART_DATA_NEEDS_REVIEW",
      "SMART general average does not match the subject final ratings.",
    );
  }
  const expectedOverallRemark = finalGeneralAverage >= 75 ? "PASSED" : "FAILED";
  if (outcome.remarks?.trim().toUpperCase() !== expectedOverallRemark) {
    throw new SmartOutcomeValidationError(
      "SMART_DATA_NEEDS_REVIEW",
      "SMART learner remarks do not match the final general average.",
    );
  }

  const finalOutcome = normalizePromotionStatus(
    outcome.finalOutcome ?? outcome.promotionStatus,
  );
  if (!finalOutcome) {
    throw new SmartOutcomeValidationError(
      "WAITING_FOR_SMART_FINALIZATION",
      "SMART did not return a finalized promotion outcome.",
    );
  }
  if (outcome.publishedAt && Number.isNaN(Date.parse(outcome.publishedAt))) {
    throw new SmartOutcomeValidationError(
      "SMART_DATA_NEEDS_REVIEW",
      "SMART did not return a valid publication time for the finalized outcome.",
    );
  }
  return {
    lrn: outcome.lrn,
    studentName: outcome.studentName,
    finalGeneralAverage,
    finalOutcome,
    learningAreas,
    reportedGradesObj,
    publishedAt: outcome.publishedAt ?? null,
    revision: outcome.revision ?? null,
  };
}

function buildDeficiencyNote(
  outcome: NormalizedSmartOutcome,
): string | null {
  const deficientAreas = outcome.learningAreas
    .filter((area) => area.result === "FAILED")
    .map((area) => area.name);
  return deficientAreas.length > 0
    ? deficientAreas.join(", ")
    : null;
}

async function syncFinalSmartSectionOutcomesInternal(
  sectionId: number,
): Promise<SmartSyncResult> {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      schoolYear: {
        select: { id: true, yearLabel: true, status: true, isEosyFinalized: true },
      },
      gradeLevel: {
        select: { name: true },
      },
      enrollmentRecords: {
        include: {
          learner: {
            select: {
              id: true,
              lrn: true,
              firstName: true,
              middleName: true,
              lastName: true,
              extensionName: true,
            },
          },
          enrollmentApplication: {
            select: { reportedGrades: true },
          },
        },
      },
    },
  });
  if (!section) {
    throw new AppError(404, "Section not found.");
  }
  const settings = await prisma.schoolSetting.findFirst({
    select: { activeSchoolYearId: true, systemPhase: true },
  });
  if (
    !settings
    || settings.activeSchoolYearId !== section.schoolYearId
    || section.schoolYear.status !== "ACTIVE"
  ) {
    throw new AppError(
      409,
      "SMART grades can be synchronized only for the active school year.",
    );
  }
  if (settings.systemPhase !== "EOSY_CLOSING") {
    throw new AppError(
      409,
      "SMART grades can be synchronized only during EOSY Closing.",
    );
  }
  if (section.isEosyFinalized || section.schoolYear.isEosyFinalized) {
    throw new AppError(
      409,
      "This class is already finalized and cannot receive another SMART synchronization.",
    );
  }
  if (section.enrollmentRecords.length === 0) {
    return {
      schoolYearId: section.schoolYearId,
      sectionId,
      sectionName: section.name,
      syncedCount: 0,
      unmatchedSmartLrns: [],
      missingSmartLrns: [],
      unresolvedOutcomes: [],
      learnerIds: [],
    };
  }

  let rawResponse: unknown;
  const baseUrl = process.env.SMART_API_BASE_URL?.trim();


  try {
    if (!baseUrl) {
      throw new Error("SMART is not configured.");
    }
    const smartToken = process.env.SMART_API_KEY?.trim();
    if (!smartToken) {
      throw new Error("SMART bearer token is not configured.");
    }
    const cleanBaseUrl = baseUrl.replace(/\/$/, "");
    // SMART's section registry is keyed by the shared DepEd section name.
    // EnrollPro's numeric primary key is local and is not a SMART identifier.
    let responseData: unknown;
    let responseReceived = false;
    let lastTransportError: unknown = null;

    for (let attempt = 1; attempt <= SMART_TRANSPORT_ATTEMPTS; attempt += 1) {
      try {
        const response = await axios.post<unknown>(
          `${cleanBaseUrl}/api/integration/sections/${encodeURIComponent(section.name)}/sync-grades`,
          undefined,
          {
            params: { schoolYear: section.schoolYear.yearLabel },
            headers: { Authorization: `Bearer ${smartToken}` },
            timeout: 10_000,
          },
        );
        responseData = response.data;
        responseReceived = true;
        break;
      } catch (error: unknown) {
        lastTransportError = error;
        if (!isRetryableSmartTransportError(error) || attempt === SMART_TRANSPORT_ATTEMPTS) {
          throw error;
        }

        await new Promise<void>((resolve) => {
          setTimeout(resolve, 400 * attempt);
        });
      }
    }

    if (!responseReceived) {
      throw lastTransportError ?? new Error("SMART did not return a response.");
    }
    rawResponse = responseData;
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    if (
      axios.isAxiosError(error)
      && (error.response?.status === 401 || error.response?.status === 403)
    ) {
      throw new AppError(
        502,
        "SMART rejected the configured Bearer token. Configure the valid SMART-issued token in server/.env.",
      );
    }
    let reason = "Unknown connection failure";
    if (axios.isAxiosError(error)) {
      if (typeof error.response?.data === 'string' && error.response.data) {
        // e.g. 503 HTML from a proxy or funnel
        reason = `Server returned ${error.response.status} (${error.response.statusText})`;
      } else if (error.response?.data?.message) {
        reason = String(error.response.data.message);
      } else if (error.response?.data?.error) {
        reason = String(error.response.data.error);
      } else {
        const code = error.code || "";
        if (code === "ECONNREFUSED") {
          reason = "Connection refused. The SMART server is currently offline.";
        } else if (code === "ETIMEDOUT" || code === "ECONNABORTED" || error.message?.includes("timeout")) {
          reason = "Connection timed out. The SMART server took too long to respond.";
        } else if (code === "ENOTFOUND") {
          reason = "Server not found. The configured SMART API URL is unreachable.";
        } else if (error.response?.status) {
          reason = `HTTP ${error.response.status}: ${error.response.statusText || 'Unknown error'}`;
        } else {
          reason = error.message || code || reason;
        }
      }
    } else if (error instanceof Error) {
      reason = error.message;
    } else if (typeof error === "string") {
      reason = error;
    }
    throw new AppError(
      503,
      `SMART final-result synchronization failed: ${reason}`,
    );
  }

  const parsed = smartEosySectionResponseSchema.safeParse(rawResponse);
  if (!parsed.success) {
    throw new AppError(
      502,
      `SMART returned an invalid final-result payload: ${parsed.error.issues
        .map((issue) => issue.message)
        .join("; ")}`,
    );
  }

  if (
    parsed.data.schoolYear !== section.schoolYear.yearLabel
  ) {
    throw new AppError(
      422,
      `SMART returned school year ${parsed.data.schoolYear}, but this section belongs to ${section.schoolYear.yearLabel}.`,
    );
  }

  if (normalizedSubjectKey(parsed.data.sectionName) !== normalizedSubjectKey(section.name)) {
    throw new AppError(
      422,
      `SMART returned section ${parsed.data.sectionName ?? "without a name"}, but EnrollPro requested ${section.name}.`,
    );
  }

  const expectedGrade = getExpectedGradeNumber(section.gradeLevel.name);
  if (parsed.data.gradeLevel !== expectedGrade) {
    throw new AppError(
      422,
      `SMART returned grade level ${parsed.data.gradeLevel ?? "without a grade level"}, but ${section.name} belongs to ${section.gradeLevel.name}.`,
    );
  }

  const rawOutcomesList = parsed.data.outcomes;

  if (
    parsed.data.outcomesSynced !== rawOutcomesList.length
  ) {
    throw new AppError(
      502,
      "SMART outcome count does not match the returned learner records.",
    );
  }

  const duplicateRawLrns = rawOutcomesList
    .map((student) => student.lrn)
    .filter((lrn, index, values) => values.indexOf(lrn) !== index);
  if (duplicateRawLrns.length > 0) {
    throw new AppError(
      502,
      `SMART returned duplicate LRNs: ${Array.from(new Set(duplicateRawLrns)).join(", ")}`,
    );
  }

  const normalizedOutcomes: NormalizedSmartOutcome[] = [];
  const unresolvedOutcomes: SmartSyncResult["unresolvedOutcomes"] = [];
  for (const item of rawOutcomesList) {
    try {
      normalizedOutcomes.push(normalizeSmartOutcome(item, expectedGrade));
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "Invalid final outcome.";
      unresolvedOutcomes.push({
        lrn: item.lrn,
        status: error instanceof SmartOutcomeValidationError
          ? error.status
          : "SMART_DATA_NEEDS_REVIEW",
        reason,
      });
    }
  }

  const allLocalByLrn = new Map(
    section.enrollmentRecords.flatMap((record) =>
      record.learner.lrn
        ? [[record.learner.lrn, record] as const]
        : [],
    ),
  );
  const localByLrn = new Map(
    section.enrollmentRecords.flatMap((record) =>
      record.eosyStatus !== "DROPPED_OUT" &&
      record.eosyStatus !== "TRANSFERRED_OUT" &&
      record.learner.lrn
        ? [[record.learner.lrn, record] as const]
        : [],
    ),
  );
  const invalidLocalLrns = section.enrollmentRecords
    .filter(
      (record) =>
        record.eosyStatus !== "DROPPED_OUT" &&
        record.eosyStatus !== "TRANSFERRED_OUT" &&
        !/^\d{12}$/.test(record.learner.lrn ?? ""),
    )
    .map((record) => record.learner.id);
  if (invalidLocalLrns.length > 0) {
    throw new AppError(
      422,
      `Active learners have invalid or missing LRNs: ${invalidLocalLrns.join(", ")}.`,
    );
  }
  const returnedSmartLrns = new Set(rawOutcomesList.map((student) => student.lrn));
  const unmatchedSmartLrns = rawOutcomesList
    .filter((student) => !allLocalByLrn.has(student.lrn))
    .map((student) => student.lrn);
  const missingSmartLrns = section.enrollmentRecords
    .filter(
      (record) =>
        record.eosyStatus !== "DROPPED_OUT" &&
        record.eosyStatus !== "TRANSFERRED_OUT" &&
        record.learner.lrn &&
        !returnedSmartLrns.has(record.learner.lrn),
    )
    .map((record) => record.learner.lrn)
    .filter((lrn): lrn is string => Boolean(lrn));
  const mismatchedLearnerLrns = rawOutcomesList.flatMap((student) => {
    const localRecord = allLocalByLrn.get(student.lrn);
    if (!localRecord) return [];
    return learnerNamesMatch(student.studentName, localRecord.learner)
      ? []
      : [student.lrn];
  });
  const matched = normalizedOutcomes.flatMap((student) => {
    const record = localByLrn.get(student.lrn);
    return record ? [{ student, record }] : [];
  });

  if (unmatchedSmartLrns.length > 0 || mismatchedLearnerLrns.length > 0) {
      throw new AppError(
      422,
      [
        unmatchedSmartLrns.length > 0
          ? `SMART returned LRNs not found in this section: ${unmatchedSmartLrns.join(", ")}.`
          : "",
        mismatchedLearnerLrns.length > 0
          ? `SMART learner names do not match EnrollPro for: ${mismatchedLearnerLrns.join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  for (const lrn of missingSmartLrns) {
    unresolvedOutcomes.push({
      lrn,
      status: "WAITING_FOR_SMART_FINALIZATION",
      reason: "SMART did not return a finalized outcome for this learner.",
    });
  }

  await prisma.$transaction(
    async (tx) => {
      for (const { student, record } of matched) {
        await tx.enrollmentRecord.update({
          where: { id: record.id },
          data: {
            finalAverage: student.finalGeneralAverage,
            eosyStatus: student.finalOutcome,
            academicDeficiencyNote: buildDeficiencyNote(student),
          },
        });
        if (Object.keys(student.reportedGradesObj).length > 0) {
          const envelope = buildSmartOutcomeEnvelope({
            schoolYearId: section.schoolYearId,
            sectionId: section.id,
            finalGeneralAverage: student.finalGeneralAverage,
            finalOutcome: student.finalOutcome,
            publishedAt: student.publishedAt,
            revision: student.revision,
            subjects: student.reportedGradesObj,
          });
          await tx.enrollmentApplication.update({
            where: { id: record.enrollmentApplicationId },
            data: {
              reportedGrades: mergeSmartOutcomeIntoReportedGrades(
                record.enrollmentApplication.reportedGrades,
                envelope,
              ),
            },
          });
        }
      }
      for (const unresolved of unresolvedOutcomes) {
        const record = localByLrn.get(unresolved.lrn);
        if (!record) continue;
        await tx.enrollmentRecord.update({
          where: { id: record.id },
          data: {
            finalAverage: null,
            eosyStatus: null,
            academicDeficiencyNote: null,
          },
        });
        await tx.enrollmentApplication.update({
          where: { id: record.enrollmentApplicationId },
          data: {
            reportedGrades: replaceSmartOutcomeWithIssue(
              record.enrollmentApplication.reportedGrades,
              {
                status: unresolved.status,
                reason: unresolved.reason,
              },
            ),
          },
        });
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    },
  );

  return {
    schoolYearId: section.schoolYearId,
    sectionId,
    sectionName: section.name,
    syncedCount: matched.length,
    unmatchedSmartLrns,
    missingSmartLrns,
    unresolvedOutcomes,
    learnerIds: matched.map(({ record }) => record.learner.id),
  };
}

/**
 * Serializes manual and automatic synchronization for one section. A SMART
 * SSE burst and a registrar click therefore share one validated operation.
 */
export async function syncFinalSmartSectionOutcomes(
  sectionId: number,
): Promise<SmartSyncResult> {
  const existing = sectionSyncLocks.get(sectionId);
  if (existing) {
    return existing;
  }

  const operation = syncFinalSmartSectionOutcomesInternal(sectionId);
  sectionSyncLocks.set(sectionId, operation);
  try {
    return await operation;
  } finally {
    if (sectionSyncLocks.get(sectionId) === operation) {
      sectionSyncLocks.delete(sectionId);
    }
  }
}
