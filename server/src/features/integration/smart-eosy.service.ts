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
  clearSmartOutcomeFromReportedGrades,
  mergeSmartOutcomeIntoReportedGrades,
} from "./smart-outcome-envelope.js";

interface SmartSyncResult {
  schoolYearId: number;
  sectionId: number;
  sectionName: string;
  syncedCount: number;
  unmatchedSmartLrns: string[];
  missingSmartLrns: string[];
  unresolvedOutcomes: Array<{ lrn: string; reason: string }>;
  learnerIds: number[];
}

function firstNonEmptySmartOutcomes(
  ...candidates: Array<SmartEosyLearnerOutcome[] | undefined>
): SmartEosyLearnerOutcome[] {
  return candidates.find((candidate) => candidate !== undefined && candidate.length > 0) ?? [];
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
  reportedGradesObj?: Record<string, {
    T1?: number | null;
    T2?: number | null;
    T3?: number | null;
    Final?: number | null;
    remarks?: string | null;
  }>;
  publishedAt: string | null;
  revision: string | null;
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
    throw new Error(
      `Subject ${subject.subjectName} is not fully graded (${subject.status ?? "UNKNOWN"}).`,
    );
  }

  const calculatedFinal = Math.round((subject.T1 + subject.T2 + subject.T3) / 3);
  if (subject.finalRating !== calculatedFinal) {
    throw new Error(
      `Subject ${subject.subjectName} final rating does not match its term grades.`,
    );
  }

  const expectedRemark = subject.finalRating >= 75 ? "PASSED" : "FAILED";
  if (subject.remarks && subject.remarks.trim().toUpperCase() !== expectedRemark) {
    throw new Error(
      `Subject ${subject.subjectName} remarks do not match its final rating.`,
    );
  }
}

function normalizeSmartOutcome(
  outcome: SmartEosyLearnerOutcome,
  expectedGrade: number | null,
): NormalizedSmartOutcome {
  const subjectGrades = outcome.subjectGrades ?? [];
  let learningAreas: NormalizedSmartOutcome["learningAreas"] =
    outcome.learningAreas ?? [];

  const reportedGradesObj: Record<string, {
    T1?: number | null;
    T2?: number | null;
    T3?: number | null;
    Final?: number | null;
    remarks?: string | null;
  }> = {};

  if (subjectGrades.length > 0) {
    assertUniqueSubjects(subjectGrades);
    
    // In DepEd, back-subjects might be present in the outcome but should not be
    // included in the current year's general average calculation.
    const currentGradeSubjects = subjectGrades.filter((sg) => 
      subjectBelongsToGrade(sg.subjectName, expectedGrade)
    );

    for (const sg of subjectGrades) {
      if (subjectBelongsToGrade(sg.subjectName, expectedGrade)) {
        assertFinalSubjectGrade(sg);
      }
      reportedGradesObj[sg.subjectName] = {
        T1: sg.T1 ?? null,
        T2: sg.T2 ?? null,
        T3: sg.T3 ?? null,
        Final: sg.finalRating ?? null,
        remarks: sg.remarks ?? (sg.finalRating !== null && sg.finalRating !== undefined ? (sg.finalRating >= 75 ? "Passed" : "Failed") : null),
      };
    }

    learningAreas = currentGradeSubjects.map((subject) => {
      const finalGrade = subject.finalRating;
      if (finalGrade === null) {
        throw new Error(`Subject ${subject.subjectName} has no final rating.`);
      }
      return {
        code: subject.subjectCode,
        name: subject.subjectName,
        finalGrade,
        result: finalGrade >= 75 ? ("PASSED" as const) : ("FAILED" as const),
      };
    });
  } else if (learningAreas.length > 0) {
    const learningAreaCodes = new Set<string>();
    const learningAreaNames = new Set<string>();
    for (const la of learningAreas) {
      const code = normalizedSubjectKey(la.code);
      const name = normalizedSubjectKey(la.name);
      if (learningAreaCodes.has(code) || learningAreaNames.has(name)) {
        throw new Error(`SMART returned duplicate learning area ${la.name}.`);
      }
      learningAreaCodes.add(code);
      learningAreaNames.add(name);
      reportedGradesObj[la.name] = {
        Final: la.finalGrade,
        remarks: la.result === "PASSED" ? "Passed" : la.result === "FAILED" ? "Failed" : null,
      };
    }
  }

  if (learningAreas.length === 0) {
    throw new Error("SMART returned no learning-area results.");
  }
  if (learningAreas.some((area) => area.result === "INCOMPLETE")) {
    throw new Error("SMART returned an incomplete learning-area result.");
  }

  const calculatedAverage =
    learningAreas.reduce((total, area) => total + area.finalGrade, 0) /
    learningAreas.length;
  const providedAverage = outcome.finalGeneralAverage ?? outcome.generalAverage;
  const finalGeneralAverage = providedAverage ?? calculatedAverage;

  if (subjectGrades.length > 0) {
    const roundedToTwoDecimals = Number(calculatedAverage.toFixed(2));
    const roundedToWholeNumber = Number(calculatedAverage.toFixed(0));
    const matchesSmartRounding =
      Math.abs(finalGeneralAverage - roundedToTwoDecimals) <= 0.01
      || Math.abs(finalGeneralAverage - roundedToWholeNumber) <= 0.01;
    if (!matchesSmartRounding) {
      throw new Error("SMART general average does not match the subject final ratings.");
    }
  }

  const finalOutcome = normalizePromotionStatus(
    outcome.finalOutcome ?? outcome.promotionStatus,
  );
  if (!finalOutcome) {
    throw new Error("SMART did not return a finalized promotion outcome.");
  }
  if (outcome.publishedAt && Number.isNaN(Date.parse(outcome.publishedAt))) {
    throw new Error("SMART did not return a valid publication time for the finalized outcome.");
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
  if (outcome.finalOutcome !== "CONDITIONALLY_PROMOTED") {
    return null;
  }
  const deficientAreas = (outcome.learningAreas || [])
    .filter((area) => area.result !== "PASSED")
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
        select: { id: true, yearLabel: true },
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
              lastName: true,
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

  if (
    !parsed.data.sectionName
    || normalizedSubjectKey(parsed.data.sectionName) !== normalizedSubjectKey(section.name)
  ) {
    throw new AppError(
      422,
      `SMART returned section ${parsed.data.sectionName ?? "without a name"}, but EnrollPro requested ${section.name}.`,
    );
  }

  const expectedGrade = getExpectedGradeNumber(section.gradeLevel.name);
  if (getExpectedGradeNumber(parsed.data.gradeLevel) !== expectedGrade) {
    throw new AppError(
      422,
      `SMART returned grade level ${parsed.data.gradeLevel ?? "without a grade level"}, but ${section.name} belongs to ${section.gradeLevel.name}.`,
    );
  }

  if (parsed.data.ready === false) {
    throw new AppError(422, "SMART has not published complete outcomes for this section.");
  }

  const rawOutcomesList = firstNonEmptySmartOutcomes(
    parsed.data.outcomes,
    parsed.data.students,
    parsed.data.data?.outcomes,
    parsed.data.data?.students,
  );

  if (
    parsed.data.outcomesSynced !== undefined
    && parsed.data.outcomesSynced !== rawOutcomesList.length
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
  const unresolvedOutcomes: Array<{ lrn: string; reason: string }> = [];
  for (const item of rawOutcomesList) {
    try {
      normalizedOutcomes.push(normalizeSmartOutcome(item, expectedGrade));
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "Invalid final outcome.";
      unresolvedOutcomes.push({ lrn: item.lrn, reason });
    }
  }

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
  const smartByLrn = new Map(
    normalizedOutcomes.map((student) => [student.lrn, student]),
  );
  const returnedSmartLrns = new Set(rawOutcomesList.map((student) => student.lrn));
  const unmatchedSmartLrns = rawOutcomesList
    .filter((student) => !localByLrn.has(student.lrn))
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
  const matched = normalizedOutcomes.flatMap((student) => {
    const record = localByLrn.get(student.lrn);
    return record ? [{ student, record }] : [];
  });

  if (unmatchedSmartLrns.length > 0 || missingSmartLrns.length > 0) {
      throw new AppError(
      422,
      [
        unmatchedSmartLrns.length > 0
          ? `SMART returned LRNs not found in this section: ${unmatchedSmartLrns.join(", ")}.`
          : "",
        missingSmartLrns.length > 0
          ? `SMART did not return final outcomes for: ${missingSmartLrns.join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
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
        if (student.reportedGradesObj && Object.keys(student.reportedGradesObj).length > 0) {
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
            reportedGrades: clearSmartOutcomeFromReportedGrades(
              record.enrollmentApplication.reportedGrades,
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
