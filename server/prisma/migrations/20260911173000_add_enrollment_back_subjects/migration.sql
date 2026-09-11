CREATE TABLE "enrollment_back_subjects" (
  "id" SERIAL NOT NULL,
  "application_id" INTEGER NOT NULL,
  "grade_level_id" INTEGER NOT NULL,
  "atlas_subject_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "subject_code" TEXT NOT NULL,
  "subject_name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "enrollment_back_subjects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_enrollment_back_subject_app_code"
ON "enrollment_back_subjects"("application_id", "subject_code");

CREATE INDEX "idx_enrollment_back_subject_grade"
ON "enrollment_back_subjects"("grade_level_id");

ALTER TABLE "enrollment_back_subjects"
ADD CONSTRAINT "enrollment_back_subjects_application_id_fkey"
FOREIGN KEY ("application_id") REFERENCES "enrollment_applications"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "enrollment_back_subjects"
ADD CONSTRAINT "enrollment_back_subjects_grade_level_id_fkey"
FOREIGN KEY ("grade_level_id") REFERENCES "grade_levels"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
