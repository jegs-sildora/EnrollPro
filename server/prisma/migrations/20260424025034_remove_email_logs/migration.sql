/*
  Warnings:

  - You are about to drop the `email_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "email_logs" DROP CONSTRAINT "email_logs_application_id_fkey";

-- AlterTable
ALTER TABLE "learners" ADD COLUMN     "previous_gen_ave" DOUBLE PRECISION,
ADD COLUMN     "promotion_status" TEXT;

-- DropTable
DROP TABLE "email_logs";

-- DropEnum
DROP TYPE "email_status";

-- DropEnum
DROP TYPE "email_trigger";
