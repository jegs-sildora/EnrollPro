-- Add lifecycle metadata fields for learner transfer and dropout actions.
ALTER TABLE "school_years"
ADD COLUMN "section_shift_window_days" INTEGER;

ALTER TABLE "enrollment_records"
ADD COLUMN "drop_out_date" DATE,
ADD COLUMN "transfer_out_school_name" TEXT,
ADD COLUMN "transfer_out_reason" TEXT;
