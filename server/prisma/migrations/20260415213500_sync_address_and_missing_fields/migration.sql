-- AlterTable
ALTER TABLE "enrollment_applications" ADD COLUMN     "guardian_relationship" TEXT,
ADD COLUMN     "has_no_father" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_no_mother" BOOLEAN NOT NULL DEFAULT false;
