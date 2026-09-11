/*
  Warnings:

  - You are about to drop the column `guardian_name` on the `enrollment_applications` table. All the data in the column will be lost.
  - You are about to drop the column `guardian_name` on the `enrollment_records` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "enrollment_applications" DROP COLUMN "guardian_name";

-- AlterTable
ALTER TABLE "enrollment_records" DROP COLUMN "guardian_name";

-- RenameIndex
ALTER INDEX "uq_companion_identity_subject" RENAME TO "companion_identity_links_companion_external_subject_key";

-- RenameIndex
ALTER INDEX "uq_companion_identity_user" RENAME TO "companion_identity_links_companion_user_id_key";
