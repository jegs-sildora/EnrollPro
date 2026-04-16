-- CreateTable
CREATE TABLE "application_addresses" (
    "id" SERIAL NOT NULL,
    "early_registration_id" INTEGER,
    "enrollment_id" INTEGER,
    "address_type" "address_type" NOT NULL,
    "house_no" TEXT,
    "street" TEXT,
    "sitio" TEXT,
    "barangay" TEXT,
    "city_municipality" TEXT,
    "province" TEXT,
    "country" TEXT DEFAULT 'PHILIPPINES',
    "zip_code" TEXT,

    CONSTRAINT "application_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_family_members" (
    "id" SERIAL NOT NULL,
    "early_registration_id" INTEGER,
    "enrollment_id" INTEGER,
    "relationship" "family_relationship" NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "contact_number" TEXT,
    "email" TEXT,
    "occupation" TEXT,

    CONSTRAINT "application_family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_documents" (
    "id" SERIAL NOT NULL,
    "early_registration_id" INTEGER,
    "enrollment_id" INTEGER,
    "document_type" "document_type" NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'SUBMITTED',
    "file_name" TEXT,
    "original_name" TEXT,
    "mime_type" TEXT,
    "size" INTEGER,
    "verification_note" TEXT,
    "is_presented_only" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by_id" INTEGER,
    "verified_at" TIMESTAMPTZ,
    "verified_by_id" INTEGER,

    CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_checklists" (
    "id" SERIAL NOT NULL,
    "early_registration_id" INTEGER,
    "enrollment_id" INTEGER,
    "is_psa_birth_cert_presented" BOOLEAN NOT NULL DEFAULT false,
    "is_original_psa_bc_collected" BOOLEAN NOT NULL DEFAULT false,
    "is_sf9_submitted" BOOLEAN NOT NULL DEFAULT false,
    "is_sf10_requested" BOOLEAN NOT NULL DEFAULT false,
    "is_good_moral_presented" BOOLEAN NOT NULL DEFAULT false,
    "is_medical_eval_submitted" BOOLEAN NOT NULL DEFAULT false,
    "is_cert_of_recognition_presented" BOOLEAN NOT NULL DEFAULT false,
    "is_undertaking_signed" BOOLEAN NOT NULL DEFAULT false,
    "is_confirmation_slip_received" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by_id" INTEGER,

    CONSTRAINT "application_checklists_pkey" PRIMARY KEY ("id")
);

-- Data Migration
INSERT INTO "application_addresses" ("early_registration_id", "address_type", "house_no", "street", "sitio", "barangay", "city_municipality", "province")
SELECT "application_id", "address_type", "house_no", "street", "sitio", "barangay", "city_municipality", "province" FROM "early_registration_addresses";

INSERT INTO "application_addresses" ("enrollment_id", "address_type", "house_no", "street", "sitio", "barangay", "city_municipality", "province", "country", "zip_code")
SELECT "application_id", "address_type", "house_no", "street", "sitio", "barangay", "city_municipality", "province", "country", "zip_code" FROM "enrollment_addresses";

INSERT INTO "application_family_members" ("early_registration_id", "relationship", "first_name", "last_name", "middle_name", "contact_number", "email", "occupation")
SELECT "application_id", "relationship", "first_name", "last_name", "middle_name", "contact_number", "email", "occupation" FROM "early_registration_guardians";

INSERT INTO "application_family_members" ("enrollment_id", "relationship", "first_name", "last_name", "middle_name", "contact_number", "email", "occupation")
SELECT "application_id", "relationship", "first_name", "last_name", "middle_name", "contact_number", "email", "occupation" FROM "enrollment_family_members";

INSERT INTO "application_documents" ("early_registration_id", "document_type", "status", "file_name", "original_name", "mime_type", "size", "verification_note", "uploaded_at")
SELECT "application_id", "document_type", "status", "file_name", "original_name", "mime_type", "size", "verification_note", "uploaded_at" FROM "early_registration_documents";

INSERT INTO "application_documents" ("enrollment_id", "document_type", "status", "file_name", "original_name", "mime_type", "size", "verification_note", "is_presented_only", "uploaded_at", "uploaded_by_id", "verified_at", "verified_by_id")
SELECT "application_id", "document_type", "status", "file_name", "original_name", "mime_type", "size", "verification_note", "is_presented_only", "uploaded_at", "uploaded_by_id", "verified_at", "verified_by_id" FROM "enrollment_documents";

INSERT INTO "application_checklists" ("enrollment_id", "is_psa_birth_cert_presented", "is_original_psa_bc_collected", "is_sf9_submitted", "is_sf10_requested", "is_good_moral_presented", "is_medical_eval_submitted", "is_cert_of_recognition_presented", "is_undertaking_signed", "is_confirmation_slip_received", "updated_at", "updated_by_id")
SELECT "application_id", "is_psa_birth_cert_presented", "is_original_psa_bc_collected", "is_sf9_submitted", "is_sf10_requested", "is_good_moral_presented", "is_medical_eval_submitted", "is_cert_of_recognition_presented", "is_undertaking_signed", "is_confirmation_slip_received", "updated_at", "updated_by_id" FROM "enrollment_checklists";

-- DropForeignKey
ALTER TABLE "early_registration_addresses" DROP CONSTRAINT "early_registration_addresses_application_id_fkey";
ALTER TABLE "early_registration_documents" DROP CONSTRAINT "early_registration_documents_application_id_fkey";
ALTER TABLE "early_registration_guardians" DROP CONSTRAINT "early_registration_guardians_application_id_fkey";
ALTER TABLE "enrollment_addresses" DROP CONSTRAINT "enrollment_addresses_application_id_fkey";
ALTER TABLE "enrollment_checklists" DROP CONSTRAINT "enrollment_checklists_application_id_fkey";
ALTER TABLE "enrollment_checklists" DROP CONSTRAINT "enrollment_checklists_updated_by_id_fkey";
ALTER TABLE "enrollment_documents" DROP CONSTRAINT "enrollment_documents_application_id_fkey";
ALTER TABLE "enrollment_documents" DROP CONSTRAINT "enrollment_documents_uploaded_by_id_fkey";
ALTER TABLE "enrollment_documents" DROP CONSTRAINT "enrollment_documents_verified_by_id_fkey";
ALTER TABLE "enrollment_family_members" DROP CONSTRAINT "enrollment_family_members_application_id_fkey";

-- DropTable
DROP TABLE "early_registration_addresses";
DROP TABLE "early_registration_documents";
DROP TABLE "early_registration_guardians";
DROP TABLE "enrollment_addresses";
DROP TABLE "enrollment_checklists";
DROP TABLE "enrollment_documents";
DROP TABLE "enrollment_family_members";

-- CreateIndex
CREATE UNIQUE INDEX "application_addresses_early_registration_id_address_type_key" ON "application_addresses"("early_registration_id", "address_type");
CREATE UNIQUE INDEX "application_addresses_enrollment_id_address_type_key" ON "application_addresses"("enrollment_id", "address_type");
CREATE INDEX "idx_early_reg_guardians_app_id" ON "application_family_members"("early_registration_id");
CREATE UNIQUE INDEX "application_family_members_enrollment_id_relationship_key" ON "application_family_members"("enrollment_id", "relationship");
CREATE INDEX "idx_early_reg_docs_app_id" ON "application_documents"("early_registration_id");
CREATE INDEX "idx_enrollment_docs_app_id" ON "application_documents"("enrollment_id");
CREATE UNIQUE INDEX "uq_early_reg_checklist_id" ON "application_checklists"("early_registration_id");
CREATE UNIQUE INDEX "uq_enrollment_checklist_id" ON "application_checklists"("enrollment_id");

-- AddForeignKey
ALTER TABLE "application_addresses" ADD CONSTRAINT "application_addresses_early_registration_id_fkey" FOREIGN KEY ("early_registration_id") REFERENCES "early_registration_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_addresses" ADD CONSTRAINT "application_addresses_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_family_members" ADD CONSTRAINT "application_family_members_early_registration_id_fkey" FOREIGN KEY ("early_registration_id") REFERENCES "early_registration_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_family_members" ADD CONSTRAINT "application_family_members_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_early_registration_id_fkey" FOREIGN KEY ("early_registration_id") REFERENCES "early_registration_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "application_checklists" ADD CONSTRAINT "application_checklists_early_registration_id_fkey" FOREIGN KEY ("early_registration_id") REFERENCES "early_registration_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_checklists" ADD CONSTRAINT "application_checklists_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_checklists" ADD CONSTRAINT "application_checklists_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
