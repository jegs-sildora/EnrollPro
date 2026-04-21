-- AlterTable
ALTER TABLE "sections" ADD COLUMN "is_homogeneous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "is_snake" BOOLEAN NOT NULL DEFAULT false;
