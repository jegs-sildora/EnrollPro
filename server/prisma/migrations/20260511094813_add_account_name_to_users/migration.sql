/*
  Warnings:

  - A unique constraint covering the columns `[account_name]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "account_name" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- Backfill: staff users (non-LEARNER) get account_name from employee_id
UPDATE "users" SET "account_name" = "employee_id"
WHERE "employee_id" IS NOT NULL AND "role" != 'LEARNER';

-- Backfill: learner users get account_name from their linked learner's LRN
UPDATE "users" SET "account_name" = l."lrn"
FROM "learners" l
WHERE l."user_id" = "users"."id"
  AND "users"."role" = 'LEARNER'
  AND l."lrn" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_account_name" ON "users"("account_name");
