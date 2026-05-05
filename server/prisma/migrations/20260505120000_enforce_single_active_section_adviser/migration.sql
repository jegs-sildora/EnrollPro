-- Enforce one ACTIVE advisership per teacher in a given school year.
-- This is a PostgreSQL partial unique index because Prisma schema cannot model it directly.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_section_advisers_teacher_sy_active"
ON "section_advisers" ("teacher_id", "school_year_id")
WHERE "status" = 'ACTIVE';
