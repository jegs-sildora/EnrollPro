import { z } from "zod";

// ─── Enums ──────────────────────────────────────────────
export const RoleEnum = z.enum(["REGISTRAR", "SYSTEM_ADMIN", "TEACHER"]);
export const SexEnum = z.enum(["MALE", "FEMALE"]);

export const ComplianceStatusEnum = z.enum(["PENDING", "COMPLIED", "OVERDUE"]);

export const APPLICATION_STATUS_VALUES = [
  "EARLY_REG_SUBMITTED",
  "PRE_REGISTERED",
  "PENDING_VERIFICATION",
  "READY_FOR_SECTIONING",
  "OFFICIALLY_ENROLLED",
  "SUBMITTED",
  "VERIFIED",
  "UNDER_REVIEW",
  "FOR_REVISION",
  "ELIGIBLE",
  "EXAM_SCHEDULED",
  "ASSESSMENT_TAKEN",
  "PASSED",
  "INTERVIEW_SCHEDULED",
  "READY_FOR_ENROLLMENT",
  "TEMPORARILY_ENROLLED",
  "FAILED_ASSESSMENT",
  "ENROLLED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export const ApplicationStatusEnum = z.enum(APPLICATION_STATUS_VALUES);

export const ReadingProfileLevelEnum = z.enum([
  "INDEPENDENT",
  "INSTRUCTIONAL",
  "FRUSTRATION",
  "NON_READER",
]);

export const TrackingProgramTypeEnum = z.enum(["REGULAR", "SCP"]);

export const TrackingStatusEnum = z.enum([
  "SUBMITTED",
  "IN_REVIEW",
  "ASSESSMENT_IN_PROGRESS",
  "QUALIFIED_FOR_ENROLLMENT",
  "ENROLLED",
  "NOT_QUALIFIED",
  "REJECTED",
  "WITHDRAWN",
]);

export const TrackingCurrentStepEnum = z.enum([
  "APPLICATION_SUBMITTED",
  "REGISTRAR_REVIEW",
  "ASSESSMENT_PHASE",
  "ENROLLMENT_QUALIFICATION",
  "ENROLLED",
]);

export const APPLICATION_STATUS_TO_TRACKING_STATUS: Record<
  z.infer<typeof ApplicationStatusEnum>,
  z.infer<typeof TrackingStatusEnum>
> = {
  EARLY_REG_SUBMITTED: "SUBMITTED",
  PRE_REGISTERED: "QUALIFIED_FOR_ENROLLMENT",
  PENDING_VERIFICATION: "IN_REVIEW",
  READY_FOR_SECTIONING: "QUALIFIED_FOR_ENROLLMENT",
  OFFICIALLY_ENROLLED: "ENROLLED",
  SUBMITTED: "SUBMITTED",
  VERIFIED: "IN_REVIEW",
  UNDER_REVIEW: "IN_REVIEW",
  FOR_REVISION: "IN_REVIEW",
  ELIGIBLE: "IN_REVIEW",
  EXAM_SCHEDULED: "ASSESSMENT_IN_PROGRESS",
  ASSESSMENT_TAKEN: "ASSESSMENT_IN_PROGRESS",
  PASSED: "QUALIFIED_FOR_ENROLLMENT",
  INTERVIEW_SCHEDULED: "ASSESSMENT_IN_PROGRESS",
  READY_FOR_ENROLLMENT: "QUALIFIED_FOR_ENROLLMENT",
  TEMPORARILY_ENROLLED: "QUALIFIED_FOR_ENROLLMENT",
  FAILED_ASSESSMENT: "NOT_QUALIFIED",
  ENROLLED: "ENROLLED",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
};

export const APPLICATION_VALID_TRANSITIONS: Record<
  z.infer<typeof ApplicationStatusEnum>,
  z.infer<typeof ApplicationStatusEnum>[]
> = {
  EARLY_REG_SUBMITTED: [
    "UNDER_REVIEW",
    "PRE_REGISTERED",
    "PENDING_VERIFICATION",
    "REJECTED",
    "WITHDRAWN",
  ],
  PRE_REGISTERED: [
    "PENDING_VERIFICATION",
    "READY_FOR_SECTIONING",
    "TEMPORARILY_ENROLLED",
    "REJECTED",
    "WITHDRAWN",
  ],
  PENDING_VERIFICATION: [
    "UNDER_REVIEW",
    "READY_FOR_SECTIONING",
    "TEMPORARILY_ENROLLED",
    "REJECTED",
    "WITHDRAWN",
  ],
  READY_FOR_SECTIONING: [
    "OFFICIALLY_ENROLLED",
    "TEMPORARILY_ENROLLED",
    "PENDING_VERIFICATION",
    "REJECTED",
    "WITHDRAWN",
  ],
  OFFICIALLY_ENROLLED: ["READY_FOR_SECTIONING", "WITHDRAWN"],
  SUBMITTED: [
    "VERIFIED",
    "UNDER_REVIEW",
    "EXAM_SCHEDULED",
    "PENDING_VERIFICATION",
    "EARLY_REG_SUBMITTED",
    "REJECTED",
    "WITHDRAWN",
  ],
  VERIFIED: [
    "UNDER_REVIEW",
    "ELIGIBLE",
    "EXAM_SCHEDULED",
    "READY_FOR_ENROLLMENT",
    "PRE_REGISTERED",
    "READY_FOR_SECTIONING",
    "REJECTED",
    "WITHDRAWN",
  ],
  UNDER_REVIEW: [
    "VERIFIED",
    "FOR_REVISION",
    "ELIGIBLE",
    "EXAM_SCHEDULED",
    "TEMPORARILY_ENROLLED",
    "PRE_REGISTERED",
    "READY_FOR_SECTIONING",
    "REJECTED",
    "WITHDRAWN",
  ],
  FOR_REVISION: ["UNDER_REVIEW", "WITHDRAWN"],
  ELIGIBLE: [
    "EXAM_SCHEDULED",
    "READY_FOR_ENROLLMENT",
    "PRE_REGISTERED",
    "READY_FOR_SECTIONING",
    "WITHDRAWN",
  ],
  EXAM_SCHEDULED: [
    "ASSESSMENT_TAKEN",
    "EXAM_SCHEDULED",
    "INTERVIEW_SCHEDULED",
    "WITHDRAWN",
  ],
  ASSESSMENT_TAKEN: [
    "PASSED",
    "SUBMITTED",
    "EARLY_REG_SUBMITTED",
    "PENDING_VERIFICATION",
    "FAILED_ASSESSMENT",
    "ASSESSMENT_TAKEN",
    "EXAM_SCHEDULED",
    "WITHDRAWN",
  ],
  PASSED: [
    "READY_FOR_ENROLLMENT",
    "PRE_REGISTERED",
    "READY_FOR_SECTIONING",
    "INTERVIEW_SCHEDULED",
    "EXAM_SCHEDULED",
    "WITHDRAWN",
  ],
  INTERVIEW_SCHEDULED: [
    "READY_FOR_ENROLLMENT",
    "PRE_REGISTERED",
    "READY_FOR_SECTIONING",
    "SUBMITTED",
    "EARLY_REG_SUBMITTED",
    "PENDING_VERIFICATION",
    "WITHDRAWN",
  ],
  READY_FOR_ENROLLMENT: [
    "ENROLLED",
    "OFFICIALLY_ENROLLED",
    "TEMPORARILY_ENROLLED",
    "READY_FOR_SECTIONING",
    "REJECTED",
    "WITHDRAWN",
  ],
  TEMPORARILY_ENROLLED: [
    "ENROLLED",
    "OFFICIALLY_ENROLLED",
    "READY_FOR_SECTIONING",
    "WITHDRAWN",
  ],
  FAILED_ASSESSMENT: [
    "UNDER_REVIEW",
    "EARLY_REG_SUBMITTED",
    "PENDING_VERIFICATION",
    "WITHDRAWN",
    "REJECTED",
  ],
  ENROLLED: ["OFFICIALLY_ENROLLED", "READY_FOR_SECTIONING", "WITHDRAWN"],
  REJECTED: [
    "UNDER_REVIEW",
    "PENDING_VERIFICATION",
    "EARLY_REG_SUBMITTED",
    "WITHDRAWN",
  ],
  WITHDRAWN: [],
};

export const SchoolYearStatusEnum = z.enum([
  "DRAFT",
  "UPCOMING",
  "ACTIVE",
  "ARCHIVED",
]);
export const LearnerTypeEnum = z.enum([
  "NEW_ENROLLEE",
  "TRANSFEREE",
  "RETURNING",
  "CONTINUING",
  "OSCYA",
  "ALS",
]);
export const ApplicantTypeEnum = z.enum([
  "REGULAR",
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
  "SPECIAL_PROGRAM_IN_JOURNALISM",
  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
  "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
]);
export const EmailTriggerEnum = z.enum([
  "APPLICATION_SUBMITTED",
  "APPLICATION_APPROVED",
  "APPLICATION_REJECTED",
  "EXAM_SCHEDULED",
  "ASSESSMENT_PASSED",
  "ASSESSMENT_FAILED",
]);
export const EmailStatusEnum = z.enum(["PENDING", "SENT", "FAILED"]);
export const AdmissionChannelEnum = z.enum(["ONLINE", "F2F"]);
export const DocumentStatusEnum = z.enum([
  "SUBMITTED",
  "VERIFIED",
  "REJECTED",
  "MISSING",
]);
export const DocumentTypeEnum = z.enum([
  "PSA_BIRTH_CERTIFICATE",
  "SECONDARY_BIRTH_PROOF",
  "SF9_REPORT_CARD",
  "SF10_PERMANENT_RECORD",
  "GOOD_MORAL_CERTIFICATE",
  "MEDICAL_CERTIFICATE",
  "MEDICAL_EVALUATION",
  "PSA_MARRIAGE_CERTIFICATE",
  "PEPT_AE_CERTIFICATE",
  "PWD_ID",
  "UNDERTAKING",
  "AFFIDAVIT_OF_UNDERTAKING",
  "CONFIRMATION_SLIP",
  "WRITING_PORTFOLIO",
  "OTHERS",
]);
export const AssessmentPeriodEnum = z.enum(["BOSY", "EOSY"]);
export const AddressTypeEnum = z.enum(["CURRENT", "PERMANENT"]);
export const FamilyRelationshipEnum = z.enum(["MOTHER", "FATHER", "GUARDIAN"]);
export const AssessmentKindEnum = z.enum([
  "INTERVIEW",
  "QUALIFYING_EXAMINATION",
  "PRELIMINARY_EXAMINATION",
  "FINAL_EXAMINATION",
  "GENERAL_ADMISSION_TEST",
  "TALENT_AUDITION",
  "PHYSICAL_FITNESS_TEST",
  "SPORTS_SKILLS_TRYOUT",
  "SKILLS_ASSESSMENT",
  "STANDARDIZED_ADMISSION_TOOL",
  "APTITUDE_TEST",
  "INTEREST_INVENTORY",
]);
export const ScpOptionTypeEnum = z.enum(["ART_FIELD", "LANGUAGE", "SPORT"]);
export const LastSchoolTypeEnum = z.enum([
  "PUBLIC",
  "PRIVATE",
  "INTERNATIONAL",
  "ALS",
]);
export const GradeLevelEnum = z.enum(["7", "8", "9", "10"]);

// ─── Teacher Reference Catalogs ─────────────────────────
export const DEPED_TEACHER_SUBJECT_VALUES = [
  "ENGLISH",
  "FILIPINO",
  "MATHEMATICS",
  "SCIENCE",
  "ARALING PANLIPUNAN",
  "ESP",
  "VALUES EDUCATION",
  "MAPEH",
  "TLE",
  "ICT",
  "FOREIGN LANGUAGE",
  "JOURNALISM",
  "ARTS",
  "SPORTS",
] as const;

export type DepedTeacherSubject = (typeof DEPED_TEACHER_SUBJECT_VALUES)[number];

export const DEPED_TEACHER_SUBJECT_OPTIONS: ReadonlyArray<{
  value: DepedTeacherSubject;
  label: string;
}> = [
  { value: "ENGLISH", label: "English" },
  { value: "FILIPINO", label: "Filipino" },
  { value: "MATHEMATICS", label: "Mathematics" },
  { value: "SCIENCE", label: "Science" },
  { value: "ARALING PANLIPUNAN", label: "Araling Panlipunan" },
  { value: "ESP", label: "Edukasyon sa Pagpapakatao (ESP)" },
  { value: "VALUES EDUCATION", label: "Values Education" },
  { value: "MAPEH", label: "MAPEH" },
  { value: "TLE", label: "Technology and Livelihood Education (TLE)" },
  { value: "ICT", label: "Information and Communications Technology (ICT)" },
  { value: "FOREIGN LANGUAGE", label: "Foreign Language" },
  { value: "JOURNALISM", label: "Journalism" },
  { value: "ARTS", label: "Arts" },
  { value: "SPORTS", label: "Sports" },
];

export const DEPED_TEACHER_PLANTILLA_POSITION_VALUES = [
  "TEACHER I",
  "TEACHER II",
  "TEACHER III",
  "MASTER TEACHER I",
  "MASTER TEACHER II",
  "MASTER TEACHER III",
  "MASTER TEACHER IV",
  "HEAD TEACHER I",
  "HEAD TEACHER II",
  "HEAD TEACHER III",
  "HEAD TEACHER IV",
  "HEAD TEACHER V",
  "HEAD TEACHER VI",
] as const;

export type DepedTeacherPlantillaPosition =
  (typeof DEPED_TEACHER_PLANTILLA_POSITION_VALUES)[number];

export const DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS: ReadonlyArray<{
  value: DepedTeacherPlantillaPosition;
  label: string;
}> = DEPED_TEACHER_PLANTILLA_POSITION_VALUES.map((value) => ({
  value,
  label: value,
}));

// ─── DO 017 s.2025 Early Registration Enums ─────────────
export const EarlyRegGradeLevelEnum = z.enum(["7", "8", "9", "10"]);
export const DisabilityTypeEnum = z.enum([
  "VISUAL",
  "HEARING",
  "INTELLECTUAL",
  "LEARNING",
  "PSYCHOSOCIAL",
  "ORTHOPEDIC",
  "SPEECH",
  "AUTISM",
  "CHRONIC_ILLNESS",
  "MULTIPLE",
]);
export const EarlyRegistrationStatusEnum = z.enum([
  "DRAFT",
  "SUBMITTED",
  "VERIFIED",
  "LINKED",
]);

export const ScpTypeEnum = z.enum([
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
  "SPECIAL_PROGRAM_IN_JOURNALISM",
  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
  "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
]);

// ─── Types derived from enums ───────────────────────────
export type AssessmentKind = z.infer<typeof AssessmentKindEnum>;
export type ScpType = z.infer<typeof ScpTypeEnum>;
export type ApplicationStatus = z.infer<typeof ApplicationStatusEnum>;
export type DisabilityType = z.infer<typeof DisabilityTypeEnum>;
export type EarlyRegGradeLevel = z.infer<typeof EarlyRegGradeLevelEnum>;
export type EarlyRegistrationStatus = z.infer<
  typeof EarlyRegistrationStatusEnum
>;
export type ReadingProfileLevel = z.infer<typeof ReadingProfileLevelEnum>;
export type TrackingProgramType = z.infer<typeof TrackingProgramTypeEnum>;
export type TrackingStatus = z.infer<typeof TrackingStatusEnum>;
export type TrackingCurrentStep = z.infer<typeof TrackingCurrentStepEnum>;

// ─── Assessment Kind Labels ─────────────────────────────
export const ASSESSMENT_KIND_LABELS: Record<AssessmentKind, string> = {
  INTERVIEW: "Interview",
  QUALIFYING_EXAMINATION: "Qualifying Examination",
  PRELIMINARY_EXAMINATION: "Preliminary Examination",
  FINAL_EXAMINATION: "Final Examination",
  GENERAL_ADMISSION_TEST: "General Admission Test",
  TALENT_AUDITION: "Talent Audition / Performance",
  PHYSICAL_FITNESS_TEST: "Physical Fitness Test (PFT)",
  SPORTS_SKILLS_TRYOUT: "Sports Skills Demonstration",
  SKILLS_ASSESSMENT: "Skills Assessment",
  STANDARDIZED_ADMISSION_TOOL: "Standardized Admission Tool",
  APTITUDE_TEST: "Aptitude Test",
  INTEREST_INVENTORY: "Interest Inventory / Interview",
};

// ─── Default DepEd SCP Assessment Pipelines ─────────────
export interface ScpProgramStepDef {
  stepOrder: number;
  kind: AssessmentKind;
  label: string;
  description: string;
  isRequired: boolean;
}

// ─── STE Pipeline Variants ──────────────────────────────
export const STE_ONE_PHASE_PIPELINE: ScpProgramStepDef[] = [
  {
    stepOrder: 1,
    kind: "QUALIFYING_EXAMINATION",
    label: "Qualifying Examination",
    description:
      "Single comprehensive written exam: English, Science, Mathematics, critical thinking, and problem-solving",
    isRequired: true,
  },
  {
    stepOrder: 2,
    kind: "INTERVIEW",
    label: "Interview",
    description:
      "Face-to-face or virtual interview: interest, mental alertness, readiness for rigorous curriculum",
    isRequired: true,
  },
];

export const STE_TWO_PHASE_PIPELINE: ScpProgramStepDef[] = [
  {
    stepOrder: 1,
    kind: "PRELIMINARY_EXAMINATION",
    label: "Preliminary Examination (ESM)",
    description:
      "Written screening test: English, Science, Mathematics — determines eligibility for final exam",
    isRequired: true,
  },
  {
    stepOrder: 2,
    kind: "FINAL_EXAMINATION",
    label: "Final Examination",
    description:
      "Comprehensive written exam: 21st-century skills, critical thinking, and advanced problem-solving",
    isRequired: true,
  },
  {
    stepOrder: 3,
    kind: "INTERVIEW",
    label: "Interview",
    description:
      "Face-to-face or virtual interview: interest, mental alertness, readiness for rigorous curriculum",
    isRequired: true,
  },
];

/** Return the correct STE pipeline based on the two-phase toggle. */
export function getSteSteps(isTwoPhase: boolean): ScpProgramStepDef[] {
  return isTwoPhase ? STE_TWO_PHASE_PIPELINE : STE_ONE_PHASE_PIPELINE;
}

export const SCP_DEFAULT_PIPELINES: Record<ScpType, ScpProgramStepDef[]> = {
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: STE_ONE_PHASE_PIPELINE,
  SPECIAL_PROGRAM_IN_THE_ARTS: [
    {
      stepOrder: 1,
      kind: "GENERAL_ADMISSION_TEST",
      label: "General Admission Test",
      description: "Written exam covering general knowledge and aptitude",
      isRequired: true,
    },
    {
      stepOrder: 2,
      kind: "TALENT_AUDITION",
      label: "Talent Audition / Performance",
      description:
        "Live performance, on-the-spot drawing/portfolio, creative writing task, or audition per chosen art field",
      isRequired: true,
    },
    {
      stepOrder: 3,
      kind: "INTERVIEW",
      label: "Interview",
      description:
        "Assess passion for the arts and commitment to the 4-year program",
      isRequired: true,
    },
  ],
  SPECIAL_PROGRAM_IN_SPORTS: [
    {
      stepOrder: 1,
      kind: "PHYSICAL_FITNESS_TEST",
      label: "Physical Fitness Test (PFT)",
      description:
        "Battery of tests measuring agility, strength, and endurance",
      isRequired: true,
    },
    {
      stepOrder: 2,
      kind: "SPORTS_SKILLS_TRYOUT",
      label: "Sports Skills Demonstration (Tryout)",
      description:
        "Demonstrate proficiency in specific sport (e.g. Basketball, Swimming, Athletics)",
      isRequired: true,
    },
    {
      stepOrder: 3,
      kind: "INTERVIEW",
      label: "Interview",
      description: "Assess discipline, sportsmanship, and parental support",
      isRequired: true,
    },
  ],
  SPECIAL_PROGRAM_IN_JOURNALISM: [
    {
      stepOrder: 1,
      kind: "QUALIFYING_EXAMINATION",
      label: "Qualifying Test",
      description:
        "Written exam: English and Filipino proficiency, grammar, basic news writing",
      isRequired: true,
    },
    {
      stepOrder: 2,
      kind: "SKILLS_ASSESSMENT",
      label: "Skills Assessment (Writing Trials)",
      description:
        "On-the-spot writing: news lead, editorial, or feature story",
      isRequired: true,
    },
    {
      stepOrder: 3,
      kind: "INTERVIEW",
      label: "Interview",
      description:
        "Screening committee: communication skills and ethical awareness",
      isRequired: true,
    },
  ],
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: [
    {
      stepOrder: 1,
      kind: "STANDARDIZED_ADMISSION_TOOL",
      label: "Standardized Admission Tool",
      description:
        "Written test assessing linguistic aptitude and readiness for foreign language acquisition",
      isRequired: true,
    },
    {
      stepOrder: 2,
      kind: "INTERVIEW",
      label: "Interview (with Parent/Guardian)",
      description:
        "Validate documents and gauge commitment to the extra hours required",
      isRequired: true,
    },
  ],
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: [
    {
      stepOrder: 1,
      kind: "APTITUDE_TEST",
      label: "Aptitude Test",
      description:
        "Written exam: inclination towards IT, Agriculture, Home Economics, or Industrial Arts",
      isRequired: true,
    },
    {
      stepOrder: 2,
      kind: "INTEREST_INVENTORY",
      label: "Interest Inventory / Interview",
      description:
        "Align student interests with specific shop offerings (specializations)",
      isRequired: true,
    },
  ],
};
