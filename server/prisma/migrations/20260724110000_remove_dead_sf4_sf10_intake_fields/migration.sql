DROP TABLE IF EXISTS "sf4_logs";

ALTER TABLE "enrollment_applications"
  DROP COLUMN IF EXISTS "batch_intake_method",
  DROP COLUMN IF EXISTS "intake_method";

ALTER TABLE "enrollment_records"
  DROP COLUMN IF EXISTS "enrollment_record_intake_method",
  DROP COLUMN IF EXISTS "sf10_status";

DROP TYPE IF EXISTS "intake_method";
DROP TYPE IF EXISTS "SF10Status";
