-- AlterTable
ALTER TABLE "enrollment_records" ADD COLUMN     "drop_out_evidence_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
