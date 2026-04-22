/*
  Warnings:

  - The values [REGISTRAR] on the enum `user_role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "user_role_new" AS ENUM ('SYSTEM_ADMIN', 'HEAD_REGISTRAR', 'GRADE_LEVEL_COORDINATOR', 'CLASS_ADVISER', 'TEACHER');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "user_role_new" USING ("role"::text::"user_role_new");
ALTER TYPE "user_role" RENAME TO "user_role_old";
ALTER TYPE "user_role_new" RENAME TO "user_role";
DROP TYPE "public"."user_role_old";
COMMIT;

-- AlterTable
ALTER TABLE "early_registration_applications" ADD COLUMN     "reported_grades" JSONB;
