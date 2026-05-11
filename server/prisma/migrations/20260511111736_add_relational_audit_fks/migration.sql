/*
  Warnings:

  - Added the required column `learner_id` to the `enrollment_records` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "early_registration_assessments" ADD COLUMN     "scp_program_step_id" INTEGER;

-- AlterTable
ALTER TABLE "enrollment_program_details" ADD COLUMN     "scp_program_config_id" INTEGER;

-- AlterTable
ALTER TABLE "enrollment_records" ADD COLUMN     "learner_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "scp_program_config_id" INTEGER;

-- CreateIndex
CREATE INDEX "idx_early_reg_assessments_step_id" ON "early_registration_assessments"("scp_program_step_id");

-- CreateIndex
CREATE INDEX "idx_enrollment_prog_details_config_id" ON "enrollment_program_details"("scp_program_config_id");

-- CreateIndex
CREATE INDEX "idx_enrollment_records_learner_id" ON "enrollment_records"("learner_id");

-- CreateIndex
CREATE INDEX "idx_sections_scp_program_config_id" ON "sections"("scp_program_config_id");

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_scp_program_config_id_fkey" FOREIGN KEY ("scp_program_config_id") REFERENCES "scp_program_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_registration_assessments" ADD CONSTRAINT "early_registration_assessments_scp_program_step_id_fkey" FOREIGN KEY ("scp_program_step_id") REFERENCES "scp_program_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_program_details" ADD CONSTRAINT "enrollment_program_details_scp_program_config_id_fkey" FOREIGN KEY ("scp_program_config_id") REFERENCES "scp_program_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_records" ADD CONSTRAINT "enrollment_records_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
