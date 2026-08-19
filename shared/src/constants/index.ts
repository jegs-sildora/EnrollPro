import { z } from "zod";

// ─── Enums ──────────────────────────────────────────────
export const RoleEnum = z.enum([
  "SYSTEM_ADMIN",
  "HEAD_REGISTRAR",
  "CLASS_ADVISER",
  "TEACHER",
  "LEARNER",
  "MRF",
]);
export type Role = z.infer<typeof RoleEnum>;
export const SexEnum = z.enum(["MALE", "FEMALE"]);

export const ComplianceStatusEnum = z.enum(["PENDING", "COMPLIED", "OVERDUE"]);

export const APPLICATION_STATUS_VALUES = [
  "PENDING_VERIFICATION",
  "READY_FOR_SECTIONING",
  "OFFICIALLY_ENROLLED",
  "FOR_REVISION",
  "PENDING_CONFIRMATION",
  "REJECTED",
  "WITHDRAWN",
  "TRANSFERRING_OUT",
  "TRANSFERRED_OUT",
  "DROPPED",
  "ARCHIVED_NO_SHOW",
  "REMEDIAL_HOLD",
  "REMEDIAL_RESOLVED",
] as const;

export const ApplicationStatusEnum = z.enum(APPLICATION_STATUS_VALUES);

export const TrackingProgramTypeEnum = z.enum(["REGULAR", "SCP"]);

export const TrackingStatusEnum = z.enum([
  "IN_REVIEW",
  "QUALIFIED_FOR_ENROLLMENT",
  "ENROLLED",
  "REJECTED",
  "WITHDRAWN",
  "TRANSFERRED",
  "DROPPED",
]);

export const TrackingCurrentStepEnum = z.enum([
  "REGISTRAR_REVIEW",
  "ENROLLMENT_QUALIFICATION",
  "ENROLLED",
]);

export const REALTIME_INVALIDATION_TOPICS = [
  "school-years:list",
  "enrollment:pending-verifications",
  "enrollment:applications",
  "bosy:queue",
  "bosy:readiness",
  "students:list",
  "students:detail",
  "teachers:list",
  "teachers:detail",
  "teacher:advisory",
  "homerooms:sections",
  "homerooms:teachers",
  "homerooms:adviser-candidates",
  "sectioning:sections",
  "sectioning:pool",
  "eosy:sections",
  "eosy:records",
  "audit-logs:list",
  "integration:hub",
  "system:health",
  "dashboard:summary",
  "settings:public",
] as const;

export type RealtimeInvalidationTopic =
  (typeof REALTIME_INVALIDATION_TOPICS)[number];

export interface RealtimeInvalidationEvent {
  type: "invalidate";
  topics: RealtimeInvalidationTopic[];
  schoolYearId?: number | null;
  teacherIds?: number[];
  sectionIds?: number[];
  learnerIds?: number[];
  smartRevision?: string | null;
  smartEventAt?: string | null;
  sourceSchoolYearId?: number | null;
  rolloverAt?: string | null;
  eventRevision?: string | null;
  emittedAt: string;
}

export const APPLICATION_STATUS_TO_TRACKING_STATUS: Record<
  z.infer<typeof ApplicationStatusEnum>,
  z.infer<typeof TrackingStatusEnum>
> = {
  PENDING_VERIFICATION: "IN_REVIEW",
  READY_FOR_SECTIONING: "QUALIFIED_FOR_ENROLLMENT",
  OFFICIALLY_ENROLLED: "ENROLLED",
  FOR_REVISION: "IN_REVIEW",
  PENDING_CONFIRMATION: "QUALIFIED_FOR_ENROLLMENT",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
  TRANSFERRING_OUT: "TRANSFERRED",
  TRANSFERRED_OUT: "TRANSFERRED",
  DROPPED: "DROPPED",
  ARCHIVED_NO_SHOW: "WITHDRAWN",
  REMEDIAL_HOLD: "IN_REVIEW",
  REMEDIAL_RESOLVED: "QUALIFIED_FOR_ENROLLMENT",
};

export const APPLICATION_VALID_TRANSITIONS: Record<
  z.infer<typeof ApplicationStatusEnum>,
  z.infer<typeof ApplicationStatusEnum>[]
> = {
  PENDING_VERIFICATION: ["READY_FOR_SECTIONING", "REJECTED", "WITHDRAWN"],
  READY_FOR_SECTIONING: ["OFFICIALLY_ENROLLED", "FOR_REVISION", "WITHDRAWN"],
  OFFICIALLY_ENROLLED: ["TRANSFERRING_OUT", "DROPPED", "WITHDRAWN"],
  FOR_REVISION: ["PENDING_VERIFICATION", "READY_FOR_SECTIONING", "WITHDRAWN"],
  PENDING_CONFIRMATION: [
    "READY_FOR_SECTIONING",
    "TRANSFERRING_OUT",
    "WITHDRAWN",
  ],
  REJECTED: ["PENDING_VERIFICATION", "WITHDRAWN"],
  WITHDRAWN: [],
  TRANSFERRING_OUT: ["TRANSFERRED_OUT", "WITHDRAWN"],
  TRANSFERRED_OUT: [],
  DROPPED: [],
  ARCHIVED_NO_SHOW: [],
  REMEDIAL_HOLD: ["REMEDIAL_RESOLVED", "PENDING_CONFIRMATION"],
  REMEDIAL_RESOLVED: ["PENDING_CONFIRMATION"],
};

export const TermFormatEnum = z.enum(["TRIMESTER", "QUARTERS"]);
export type TermFormat = z.infer<typeof TermFormatEnum>;

export const SchoolYearStatusEnum = z.enum([
  "ACTIVE",
  "ARCHIVED",
]);

export const LearnerStatusEnum = z.enum([
  "ACTIVE",
  "INACTIVE",
  "RESTRICTED",
  "JHS_COMPLETER",
  "DROPPED",
  "TRANSFERRED_OUT",
]);
export type LearnerStatus = z.infer<typeof LearnerStatusEnum>;

export const AcademicStatusEnum = z.enum([
  "PROMOTED",
  "RETAINED",
  "CONDITIONALLY_PROMOTED",
]);
export type AcademicStatus = z.infer<typeof AcademicStatusEnum>;

export const EosyStatusEnum = z.enum([
  "PROMOTED",
  "RETAINED",
  "CONDITIONALLY_PROMOTED",
  "TRANSFERRED_OUT",
  "DROPPED_OUT",
]);
export type EosyStatus = z.infer<typeof EosyStatusEnum>;

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
export type LearnerType = z.infer<typeof LearnerTypeEnum>;
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
export type ApplicantType = z.infer<typeof ApplicantTypeEnum>;
export const AdmissionChannelEnum = z.enum(["ONLINE", "F2F"]);

export interface ScpGuardrailLearner {
  learnerType: LearnerType;
  isBalikAral: boolean;
  applicantType: ApplicantType;
  assignedProgram: ApplicantType | null;
}

export function getEffectiveProgramType(
  learner: Pick<ScpGuardrailLearner, "applicantType" | "assignedProgram">,
): ApplicantType {
  return learner.assignedProgram ?? learner.applicantType;
}

export function isSpecialCurricularProgramType(
  programType: ApplicantType,
): boolean {
  return programType !== "REGULAR" && programType !== "LATE_ENROLLEE";
}

export function isScpRestrictedAutoDraftLearner(
  learner: ScpGuardrailLearner,
): boolean {
  const effectiveProgram = getEffectiveProgramType(learner);
  return (
    learner.learnerType === "TRANSFEREE" ||
    learner.learnerType === "RETURNING" ||
    learner.isBalikAral ||
    effectiveProgram === "REGULAR"
  );
}

export function getAutoDraftProgramType(
  learner: ScpGuardrailLearner,
): ApplicantType {
  return isScpRestrictedAutoDraftLearner(learner)
    ? "REGULAR"
    : getEffectiveProgramType(learner);
}

export function getAllowedSectionProgramsForPlacement(
  learner: ScpGuardrailLearner,
): ApplicantType[] {
  const effectiveProgram = getEffectiveProgramType(learner);
  if (!isScpRestrictedAutoDraftLearner(learner)) {
    return [effectiveProgram];
  }

  return Array.from(
    new Set<ApplicantType>(["REGULAR", effectiveProgram]),
  );
}
export const AssessmentPeriodEnum = z.enum(["BOSY", "EOSY"]);
export const AddressTypeEnum = z.enum(["CURRENT", "PERMANENT"]);
export const FamilyRelationshipEnum = z.enum(["MOTHER", "FATHER", "GUARDIAN"]);
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
  { value: "ESP", label: "ESP" },
  { value: "MAPEH", label: "MAPEH" },
  { value: "TLE", label: "TLE" },
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
  "BSED ENGLISH",
  "BSED FILIPINO",
  "BSED MATHEMATICS",
  "BSED SCIENCE",
  "BSED SOCIAL STUDIES",
  "BSED VALUES EDUCATION",
  "BSED MAPEH",
  "BSED TLE",
  "BTVTED / TVL",
  "BEED GENERAL EDUCATION",
  "MAJOR IN ENGLISH / APPLIED LINGUISTICS",
  "MAJOR IN FILIPINO",
  "MAJOR IN MATHEMATICS",
  "MAJOR IN GENERAL SCIENCE / BIOLOGY / CHEMISTRY / PHYSICS",
  "MAJOR IN SOCIAL STUDIES / HISTORY",
  "MAJOR IN ARALING PANLIPUNAN",
  "MAJOR IN VALUES EDUCATION",
  "MAJOR IN EDUKASYON SA PAGPAPAKATAO",
  "MAJOR IN MAPEH",
  "MAJOR IN HEALTH EDUCATION",
  "MAJOR IN HOME ECONOMICS",
  "MAJOR IN INDUSTRIAL ARTS",
  "MAJOR IN AGRI-FISHERY ARTS",
  "MAJOR IN ICT",
  "MAJOR IN ELECTRICAL INSTALLATION AND MAINTENANCE",
  "MAJOR IN COOKERY / FOOD AND BEVERAGE SERVICES",
  "MAJOR IN DRESSMAKING / GARMENTS",
  "MAJOR IN AUTOMOTIVE",
  "MAJOR IN DRAFTING TECHNOLOGY",
  "MAJOR IN COMPUTER SYSTEMS SERVICING",
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
      { value: "BSED ENGLISH", label: "BSEd Major in English" },
      { value: "BSED FILIPINO", label: "BSEd Major in Filipino" },
      { value: "BSED MATHEMATICS", label: "BSEd Major in Mathematics" },
      { value: "BSED SCIENCE", label: "BSEd Major in Science" },
      {
        value: "BSED SOCIAL STUDIES",
        label: "BSEd Major in Social Studies",
      },
      {
        value: "BSED VALUES EDUCATION",
        label: "BSEd Major in Values Education / EsP",
      },
      { value: "BSED MAPEH", label: "BSEd Major in MAPEH" },
      { value: "BSED TLE", label: "BSEd Major in TLE" },
      { value: "BTVTED / TVL", label: "BTVTEd / TVL" },
      { value: "BEED GENERAL EDUCATION", label: "BEEd General Education" },
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
        value: "MAJOR IN ARALING PANLIPUNAN",
        label: "Major in Araling Panlipunan",
      },
      {
        value: "MAJOR IN VALUES EDUCATION",
        label: "Major in Values Education",
      },
      {
        value: "MAJOR IN EDUKASYON SA PAGPAPAKATAO",
        label: "Major in Edukasyon sa Pagpapakatao",
      },
      {
        value: "MAJOR IN MAPEH",
        label:
          "Major in MAPEH (or specific Physical Education / Health degrees)",
      },
      {
        value: "MAJOR IN HEALTH EDUCATION",
        label: "Major in Health Education",
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
      {
        value: "MAJOR IN ELECTRICAL INSTALLATION AND MAINTENANCE",
        label: "Major in Electrical Installation and Maintenance",
      },
      {
        value: "MAJOR IN COOKERY / FOOD AND BEVERAGE SERVICES",
        label: "Major in Cookery / Food and Beverage Services",
      },
      {
        value: "MAJOR IN DRESSMAKING / GARMENTS",
        label: "Major in Dressmaking / Garments",
      },
      { value: "MAJOR IN AUTOMOTIVE", label: "Major in Automotive" },
      {
        value: "MAJOR IN DRAFTING TECHNOLOGY",
        label: "Major in Drafting Technology",
      },
      {
        value: "MAJOR IN COMPUTER SYSTEMS SERVICING",
        label: "Major in Computer Systems Servicing",
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
  "TEACHER IV",
  "TEACHER V",
  "TEACHER VI",
  "TEACHER VII",
  "MASTER TEACHER I",
  "MASTER TEACHER II",
  "MASTER TEACHER III",
  "MASTER TEACHER IV",
  "MASTER TEACHER V",
  "HEAD TEACHER I",
  "HEAD TEACHER II",
  "HEAD TEACHER III",
  "HEAD TEACHER IV",
  "HEAD TEACHER V",
  "HEAD TEACHER VI",
  "ASSISTANT PRINCIPAL I",
  "ASSISTANT PRINCIPAL II",
  "ASSISTANT PRINCIPAL III",
  "PRINCIPAL I",
  "PRINCIPAL II",
  "PRINCIPAL III",
  "PRINCIPAL IV",
  "TEACHER IN CHARGE",
  "OFFICER IN CHARGE",
  "ADMINISTRATIVE AIDE I UTILITY WORKER I",
  "ADMINISTRATIVE AIDE III UTILITY WORKER II",
  "ADMINISTRATIVE OFFICER II",
  "ADMINISTRATIVE ASSISTANT II PROPERTY CUSTODIAN",
  "LGU CONTRACTUAL UTILITY WORKER",
  "LOCAL SCHOOL BOARD CONTRACTUAL",
] as const;

export const DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS = [
  { value: "TEACHER I", label: "Teacher I" },
  { value: "TEACHER II", label: "Teacher II" },
  { value: "TEACHER III", label: "Teacher III" },
  { value: "TEACHER IV", label: "Teacher IV" },
  { value: "TEACHER V", label: "Teacher V" },
  { value: "TEACHER VI", label: "Teacher VI" },
  { value: "TEACHER VII", label: "Teacher VII" },
  { value: "MASTER TEACHER I", label: "Master Teacher I" },
  { value: "MASTER TEACHER II", label: "Master Teacher II" },
  { value: "MASTER TEACHER III", label: "Master Teacher III" },
  { value: "MASTER TEACHER IV", label: "Master Teacher IV" },
  { value: "MASTER TEACHER V", label: "Master Teacher V" },
  { value: "HEAD TEACHER I", label: "Head Teacher I" },
  { value: "HEAD TEACHER II", label: "Head Teacher II" },
  { value: "HEAD TEACHER III", label: "Head Teacher III" },
  { value: "HEAD TEACHER IV", label: "Head Teacher IV" },
  { value: "HEAD TEACHER V", label: "Head Teacher V" },
  { value: "HEAD TEACHER VI", label: "Head Teacher VI" },
  { value: "ASSISTANT PRINCIPAL I", label: "Assistant Principal I" },
  { value: "ASSISTANT PRINCIPAL II", label: "Assistant Principal II" },
  { value: "ASSISTANT PRINCIPAL III", label: "Assistant Principal III" },
  { value: "PRINCIPAL I", label: "Principal I" },
  { value: "PRINCIPAL II", label: "Principal II" },
  { value: "PRINCIPAL III", label: "Principal III" },
  { value: "PRINCIPAL IV", label: "Principal IV" },
  { value: "TEACHER IN CHARGE", label: "Teacher In Charge" },
  { value: "OFFICER IN CHARGE", label: "Officer In Charge" },
  { value: "ADMINISTRATIVE AIDE I UTILITY WORKER I", label: "Administrative Aide I Utility Worker I" },
  { value: "ADMINISTRATIVE AIDE III UTILITY WORKER II", label: "Administrative Aide III Utility Worker II" },
  { value: "ADMINISTRATIVE OFFICER II", label: "Administrative Officer II" },
  { value: "ADMINISTRATIVE ASSISTANT II PROPERTY CUSTODIAN", label: "Administrative Assistant II Property Custodian" },
  { value: "LGU CONTRACTUAL UTILITY WORKER", label: "LGU Contractual Utility Worker" },
  { value: "LOCAL SCHOOL BOARD CONTRACTUAL", label: "Local School Board Contractual" },
] as const;

export const ADMIN_STAFF_POOL = [
  "ADMINISTRATIVE OFFICER II",
  "ADMINISTRATIVE ASSISTANT II",
  "ADMINISTRATIVE ASSISTANT III",
  "REGISTRAR I",
] as const;
export const TEACHING_POOL = [
  "TEACHER I",
  "TEACHER II",
  "TEACHER III",
  "TEACHER IV",
  "TEACHER V",
  "TEACHER VI",
  "TEACHER VII",
  "MASTER TEACHER I",
  "MASTER TEACHER II",
  "MASTER TEACHER III",
  "MASTER TEACHER IV",
  "MASTER TEACHER V",
  "SPECIAL SCIENCE TEACHER I",
  "HEAD TEACHER I",
  "HEAD TEACHER II",
  "HEAD TEACHER III",
  "HEAD TEACHER IV",
  "HEAD TEACHER V",
  "HEAD TEACHER VI",
  "TEACHER IN CHARGE",
] as const;
export const EXECUTIVE_POOL = [
  "ASSISTANT PRINCIPAL I",
  "ASSISTANT PRINCIPAL II",
  "ASSISTANT PRINCIPAL III",
  "PRINCIPAL I",
  "PRINCIPAL II",
  "PRINCIPAL III",
  "PRINCIPAL IV",
  "HEAD TEACHER III",
  "HEAD TEACHER IV",
  "HEAD TEACHER V",
  "HEAD TEACHER VI",
  "OFFICER IN CHARGE",
] as const;
export const MRF_POOL = [
  "ADMINISTRATIVE AIDE I UTILITY WORKER I",
  "ADMINISTRATIVE AIDE III UTILITY WORKER II",
  "ADMINISTRATIVE OFFICER II",
  "ADMINISTRATIVE ASSISTANT II PROPERTY CUSTODIAN",
  "LGU CONTRACTUAL UTILITY WORKER",
  "LOCAL SCHOOL BOARD CONTRACTUAL"
] as const;

export function getDesignationPool(roles: string[]): string[] {
  const pool = new Set<string>();
  if (roles.includes("SYSTEM_ADMIN")) {
    EXECUTIVE_POOL.forEach((r) => pool.add(r));
  }
  if (roles.includes("HEAD_REGISTRAR")) {
    ADMIN_STAFF_POOL.forEach((r) => pool.add(r));
  }
  if (roles.includes("TEACHER") || roles.includes("CLASS_ADVISER")) {
    TEACHING_POOL.forEach((r) => pool.add(r));
  }
  if (roles.includes("MRF")) {
    MRF_POOL.forEach((r) => pool.add(r));
  }
  return Array.from(pool).sort((a, b) => a.localeCompare(b));
}

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

export const TEACHER_NATURE_OF_APPOINTMENT_VALUES = [
  "REGULAR_PERMANENT",
  "PROVISIONAL",
  "SUBSTITUTE",
  "CONTRACTUAL",
  "VOLUNTEER",
  "LOCAL_SCHOOL_BOARD",
  "OTHER",
] as const;

export const TEACHER_NATURE_OF_APPOINTMENT_OPTIONS = [
  { value: "REGULAR_PERMANENT", label: "Regular / Permanent" },
  { value: "PROVISIONAL", label: "Provisional" },
  { value: "SUBSTITUTE", label: "Substitute" },
  { value: "CONTRACTUAL", label: "Contractual" },
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "LOCAL_SCHOOL_BOARD", label: "Local School Board" },
  { value: "OTHER", label: "Other Appointment" },
] as const;

export const TEACHER_FUNDING_SOURCE_VALUES = [
  "NATIONAL",
  "SPECIAL_EDUCATION_FUND",
  "LOCAL_SCHOOL_BOARD",
  "PTA",
  "NGO",
  "OTHER",
] as const;

export const TEACHER_FUNDING_SOURCE_OPTIONS = [
  { value: "NATIONAL", label: "National" },
  { value: "SPECIAL_EDUCATION_FUND", label: "Special Education Fund (SEF)" },
  { value: "LOCAL_SCHOOL_BOARD", label: "Local School Board" },
  { value: "PTA", label: "PTA" },
  { value: "NGO", label: "NGO" },
  { value: "OTHER", label: "Other Fund Source" },
] as const;

export const TEACHER_SCHEDULE_DAY_VALUES = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
] as const;

export const TEACHER_SCHEDULE_DAY_OPTIONS = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
] as const;

export const TEACHER_UNDERGRADUATE_DEGREE_VALUES = [
  "BACHELOR OF SECONDARY EDUCATION",
  "BACHELOR OF ELEMENTARY EDUCATION",
  "BACHELOR OF ARTS",
  "BACHELOR OF SCIENCE",
] as const;

export const TEACHER_UNDERGRADUATE_DEGREE_OPTIONS = [
  { value: "BACHELOR OF SECONDARY EDUCATION", label: "Bachelor of Secondary Education" },
  { value: "BACHELOR OF ELEMENTARY EDUCATION", label: "Bachelor of Elementary Education" },
  { value: "BACHELOR OF ARTS", label: "Bachelor of Arts" },
  { value: "BACHELOR OF SCIENCE", label: "Bachelor of Science" },
];

export const TEACHER_POSTGRADUATE_DEGREE_VALUES = [
  "",
  "MASTER OF ARTS IN EDUCATION",
  "MASTER OF ARTS IN TEACHING",
  "DOCTOR OF EDUCATION",
  "DOCTOR OF PHILOSOPHY",
] as const;

export const TEACHER_POSTGRADUATE_DEGREE_OPTIONS = [
  { value: "", label: "None" },
  { value: "MASTER OF ARTS IN EDUCATION", label: "Master of Arts in Education" },
  { value: "MASTER OF ARTS IN TEACHING", label: "Master of Arts in Teaching" },
  { value: "DOCTOR OF EDUCATION", label: "Doctor of Education" },
  { value: "DOCTOR OF PHILOSOPHY", label: "Doctor of Philosophy" },
];

export const TEACHER_JHS_SPECIALIZATION_VALUES = [
  "MATHEMATICS",
  "SCIENCE",
  "ENGLISH",
  "FILIPINO",
  "ARALING PANLIPUNAN",
  "MAPEH",
  "TECHNOLOGY AND LIVELIHOOD EDUCATION",
  "EDUKASYON SA PAGPAPAKATAO",
] as const;

export const TEACHER_JHS_SPECIALIZATION_OPTIONS = [
  { value: "MATHEMATICS", label: "Mathematics" },
  { value: "SCIENCE", label: "Science" },
  { value: "ENGLISH", label: "English" },
  { value: "FILIPINO", label: "Filipino" },
  { value: "ARALING PANLIPUNAN", label: "Araling Panlipunan" },
  { value: "MAPEH", label: "MAPEH" },
  { value: "TECHNOLOGY AND LIVELIHOOD EDUCATION", label: "Technology and Livelihood Education" },
  { value: "EDUKASYON SA PAGPAPAKATAO", label: "Edukasyon sa Pagpapakatao" },
];

export const TEACHER_JHS_MINOR_SPECIALIZATION_VALUES = [
  "",
  ...TEACHER_JHS_SPECIALIZATION_VALUES
] as const;

export const TEACHER_JHS_MINOR_SPECIALIZATION_OPTIONS = [
  { value: "", label: "None" },
  ...TEACHER_JHS_SPECIALIZATION_OPTIONS
];

// ─── DO 017 s.2025 Enums ─────────────
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
  "MANUAL_OVERRIDE",
  "MANUAL_REASSIGNMENT",
  "TRANSFER",
]);

// ─── Capacity Defaults ──────────────────────────────────
export const DEFAULT_MAX_CAPACITY_REGULAR = 45;
export const DEFAULT_MAX_CAPACITY_SCP = 35;

// â"€â"€â"€ Types derived from enums â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
export type ScpType = z.infer<typeof ScpTypeEnum>;
export type ApplicationStatus = z.infer<typeof ApplicationStatusEnum>;
export type DisabilityType = z.infer<typeof DisabilityTypeEnum>;
export type SectioningMethod = z.infer<typeof SectioningMethodEnum>;
export type TrackingProgramType = z.infer<typeof TrackingProgramTypeEnum>;
export type TrackingStatus = z.infer<typeof TrackingStatusEnum>;
export type TrackingCurrentStep = z.infer<typeof TrackingCurrentStepEnum>;



export const IP_COMMUNITY_VALUES = [
  "NOT APPLICABLE",
  "ABAKNON",
  "AETA",
  "AGTA",
  "AGUTAYNON",
  "AKLANON",
  "ALANGAN",
  "ALTA",
  "AMERASIAN",
  "ATI",
  "ATTA",
  "AYTA",
  "BADJAO",
  "BAGOBO",
  "BALANGAO",
  "BALANGINGI",
  "BANGON",
  "BANTOANON",
  "BANWAON",
  "BATAK",
  "BICOLANO",
  "BINUKID",
  "BLAAN",
  "BOHOLANO",
  "BOLINAO",
  "BONTOC",
  "BUHID",
  "BUTUANON",
  "CALUYANON",
  "CAPIZNON",
  "CAVITENO",
  "CEBUANO",
  "CHINESE FILIPINOS",
  "COTABATENO",
  "CUYONON",
  "DAVAENO",
  "ERMITENO",
  "GADANG",
  "GADDANG",
  "HANUNOO",
  "HIGAONON",
  "IBALOI",
  "IBANAG",
  "IFUGAO",
  "IKALAHAN",
  "ILLANUN",
  "ILOCANO",
  "ILONGGO",
  "ILONGOT",
  "INDIAN FILIPINOS",
  "INONHAN",
  "IRAYA",
  "ISINAI",
  "ISNEG",
  "ITNEG",
  "IVATAN",
  "JAPANESE FILIPINOS",
  "KAGAYANEN",
  "KALAGAN",
  "KALINGA",
  "KAMAYO",
  "KANKANAEY",
  "KAPAMPANGAN",
  "KARAO",
  "KASIGURANIN",
  "KINAMIGUIN",
  "KINARAYA",
  "KOLIBUGAN",
  "KOREAN FILIPINOS",
  "MAGAHAT",
  "MAGUINDANAON",
  "MALAWEG",
  "MAMANWA",
  "MANDAYA",
  "MANGUWANGAN",
  "MANOBO",
  "MANSAKA",
  "MARANAO",
  "MASBATENO",
  "MATIGSALUG",
  "MOLBOG",
  "NEGRENSE",
  "PALAWANO",
  "PANGASINENSE",
  "PARANAN",
  "POROHANON",
  "RATAGNON",
  "ROMBLOMANON",
  "SAMA",
  "SAMBAL",
  "SANGIL",
  "SPANISH FILIPINOS",
  "SUBANUN",
  "SULOD",
  "SURIGAONON",
  "TADYAWAN",
  "TAGABAWA",
  "TAGAKAULO",
  "TAGALOG",
  "TAGBANWA",
  "TALAANDIG",
  "TASADAY",
  "TAUSUG",
  "TAUT BATO",
  "TAWBUID",
  "TBOLI",
  "TERNATENO",
  "TIRURAY",
  "WARAY",
  "YAKAN",
  "YOGAD",
  "ZAMBOANGUENO",
  "OTHERS"
] as const;

export const IP_COMMUNITY_OPTIONS = [
  { value: "NOT APPLICABLE", label: "NOT APPLICABLE" },
  { value: "ABAKNON", label: "Abaknon" },
  { value: "AETA", label: "Aeta" },
  { value: "AGTA", label: "Agta" },
  { value: "AGUTAYNON", label: "Agutaynon" },
  { value: "AKLANON", label: "Aklanon" },
  { value: "ALANGAN", label: "Alangan" },
  { value: "ALTA", label: "Alta" },
  { value: "AMERASIAN", label: "Amerasian" },
  { value: "ATI", label: "Ati" },
  { value: "ATTA", label: "Atta" },
  { value: "AYTA", label: "Ayta" },
  { value: "BADJAO", label: "Badjao" },
  { value: "BAGOBO", label: "Bagobo" },
  { value: "BALANGAO", label: "Balangao" },
  { value: "BALANGINGI", label: "Balangingi" },
  { value: "BANGON", label: "Bangon" },
  { value: "BANTOANON", label: "Bantoanon" },
  { value: "BANWAON", label: "Banwaon" },
  { value: "BATAK", label: "Batak" },
  { value: "BICOLANO", label: "Bicolano" },
  { value: "BINUKID", label: "Binukid" },
  { value: "BLAAN", label: "Blaan" },
  { value: "BOHOLANO", label: "Boholano" },
  { value: "BOLINAO", label: "Bolinao" },
  { value: "BONTOC", label: "Bontoc" },
  { value: "BUHID", label: "Buhid" },
  { value: "BUTUANON", label: "Butuanon" },
  { value: "CALUYANON", label: "Caluyanon" },
  { value: "CAPIZNON", label: "Capiznon" },
  { value: "CAVITENO", label: "Caviteño" },
  { value: "CEBUANO", label: "Cebuano" },
  { value: "CHINESE FILIPINOS", label: "Chinese Filipinos" },
  { value: "COTABATENO", label: "Cotabateño" },
  { value: "CUYONON", label: "Cuyonon" },
  { value: "DAVAENO", label: "Davaoeño" },
  { value: "ERMITENO", label: "Ermiteño" },
  { value: "GADANG", label: "Gadang" },
  { value: "GADDANG", label: "Gaddang" },
  { value: "HANUNOO", label: "Hanunoo" },
  { value: "HIGAONON", label: "Higaonon" },
  { value: "IBALOI", label: "Ibaloi" },
  { value: "IBANAG", label: "Ibanag" },
  { value: "IFUGAO", label: "Ifugao" },
  { value: "IKALAHAN", label: "Ikalahan" },
  { value: "ILLANUN", label: "Illanun" },
  { value: "ILOCANO", label: "Ilocano" },
  { value: "ILONGGO", label: "Ilonggo" },
  { value: "ILONGOT", label: "Ilongot" },
  { value: "INDIAN FILIPINOS", label: "Indian Filipinos" },
  { value: "INONHAN", label: "Inonhan" },
  { value: "IRAYA", label: "Iraya" },
  { value: "ISINAI", label: "Isinai" },
  { value: "ISNEG", label: "Isneg" },
  { value: "ITNEG", label: "Itneg" },
  { value: "IVATAN", label: "Ivatan" },
  { value: "JAPANESE FILIPINOS", label: "Japanese Filipinos" },
  { value: "KAGAYANEN", label: "Kagayanen" },
  { value: "KALAGAN", label: "Kalagan" },
  { value: "KALINGA", label: "Kalinga" },
  { value: "KAMAYO", label: "Kamayo" },
  { value: "KANKANAEY", label: "Kankanaey" },
  { value: "KAPAMPANGAN", label: "Kapampangan" },
  { value: "KARAO", label: "Karao" },
  { value: "KASIGURANIN", label: "Kasiguranin" },
  { value: "KINAMIGUIN", label: "Kinamiguin" },
  { value: "KINARAYA", label: "Kinaraya" },
  { value: "KOLIBUGAN", label: "Kolibugan" },
  { value: "KOREAN FILIPINOS", label: "Korean Filipinos" },
  { value: "MAGAHAT", label: "Magahat" },
  { value: "MAGUINDANAON", label: "Maguindanaon" },
  { value: "MALAWEG", label: "Malaweg" },
  { value: "MAMANWA", label: "Mamanwa" },
  { value: "MANDAYA", label: "Mandaya" },
  { value: "MANGUWANGAN", label: "Manguwangan" },
  { value: "MANOBO", label: "Manobo" },
  { value: "MANSAKA", label: "Mansaka" },
  { value: "MARANAO", label: "Maranao" },
  { value: "MASBATENO", label: "Masbateño" },
  { value: "MATIGSALUG", label: "Matigsalug" },
  { value: "MOLBOG", label: "Molbog" },
  { value: "NEGRENSE", label: "Negrense" },
  { value: "PALAWANO", label: "Palawano" },
  { value: "PANGASINENSE", label: "Pangasinense" },
  { value: "PARANAN", label: "Paranan" },
  { value: "POROHANON", label: "Porohanon" },
  { value: "RATAGNON", label: "Ratagnon" },
  { value: "ROMBLOMANON", label: "Romblomanon" },
  { value: "SAMA", label: "Sama" },
  { value: "SAMBAL", label: "Sambal" },
  { value: "SANGIL", label: "Sangil" },
  { value: "SPANISH FILIPINOS", label: "Spanish Filipinos" },
  { value: "SUBANUN", label: "Subanun" },
  { value: "SULOD", label: "Sulod" },
  { value: "SURIGAONON", label: "Surigaonon" },
  { value: "TADYAWAN", label: "Tadyawan" },
  { value: "TAGABAWA", label: "Tagabawa" },
  { value: "TAGAKAULO", label: "Tagakaulo" },
  { value: "TAGALOG", label: "Tagalog" },
  { value: "TAGBANWA", label: "Tagbanwa" },
  { value: "TALAANDIG", label: "Talaandig" },
  { value: "TASADAY", label: "Tasaday" },
  { value: "TAUSUG", label: "Tausug" },
  { value: "TAUT BATO", label: "Taut Bato" },
  { value: "TAWBUID", label: "Tawbuid" },
  { value: "TBOLI", label: "Tboli" },
  { value: "TERNATENO", label: "Ternateño" },
  { value: "TIRURAY", label: "Tiruray" },
  { value: "WARAY", label: "Waray" },
  { value: "YAKAN", label: "Yakan" },
  { value: "YOGAD", label: "Yogad" },
  { value: "ZAMBOANGUENO", label: "Zamboangueño" },
  { value: "OTHERS", label: "OTHERS" }
];

