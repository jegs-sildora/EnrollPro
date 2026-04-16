/*
  Warnings:

  - You are about to drop the column `country` on the `early_registration_addresses` table. All the data in the column will be lost.
  - You are about to drop the column `zip_code` on the `early_registration_addresses` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "early_registration_addresses" DROP COLUMN "country",
DROP COLUMN "zip_code";
