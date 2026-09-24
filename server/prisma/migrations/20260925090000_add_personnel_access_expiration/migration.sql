ALTER TABLE "users"
ADD COLUMN "access_expiration_date" TIMESTAMPTZ(6);

ALTER TABLE "teachers"
ALTER COLUMN "employee_id" DROP NOT NULL;

CREATE INDEX "idx_users_active_access_expiration"
ON "users" ("access_expiration_date")
WHERE "is_active" = true AND "access_expiration_date" IS NOT NULL;
