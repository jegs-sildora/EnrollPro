-- AlterTable
ALTER TABLE "enrollment_records" ADD COLUMN     "transfer_out_evidence_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
