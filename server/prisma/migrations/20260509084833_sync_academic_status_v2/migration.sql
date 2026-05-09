-- AlterEnum
ALTER TYPE "academic_status" ADD VALUE 'CONDITIONALLY_PROMOTED';

-- AlterTable
ALTER TABLE "application_checklists" ADD COLUMN     "is_remedial_required" BOOLEAN NOT NULL DEFAULT false;
