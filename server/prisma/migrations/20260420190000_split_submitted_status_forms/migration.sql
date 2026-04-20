-- Split legacy SUBMITTED into two explicit workflow states:
-- - SUBMITTED_BEERF: Basic Education Early Registration Form completed
-- - SUBMITTED_BEEF: Basic Education Enrollment Form completed

CREATE TYPE "application_status_new" AS ENUM (
  'EARLY_REG_SUBMITTED',
  'PRE_REGISTERED',
  'PENDING_VERIFICATION',
  'READY_FOR_SECTIONING',
  'OFFICIALLY_ENROLLED',
  'SUBMITTED_BEERF',
  'SUBMITTED_BEEF',
  'VERIFIED',
  'UNDER_REVIEW',
  'FOR_REVISION',
  'ELIGIBLE',
  'EXAM_SCHEDULED',
  'ASSESSMENT_TAKEN',
  'PASSED',
  'INTERVIEW_SCHEDULED',
  'READY_FOR_ENROLLMENT',
  'TEMPORARILY_ENROLLED',
  'FAILED_ASSESSMENT',
  'ENROLLED',
  'REJECTED',
  'WITHDRAWN'
);

ALTER TABLE "learners"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "early_registration_applications"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "enrollment_applications"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "learners"
  ALTER COLUMN "status" TYPE "application_status_new"
  USING (
    CASE
      WHEN "status"::text = 'SUBMITTED' THEN 'SUBMITTED_BEERF'
      ELSE "status"::text
    END
  )::"application_status_new";

ALTER TABLE "early_registration_applications"
  ALTER COLUMN "status" TYPE "application_status_new"
  USING (
    CASE
      WHEN "status"::text = 'SUBMITTED' THEN 'SUBMITTED_BEERF'
      ELSE "status"::text
    END
  )::"application_status_new";

ALTER TABLE "enrollment_applications"
  ALTER COLUMN "status" TYPE "application_status_new"
  USING (
    CASE
      WHEN "status"::text = 'SUBMITTED' THEN 'SUBMITTED_BEEF'
      WHEN "status"::text = 'EARLY_REG_SUBMITTED' THEN 'SUBMITTED_BEEF'
      ELSE "status"::text
    END
  )::"application_status_new";

DROP TYPE "application_status";

ALTER TYPE "application_status_new" RENAME TO "application_status";

ALTER TABLE "learners"
  ALTER COLUMN "status" SET DEFAULT 'SUBMITTED_BEERF';

ALTER TABLE "early_registration_applications"
  ALTER COLUMN "status" SET DEFAULT 'SUBMITTED_BEERF';

ALTER TABLE "enrollment_applications"
  ALTER COLUMN "status" SET DEFAULT 'SUBMITTED_BEEF';
