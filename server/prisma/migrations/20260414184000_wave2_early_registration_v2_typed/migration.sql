-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "early_registration_lifecycle_status" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'LINKED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "primary_contact_type" AS ENUM ('FATHER', 'MOTHER', 'GUARDIAN');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "early_registrations"
    ADD COLUMN IF NOT EXISTS "grade_level_id_v2" INTEGER,
    ADD COLUMN IF NOT EXISTS "learner_type_v2" "learner_type",
    ADD COLUMN IF NOT EXISTS "status_v2" "early_registration_lifecycle_status",
    ADD COLUMN IF NOT EXISTS "channel_v2" "admission_channel",
    ADD COLUMN IF NOT EXISTS "primary_contact_v2" "primary_contact_type";

-- Backfill enum-compatible values only (conservative, nullable fallback)
UPDATE "early_registrations"
SET "learner_type_v2" = CASE
    WHEN "learner_type" IN ('NEW_ENROLLEE', 'TRANSFEREE', 'RETURNING', 'CONTINUING', 'OSCYA', 'ALS')
        THEN "learner_type"::"learner_type"
    ELSE NULL
END
WHERE "learner_type_v2" IS NULL;

UPDATE "early_registrations"
SET "status_v2" = CASE
    WHEN "status" IN ('DRAFT', 'SUBMITTED', 'VERIFIED', 'LINKED')
        THEN "status"::"early_registration_lifecycle_status"
    ELSE NULL
END
WHERE "status_v2" IS NULL;

UPDATE "early_registrations"
SET "channel_v2" = CASE
    WHEN "channel" IN ('ONLINE', 'F2F')
        THEN "channel"::"admission_channel"
    ELSE NULL
END
WHERE "channel_v2" IS NULL;

UPDATE "early_registrations"
SET "primary_contact_v2" = CASE
    WHEN "primary_contact" IN ('FATHER', 'MOTHER', 'GUARDIAN')
        THEN "primary_contact"::"primary_contact_type"
    ELSE NULL
END
WHERE "primary_contact_v2" IS NULL;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "early_registrations"
        ADD CONSTRAINT "early_registrations_grade_level_id_v2_fkey"
        FOREIGN KEY ("grade_level_id_v2") REFERENCES "grade_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_early_registrations_sy_status_v2"
    ON "early_registrations"("school_year_id", "status_v2");
CREATE INDEX IF NOT EXISTS "idx_early_registrations_grade_level_v2"
    ON "early_registrations"("grade_level_id_v2");
