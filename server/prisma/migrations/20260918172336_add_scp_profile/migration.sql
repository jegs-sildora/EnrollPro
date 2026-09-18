-- CreateTable
CREATE TABLE "enrollment_scp_profiles" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "grade_5_general_average" DOUBLE PRECISION NOT NULL,
    "under_special_science_curriculum" BOOLEAN NOT NULL DEFAULT false,
    "arts_specialization" TEXT,
    "chosen_sport" TEXT,

    CONSTRAINT "enrollment_scp_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollment_scp_app_id" ON "enrollment_scp_profiles"("application_id");

-- AddForeignKey
ALTER TABLE "enrollment_scp_profiles" ADD CONSTRAINT "enrollment_scp_profiles_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "enrollment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
