-- CreateTable
CREATE TABLE "early_registration_addresses" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "address_type" "address_type" NOT NULL,
    "house_no" TEXT,
    "street" TEXT,
    "sitio" TEXT,
    "barangay" TEXT,
    "city_municipality" TEXT,
    "province" TEXT,
    "country" TEXT DEFAULT 'PHILIPPINES',
    "zip_code" TEXT,

    CONSTRAINT "early_registration_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "early_registration_addresses_application_id_address_type_key" ON "early_registration_addresses"("application_id", "address_type");

-- AddForeignKey
ALTER TABLE "early_registration_addresses" ADD CONSTRAINT "early_registration_addresses_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "early_registration_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
