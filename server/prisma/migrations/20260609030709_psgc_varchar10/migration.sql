/*
  Warnings:

  - The primary key for the `barangays` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `code` on the `barangays` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - You are about to alter the column `city_municipality_code` on the `barangays` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - The primary key for the `cities_municipalities` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `code` on the `cities_municipalities` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - You are about to alter the column `province_code` on the `cities_municipalities` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - The primary key for the `provinces` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `code` on the `provinces` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - You are about to alter the column `region_code` on the `provinces` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - The primary key for the `regions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `code` on the `regions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.

*/
-- DropForeignKey
ALTER TABLE "barangays" DROP CONSTRAINT "barangays_city_municipality_code_fkey";

-- DropForeignKey
ALTER TABLE "cities_municipalities" DROP CONSTRAINT "cities_municipalities_province_code_fkey";

-- DropForeignKey
ALTER TABLE "provinces" DROP CONSTRAINT "provinces_region_code_fkey";

-- AlterTable
ALTER TABLE "barangays" DROP CONSTRAINT "barangays_pkey",
ALTER COLUMN "code" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "city_municipality_code" SET DATA TYPE VARCHAR(10),
ADD CONSTRAINT "barangays_pkey" PRIMARY KEY ("code");

-- AlterTable
ALTER TABLE "cities_municipalities" DROP CONSTRAINT "cities_municipalities_pkey",
ALTER COLUMN "code" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "province_code" SET DATA TYPE VARCHAR(10),
ADD CONSTRAINT "cities_municipalities_pkey" PRIMARY KEY ("code");

-- AlterTable
ALTER TABLE "provinces" DROP CONSTRAINT "provinces_pkey",
ALTER COLUMN "code" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "region_code" SET DATA TYPE VARCHAR(10),
ADD CONSTRAINT "provinces_pkey" PRIMARY KEY ("code");

-- AlterTable
ALTER TABLE "regions" DROP CONSTRAINT "regions_pkey",
ALTER COLUMN "code" SET DATA TYPE VARCHAR(10),
ADD CONSTRAINT "regions_pkey" PRIMARY KEY ("code");

-- AddForeignKey
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities_municipalities" ADD CONSTRAINT "cities_municipalities_province_code_fkey" FOREIGN KEY ("province_code") REFERENCES "provinces"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barangays" ADD CONSTRAINT "barangays_city_municipality_code_fkey" FOREIGN KEY ("city_municipality_code") REFERENCES "cities_municipalities"("code") ON DELETE CASCADE ON UPDATE CASCADE;
