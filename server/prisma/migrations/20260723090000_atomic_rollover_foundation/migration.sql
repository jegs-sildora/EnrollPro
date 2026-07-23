CREATE TYPE "calendar_policy_status" AS ENUM (
  'DRAFT',
  'APPROVED',
  'APPLIED'
);

CREATE TYPE "school_form_type" AS ENUM (
  'SF5',
  'SF6'
);

CREATE TYPE "learning_area_result_status" AS ENUM (
  'PASSED',
  'FAILED',
  'INCOMPLETE'
);

CREATE TABLE "school_year_calendar_policies" (
  "id" SERIAL PRIMARY KEY,
  "year_label" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "calendar_policy_status" NOT NULL DEFAULT 'DRAFT',
  "deped_issuance" TEXT NOT NULL,
  "source_url" TEXT,
  "class_opening_date" DATE NOT NULL,
  "class_end_date" DATE NOT NULL,
  "enroll_open_date" DATE,
  "enroll_close_date" DATE,
  "term_format" "term_format" NOT NULL DEFAULT 'TRIMESTER',
  "term1_start" DATE NOT NULL,
  "term1_end" DATE NOT NULL,
  "term2_start" DATE NOT NULL,
  "term2_end" DATE NOT NULL,
  "term3_start" DATE NOT NULL,
  "term3_end" DATE NOT NULL,
  "term4_start" DATE,
  "term4_end" DATE,
  "approved_at" TIMESTAMPTZ(6),
  "approved_by_id" INTEGER,
  "applied_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_year_calendar_policies_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_calendar_policy_year_version"
  ON "school_year_calendar_policies"("year_label", "version");
CREATE INDEX "idx_calendar_policy_year_status"
  ON "school_year_calendar_policies"("year_label", "status");

ALTER TABLE "school_years"
  ADD COLUMN "calendar_policy_id" INTEGER;

CREATE UNIQUE INDEX "uq_school_years_calendar_policy_id"
  ON "school_years"("calendar_policy_id");

ALTER TABLE "school_years"
  ADD CONSTRAINT "school_years_calendar_policy_id_fkey"
  FOREIGN KEY ("calendar_policy_id")
  REFERENCES "school_year_calendar_policies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "smart_academic_outcomes" (
  "id" SERIAL PRIMARY KEY,
  "enrollment_record_id" INTEGER NOT NULL,
  "final_general_average" DOUBLE PRECISION NOT NULL,
  "final_outcome" "academic_status" NOT NULL,
  "smart_revision" TEXT NOT NULL,
  "published_at" TIMESTAMPTZ(6) NOT NULL,
  "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload_hash" VARCHAR(64) NOT NULL,
  CONSTRAINT "smart_academic_outcomes_enrollment_record_id_fkey"
    FOREIGN KEY ("enrollment_record_id") REFERENCES "enrollment_records"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_smart_outcomes_enrollment_record_id"
  ON "smart_academic_outcomes"("enrollment_record_id");

CREATE TABLE "smart_learning_area_results" (
  "id" SERIAL PRIMARY KEY,
  "academic_outcome_id" INTEGER NOT NULL,
  "learning_area_code" TEXT NOT NULL,
  "learning_area_name" TEXT NOT NULL,
  "final_grade" DOUBLE PRECISION NOT NULL,
  "result" "learning_area_result_status" NOT NULL,
  CONSTRAINT "smart_learning_area_results_academic_outcome_id_fkey"
    FOREIGN KEY ("academic_outcome_id") REFERENCES "smart_academic_outcomes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_smart_learning_area_outcome_code"
  ON "smart_learning_area_results"("academic_outcome_id", "learning_area_code");
CREATE INDEX "idx_smart_learning_area_outcome_id"
  ON "smart_learning_area_results"("academic_outcome_id");

ALTER TABLE "enrollment_history"
  ADD COLUMN "learner_identifier" TEXT,
  ADD COLUMN "academic_outcome_snapshot" JSONB;

UPDATE "enrollment_history" history
SET "learner_identifier" = CASE
  WHEN learner."lrn" IS NOT NULL AND BTRIM(learner."lrn") <> ''
    THEN 'LRN:' || BTRIM(learner."lrn")
  ELSE 'LEARNER:' || history."learner_id"::TEXT
END
FROM "learners" learner
WHERE learner."id" = history."learner_id";

WITH ranked_history AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "learner_identifier", "school_year_id"
      ORDER BY "created_at" DESC, "id" DESC
    ) AS row_number
  FROM "enrollment_history"
)
DELETE FROM "enrollment_history" history
USING ranked_history ranked
WHERE history."id" = ranked."id"
  AND ranked.row_number > 1;

ALTER TABLE "enrollment_history"
  ALTER COLUMN "learner_identifier" SET NOT NULL;

CREATE UNIQUE INDEX "uq_enrollment_history_identifier_sy"
  ON "enrollment_history"("learner_identifier", "school_year_id");

CREATE TABLE "school_form_artifacts" (
  "id" SERIAL PRIMARY KEY,
  "school_year_id" INTEGER NOT NULL,
  "section_id" INTEGER,
  "form_type" "school_form_type" NOT NULL,
  "scope_key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "source_hash" VARCHAR(64) NOT NULL,
  "payload" JSONB NOT NULL,
  "payload_hash" VARCHAR(64) NOT NULL,
  "recorded_by_id" INTEGER NOT NULL,
  "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_form_artifacts_school_year_id_fkey"
    FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "school_form_artifacts_section_id_fkey"
    FOREIGN KEY ("section_id") REFERENCES "sections"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "school_form_artifacts_recorded_by_id_fkey"
    FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_school_form_artifact_scope_version"
  ON "school_form_artifacts"("school_year_id", "scope_key", "version");
CREATE INDEX "idx_school_form_artifact_scope"
  ON "school_form_artifacts"("school_year_id", "form_type", "scope_key");
