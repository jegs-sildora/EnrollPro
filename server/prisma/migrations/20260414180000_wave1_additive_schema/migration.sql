-- AlterEnum
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'TEACHER';

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "compliance_status" AS ENUM ('PENDING', 'COMPLIED', 'OVERDUE');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "applicants"
    ADD COLUMN IF NOT EXISTS "documentary_deadline_at" DATE,
    ADD COLUMN IF NOT EXISTS "compliance_status" "compliance_status";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_applicants_status_deadline" ON "applicants"("status", "documentary_deadline_at");
CREATE INDEX IF NOT EXISTS "idx_applicants_type_status_sy" ON "applicants"("applicant_type", "status", "school_year_id");
CREATE INDEX IF NOT EXISTS "idx_documents_applicant_status_type" ON "applicant_documents"("applicant_id", "status", "document_type");
CREATE INDEX IF NOT EXISTS "idx_enrollments_section_id" ON "enrollments"("section_id");
CREATE INDEX IF NOT EXISTS "idx_enrollments_school_year_id" ON "enrollments"("school_year_id");
CREATE INDEX IF NOT EXISTS "idx_enrollments_enrolled_by_id" ON "enrollments"("enrolled_by_id");
CREATE INDEX IF NOT EXISTS "idx_grade_levels_school_year_id" ON "grade_levels"("school_year_id");
CREATE INDEX IF NOT EXISTS "idx_sections_grade_level_id" ON "sections"("grade_level_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_created" ON "audit_logs"("user_id", "created_at");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "applicant_documents"
        ADD CONSTRAINT "applicant_documents_verified_by_id_fkey"
        FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
