ALTER TABLE "sections"
ADD COLUMN "display_name" TEXT,
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 9999;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "grade_level_id", "program_type"
      ORDER BY name ASC, id ASC
    ) AS rank_order
  FROM "sections"
)
UPDATE "sections" AS section_row
SET
  "display_name" = section_row.name,
  "sort_order" = ranked.rank_order
FROM ranked
WHERE section_row.id = ranked.id;
