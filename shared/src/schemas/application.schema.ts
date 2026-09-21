import { z } from "zod";
import {
  ApplicantTypeEnum,
  ApplicationStatusEnum,
  SexEnum,
  GradeLevelEnum,
  ScpTypeEnum,
  LastSchoolTypeEnum,
  LearnerTypeEnum,
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
  region: z.string().min(1, "Region is required"),
});

export const optionalAddressSchema = z
  .object({
    houseNoStreet: z.string().optional(),
    sitio: z.string().optional(),
    barangay: z.string().optional(),
    cityMunicipality: z.string().optional(),
    province: z.string().optional(),
    region: z.string().optional(),
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

const applicationFamilyMemberSchema = familyMemberSchema.extend({
  lastName: z.string(),
  firstName: z.string(),
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
  lastSchoolId: z.string().regex(/^\d{6}$/, "School ID must be exactly 6 numeric digits").or(z.literal("")).optional().nullable(),
  lastGradeCompleted: z.string().min(1, "Last grade completed is required"),
  schoolYearLastAttended: z
    .string()
    .min(1, "School year last attended is required"),
  lastSchoolAddress: z.string().optional().nullable(),
  transferCertificateNo: z.string().optional().nullable(),
  lastSchoolType: LastSchoolTypeEnum,
  generalAverage: optionalGeneralAverageSchema,
});

// ─── Application Submit ────────────────────────────────
export const applicationSubmitSchema = z
  .object({
    studentPhoto: z.string({
      message: "Learner photo is required.",
    }).min(1, "Learner photo is required."),
    hasNoLrn: z.boolean().default(false),
    lrn: z
      .string()
      .regex(/^\d{12}$/, "LRN must be exactly 12 numeric digits")
      .or(z.literal(""))
      .optional()
      .nullable(),
    psaBirthCertNumber: z.string().trim().toUpperCase().optional().nullable(),

    gradeLevel: GradeLevelEnum,
    isScpApplication: z.boolean().default(false),
    scpType: ScpTypeEnum.optional().nullable(),

    lastName: z.string().min(1, "Last name is required").max(100, "Last name is too long"),
    firstName: z.string().min(1, "First name is required").max(100, "First name is too long"),
    middleName: z.string().optional().nullable(),
    extensionName: z.string().optional().nullable(),
    birthdate: z.string().or(z.date()),
    sex: SexEnum,
    placeOfBirth: z.string().min(1, "Place of birth is required"),
    religion: z.string().optional().nullable(),
    motherTongue: z.string().min(1, "Mother tongue is required"),

    isIpCommunity: z.boolean().default(false),
    ipGroupName: z.string().optional().nullable(),
    is4PsBeneficiary: z.boolean().default(false),
    householdId4Ps: z.string().optional().nullable(),
    intakeHeightCm: z.number().min(30, "Height must be at least 30 cm").max(250, "Height must not exceed 250 cm").optional().nullable(),
    intakeWeightKg: z.number().min(10, "Weight must be at least 10 kg").max(200, "Weight must not exceed 200 kg").optional().nullable(),
    isBalikAral: z.boolean().default(false),
    lastYearEnrolled: z.string().optional().nullable(),
    isLearnerWithDisability: z.boolean().default(false),
    specialNeedsCategory: z.enum(["a1", "a2"]).optional().nullable(),
    hasPwdId: z.boolean().default(false),
    disabilityTypes: z.array(z.string()).default([]),

    currentAddress: addressSchema,
    permanentAddress: optionalAddressSchema,

    mother: applicationFamilyMemberSchema,
    father: applicationFamilyMemberSchema,
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

    // Previous school (now maps to PreviousSchool model)
    lastSchoolName: z.string().min(1, "Last school name is required"),
    lastSchoolId: z.string().regex(/^\d{6}$/, "School ID must be exactly 6 numeric digits").or(z.literal("")).optional().nullable(),
    lastGradeCompleted: z.string().min(1, "Last grade completed is required"),
    schoolYearLastAttended: z
      .string()
      .min(1, "School year last attended is required"),
    lastSchoolAddress: z.string().optional().nullable(),
    transferCertificateNo: z.string().optional().nullable(),
    lastSchoolType: LastSchoolTypeEnum,

    generalAverage: optionalGeneralAverageSchema,

    artField: z.string().optional().nullable(),
    sportsList: z.array(z.string()).default([]),
    foreignLanguage: z.string().optional().nullable(),

    isPrivacyConsentGiven: z.boolean().refine((val) => val === true, {
      message: "Consent is required",
    }),
    learnerType: LearnerTypeEnum,
    learningModalities: z.array(z.string()).default([]),
    bypassDuplicate: z.boolean().optional(),
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

    if (!data.isScpApplication) {
      (["mother", "father"] as const).forEach((relationship) => {
        if (!data[relationship].lastName.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [relationship, "lastName"],
            message: "Last name is required",
          });
        }
        if (!data[relationship].firstName.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [relationship, "firstName"],
            message: "First name is required",
          });
        }
      });
    }
  });

export const applicationTrackingStateSchema = z.object({
  programType: TrackingProgramTypeEnum,

  status: TrackingStatusEnum,
  rawStatus: ApplicationStatusEnum,
  currentStep: TrackingCurrentStepEnum,
});

export const applicationSubmitResponseSchema = z
  .object({
    trackingNumber: z.string().min(1),
    applicantType: ApplicantTypeEnum,
  })
  .merge(applicationTrackingStateSchema);

export const applicationTrackResponseSchema = applicationTrackingStateSchema.partial()
  .merge(
    z.object({
      trackingNumber: z.string().min(1),
      applicantType: ApplicantTypeEnum,
      application_type: z.enum(["ADMISSION", "ENROLLMENT"]),
      current_step: z.number(),
      status: z.enum(["PENDING", "PASSED", "FAILED", "WAITLISTED"]),
      verification_status: z.enum(["PENDING", "PASSED", "FAILED"]).optional(),
      exam_status: z.enum(["PENDING", "PASSED", "FAILED"]).optional(),
      interview_status: z.enum(["PENDING", "PASSED", "FAILED"]).optional(),
      final_result: z.enum(["PENDING", "QUALIFIED", "DISQUALIFIED", "WAITLISTED", "FORFEITED"]).optional(),
    })
  )
  .passthrough();

export const scpAdmissionSubmitSchema = applicationSubmitSchema.safeExtend({
  lrn: z.string().regex(
    /^\d{12}$/,
    "Learner Reference Number must be exactly 12 numeric digits.",
  ).or(z.literal("")).optional().nullable(),
  lastName: z.string().min(1, "Learner's last name is required.").max(100, "Last name is too long"),
  firstName: z.string().min(1, "Learner's first name is required.").max(100, "First name is too long"),
  birthdate: z.string().min(1, "Please provide a valid birthdate.").or(z.date()),
  placeOfBirth: z.string().min(1, "Place of birth as indicated in birth certificate is required."),
  motherTongue: z.string().min(1, "Mother tongue is required."),
  currentAddress: z.object({
    houseNoStreet: z.string().optional(),
    sitio: z.string().optional(),
    region: z.string().min(1, "Current region is required."),
    province: z.string().min(1, "Current province is required."),
    cityMunicipality: z.string().min(1, "Current city/municipality is required."),
    barangay: z.string().min(1, "Current barangay is required."),
  }),
  lastSchoolName: z.string().min(1, "Name of the last school attended is required."),
  lastSchoolId: z.string().optional().nullable(),
  isPrivacyConsentGiven: z.boolean().refine((value) => value === true, {
    message: "Verification and certification of the provided information is required.",
  }),
  grade5GeneralAverage: z
    .number({ message: "Please enter a valid numeric general average." })
    .min(0, "General Average must be between 0 and 100.")
    .max(100, "General Average must be between 0 and 100.")
    .refine((value) => {
      const decimalPart = value.toString().split(".")[1];
      return !decimalPart || decimalPart.length <= 2;
    }, "General Average must not exceed two decimal places."),
  underSpecialScienceCurriculum: z.boolean({
    message: "Please specify if you are under the Special Science Curriculum in Elementary.",
  }).optional().nullable(),
  artsSpecialization: z.enum([
    "CREATIVE_WRITING",
    "MEDIA_AND_VISUAL_ARTS",
    "MUSIC",
    "DANCE",
  ]).optional().nullable(),
  chosenSport: z.string().trim().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.scpType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" && data.underSpecialScienceCurriculum == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["underSpecialScienceCurriculum"],
      message: "Please specify if you are under the Special Science Curriculum in Elementary.",
    });
  }

  if (data.scpType === "SPECIAL_PROGRAM_IN_THE_ARTS" && !data.artsSpecialization) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["artsSpecialization"],
      message: "Arts specialization is required for SPA applicants.",
    });
  }

  if (data.scpType === "SPECIAL_PROGRAM_IN_SPORTS" && !data.chosenSport) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["chosenSport"],
      message: "Chosen sport is required for SPS applicants.",
    });
  }
});

export type ScpAdmissionSubmit = z.infer<typeof scpAdmissionSubmitSchema>;


export const scpAssessmentUpdateSchema = z.object({
  hasWrittenExam: z.boolean(),
  writtenExamScore: z.number().nullable().optional(),
  hasInterview: z.boolean(),
  assessmentResult: z.enum(['PENDING', 'QUALIFIED', 'DISQUALIFIED'])
});

export type ScpAssessmentUpdate = z.infer<typeof scpAssessmentUpdateSchema>;
