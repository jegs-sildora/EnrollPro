ALTER TABLE "school_years"
ADD COLUMN "term1_label" TEXT NOT NULL DEFAULT 'TERM 1',
ADD COLUMN "term2_label" TEXT NOT NULL DEFAULT 'TERM 2',
ADD COLUMN "term3_label" TEXT NOT NULL DEFAULT 'TERM 3',
ADD COLUMN "term4_label" TEXT NOT NULL DEFAULT 'QUARTER 4';

UPDATE "school_years"
SET
  "term1_label" = CASE WHEN "term_format" = 'QUARTERS' THEN 'QUARTER 1' ELSE 'TERM 1' END,
  "term2_label" = CASE WHEN "term_format" = 'QUARTERS' THEN 'QUARTER 2' ELSE 'TERM 2' END,
  "term3_label" = CASE WHEN "term_format" = 'QUARTERS' THEN 'QUARTER 3' ELSE 'TERM 3' END,
  "term4_label" = 'QUARTER 4';
