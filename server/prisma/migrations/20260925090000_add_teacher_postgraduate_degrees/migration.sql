CREATE TABLE "teacher_postgraduate_degrees" (
    "id" SERIAL NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "degree" TEXT NOT NULL,
    "major" TEXT,
    "minor" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teacher_postgraduate_degrees_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_teacher_postgraduate_degrees_teacher_order"
ON "teacher_postgraduate_degrees"("teacher_id", "sort_order");

ALTER TABLE "teacher_postgraduate_degrees"
ADD CONSTRAINT "teacher_postgraduate_degrees_teacher_id_fkey"
FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "teacher_postgraduate_degrees" ("teacher_id", "degree", "major", "minor", "sort_order", "updated_at")
SELECT "id", "postgraduate_degree", "major_specialization", "minor_specialization", 0, CURRENT_TIMESTAMP
FROM "teachers"
WHERE COALESCE(TRIM("postgraduate_degree"), '') <> '';
