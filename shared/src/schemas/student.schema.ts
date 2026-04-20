import { z } from "zod";
import { AssessmentPeriodEnum } from "../constants/index.js";

const studentAddressPatchSchema = z.object({
  houseNoStreet: z.string().trim().max(255).optional().nullable(),
  street: z.string().trim().max(255).optional().nullable(),
  sitio: z.string().trim().max(255).optional().nullable(),
  barangay: z.string().trim().max(255).optional().nullable(),
  cityMunicipality: z.string().trim().max(255).optional().nullable(),
  province: z.string().trim().max(255).optional().nullable(),
  country: z.string().trim().max(255).optional().nullable(),
  zipCode: z.string().trim().max(20).optional().nullable(),
});

const studentFamilyMemberPatchSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  middleName: z.string().trim().max(100).optional().nullable(),
  contactNumber: z.string().trim().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  occupation: z.string().trim().max(150).optional().nullable(),
  relationship: z.string().trim().max(80).optional().nullable(),
});

const DROPOUT_REASON_CODE_VALUES = [
  "ARMED_CONFLICT",
  "ILLNESS",
  "FINANCIAL_DIFFICULTY",
  "FAMILY_PROBLEM",
  "LACK_OF_INTEREST",
  "EMPLOYMENT",
  "OTHER",
] as const;

export const DropoutReasonCodeEnum = z.enum(DROPOUT_REASON_CODE_VALUES);

export const healthRecordSchema = z.object({
  assessmentPeriod: AssessmentPeriodEnum,
  assessmentDate: z.string().or(z.date()),
  weightKg: z.number().positive(),
  heightCm: z.number().positive(),
  notes: z.string().optional().nullable(),
});

export const updateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  middleName: z.string().optional().nullable(),
  suffix: z.string().trim().max(50).optional().nullable(),
  sex: z.enum(["MALE", "FEMALE"]).optional(),
  birthDate: z.string().or(z.date()).optional(),
  placeOfBirth: z.string().trim().max(255).optional().nullable(),
  religion: z.string().trim().max(100).optional().nullable(),
  motherTongue: z.string().trim().max(100).optional().nullable(),
  currentAddress: studentAddressPatchSchema.optional(),
  permanentAddress: studentAddressPatchSchema.optional().nullable(),
  motherName: studentFamilyMemberPatchSchema.optional(),
  fatherName: studentFamilyMemberPatchSchema.optional(),
  guardianInfo: studentFamilyMemberPatchSchema.optional().nullable(),
  emailAddress: z.string().email().optional().nullable(),
  email: z.string().email().optional().nullable(),
  contactNumber: z.string().optional().nullable(),
});

export const assignStudentLrnSchema = z.object({
  lrn: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "LRN must be exactly 12 digits"),
});

export const transferOutStudentSchema = z.object({
  transferOutDate: z.string().or(z.date()),
  destinationSchool: z
    .string()
    .trim()
    .min(2, "Destination school is required")
    .max(200),
  reason: z.string().trim().max(255).optional().nullable(),
});

export const dropOutStudentSchema = z
  .object({
    dropOutDate: z.string().or(z.date()),
    reasonCode: DropoutReasonCodeEnum,
    reasonNote: z.string().trim().max(255).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.reasonCode === "OTHER" && !value.reasonNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasonNote"],
        message: "Provide details when reason code is OTHER",
      });
    }
  });

export const shiftStudentSectionSchema = z.object({
  sectionId: z.number().int().positive("Section is required"),
});
