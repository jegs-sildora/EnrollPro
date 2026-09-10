-- Add the structured guardian fields already used by the Prisma schema.
-- Keep the legacy guardian_name columns intact for backward compatibility.
ALTER TABLE "enrollment_applications"
  ADD COLUMN IF NOT EXISTS "guardian_first_name" TEXT,
  ADD COLUMN IF NOT EXISTS "guardian_middle_name" TEXT,
  ADD COLUMN IF NOT EXISTS "guardian_last_name" TEXT;

ALTER TABLE "enrollment_records"
  ADD COLUMN IF NOT EXISTS "guardian_first_name" TEXT,
  ADD COLUMN IF NOT EXISTS "guardian_middle_name" TEXT,
  ADD COLUMN IF NOT EXISTS "guardian_last_name" TEXT;
