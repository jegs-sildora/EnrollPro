-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "user_role" ADD VALUE 'PRINCIPAL';
ALTER TYPE "user_role" ADD VALUE 'SCHOOL_REGISTRAR';
ALTER TYPE "user_role" ADD VALUE 'STE_COORDINATOR';
ALTER TYPE "user_role" ADD VALUE 'SPA_COORDINATOR';
ALTER TYPE "user_role" ADD VALUE 'SPS_COORDINATOR';
