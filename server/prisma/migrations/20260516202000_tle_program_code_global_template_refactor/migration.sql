-- TLE programs are global curriculum templates: remove rank/section bindings and add program code
ALTER TABLE "tle_programs"
  DROP COLUMN IF EXISTS "rank",
  DROP COLUMN IF EXISTS "tle_section";

ALTER TABLE "tle_programs"
  ADD COLUMN IF NOT EXISTS "program_code" TEXT NOT NULL DEFAULT '';
