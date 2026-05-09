/*
  Warnings:

  - You are about to drop the column `shift` on the `sections` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "sections" DROP COLUMN "shift";

-- DropEnum
DROP TYPE "shift_type";
