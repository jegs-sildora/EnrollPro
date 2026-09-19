-- CreateEnum
CREATE TYPE "scp_assessment_result" AS ENUM ('PENDING', 'QUALIFIED', 'DISQUALIFIED');

-- AlterTable
ALTER TABLE "enrollment_scp_profiles" ADD COLUMN     "assessment_result" "scp_assessment_result" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "has_interview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_written_exam" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "written_exam_score" DOUBLE PRECISION;
