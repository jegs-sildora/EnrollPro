import { z } from "zod";
import {
  DEPED_TEACHER_PLANTILLA_POSITION_VALUES,
  DEPED_TEACHER_DEPARTMENT_VALUES,
  DEPED_TEACHER_SPECIALIZATION_VALUES,
} from "../constants/index.js";

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

    // Strip all non-digit characters (e.g., hyphens, spaces)
    const digitsOnly = value.replace(/\D/g, "");
    return digitsOnly.length > 0 ? digitsOnly : null;
  },
  z
    .string()
    .regex(/^\d{11}$/, "Contact number must be exactly 11 digits")
    .nullable(),
);

const requiredUpperText = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .transform((value) => value.toUpperCase());

const teacherPlantillaPositionSchema = z.enum(
  DEPED_TEACHER_PLANTILLA_POSITION_VALUES,
);

const teacherDepartmentSchema = z.enum(DEPED_TEACHER_DEPARTMENT_VALUES);

const teacherSpecializationSchema = z.enum(DEPED_TEACHER_SPECIALIZATION_VALUES);

export const teacherSchema = z
  .object({
    firstName: requiredUpperText("First name is required"),
    lastName: requiredUpperText("Last name is required"),
    middleName: optionalUpperText.optional(),
    email: z
      .string()
      .trim()
      .min(1, "DepEd email address is required")
      .email("Invalid email address")
      .transform((value) => value.toLowerCase()),
    employeeId: requiredUpperText("Employee ID is required"),
    contactNumber: optionalContactNumber.optional(),
    specialization: z
      .preprocess(
        (value) => {
          if (value === undefined || value === null || value === "") {
            return null;
          }

          if (typeof value === "string") {
            return value.trim().toUpperCase();
          }

          return value;
        },
        z.union([teacherSpecializationSchema, z.null()]),
      )
      .optional(),
    department: z
      .preprocess(
        (value) => {
          if (value === undefined || value === null || value === "") {
            return null;
          }

          if (typeof value === "string") {
            return value.trim().toUpperCase();
          }

          return value;
        },
        z.union([teacherDepartmentSchema, z.null()]),
      )
      .optional(),
    plantillaPosition: z
      .preprocess(
        (value) => {
          if (value === undefined || value === null || value === "") {
            return null;
          }

          if (typeof value === "string") {
            return value.trim().toUpperCase();
          }

          return value;
        },
        z.union([teacherPlantillaPositionSchema, z.null()]),
      )
      .optional(),
    subjects: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .transform((v) => v.toUpperCase()),
      )
      .optional()
      .default([]),
  })
  .strict();

// PUT semantics: full profile replacement contract.
export const updateTeacherSchema = teacherSchema;

const optionalDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .optional()
  .nullable();

export const teacherDesignationSchema = z
  .object({
    schoolYearId: z.coerce.number().int().positive("schoolYearId is required"),
    isClassAdviser: z.boolean().default(false),
    advisorySectionId: z.coerce.number().int().positive().optional().nullable(),
    ancillaryRoles: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .transform((value) => value.toUpperCase()),
      )
      .optional()
      .default([]),
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

export const TEACHER_DEACTIVATION_REASONS = [
  "Retirement",
  "Transfer (School-to-School)",
  "Resignation",
  "Extended Leave",
  "End of Contract",
] as const;

export const deactivateTeacherSchema = z.object({
  reason: z.enum(TEACHER_DEACTIVATION_REASONS, {
    message: "Please select a valid deactivation reason",
  }),
});

export type DeactivateTeacherInput = z.infer<typeof deactivateTeacherSchema>;
