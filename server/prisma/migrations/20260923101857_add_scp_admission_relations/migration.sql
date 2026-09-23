-- DropForeignKey
ALTER TABLE "enrollment_previous_schools" DROP CONSTRAINT "enrollment_previous_schools_application_id_fkey";

-- AlterTable
ALTER TABLE "application_addresses" ADD COLUMN     "scp_admission_id" INTEGER;

-- AlterTable
ALTER TABLE "application_family_members" ADD COLUMN     "scp_admission_id" INTEGER;

-- DropTable
DROP TABLE "enrollment_previous_schools";

-- CreateTable
CREATE TABLE "application_previous_schools" (
    "id" SERIAL NOT NULL,
    "enrollment_id" INTEGER,
    "school_name" TEXT,
    "school_id" TEXT,
    "school_address" TEXT,
    "school_type" TEXT,
    "general_average" DOUBLE PRECISION,
    "transfer_certificate_no" TEXT,
    "scp_admission_id" INTEGER,

    CONSTRAINT "application_previous_schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_scp_profiles" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "grade_5_general_average" DOUBLE PRECISION NOT NULL,
    "under_special_science_curriculum" BOOLEAN NOT NULL DEFAULT false,
    "arts_specialization" TEXT,
    "chosen_sport" TEXT,
    "requirements_status" "ScpAssessmentState" NOT NULL DEFAULT 'PENDING',
    "written_exam_status" "ScpAssessmentState" NOT NULL DEFAULT 'PENDING',
    "written_exam_score" DOUBLE PRECISION,
    "interview_status" "ScpAssessmentState" NOT NULL DEFAULT 'PENDING',
    "assessment_result" "ScpAssessmentResult" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "enrollment_scp_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollment_prev_school_app_id" ON "application_previous_schools"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_previous_schools_scp_admission_id_key" ON "application_previous_schools"("scp_admission_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollment_scp_app_id" ON "enrollment_scp_profiles"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_addresses_scp_admission_id_address_type_key" ON "application_addresses"("scp_admission_id", "address_type");

-- CreateIndex
CREATE UNIQUE INDEX "application_family_members_scp_admission_id_relationship_key" ON "application_family_members"("scp_admission_id", "relationship");

-- AddForeignKey
ALTER TABLE "application_previous_schools" ADD CONSTRAINT "application_previous_schools_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_previous_schools" ADD CONSTRAINT "application_previous_schools_scp_admission_id_fkey" FOREIGN KEY ("scp_admission_id") REFERENCES "scp_admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_scp_profiles" ADD CONSTRAINT "enrollment_scp_profiles_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "enrollment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_addresses" ADD CONSTRAINT "application_addresses_scp_admission_id_fkey" FOREIGN KEY ("scp_admission_id") REFERENCES "scp_admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_family_members" ADD CONSTRAINT "application_family_members_scp_admission_id_fkey" FOREIGN KEY ("scp_admission_id") REFERENCES "scp_admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

