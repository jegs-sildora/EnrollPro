-- AddValueToEnum
ALTER TYPE "application_status" ADD VALUE 'FLAGGED_FOR_REGISTRAR';

-- AlterTable
ALTER TABLE "tle_programs" ADD COLUMN "description" TEXT,
                           ADD COLUMN "max_slots" INTEGER;
