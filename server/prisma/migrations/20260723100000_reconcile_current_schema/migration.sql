-- CreateEnum
CREATE TYPE "system_academic_phase" AS ENUM (
  'PRE_REGISTRATION',
  'BOSY_ENROLLMENT',
  'OFFICIAL_ENROLLMENT',
  'CLASSES_ONGOING',
  'EOSY_CLOSING'
);

-- CreateEnum
CREATE TYPE "SF10Status" AS ENUM ('PENDING', 'REQUESTED', 'RECEIVED');

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'PRE_REGISTERED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'READY_FOR_SECTIONING';
ALTER TYPE "ApplicationStatus" ADD VALUE 'OFFICIALLY_ENROLLED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'SUBMITTED_BEERF';
ALTER TYPE "ApplicationStatus" ADD VALUE 'PENDING_BEEF';
ALTER TYPE "ApplicationStatus" ADD VALUE 'AWAITING_VERIFICATION';
ALTER TYPE "ApplicationStatus" ADD VALUE 'SUBMITTED_BEEF';
ALTER TYPE "ApplicationStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "ApplicationStatus" ADD VALUE 'FOR_REVISION';
ALTER TYPE "ApplicationStatus" ADD VALUE 'ELIGIBLE';
ALTER TYPE "ApplicationStatus" ADD VALUE 'EXAM_SCHEDULED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'ASSESSMENT_TAKEN';
ALTER TYPE "ApplicationStatus" ADD VALUE 'PASSED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'INTERVIEW_SCHEDULED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'READY_FOR_ENROLLMENT';
ALTER TYPE "ApplicationStatus" ADD VALUE 'PENDING_CONFIRMATION';
ALTER TYPE "ApplicationStatus" ADD VALUE 'TEMPORARILY_ENROLLED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'FAILED_ASSESSMENT';
ALTER TYPE "ApplicationStatus" ADD VALUE 'REJECTED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'WITHDRAWN';
ALTER TYPE "ApplicationStatus" ADD VALUE 'TRANSFERRING_OUT';
ALTER TYPE "ApplicationStatus" ADD VALUE 'TRANSFERRED_OUT';
ALTER TYPE "ApplicationStatus" ADD VALUE 'DROPPED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'ARCHIVED_NO_SHOW';

-- AlterEnum
ALTER TYPE "learner_status" ADD VALUE 'INACTIVE';
ALTER TYPE "learner_status" ADD VALUE 'RESTRICTED';

-- Normalize the school-year status enum to the current lifecycle model.
BEGIN;
CREATE TYPE "school_year_status_new" AS ENUM ('ACTIVE', 'ARCHIVED');
ALTER TABLE "school_years" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "school_years"
  ALTER COLUMN "status" TYPE "school_year_status_new"
  USING ("status"::text::"school_year_status_new");
ALTER TYPE "school_year_status" RENAME TO "school_year_status_old";
ALTER TYPE "school_year_status_new" RENAME TO "school_year_status";
DROP TYPE "school_year_status_old";
ALTER TABLE "school_years" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- Remove relations and fields retired from the current data model.
ALTER TABLE "application_checklists"
  DROP CONSTRAINT "application_checklists_enrollment_id_fkey";
ALTER TABLE "application_checklists"
  DROP CONSTRAINT "application_checklists_updated_by_id_fkey";
ALTER TABLE "departments"
  DROP CONSTRAINT "departments_head_id_fkey";
DROP INDEX "uq_departments_head_id";

ALTER TABLE "application_family_members"
  DROP COLUMN "occupation",
  ADD COLUMN "extension_name" TEXT;

ALTER TABLE "departments" DROP COLUMN "head_id";

ALTER TABLE "enrollment_applications"
  DROP COLUMN "documentary_deadline_at",
  ADD COLUMN "academic_status" "academic_status" NOT NULL DEFAULT 'PROMOTED',
  ADD COLUMN "assigned_program" "applicant_type",
  ADD COLUMN "duplicate_flag" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "is_late_enrollee" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "is_remedial_required" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "enrollment_previous_schools"
  DROP COLUMN "grade_completed",
  DROP COLUMN "school_deped_id",
  DROP COLUMN "school_year_attended";

ALTER TABLE "enrollment_records"
  ADD COLUMN "drop_out_intervention_notes" TEXT,
  ADD COLUMN "is_late_enrollee" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "next_year_curriculum" "applicant_type",
  ADD COLUMN "sf10_status" "SF10Status" NOT NULL DEFAULT 'PENDING';

ALTER TABLE "learners"
  ADD COLUMN "is_conditionally_enrolled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "missing_requirements" TEXT[];

ALTER TABLE "school_settings"
  ADD COLUMN "enable_homogeneous_sections" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "global_default_password" TEXT NOT NULL DEFAULT 'DepEd2026!',
  ADD COLUMN "heterogeneous_round_robin" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "homogeneous_section_count" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "spa_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sps_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ste_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "system_phase" "system_academic_phase" NOT NULL DEFAULT 'OFFICIAL_ENROLLMENT';

ALTER TABLE "school_year_calendar_policies"
  ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "school_years"
  DROP COLUMN "require_reading_assessment_continuing",
  DROP COLUMN "require_reading_assessment_new",
  DROP COLUMN "section_shift_window_days",
  ADD COLUMN "settings_snapshot" JSONB,
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
  ALTER COLUMN "term_format" SET DEFAULT 'TRIMESTER';

ALTER TABLE "teacher_designations"
  DROP COLUMN "is_teaching_exempt",
  DROP COLUMN "is_tic";

ALTER TABLE "teacher_schedule_periods"
  ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "teachers"
  ADD COLUMN "birthdate" DATE,
  ADD COLUMN "functional_assignment" TEXT,
  ADD COLUMN "personnel_type" TEXT,
  ADD COLUMN "suffix" TEXT,
  ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "users"
  DROP COLUMN "role",
  ADD COLUMN "roles" "user_role"[] NOT NULL;

DROP TABLE "application_checklists";

-- CreateTable
CREATE TABLE "sf4_logs" (
  "id" SERIAL NOT NULL,
  "learner_id" INTEGER NOT NULL,
  "movement_type" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sf4_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_applications_learner_id_school_year_id_key"
  ON "enrollment_applications"("learner_id", "school_year_id");

-- AddForeignKey
ALTER TABLE "sf4_logs"
  ADD CONSTRAINT "sf4_logs_learner_id_fkey"
  FOREIGN KEY ("learner_id") REFERENCES "learners"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Align generated index names with the current Prisma schema.
ALTER INDEX "uq_enrollment_history_identifier_sy"
  RENAME TO "enrollment_history_learner_identifier_school_year_id_key";
ALTER INDEX "uq_school_form_artifact_scope_version"
  RENAME TO "school_form_artifacts_school_year_id_scope_key_version_key";
ALTER INDEX "uq_calendar_policy_year_version"
  RENAME TO "school_year_calendar_policies_year_label_version_key";
ALTER INDEX "uq_smart_learning_area_outcome_code"
  RENAME TO "smart_learning_area_results_academic_outcome_id_learning_ar_key";
