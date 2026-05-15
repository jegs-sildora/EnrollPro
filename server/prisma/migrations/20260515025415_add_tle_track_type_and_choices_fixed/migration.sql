-- CreateEnum
CREATE TYPE "tle_track_type" AS ENUM ('EXPLORATORY', 'SPECIALIZATION');

-- AlterTable
ALTER TABLE "enrollment_applications" ADD COLUMN     "tle_program_choice2_id" INTEGER;

-- AlterTable
ALTER TABLE "enrollment_records" ADD COLUMN     "tle_program_choice2_id" INTEGER;

-- AlterTable
ALTER TABLE "tle_programs" ADD COLUMN     "track_type" "tle_track_type" NOT NULL DEFAULT 'SPECIALIZATION';

-- AddForeignKey
ALTER TABLE "enrollment_applications" ADD CONSTRAINT "enrollment_applications_tle_program_choice2_id_fkey" FOREIGN KEY ("tle_program_choice2_id") REFERENCES "tle_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_records" ADD CONSTRAINT "enrollment_records_tle_program_choice2_id_fkey" FOREIGN KEY ("tle_program_choice2_id") REFERENCES "tle_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
