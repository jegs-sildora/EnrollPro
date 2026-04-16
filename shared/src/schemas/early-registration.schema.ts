import { z } from "zod";
import {
  SexEnum,
  EarlyRegGradeLevelEnum,
  LearnerTypeEnum,
  DisabilityTypeEnum,
  ScpTypeEnum,
} from "../constants/index.js";

// ─── DO 017 s.2025 — Basic Education Early Registration ─

/** Guardian sub-schema (father / mother / legal guardian row) */
export const earlyRegGuardianSchema = z.object({
  lastName: z.string().min(1, "Enter the last name.").max(100),
  firstName: z.string().min(1, "Enter the first name.").max(100),
  middleName: z.string().max(100).optional().nullable(),
  contactNumber: z.string().max(20).optional().nullable(),
  email: z
    .string()
    .email("Enter a valid email address.")
    .optional()
    .nullable()
    .or(z.literal("")),
});

/** Mother maiden name schema */
const motherSchema = z.object({
  maidenName: z
    .string()
    .min(1, "Enter the mother's maiden last name.")
    .max(100),
  firstName: z.string().min(1, "Enter the first name.").max(100),
  middleName: z.string().max(100).optional().nullable(),
  contactNumber: z.string().max(20).optional().nullable(),
  email: z
    .string()
    .email("Enter a valid email address.")
    .optional()
    .nullable()
    .or(z.literal("")),
});

/** Optional guardian — all fields optional */
const optionalGuardianSchema = z.object({
  lastName: z.string().max(100).optional().nullable(),
  firstName: z.string().max(100).optional().nullable(),
  middleName: z.string().max(100).optional().nullable(),
  contactNumber: z.string().max(20).optional().nullable(),
  email: z
    .string()
    .email("Enter a valid email address.")
    .optional()
    .nullable()
    .or(z.literal("")),
});

/**
 * Full early-registration submission schema.
 * Maps 1-to-1 with the DepEd Basic Education Early Registration Form
 * per DO 017, s. 2025 (Grades 7-10, Public JHS).
 */
export const earlyRegistrationSubmitSchema = z
  .object({
    // ── Registration ──────────────────────────────────────
    schoolYear: z.string().min(1, "Select the School Year."),
    gradeLevel: EarlyRegGradeLevelEnum.or(z.literal("")).refine(
      (v) => v !== "",
      {
        message: "Select the Grade Level.",
      },
    ),
    hasNoLrn: z.boolean().default(false),
    lrn: z
      .string()
      .regex(/^\d{12}$/, "Enter a valid 12-digit LRN.")
      .optional()
      .nullable()
      .or(z.literal("")),
    learnerType: LearnerTypeEnum,
    isScpApplication: z.boolean().default(false),
    scpType: ScpTypeEnum.optional().nullable(),
    studentPhoto: z.string().optional().nullable(),

    // ── Personal ──────────────────────────────────────────
    lastName: z.string().min(1, "Enter the last name.").max(100),
    firstName: z.string().min(1, "Enter the first name.").max(100),
    middleName: z.string().max(100).optional().nullable(),
    extensionName: z.string().max(20).optional().nullable(),
    birthdate: z
      .string()
      .min(1, "Enter the learner's date of birth.")
      .or(z.date()),
    sex: SexEnum,
    placeOfBirth: z.string().min(1, "Enter the place of birth.").max(150),
    religion: z.string().max(100).optional().nullable(),

    // ── IP / PWD ──────────────────────────────────────────
    isIpCommunity: z.boolean().default(false),
    ipGroupName: z.string().max(100).optional().nullable(),
    isLearnerWithDisability: z.boolean().default(false),
    disabilityTypes: z.array(DisabilityTypeEnum).optional().nullable(),

    // ── Address ───────────────────────────────────────────
    houseNoStreet: z.string().max(200).optional().nullable(),
    sitio: z.string().max(100).optional().nullable(),
    barangay: z.string().min(1, "Enter the Barangay.").max(100),
    cityMunicipality: z
      .string()
      .min(1, "Enter the City/Municipality.")
      .max(100),
    province: z.string().min(1, "Enter the Province.").max(100),

    // ── Guardians ─────────────────────────────────────────
    father: optionalGuardianSchema.optional().nullable(),
    mother: motherSchema.optional().nullable(),
    guardian: optionalGuardianSchema.optional().nullable(),
    hasNoMother: z.boolean().default(false),
    hasNoFather: z.boolean().default(false),
    guardianRelationship: z.string().max(50).optional().nullable(),
    primaryContact: z
      .enum(["FATHER", "MOTHER", "GUARDIAN"])
      .optional()
      .nullable(),
    contactNumber: z
      .string()
      .min(1, "Enter the primary contact number.")
      .regex(/^09\d{2}-\d{3}-\d{4}$/, "Use format 09XX-XXX-XXXX."),
    email: z
      .string()
      .email("Enter a valid email address.")
      .optional()
      .nullable()
      .or(z.literal("")),

    // ── Legal / Privacy ───────────────────────────────────
    isPrivacyConsentGiven: z.boolean().refine((v) => v === true, {
      message: "Confirm Data Privacy consent to continue.",
    }),
  })
  .superRefine((data, ctx) => {
    if (data.isScpApplication && !data.scpType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select an SCP track to continue.",
        path: ["scpType"],
      });
    }

    const lrn = data.lrn?.trim() ?? "";
    const isIncomingGrade7 =
      data.learnerType === "NEW_ENROLLEE" && data.gradeLevel === "7";
    const isTransferee = data.learnerType === "TRANSFEREE";
    const canDeclareNoLrn = isIncomingGrade7 || isTransferee;

    if (data.hasNoLrn) {
      if (!canDeclareNoLrn) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Only incoming Grade 7 and transferee learners can submit without an LRN.",
          path: ["hasNoLrn"],
        });
      }

      if (lrn) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Clear the LRN field when declaring that the learner has no LRN.",
          path: ["lrn"],
        });
      }
    } else if (!lrn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "LRN is required unless you declare that the learner has no LRN.",
        path: ["lrn"],
      });
    }

    // At least one parent/guardian must be provided
    const hasFather =
      !data.hasNoFather && data.father?.lastName && data.father?.firstName;
    const hasMother =
      !data.hasNoMother && data.mother?.maidenName && data.mother?.firstName;
    const hasGuardian = data.guardian?.lastName && data.guardian?.firstName;

    if (!hasFather && !hasMother && !hasGuardian) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one parent or guardian record.",
        path: ["father"],
      });
    }

    // Guardian validation: If both parents are absent, guardian becomes strictly required
    if (data.hasNoFather && data.hasNoMother) {
      if (!data.guardian?.lastName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter the guardian's last name.",
          path: ["guardian", "lastName"],
        });
      }
      if (!data.guardian?.firstName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter the guardian's first name.",
          path: ["guardian", "firstName"],
        });
      }
      if (!data.guardianRelationship?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter the guardian relationship.",
          path: ["guardianRelationship"],
        });
      }
    }

    // If mother is present (not skipped), maiden name and first name are required
    if (!data.hasNoMother) {
      if (!data.mother?.maidenName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter the mother's maiden last name.",
          path: ["mother", "maidenName"],
        });
      }
      if (!data.mother?.firstName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter the mother's first name.",
          path: ["mother", "firstName"],
        });
      }
    }

    // If father is present (not skipped), last name and first name are required
    if (!data.hasNoFather) {
      if (!data.father?.lastName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter the father's last name.",
          path: ["father", "lastName"],
        });
      }
      if (!data.father?.firstName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter the father's first name.",
          path: ["father", "firstName"],
        });
      }
    }

    // Guardian relationship required when guardian is provided (even if parents are present)
    if (hasGuardian && !data.guardianRelationship?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the guardian relationship.",
        path: ["guardianRelationship"],
      });
    }

    // IP group name required when IP community flag is true
    if (data.isIpCommunity && !data.ipGroupName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the learner's IP group or ethnicity.",
        path: ["ipGroupName"],
      });
    }

    // Disability types required when PWD flag is true
    if (
      data.isLearnerWithDisability &&
      (!data.disabilityTypes || data.disabilityTypes.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one disability type.",
        path: ["disabilityTypes"],
      });
    }
  });
