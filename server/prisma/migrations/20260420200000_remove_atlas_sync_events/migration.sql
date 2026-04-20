-- DropForeignKey
ALTER TABLE "atlas_sync_events"
DROP CONSTRAINT "atlas_sync_events_teacher_id_fkey";

-- DropForeignKey
ALTER TABLE "atlas_sync_events"
DROP CONSTRAINT "atlas_sync_events_school_year_id_fkey";

-- DropTable
DROP TABLE "atlas_sync_events";

-- DropEnum
DROP TYPE "atlas_sync_status";
