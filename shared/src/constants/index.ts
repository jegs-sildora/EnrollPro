import { z } from "zod";

// ─── Enums ──────────────────────────────────────────────
export const RoleEnum = z.enum([
  "SYSTEM_ADMIN",
  "HEAD_REGISTRAR",
  "CLASS_ADVISER",
  "TEACHER",
]);
export type Role = z.infer<typeof RoleEnum>;
export const SexEnum = z.enum(["MALE", "FEMALE"]);

export const ComplianceStatusEnum = z.enum(["PENDING", "COMPLIED", "OVERDUE"]);

export const APPLICATION_STATUS_VALUES = [
  "SUBMITTED_BEERF",
  "PENDING_BEEF",
  "AWAITING_VERIFICATION",
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
  PENDING_BEEF: "IN_REVIEW",
  AWAITING_VERIFICATION: "IN_REVIEW",
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
    "PENDING_BEEF",
    "VERIFIED",
    "SUBMITTED_BEEF",
    "UNDER_REVIEW",
    "EXAM_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  PENDING_BEEF: ["AWAITING_VERIFICATION", "REJECTED", "WITHDRAWN"],
  AWAITING_VERIFICATION: [
    "VERIFIED",
    "READY_FOR_ENROLLMENT",
    "TEMPORARILY_ENROLLED",
    "REJECTED",
    "WITHDRAWN",
  ],
  SUBMITTED_BEEF: [
    "VERIFIED",
    "SUBMITTED_BEERF",
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
    "PENDING_BEEF",
    "READY_FOR_ENROLLMENT",
    "INTERVIEW_SCHEDULED",
    "EXAM_SCHEDULED",
    "WITHDRAWN",
  ],
  INTERVIEW_SCHEDULED: [
    "PENDING_BEEF",
    "READY_FOR_ENROLLMENT",
    "SUBMITTED_BEERF",
    "SUBMITTED_BEEF",
    "WITHDRAWN",
  ],
  READY_FOR_ENROLLMENT: [
    "SUBMITTED_BEEF",
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

export const LearnerStatusEnum = z.enum([
  "ACTIVE",
  "JHS_COMPLETER",
  "DROPPED",
  "TRANSFERRED_OUT",
]);
export type LearnerStatus = z.infer<typeof LearnerStatusEnum>;

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
  "MATH",
  "SCI",
  "ENG",
  "FIL",
  "AP",
  "ESP",
  "MAPEH",
  "TLE",
] as const;

export const DEPED_TEACHER_DEPARTMENT_OPTIONS = [
  { value: "MATH", label: "Mathematics" },
  { value: "SCI", label: "Science" },
  { value: "ENG", label: "English" },
  { value: "FIL", label: "Filipino" },
  { value: "AP", label: "Araling Panlipunan" },
  { value: "ESP", label: "Edukasyon sa Pagpapakatao" },
  { value: "MAPEH", label: "MAPEH" },
  { value: "TLE", label: "Technology and Livelihood Education" },
] as const;

export const DEPED_TEACHER_SUBJECT_VALUES = [
  // BEC Core
  "ENGLISH",
  "FILIPINO",
  "MATHEMATICS",
  "SCIENCE",
  "ARALING PANLIPUNAN",
  "MAPEH",
  "VALUES EDUCATION",
  "TLE",
  "HOME ECONOMICS",
  "INDUSTRIAL ARTS",
  "AGRI_FISHERY ARTS",
  "ICT",
  // STE
  "ENVIRONMENTAL SCIENCE",
  "RESEARCH I",
  "BASIC STATISTICS",
  "RESEARCH II",
  "ADVANCED STATISTICS",
  "BIOTECHNOLOGY",
  "RESEARCH III",
  "ADVANCED PHYSICS",
  "ADVANCED CHEMISTRY",
  "ELECTRONICS",
  // SPA
  "MUSIC",
  "VISUAL ARTS",
  "THEATER ARTS",
  "MEDIA ARTS",
  "CREATIVE WRITING",
  "DANCE",
  // SPS
  "INDIVIDUAL / DUAL SPORTS",
  "TEAM SPORTS",
  "SPORTS OFFICIATING",
  "SPORTS COACHING",
  // SPJ
  "BASICS OF JOURNALISM",
  "PRINT BROADCASTING & PHOTOJOURNALISM",
  "RADIO BROADCASTING",
  "TV BROADCASTING & ONLINE JOURNALISM",
  // SPFL
  "SPANISH",
  "JAPANESE",
  "FRENCH",
  "GERMAN",
  "MANDARIN",
  "KOREAN",
] as const;

export const DEPED_TEACHER_SUBJECT_GROUPS = [
  {
    group: "Basic Education Curriculum (BEC)",
    options: [
      { value: "ENGLISH", label: "English" },
      { value: "FILIPINO", label: "Filipino" },
      { value: "MATHEMATICS", label: "Mathematics" },
      { value: "SCIENCE", label: "Science" },
      { value: "ARALING PANLIPUNAN", label: "Araling Panlipunan (AP)" },
      { value: "MAPEH", label: "MAPEH" },
      { value: "VALUES EDUCATION", label: "Values Education / EsP" },
      { value: "TLE", label: "Technology and Livelihood Education (TLE)" },
      { value: "HOME ECONOMICS", label: "Home Economics (HE)" },
      { value: "INDUSTRIAL ARTS", label: "Industrial Arts (IA)" },
      { value: "AGRI_FISHERY ARTS", label: "Agri-Fishery Arts (AFA)" },
      {
        value: "ICT",
        label: "Information and Communications Technology (ICT)",
      },
    ],
  },
  {
    group: "Science, Technology, and Engineering (STE)",
    options: [
      { value: "ENVIRONMENTAL SCIENCE", label: "Environmental Science" },
      { value: "RESEARCH I", label: "Research I / Basic Statistics" },
      { value: "BASIC STATISTICS", label: "Basic Statistics" },
      { value: "RESEARCH II", label: "Research II / Advanced Statistics" },
      { value: "ADVANCED STATISTICS", label: "Advanced Statistics" },
      { value: "BIOTECHNOLOGY", label: "Biotechnology" },
      { value: "RESEARCH III", label: "Research III / Advanced Physics" },
      { value: "ADVANCED PHYSICS", label: "Advanced Physics" },
      { value: "ADVANCED CHEMISTRY", label: "Advanced Chemistry" },
      { value: "ELECTRONICS", label: "Electronics" },
    ],
  },
  {
    group: "Special Program in the Arts (SPA)",
    options: [
      { value: "MUSIC", label: "Music (Vocal / Instrumental)" },
      { value: "VISUAL ARTS", label: "Visual Arts" },
      { value: "THEATER ARTS", label: "Theater Arts" },
      { value: "MEDIA ARTS", label: "Media Arts" },
      {
        value: "CREATIVE WRITING",
        label: "Creative Writing (English / Filipino)",
      },
      { value: "DANCE", label: "Dance" },
    ],
  },
  {
    group: "Special Program in Sports (SPS)",
    options: [
      { value: "INDIVIDUAL / DUAL SPORTS", label: "Individual / Dual Sports" },
      { value: "TEAM SPORTS", label: "Team Sports" },
      { value: "SPORTS OFFICIATING", label: "Sports Officiating" },
      { value: "SPORTS COACHING", label: "Sports Coaching & Leadership" },
    ],
  },
  {
    group: "Special Program in Journalism (SPJ)",
    options: [
      { value: "BASICS OF JOURNALISM", label: "Basics of Journalism" },
      {
        value: "PRINT BROADCASTING & PHOTOJOURNALISM",
        label: "Print Broadcasting & Photojournalism",
      },
      { value: "RADIO BROADCASTING", label: "Radio Broadcasting" },
      {
        value: "TV BROADCASTING & ONLINE JOURNALISM",
        label: "TV Broadcasting & Online Journalism",
      },
    ],
  },
  {
    group: "Special Program in Foreign Language (SPFL)",
    options: [
      { value: "SPANISH", label: "Spanish" },
      { value: "JAPANESE", label: "Japanese (Nihongo)" },
      { value: "FRENCH", label: "French" },
      { value: "GERMAN", label: "German" },
      { value: "MANDARIN", label: "Mandarin" },
      { value: "KOREAN", label: "Korean" },
    ],
  },
];

export const DEPED_TEACHER_SUBJECT_OPTIONS =
  DEPED_TEACHER_SUBJECT_GROUPS.flatMap((g) => g.options);

export const DEPED_TEACHER_SPECIALIZATION_VALUES = [
  "MAJOR IN ENGLISH / APPLIED LINGUISTICS",
  "MAJOR IN FILIPINO",
  "MAJOR IN MATHEMATICS",
  "MAJOR IN GENERAL SCIENCE / BIOLOGY / CHEMISTRY / PHYSICS",
  "MAJOR IN SOCIAL STUDIES / HISTORY",
  "MAJOR IN VALUES EDUCATION",
  "MAJOR IN MAPEH",
  "MAJOR IN HOME ECONOMICS",
  "MAJOR IN INDUSTRIAL ARTS",
  "MAJOR IN AGRI-FISHERY ARTS",
  "MAJOR IN ICT",
  "MAJOR IN PHYSICS",
  "MAJOR IN CHEMISTRY",
  "MAJOR IN BIOLOGY",
  "MAJOR IN MATHEMATICS (WITH STATISTICS BACKGROUND)",
  "MAJOR IN MUSIC EDUCATION",
  "FINE ARTS",
  "THEATER / PERFORMING ARTS",
  "LITERATURE / CREATIVE WRITING",
  "DANCE",
  "MAJOR IN PHYSICAL EDUCATION",
  "SPORTS SCIENCE",
  "CERTIFIED SPECIALIST COACH",
  "MASS COMMUNICATION",
  "JOURNALISM",
  "MAJOR IN ENGLISH (CAMPUS JOURNALISM)",
  "MAJOR IN FILIPINO (CAMPUS JOURNALISM)",
  "LINGUISTICS",
  "DELE CERTIFIED (SPANISH)",
  "JLPT CERTIFIED (JAPANESE)",
  "DELF CERTIFIED (FRENCH)",
  "HSK CERTIFIED (MANDARIN)",
  "TOPIK CERTIFIED (KOREAN)",
] as const;

export const DEPED_TEACHER_SPECIALIZATION_GROUPS = [
  {
    group: "Basic Education Curriculum (BEC)",
    options: [
      {
        value: "MAJOR IN ENGLISH / APPLIED LINGUISTICS",
        label: "Major in English / Applied Linguistics",
      },
      { value: "MAJOR IN FILIPINO", label: "Major in Filipino" },
      { value: "MAJOR IN MATHEMATICS", label: "Major in Mathematics" },
      {
        value: "MAJOR IN GENERAL SCIENCE / BIOLOGY / CHEMISTRY / PHYSICS",
        label: "Major in General Science / Biology / Chemistry / Physics",
      },
      {
        value: "MAJOR IN SOCIAL STUDIES / HISTORY",
        label: "Major in Social Studies / History",
      },
      {
        value: "MAJOR IN VALUES EDUCATION",
        label: "Major in Values Education",
      },
      {
        value: "MAJOR IN MAPEH",
        label:
          "Major in MAPEH (or specific Physical Education / Health degrees)",
      },
      {
        value: "MAJOR IN HOME ECONOMICS",
        label: "Major in Home Economics (HE)",
      },
      {
        value: "MAJOR IN INDUSTRIAL ARTS",
        label: "Major in Industrial Arts (IA)",
      },
      {
        value: "MAJOR IN AGRI-FISHERY ARTS",
        label: "Major in Agri-Fishery Arts (AFA)",
      },
      {
        value: "MAJOR IN ICT",
        label: "Major in Information and Communications Technology (ICT)",
      },
    ],
  },
  {
    group: "Science, Technology, and Engineering (STE)",
    options: [
      { value: "MAJOR IN PHYSICS", label: "Major in Physics" },
      { value: "MAJOR IN CHEMISTRY", label: "Major in Chemistry" },
      { value: "MAJOR IN BIOLOGY", label: "Major in Biology" },
      {
        value: "MAJOR IN MATHEMATICS (WITH STATISTICS BACKGROUND)",
        label: "Major in Mathematics (with Statistics background)",
      },
    ],
  },
  {
    group: "Special Program in the Arts (SPA)",
    options: [
      { value: "MAJOR IN MUSIC EDUCATION", label: "Major in Music Education" },
      { value: "FINE ARTS", label: "Fine Arts" },
      { value: "THEATER / PERFORMING ARTS", label: "Theater/Performing Arts" },
      {
        value: "LITERATURE / CREATIVE WRITING",
        label: "Literature/Creative Writing",
      },
      { value: "DANCE", label: "Dance" },
    ],
  },
  {
    group: "Special Program in Sports (SPS)",
    options: [
      {
        value: "MAJOR IN PHYSICAL EDUCATION",
        label: "Major in Physical Education",
      },
      { value: "SPORTS SCIENCE", label: "Sports Science" },
      {
        value: "CERTIFIED SPECIALIST COACH",
        label: "Certified Specialist Coach",
      },
    ],
  },
  {
    group: "Special Program in Journalism (SPJ)",
    options: [
      { value: "MASS COMMUNICATION", label: "Mass Communication" },
      { value: "JOURNALISM", label: "Journalism" },
      {
        value: "MAJOR IN ENGLISH (CAMPUS JOURNALISM)",
        label: "Major in English (with Campus Journalism background)",
      },
      {
        value: "MAJOR IN FILIPINO (CAMPUS JOURNALISM)",
        label: "Major in Filipino (with Campus Journalism background)",
      },
    ],
  },
  {
    group: "Special Program in Foreign Language (SPFL)",
    options: [
      { value: "LINGUISTICS", label: "Linguistics" },
      { value: "DELE CERTIFIED (SPANISH)", label: "DELE Certified (Spanish)" },
      {
        value: "JLPT CERTIFIED (JAPANESE)",
        label: "JLPT Certified (Japanese)",
      },
      { value: "DELF CERTIFIED (FRENCH)", label: "DELF Certified (French)" },
      { value: "HSK CERTIFIED (MANDARIN)", label: "HSK Certified (Mandarin)" },
      { value: "TOPIK CERTIFIED (KOREAN)", label: "TOPIK Certified (Korean)" },
    ],
  },
];

export const DEPED_TEACHER_SPECIALIZATION_OPTIONS =
  DEPED_TEACHER_SPECIALIZATION_GROUPS.flatMap((g) => g.options);

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

export const DEPED_TEACHER_ACADEMIC_DESIGNATION_OPTIONS = [
  { value: "SUBJECT TEACHER", label: "Subject Teacher" },
  { value: "CLASS ADVISER", label: "Class Adviser" },
  { value: "DEPARTMENT HEAD", label: "Department Head" },
] as const;

export const DEPED_TEACHER_ANCILLARY_ROLE_OPTIONS = [
  {
    value: "TEACHER-IN-CHARGE (TIC) / OFFICER-IN-CHARGE (OIC)",
    label: "Teacher-in-Charge (TIC) / Officer-in-Charge (OIC)",
  },
  { value: "LIS COORDINATOR", label: "LIS Coordinator" },
  { value: "ICT COORDINATOR", label: "ICT Coordinator" },
  { value: "SDRRM COORDINATOR", label: "SDRRM Coordinator" },
  { value: "GUIDANCE DESIGNATE", label: "Guidance Designate" },
  { value: "SCHOOL PAPER ADVISER (SPA)", label: "School Paper Adviser (SPA)" },
  { value: "PROPERTY CUSTODIAN", label: "Property Custodian" },
  {
    value: "CLINIC TEACHER / HEALTH COORDINATOR",
    label: "Clinic Teacher / Health Coordinator",
  },
  { value: "SPORTS COORDINATOR", label: "Sports Coordinator" },
  { value: "BSP / GSP COORDINATOR", label: "BSP / GSP Coordinator" },
  {
    value: "GULAYAN SA PAARALAN (GPP) COORDINATOR",
    label: "Gulayan sa Paaralan (GPP) Coordinator",
  },
  { value: "FEEDING COORDINATOR", label: "Feeding Coordinator" },
  {
    value: "SUPREME SECONDARY LEARNER GOVERNMENT (SSLG) ADVISER",
    label: "Supreme Secondary Learner Government (SSLG) Adviser",
  },
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

export const SectioningMethodEnum = z.enum([
  "BATCH_ALGORITHM",
  "INLINE_SLOTTING",
  "MANUAL_REASSIGNMENT",
  "TRANSFER",
]);

// â"€â"€â"€ Types derived from enums â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
export type AssessmentKind = z.infer<typeof AssessmentKindEnum>;
export type ScpType = z.infer<typeof ScpTypeEnum>;
export type ApplicationStatus = z.infer<typeof ApplicationStatusEnum>;
export type DisabilityType = z.infer<typeof DisabilityTypeEnum>;
export type EarlyRegGradeLevel = z.infer<typeof EarlyRegGradeLevelEnum>;
export type EarlyRegistrationStatus = z.infer<
  typeof EarlyRegistrationStatusEnum
>;
export type ReadingProfileLevel = z.infer<typeof ReadingProfileLevelEnum>;
export type SectioningMethod = z.infer<typeof SectioningMethodEnum>;
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
