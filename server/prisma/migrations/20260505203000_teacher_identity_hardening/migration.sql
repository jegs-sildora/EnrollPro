-- Fail fast when legacy data violates required teacher identity fields.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "teachers"
    WHERE "employee_id" IS NULL OR btrim("employee_id") = ''
  ) THEN
    RAISE EXCEPTION
      'Migration blocked: teachers with missing employee_id found. Backfill manually before rerunning.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "teachers"
    WHERE "email" IS NULL OR btrim("email") = ''
  ) THEN
    RAISE EXCEPTION
      'Migration blocked: teachers with missing email found. Backfill manually before rerunning.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT upper(btrim("employee_id")) AS normalized_employee_id, COUNT(*) AS duplicate_count
      FROM "teachers"
      GROUP BY upper(btrim("employee_id"))
      HAVING COUNT(*) > 1
    ) AS duplicates
  ) THEN
    RAISE EXCEPTION
      'Migration blocked: duplicate employee_id values detected after uppercase normalization.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT lower(btrim("email")) AS normalized_email, COUNT(*) AS duplicate_count
      FROM "teachers"
      GROUP BY lower(btrim("email"))
      HAVING COUNT(*) > 1
    ) AS duplicates
  ) THEN
    RAISE EXCEPTION
      'Migration blocked: duplicate email values detected after lowercase normalization.';
  END IF;
END $$;

-- Canonicalize values before applying constraints.
UPDATE "teachers"
SET
  "employee_id" = upper(btrim("employee_id")),
  "email" = lower(btrim("email"));

ALTER TABLE "teachers"
  ALTER COLUMN "employee_id" SET NOT NULL,
  ALTER COLUMN "email" SET NOT NULL;

CREATE UNIQUE INDEX "uq_teachers_email" ON "teachers"("email");
