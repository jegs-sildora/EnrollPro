import { z } from "zod";

// ─── Enums ──────────────────────────────────────────────
export const RoleEnum = z.enum(["REGISTRAR", "SYSTEM_ADMIN"]);
export const SexEnum = z.enum(["MALE", "FEMALE"]);

export const ApplicationStatusEnum = z.enum([
  "SUBMITTED",
  "UNDER_REVIEW",
  "FOR_REVISION",
  "ELIGIBLE",
  "ASSESSMENT_SCHEDULED",
  "ASSESSMENT_TAKEN",
  "PASSED",
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
  "REGULAR",
  "TRANSFEREE",
  "RETURNING LEARNER",
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
  "STEM_GRADE_11",
]);
export const CurriculumTypeEnum = z.enum(["OLD_STRAND", "ELECTIVE_CLUSTER"]);
export const SHSTrackEnum = z.enum(["ACADEMIC", "TECHPRO"]);
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
  "OTHERS",
]);
export const AssessmentPeriodEnum = z.enum(["BOSY", "EOSY"]);
export const LastSchoolTypeEnum = z.enum([
  "PUBLIC",
  "PRIVATE",
  "INTERNATIONAL",
  "ALS",
]);
export const GradeLevelEnum = z.enum(["7", "11"]);
export const ScpTypeEnum = z.enum([
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
  "SPECIAL_PROGRAM_IN_JOURNALISM",
  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
  "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
]);
