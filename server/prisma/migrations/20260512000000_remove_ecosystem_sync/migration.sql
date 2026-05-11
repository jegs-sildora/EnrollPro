-- Drop ecosystem sync tables and associated enums
DROP TABLE IF EXISTS "ecosystem_sync_statuses" CASCADE;
DROP TABLE IF EXISTS "atlas_sync_events" CASCADE;
DROP TYPE IF EXISTS "ecosystem_type";
DROP TYPE IF EXISTS "sync_status";
DROP TYPE IF EXISTS "atlas_sync_status";
