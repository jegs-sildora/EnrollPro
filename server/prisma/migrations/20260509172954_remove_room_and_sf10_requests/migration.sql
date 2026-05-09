/*
  Warnings:

  - You are about to drop the column `is_sf10_requested` on the `application_checklists` table. All the data in the column will be lost.
  - You are about to drop the column `room_id` on the `sections` table. All the data in the column will be lost.
  - You are about to drop the `rooms` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sf10_requests` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "sections" DROP CONSTRAINT "sections_room_id_fkey";

-- DropForeignKey
ALTER TABLE "sf10_requests" DROP CONSTRAINT "sf10_requests_learner_id_fkey";

-- AlterTable
ALTER TABLE "application_checklists" DROP COLUMN "is_sf10_requested";

-- AlterTable
ALTER TABLE "sections" DROP COLUMN "room_id";

-- DropTable
DROP TABLE "rooms";

-- DropTable
DROP TABLE "sf10_requests";

-- DropEnum
DROP TYPE "sf10_request_status";
