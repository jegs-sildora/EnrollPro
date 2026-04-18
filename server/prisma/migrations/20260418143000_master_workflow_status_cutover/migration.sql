-- Hard-cutover enum alignment: map legacy status values to canonical workflow names.
ALTER TYPE "application_status" RENAME TO "application_status_old";

CREATE TYPE "application_status" AS ENUM (
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

ALTER TABLE "early_registration_applications"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "application_status"
  USING (
    CASE "status"::text
      WHEN 'ASSESSMENT_SCHEDULED' THEN 'EXAM_SCHEDULED'::"application_status"
      WHEN 'PRE_REGISTERED' THEN 'READY_FOR_ENROLLMENT'::"application_status"
      WHEN 'NOT_QUALIFIED' THEN 'FAILED_ASSESSMENT'::"application_status"
      ELSE "status"::text::"application_status"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

ALTER TABLE "enrollment_applications"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "application_status"
  USING (
    CASE "status"::text
      WHEN 'ASSESSMENT_SCHEDULED' THEN 'EXAM_SCHEDULED'::"application_status"
      WHEN 'PRE_REGISTERED' THEN 'READY_FOR_ENROLLMENT'::"application_status"
      WHEN 'NOT_QUALIFIED' THEN 'FAILED_ASSESSMENT'::"application_status"
      ELSE "status"::text::"application_status"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

DROP TYPE "application_status_old";

-- New policy: failed SCP outcomes are routed back to regular intake queue.
UPDATE "early_registration_applications"
SET
  "status" = 'SUBMITTED',
  "applicant_type" = 'REGULAR'
WHERE "status" = 'FAILED_ASSESSMENT';

UPDATE "enrollment_applications"
SET
  "status" = 'SUBMITTED',
  "applicant_type" = 'REGULAR'
WHERE "status" = 'FAILED_ASSESSMENT';
