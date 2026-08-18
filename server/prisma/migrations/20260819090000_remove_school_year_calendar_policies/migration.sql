ALTER TABLE "school_years"
  DROP CONSTRAINT IF EXISTS "school_years_calendar_policy_id_fkey";

DROP INDEX IF EXISTS "uq_school_years_calendar_policy_id";

ALTER TABLE "school_years"
  DROP COLUMN IF EXISTS "calendar_policy_id";

DROP TABLE IF EXISTS "school_year_calendar_policies";

DROP TYPE IF EXISTS "calendar_policy_status";
