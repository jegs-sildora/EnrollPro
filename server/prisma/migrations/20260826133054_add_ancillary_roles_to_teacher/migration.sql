-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "ancillary_roles" TEXT[] DEFAULT ARRAY[]::TEXT[];
