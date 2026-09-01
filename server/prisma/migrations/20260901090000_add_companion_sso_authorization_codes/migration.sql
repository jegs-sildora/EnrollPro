-- CreateEnum
CREATE TYPE "companion_system" AS ENUM ('ATLAS', 'AIMS', 'SMART', 'MRF');

-- CreateTable
CREATE TABLE "companion_sso_authorization_codes" (
    "id" SERIAL NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "companion" "companion_system" NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companion_sso_authorization_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_companion_sso_codes_hash" ON "companion_sso_authorization_codes"("code_hash");

-- CreateIndex
CREATE INDEX "idx_companion_sso_codes_user_created" ON "companion_sso_authorization_codes"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_companion_sso_codes_expiry" ON "companion_sso_authorization_codes"("expires_at", "consumed_at");

-- AddForeignKey
ALTER TABLE "companion_sso_authorization_codes"
ADD CONSTRAINT "companion_sso_authorization_codes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
