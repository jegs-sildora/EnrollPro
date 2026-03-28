/*
  Warnings:

  - The values [STE,SPA,SPS,SPJ,SPFL,SPTVE,STEM_GRADE11] on the enum `applicant_type` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "applicant_type_new" AS ENUM ('REGULAR', 'SCIENCE_TECHNOLOGY_AND_ENGINEERING', 'SPECIAL_PROGRAM_IN_THE_ARTS', 'SPECIAL_PROGRAM_IN_SPORTS', 'SPECIAL_PROGRAM_IN_JOURNALISM', 'SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE', 'SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION', 'STEM_GRADE_11');
ALTER TABLE "public"."applicants" ALTER COLUMN "applicant_type" DROP DEFAULT;
ALTER TABLE "applicants" ALTER COLUMN "applicant_type" TYPE "applicant_type_new" USING ("applicant_type"::text::"applicant_type_new");
ALTER TABLE "scp_configs" ALTER COLUMN "scp_type" TYPE "applicant_type_new" USING ("scp_type"::text::"applicant_type_new");
ALTER TYPE "applicant_type" RENAME TO "applicant_type_old";
ALTER TYPE "applicant_type_new" RENAME TO "applicant_type";
DROP TYPE "public"."applicant_type_old";
ALTER TABLE "applicants" ALTER COLUMN "applicant_type" SET DEFAULT 'REGULAR';
COMMIT;

-- AlterEnum
ALTER TYPE "application_status" ADD VALUE 'EXAM_SCHEDULED';
