-- SMART's documented final-outcome endpoint does not require revision or
-- publication metadata. Preserve those values when supplied without
-- blocking otherwise valid grade results.
ALTER TABLE "smart_academic_outcomes"
  ALTER COLUMN "smart_revision" DROP NOT NULL,
  ALTER COLUMN "published_at" DROP NOT NULL;
