DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'teacher_nature_of_appointment') THEN
    CREATE TYPE "teacher_nature_of_appointment" AS ENUM (
      'REGULAR_PERMANENT',
      'PROVISIONAL',
      'SUBSTITUTE',
      'CONTRACTUAL',
      'VOLUNTEER',
      'LOCAL_SCHOOL_BOARD',
      'OTHER'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'teacher_funding_source') THEN
    CREATE TYPE "teacher_funding_source" AS ENUM (
      'NATIONAL',
      'SPECIAL_EDUCATION_FUND',
      'LOCAL_SCHOOL_BOARD',
      'PTA',
      'NGO',
      'OTHER'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekday') THEN
    CREATE TYPE "weekday" AS ENUM (
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY'
    );
  END IF;
END
$$;

ALTER TABLE "teachers"
  ADD COLUMN IF NOT EXISTS "undergraduate_degree" TEXT,
  ADD COLUMN IF NOT EXISTS "postgraduate_degree" TEXT,
  ADD COLUMN IF NOT EXISTS "major_specialization" TEXT,
  ADD COLUMN IF NOT EXISTS "minor_specialization" TEXT,
  ADD COLUMN IF NOT EXISTS "administrative_remarks" TEXT,
  ADD COLUMN IF NOT EXISTS "indigenous_community" TEXT,
  ADD COLUMN IF NOT EXISTS "nature_of_appointment" "teacher_nature_of_appointment" NOT NULL DEFAULT 'REGULAR_PERMANENT',
  ADD COLUMN IF NOT EXISTS "funding_source" "teacher_funding_source" NOT NULL DEFAULT 'NATIONAL';

CREATE TABLE IF NOT EXISTS "teacher_schedule_periods" (
  "id" SERIAL PRIMARY KEY,
  "teacher_id" INTEGER NOT NULL,
  "school_year_id" INTEGER NOT NULL,
  "day_of_week" "weekday" NOT NULL,
  "start_time" VARCHAR(5) NOT NULL,
  "end_time" VARCHAR(5) NOT NULL,
  "subject_label" TEXT,
  "section_label" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teacher_schedule_periods_teacher_id_fkey"
    FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "teacher_schedule_periods_school_year_id_fkey"
    FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_teacher_schedule_periods_teacher_sy"
  ON "teacher_schedule_periods"("teacher_id", "school_year_id");

CREATE INDEX IF NOT EXISTS "idx_teacher_schedule_periods_school_year_id"
  ON "teacher_schedule_periods"("school_year_id");
