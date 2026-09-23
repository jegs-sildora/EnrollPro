-- CreateEnum
CREATE TYPE "term_event_outbox_status" AS ENUM ('PENDING', 'PUBLISHING', 'PUBLISHED');

-- CreateTable
CREATE TABLE "term_changed_event_outbox" (
    "id" SERIAL NOT NULL,
    "event_id" UUID NOT NULL,
    "school_setting_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "school_id" VARCHAR(191) NOT NULL,
    "from_term" VARCHAR(2) NOT NULL,
    "to_term" VARCHAR(2) NOT NULL,
    "effective_date" DATE NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "term_event_outbox_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_until" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "term_changed_event_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_term_changed_outbox_event_id" ON "term_changed_event_outbox"("event_id");

-- CreateIndex
CREATE INDEX "idx_term_changed_outbox_pending" ON "term_changed_event_outbox"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "idx_term_changed_outbox_school_year" ON "term_changed_event_outbox"("school_year_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "term_changed_event_outbox_school_setting_id_school_year_id__key" ON "term_changed_event_outbox"("school_setting_id", "school_year_id", "from_term", "to_term", "effective_date");

-- AddForeignKey
ALTER TABLE "term_changed_event_outbox" ADD CONSTRAINT "term_changed_event_outbox_school_setting_id_fkey" FOREIGN KEY ("school_setting_id") REFERENCES "school_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term_changed_event_outbox" ADD CONSTRAINT "term_changed_event_outbox_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
