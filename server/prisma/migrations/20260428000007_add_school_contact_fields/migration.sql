/*
  Warnings:

  - You are about to drop the column `is_manual_override_open` on the `school_years` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "intake_method" AS ENUM ('BEEF_FULL', 'CONFIRMATION_SLIP');

-- CreateEnum
CREATE TYPE "sectioning_method" AS ENUM ('BATCH_ALGORITHM', 'INLINE_SLOTTING');

-- CreateEnum
CREATE TYPE "portal_control" AS ENUM ('AUTO', 'FORCE_OPEN_PHASE_1', 'FORCE_OPEN_PHASE_2', 'FORCE_CLOSE_ALL');

-- AlterEnum
ALTER TYPE "applicant_type" ADD VALUE 'LATE_ENROLLEE';

-- AlterEnum
ALTER TYPE "application_status" ADD VALUE 'TRANSFERRING_OUT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "school_year_status" ADD VALUE 'PREPARATION';
ALTER TYPE "school_year_status" ADD VALUE 'ENROLLMENT_OPEN';
ALTER TYPE "school_year_status" ADD VALUE 'BOSY_LOCKED';
ALTER TYPE "school_year_status" ADD VALUE 'EOSY_PROCESSING';

-- AlterTable
ALTER TABLE "application_checklists" ADD COLUMN     "is_secondary_birth_doc_presented" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "early_registration_applications" ADD COLUMN     "has_sf9_certification_letter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_unsettled_private_account" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_missing_sf9" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originating_school_name" TEXT;

-- AlterTable
ALTER TABLE "enrollment_applications" ADD COLUMN     "batch_intake_method" TEXT,
ADD COLUMN     "confirmation_consent" BOOLEAN,
ADD COLUMN     "contact_number" TEXT,
ADD COLUMN     "guardian_name" TEXT,
ADD COLUMN     "has_sf9_certification_letter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_unsettled_private_account" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "intake_method" "intake_method" NOT NULL DEFAULT 'BEEF_FULL',
ADD COLUMN     "is_missing_sf9" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originating_school_name" TEXT,
ADD COLUMN     "temporary_status_deadline" DATE;

-- AlterTable
ALTER TABLE "enrollment_records" ADD COLUMN     "confirmation_consent" BOOLEAN,
ADD COLUMN     "contact_number" TEXT,
ADD COLUMN     "date_sectioned" TIMESTAMPTZ,
ADD COLUMN     "enrollment_record_intake_method" TEXT,
ADD COLUMN     "guardian_name" TEXT,
ADD COLUMN     "sectioning_method" "sectioning_method" NOT NULL DEFAULT 'BATCH_ALGORITHM',
ADD COLUMN     "sf1_remarks" TEXT;

-- AlterTable
ALTER TABLE "learners" ADD COLUMN     "birth_certificate_type" TEXT,
ADD COLUMN     "birth_certificate_verified_by" TEXT,
ADD COLUMN     "birth_certificate_verified_date" TIMESTAMPTZ,
ADD COLUMN     "has_psa_birth_certificate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "school_settings" ADD COLUMN     "deped_email" TEXT,
ADD COLUMN     "facebook_page_url" TEXT,
ADD COLUMN     "school_website" TEXT;

-- AlterTable
ALTER TABLE "school_years" DROP COLUMN "is_manual_override_open",
ADD COLUMN     "bosy_locked_at" TIMESTAMPTZ,
ADD COLUMN     "bosy_locked_by_id" INTEGER,
ADD COLUMN     "portal_control" "portal_control" NOT NULL DEFAULT 'AUTO';

-- AddForeignKey
ALTER TABLE "school_years" ADD CONSTRAINT "school_years_bosy_locked_by_id_fkey" FOREIGN KEY ("bosy_locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
