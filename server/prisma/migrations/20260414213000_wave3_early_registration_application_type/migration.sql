-- AlterTable
ALTER TABLE "early_registrations"
    ADD COLUMN IF NOT EXISTS "applicant_type" "applicant_type" NOT NULL DEFAULT 'REGULAR';

-- Backfill safety for any legacy null rows
UPDATE "early_registrations"
SET "applicant_type" = 'REGULAR'
WHERE "applicant_type" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_early_registrations_applicant_type"
    ON "early_registrations"("applicant_type");

CREATE INDEX IF NOT EXISTS "idx_early_registrations_sy_type_status"
    ON "early_registrations"("school_year_id", "applicant_type", "status");
