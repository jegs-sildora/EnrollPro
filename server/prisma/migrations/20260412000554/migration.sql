/*
  Warnings:

  - The values [STEM_GRADE_11] on the enum `applicant_type` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `elective_cluster` on the `applicants` table. All the data in the column will be lost.
  - You are about to drop the column `shs_track` on the `applicants` table. All the data in the column will be lost.
  - You are about to drop the column `strand_id` on the `applicants` table. All the data in the column will be lost.
  - You are about to drop the `strand_grade_levels` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `strands` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "applicant_type_new" AS ENUM ('REGULAR', 'SCIENCE_TECHNOLOGY_AND_ENGINEERING', 'SPECIAL_PROGRAM_IN_THE_ARTS', 'SPECIAL_PROGRAM_IN_SPORTS', 'SPECIAL_PROGRAM_IN_JOURNALISM', 'SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE', 'SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION');
ALTER TABLE "public"."applicants" ALTER COLUMN "applicant_type" DROP DEFAULT;
ALTER TABLE "applicants" ALTER COLUMN "applicant_type" TYPE "applicant_type_new" USING ("applicant_type"::text::"applicant_type_new");
ALTER TABLE "applicant_program_details" ALTER COLUMN "scp_type" TYPE "applicant_type_new" USING ("scp_type"::text::"applicant_type_new");
ALTER TABLE "scp_program_configs" ALTER COLUMN "scp_type" TYPE "applicant_type_new" USING ("scp_type"::text::"applicant_type_new");
ALTER TYPE "applicant_type" RENAME TO "applicant_type_old";
ALTER TYPE "applicant_type_new" RENAME TO "applicant_type";
DROP TYPE "public"."applicant_type_old";
ALTER TABLE "applicants" ALTER COLUMN "applicant_type" SET DEFAULT 'REGULAR';
COMMIT;

-- DropForeignKey
ALTER TABLE "applicants" DROP CONSTRAINT "applicants_strand_id_fkey";

-- DropForeignKey
ALTER TABLE "strand_grade_levels" DROP CONSTRAINT "strand_grade_levels_grade_level_id_fkey";

-- DropForeignKey
ALTER TABLE "strand_grade_levels" DROP CONSTRAINT "strand_grade_levels_strand_id_fkey";

-- DropForeignKey
ALTER TABLE "strands" DROP CONSTRAINT "strands_school_year_id_fkey";

-- AlterTable
ALTER TABLE "applicants" DROP COLUMN "elective_cluster",
DROP COLUMN "shs_track",
DROP COLUMN "strand_id";

-- DropTable
DROP TABLE "strand_grade_levels";

-- DropTable
DROP TABLE "strands";

-- DropEnum
DROP TYPE "curriculum_type";

-- DropEnum
DROP TYPE "shs_track";
