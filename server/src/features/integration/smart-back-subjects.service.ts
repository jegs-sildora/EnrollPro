import axios from "axios";
import { z } from "zod";

import {
  smartBackSubjectsResponseSchema,
  type LearnerBackSubjectsResponse,
} from "@enrollpro/shared";

import { AppError } from "../../lib/AppError.js";

const smartGradeNumberSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : value,
  z.number().min(0).max(100),
);

const smartNullableGradeNumberSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : value === "" || value === undefined
        ? null
        : value,
  z.number().min(0).max(100).nullable(),
);

const smartSf10RemedialSchema = z.object({
  success: z.literal(true),
  schoolRecords: z.array(
    z.object({
      schoolYear: z.string(),
      gradeLevel: z.enum(["GRADE_7", "GRADE_8", "GRADE_9", "GRADE_10"]),
      remedialClasses: z
        .array(
          z.object({
            learningAreas: z.string().trim().min(1),
            finalRating: smartGradeNumberSchema,
            remedialClassMark: smartNullableGradeNumberSchema,
            status: z.enum(["PENDING", "COMPLETED"]),
            outcome: z
              .enum(["PASSED", "FAILED_TUTORIAL"])
              .nullable()
              .optional()
              .transform((value) => value ?? null),
          }),
        )
        .optional()
        .default([]),
    }),
  ),
});

function previousSchoolYear(schoolYear: string): string {
  const match = /^(\d{4})-(\d{4})$/.exec(schoolYear);
  if (!match) {
    throw new AppError(
      500,
      "The selected school year is invalid.",
      "SCHOOL_YEAR_INVALID",
    );
  }

  const start = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[2], 10);
  if (end !== start + 1) {
    throw new AppError(
      500,
      "The selected school year is invalid.",
      "SCHOOL_YEAR_INVALID",
    );
  }
  return `${start - 1}-${end - 1}`;
}

function smartConfiguration(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.SMART_API_BASE_URL?.trim().replace(/\/$/, "");
  const apiKey = process.env.SMART_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    throw new AppError(
      503,
      "SMART back-subject synchronization is not configured.",
      "SMART_BACK_SUBJECTS_NOT_CONFIGURED",
    );
  }
  return { baseUrl, apiKey };
}

async function fetchSmartSf10BackSubjects(input: {
  baseUrl: string;
  apiKey: string;
  lrn: string;
  schoolYear: string;
  fetchedAt: string;
}): Promise<LearnerBackSubjectsResponse> {
  const failedSchoolYear = previousSchoolYear(input.schoolYear);
  let responseData: unknown;

  try {
    const response = await axios.get<unknown>(
      `${input.baseUrl}/api/integration/students/${encodeURIComponent(input.lrn)}/sf10-grades`,
      {
        headers: {
          "X-EnrollPro-API-Key": input.apiKey,
        },
        timeout: 10_000,
      },
    );
    responseData = response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return {
        source: "SMART",
        schoolYear: input.schoolYear,
        failedSchoolYear,
        generatedAt: input.fetchedAt,
        fetchedAt: input.fetchedAt,
        learner: null,
      };
    }
    throw new AppError(
      503,
      "SMART back-subject records are currently unavailable.",
      "SMART_BACK_SUBJECTS_UNAVAILABLE",
    );
  }

  const parsed = smartSf10RemedialSchema.safeParse(responseData);
  if (!parsed.success) {
    throw new AppError(
      502,
      "SMART returned an invalid SF10 remedial response.",
      "SMART_BACK_SUBJECTS_RESPONSE_INVALID",
    );
  }

  const sourceRecord = parsed.data.schoolRecords.find(
    (record) => record.schoolYear === failedSchoolYear,
  );
  const backSubjects = (sourceRecord?.remedialClasses ?? []).map(
    (subject, index) => ({
      subjectCode: `SMART_SF10_${index + 1}`,
      subjectName: subject.learningAreas,
      gradeLevel: sourceRecord?.gradeLevel ?? "GRADE_7",
      originalGrade: subject.finalRating,
      remedialMark: subject.remedialClassMark,
      recomputedGrade: null,
      outcome: subject.outcome,
      status: subject.status,
      conductedFrom: null,
      conductedTo: null,
    }),
  );

  if (backSubjects.length === 0) {
    return {
      source: "SMART",
      schoolYear: input.schoolYear,
      failedSchoolYear,
      generatedAt: input.fetchedAt,
      fetchedAt: input.fetchedAt,
      learner: null,
    };
  }

  const resolved = backSubjects.every(
    (subject) => subject.status === "COMPLETED" && subject.outcome === "PASSED",
  );
  const failed = backSubjects.some(
    (subject) =>
      subject.status === "COMPLETED"
      && subject.outcome === "FAILED_TUTORIAL",
  );

  return {
    source: "SMART",
    schoolYear: input.schoolYear,
    failedSchoolYear,
    generatedAt: input.fetchedAt,
    fetchedAt: input.fetchedAt,
    learner: {
      lrn: input.lrn,
      schoolYear: input.schoolYear,
      resolved,
      overallOutcome: resolved
        ? "PASSED"
        : failed
          ? "FAILED_TUTORIAL"
          : null,
      backSubjects,
    },
  };
}

export async function fetchSmartBackSubjectsForLearner(input: {
  lrn: string;
  schoolYear: string;
}): Promise<LearnerBackSubjectsResponse> {
  const configuration = smartConfiguration();
  const fetchedAt = new Date().toISOString();
  let responseData: unknown;
  let responseContentType: unknown;

  try {
    const response = await axios.get<unknown>(
      `${configuration.baseUrl}/api/integration/smart/back-subjects`,
      {
        params: {
          schoolYear: input.schoolYear,
          lrn: input.lrn,
          page: 1,
          limit: 1,
        },
        headers: {
          "X-EnrollPro-API-Key": configuration.apiKey,
        },
        timeout: 10_000,
      },
    );
    responseData = response.data;
    responseContentType = response.headers["content-type"];
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        return {
          source: "SMART",
          schoolYear: input.schoolYear,
          failedSchoolYear: previousSchoolYear(input.schoolYear),
          generatedAt: fetchedAt,
          fetchedAt,
          learner: null,
        };
      }
      if (error.response?.status === 401) {
        throw new AppError(
          502,
          "SMART rejected the EnrollPro integration credential.",
          "SMART_BACK_SUBJECTS_AUTH_FAILED",
        );
      }
    }
    return fetchSmartSf10BackSubjects({
      ...configuration,
      ...input,
      fetchedAt,
    });
  }

  if (
    (typeof responseContentType === "string"
      && responseContentType.toLowerCase().includes("text/html"))
    || (typeof responseData === "string"
      && responseData.trimStart().startsWith("<"))
  ) {
    return fetchSmartSf10BackSubjects({
      ...configuration,
      ...input,
      fetchedAt,
    });
  }

  const parsed = smartBackSubjectsResponseSchema.safeParse(responseData);
  if (!parsed.success) {
    throw new AppError(
      502,
      "SMART returned an invalid back-subject response.",
      "SMART_BACK_SUBJECTS_RESPONSE_INVALID",
    );
  }

  if (parsed.data.schoolYear !== input.schoolYear) {
    throw new AppError(
      502,
      "SMART returned back subjects for a different school year.",
      "SMART_BACK_SUBJECTS_YEAR_MISMATCH",
    );
  }
  if (parsed.data.learners.length > 1) {
    throw new AppError(
      502,
      "SMART returned more than one learner for the requested LRN.",
      "SMART_BACK_SUBJECTS_RESPONSE_INVALID",
    );
  }

  const learner = parsed.data.learners[0] ?? null;
  if (learner && (learner.lrn !== input.lrn || learner.schoolYear !== input.schoolYear)) {
    throw new AppError(
      502,
      "SMART returned back subjects for a different learner or school year.",
      "SMART_BACK_SUBJECTS_IDENTITY_MISMATCH",
    );
  }

  return {
    source: "SMART",
    schoolYear: parsed.data.schoolYear,
    failedSchoolYear:
      parsed.data.failedSchoolYear ?? previousSchoolYear(input.schoolYear),
    generatedAt: parsed.data.generatedAt ?? fetchedAt,
    fetchedAt,
    learner: learner
      ? {
          lrn: learner.lrn,
          schoolYear: learner.schoolYear,
          resolved: learner.resolved,
          overallOutcome: learner.overallOutcome,
          backSubjects: learner.backSubjects,
        }
      : null,
  };
}
