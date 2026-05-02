/*
  Warnings:

  - You are about to drop the `rubric_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rubric_criteria` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "rubric_categories" DROP CONSTRAINT "rubric_categories_scp_program_step_id_fkey";

-- DropForeignKey
ALTER TABLE "rubric_criteria" DROP CONSTRAINT "rubric_criteria_rubric_category_id_fkey";

-- DropTable
DROP TABLE "rubric_categories";

-- DropTable
DROP TABLE "rubric_criteria";

-- CreateTable
CREATE TABLE "scp_interview_rubric_categories" (
    "id" SERIAL NOT NULL,
    "scp_program_step_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "scp_interview_rubric_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scp_interview_rubric_criteria" (
    "id" SERIAL NOT NULL,
    "rubric_category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "max_pts" DOUBLE PRECISION NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "scp_interview_rubric_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_rubric_categories_step_id" ON "scp_interview_rubric_categories"("scp_program_step_id");

-- CreateIndex
CREATE INDEX "idx_rubric_criteria_category_id" ON "scp_interview_rubric_criteria"("rubric_category_id");

-- AddForeignKey
ALTER TABLE "scp_interview_rubric_categories" ADD CONSTRAINT "scp_interview_rubric_categories_scp_program_step_id_fkey" FOREIGN KEY ("scp_program_step_id") REFERENCES "scp_program_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scp_interview_rubric_criteria" ADD CONSTRAINT "scp_interview_rubric_criteria_rubric_category_id_fkey" FOREIGN KEY ("rubric_category_id") REFERENCES "scp_interview_rubric_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
