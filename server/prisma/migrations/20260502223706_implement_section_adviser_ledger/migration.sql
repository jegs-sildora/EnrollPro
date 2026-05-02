/*
  Warnings:

  - You are about to drop the column `advising_teacher_id` on the `sections` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "section_adviser_status" AS ENUM ('ACTIVE', 'HANDED_OVER', 'REVOKED');

-- DropForeignKey
ALTER TABLE "sections" DROP CONSTRAINT "sections_advising_teacher_id_fkey";

-- AlterTable
ALTER TABLE "sections" DROP COLUMN "advising_teacher_id";

-- CreateTable
CREATE TABLE "section_advisers" (
    "id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "section_adviser_status" NOT NULL DEFAULT 'ACTIVE',
    "handover_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "section_advisers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_section_advisers_section_id" ON "section_advisers"("section_id");

-- CreateIndex
CREATE INDEX "idx_section_advisers_teacher_id" ON "section_advisers"("teacher_id");

-- AddForeignKey
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
