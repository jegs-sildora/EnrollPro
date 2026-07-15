-- Destructive cleanup: retired Reading Assessment and legacy Intake Listing workflow.
-- Existing reading profile and pre-listing data is intentionally discarded.

ALTER TABLE IF EXISTS "enrollment_applications"
  DROP CONSTRAINT IF EXISTS "enrollment_applications_reading_profile_assessed_by_id_fkey";

DROP TABLE IF EXISTS "enrollment_listings";

ALTER TABLE IF EXISTS "enrollment_applications"
  DROP COLUMN IF EXISTS "reading_profile_level",
  DROP COLUMN IF EXISTS "reading_profile_notes",
  DROP COLUMN IF EXISTS "reading_profile_assessed_at",
  DROP COLUMN IF EXISTS "reading_profile_assessed_by_id";

ALTER TABLE IF EXISTS "school_settings"
  DROP COLUMN IF EXISTS "require_reading_assessment_continuing",
  DROP COLUMN IF EXISTS "require_reading_assessment_new";

DROP TYPE IF EXISTS "enrollment_listing_status";
DROP TYPE IF EXISTS "reading_profile_level";
