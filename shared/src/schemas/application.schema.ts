import { z } from "zod";
import {
  ApplicantTypeEnum,
  ApplicationStatusEnum,
  ReadingProfileLevelEnum,
  SexEnum,
  GradeLevelEnum,
  LastSchoolTypeEnum,
  LearnerTypeEnum,
  TrackingCurrentStepEnum,
  TrackingProgramTypeEnum,
  TrackingStatusEnum,
  AcademicStatusEnum,
} from "../constants/index.js";

// ─── Shared sub-schemas ────────────────────────────────
export const addressSchema = z.object({
  houseNoStreet: z.string().optional(),
  sitio: z.string().optional(),
  barangay: z.string().min(1, "Barangay is required"),
  cityMunicipality: z.string().min(1, "City/Municipality is required"),
  province: z.string().min(1, "Province is required"),
});

export const optionalAddressSchema = z
  .object({
    houseNoStreet: z.string().optional(),
    sitio: z.string().optional(),
    barangay: z.string().optional(),
    cityMunicipality: z.string().optional(),
    province: z.string().optional(),
  })
  .optional()
  .nullable();

export const familyMemberSchema = z.object({
  lastName: z.string().min(1, "Last name is required"),
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional().nullable(),
  contactNumber: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
});

const optionalGeneralAverageSchema = z.preprocess(
  (value) => {
    if (value == null || value === "") {
      return undefined;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : Number.NaN;
    }

    if (typeof value === "string") {
      const parsed = Number(value.trim().replace(",", "."));
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    }

    return value;
  },
  z
    .number()
    .refine(
      (value) => Number.isFinite(value),
      "Final General Average must be a number",
    )
    .min(0, "Final General Average must be between 0 and 100")
    .max(100, "Final General Average must be between 0 and 100")
    .refine((value) => {
      if (value === undefined || value === null) return true;
      const stringValue = value.toString();
      const decimalPart = stringValue.split(".")[1];
      return !decimalPart || decimalPart.length <= 2;
    }, "Final General Average must have up to 2 decimal places")
    .optional()
    .nullable(),
);

export const previousSchoolSchema = z.object({
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
  generalAverage: optionalGeneralAverageSchema,
});

// ─── Application Submit ────────────────────────────────
export const applicationSubmitSchema = z
  .object({
    studentPhoto: z.string().optional().nullable(),
    hasNoLrn: z.boolean().default(false),
    lrn: z
      .string()
      .regex(/^\d{12}$/, "LRN must be exactly 12 numeric digits")
      .optional()
      .nullable(),
    psaBirthCertNumber: z.string().trim().toUpperCase().optional().nullable(),

    gradeLevel: GradeLevelEnum,

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

    mother: familyMemberSchema,
    father: familyMemberSchema,
    guardian: z
      .object({
        lastName: z.string().optional().nullable(),
        firstName: z.string().optional().nullable(),
        middleName: z.string().optional().nullable(),
        contactNumber: z.string().optional().nullable(),
        relationship: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        occupation: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),
    email: z
      .string()
      .email("Invalid email address")
      .min(1, "Email address is required"),

    // Previous school (now maps to PreviousSchool model)
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
    generalAverage: optionalGeneralAverageSchema,



    isPrivacyConsentGiven: z.boolean().refine((val) => val === true, {
      message: "Consent is required",
    }),
    learnerType: LearnerTypeEnum,
    learningModalities: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    const lrn = data.lrn?.trim() ?? "";
    const isIncomingGrade7 =
      data.learnerType === "NEW_ENROLLEE" && data.gradeLevel === "7";
    const isTransferee = data.learnerType === "TRANSFEREE";
    const canDeclareNoLrn = isIncomingGrade7 || isTransferee;

    if (data.hasNoLrn) {
      if (!canDeclareNoLrn) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hasNoLrn"],
          message:
            "Only incoming Grade 7 and transferee learners can submit without an LRN.",
        });
      }

      if (lrn) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lrn"],
          message:
            "Clear the LRN field when declaring that the learner has no LRN.",
        });
      }
    } else if (!lrn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lrn"],
        message:
          "LRN is required unless you declare that the learner has no LRN.",
      });
    }


  });

export const applicationTrackingStateSchema = z.object({
  programType: TrackingProgramTypeEnum,
  status: TrackingStatusEnum,
  rawStatus: ApplicationStatusEnum,
  currentStep: TrackingCurrentStepEnum,
  assessmentData: z.null().default(null).nullable(),
});

export const applicationSubmitResponseSchema = z
  .object({
    trackingNumber: z.string().min(1),
    applicantType: ApplicantTypeEnum,
  })
  .merge(applicationTrackingStateSchema);

export const applicationTrackResponseSchema = z
  .object({
    trackingNumber: z.string().min(1),
    applicantType: ApplicantTypeEnum,
  })
  .merge(applicationTrackingStateSchema)
  .passthrough();

// ─── Application Action Schemas ────────────────────────
export const approveSchema = z.object({
  sectionId: z.number().int().positive("Section ID is required"),
});

export const rejectSchema = z.object({
  rejectionReason: z.string().optional(),
});

export const unenrollSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required")
    .max(200, "Reason must not exceed 200 characters"),
  note: z
    .string()
    .trim()
    .max(500, "Note must not exceed 500 characters")
    .optional()
    .nullable(),
});

export const processExitSchema = z.object({
  exitType: z.enum(["TRANSFERRED_OUT", "DROPPED_OUT", "NO_LONGER_PARTICIPATING"]),
  effectiveDate: z
    .string()
    .trim()
    .min(1, "Effective date is required")
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid date format." }),
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required")
    .max(500, "Reason must not exceed 500 characters"),
});

export const readingProfileUpdateSchema = z.object({
  readingProfileLevel: ReadingProfileLevelEnum,
  readingProfileNotes: z
    .string()
    .trim()
    .max(500, "Reading profile notes must not exceed 500 characters")
    .optional()
    .nullable(),
});

export const specialEnrollmentSchema = z
  .object({
    enrollmentApplicationId: z.number().int().positive().optional(),
    processOutcome: z
      .enum(["ENCODE_ONLY", "ENCODE_AND_VERIFY"])
      .default("ENCODE_AND_VERIFY"),
    hasNoLrn: z.boolean().default(false),
    lrn: z
      .string()
      .trim()
      .regex(/^\d{12}$/, "LRN must be exactly 12 numeric digits")
      .optional()
      .nullable(),
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    middleName: z.string().trim().optional().nullable(),
    extensionName: z.string().trim().optional().nullable(),
    birthdate: z.string().or(z.date()),
    sex: SexEnum,
    placeOfBirth: z.string().trim().optional().nullable(),
    learnerType: LearnerTypeEnum,
    applicantType: ApplicantTypeEnum.default("REGULAR"),
    gradeLevelId: z.number().int().positive("Grade level is required"),
    academicStatus: AcademicStatusEnum.default("PROMOTED"),
    originSchoolName: z.string().trim().optional().nullable(),
    peptCertificateNumber: z.string().trim().optional().nullable(),
    peptPassingDate: z.string().or(z.date()).optional().nullable(),
    currentAddress: addressSchema.optional(),
    mother: familyMemberSchema
      .pick({
        firstName: true,
        lastName: true,
        middleName: true,
        contactNumber: true,
      })
      .optional(),
    father: familyMemberSchema
      .pick({
        firstName: true,
        lastName: true,
        middleName: true,
        contactNumber: true,
      })
      .optional(),
    guardian: familyMemberSchema
      .pick({
        firstName: true,
        lastName: true,
        middleName: true,
        contactNumber: true,
      })
      .optional(),
    guardianRelationship: z.string().trim().optional().nullable(),
    contactNumber: z.string().trim().optional().nullable(),
    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .optional()
      .nullable(),
    checklist: z
      .object({
        academicStatus: AcademicStatusEnum.optional(),
        isPsaBirthCertPresented: z.boolean().optional(),
        isOriginalPsaBcCollected: z.boolean().optional(),
        isPsaPhase1CopyMatched: z.boolean().optional(),
        isSf9Submitted: z.boolean().optional(),
        finalGeneralAverage: z.number().min(0).max(100).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const lrn = data.lrn?.trim() ?? "";

    if (data.hasNoLrn) {
      if (
        data.learnerType !== "NEW_ENROLLEE" &&
        data.learnerType !== "TRANSFEREE"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hasNoLrn"],
          message:
            "Only incoming Grade 7 and transferee learners can submit without an LRN.",
        });
      }

      if (lrn.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lrn"],
          message: "Clear the LRN field when 'hasNoLrn' is selected.",
        });
      }
    } else if (!lrn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lrn"],
        message:
          "LRN is required unless you declare that the learner has no LRN.",
      });
    }

    if (
      data.learnerType === "TRANSFEREE" &&
      (!data.originSchoolName || data.originSchoolName.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["originSchoolName"],
        message: "Origin school name is required for transferees.",
      });
    }

    if (data.learnerType === "ALS") {
      if (
        !data.peptCertificateNumber ||
        data.peptCertificateNumber.length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["peptCertificateNumber"],
          message: "PEPT certificate number is required for ALS/PEPT passers.",
        });
      }

      if (!data.peptPassingDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["peptPassingDate"],
          message: "PEPT passing date is required for ALS/PEPT passers.",
        });
      }
    }
  });

export const updateChecklistSchema = z.object({
  isPsaBirthCertPresented: z.boolean().optional(),
  isOriginalPsaBcCollected: z.boolean().optional(),
  isSf9Submitted: z.boolean().optional(),
  isSf10Requested: z.boolean().optional(),
  isGoodMoralPresented: z.boolean().optional(),
  isMedicalEvalSubmitted: z.boolean().optional(),
  isCertOfRecognitionPresented: z.boolean().optional(),
  isUndertakingSigned: z.boolean().optional(),
  isConfirmationSlipReceived: z.boolean().optional(),
  academicStatus: AcademicStatusEnum.optional(),
});

export const requestRevisionSchema = z.object({
  message: z.string().optional(),
});

// ─── Batch Processing Schema ───────────────────────────
const BATCH_TARGET_STATUSES = [
  "SUBMITTED_BEERF",
  "PENDING_BEEF",
  "AWAITING_VERIFICATION",
  "SUBMITTED_BEEF",
  "VERIFIED",
  "UNDER_REVIEW",
  "ELIGIBLE",
  "EXAM_SCHEDULED",
  "ASSESSMENT_TAKEN",
  "PASSED",
  "INTERVIEW_SCHEDULED",
  "READY_FOR_ENROLLMENT",
  "REJECTED",
  "WITHDRAWN",
] as const;

export const batchTargetStatusSchema = z.enum(BATCH_TARGET_STATUSES);

export const batchProcessSchema = z.object({
  ids: z
    .array(z.number().int().positive())
    .min(1, "At least one applicant ID is required")
    .max(500, "Cannot process more than 500 applicants at once"),
  targetStatus: batchTargetStatusSchema,
});



const CHECKLIST_FIELD_KEYS = [
  "isPsaBirthCertPresented",
  "isSecondaryBirthDocPresented",
  "isOriginalPsaBcCollected",
  "isSf9Submitted",
  "isSf10Requested",
  "isGoodMoralPresented",
  "isMedicalEvalSubmitted",
  "isCertOfRecognitionPresented",
  "isUndertakingSigned",
  "isConfirmationSlipReceived",
] as const;

export const checklistFieldKeySchema = z.enum(CHECKLIST_FIELD_KEYS);
export const academicStatusSchema = AcademicStatusEnum;

const checklistUpdateInputSchema = z.object({
  isPsaBirthCertPresented: z.boolean().optional(),
  isSecondaryBirthDocPresented: z.boolean().optional(),
  isOriginalPsaBcCollected: z.boolean().optional(),
  isSf9Submitted: z.boolean().optional(),
  isSf10Requested: z.boolean().optional(),
  isGoodMoralPresented: z.boolean().optional(),
  isMedicalEvalSubmitted: z.boolean().optional(),
  isCertOfRecognitionPresented: z.boolean().optional(),
  isUndertakingSigned: z.boolean().optional(),
  isConfirmationSlipReceived: z.boolean().optional(),
  academicStatus: AcademicStatusEnum.optional(),
});

export const batchVerifyDocumentsPreviewSchema = z.object({
  ids: z
    .array(z.number().int().positive())
    .min(1, "Select at least one applicant")
    .max(500, "Cannot preview more than 500 applicants at once"),
});

export const batchVerifyDocumentsSchema = z.object({
  applicants: z
    .array(
      z.object({
        id: z.number().int().positive(),
        checklist: checklistUpdateInputSchema.default({}),
        academicStatus: academicStatusSchema.optional(),
      }),
    )
    .min(1, "Select at least one applicant")
    .max(500, "Cannot process more than 500 applicants at once"),
  expectedStatuses: z.record(z.string(), z.string().min(1)).optional(),
});

const batchRegularSectionIdsSchema = z
  .array(z.number().int().positive())
  .min(1, "Select at least one applicant")
  .max(500, "Cannot process more than 500 applicants at once");

const batchExpectedStatusesSchema = z
  .record(z.string(), z.string().min(1))
  .optional();

export const batchAssignRegularSectionPreviewSchema = z.object({
  ids: batchRegularSectionIdsSchema,
  expectedStatuses: batchExpectedStatusesSchema,
});

export const batchAssignRegularSectionCommitSchema = z.object({
  ids: batchRegularSectionIdsSchema,
  expectedStatuses: batchExpectedStatusesSchema,
});

export const batchAssignRegularSectionSchema = z.object({
  ids: batchRegularSectionIdsSchema,
  sectionId: z.number().int().positive("Target section is required"),
  expectedStatuses: batchExpectedStatusesSchema,
});


