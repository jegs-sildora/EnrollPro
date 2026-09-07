-- Stable external identity bindings for reverse companion-to-EnrollPro SSO.
CREATE TABLE "companion_identity_links" (
    "id" SERIAL NOT NULL,
    "companion" "companion_system" NOT NULL,
    "external_subject" VARCHAR(191) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "last_authenticated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "companion_identity_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_companion_identity_subject"
ON "companion_identity_links"("companion", "external_subject");

CREATE UNIQUE INDEX "uq_companion_identity_user"
ON "companion_identity_links"("companion", "user_id");

CREATE INDEX "idx_companion_identity_links_user"
ON "companion_identity_links"("user_id");

ALTER TABLE "companion_identity_links"
ADD CONSTRAINT "companion_identity_links_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
