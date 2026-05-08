/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `learners` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "user_role" ADD VALUE 'LEARNER';

-- AlterTable
ALTER TABLE "learners" ADD COLUMN     "user_id" INTEGER;

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "tle_specialization" TEXT;

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "sex" "sex" NOT NULL DEFAULT 'FEMALE';

-- CreateIndex
CREATE UNIQUE INDEX "uq_learners_user_id" ON "learners"("user_id");

-- AddForeignKey
ALTER TABLE "learners" ADD CONSTRAINT "learners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
