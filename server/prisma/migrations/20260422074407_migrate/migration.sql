/*
  Warnings:

  - A unique constraint covering the columns `[name,grade_level_id]` on the table `sections` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "school_years" ADD COLUMN     "sectioning_config" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "sections_name_grade_level_id_key" ON "sections"("name", "grade_level_id");
