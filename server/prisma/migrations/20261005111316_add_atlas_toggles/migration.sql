-- AlterTable
ALTER TABLE "teacher_designations" ADD COLUMN     "atlas_assign_teaching_load" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "atlas_build_schedules" BOOLEAN NOT NULL DEFAULT false;
