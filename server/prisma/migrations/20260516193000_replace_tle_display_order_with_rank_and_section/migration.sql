-- Replace TLE display_order with rank and add tle_section
ALTER TABLE "tle_programs"
  RENAME COLUMN "display_order" TO "rank";

ALTER TABLE "tle_programs"
  ADD COLUMN "tle_section" TEXT;
