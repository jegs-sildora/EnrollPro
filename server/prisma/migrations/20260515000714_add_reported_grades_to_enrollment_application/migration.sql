-- AlterEnum
ALTER TYPE "user_role" ADD VALUE 'MRF';

-- AlterTable
ALTER TABLE "enrollment_applications" ADD COLUMN     "reported_grades" JSONB;
