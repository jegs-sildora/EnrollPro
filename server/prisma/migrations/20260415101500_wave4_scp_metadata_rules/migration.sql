-- AlterTable
ALTER TABLE "scp_program_configs"
    ADD COLUMN IF NOT EXISTS "grade_requirements" JSONB,
    ADD COLUMN IF NOT EXISTS "document_requirements" JSONB,
    ADD COLUMN IF NOT EXISTS "ranking_formula" JSONB;
