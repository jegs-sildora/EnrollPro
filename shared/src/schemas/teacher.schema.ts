import { z } from "zod";
import {
  DEPED_TEACHER_PLANTILLA_POSITION_VALUES,
  DEPED_TEACHER_DEPARTMENT_VALUES,
  DEPED_TEACHER_SPECIALIZATION_VALUES,
  SexEnum,
  TEACHER_FUNDING_SOURCE_VALUES,
  TEACHER_NATURE_OF_APPOINTMENT_VALUES,
  TEACHER_SCHEDULE_DAY_VALUES,
} from "../constants/index.js";

const optionalUpperText = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.normalize("NFC").trim();
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
    .transform((value) => value.normalize("NFC").toUpperCase());

const teacherPlantillaPositionSchema = z.enum(
  DEPED_TEACHER_PLANTILLA_POSITION_VALUES,
);

const teacherDepartmentSchema = z.enum(DEPED_TEACHER_DEPARTMENT_VALUES);

const teacherSpecializationSchema = z.enum(DEPED_TEACHER_SPECIALIZATION_VALUES);
const teacherNatureOfAppointmentSchema = z.enum(
  TEACHER_NATURE_OF_APPOINTMENT_VALUES,
);
const teacherFundingSourceSchema = z.enum(TEACHER_FUNDING_SOURCE_VALUES);
const teacherScheduleDaySchema = z.enum(TEACHER_SCHEDULE_DAY_VALUES);
const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:MM format");

export const teacherSchemaBase = z
  .object({
    firstName: requiredUpperText("First name is required"),
    lastName: requiredUpperText("Last name is required"),
    middleName: optionalUpperText.optional(),
    suffix: optionalUpperText.optional(),
    sex: SexEnum.default("FEMALE"),
    birthdate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
      .nullable()
      .optional(),
    personnelType: z.enum(["TEACHING", "NON_TEACHING"]).optional().nullable(),
    functionalAssignment: z.string().optional().nullable(),
    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .transform((value) => value.normalize("NFC").toLowerCase())
      .optional()
      .nullable(),
    employeeId: z
      .string()
      .regex(/^[0-9]{7}$/, "Employee ID must be exactly 7 numeric digits"),
    contactNumber: optionalContactNumber.optional(),
    specialization: z
      .preprocess(
        (value) => {
          if (value === undefined || value === null || value === "") {
            return null;
          }

          if (typeof value === "string") {
            return value.normalize("NFC").trim().toUpperCase();
          }

          return value;
        },
        z.union([teacherSpecializationSchema, z.null()]),
      )
      .optional(),
    undergraduateDegree: optionalUpperText.optional(),
    postgraduateDegree: optionalUpperText.optional(),
    majorSpecialization: optionalUpperText.optional(),
    minorSpecialization: optionalUpperText.optional(),
    administrativeRemarks: optionalUpperText.optional(),
    indigenousCommunity: optionalUpperText.optional(),
    natureOfAppointment: teacherNatureOfAppointmentSchema
      .optional()
      .default("REGULAR_PERMANENT"),
    fundingSource: teacherFundingSourceSchema.optional().default("NATIONAL"),
    department: z
      .preprocess(
        (value) => {
          if (value === undefined || value === null || value === "") {
            return null;
          }

          if (typeof value === "string") {
            return value.normalize("NFC").trim().toUpperCase();
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
            return value.normalize("NFC").trim().toUpperCase();
          }

          return value;
        },
        z.union([teacherPlantillaPositionSchema, z.null()]),
      )
      .optional(),
  })
  .strict();

export const teacherSchema = teacherSchemaBase;

// PUT semantics: full profile replacement contract.
export const updateTeacherSchema = teacherSchemaBase.extend({
  serviceStatus: z.enum([
    "ACTIVE",
    "ON_LEAVE",
    "TRANSFERRED",
    "RETIRED_RESIGNED",
    "DROPPED_FROM_ROLLS",
  ]).optional(),
  serviceEffectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be in YYYY-MM-DD format")
    .optional()
    .nullable(),
  serviceRemarks: z
    .string()
    .max(500, "Remarks must not exceed 500 characters")
    .optional()
    .nullable(),
  roles: z.array(z.string()).optional(),
});

export const teacherSchedulePeriodSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    dayOfWeek: teacherScheduleDaySchema,
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
    subjectLabel: optionalUpperText.optional(),
    sectionLabel: optionalUpperText.optional(),
  })
  .superRefine((value, ctx) => {
    const [startHour, startMinute] = value.startTime.split(":").map(Number);
    const [endHour, endMinute] = value.endTime.split(":").map(Number);
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;

    if (endTotal <= startTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be after start time",
        path: ["endTime"],
      });
    }
  });

export const teacherSchedulePeriodsReplaceSchema = z.object({
  schoolYearId: z.coerce.number().int().positive("schoolYearId is required"),
  periods: z.array(teacherSchedulePeriodSchema).max(80),
});

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
          .transform((value) => value.normalize("NFC").toUpperCase()),
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

export const TEACHER_SERVICE_STATUS_VALUES = [
  "ACTIVE",
  "ON_LEAVE",
  "TRANSFERRED",
  "RETIRED_RESIGNED",
  "DROPPED_FROM_ROLLS",
] as const;

export const updateServiceStatusSchema = z.object({
  status: z.enum(TEACHER_SERVICE_STATUS_VALUES, {
    message: "Please select a valid service status",
  }),
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be in YYYY-MM-DD format"),
  remarks: z
    .string()
    .max(500, "Remarks must not exceed 500 characters")
    .optional()
    .nullable(),
});

export type UpdateServiceStatusInput = z.infer<typeof updateServiceStatusSchema>;
