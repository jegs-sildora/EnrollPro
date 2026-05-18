-- AlterTable
ALTER TABLE "enrollment_records" ADD COLUMN     "tle_section_id" INTEGER;

-- CreateIndex
CREATE INDEX "idx_enrollment_records_tle_section_id" ON "enrollment_records"("tle_section_id");

-- AddForeignKey
ALTER TABLE "enrollment_records" ADD CONSTRAINT "enrollment_records_tle_section_id_fkey" FOREIGN KEY ("tle_section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
