/*
  Warnings:

  - You are about to drop the column `advisory_equivalent_hours_per_week` on the `teacher_designations` table. All the data in the column will be lost.
  - You are about to drop the `teacher_subjects` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "teacher_subjects" DROP CONSTRAINT "teacher_subjects_teacher_id_fkey";

-- AlterTable
ALTER TABLE "teacher_designations" DROP COLUMN "advisory_equivalent_hours_per_week";

-- DropTable
DROP TABLE "teacher_subjects";
