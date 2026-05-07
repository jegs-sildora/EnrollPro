-- AlterTable
ALTER TABLE "learners" ADD COLUMN     "status" "learner_status" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "sf10_requests" (
    "id" SERIAL NOT NULL,
    "learner_id" INTEGER NOT NULL,
    "requesting_school_name" TEXT NOT NULL,
    "requesting_school_deped_id" TEXT,
    "request_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "sf10_request_status" NOT NULL DEFAULT 'PENDING',
    "sent_date" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sf10_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_sf10_requests_learner_id" ON "sf10_requests"("learner_id");

-- AddForeignKey
ALTER TABLE "sf10_requests" ADD CONSTRAINT "sf10_requests_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
