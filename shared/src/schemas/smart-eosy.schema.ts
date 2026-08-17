import { z } from "zod";
import { AcademicStatusEnum } from "../constants/index.js";

const nullableGradeSchema = z.number().min(0).max(100).nullable();

export const smartLearningAreaResultSchema = z.object({
  code: z.string().trim().min(1, "Learning area code is required"),
  name: z.string().trim().min(1, "Learning area name is required"),
  finalGrade: z.number().min(0).max(100),
  result: z.enum(["PASSED", "FAILED", "INCOMPLETE"]),
});

export const smartSubjectGradeSchema = z.object({
  subjectCode: z.string().trim().min(1, "Subject code is required"),
  subjectName: z.string().trim().min(1, "Subject name is required"),
  teacher: z.string().trim().optional(),
  T1: nullableGradeSchema.optional().default(null),
  T2: nullableGradeSchema.optional().default(null),
  T3: nullableGradeSchema.optional().default(null),
  finalRating: nullableGradeSchema.optional().default(null),
  remarks: z.string().trim().nullable().optional(),
  status: z.enum(["GRADED", "PARTIAL", "NG"]).optional(),
});

export const smartPromotionStatusSchema = z.enum([
  "Promoted",
  "Conditionally Promoted",
  "Retained",
]);

export const smartEosyLearnerOutcomeSchema = z.object({
  lrn: z
    .string()
    .regex(/^\d{12}$/, "SMART must provide a valid 12-digit LRN"),
  studentName: z.string().trim().optional(),
  subjectGrades: z.array(smartSubjectGradeSchema).optional().default([]),
  generalAverage: nullableGradeSchema.optional(),
  finalGeneralAverage: nullableGradeSchema.optional(),
  remarks: z.string().trim().nullable().optional(),
  promotionStatus: smartPromotionStatusSchema.nullable().optional(),
  finalOutcome: z.union([AcademicStatusEnum, z.string().trim().min(1)]).nullable().optional(),
  learningAreas: z.array(smartLearningAreaResultSchema).optional(),
  publishedAt: z.string().datetime({ offset: true }).optional(),
  revision: z
    .union([z.string().trim().min(1), z.number().int().nonnegative()])
    .optional()
    .transform((value) => (value === undefined ? undefined : String(value))),
});

export const smartEosySectionResponseSchema = z.object({
  success: z.boolean().optional(),
  ready: z.boolean().optional(),
  sectionId: z.union([z.string(), z.number()]).optional(),
  sectionName: z.string().trim().optional(),
  gradeLevel: z.string().trim().optional(),
  schoolYear: z.string().trim().optional(),
  adviser: z.string().trim().optional(),
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

const smartSchoolYearLabelSchema = z
  .string()
  .regex(/^\d{4}-\d{4}$/, "SMART must provide a valid school-year label");

const smartSectionReferenceSchema = z.union([
  z.string().trim().min(1),
  z.number().int().positive(),
]);

/**
 * Notification sent by SMART when published section outcomes change.
 * EnrollPro accepts only notifications with enough scope to identify one
 * section in one school year. Unknown fields are ignored by design.
 */
export const smartSyncNotificationSchema = z
  .object({
    type: z.string().trim().min(1),
    sectionId: smartSectionReferenceSchema.optional(),
    sectionName: z.string().trim().min(1).optional(),
    schoolYear: smartSchoolYearLabelSchema,
    timestamp: z.string().datetime({ offset: true }),
    learnerLrns: z
      .array(z.string().regex(/^\d{12}$/, "Invalid learner LRN"))
      .optional(),
    revision: z
      .union([z.string().trim().min(1), z.number().int().nonnegative()])
      .optional()
      .transform((value) => (value === undefined ? undefined : String(value))),
  })
  .superRefine((value, context) => {
    if (value.sectionId === undefined && value.sectionName === undefined) {
      context.addIssue({
        code: "custom",
        path: ["sectionId"],
        message: "SMART must provide a section identifier or section name",
      });
    }
  });
