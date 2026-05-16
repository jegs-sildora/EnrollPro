-- CreateEnum
CREATE TYPE "tle_sectioning_status" AS ENUM ('PENDING', 'READY_FOR_TLE_SECTIONING', 'SECTIONED_FOR_TLE');

-- AlterTable
ALTER TABLE "enrollment_applications" ADD COLUMN     "tle_status" "tle_sectioning_status" DEFAULT 'PENDING';
