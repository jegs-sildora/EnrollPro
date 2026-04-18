-- CreateEnum
CREATE TYPE "eosy_status" AS ENUM ('PROMOTED', 'RETAINED', 'IRREGULAR', 'TRANSFERRED_OUT', 'DROPPED_OUT');

-- AlterTable
ALTER TABLE "enrollment_records" ADD COLUMN     "drop_out_reason" TEXT,
ADD COLUMN     "eosy_status" "eosy_status",
ADD COLUMN     "transfer_out_date" DATE;

-- AlterTable
ALTER TABLE "school_years" ADD COLUMN     "is_eosy_finalized" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "is_eosy_finalized" BOOLEAN NOT NULL DEFAULT false;
