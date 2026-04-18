-- Enable UUID generator used for external learner IDs.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- AlterTable
ALTER TABLE "learners"
ADD COLUMN "external_id" UUID;

-- Backfill existing learners.
UPDATE "learners"
SET "external_id" = gen_random_uuid()
WHERE "external_id" IS NULL;

-- AlterTable
ALTER TABLE "learners"
ALTER COLUMN "external_id" SET NOT NULL,
ALTER COLUMN "external_id" SET DEFAULT gen_random_uuid();

-- CreateIndex
CREATE UNIQUE INDEX "uq_learners_external_id" ON "learners"("external_id");
