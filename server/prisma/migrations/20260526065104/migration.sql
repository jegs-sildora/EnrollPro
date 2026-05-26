/*
  Warnings:

  - The values [PENDING_SCP_SCREENING,QUALIFIED_SCP,REGISTERED_BEC,PENDING_READING,PENDING_INTAKE_CONFIRMATION] on the enum `application_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "application_status_new" AS ENUM ('EARLY_REG_SUBMITTED', 'PRE_REGISTERED', 'PENDING_VERIFICATION', 'READY_FOR_SECTIONING', 'OFFICIALLY_ENROLLED', 'SUBMITTED_BEERF', 'PENDING_BEEF', 'AWAITING_VERIFICATION', 'SUBMITTED_BEEF', 'VERIFIED', 'UNDER_REVIEW', 'FOR_REVISION', 'ELIGIBLE', 'EXAM_SCHEDULED', 'ASSESSMENT_TAKEN', 'PASSED', 'INTERVIEW_SCHEDULED', 'READY_FOR_ENROLLMENT', 'PENDING_CONFIRMATION', 'TEMPORARILY_ENROLLED', 'FAILED_ASSESSMENT', 'ENROLLED', 'REJECTED', 'WITHDRAWN', 'TRANSFERRING_OUT', 'TRANSFERRED_OUT', 'DROPPED', 'DROPPED_OUT', 'NO_LONGER_PARTICIPATING', 'FLAGGED_FOR_REGISTRAR');
ALTER TABLE "public"."early_registration_applications" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."enrollment_applications" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "early_registration_applications" ALTER COLUMN "status" TYPE "application_status_new" USING ("status"::text::"application_status_new");
ALTER TABLE "enrollment_applications" ALTER COLUMN "status" TYPE "application_status_new" USING ("status"::text::"application_status_new");
ALTER TYPE "application_status" RENAME TO "application_status_old";
ALTER TYPE "application_status_new" RENAME TO "application_status";
DROP TYPE "public"."application_status_old";
ALTER TABLE "early_registration_applications" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED_BEERF';
ALTER TABLE "enrollment_applications" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED_BEEF';
COMMIT;
