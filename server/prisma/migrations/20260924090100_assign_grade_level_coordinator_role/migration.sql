-- Preserve every existing role and account field while ensuring the four reviewed
-- grade-level coordinators have the two application roles required by ATLAS.
UPDATE "users"
SET "roles" = array_append("roles", 'TEACHER'::"user_role"),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "employee_id" IN ('1234506', '1234507', '1234508', '1234509')
  AND NOT ('TEACHER'::"user_role" = ANY("roles"));

UPDATE "users"
SET "roles" = array_append("roles", 'GRADE_LEVEL_COORDINATOR'::"user_role"),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "employee_id" IN ('1234506', '1234507', '1234508', '1234509')
  AND NOT ('GRADE_LEVEL_COORDINATOR'::"user_role" = ANY("roles"));
