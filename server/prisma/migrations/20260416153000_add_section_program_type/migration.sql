ALTER TABLE "sections"
ADD COLUMN "program_type" "applicant_type" NOT NULL DEFAULT 'REGULAR';

CREATE INDEX "idx_sections_grade_level_program_type"
ON "sections" ("grade_level_id", "program_type");
