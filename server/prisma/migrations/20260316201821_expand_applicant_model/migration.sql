/*
  Warnings:

  - You are about to drop the column `address` on the `Applicant` table. All the data in the column will be lost.
  - You are about to drop the column `parentGuardianContact` on the `Applicant` table. All the data in the column will be lost.
  - You are about to drop the column `parentGuardianName` on the `Applicant` table. All the data in the column will be lost.
  - Added the required column `currentAddress` to the `Applicant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fatherName` to the `Applicant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `motherName` to the `Applicant` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Applicant_lrn_key";

-- AlterTable
ALTER TABLE "Applicant" DROP COLUMN "address",
DROP COLUMN "parentGuardianContact",
DROP COLUMN "parentGuardianName",
ADD COLUMN     "currentAddress" JSONB NOT NULL,
ADD COLUMN     "disabilityType" TEXT[],
ADD COLUMN     "electiveCluster" TEXT,
ADD COLUMN     "fatherName" JSONB NOT NULL,
ADD COLUMN     "guardianInfo" JSONB,
ADD COLUMN     "householdId4Ps" TEXT,
ADD COLUMN     "ipGroupName" TEXT,
ADD COLUMN     "is4PsBeneficiary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isBalikAral" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isIpCommunity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isLearnerWithDisability" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastGradeCompleted" TEXT,
ADD COLUMN     "lastSchoolAddress" TEXT,
ADD COLUMN     "lastSchoolId" TEXT,
ADD COLUMN     "lastSchoolName" TEXT,
ADD COLUMN     "lastSchoolType" TEXT,
ADD COLUMN     "lastYearEnrolled" TEXT,
ADD COLUMN     "learnerType" TEXT,
ADD COLUMN     "motherName" JSONB NOT NULL,
ADD COLUMN     "motherTongue" TEXT,
ADD COLUMN     "permanentAddress" JSONB,
ADD COLUMN     "placeOfBirth" TEXT,
ADD COLUMN     "psaBcNumber" TEXT,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "scpApplication" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scpType" TEXT,
ADD COLUMN     "spaArtField" TEXT,
ADD COLUMN     "spflLanguage" TEXT,
ADD COLUMN     "spsSports" TEXT[],
ADD COLUMN     "syLastAttended" TEXT,
ALTER COLUMN "lrn" DROP NOT NULL,
ALTER COLUMN "emailAddress" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Applicant_trackingNumber_idx" ON "Applicant"("trackingNumber");
