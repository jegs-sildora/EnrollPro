-- CreateTable
CREATE TABLE "regions" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "provinces" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region_code" TEXT NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "cities_municipalities" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "province_code" TEXT NOT NULL,

    CONSTRAINT "cities_municipalities_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "barangays" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city_municipality_code" TEXT NOT NULL,

    CONSTRAINT "barangays_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "idx_provinces_region_code" ON "provinces"("region_code");

-- CreateIndex
CREATE INDEX "idx_cities_municipalities_province_code" ON "cities_municipalities"("province_code");

-- CreateIndex
CREATE INDEX "idx_barangays_city_municipality_code" ON "barangays"("city_municipality_code");

-- AddForeignKey
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities_municipalities" ADD CONSTRAINT "cities_municipalities_province_code_fkey" FOREIGN KEY ("province_code") REFERENCES "provinces"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barangays" ADD CONSTRAINT "barangays_city_municipality_code_fkey" FOREIGN KEY ("city_municipality_code") REFERENCES "cities_municipalities"("code") ON DELETE CASCADE ON UPDATE CASCADE;
