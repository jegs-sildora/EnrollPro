/*
  Warnings:

  - You are about to drop the `application_documents` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "document_type" ADD VALUE 'WRITING_PORTFOLIO';

-- DropForeignKey
ALTER TABLE "application_documents" DROP CONSTRAINT "application_documents_early_registration_id_fkey";

-- DropForeignKey
ALTER TABLE "application_documents" DROP CONSTRAINT "application_documents_enrollment_id_fkey";

-- DropForeignKey
ALTER TABLE "application_documents" DROP CONSTRAINT "application_documents_uploaded_by_id_fkey";

-- DropForeignKey
ALTER TABLE "application_documents" DROP CONSTRAINT "application_documents_verified_by_id_fkey";

-- DropTable
DROP TABLE "application_documents";

-- DropEnum
DROP TYPE "document_status";
