/*
  Warnings:

  - You are about to drop the column `has_interview` on the `enrollment_scp_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `has_passed_requirements` on the `enrollment_scp_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `has_written_exam` on the `enrollment_scp_profiles` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ScpAssessmentState" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- AlterTable
ALTER TABLE "enrollment_scp_profiles" DROP COLUMN "has_interview",
DROP COLUMN "has_passed_requirements",
DROP COLUMN "has_written_exam",
ADD COLUMN     "interview_status" "ScpAssessmentState" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "requirements_status" "ScpAssessmentState" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "written_exam_status" "ScpAssessmentState" NOT NULL DEFAULT 'PENDING';
