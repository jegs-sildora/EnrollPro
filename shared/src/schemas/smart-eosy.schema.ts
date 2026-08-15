import { z } from "zod";
import { AcademicStatusEnum } from "../constants/index.js";

export const smartLearningAreaResultSchema = z.object({
  code: z.string().trim().min(1, "Learning area code is required"),
  name: z.string().trim().min(1, "Learning area name is required"),
  finalGrade: z.number().min(0).max(100),
  result: z.enum(["PASSED", "FAILED", "INCOMPLETE"]),
});

export const smartEosyLearnerOutcomeSchema = z
  .object({
    lrn: z
      .string()
      .regex(/^\d{12}$/, "SMART must provide a valid 12-digit LRN"),
    studentName: z.string().optional(),
    finalGeneralAverage: z.number().min(0).max(100),
    finalOutcome: AcademicStatusEnum,
    learningAreas: z.array(smartLearningAreaResultSchema).optional().default([]),
    publishedAt: z.string().optional(),
    revision: z.union([z.string(), z.number()]).optional().default("1").transform((val) => String(val)),
  });

export const smartEosySectionResponseSchema = z.object({
  success: z.boolean().optional(),
  ready: z.boolean().optional(),
  sectionId: z.union([z.string(), z.number()]).optional(),
  outcomesSynced: z.number().optional(),
  outcomes: z.array(smartEosyLearnerOutcomeSchema).optional(),
  students: z.array(smartEosyLearnerOutcomeSchema).optional(),
  data: z
    .object({
      students: z.array(smartEosyLearnerOutcomeSchema).optional(),
      outcomes: z.array(smartEosyLearnerOutcomeSchema).optional(),
    })
    .optional(),
});
