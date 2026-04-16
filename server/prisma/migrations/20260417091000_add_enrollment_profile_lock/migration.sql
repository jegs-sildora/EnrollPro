ALTER TABLE "enrollment_applications"
ADD COLUMN "is_profile_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "profile_locked_at" TIMESTAMPTZ,
ADD COLUMN "profile_locked_by_id" INTEGER;

ALTER TABLE "enrollment_applications"
ADD CONSTRAINT "enrollment_applications_profile_locked_by_id_fkey"
FOREIGN KEY ("profile_locked_by_id")
REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
