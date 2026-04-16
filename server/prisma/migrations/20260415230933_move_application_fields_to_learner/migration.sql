-- AlterTable (Add columns first)
ALTER TABLE "learners" ADD COLUMN     "has_pwd_id" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_balik_aral" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_grade_level" TEXT,
ADD COLUMN     "last_year_enrolled" TEXT,
ADD COLUMN     "psa_birth_cert_number" TEXT,
ADD COLUMN     "special_needs_category" TEXT;

-- Data Migration (Transfer data from enrollment_applications to learners)
-- We use a subquery to get the latest application for each learner to be more accurate
UPDATE "learners" l
SET 
  "has_pwd_id" = ea."has_pwd_id",
  "is_balik_aral" = ea."is_balik_aral",
  "last_year_enrolled" = ea."last_year_enrolled",
  "special_needs_category" = ea."special_needs_category"
FROM "enrollment_applications" ea
WHERE l."id" = ea."learner_id"
AND ea."created_at" = (
  SELECT MAX("created_at")
  FROM "enrollment_applications"
  WHERE "learner_id" = l."id"
);

-- AlterTable (Drop columns from enrollment_applications)
ALTER TABLE "enrollment_applications" DROP COLUMN "has_pwd_id",
DROP COLUMN "is_balik_aral",
DROP COLUMN "last_year_enrolled",
DROP COLUMN "special_needs_category";
