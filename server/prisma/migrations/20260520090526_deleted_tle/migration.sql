/*
  Warnings:

  - You are about to drop the column `tle_program_choice2_id` on the `enrollment_applications` table. All the data in the column will be lost.
  - You are about to drop the column `tle_program_id` on the `enrollment_applications` table. All the data in the column will be lost.
  - You are about to drop the column `tle_status` on the `enrollment_applications` table. All the data in the column will be lost.
  - You are about to drop the column `tle_program_choice2_id` on the `enrollment_records` table. All the data in the column will be lost.
  - You are about to drop the column `tle_program_id` on the `enrollment_records` table. All the data in the column will be lost.
  - You are about to drop the column `tle_section_id` on the `enrollment_records` table. All the data in the column will be lost.
  - You are about to drop the column `is_tle_selection_open` on the `school_settings` table. All the data in the column will be lost.
  - You are about to drop the column `tle_program_id` on the `sections` table. All the data in the column will be lost.
  - You are about to drop the `tle_programs` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "enrollment_listing_status" AS ENUM ('LISTED', 'PROCESSED');

-- DropForeignKey
ALTER TABLE "enrollment_applications" DROP CONSTRAINT "enrollment_applications_tle_program_choice2_id_fkey";

-- DropForeignKey
ALTER TABLE "enrollment_applications" DROP CONSTRAINT "enrollment_applications_tle_program_id_fkey";

-- DropForeignKey
ALTER TABLE "enrollment_records" DROP CONSTRAINT "enrollment_records_tle_program_choice2_id_fkey";

-- DropForeignKey
ALTER TABLE "enrollment_records" DROP CONSTRAINT "enrollment_records_tle_program_id_fkey";

-- DropForeignKey
ALTER TABLE "enrollment_records" DROP CONSTRAINT "enrollment_records_tle_section_id_fkey";

-- DropForeignKey
ALTER TABLE "sections" DROP CONSTRAINT "sections_tle_program_id_fkey";

-- DropIndex
DROP INDEX "idx_enrollment_apps_tle_program_id";

-- DropIndex
DROP INDEX "idx_enrollment_records_tle_program_id";

-- DropIndex
DROP INDEX "idx_enrollment_records_tle_section_id";

-- DropIndex
DROP INDEX "idx_sections_tle_program_id";

-- AlterTable
ALTER TABLE "enrollment_applications" DROP COLUMN "tle_program_choice2_id",
DROP COLUMN "tle_program_id",
DROP COLUMN "tle_status";

-- AlterTable
ALTER TABLE "enrollment_records" DROP COLUMN "tle_program_choice2_id",
DROP COLUMN "tle_program_id",
DROP COLUMN "tle_section_id";

-- AlterTable
ALTER TABLE "school_settings" DROP COLUMN "is_tle_selection_open";

-- AlterTable
ALTER TABLE "sections" DROP COLUMN "tle_program_id";

-- DropTable
DROP TABLE "tle_programs";

-- DropEnum
DROP TYPE "tle_category";

-- DropEnum
DROP TYPE "tle_sectioning_status";

-- DropEnum
DROP TYPE "tle_track_type";

-- CreateTable
CREATE TABLE "enrollment_listings" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "grade_level" TEXT NOT NULL,
    "date_collected" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "enrollment_listing_status" NOT NULL DEFAULT 'LISTED',
    "school_year_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "enrollment_listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_enrollment_listings_sy" ON "enrollment_listings"("school_year_id");

-- CreateIndex
CREATE INDEX "idx_enrollment_listings_created_by" ON "enrollment_listings"("created_by_id");

-- AddForeignKey
ALTER TABLE "enrollment_listings" ADD CONSTRAINT "enrollment_listings_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_listings" ADD CONSTRAINT "enrollment_listings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
