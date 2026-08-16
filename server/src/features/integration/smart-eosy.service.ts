import axios from "axios";
import {
  smartEosySectionResponseSchema,
  type SmartEosyLearnerOutcome,
} from "@enrollpro/shared";
import { Prisma } from "../../generated/prisma/index.js";
import { AppError } from "../../lib/AppError.js";
import { prisma } from "../../lib/prisma.js";

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

function normalizeSmartOutcome(
  outcome: SmartEosyLearnerOutcome,
): NormalizedSmartOutcome {
  const subjectGrades = outcome.subjectGrades ?? [];
  let learningAreas: NormalizedSmartOutcome["learningAreas"] =
    outcome.learningAreas ?? [];

  if (subjectGrades.length > 0) {
    const incompleteSubject = subjectGrades.find((subject) => {
      const status = subject.status ?? (
        subject.finalRating === null ? "NG" : "GRADED"
      );
      return status !== "GRADED" || subject.finalRating === null;
    });
    if (incompleteSubject) {
      throw new Error(
        `Subject ${incompleteSubject.subjectName} is not fully graded (${incompleteSubject.status}).`,
      );
    }

    learningAreas = subjectGrades.map((subject) => {
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
  return {
    lrn: outcome.lrn,
    studentName: outcome.studentName,
    finalGeneralAverage,
    finalOutcome,
    learningAreas,
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

export async function syncFinalSmartSectionOutcomes(
  sectionId: number,
): Promise<SmartSyncResult> {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      schoolYear: {
        select: { id: true, yearLabel: true },
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
    const response = await axios.post<unknown>(
      `${cleanBaseUrl}/api/integration/sections/${encodeURIComponent(section.name)}/sync-grades`,
      undefined,
      {
        params: { schoolYear: section.schoolYear.yearLabel },
        headers: { Authorization: `Bearer ${smartToken}` },
        timeout: 10_000,
      },
    );
    rawResponse = response.data;
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new AppError(502, "SMART rejected the configured bearer token.");
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
    parsed.data.schoolYear &&
    parsed.data.schoolYear !== section.schoolYear.yearLabel
  ) {
    throw new AppError(
      422,
      `SMART returned school year ${parsed.data.schoolYear}, but this section belongs to ${section.schoolYear.yearLabel}.`,
    );
  }

  const rawOutcomesList: SmartEosyLearnerOutcome[] =
    parsed.data.outcomes ??
    parsed.data.students ??
    parsed.data.data?.outcomes ??
    parsed.data.data?.students ??
    [];

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
      normalizedOutcomes.push(normalizeSmartOutcome(item));
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
