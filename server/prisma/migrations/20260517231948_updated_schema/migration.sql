/*
  Warnings:

  - You are about to drop the column `description` on the `tle_programs` table. All the data in the column will be lost.
  - You are about to drop the column `program_code` on the `tle_programs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tle_programs" DROP COLUMN "description",
DROP COLUMN "program_code";
