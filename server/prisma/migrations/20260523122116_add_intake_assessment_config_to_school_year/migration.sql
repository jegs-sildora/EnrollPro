-- AlterTable
ALTER TABLE "school_years" ADD COLUMN     "require_reading_assessment_continuing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "require_reading_assessment_new" BOOLEAN NOT NULL DEFAULT true;
