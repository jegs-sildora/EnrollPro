-- CreateEnum
CREATE TYPE "TermFormat" AS ENUM ('QUARTERS', 'TRIMESTERS');

-- CreateEnum
CREATE TYPE "section_adviser_status" AS ENUM ('ACTIVE', 'HANDED_OVER', 'REVOKED');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('SYSTEM_ADMIN', 'HEAD_REGISTRAR', 'CLASS_ADVISER', 'TEACHER', 'LEARNER', 'MRF');

-- CreateEnum
CREATE TYPE "compliance_status" AS ENUM ('PENDING', 'COMPLIED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "primary_contact_type" AS ENUM ('FATHER', 'MOTHER', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'ENROLLED', 'SECTIONED');

-- CreateEnum
CREATE TYPE "reading_profile_level" AS ENUM ('INDEPENDENT', 'INSTRUCTIONAL', 'FRUSTRATION', 'NON_READER');

-- CreateEnum
CREATE TYPE "school_year_status" AS ENUM ('DRAFT', 'UPCOMING', 'ACTIVE', 'ARCHIVED', 'PREPARATION', 'ENROLLMENT_OPEN', 'BOSY_LOCKED', 'EOSY_PROCESSING');

-- CreateEnum
CREATE TYPE "applicant_type" AS ENUM ('REGULAR', 'SCIENCE_TECHNOLOGY_AND_ENGINEERING', 'SPECIAL_PROGRAM_IN_THE_ARTS', 'SPECIAL_PROGRAM_IN_SPORTS', 'SPECIAL_PROGRAM_IN_JOURNALISM', 'SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE', 'SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION', 'LATE_ENROLLEE');

-- CreateEnum
CREATE TYPE "admission_channel" AS ENUM ('ONLINE', 'F2F');

-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('PSA_BIRTH_CERTIFICATE', 'SECONDARY_BIRTH_PROOF', 'SF9_REPORT_CARD', 'SF10_PERMANENT_RECORD', 'GOOD_MORAL_CERTIFICATE', 'MEDICAL_CERTIFICATE', 'CERTIFICATE_OF_RECOGNITION', 'MEDICAL_EVALUATION', 'PEPT_AE_CERTIFICATE', 'PWD_ID', 'PSA_MARRIAGE_CERTIFICATE', 'UNDERTAKING', 'AFFIDAVIT_OF_UNDERTAKING', 'CONFIRMATION_SLIP', 'OTHERS', 'WRITING_PORTFOLIO');

-- CreateEnum
CREATE TYPE "learner_type" AS ENUM ('NEW_ENROLLEE', 'TRANSFEREE', 'RETURNING', 'CONTINUING', 'OSCYA', 'ALS');

-- CreateEnum
CREATE TYPE "assessment_period" AS ENUM ('BOSY', 'EOSY');

-- CreateEnum
CREATE TYPE "address_type" AS ENUM ('CURRENT', 'PERMANENT');

-- CreateEnum
CREATE TYPE "academic_status" AS ENUM ('PROMOTED', 'RETAINED', 'CONDITIONALLY_PROMOTED');

-- CreateEnum
CREATE TYPE "eosy_status" AS ENUM ('PROMOTED', 'CONDITIONALLY_PROMOTED', 'RETAINED', 'DROPPED_OUT', 'TRANSFERRED_OUT');

-- CreateEnum
CREATE TYPE "family_relationship" AS ENUM ('MOTHER', 'FATHER', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "assessment_kind" AS ENUM ('INTERVIEW', 'QUALIFYING_EXAMINATION', 'PRELIMINARY_EXAMINATION', 'FINAL_EXAMINATION', 'GENERAL_ADMISSION_TEST', 'TALENT_AUDITION', 'PHYSICAL_FITNESS_TEST', 'SPORTS_SKILLS_TRYOUT', 'SKILLS_ASSESSMENT', 'STANDARDIZED_ADMISSION_TOOL', 'APTITUDE_TEST', 'INTEREST_INVENTORY');

-- CreateEnum
CREATE TYPE "intake_method" AS ENUM ('BEEF_FULL', 'CONFIRMATION_SLIP');

-- CreateEnum
CREATE TYPE "sectioning_method" AS ENUM ('BATCH_ALGORITHM', 'INLINE_SLOTTING', 'MANUAL_REASSIGNMENT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "learner_status" AS ENUM ('ACTIVE', 'JHS_COMPLETER', 'DROPPED', 'TRANSFERRED_OUT');

-- CreateEnum
CREATE TYPE "enrollment_listing_status" AS ENUM ('LISTED', 'PROCESSED', 'CONFIRMED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "suffix" TEXT,
    "sex" "sex" NOT NULL DEFAULT 'FEMALE',
    "employee_id" VARCHAR(7),
    "designation" TEXT,
    "mobile_number" TEXT,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "account_name" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(7) NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "email" TEXT NOT NULL,
    "contact_number" TEXT,
    "specialization" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "photo_path" TEXT,
    "plantilla_position" TEXT,
    "designation" TEXT,
    "department_id" INTEGER,
    "sex" "sex" NOT NULL DEFAULT 'FEMALE',
    "user_id" INTEGER,
    "service_status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_settings" (
    "id" SERIAL NOT NULL,
    "school_name" TEXT NOT NULL,
    "logo_path" TEXT,
    "logo_url" TEXT,
    "color_scheme" JSONB,
    "selected_accent_hsl" TEXT,
    "active_school_year_id" INTEGER,
    "deped_email" TEXT,
    "facebook_page_url" TEXT,
    "school_website" TEXT,
    "deped_school_id" TEXT,
    "division" TEXT,
    "region" TEXT,
    "school_head_name" TEXT,
    "school_head_title" TEXT,

    CONSTRAINT "school_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_years" (
    "id" SERIAL NOT NULL,
    "year_label" TEXT NOT NULL,
    "status" "school_year_status" NOT NULL DEFAULT 'DRAFT',
    "class_opening_date" DATE,
    "class_end_date" DATE,
    "enroll_open_date" DATE,
    "enroll_close_date" DATE,
    "cloned_from_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_eosy_finalized" BOOLEAN NOT NULL DEFAULT false,
    "section_shift_window_days" INTEGER,
    "sectioning_config" JSONB,
    "bosy_locked_at" TIMESTAMPTZ(6),
    "bosy_locked_by_id" INTEGER,
    "require_reading_assessment_continuing" BOOLEAN NOT NULL DEFAULT false,
    "require_reading_assessment_new" BOOLEAN NOT NULL DEFAULT true,
    "term_format" "TermFormat" NOT NULL DEFAULT 'QUARTERS',
    "term1_end" DATE,
    "term1_start" DATE,
    "term2_end" DATE,
    "term2_start" DATE,
    "term3_end" DATE,
    "term3_start" DATE,
    "term4_end" DATE,
    "term4_start" DATE,

    CONSTRAINT "school_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_levels" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grade_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "max_capacity" INTEGER NOT NULL DEFAULT 40,
    "grade_level_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "program_type" "applicant_type" NOT NULL DEFAULT 'REGULAR',
    "is_eosy_finalized" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 9999,
    "is_homogeneous" BOOLEAN NOT NULL DEFAULT false,
    "is_snake" BOOLEAN NOT NULL DEFAULT false,
    "school_year_id" INTEGER NOT NULL,
    "section_rank" INTEGER,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_advisers" (
    "id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "section_adviser_status" NOT NULL DEFAULT 'ACTIVE',
    "handover_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "section_advisers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learners" (
    "id" SERIAL NOT NULL,
    "lrn" VARCHAR(12),
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "extension_name" TEXT,
    "birthdate" DATE NOT NULL,
    "sex" "sex" NOT NULL,
    "place_of_birth" TEXT,
    "religion" TEXT,
    "mother_tongue" TEXT,
    "is_ip_community" BOOLEAN NOT NULL DEFAULT false,
    "ip_group_name" TEXT,
    "is_learner_with_disability" BOOLEAN NOT NULL DEFAULT false,
    "disability_types" TEXT[],
    "is_4ps_beneficiary" BOOLEAN NOT NULL DEFAULT false,
    "household_id_4ps" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "has_pwd_id" BOOLEAN NOT NULL DEFAULT false,
    "is_balik_aral" BOOLEAN NOT NULL DEFAULT false,
    "last_grade_level" TEXT,
    "last_year_enrolled" TEXT,
    "psa_birth_cert_number" TEXT,
    "special_needs_category" TEXT,
    "is_pending_lrn_creation" BOOLEAN NOT NULL DEFAULT false,
    "external_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_photo" TEXT,
    "sned_placement" TEXT,
    "previous_gen_ave" DOUBLE PRECISION,
    "promotion_status" TEXT,
    "birth_certificate_type" TEXT,
    "birth_certificate_verified_by" TEXT,
    "birth_certificate_verified_date" TIMESTAMPTZ(6),
    "has_psa_birth_certificate" BOOLEAN NOT NULL DEFAULT false,
    "status" "learner_status" NOT NULL DEFAULT 'ACTIVE',
    "user_id" INTEGER,

    CONSTRAINT "learners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_applications" (
    "id" SERIAL NOT NULL,
    "learner_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "grade_level_id" INTEGER NOT NULL,
    "applicant_type" "applicant_type" NOT NULL DEFAULT 'REGULAR',
    "learner_type" "learner_type" NOT NULL DEFAULT 'NEW_ENROLLEE',
    "admission_channel" "admission_channel" NOT NULL DEFAULT 'ONLINE',
    "tracking_number" TEXT,
    "learning_modalities" TEXT[],
    "is_temporarily_enrolled" BOOLEAN NOT NULL DEFAULT false,
    "documentary_deadline_at" DATE,
    "compliance_status" "compliance_status",
    "rejection_reason" TEXT,
    "is_privacy_consent_given" BOOLEAN NOT NULL DEFAULT false,
    "portal_pin" TEXT,
    "portal_pin_changed_at" TIMESTAMPTZ(6),
    "encoded_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "guardian_relationship" TEXT,
    "has_no_father" BOOLEAN NOT NULL DEFAULT false,
    "has_no_mother" BOOLEAN NOT NULL DEFAULT false,
    "is_profile_locked" BOOLEAN NOT NULL DEFAULT false,
    "profile_locked_at" TIMESTAMPTZ(6),
    "profile_locked_by_id" INTEGER,
    "reading_profile_level" "reading_profile_level",
    "reading_profile_notes" TEXT,
    "reading_profile_assessed_at" TIMESTAMPTZ(6),
    "reading_profile_assessed_by_id" INTEGER,
    "batch_intake_method" TEXT,
    "confirmation_consent" BOOLEAN,
    "contact_number" TEXT,
    "guardian_name" TEXT,
    "has_sf9_certification_letter" BOOLEAN NOT NULL DEFAULT false,
    "has_unsettled_private_account" BOOLEAN NOT NULL DEFAULT false,
    "intake_method" "intake_method" NOT NULL DEFAULT 'BEEF_FULL',
    "is_missing_sf9" BOOLEAN NOT NULL DEFAULT false,
    "originating_school_name" TEXT,
    "temporary_status_deadline" DATE,
    "reported_grades" JSONB,
    "intake_height_cm" DOUBLE PRECISION,
    "intake_weight_kg" DOUBLE PRECISION,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',

    CONSTRAINT "enrollment_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_previous_schools" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "school_name" TEXT,
    "school_deped_id" TEXT,
    "grade_completed" TEXT,
    "school_year_attended" TEXT,
    "school_address" TEXT,
    "school_type" TEXT,
    "nat_score" DOUBLE PRECISION,
    "general_average" DOUBLE PRECISION,

    CONSTRAINT "enrollment_previous_schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_addresses" (
    "id" SERIAL NOT NULL,
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
    "enrollment_id" INTEGER,
    "relationship" "family_relationship" NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "contact_number" TEXT,
    "email" TEXT,
    "occupation" TEXT,
    "maiden_name" TEXT,

    CONSTRAINT "application_family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_checklists" (
    "id" SERIAL NOT NULL,
    "enrollment_id" INTEGER,
    "is_psa_birth_cert_presented" BOOLEAN NOT NULL DEFAULT false,
    "is_original_psa_bc_collected" BOOLEAN NOT NULL DEFAULT false,
    "is_sf9_submitted" BOOLEAN NOT NULL DEFAULT false,
    "is_good_moral_presented" BOOLEAN NOT NULL DEFAULT false,
    "is_medical_eval_submitted" BOOLEAN NOT NULL DEFAULT false,
    "is_cert_of_recognition_presented" BOOLEAN NOT NULL DEFAULT false,
    "is_undertaking_signed" BOOLEAN NOT NULL DEFAULT false,
    "is_confirmation_slip_received" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by_id" INTEGER,
    "academic_status" "academic_status" NOT NULL DEFAULT 'PROMOTED',
    "is_secondary_birth_doc_presented" BOOLEAN NOT NULL DEFAULT false,
    "is_remedial_required" BOOLEAN NOT NULL DEFAULT false,
    "is_sf10_requested" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "application_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_records" (
    "id" SERIAL NOT NULL,
    "enrollment_application_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enrolled_by_id" INTEGER NOT NULL,
    "drop_out_reason" TEXT,
    "eosy_status" "eosy_status",
    "transfer_out_date" DATE,
    "drop_out_date" DATE,
    "transfer_out_school_name" TEXT,
    "transfer_out_reason" TEXT,
    "confirmation_consent" BOOLEAN,
    "contact_number" TEXT,
    "date_sectioned" TIMESTAMPTZ(6),
    "enrollment_record_intake_method" TEXT,
    "guardian_name" TEXT,
    "sectioning_method" "sectioning_method" NOT NULL DEFAULT 'BATCH_ALGORITHM',
    "sf1_remarks" TEXT,
    "final_average" DOUBLE PRECISION,
    "learner_id" INTEGER NOT NULL,

    CONSTRAINT "enrollment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "head_id" INTEGER,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "subject_type" TEXT,
    "record_id" INTEGER,
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "new_value" TEXT,
    "old_value" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_records" (
    "id" SERIAL NOT NULL,
    "learner_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "assessment_period" "assessment_period" NOT NULL,
    "assessment_date" DATE NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "height_cm" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "recorded_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "health_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_designations" (
    "id" SERIAL NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "school_year_id" INTEGER NOT NULL,
    "is_class_adviser" BOOLEAN NOT NULL DEFAULT false,
    "designation_notes" TEXT,
    "effective_from" DATE,
    "effective_to" DATE,
    "update_reason" TEXT,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "advisory_section_id" INTEGER,
    "ancillary_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_teaching_exempt" BOOLEAN NOT NULL DEFAULT false,
    "is_tic" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "teacher_designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_listings" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "grade_level" TEXT NOT NULL,
    "date_collected" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "enrollment_listing_status" NOT NULL DEFAULT 'LISTED',
    "school_year_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "confirmation_slip_received" BOOLEAN NOT NULL DEFAULT false,
    "height_cm" DOUBLE PRECISION,
    "learner_type" "learner_type",
    "lrn" TEXT,
    "middle_name" TEXT,
    "reading_level" "reading_profile_level",
    "weight_kg" DOUBLE PRECISION,

    CONSTRAINT "enrollment_listings_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "uq_users_employee_id" ON "users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_email" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_account_name" ON "users"("account_name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teachers_employee_id" ON "teachers"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teachers_email" ON "teachers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teachers_user_id" ON "teachers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_school_years_year_label" ON "school_years"("year_label");

-- CreateIndex
CREATE UNIQUE INDEX "uq_grade_levels_name" ON "grade_levels"("name");

-- CreateIndex
CREATE INDEX "idx_sections_grade_level_id" ON "sections"("grade_level_id");

-- CreateIndex
CREATE INDEX "idx_sections_school_year_id" ON "sections"("school_year_id");

-- CreateIndex
CREATE INDEX "idx_sections_grade_level_program_type" ON "sections"("grade_level_id", "program_type");

-- CreateIndex
CREATE UNIQUE INDEX "sections_name_grade_level_id_school_year_id_key" ON "sections"("name", "grade_level_id", "school_year_id");

-- CreateIndex
CREATE INDEX "idx_section_advisers_section_id" ON "section_advisers"("section_id");

-- CreateIndex
CREATE INDEX "idx_section_advisers_teacher_id" ON "section_advisers"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_learners_lrn" ON "learners"("lrn");

-- CreateIndex
CREATE UNIQUE INDEX "uq_learners_external_id" ON "learners"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_learners_user_id" ON "learners"("user_id");

-- CreateIndex
CREATE INDEX "idx_learners_dedup" ON "learners"("last_name", "first_name", "birthdate");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollment_tracking_number" ON "enrollment_applications"("tracking_number");

-- CreateIndex
CREATE INDEX "idx_enrollment_apps_status_sy" ON "enrollment_applications"("status", "school_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollment_prev_school_app_id" ON "enrollment_previous_schools"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_addresses_enrollment_id_address_type_key" ON "application_addresses"("enrollment_id", "address_type");

-- CreateIndex
CREATE UNIQUE INDEX "application_family_members_enrollment_id_relationship_key" ON "application_family_members"("enrollment_id", "relationship");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollment_checklist_id" ON "application_checklists"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enroll_record_app_id" ON "enrollment_records"("enrollment_application_id");

-- CreateIndex
CREATE INDEX "idx_enroll_records_section_id" ON "enrollment_records"("section_id");

-- CreateIndex
CREATE INDEX "idx_enrollment_records_learner_id" ON "enrollment_records"("learner_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_departments_code" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_departments_head_id" ON "departments"("head_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_action_type" ON "audit_logs"("action_type");

-- CreateIndex
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_health_records_learner_id" ON "health_records"("learner_id");

-- CreateIndex
CREATE UNIQUE INDEX "health_records_learner_id_school_year_id_assessment_period_key" ON "health_records"("learner_id", "school_year_id", "assessment_period");

-- CreateIndex
CREATE INDEX "idx_teacher_designations_school_year_id" ON "teacher_designations"("school_year_id");

-- CreateIndex
CREATE INDEX "idx_teacher_designations_advisory_section_id" ON "teacher_designations"("advisory_section_id");

-- CreateIndex
CREATE INDEX "idx_teacher_designations_updated_by_id" ON "teacher_designations"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_designations_teacher_id_school_year_id_key" ON "teacher_designations"("teacher_id", "school_year_id");

-- CreateIndex
CREATE INDEX "idx_enrollment_listings_sy" ON "enrollment_listings"("school_year_id");

-- CreateIndex
CREATE INDEX "idx_enrollment_listings_created_by" ON "enrollment_listings"("created_by_id");

-- CreateIndex
CREATE INDEX "idx_provinces_region_code" ON "provinces"("region_code");

-- CreateIndex
CREATE INDEX "idx_cities_municipalities_province_code" ON "cities_municipalities"("province_code");

-- CreateIndex
CREATE INDEX "idx_barangays_city_municipality_code" ON "barangays"("city_municipality_code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_settings" ADD CONSTRAINT "school_settings_active_school_year_id_fkey" FOREIGN KEY ("active_school_year_id") REFERENCES "school_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_years" ADD CONSTRAINT "school_years_bosy_locked_by_id_fkey" FOREIGN KEY ("bosy_locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_years" ADD CONSTRAINT "school_years_cloned_from_id_fkey" FOREIGN KEY ("cloned_from_id") REFERENCES "school_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_grade_level_id_fkey" FOREIGN KEY ("grade_level_id") REFERENCES "grade_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learners" ADD CONSTRAINT "learners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_applications" ADD CONSTRAINT "enrollment_applications_encoded_by_id_fkey" FOREIGN KEY ("encoded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_applications" ADD CONSTRAINT "enrollment_applications_grade_level_id_fkey" FOREIGN KEY ("grade_level_id") REFERENCES "grade_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_applications" ADD CONSTRAINT "enrollment_applications_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_applications" ADD CONSTRAINT "enrollment_applications_profile_locked_by_id_fkey" FOREIGN KEY ("profile_locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_applications" ADD CONSTRAINT "enrollment_applications_reading_profile_assessed_by_id_fkey" FOREIGN KEY ("reading_profile_assessed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_applications" ADD CONSTRAINT "enrollment_applications_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_previous_schools" ADD CONSTRAINT "enrollment_previous_schools_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "enrollment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_addresses" ADD CONSTRAINT "application_addresses_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_family_members" ADD CONSTRAINT "application_family_members_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_checklists" ADD CONSTRAINT "application_checklists_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_checklists" ADD CONSTRAINT "application_checklists_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_records" ADD CONSTRAINT "enrollment_records_enrolled_by_id_fkey" FOREIGN KEY ("enrolled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_records" ADD CONSTRAINT "enrollment_records_enrollment_application_id_fkey" FOREIGN KEY ("enrollment_application_id") REFERENCES "enrollment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_records" ADD CONSTRAINT "enrollment_records_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_records" ADD CONSTRAINT "enrollment_records_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_records" ADD CONSTRAINT "enrollment_records_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_id_fkey" FOREIGN KEY ("head_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_designations" ADD CONSTRAINT "teacher_designations_advisory_section_id_fkey" FOREIGN KEY ("advisory_section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_designations" ADD CONSTRAINT "teacher_designations_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_designations" ADD CONSTRAINT "teacher_designations_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_designations" ADD CONSTRAINT "teacher_designations_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_listings" ADD CONSTRAINT "enrollment_listings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_listings" ADD CONSTRAINT "enrollment_listings_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities_municipalities" ADD CONSTRAINT "cities_municipalities_province_code_fkey" FOREIGN KEY ("province_code") REFERENCES "provinces"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barangays" ADD CONSTRAINT "barangays_city_municipality_code_fkey" FOREIGN KEY ("city_municipality_code") REFERENCES "cities_municipalities"("code") ON DELETE CASCADE ON UPDATE CASCADE;
