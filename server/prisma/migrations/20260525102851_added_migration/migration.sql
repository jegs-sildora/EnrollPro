-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "application_status" ADD VALUE 'PENDING_SCP_SCREENING';
ALTER TYPE "application_status" ADD VALUE 'QUALIFIED_SCP';
ALTER TYPE "application_status" ADD VALUE 'REGISTERED_BEC';
ALTER TYPE "application_status" ADD VALUE 'PENDING_READING';
ALTER TYPE "application_status" ADD VALUE 'PENDING_INTAKE_CONFIRMATION';
