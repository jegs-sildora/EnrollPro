/*
  Warnings:

  - You are about to drop the column `tle_specialization` on the `sections` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "tle_category" AS ENUM ('HOME_ECONOMICS', 'INDUSTRIAL_ARTS', 'AGRI_FISHERY_ARTS', 'ICT');

-- AlterTable
ALTER TABLE "enrollment_applications" ADD COLUMN     "tle_program_id" INTEGER;

-- AlterTable
ALTER TABLE "enrollment_records" ADD COLUMN     "tle_program_id" INTEGER;

-- AlterTable
ALTER TABLE "sections" DROP COLUMN "tle_specialization",
ADD COLUMN     "tle_program_id" INTEGER;

-- CreateTable
CREATE TABLE "tle_programs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "tle_category" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tle_programs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tle_programs_name_key" ON "tle_programs"("name");

-- CreateIndex
CREATE INDEX "idx_tle_programs_category" ON "tle_programs"("category");

-- CreateIndex
CREATE INDEX "idx_enrollment_apps_tle_program_id" ON "enrollment_applications"("tle_program_id");

-- CreateIndex
CREATE INDEX "idx_enrollment_records_tle_program_id" ON "enrollment_records"("tle_program_id");

-- CreateIndex
CREATE INDEX "idx_sections_tle_program_id" ON "sections"("tle_program_id");

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_tle_program_id_fkey" FOREIGN KEY ("tle_program_id") REFERENCES "tle_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_applications" ADD CONSTRAINT "enrollment_applications_tle_program_id_fkey" FOREIGN KEY ("tle_program_id") REFERENCES "tle_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_records" ADD CONSTRAINT "enrollment_records_tle_program_id_fkey" FOREIGN KEY ("tle_program_id") REFERENCES "tle_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
