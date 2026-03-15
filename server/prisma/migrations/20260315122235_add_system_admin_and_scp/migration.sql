-- CreateEnum
CREATE TYPE "CurriculumType" AS ENUM ('OLD_STRAND', 'ELECTIVE_CLUSTER');

-- CreateEnum
CREATE TYPE "SHSTrack" AS ENUM ('ACADEMIC', 'TECHPRO');

-- CreateEnum
CREATE TYPE "ApplicantType" AS ENUM ('REGULAR', 'STE', 'SPA', 'SPS', 'SPJ', 'SPFL', 'SPTVE', 'STEM_GRADE11');

-- CreateEnum
CREATE TYPE "EmailTrigger" AS ENUM ('APPLICATION_SUBMITTED', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED', 'EXAM_SCHEDULED', 'ASSESSMENT_PASSED', 'ASSESSMENT_FAILED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'EXAM_SCHEDULED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'EXAM_TAKEN';
ALTER TYPE "ApplicationStatus" ADD VALUE 'PASSED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'FAILED';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SYSTEM_ADMIN';

-- AlterTable
ALTER TABLE "Applicant" ADD COLUMN     "applicantType" "ApplicantType" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "assessmentType" TEXT,
ADD COLUMN     "examDate" TIMESTAMP(3),
ADD COLUMN     "examNotes" TEXT,
ADD COLUMN     "examResult" TEXT,
ADD COLUMN     "examScore" DOUBLE PRECISION,
ADD COLUMN     "grade10MathGrade" DOUBLE PRECISION,
ADD COLUMN     "grade10ScienceGrade" DOUBLE PRECISION,
ADD COLUMN     "interviewDate" TIMESTAMP(3),
ADD COLUMN     "interviewResult" TEXT,
ADD COLUMN     "natScore" DOUBLE PRECISION,
ADD COLUMN     "shsTrack" "SHSTrack";

-- AlterTable
ALTER TABLE "Strand" ADD COLUMN     "curriculumType" "CurriculumType" NOT NULL DEFAULT 'OLD_STRAND',
ADD COLUMN     "track" "SHSTrack";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" SERIAL NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "trigger" "EmailTrigger" NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "applicantId" INTEGER,
    "errorMessage" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScpConfig" (
    "id" SERIAL NOT NULL,
    "academicYearId" INTEGER NOT NULL,
    "scpType" "ApplicantType" NOT NULL,
    "isOffered" BOOLEAN NOT NULL DEFAULT false,
    "cutoffScore" DOUBLE PRECISION,
    "examDate" TIMESTAMP(3),
    "artFields" TEXT[],
    "languages" TEXT[],
    "sportsList" TEXT[],
    "notes" TEXT,

    CONSTRAINT "ScpConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_trigger_idx" ON "EmailLog"("trigger");

-- CreateIndex
CREATE UNIQUE INDEX "ScpConfig_academicYearId_scpType_key" ON "ScpConfig"("academicYearId", "scpType");

-- CreateIndex
CREATE INDEX "Applicant_applicantType_status_idx" ON "Applicant"("applicantType", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScpConfig" ADD CONSTRAINT "ScpConfig_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
