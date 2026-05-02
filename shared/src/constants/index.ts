import { z } from "zod";

// ─── Enums ──────────────────────────────────────────────
export const RoleEnum = z.enum(["REGISTRAR", "SYSTEM_ADMIN", "TEACHER"]);
export const SexEnum = z.enum(["MALE", "FEMALE"]);

export const ComplianceStatusEnum = z.enum(["PENDING", "COMPLIED", "OVERDUE"]);

export const APPLICATION_STATUS_VALUES = [
  "SUBMITTED_BEERF",
  "SUBMITTED_BEEF",
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
  SUBMITTED_BEERF: "SUBMITTED",
  SUBMITTED_BEEF: "SUBMITTED",
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
  SUBMITTED_BEERF: [
    "VERIFIED",
    "UNDER_REVIEW",
    "EXAM_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  SUBMITTED_BEEF: [
    "VERIFIED",
    "UNDER_REVIEW",
    "EXAM_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  VERIFIED: [
    "UNDER_REVIEW",
    "ELIGIBLE",
    "EXAM_SCHEDULED",
    "READY_FOR_ENROLLMENT",
    "REJECTED",
    "WITHDRAWN",
  ],
  UNDER_REVIEW: [
    "VERIFIED",
    "FOR_REVISION",
    "ELIGIBLE",
    "EXAM_SCHEDULED",
    "TEMPORARILY_ENROLLED",
    "REJECTED",
    "WITHDRAWN",
  ],
  FOR_REVISION: ["UNDER_REVIEW", "WITHDRAWN"],
  ELIGIBLE: ["EXAM_SCHEDULED", "READY_FOR_ENROLLMENT", "WITHDRAWN"],
  EXAM_SCHEDULED: [
    "ASSESSMENT_TAKEN",
    "EXAM_SCHEDULED",
    "INTERVIEW_SCHEDULED",
    "WITHDRAWN",
  ],
  ASSESSMENT_TAKEN: [
    "PASSED",
    "SUBMITTED_BEERF",
    "SUBMITTED_BEEF",
    "FAILED_ASSESSMENT",
    "ASSESSMENT_TAKEN",
    "EXAM_SCHEDULED",
    "WITHDRAWN",
  ],
  PASSED: [
    "READY_FOR_ENROLLMENT",
    "INTERVIEW_SCHEDULED",
    "EXAM_SCHEDULED",
    "WITHDRAWN",
  ],
  INTERVIEW_SCHEDULED: [
    "READY_FOR_ENROLLMENT",
    "SUBMITTED_BEERF",
    "SUBMITTED_BEEF",
    "WITHDRAWN",
  ],
  READY_FOR_ENROLLMENT: [
    "ENROLLED",
    "TEMPORARILY_ENROLLED",
    "REJECTED",
    "WITHDRAWN",
  ],
  TEMPORARILY_ENROLLED: ["ENROLLED", "WITHDRAWN"],
  FAILED_ASSESSMENT: ["UNDER_REVIEW", "WITHDRAWN", "REJECTED"],
  ENROLLED: ["WITHDRAWN"],
  REJECTED: ["UNDER_REVIEW", "WITHDRAWN"],
  WITHDRAWN: [],
};

export const SchoolYearStatusEnum = z.enum([
  "DRAFT",
  "UPCOMING",
  "PREPARATION",
  "ENROLLMENT_OPEN",
  "BOSY_LOCKED",
  "EOSY_PROCESSING",
  "ACTIVE",
  "ARCHIVED",
]);

export const PortalControlEnum = z.enum([
  "AUTO",
  "FORCE_OPEN_PHASE_1",
  "FORCE_OPEN_PHASE_2",
  "FORCE_CLOSE_ALL",
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
  "LATE_ENROLLEE",
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
  "SPECIAL_PROGRAM_IN_JOURNALISM",
  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
  "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
]);
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

// ─── DepEd Teacher Catalog ─────────────────────────────
export const DEPED_TEACHER_DEPARTMENT_VALUES = [
  "LANGUAGES",
  "MATHEMATICS",
  "SCIENCE",
  "SOCIAL STUDIES",
  "MAPEH",
  "VALUES EDUCATION",
  "TLE",
  "GUIDANCE",
  "ADMINISTRATION",
] as const;

export const DEPED_TEACHER_DEPARTMENT_OPTIONS = [
  { value: "LANGUAGES", label: "Languages" },
  { value: "MATHEMATICS", label: "Mathematics" },
  { value: "SCIENCE", label: "Science" },
  { value: "SOCIAL STUDIES", label: "Social Studies / AP" },
  { value: "MAPEH", label: "MAPEH" },
  { value: "VALUES EDUCATION", label: "Values Education / EsP" },
  { value: "TLE", label: "TLE / TVL" },
  { value: "GUIDANCE", label: "Guidance" },
  { value: "ADMINISTRATION", label: "Administration" },
] as const;

export const DEPED_TEACHER_SUBJECT_VALUES = [
  "ENGLISH",
  "FILIPINO",
  "MATHEMATICS",
  "SCIENCE",
  "ARALING PANLIPUNAN",
  "MAPEH",
  "TLE",
  "ESP",
  "VALUES EDUCATION",
  "ICT",
  "EPP",
  "MOTHER TONGUE",
] as const;

export const DEPED_TEACHER_SUBJECT_OPTIONS = [
  { value: "ENGLISH", label: "English" },
  { value: "FILIPINO", label: "Filipino" },
  { value: "MATHEMATICS", label: "Mathematics" },
  { value: "SCIENCE", label: "Science" },
  { value: "ARALING PANLIPUNAN", label: "Araling Panlipunan" },
  { value: "MAPEH", label: "MAPEH" },
  { value: "TLE", label: "TLE" },
  { value: "ESP", label: "ESP" },
  { value: "VALUES EDUCATION", label: "Values Education" },
  { value: "ICT", label: "ICT" },
  { value: "EPP", label: "EPP" },
  { value: "MOTHER TONGUE", label: "Mother Tongue" },
] as const;

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
  "SCHOOL PRINCIPAL I",
  "SCHOOL PRINCIPAL II",
  "SCHOOL PRINCIPAL III",
  "SCHOOL PRINCIPAL IV",
] as const;

export const DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS = [
  { value: "TEACHER I", label: "Teacher I" },
  { value: "TEACHER II", label: "Teacher II" },
  { value: "TEACHER III", label: "Teacher III" },
  { value: "MASTER TEACHER I", label: "Master Teacher I" },
  { value: "MASTER TEACHER II", label: "Master Teacher II" },
  { value: "MASTER TEACHER III", label: "Master Teacher III" },
  { value: "MASTER TEACHER IV", label: "Master Teacher IV" },
  { value: "HEAD TEACHER I", label: "Head Teacher I" },
  { value: "HEAD TEACHER II", label: "Head Teacher II" },
  { value: "HEAD TEACHER III", label: "Head Teacher III" },
  { value: "HEAD TEACHER IV", label: "Head Teacher IV" },
  { value: "SCHOOL PRINCIPAL I", label: "School Principal I" },
  { value: "SCHOOL PRINCIPAL II", label: "School Principal II" },
  { value: "SCHOOL PRINCIPAL III", label: "School Principal III" },
  { value: "SCHOOL PRINCIPAL IV", label: "School Principal IV" },
] as const;

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
      kind: "QUALIFYING_EXAMINATION",
      label: "Qualifying Examination",
      description: "Written exam covering general knowledge and aptitude",
      isRequired: true,
    },
    {
      stepOrder: 2,
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
      kind: "QUALIFYING_EXAMINATION",
      label: "Qualifying Examination",
      description: "Written exam covering general knowledge and aptitude",
      isRequired: true,
    },
    {
      stepOrder: 2,
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
      label: "Qualifying Examination",
      description:
        "Written exam: English and Filipino proficiency, grammar, basic news writing",
      isRequired: true,
    },
    {
      stepOrder: 2,
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
      kind: "QUALIFYING_EXAMINATION",
      label: "Qualifying Examination",
      description:
        "Written test assessing linguistic aptitude and readiness for foreign language acquisition",
      isRequired: true,
    },
    {
      stepOrder: 2,
      kind: "INTERVIEW",
      label: "Interview",
      description:
        "Validate documents and gauge commitment to the extra hours required",
      isRequired: true,
    },
  ],
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: [
    {
      stepOrder: 1,
      kind: "QUALIFYING_EXAMINATION",
      label: "Qualifying Examination",
      description:
        "Written exam: inclination towards IT, Agriculture, Home Economics, or Industrial Arts",
      isRequired: true,
    },
    {
      stepOrder: 2,
      kind: "INTERVIEW",
      label: "Interview",
      description:
        "Align student interests with specific shop offerings (specializations)",
      isRequired: true,
    },
  ],
};
