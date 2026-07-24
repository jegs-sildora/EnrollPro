-- Map retired workflow values to current enrollment states before replacing
-- the PostgreSQL enums. EnrollPro has no separate pre-registration workflow.
UPDATE "school_settings"
SET "system_phase" = 'OFFICIAL_ENROLLMENT'
WHERE "system_phase" IN ('PRE_REGISTRATION', 'BOSY_ENROLLMENT');

ALTER TABLE "school_settings"
  ALTER COLUMN "system_phase" DROP DEFAULT;

ALTER TYPE "system_academic_phase"
  RENAME TO "system_academic_phase_old";

CREATE TYPE "system_academic_phase" AS ENUM (
  'OFFICIAL_ENROLLMENT',
  'CLASSES_ONGOING',
  'EOSY_CLOSING'
);

ALTER TABLE "school_settings"
  ALTER COLUMN "system_phase" TYPE "system_academic_phase"
  USING ("system_phase"::text::"system_academic_phase");

ALTER TABLE "school_settings"
  ALTER COLUMN "system_phase" SET DEFAULT 'OFFICIAL_ENROLLMENT';

DROP TYPE "system_academic_phase_old";

UPDATE "enrollment_applications"
SET "status" = CASE
  WHEN "status" IN (
    'PRE_REGISTERED',
    'SUBMITTED_BEERF',
    'PENDING_BEEF',
    'AWAITING_VERIFICATION',
    'SUBMITTED_BEEF',
    'UNDER_REVIEW',
    'EXAM_SCHEDULED',
    'ASSESSMENT_TAKEN',
    'INTERVIEW_SCHEDULED'
  ) THEN 'PENDING_VERIFICATION'::"ApplicationStatus"
  WHEN "status" IN (
    'VERIFIED',
    'ELIGIBLE',
    'PASSED',
    'READY_FOR_ENROLLMENT',
    'TEMPORARILY_ENROLLED'
  ) THEN 'READY_FOR_SECTIONING'::"ApplicationStatus"
  WHEN "status" IN ('ENROLLED', 'SECTIONED')
    THEN 'OFFICIALLY_ENROLLED'::"ApplicationStatus"
  WHEN "status" = 'FAILED_ASSESSMENT'
    THEN 'REJECTED'::"ApplicationStatus"
  ELSE "status"
END
WHERE "status" IN (
  'PRE_REGISTERED',
  'SUBMITTED_BEERF',
  'PENDING_BEEF',
  'AWAITING_VERIFICATION',
  'SUBMITTED_BEEF',
  'VERIFIED',
  'UNDER_REVIEW',
  'ELIGIBLE',
  'EXAM_SCHEDULED',
  'ASSESSMENT_TAKEN',
  'PASSED',
  'INTERVIEW_SCHEDULED',
  'READY_FOR_ENROLLMENT',
  'TEMPORARILY_ENROLLED',
  'FAILED_ASSESSMENT',
  'ENROLLED',
  'SECTIONED'
);

ALTER TABLE "enrollment_applications"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "ApplicationStatus"
  RENAME TO "ApplicationStatus_old";

CREATE TYPE "ApplicationStatus" AS ENUM (
  'PENDING_VERIFICATION',
  'READY_FOR_SECTIONING',
  'OFFICIALLY_ENROLLED',
  'FOR_REVISION',
  'PENDING_CONFIRMATION',
  'REJECTED',
  'WITHDRAWN',
  'TRANSFERRING_OUT',
  'TRANSFERRED_OUT',
  'DROPPED',
  'ARCHIVED_NO_SHOW',
  'REMEDIAL_HOLD',
  'REMEDIAL_RESOLVED'
);

ALTER TABLE "enrollment_applications"
  ALTER COLUMN "status" TYPE "ApplicationStatus"
  USING ("status"::text::"ApplicationStatus");

ALTER TABLE "enrollment_applications"
  ALTER COLUMN "status" SET DEFAULT 'PENDING_VERIFICATION';

DROP TYPE "ApplicationStatus_old";

ALTER TABLE "school_years"
  DROP COLUMN IF EXISTS "bosy_locked_at",
  DROP COLUMN IF EXISTS "bosy_locked_by_id";

DROP TYPE IF EXISTS "assessment_kind";
