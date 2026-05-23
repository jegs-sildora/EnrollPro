-- AlterEnum
ALTER TYPE "enrollment_listing_status" ADD VALUE 'CONFIRMED';

-- AlterTable
ALTER TABLE "enrollment_applications" ADD COLUMN     "intake_height_cm" DOUBLE PRECISION,
ADD COLUMN     "intake_weight_kg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "enrollment_listings" ADD COLUMN     "confirmation_slip_received" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "height_cm" DOUBLE PRECISION,
ADD COLUMN     "learner_type" "learner_type",
ADD COLUMN     "lrn" TEXT,
ADD COLUMN     "middle_name" TEXT,
ADD COLUMN     "reading_level" "reading_profile_level",
ADD COLUMN     "weight_kg" DOUBLE PRECISION;
