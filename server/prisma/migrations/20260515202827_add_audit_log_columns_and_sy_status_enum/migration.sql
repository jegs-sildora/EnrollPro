/*
  Warnings:

  - The values [IRREGULAR] on the enum `eosy_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "eosy_status_new" AS ENUM ('PROMOTED', 'CONDITIONALLY_PROMOTED', 'RETAINED', 'DROPPED_OUT', 'TRANSFERRED_OUT');
ALTER TABLE "enrollment_records" ALTER COLUMN "eosy_status" TYPE "eosy_status_new" USING ("eosy_status"::text::"eosy_status_new");
ALTER TYPE "eosy_status" RENAME TO "eosy_status_old";
ALTER TYPE "eosy_status_new" RENAME TO "eosy_status";
DROP TYPE "public"."eosy_status_old";
COMMIT;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "new_value" TEXT,
ADD COLUMN     "old_value" TEXT;
