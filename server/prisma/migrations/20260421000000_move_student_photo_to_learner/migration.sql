-- CreateEnum
CREATE TYPE "atlas_sync_status" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- AlterTable
ALTER TABLE "learners" ADD COLUMN "student_photo" TEXT;

-- CreateTable
CREATE TABLE "atlas_sync_events" (
    "id" SERIAL NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "teacher_id" INTEGER,
    "school_year_id" INTEGER,
    "payload" JSONB NOT NULL,
    "request_url" TEXT NOT NULL,
    "status" "atlas_sync_status" NOT NULL DEFAULT 'PENDING',
    "http_status" INTEGER,
    "response_body" JSONB,
    "error_message" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "duration_ms" INTEGER,
    "last_attempt_at" TIMESTAMPTZ,
    "next_retry_at" TIMESTAMPTZ,
    "acknowledged_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "atlas_sync_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_atlas_sync_events_event_id" ON "atlas_sync_events"("event_id");
CREATE INDEX "idx_atlas_sync_events_status_retry" ON "atlas_sync_events"("status", "next_retry_at");
CREATE INDEX "idx_atlas_sync_events_teacher_created_at" ON "atlas_sync_events"("teacher_id", "created_at");
CREATE INDEX "idx_atlas_sync_events_sy_created_at" ON "atlas_sync_events"("school_year_id", "created_at");
CREATE INDEX "idx_atlas_sync_events_created_at" ON "atlas_sync_events"("created_at");

-- AddForeignKey
ALTER TABLE "atlas_sync_events" ADD CONSTRAINT "atlas_sync_events_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;     
ALTER TABLE "atlas_sync_events" ADD CONSTRAINT "atlas_sync_events_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data Migration: Move student_photo from early_registration_applications to learners
UPDATE "learners" l
SET "student_photo" = era."student_photo"
FROM "early_registration_applications" era
WHERE l."id" = era."learner_id" AND era."student_photo" IS NOT NULL;

-- Data Migration: Move student_photo from enrollment_applications to learners (overriding if exists)
UPDATE "learners" l
SET "student_photo" = ea."student_photo"
FROM "enrollment_applications" ea
WHERE l."id" = ea."learner_id" AND ea."student_photo" IS NOT NULL;
