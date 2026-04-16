import { z } from "zod";

// ─── Enums ──────────────────────────────────────────────
export const RoleEnum = z.enum(["REGISTRAR", "SYSTEM_ADMIN", "TEACHER"]);
export const SexEnum = z.enum(["MALE", "FEMALE"]);

export const ComplianceStatusEnum = z.enum(["PENDING", "COMPLIED", "OVERDUE"]);

export const ApplicationStatusEnum = z.enum([
  "SUBMITTED",
  "UNDER_REVIEW",
  "FOR_REVISION",
  "ELIGIBLE",
  "ASSESSMENT_SCHEDULED",
  "ASSESSMENT_TAKEN",
  "PASSED",
  "INTERVIEW_SCHEDULED",
  "PRE_REGISTERED",
  "TEMPORARILY_ENROLLED",
  "NOT_QUALIFIED",
  "ENROLLED",
  "REJECTED",
  "WITHDRAWN",
]);

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
export const GradeLevelEnum = z.enum(["7"]);

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
export type DisabilityType = z.infer<typeof DisabilityTypeEnum>;
export type EarlyRegGradeLevel = z.infer<typeof EarlyRegGradeLevelEnum>;
export type EarlyRegistrationStatus = z.infer<
  typeof EarlyRegistrationStatusEnum
>;

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
