-- AlterTable
ALTER TABLE "teacher_designations" ADD COLUMN     "advisory_equivalent_hours_per_week" DOUBLE PRECISION,
ADD COLUMN     "is_teaching_exempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_tic" BOOLEAN NOT NULL DEFAULT false;
