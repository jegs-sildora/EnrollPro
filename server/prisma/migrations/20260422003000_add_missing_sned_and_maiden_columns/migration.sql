-- Add columns expected by Prisma schema but missing in some local DB states.
ALTER TABLE "learners"
ADD COLUMN IF NOT EXISTS "sned_placement" TEXT;

ALTER TABLE "application_family_members"
ADD COLUMN IF NOT EXISTS "maiden_name" TEXT;
