import axios from "axios";
import {
  smartEosySectionResponseSchema,
  type SmartEosyLearnerOutcome,
} from "@enrollpro/shared";
import { Prisma } from "../../generated/prisma/index.js";
import { AppError } from "../../lib/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { hashPayload } from "../enrollment/services/school-form-artifact.service.js";

interface SmartSyncResult {
  schoolYearId: number;
  sectionId: number;
  sectionName: string;
  syncedCount: number;
  unmatchedSmartLrns: string[];
  missingSmartLrns: string[];
  learnerIds: number[];
}

function buildDeficiencyNote(
  outcome: SmartEosyLearnerOutcome,
): string | null {
  if (outcome.finalOutcome !== "CONDITIONALLY_PROMOTED") {
    return null;
  }
  const deficientAreas = outcome.learningAreas
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
      learnerIds: [],
    };
  }

  const baseUrl = process.env.SMART_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new AppError(
      503,
      "SMART is not configured. Set SMART_API_BASE_URL before synchronizing final results.",
    );
  }

  let rawResponse: unknown;
  try {
    const response = await axios.get<unknown>(
      `${baseUrl.replace(/\/$/, "")}/api/grades/section/${sectionId}`,
      {
        params: {
          quarter: "FINAL",
          schoolYearId: section.schoolYearId,
          schoolYear: section.schoolYear.yearLabel,
        },
        headers: process.env.SMART_API_KEY
          ? { "X-Integration-Key": process.env.SMART_API_KEY }
          : undefined,
        timeout: 10_000,
      },
    );
    rawResponse = response.data;
  } catch (error: unknown) {
    const reason =
      error instanceof Error ? error.message : "Unknown connection failure";
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

  const duplicateLrns = parsed.data.data.students
    .map((student) => student.lrn)
    .filter((lrn, index, values) => values.indexOf(lrn) !== index);
  if (duplicateLrns.length > 0) {
    throw new AppError(
      502,
      `SMART returned duplicate LRNs: ${Array.from(new Set(duplicateLrns)).join(", ")}`,
    );
  }

  const localByLrn = new Map(
    section.enrollmentRecords.flatMap((record) =>
      record.learner.lrn ? [[record.learner.lrn, record] as const] : [],
    ),
  );
  const smartByLrn = new Map(
    parsed.data.data.students.map((student) => [student.lrn, student]),
  );
  const unmatchedSmartLrns = parsed.data.data.students
    .filter((student) => !localByLrn.has(student.lrn))
    .map((student) => student.lrn);
  const missingSmartLrns = section.enrollmentRecords
    .filter(
      (record) =>
        record.learner.lrn && !smartByLrn.has(record.learner.lrn),
    )
    .map((record) => record.learner.lrn)
    .filter((lrn): lrn is string => Boolean(lrn));
  const matched = parsed.data.data.students.flatMap((student) => {
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
        const payloadHash = hashPayload(student);
        const outcome = await tx.smartAcademicOutcome.upsert({
          where: { enrollmentRecordId: record.id },
          update: {
            finalGeneralAverage: student.finalGeneralAverage,
            finalOutcome: student.finalOutcome,
            smartRevision: student.revision,
            publishedAt: new Date(student.publishedAt),
            payloadHash,
            syncedAt: new Date(),
          },
          create: {
            enrollmentRecordId: record.id,
            finalGeneralAverage: student.finalGeneralAverage,
            finalOutcome: student.finalOutcome,
            smartRevision: student.revision,
            publishedAt: new Date(student.publishedAt),
            payloadHash,
          },
          select: { id: true },
        });
        await tx.smartLearningAreaResult.deleteMany({
          where: { academicOutcomeId: outcome.id },
        });
        await tx.smartLearningAreaResult.createMany({
          data: student.learningAreas.map((area) => ({
            academicOutcomeId: outcome.id,
            learningAreaCode: area.code,
            learningAreaName: area.name,
            finalGrade: area.finalGrade,
            result: area.result,
          })),
        });
        await tx.enrollmentRecord.update({
          where: { id: record.id },
          data: {
            finalAverage: student.finalGeneralAverage,
            eosyStatus: student.finalOutcome,
            academicDeficiencyNote: buildDeficiencyNote(student),
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
    learnerIds: matched.map(({ record }) => record.learner.id),
  };
}
