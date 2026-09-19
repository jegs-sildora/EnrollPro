/*
  Warnings:

  - You are about to drop the column `assessment_result` on the `enrollment_scp_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `has_interview` on the `enrollment_scp_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `has_written_exam` on the `enrollment_scp_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `written_exam_score` on the `enrollment_scp_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "application_addresses" ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "enrollment_scp_profiles" DROP COLUMN "assessment_result",
DROP COLUMN "has_interview",
DROP COLUMN "has_written_exam",
DROP COLUMN "written_exam_score";

-- DropEnum
DROP TYPE "scp_assessment_result";
