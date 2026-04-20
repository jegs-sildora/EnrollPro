import { z } from "zod";
import {
  ApplicantTypeEnum,
  ApplicationStatusEnum,
  ReadingProfileLevelEnum,
  SexEnum,
  GradeLevelEnum,
  ScpTypeEnum,
  LastSchoolTypeEnum,
  LearnerTypeEnum,
  AssessmentKindEnum,
  TrackingCurrentStepEnum,
  TrackingProgramTypeEnum,
  TrackingStatusEnum,
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
  generalAverage: z.number().optional().nullable(),
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

    earlyRegistrationId: z.number().int().positive().optional().nullable(),

    gradeLevel: GradeLevelEnum,
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
    generalAverage: z.number().optional().nullable(),

    artField: z.string().optional().nullable(),
    sportsList: z.array(z.string()).default([]),
    foreignLanguage: z.string().optional().nullable(),

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

    if (data.isScpApplication && !data.scpType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scpType"],
        message: "Select an SCP track to continue.",
      });
    }

    if (data.isScpApplication && !data.earlyRegistrationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["earlyRegistrationId"],
        message:
          "SCP applicants must complete Early Registration and run LRN lookup before final enrollment.",
      });
    }
  });

export const assessmentTrackerStepSchema = z.object({
  stepOrder: z.number().int().min(1),
  kind: z.string(),
  label: z.string(),
  status: z.enum(["PENDING", "SCHEDULED", "COMPLETED"]),
  scheduledDate: z.string().nullable(),
  scheduledTime: z.string().nullable(),
  venue: z.string().nullable(),
  result: z.string().nullable(),
  score: z.number().nullable(),
  notes: z.string().nullable(),
  conductedAt: z.string().nullable(),
});

export const trackingAssessmentDataSchema = z
  .object({
    phaseStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]),
    latestSchedule: z
      .object({
        stepOrder: z.number().int().min(1),
        label: z.string(),
        kind: z.string(),
        scheduledDate: z.string().nullable(),
        scheduledTime: z.string().nullable(),
        venue: z.string().nullable(),
      })
      .nullable(),
    steps: z.array(assessmentTrackerStepSchema),
  })
  .nullable();

export const applicationTrackingStateSchema = z.object({
  programType: TrackingProgramTypeEnum,
  status: TrackingStatusEnum,
  rawStatus: ApplicationStatusEnum,
  currentStep: TrackingCurrentStepEnum,
  assessmentData: trackingAssessmentDataSchema,
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
    learnerType: z.enum(["NEW_ENROLLEE", "TRANSFEREE", "RETURNING", "ALS"]),
    applicantType: ApplicantTypeEnum.default("REGULAR"),
    gradeLevelId: z.number().int().positive("Grade level is required"),
    academicStatus: z.enum(["PROMOTED", "RETAINED"]).default("PROMOTED"),
    originSchoolName: z.string().trim().optional().nullable(),
    peptCertificateNumber: z.string().trim().optional().nullable(),
    peptPassingDate: z.string().or(z.date()).optional().nullable(),
  })
  .superRefine((data, ctx) => {
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

export const scheduleExamSchema = z.object({
  examDate: z.string().or(z.date()),
  examTime: z.string().optional().nullable(),
  assessmentType: z.string().optional(),
});

export const recordResultSchema = z.object({
  // Written exam
  examScore: z.number().optional().nullable(),
  examResult: z.string().optional().nullable(),
  examNotes: z.string().optional().nullable(),
  // Interview
  interviewResult: z.string().optional().nullable(),
  interviewDate: z.string().or(z.date()).optional().nullable(),
  interviewNotes: z.string().optional().nullable(),
  // Audition/Tryout
  auditionResult: z.string().optional().nullable(),
  tryoutResult: z.string().optional().nullable(),
  // Grades
  natScore: z.number().optional().nullable(),
});

export const rescheduleExamSchema = z.object({
  examDate: z.string().or(z.date()),
});

// ─── Pipeline-Aware Assessment Schemas ──────────────────
export const scheduleAssessmentStepSchema = z.object({
  stepOrder: z.number().int().min(1),
  kind: AssessmentKindEnum,
  scheduledDate: z.string().or(z.date()),
  scheduledTime: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const recordStepResultSchema = z.object({
  stepOrder: z.number().int().min(1),
  kind: AssessmentKindEnum,
  score: z.number().optional().nullable(),
  result: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const rescheduleAssessmentStepSchema = z.object({
  stepOrder: z.number().int().min(1),
  kind: AssessmentKindEnum,
  scheduledDate: z.string().or(z.date()),
  scheduledTime: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
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
  academicStatus: z.enum(["PROMOTED", "RETAINED"]).optional(),
});

export const requestRevisionSchema = z.object({
  message: z.string().optional(),
});

// Legacy interview schemas — kept for backward compatibility
export const scheduleInterviewSchema = z.object({
  interviewDate: z.string().or(z.date()),
  interviewTime: z.string().optional().nullable(),
  interviewVenue: z.string().optional().nullable(),
  interviewNotes: z.string().optional().nullable(),
});

export const recordInterviewResultSchema = z.object({
  interviewScore: z.number().optional().nullable(),
  interviewResult: z.string().optional().nullable(),
  interviewNotes: z.string().optional().nullable(),
});

// ─── Metadata-Driven SCP Rule Schemas ─────────────────
export const scpGradeSubjectEnum = z.enum([
  "ENGLISH",
  "SCIENCE",
  "MATHEMATICS",
  "FILIPINO",
  "GENERAL_AVERAGE",
]);

export const scpGradeRuleTypeEnum = z.enum([
  "GENERAL_AVERAGE_MIN",
  "SUBJECT_AVERAGE_MIN",
  "SUBJECT_MINIMUMS",
]);

export const scpSubjectThresholdSchema = z.object({
  subject: scpGradeSubjectEnum,
  min: z.number().min(0).max(100),
});

export const scpGradeRequirementSchema = z
  .object({
    ruleType: scpGradeRuleTypeEnum,
    minAverage: z.number().min(0).max(100).optional().nullable(),
    subjects: z.array(scpGradeSubjectEnum).optional().default([]),
    subjectThresholds: z
      .array(scpSubjectThresholdSchema)
      .optional()
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (data.ruleType === "GENERAL_AVERAGE_MIN" && data.minAverage == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minAverage is required for GENERAL_AVERAGE_MIN",
        path: ["minAverage"],
      });
    }

    if (data.ruleType === "SUBJECT_AVERAGE_MIN") {
      if (data.minAverage == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "minAverage is required for SUBJECT_AVERAGE_MIN",
          path: ["minAverage"],
        });
      }
      if (data.subjects.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "subjects are required for SUBJECT_AVERAGE_MIN",
          path: ["subjects"],
        });
      }
    }

    if (
      data.ruleType === "SUBJECT_MINIMUMS" &&
      data.subjectThresholds.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "subjectThresholds are required for SUBJECT_MINIMUMS",
        path: ["subjectThresholds"],
      });
    }
  });

export const scpRankingComponentSchema = z.object({
  key: z.enum(["EXAM", "INTERVIEW", "GRADE", "AUDITION", "TRYOUT", "OTHER"]),
  label: z.string().min(1),
  weight: z.number().gt(0).max(100),
});

export const scpRankingFormulaSchema = z
  .object({
    components: z.array(scpRankingComponentSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const total = data.components.reduce((sum, item) => sum + item.weight, 0);
    const isFractional = total <= 1.0001;
    const expected = isFractional ? 1 : 100;
    if (Math.abs(total - expected) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Ranking component weights must total either 1.0 (fractional) or 100 (percentage)",
        path: ["components"],
      });
    }
  });

// ─── SCP Assessment Step Config Schema (for CurriculumTab) ───
export const scpProgramStepConfigSchema = z.object({
  id: z.number().optional(),
  stepOrder: z.number().int().min(1),
  kind: AssessmentKindEnum,
  label: z.string().min(1),
  description: z.string().optional().nullable(),
  isRequired: z.boolean().default(true),
  scheduledDate: z.string().or(z.date()).optional().nullable(),
  scheduledTime: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  cutoffScore: z.number().min(0).max(100).optional().nullable(),
});

export const scpProgramConfigUpdateSchema = z.object({
  id: z.number().optional(),
  scpType: ScpTypeEnum,
  isOffered: z.boolean().default(false),
  isTwoPhase: z.boolean().optional().default(false),
  maxSlots: z.number().int().positive().optional().nullable(),
  cutoffScore: z.number().min(0).max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
  gradeRequirements: z.array(scpGradeRequirementSchema).optional().nullable(),
  rankingFormula: scpRankingFormulaSchema.optional().nullable(),
  artFields: z.array(z.string()).optional().default([]),
  languages: z.array(z.string()).optional().default([]),
  sportsList: z.array(z.string()).optional().default([]),
  steps: z.array(scpProgramStepConfigSchema).optional().default([]),
});

export const updateScpProgramConfigsSchema = z.object({
  scpProgramConfigs: z.array(scpProgramConfigUpdateSchema),
});

// ─── Batch Processing Schema ───────────────────────────
const BATCH_TARGET_STATUSES = [
  "EARLY_REG_SUBMITTED",
  "PRE_REGISTERED",
  "PENDING_VERIFICATION",
  "READY_FOR_SECTIONING",
  "OFFICIALLY_ENROLLED",
  "SUBMITTED",
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
  "isOriginalPsaBcCollected",
  "isSf9Submitted",
  "isSf10Requested",
  "isGoodMoralPresented",
  "isMedicalEvalSubmitted",
  "isCertOfRecognitionPresented",
  "isUndertakingSigned",
  "isConfirmationSlipReceived",
] as const;

const ACADEMIC_STATUS_VALUES = ["PROMOTED", "RETAINED"] as const;

export const checklistFieldKeySchema = z.enum(CHECKLIST_FIELD_KEYS);
export const academicStatusSchema = z.enum(ACADEMIC_STATUS_VALUES);

const checklistUpdateInputSchema = z.object({
  isPsaBirthCertPresented: z.boolean().optional(),
  isOriginalPsaBcCollected: z.boolean().optional(),
  isSf9Submitted: z.boolean().optional(),
  isSf10Requested: z.boolean().optional(),
  isGoodMoralPresented: z.boolean().optional(),
  isMedicalEvalSubmitted: z.boolean().optional(),
  isCertOfRecognitionPresented: z.boolean().optional(),
  isUndertakingSigned: z.boolean().optional(),
  isConfirmationSlipReceived: z.boolean().optional(),
  academicStatus: academicStatusSchema.optional(),
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

export const batchAssignRegularSectionSchema = z.object({
  ids: z
    .array(z.number().int().positive())
    .min(1, "Select at least one applicant")
    .max(500, "Cannot process more than 500 applicants at once"),
  sectionId: z.number().int().positive("Target section is required"),
  expectedStatuses: z.record(z.string(), z.string().min(1)).optional(),
});

export const batchScheduleStepSchema = z.object({
  ids: z
    .array(z.number().int().positive())
    .min(1, "Select at least one applicant")
    .max(500, "Cannot process more than 500 applicants at once"),
  expectedStatuses: z.record(z.string(), z.string().min(1)).optional(),
  mode: z.enum(["EXAM", "INTERVIEW"]),
  scheduledDate: z.string().or(z.date()),
  scheduledTime: z.string().min(1, "Scheduled time is required"),
  venue: z.string().min(1, "Venue is required"),
  notes: z.string().optional().nullable(),
  sendEmail: z.boolean().default(true),
});

export const batchSaveScoresSchema = z.object({
  rows: z
    .array(
      z.object({
        id: z.number().int().positive(),
        componentScores: z
          .record(z.string(), z.number().min(0).max(100))
          .default({}),
        totalScore: z.number().min(0).max(100).optional(),
        absentNoShow: z.boolean().optional().default(false),
        remarks: z.string().max(500).optional().nullable(),
      }),
    )
    .min(1, "At least one score row is required")
    .max(500, "Cannot process more than 500 applicants at once"),
  expectedStatuses: z.record(z.string(), z.string().min(1)).optional(),
});

export const batchFinalizeInterviewSchema = z.object({
  rows: z
    .array(
      z
        .object({
          id: z.number().int().positive(),
          decision: z.enum(["PASS", "REJECT"]),
          interviewScore: z.number().min(0).max(100).optional().nullable(),
          remarks: z.string().max(500).optional().nullable(),
          rejectOutcome: z
            .enum(["EARLY_REG_SUBMITTED", "PENDING_VERIFICATION", "REJECTED"])
            .optional(),
        })
        .superRefine((value, ctx) => {
          if (value.decision === "REJECT" && !value.rejectOutcome) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "rejectOutcome is required when decision is REJECT",
              path: ["rejectOutcome"],
            });
          }
        }),
    )
    .min(1, "At least one interview result is required")
    .max(500, "Cannot process more than 500 applicants at once"),
  expectedStatuses: z.record(z.string(), z.string().min(1)).optional(),
});
