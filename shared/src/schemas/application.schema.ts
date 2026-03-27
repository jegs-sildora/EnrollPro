import { z } from "zod";
import {
  SexEnum,
  GradeLevelEnum,
  SHSTrackEnum,
  ScpTypeEnum,
  LastSchoolTypeEnum,
  LearnerTypeEnum,
} from "../constants/index.js";

// ─── Shared sub-schemas ────────────────────────────────
export const addressSchema = z.object({
  houseNo: z.string().optional(),
  street: z.string().optional(),
  barangay: z.string().min(1, "Barangay is required"),
  cityMunicipality: z.string().min(1, "City/Municipality is required"),
  province: z.string().min(1, "Province is required"),
  country: z.string().default("Philippines"),
  zipCode: z.string().optional(),
});

export const optionalAddressSchema = z
  .object({
    houseNo: z.string().optional(),
    street: z.string().optional(),
    barangay: z.string().optional(),
    cityMunicipality: z.string().optional(),
    province: z.string().optional(),
    country: z.string().default("Philippines"),
    zipCode: z.string().optional(),
  })
  .optional()
  .nullable();

// ─── Application Submit ────────────────────────────────
export const applicationSubmitSchema = z.object({
  studentPhoto: z.string().optional().nullable(),
  lrn: z
    .string()
    .regex(/^\d{12}$/, "LRN must be exactly 12 numeric digits")
    .optional()
    .nullable(),
  psaBirthCertNumber: z.string().optional().nullable(),

  gradeLevel: GradeLevelEnum,
  shsTrack: SHSTrackEnum.optional().nullable(),
  electiveCluster: z.string().optional().nullable(),
  isScpApplication: z.boolean().default(false),
  scpType: ScpTypeEnum.optional().nullable(),

  lastName: z.string().min(1, "Last name is required").max(100),
  firstName: z.string().min(1, "First name is required").max(100),
  middleName: z.string().optional().nullable(),
  extensionName: z.string().optional().nullable(),
  birthdate: z.string().or(z.date()),
  sex: SexEnum,
  placeOfBirth: z.string().min(1, "Place of birth is required"),
  religion: z.string().optional().nullable(),

  isIpCommunity: z.boolean().default(false),
  ipGroupName: z.string().optional().nullable(),
  is4PsBeneficiary: z.boolean().default(false),
  householdId4Ps: z.string().optional().nullable(),
  isBalikAral: z.boolean().default(false),
  lastYearEnrolled: z.string().optional().nullable(),
  isLearnerWithDisability: z.boolean().default(false),
  specialNeedsCategory: z.enum(["a1", "a2"]).optional().nullable(),
  hasPwdId: z.boolean().default(false),
  disabilityTypes: z.array(z.string()).default([]),

  currentAddress: addressSchema,
  permanentAddress: optionalAddressSchema,

  mother: z.object({
    lastName: z.string().min(1, "Mother's last name is required"),
    firstName: z.string().min(1, "Mother's first name is required"),
    middleName: z.string().optional().nullable(),
    contactNumber: z.string().optional().nullable(),
    maidenName: z.string().optional().nullable(),
  }),
  father: z.object({
    lastName: z.string().min(1, "Father's last name is required"),
    firstName: z.string().min(1, "Father's first name is required"),
    middleName: z.string().optional().nullable(),
    contactNumber: z.string().optional().nullable(),
  }),
  guardian: z
    .object({
      lastName: z.string().optional().nullable(),
      firstName: z.string().optional().nullable(),
      middleName: z.string().optional().nullable(),
      contactNumber: z.string().optional().nullable(),
      relationship: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  email: z
    .string()
    .email("Invalid email address")
    .min(1, "Email address is required"),

  lastSchoolName: z.string().min(1, "Last school name is required"),
  lastSchoolId: z.string().optional().nullable(),
  lastGradeCompleted: z.string().min(1, "Last grade completed is required"),
  schoolYearLastAttended: z
    .string()
    .min(1, "School year last attended is required"),
  lastSchoolAddress: z.string().optional().nullable(),
  lastSchoolType: LastSchoolTypeEnum,

  g10ScienceGrade: z.number().optional().nullable(),
  grade10MathGrade: z.number().optional().nullable(),
  generalAverage: z.number().optional().nullable(),

  artField: z.string().optional().nullable(),
  sportsList: z.array(z.string()).default([]),
  foreignLanguage: z.string().optional().nullable(),

  isPrivacyConsentGiven: z.boolean().refine((val) => val === true, {
    message: "Consent is required",
  }),
  learnerType: LearnerTypeEnum,
  learningModalities: z.array(z.string()).default([]),
});

// ─── Application Action Schemas ────────────────────────
export const approveSchema = z.object({
  sectionId: z.number().int().positive("Section ID is required"),
});

export const rejectSchema = z.object({
  rejectionReason: z.string().optional(),
});

export const scheduleExamSchema = z.object({
  examDate: z.string().or(z.date()),
  examTime: z.string().optional().nullable(),
  assessmentType: z.string().optional(),
  examVenue: z.string().optional().nullable(),
});

export const recordResultSchema = z.object({
  examScore: z.number().optional().nullable(),
  examResult: z.string().optional().nullable(),
  examNotes: z.string().optional().nullable(),
  interviewResult: z.string().optional().nullable(),
  interviewDate: z.string().or(z.date()).optional().nullable(),
  interviewNotes: z.string().optional().nullable(),
  auditionResult: z.string().optional().nullable(),
  tryoutResult: z.string().optional().nullable(),
  natScore: z.number().optional().nullable(),
});

export const rescheduleExamSchema = z.object({
  examDate: z.string().or(z.date()),
  examVenue: z.string().optional().nullable(),
});

export const updateChecklistSchema = z.object({
  isPsaBirthCertPresented: z.boolean().optional(),
  isOriginalPsaBcCollected: z.boolean().optional(),
  isSf9Submitted: z.boolean().optional(),
  isSf10Requested: z.boolean().optional(),
  isGoodMoralPresented: z.boolean().optional(),
  isMedicalEvalSubmitted: z.boolean().optional(),
  isUndertakingSigned: z.boolean().optional(),
  isConfirmationSlipReceived: z.boolean().optional(),
});

export const requestRevisionSchema = z.object({
  message: z.string().optional(),
});
