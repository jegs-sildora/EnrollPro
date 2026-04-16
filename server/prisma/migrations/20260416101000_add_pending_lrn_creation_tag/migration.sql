-- Add learner-level tag for applicants awaiting official LRN generation.
ALTER TABLE "learners"
ADD COLUMN "is_pending_lrn_creation" BOOLEAN NOT NULL DEFAULT false;
