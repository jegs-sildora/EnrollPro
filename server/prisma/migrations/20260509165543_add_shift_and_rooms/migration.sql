-- CreateEnum
CREATE TYPE "shift_type" AS ENUM ('MORNING', 'AFTERNOON');

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "room_id" INTEGER,
ADD COLUMN     "shift" "shift_type" NOT NULL DEFAULT 'MORNING';

-- CreateTable
CREATE TABLE "rooms" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "building" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 45,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_rooms_name" ON "rooms"("name");

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
