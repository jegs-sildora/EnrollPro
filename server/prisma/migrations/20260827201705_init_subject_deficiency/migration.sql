-- CreateTable
CREATE TABLE "subject_deficiencies" (
    "id" SERIAL NOT NULL,
    "learner_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "subject_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENROLLED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subject_deficiencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_subject_deficiency_learner_id" ON "subject_deficiencies"("learner_id");

-- CreateIndex
CREATE INDEX "idx_subject_deficiency_school_year_id" ON "subject_deficiencies"("school_year_id");

-- CreateIndex
CREATE INDEX "idx_subject_deficiency_section_id" ON "subject_deficiencies"("section_id");

-- CreateIndex
CREATE UNIQUE INDEX "subject_deficiencies_learner_id_school_year_id_subject_name_key" ON "subject_deficiencies"("learner_id", "school_year_id", "subject_name");

-- AddForeignKey
ALTER TABLE "subject_deficiencies" ADD CONSTRAINT "subject_deficiencies_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_deficiencies" ADD CONSTRAINT "subject_deficiencies_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_deficiencies" ADD CONSTRAINT "subject_deficiencies_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
