-- CreateTable
CREATE TABLE "enrollment_history" (
    "id" SERIAL NOT NULL,
    "learner_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "grade_level_id" INTEGER NOT NULL,
    "section_id" INTEGER,
    "adviser_id" INTEGER,
    "gen_ave" DOUBLE PRECISION,
    "eosy_status" "eosy_status",
    "learner_profile_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_enrollment_history_learner_sy"
ON "enrollment_history"("learner_id", "school_year_id");

-- AddForeignKey
ALTER TABLE "enrollment_history"
ADD CONSTRAINT "enrollment_history_learner_id_fkey"
FOREIGN KEY ("learner_id") REFERENCES "learners"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_history"
ADD CONSTRAINT "enrollment_history_school_year_id_fkey"
FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_history"
ADD CONSTRAINT "enrollment_history_grade_level_id_fkey"
FOREIGN KEY ("grade_level_id") REFERENCES "grade_levels"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_history"
ADD CONSTRAINT "enrollment_history_section_id_fkey"
FOREIGN KEY ("section_id") REFERENCES "sections"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_history"
ADD CONSTRAINT "enrollment_history_adviser_id_fkey"
FOREIGN KEY ("adviser_id") REFERENCES "teachers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
