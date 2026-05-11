-- Migration: Enforce strict 7-digit numeric DepEd Employee ID format
-- Affected tables: users, teachers

-- ─────────────────────────────────────────────────────────────────
-- STEP 1: Fix known system / seed account IDs in users
-- ─────────────────────────────────────────────────────────────────
UPDATE "users" SET "employee_id" = '1000001', "account_name" = '1000001' WHERE "employee_id" = 'SYSADMIN-001';
UPDATE "users" SET "employee_id" = '1000002', "account_name" = '1000002' WHERE "employee_id" = 'REG-001';
UPDATE "users" SET "employee_id" = '1000003', "account_name" = '1000003' WHERE "employee_id" = 'DEPED-USER-001';
UPDATE "users" SET "employee_id" = '1000004', "account_name" = '1000004' WHERE "employee_id" = 'DEPED-USER-002';

-- ─────────────────────────────────────────────────────────────────
-- STEP 2: Pad legacy 6-digit numeric teacher user accounts → 7-digit
-- (prepends '0', preserving leading-zero validity per DepEd HRIS rules)
-- ─────────────────────────────────────────────────────────────────
UPDATE "users"
SET
  "employee_id"  = '0' || "employee_id",
  "account_name" = '0' || "account_name"
WHERE
  "role" = 'TEACHER'
  AND "employee_id" IS NOT NULL
  AND length("employee_id") = 6
  AND "employee_id" ~ '^[0-9]{6}$';

-- ─────────────────────────────────────────────────────────────────
-- STEP 3: Pad legacy 6-digit teacher records → 7-digit
-- ─────────────────────────────────────────────────────────────────
UPDATE "teachers"
SET "employee_id" = '0' || "employee_id"
WHERE
  length("employee_id") = 6
  AND "employee_id" ~ '^[0-9]{6}$';

-- ─────────────────────────────────────────────────────────────────
-- STEP 4: NULL out any remaining non-compliant user employee IDs
-- (accounts that had non-numeric or wrong-length IDs)
-- ─────────────────────────────────────────────────────────────────
UPDATE "users"
SET "employee_id" = NULL,
    "account_name" = NULL
WHERE
  "employee_id" IS NOT NULL
  AND (
    length("employee_id") != 7
    OR "employee_id" !~ '^[0-9]{7}$'
  );

-- ─────────────────────────────────────────────────────────────────
-- STEP 5: Change column types from TEXT → VARCHAR(7)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "users"     ALTER COLUMN "employee_id" TYPE VARCHAR(7);
ALTER TABLE "teachers"  ALTER COLUMN "employee_id" TYPE VARCHAR(7);

-- ─────────────────────────────────────────────────────────────────
-- STEP 6: Add CHECK constraints enforcing 7-digit numeric format
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "users"
  ADD CONSTRAINT "chk_users_employee_id_format"
  CHECK (
    "employee_id" IS NULL
    OR (length("employee_id") = 7 AND "employee_id" ~ '^[0-9]{7}$')
  );

ALTER TABLE "teachers"
  ADD CONSTRAINT "chk_teachers_employee_id_format"
  CHECK (
    length("employee_id") = 7
    AND "employee_id" ~ '^[0-9]{7}$'
  );
