/*
  Warnings:

  - You are about to drop the column `is_tic` on the `teacher_designations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "teacher_designations" DROP COLUMN "is_tic",
ADD COLUMN     "ancillary_roles" TEXT[] DEFAULT ARRAY[]::TEXT[];
