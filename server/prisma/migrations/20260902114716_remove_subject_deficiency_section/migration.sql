/*
  Warnings:

  - You are about to drop the column `section_id` on the `subject_deficiencies` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "subject_deficiencies" DROP CONSTRAINT "subject_deficiencies_section_id_fkey";

-- DropIndex
DROP INDEX "idx_subject_deficiency_section_id";

-- AlterTable
ALTER TABLE "subject_deficiencies" DROP COLUMN "section_id";
