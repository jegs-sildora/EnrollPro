/*
  Warnings:

  - You are about to drop the column `school_year_id` on the `grade_levels` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `grade_levels` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,grade_level_id,school_year_id]` on the table `sections` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `school_year_id` to the `sections` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "grade_levels" DROP CONSTRAINT "grade_levels_school_year_id_fkey";

-- DropIndex
DROP INDEX "idx_grade_levels_school_year_id";

-- DropIndex
DROP INDEX "sections_name_grade_level_id_key";

-- AlterTable
ALTER TABLE "grade_levels" DROP COLUMN "school_year_id";

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "school_year_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "uq_grade_levels_name" ON "grade_levels"("name");

-- CreateIndex
CREATE INDEX "idx_sections_school_year_id" ON "sections"("school_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "sections_name_grade_level_id_school_year_id_key" ON "sections"("name", "grade_level_id", "school_year_id");

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
