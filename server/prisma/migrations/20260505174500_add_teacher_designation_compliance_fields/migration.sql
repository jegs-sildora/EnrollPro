-- Ensure teacher designation compliance structure is present and canonical.
-- This migration is idempotent to support environments where parts were applied previously.

ALTER TABLE "teacher_designations"
ADD COLUMN IF NOT EXISTS "advisory_section_id" INTEGER;

CREATE INDEX IF NOT EXISTS "idx_teacher_designations_advisory_section_id"
ON "teacher_designations" ("advisory_section_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_designations_advisory_section_id_fkey'
  ) THEN
    ALTER TABLE "teacher_designations"
    ADD CONSTRAINT "teacher_designations_advisory_section_id_fkey"
    FOREIGN KEY ("advisory_section_id")
    REFERENCES "sections" ("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
