CREATE TABLE "tracking_number_reservations" (
    "tracking_number" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_number_reservations_pkey" PRIMARY KEY ("tracking_number"),
    CONSTRAINT "tracking_number_reservations_source_check"
        CHECK ("source" IN ('SCP_ADMISSION', 'ENROLLMENT'))
);

-- Backfill every number already issued. UNION ALL deliberately makes this
-- migration fail if a historical number exists in both workflows.
INSERT INTO "tracking_number_reservations" ("tracking_number", "source", "created_at")
SELECT "tracking_number", 'SCP_ADMISSION', "created_at"
FROM "scp_admissions"
UNION ALL
SELECT "tracking_number", 'ENROLLMENT', "created_at"
FROM "enrollment_applications"
WHERE "tracking_number" IS NOT NULL;
