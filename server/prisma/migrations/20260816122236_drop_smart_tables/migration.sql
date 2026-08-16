/*
  Warnings:

  - You are about to drop the `smart_academic_outcomes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `smart_learning_area_results` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "smart_academic_outcomes" DROP CONSTRAINT "smart_academic_outcomes_enrollment_record_id_fkey";

-- DropForeignKey
ALTER TABLE "smart_learning_area_results" DROP CONSTRAINT "smart_learning_area_results_academic_outcome_id_fkey";

-- DropTable
DROP TABLE "smart_academic_outcomes";

-- DropTable
DROP TABLE "smart_learning_area_results";

-- DropEnum
DROP TYPE "learning_area_result_status";
