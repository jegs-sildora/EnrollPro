/*
  Warnings:

  - The values [PLANNING,ENROLLMENT,COMPLETED] on the enum `AcademicYearStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [REVIEWING,QUALIFIED,ENROLLED] on the enum `ApplicationStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `endDate` on the `AcademicYear` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `AcademicYear` table. All the data in the column will be lost.
  - You are about to drop the column `enrollmentCloseAt` on the `SchoolSettings` table. All the data in the column will be lost.
  - You are about to drop the column `enrollmentOpen` on the `SchoolSettings` table. All the data in the column will be lost.
  - You are about to drop the column `enrollmentOpenAt` on the `SchoolSettings` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AcademicYearStatus_new" AS ENUM ('DRAFT', 'UPCOMING', 'ACTIVE', 'ARCHIVED');
ALTER TABLE "public"."AcademicYear" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "AcademicYear" ALTER COLUMN "status" TYPE "AcademicYearStatus_new" USING ("status"::text::"AcademicYearStatus_new");
ALTER TYPE "AcademicYearStatus" RENAME TO "AcademicYearStatus_old";
ALTER TYPE "AcademicYearStatus_new" RENAME TO "AcademicYearStatus";
DROP TYPE "public"."AcademicYearStatus_old";
ALTER TABLE "AcademicYear" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ApplicationStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "public"."Applicant" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Applicant" ALTER COLUMN "status" TYPE "ApplicationStatus_new" USING ("status"::text::"ApplicationStatus_new");
ALTER TYPE "ApplicationStatus" RENAME TO "ApplicationStatus_old";
ALTER TYPE "ApplicationStatus_new" RENAME TO "ApplicationStatus";
DROP TYPE "public"."ApplicationStatus_old";
ALTER TABLE "Applicant" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "AcademicYear" DROP COLUMN "endDate",
DROP COLUMN "startDate",
ADD COLUMN     "classEndDate" TIMESTAMP(3),
ADD COLUMN     "classOpeningDate" TIMESTAMP(3),
ADD COLUMN     "earlyRegCloseDate" TIMESTAMP(3),
ADD COLUMN     "earlyRegOpenDate" TIMESTAMP(3),
ADD COLUMN     "enrollCloseDate" TIMESTAMP(3),
ADD COLUMN     "enrollOpenDate" TIMESTAMP(3),
ADD COLUMN     "manualOverrideOpen" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "SchoolSettings" DROP COLUMN "enrollmentCloseAt",
DROP COLUMN "enrollmentOpen",
DROP COLUMN "enrollmentOpenAt";
