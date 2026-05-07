-- CreateEnum
CREATE TYPE "ecosystem_type" AS ENUM ('ENROLLPRO', 'ATLAS', 'SMART', 'AIMS');

-- CreateEnum
CREATE TYPE "sync_status" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "ecosystem_sync_statuses" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "learner_id" INTEGER,
    "teacher_id" INTEGER,
    "ecosystem" "ecosystem_type" NOT NULL,
    "status" "sync_status" NOT NULL DEFAULT 'PENDING',
    "external_id" TEXT,
    "last_synced_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ecosystem_sync_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ecosystem_sync_statuses_user_id_ecosystem_key" ON "ecosystem_sync_statuses"("user_id", "ecosystem");

-- CreateIndex
CREATE UNIQUE INDEX "ecosystem_sync_statuses_learner_id_ecosystem_key" ON "ecosystem_sync_statuses"("learner_id", "ecosystem");

-- CreateIndex
CREATE UNIQUE INDEX "ecosystem_sync_statuses_teacher_id_ecosystem_key" ON "ecosystem_sync_statuses"("teacher_id", "ecosystem");

-- AddForeignKey
ALTER TABLE "ecosystem_sync_statuses" ADD CONSTRAINT "ecosystem_sync_statuses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecosystem_sync_statuses" ADD CONSTRAINT "ecosystem_sync_statuses_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecosystem_sync_statuses" ADD CONSTRAINT "ecosystem_sync_statuses_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
