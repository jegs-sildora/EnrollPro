ALTER TABLE "teachers"
ADD COLUMN "bachelor_major" TEXT,
ADD COLUMN "bachelor_minor" TEXT;

UPDATE "teachers"
SET
  "bachelor_major" = "major_specialization",
  "bachelor_minor" = "minor_specialization"
WHERE COALESCE(TRIM("undergraduate_degree"), '') <> '';
