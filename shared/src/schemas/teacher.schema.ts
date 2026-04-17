import { z } from "zod";

const optionalUpperText = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized.toUpperCase() : null;
}, z.string().nullable());

const optionalContactNumber = z.preprocess(
  (value) => {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  },
  z
    .string()
    .regex(/^\d{11}$/, "Contact number must be exactly 11 digits")
    .nullable(),
);

export const teacherSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .transform((value) => value.toUpperCase()),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .transform((value) => value.toUpperCase()),
  middleName: optionalUpperText.optional(),
  email: z.string().trim().email("Invalid email address").optional().nullable(),
  employeeId: optionalUpperText.optional(),
  contactNumber: optionalContactNumber.optional(),
  specialization: optionalUpperText.optional(),
  subjects: z
    .array(
      z
        .string()
        .trim()
        .transform((value) => value.toUpperCase()),
    )
    .optional()
    .default([]),
  photo: z
    .string()
    .startsWith("data:image", "Photo must be a valid base64 data URL")
    .optional()
    .nullable(),
});

export const updateTeacherSchema = teacherSchema.partial();

const optionalDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .optional()
  .nullable();

export const teacherDesignationSchema = z
  .object({
    schoolYearId: z.number().int().positive("schoolYearId is required"),
    isClassAdviser: z.boolean().default(false),
    advisorySectionId: z.number().int().positive().optional().nullable(),
    advisoryEquivalentHoursPerWeek: z
      .number()
      .min(0, "Advisory equivalent hours must be non-negative")
      .max(60, "Advisory equivalent hours cannot exceed 60")
      .optional(),
    isTic: z.boolean().default(false),
    isTeachingExempt: z.boolean().default(false),
    customTargetTeachingHoursPerWeek: z
      .number()
      .min(0, "Target teaching hours must be non-negative")
      .max(60, "Target teaching hours cannot exceed 60")
      .optional()
      .nullable(),
    designationNotes: z.string().max(1000).optional().nullable(),
    effectiveFrom: optionalDateOnly,
    effectiveTo: optionalDateOnly,
    reason: z.string().max(500).optional().nullable(),
    allowAdviserOverride: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.effectiveFrom || !value.effectiveTo) {
      return;
    }

    const from = new Date(`${value.effectiveFrom}T00:00:00.000Z`);
    const to = new Date(`${value.effectiveTo}T00:00:00.000Z`);

    if (to < from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effectiveTo"],
        message: "effectiveTo cannot be earlier than effectiveFrom",
      });
    }
  });
