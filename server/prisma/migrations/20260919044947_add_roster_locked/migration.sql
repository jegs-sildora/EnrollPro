-- AlterEnum
ALTER TYPE "ScpAssessmentResult" ADD VALUE 'WAITLISTED';

-- AlterTable
ALTER TABLE "school_years" ADD COLUMN     "spa_roster_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sps_roster_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ste_roster_locked" BOOLEAN NOT NULL DEFAULT false;
