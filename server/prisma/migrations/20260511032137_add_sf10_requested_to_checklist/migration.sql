/*
  Warnings:

  - The values [GRADE_LEVEL_COORDINATOR] on the enum `user_role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "user_role_new" AS ENUM ('SYSTEM_ADMIN', 'HEAD_REGISTRAR', 'CLASS_ADVISER', 'TEACHER', 'LEARNER');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "user_role_new" USING ("role"::text::"user_role_new");
ALTER TYPE "user_role" RENAME TO "user_role_old";
ALTER TYPE "user_role_new" RENAME TO "user_role";
DROP TYPE "public"."user_role_old";
COMMIT;

-- AlterTable
ALTER TABLE "application_checklists" ADD COLUMN     "is_sf10_requested" BOOLEAN NOT NULL DEFAULT false;
