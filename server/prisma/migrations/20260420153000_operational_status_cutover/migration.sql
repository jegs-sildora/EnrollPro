-- Rebuild enum safely: Postgres disallows using newly-added enum values in the same transaction.
ALTER TYPE "application_status" RENAME TO "application_status_old";

CREATE TYPE "application_status" AS ENUM (
  'EARLY_REG_SUBMITTED',
  'PRE_REGISTERED',
  'PENDING_VERIFICATION',
  'READY_FOR_SECTIONING',
  'OFFICIALLY_ENROLLED',
  'SUBMITTED',
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

-- Phase 1 records should carry early-registration operational statuses.
ALTER TABLE "early_registration_applications"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "application_status"
  USING (
    CASE "status"::text
      WHEN 'SUBMITTED' THEN 'EARLY_REG_SUBMITTED'
      WHEN 'VERIFIED' THEN 'PRE_REGISTERED'
      WHEN 'READY_FOR_ENROLLMENT' THEN 'PRE_REGISTERED'
      WHEN 'TEMPORARILY_ENROLLED' THEN 'PRE_REGISTERED'
      WHEN 'ENROLLED' THEN 'PRE_REGISTERED'
      ELSE "status"::text
    END
  )::"application_status",
  ALTER COLUMN "status" SET DEFAULT 'EARLY_REG_SUBMITTED';

-- Phase 2 records should carry enrollment operational statuses.
ALTER TABLE "enrollment_applications"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "application_status"
  USING (
    CASE "status"::text
      WHEN 'SUBMITTED' THEN 'PENDING_VERIFICATION'
      WHEN 'VERIFIED' THEN 'READY_FOR_SECTIONING'
      WHEN 'READY_FOR_ENROLLMENT' THEN 'READY_FOR_SECTIONING'
      WHEN 'ENROLLED' THEN 'OFFICIALLY_ENROLLED'
      ELSE "status"::text
    END
  )::"application_status",
  ALTER COLUMN "status" SET DEFAULT 'PENDING_VERIFICATION';

-- Keep learner snapshot status aligned with operational naming.
ALTER TABLE "learners"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "application_status"
  USING (
    CASE "status"::text
      WHEN 'SUBMITTED' THEN 'EARLY_REG_SUBMITTED'
      WHEN 'VERIFIED' THEN 'PRE_REGISTERED'
      WHEN 'READY_FOR_ENROLLMENT' THEN 'READY_FOR_SECTIONING'
      WHEN 'ENROLLED' THEN 'OFFICIALLY_ENROLLED'
      ELSE "status"::text
    END
  )::"application_status",
  ALTER COLUMN "status" SET DEFAULT 'EARLY_REG_SUBMITTED';

DROP TYPE "application_status_old";
