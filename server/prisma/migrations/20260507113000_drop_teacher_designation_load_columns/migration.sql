-- Drop teacher load-calculation columns from designation scope.
ALTER TABLE "teacher_designations"
  DROP COLUMN IF EXISTS "advisory_equivalent_hours_per_week",
  DROP COLUMN IF EXISTS "custom_target_teaching_hours_per_week",
  DROP COLUMN IF EXISTS "is_teaching_exempt";
