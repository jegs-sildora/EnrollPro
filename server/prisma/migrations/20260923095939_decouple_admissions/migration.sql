-- AlterTable
ALTER TABLE "enrollment_applications" ADD COLUMN     "scp_admission_id" INTEGER;

-- CreateTable
CREATE TABLE "scp_admissions" (
    "id" SERIAL NOT NULL,
    "learner_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "program" "applicant_type" NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "grade_5_general_average" DOUBLE PRECISION NOT NULL,
    "under_special_science_curriculum" BOOLEAN NOT NULL DEFAULT false,
    "arts_specialization" TEXT,
    "chosen_sport" TEXT,
    "requirements_status" "ScpAssessmentState" NOT NULL DEFAULT 'PENDING',
    "written_exam_status" "ScpAssessmentState" NOT NULL DEFAULT 'PENDING',
    "written_exam_score" DOUBLE PRECISION,
    "interview_status" "ScpAssessmentState" NOT NULL DEFAULT 'PENDING',
    "assessment_result" "ScpAssessmentResult" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scp_admissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_scp_admission_tracking_number" ON "scp_admissions"("tracking_number");

-- CreateIndex
CREATE UNIQUE INDEX "scp_admissions_learner_id_school_year_id_key" ON "scp_admissions"("learner_id", "school_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_applications_scp_admission_id_key" ON "enrollment_applications"("scp_admission_id");

-- AddForeignKey
ALTER TABLE "enrollment_applications" ADD CONSTRAINT "enrollment_applications_scp_admission_id_fkey" FOREIGN KEY ("scp_admission_id") REFERENCES "scp_admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scp_admissions" ADD CONSTRAINT "scp_admissions_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scp_admissions" ADD CONSTRAINT "scp_admissions_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate data from enrollment_scp_profiles and enrollment_applications to scp_admissions
INSERT INTO "scp_admissions" (
    "learner_id",
    "school_year_id",
    "program",
    "tracking_number",
    "grade_5_general_average",
    "under_special_science_curriculum",
    "arts_specialization",
    "chosen_sport",
    "requirements_status",
    "written_exam_status",
    "written_exam_score",
    "interview_status",
    "assessment_result",
    "created_at",
    "updated_at"
)
SELECT 
    ea."learner_id",
    ea."school_year_id",
    ea."applicant_type",
    ea."tracking_number",
    scp."grade_5_general_average",
    scp."under_special_science_curriculum",
    scp."arts_specialization",
    scp."chosen_sport",
    scp."requirements_status",
    scp."written_exam_status",
    scp."written_exam_score",
    scp."interview_status",
    scp."assessment_result",
    ea."created_at",
    ea."updated_at"
FROM "enrollment_scp_profiles" scp
JOIN "enrollment_applications" ea ON ea."id" = scp."application_id";

-- We need to delete the enrollment_applications that were purely for SCP admission to allow the learner to actually enroll later
DELETE FROM "enrollment_applications" 
WHERE "id" IN (SELECT "application_id" FROM "enrollment_scp_profiles");

DROP TABLE "enrollment_scp_profiles";
