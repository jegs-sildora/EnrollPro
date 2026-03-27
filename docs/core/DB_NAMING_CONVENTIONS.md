# Database Naming Conventions
## School Admission, Enrollment & Information Management System

**Document Version:** 1.0.0
**Role:** Professional Database Administrator Reference
**Database:** PostgreSQL 18
**ORM:** Prisma 6
**Schema File:** `server/prisma/schema.prisma`
**Audit Date:** SY 2026–2027

---

## Table of Contents

1. [Core Philosophy](#1-core-philosophy)
2. [Current Schema Audit — Issues Found](#2-current-schema-audit--issues-found)
3. [Table Naming](#3-table-naming)
4. [Column Naming](#4-column-naming)
5. [Primary Keys](#5-primary-keys)
6. [Foreign Keys](#6-foreign-keys)
7. [Boolean Columns](#7-boolean-columns)
8. [Timestamp Columns](#8-timestamp-columns)
9. [Array Columns](#9-array-columns)
10. [JSON Columns](#10-json-columns)
11. [Enum Types](#11-enum-types)
12. [Index Naming](#12-index-naming)
13. [Constraint Naming](#13-constraint-naming)
14. [Abbreviation Rules](#14-abbreviation-rules)
15. [Relation Name Conventions (Prisma)](#15-relation-name-conventions-prisma)
16. [Prisma `@@map` and `@map` Directives](#16-prisma-map-and-map-directives)
17. [Corrected Schema Reference](#17-corrected-schema-reference)
18. [Quick Reference Card](#18-quick-reference-card)

---

## 1. Core Philosophy

A database schema outlives the application code that uses it. Reports, scripts, LIS integrations, and audit queries will hit these tables directly — often written by people who did not build the original system. The naming conventions in this document are designed around one principle:

> **A column name should tell you what it contains and what type it is without reading the code.**

Five rules that flow from this principle:

1. **PostgreSQL is snake_case.** Table names and column names are always `lower_snake_case`. PostgreSQL folds unquoted identifiers to lowercase — fighting this with PascalCase or camelCase requires quoting everywhere.

2. **Prisma is camelCase.** The Prisma schema uses `camelCase` field names per its own convention. The Prisma `@@map` and `@map` directives bridge the two worlds — Prisma stays camelCase in TypeScript, PostgreSQL stays snake_case on disk.

3. **No abbreviations unless universal.** `id`, `url`, `ip`, `lrn` are universally understood in this domain. `sned`, `pept`, `spfl` require domain knowledge and should be spelled out or documented.

4. **Boolean columns answer a yes/no question.** `is_active`, `has_pwd_id`, `must_change_password` are readable as questions. `active`, `password_must_change` are not.

5. **Timestamps are past-tense verbs.** `created_at`, `enrolled_at`, `verified_at`. Not `create_time`, not `enrollment_date`, not `whenCreated`.

---

## 2. Current Schema Audit — Issues Found

The following issues were identified in the current `schema.prisma` file. Each is addressed by the rules in subsequent sections.

### Issue 1 — No `@@map` Directives (Critical)

**Current state:** No `@@map` or `@map` directives exist in the schema. Prisma uses model names as table names directly — meaning PostgreSQL tables are named `User`, `SchoolYear`, `GradeLevel`, `Applicant`, etc. — all PascalCase.

**Problem:** PostgreSQL is case-insensitive for unquoted identifiers. Prisma generates quoted SQL (`"User"`, `"SchoolYear"`) to preserve casing. This forces every raw SQL query, migration script, and pg_dump output to use quoted identifiers — which is non-standard and error-prone.

**Fix:** Add `@@map("table_name")` to every model and `@map("column_name")` to every non-standard field.

---

### Issue 2 — Inconsistent Foreign Key Field Naming

| Field | Model | Issue |
|---|---|---|
| `activeSchoolYearId` | `SchoolSettings` | Qualifier prefix `active` — should follow the pattern `{relation_name}_id` |
| `schoolYearId` | `GradeLevel`, `Strand`, `Enrollment`, `ScpConfig` | Correct pattern — referencing the `school_year` table |
| `advisingTeacherId` | `Section` | Qualifier prefix `advising` — acceptable for disambiguation (see §6) |
| `encodedById` | `Applicant` | Qualifier `encodedBy` — acceptable disambiguation |
| `enrolledById` | `Enrollment` | Qualifier `enrolledBy` — acceptable disambiguation |
| `verifiedById` | `Document` | Qualifier `verifiedBy` — acceptable disambiguation |
| `createdById` | `User` | Qualifier `createdBy` — acceptable disambiguation |

---

### Issue 3 — Boolean Field Prefix Inconsistency

| Field | Model | Issue |
|---|---|---|
| `scpApplication` | `Applicant` | Missing `is_` prefix — unclear it is a boolean |
| `manualOverrideOpen` | `SchoolYear` | Missing `is_` prefix |
| `privacyConsentGiven` | `Applicant` | Inconsistent pattern — should be `is_privacy_consent_given` or `privacy_consent_given` |
| `hasPwdId` | `Applicant` | Uses `has_` prefix — inconsistent with other booleans using `is_` |
| `mustChangePassword` | `User` | No prefix — acceptable exception (natural English phrase) |

---

### Issue 4 — Abbreviation Inconsistency

| Field | Model | Abbreviation Used | Problem |
|---|---|---|---|
| `syLastAttended` | `Applicant` | `sy` = school year | Non-obvious; should be `school_year_last_attended` |
| `snedCategory` | `Applicant` | `sned` = Special Needs Education | Non-obvious; should be `special_needs_category` |
| `hasPwdId` | `Applicant` | `pwd` = Person With Disability | Acceptable in DepEd domain — document it |
| `natScore` | `Applicant` | `nat` = National Achievement Test | Acceptable — document it |
| `spaArtField` | `Applicant` | `spa` = SCP program code as prefix | Program code prefix on a column name is wrong — should be `art_field` |
| `spsSports` | `Applicant` | `sps` = SCP program code as prefix | Should be `sports_list` or `sports` |
| `spflLanguage` | `Applicant` | `spfl` = SCP program code as prefix | Should be `foreign_language` |
| `psaBcNumber` | `Applicant` | Mixed: `psa` (full abbrev) + `bc` (abbrev) | Should be `psa_birth_cert_number` |

---

### Issue 5 — RequirementChecklist Field Pattern

All boolean fields in `RequirementChecklist` use a `{thing}Status` suffix — but `Status` implies a string or enum, not a boolean. Examples:

```
psaBirthCertStatus   Boolean  ← "Status" suffix on a Boolean is misleading
sf9ReportCardStatus  Boolean  ← Same issue
goodMoralStatus      Boolean  ← Same issue
```

These should either use `is_` prefix or a clear verb suffix (`_submitted`, `_verified`, `_presented`).

---

### Issue 6 — `subjectId` in AuditLog

`AuditLog.subjectId` is a polymorphic reference — it could point to any table depending on `subjectType`. There is no FK constraint. The column name implies a FK but it is not one. This should be documented and possibly renamed to `record_id` to make its polymorphic nature explicit.

---

### Issue 7 — Relation Name `"AYClone"` Uses Abbreviation

The Prisma relation name `"AYClone"` on `SchoolYear` uses `AY` as an abbreviation for Academic Year — but the model is called `SchoolYear`. This is internally inconsistent. Should be `"SchoolYearClone"`.

---

### Issue 8 — Missing Explicit Index Names

All `@@index` and `@@unique` declarations have no explicit names:

```prisma
@@index([status, schoolYearId])   // auto-named by Prisma — unpredictable
@@index([lrn])                    // auto-named
```

Prisma generates names like `Applicant_status_schoolYearId_idx` — mixing PascalCase with camelCase, and these names change if columns are reordered or renamed. Every index should have an explicit name.

---

## 3. Table Naming

### Rule

Tables are named in `lower_snake_case`, **plural**. Every Prisma model must have a `@@map` directive.

### Rationale

- PostgreSQL convention is snake_case
- Plural table names are standard SQL convention — a table is a collection
- The plural form reads naturally in queries: `SELECT * FROM applicants WHERE ...`

### Pattern

```
Prisma Model Name (PascalCase) → PostgreSQL Table Name (snake_case plural)
```

### Table Name Reference

| Prisma Model | PostgreSQL Table | Notes |
|---|---|---|
| `User` | `users` | |
| `Teacher` | `teachers` | |
| `SchoolSettings` | `school_settings` | |
| `SchoolYear` | `school_years` | NOT `academic_years` — model name is `SchoolYear` |
| `GradeLevel` | `grade_levels` | |
| `Strand` | `strands` | |
| `Section` | `sections` | |
| `Applicant` | `applicants` | |
| `Document` | `documents` | |
| `RequirementChecklist` | `requirement_checklists` | |
| `Enrollment` | `enrollments` | |
| `AuditLog` | `audit_logs` | |
| `EmailLog` | `email_logs` | |
| `ScpConfig` | `scp_configs` | |

### Prisma Implementation

```prisma
model SchoolYear {
  // ... fields
  @@map("school_years")
}

model GradeLevel {
  // ... fields
  @@map("grade_levels")
}
```

---

## 4. Column Naming

### Rule

All column names are `lower_snake_case`. Every Prisma field that deviates from Prisma's auto-mapping must have a `@map` directive.

### Pattern

```
Prisma Field (camelCase) → PostgreSQL Column (snake_case)
```

Prisma's auto-mapping converts `camelCase` to `camelCase` in the DB (not snake_case) unless `@map` is used. The `@map` directive is required for every field.

### Column Name Reference (Selected Fields)

| Prisma Field | PostgreSQL Column | Model |
|---|---|---|
| `isActive` | `is_active` | `User`, `Teacher`, `SchoolYear` |
| `lastLoginAt` | `last_login_at` | `User` |
| `mustChangePassword` | `must_change_password` | `User` |
| `createdById` | `created_by_id` | `User` |
| `schoolYearId` | `school_year_id` | Multiple models |
| `activeSchoolYearId` | `active_school_year_id` | `SchoolSettings` |
| `colorScheme` | `color_scheme` | `SchoolSettings` |
| `selectedAccentHsl` | `selected_accent_hsl` | `SchoolSettings` |
| `yearLabel` | `year_label` | `SchoolYear` |
| `classOpeningDate` | `class_opening_date` | `SchoolYear` |
| `classEndDate` | `class_end_date` | `SchoolYear` |
| `earlyRegOpenDate` | `early_reg_open_date` | `SchoolYear` |
| `earlyRegCloseDate` | `early_reg_close_date` | `SchoolYear` |
| `enrollOpenDate` | `enroll_open_date` | `SchoolYear` |
| `enrollCloseDate` | `enroll_close_date` | `SchoolYear` |
| `manualOverrideOpen` | `is_manual_override_open` | `SchoolYear` |
| `clonedFromId` | `cloned_from_id` | `SchoolYear` |
| `displayOrder` | `display_order` | `GradeLevel` |
| `gradeLevelId` | `grade_level_id` | `Section`, `Applicant` |
| `maxCapacity` | `max_capacity` | `Section` |
| `advisingTeacherId` | `advising_teacher_id` | `Section` |
| `psaBcNumber` | `psa_birth_cert_number` | `Applicant` |
| `birthDate` | `birth_date` | `Applicant` |
| `placeOfBirth` | `place_of_birth` | `Applicant` |
| `motherTongue` | `mother_tongue` | `Applicant` |
| `currentAddress` | `current_address` | `Applicant` |
| `permanentAddress` | `permanent_address` | `Applicant` |
| `motherName` | `mother_name` | `Applicant` |
| `fatherName` | `father_name` | `Applicant` |
| `guardianInfo` | `guardian_info` | `Applicant` |
| `emailAddress` | `email_address` | `Applicant` |
| `isIpCommunity` | `is_ip_community` | `Applicant` |
| `ipGroupName` | `ip_group_name` | `Applicant` |
| `is4PsBeneficiary` | `is_4ps_beneficiary` | `Applicant` |
| `householdId4Ps` | `household_id_4ps` | `Applicant` |
| `isBalikAral` | `is_balik_aral` | `Applicant` |
| `lastYearEnrolled` | `last_year_enrolled` | `Applicant` |
| `isLearnerWithDisability` | `is_learner_with_disability` | `Applicant` |
| `disabilityType` | `disability_types` | `Applicant` — plural (array) |
| `lastSchoolName` | `last_school_name` | `Applicant` |
| `lastSchoolId` | `last_school_id` | `Applicant` |
| `lastGradeCompleted` | `last_grade_completed` | `Applicant` |
| `syLastAttended` | `school_year_last_attended` | `Applicant` — abbreviation expanded |
| `lastSchoolAddress` | `last_school_address` | `Applicant` |
| `lastSchoolType` | `last_school_type` | `Applicant` |
| `learnerType` | `learner_type` | `Applicant` |
| `electiveCluster` | `elective_cluster` | `Applicant` |
| `scpApplication` | `is_scp_application` | `Applicant` — boolean prefix added |
| `scpType` | `scp_type` | `Applicant` |
| `spaArtField` | `art_field` | `Applicant` — SCP prefix removed |
| `spsSports` | `sports_list` | `Applicant` — SCP prefix removed |
| `spflLanguage` | `foreign_language` | `Applicant` — SCP prefix removed |
| `trackingNumber` | `tracking_number` | `Applicant` |
| `rejectionReason` | `rejection_reason` | `Applicant` |
| `strandId` | `strand_id` | `Applicant` |
| `schoolYearId` | `school_year_id` | `Applicant` |
| `applicantType` | `applicant_type` | `Applicant` |
| `shsTrack` | `shs_track` | `Applicant` |
| `examDate` | `exam_date` | `Applicant` |
| `examVenue` | `exam_venue` | `Applicant` |
| `examScore` | `exam_score` | `Applicant` |
| `examResult` | `exam_result` | `Applicant` |
| `examNotes` | `exam_notes` | `Applicant` |
| `assessmentType` | `assessment_type` | `Applicant` |
| `interviewDate` | `interview_date` | `Applicant` |
| `interviewResult` | `interview_result` | `Applicant` |
| `interviewNotes` | `interview_notes` | `Applicant` |
| `auditionResult` | `audition_result` | `Applicant` |
| `tryoutResult` | `tryout_result` | `Applicant` |
| `natScore` | `nat_score` | `Applicant` |
| `grade10ScienceGrade` | `grade10_science_grade` | `Applicant` |
| `grade10MathGrade` | `grade10_math_grade` | `Applicant` |
| `generalAverage` | `general_average` | `Applicant` |
| `privacyConsentGiven` | `is_privacy_consent_given` | `Applicant` — boolean prefix added |
| `admissionChannel` | `admission_channel` | `Applicant` |
| `encodedById` | `encoded_by_id` | `Applicant` |
| `snedCategory` | `special_needs_category` | `Applicant` — abbreviation expanded |
| `hasPwdId` | `has_pwd_id` | `Applicant` — `has_` prefix acceptable |
| `learningModalities` | `learning_modalities` | `Applicant` |
| `isTemporarilyEnrolled` | `is_temporarily_enrolled` | `Applicant` |
| `documentType` | `document_type` | `Document` |
| `fileName` | `file_name` | `Document` |
| `originalName` | `original_name` | `Document` |
| `mimeType` | `mime_type` | `Document` |
| `verificationNote` | `verification_note` | `Document` |
| `isPresentedOnly` | `is_presented_only` | `Document` |
| `uploadedAt` | `uploaded_at` | `Document` |
| `verifiedAt` | `verified_at` | `Document` |
| `verifiedById` | `verified_by_id` | `Document` |
| `actionType` | `action_type` | `AuditLog` |
| `subjectType` | `subject_type` | `AuditLog` |
| `subjectId` | `record_id` | `AuditLog` — renamed to clarify it is polymorphic |
| `ipAddress` | `ip_address` | `AuditLog` |
| `userAgent` | `user_agent` | `AuditLog` |
| `errorMessage` | `error_message` | `EmailLog` |
| `attemptedAt` | `attempted_at` | `EmailLog` |
| `sentAt` | `sent_at` | `EmailLog` |
| `isOffered` | `is_offered` | `ScpConfig` |
| `cutoffScore` | `cutoff_score` | `ScpConfig` |
| `examDate` | `exam_date` | `ScpConfig` |
| `artFields` | `art_fields` | `ScpConfig` |
| `sportsList` | `sports_list` | `ScpConfig` |
| `scpType` | `scp_type` | `ScpConfig` |
| `schoolYearId` | `school_year_id` | `ScpConfig` |

---

## 5. Primary Keys

### Rule

All primary keys are named `id`, type `integer` (auto-increment via `GENERATED ALWAYS AS IDENTITY` in PostgreSQL, or `@id @default(autoincrement())` in Prisma).

### Pattern

```sql
id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

```prisma
id Int @id @default(autoincrement())
```

### Rationale

- Consistent across all 14 tables — no guessing required
- Joins are always `table_a.id = table_b.{table_a_singular}_id`
- Never use business keys (LRN, tracking number, employee ID) as primary keys — these can change, be reassigned, or be null

### What We Have ✅

All 14 models in this schema correctly use `id Int @id @default(autoincrement())`. No changes needed.

---

## 6. Foreign Keys

### Standard Pattern

Foreign key columns are named `{referenced_table_singular}_id`.

```
users.id            ← referenced by →  applicants.user_id
school_years.id     ← referenced by →  grade_levels.school_year_id
grade_levels.id     ← referenced by →  applicants.grade_level_id
sections.id         ← referenced by →  enrollments.section_id
```

### Qualified FK Pattern (Multiple FKs to the Same Table)

When a table has multiple FK columns pointing to the same referenced table, a qualifier prefix is added to distinguish them:

```
users.id  ← referenced by →  applicants.encoded_by_id      (who entered the application)
users.id  ← referenced by →  enrollments.enrolled_by_id    (who approved the enrollment)
users.id  ← referenced by →  users.created_by_id           (who created this account)
users.id  ← referenced by →  documents.verified_by_id      (who verified the document)
```

The qualifier answers the question: **in what capacity did this user interact with this record?**

### Special Cases in This Schema

| Current Prisma Field | PostgreSQL Column | Pattern Used | Explanation |
|---|---|---|---|
| `activeSchoolYearId` | `active_school_year_id` | Qualifier `active_` | OK — `SchoolSettings` could theoretically have multiple `school_year_id` FKs |
| `advisingTeacherId` | `advising_teacher_id` | Qualifier `advising_` | OK — `Section` disambiguates from future `teaching_teacher_id` etc. |
| `clonedFromId` | `cloned_from_id` | Qualifier `cloned_from_` | Self-referential — must use qualifier |
| `encodedById` | `encoded_by_id` | Qualifier `encoded_by_` | Multiple `users` FK on `applicants` |
| `enrolledById` | `enrolled_by_id` | Qualifier `enrolled_by_` | Multiple `users` FK on `enrollments` |
| `verifiedById` | `verified_by_id` | Qualifier `verified_by_` | Single but role-specific |
| `createdById` | `created_by_id` | Qualifier `created_by_` | Self-referential on `users` |

### Foreign Key Constraint Naming

Explicit constraint names follow this pattern:

```
fk_{child_table}_{parent_table}
fk_{child_table}_{qualifier}_{parent_table}   ← when qualified
```

Examples:

```sql
CONSTRAINT fk_applicants_school_years
  FOREIGN KEY (school_year_id) REFERENCES school_years(id)

CONSTRAINT fk_applicants_grade_levels
  FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id)

CONSTRAINT fk_applicants_encoded_by_users
  FOREIGN KEY (encoded_by_id) REFERENCES users(id)

CONSTRAINT fk_sections_advising_teachers
  FOREIGN KEY (advising_teacher_id) REFERENCES teachers(id)

CONSTRAINT fk_enrollments_enrolled_by_users
  FOREIGN KEY (enrolled_by_id) REFERENCES users(id)
```

---

## 7. Boolean Columns

### Rules

**Rule 7.1 — Use `is_` prefix for state and classification booleans:**
```
is_active          ← current state
is_ip_community    ← classification
is_4ps_beneficiary ← classification
is_balik_aral      ← classification
is_scp_application ← classification flag
is_privacy_consent_given
is_temporarily_enrolled
is_presented_only  ← Document model
is_offered         ← ScpConfig model
is_manual_override_open
```

**Rule 7.2 — Use `has_` prefix when the subject possesses something:**
```
has_pwd_id         ← learner possesses a PWD ID card
```

**Rule 7.3 — Natural English phrases are acceptable exceptions to the prefix rule:**
```
must_change_password   ← reads naturally — no prefix needed
```

**Rule 7.4 — Boolean columns must NOT use a `_status` suffix:**
`_status` implies a string enum or multi-value state. A boolean is either true or false. Use clear suffixes instead:

| Wrong ❌ | Right ✅ | Meaning |
|---|---|---|
| `psa_birth_cert_status` | `is_psa_birth_cert_presented` | Was the PSA BC shown during Phase 1? |
| `psa_bc_on_file` | `is_psa_bc_on_file` | Is the PSA BC already permanently filed? |
| `original_psa_bc_collected` | `is_original_psa_bc_collected` | Was the original physically collected in Phase 2? |
| `sf9_report_card_status` | `is_sf9_submitted` | Was the SF9 submitted? |
| `sf10_permanent_status` | `is_sf10_requested` | Was the SF10 transfer initiated? |
| `good_moral_status` | `is_good_moral_presented` | Was a Good Moral cert presented (despite not being required)? |
| `pept_ae_certificate_status` | `is_pept_ae_submitted` | Was the PEPT/AE certificate submitted? |
| `pwd_id_status` | `is_pwd_id_presented` | Was the PWD ID presented? |
| `medical_evaluation_status` | `is_medical_eval_submitted` | Was the medical evaluation submitted? |
| `undertaking_status` | `is_undertaking_signed` | Was the Affidavit of Undertaking signed? |
| `confirmation_slip_status` | `is_confirmation_slip_received` | Was the Confirmation Slip received? |

### Complete Boolean Field Reference

| Model | Correct Column Name | Type | Meaning |
|---|---|---|---|
| `users` | `is_active` | `BOOLEAN` | Account is active |
| `users` | `must_change_password` | `BOOLEAN` | First-login password change required |
| `teachers` | `is_active` | `BOOLEAN` | Teacher record is active |
| `school_years` | `is_active` | `BOOLEAN` | This is the currently active school year |
| `school_years` | `is_manual_override_open` | `BOOLEAN` | Gate manually overridden by admin |
| `applicants` | `is_ip_community` | `BOOLEAN` | Learner belongs to an IP community |
| `applicants` | `is_4ps_beneficiary` | `BOOLEAN` | Learner is a 4Ps beneficiary |
| `applicants` | `is_balik_aral` | `BOOLEAN` | Learner is a Balik-Aral returning student |
| `applicants` | `is_learner_with_disability` | `BOOLEAN` | Learner has a disability |
| `applicants` | `is_scp_application` | `BOOLEAN` | Applicant is applying for an SCP |
| `applicants` | `is_privacy_consent_given` | `BOOLEAN` | RA 10173 consent confirmed |
| `applicants` | `has_pwd_id` | `BOOLEAN` | Learner has a PWD ID card |
| `applicants` | `is_temporarily_enrolled` | `BOOLEAN` | Enrolled without complete documents |
| `documents` | `is_presented_only` | `BOOLEAN` | Document was shown but not collected |
| `requirement_checklists` | `is_psa_birth_cert_presented` | `BOOLEAN` | PSA BC verified during Phase 1 |
| `requirement_checklists` | `is_psa_bc_on_file` | `BOOLEAN` | PSA BC already permanently on file |
| `requirement_checklists` | `is_original_psa_bc_collected` | `BOOLEAN` | Original PSA BC filed in Phase 2 |
| `requirement_checklists` | `is_secondary_birth_proof_submitted` | `BOOLEAN` | Substitute birth proof accepted |
| `requirement_checklists` | `is_sf9_submitted` | `BOOLEAN` | SF9 Report Card submitted |
| `requirement_checklists` | `is_sf10_requested` | `BOOLEAN` | SF10 Permanent Record transfer initiated |
| `requirement_checklists` | `is_good_moral_presented` | `BOOLEAN` | Good Moral cert presented (not required) |
| `requirement_checklists` | `is_pept_ae_submitted` | `BOOLEAN` | PEPT/A&E Certificate submitted |
| `requirement_checklists` | `is_pwd_id_presented` | `BOOLEAN` | PWD ID card presented |
| `requirement_checklists` | `is_medical_eval_submitted` | `BOOLEAN` | Medical evaluation submitted |
| `requirement_checklists` | `is_undertaking_signed` | `BOOLEAN` | Affidavit of Undertaking signed |
| `requirement_checklists` | `is_confirmation_slip_received` | `BOOLEAN` | Confirmation Slip received |
| `scp_configs` | `is_offered` | `BOOLEAN` | This SCP is offered this school year |

---

## 8. Timestamp Columns

### Rule

All timestamp columns use `lower_snake_case` with a **past-tense verb** suffix `_at`.

### Pattern

```
{past_tense_verb}_at
```

### Reference

| Column | Type | Meaning |
|---|---|---|
| `created_at` | `TIMESTAMPTZ` | Row was created |
| `updated_at` | `TIMESTAMPTZ` | Row was last modified |
| `last_login_at` | `TIMESTAMPTZ` | User last authenticated |
| `uploaded_at` | `TIMESTAMPTZ` | Document file was uploaded |
| `verified_at` | `TIMESTAMPTZ` | Document was verified by registrar |
| `enrolled_at` | `TIMESTAMPTZ` | Learner was officially enrolled |
| `attempted_at` | `TIMESTAMPTZ` | Email send was attempted |
| `sent_at` | `TIMESTAMPTZ` | Email was successfully delivered |

### Date-Only Columns

Date-only columns (no time component) use `_date` suffix:

```
class_opening_date   DATE   ← not a TIMESTAMPTZ — just a calendar date
class_end_date       DATE
early_reg_open_date  DATE
early_reg_close_date DATE
enroll_open_date     DATE
enroll_close_date    DATE
exam_date            DATE   ← exam day; no time needed
interview_date       DATE
```

**Never use `_time`, `_datetime`, `whenX`, `X_on`, or `date_of_X` patterns.**

---

## 9. Array Columns

### Rule

Array columns are named in the **plural** form. The column name describes the collection, not a single element.

### Pattern

```
{noun}_s     or     {noun}_list     (if noun already ends in s or is ambiguous)
```

### Reference

| Current Prisma Field | Correct Column | Type | Notes |
|---|---|---|---|
| `subjects` | `subjects` | `TEXT[]` | Already plural ✅ |
| `disabilityType` | `disability_types` | `TEXT[]` | Pluralized — was singular |
| `spsSports` | `sports_list` | `TEXT[]` | SCP prefix removed; plural |
| `learningModalities` | `learning_modalities` | `TEXT[]` | Already plural ✅ |
| `artFields` | `art_fields` | `TEXT[]` | ScpConfig — already plural ✅ |
| `languages` | `languages` | `TEXT[]` | ScpConfig — already plural ✅ |
| `sportsList` | `sports_list` | `TEXT[]` | ScpConfig — already correct |
| `applicableGradeLevelIds` | `applicable_grade_level_ids` | `INT[]` | Strand — already plural ✅ |

---

## 10. JSON Columns

### Rule

JSON columns are named as descriptive `snake_case` nouns. Since JSON is a schema-less container, the column name must be **as specific as possible** about what it contains.

### Current Issues

`currentAddress`, `permanentAddress`, `motherName`, `fatherName`, `guardianInfo` are all `Json` in the schema. The column names are acceptable but the JSON structure should be documented.

### Reference

| Column | Type | Expected JSON Structure |
|---|---|---|
| `current_address` | `JSONB` | `{ houseNo, street, barangay, city, province, country, zipCode }` |
| `permanent_address` | `JSONB` | Same structure as `current_address` |
| `mother_name` | `JSONB` | `{ lastName, firstName, middleName, contactNumber }` |
| `father_name` | `JSONB` | `{ lastName, firstName, middleName, contactNumber }` |
| `guardian_info` | `JSONB` | `{ lastName, firstName, middleName, relationship, contactNumber }` |
| `color_scheme` | `JSONB` | `{ accentHsl, primaryHsl, extractedAt }` |

### Rule: Use `JSONB` not `JSON` in PostgreSQL

`JSONB` (binary JSON) is indexed, compressed, and faster to query. Prisma's `Json` type maps to `JSONB` in PostgreSQL by default.

---

## 11. Enum Types

### PostgreSQL Enum Naming

PostgreSQL enum type names are `lower_snake_case`. Enum values are `UPPER_SNAKE_CASE`.

### Pattern

```sql
CREATE TYPE {noun}_{category} AS ENUM ('VALUE_ONE', 'VALUE_TWO');
```

### Enum Reference

| Prisma Enum | PostgreSQL Type Name | Values |
|---|---|---|
| `Role` | `user_role` | `REGISTRAR`, `SYSTEM_ADMIN` |
| `Sex` | `sex` | `MALE`, `FEMALE` |
| `ApplicationStatus` | `application_status` | `SUBMITTED`, `UNDER_REVIEW`, `FOR_REVISION`, `ELIGIBLE`, `ASSESSMENT_SCHEDULED`, `ASSESSMENT_TAKEN`, `PASSED`, `PRE_REGISTERED`, `TEMPORARILY_ENROLLED`, `NOT_QUALIFIED`, `ENROLLED`, `REJECTED`, `WITHDRAWN` |
| `SchoolYearStatus` | `school_year_status` | `DRAFT`, `UPCOMING`, `ACTIVE`, `ARCHIVED` |
| `CurriculumType` | `curriculum_type` | `OLD_STRAND`, `ELECTIVE_CLUSTER` |
| `SHSTrack` | `shs_track` | `ACADEMIC`, `TECHPRO` |
| `ApplicantType` | `applicant_type` | `REGULAR`, `STE`, `SPA`, `SPS`, `SPJ`, `SPFL`, `SPTVE`, `STEM_GRADE11` |
| `LearnerType` | `learner_type` | `NEW_ENROLLEE`, `TRANSFEREE`, `RETURNING`, `CONTINUING` |
| `AdmissionChannel` | `admission_channel` | `ONLINE`, `F2F` |
| `DocumentType` | `document_type` | `PSA_BIRTH_CERTIFICATE`, `SECONDARY_BIRTH_PROOF`, ... |
| `DocumentStatus` | `document_status` | `SUBMITTED`, `VERIFIED`, `REJECTED`, `MISSING` |
| `EmailTrigger` | `email_trigger` | `APPLICATION_SUBMITTED`, `APPLICATION_APPROVED`, ... |
| `EmailStatus` | `email_status` | `PENDING`, `SENT`, `FAILED` |

### Prisma Enum Mapping

```prisma
enum Role {
  REGISTRAR
  SYSTEM_ADMIN

  @@map("user_role")
}

enum ApplicationStatus {
  SUBMITTED
  UNDER_REVIEW
  // ...

  @@map("application_status")
}
```

---

## 12. Index Naming

### Rule

All indexes are explicitly named. Never rely on Prisma's auto-generated index names.

### Pattern

```
idx_{table}_{column}                    ← single column
idx_{table}_{column1}_{column2}         ← composite
idx_{table}_{column}_unique             ← unique index (prefer @@unique)
```

### Reference

| Current Prisma Declaration | Correct Named Declaration | Target Table |
|---|---|---|
| `@@index([status, schoolYearId])` | `@@index([status, schoolYearId], name: "idx_applicants_status_school_year_id")` | `applicants` |
| `@@index([lrn])` | `@@index([lrn], name: "idx_applicants_lrn")` | `applicants` |
| `@@index([applicantType, status])` | `@@index([applicantType, status], name: "idx_applicants_type_status")` | `applicants` |
| `@@index([trackingNumber])` | `@@index([trackingNumber], name: "idx_applicants_tracking_number")` — but better: `@unique` | `applicants` |
| `@@index([applicantId])` | `@@index([applicantId], name: "idx_documents_applicant_id")` | `documents` |
| `@@index([actionType])` | `@@index([actionType], name: "idx_audit_logs_action_type")` | `audit_logs` |
| `@@index([createdAt])` | `@@index([createdAt], name: "idx_audit_logs_created_at")` | `audit_logs` |
| `@@index([status])` | `@@index([status], name: "idx_email_logs_status")` | `email_logs` |
| `@@index([trigger])` | `@@index([trigger], name: "idx_email_logs_trigger")` | `email_logs` |
| `@@unique([schoolYearId, scpType])` | `@@unique([schoolYearId, scpType], name: "uq_scp_configs_school_year_scp_type")` | `scp_configs` |

### Missing Indexes — Recommended Additions

The following indexes are recommended based on expected query patterns:

```prisma
// applicants — frequently filtered
@@index([admissionChannel], name: "idx_applicants_admission_channel")
@@index([learnerType],      name: "idx_applicants_learner_type")
@@index([createdAt],        name: "idx_applicants_created_at")

// enrollments — frequently joined
@@index([sectionId],        name: "idx_enrollments_section_id")
@@index([schoolYearId],     name: "idx_enrollments_school_year_id")

// documents — frequently filtered by status
@@index([status],           name: "idx_documents_status")
@@index([documentType],     name: "idx_documents_document_type")

// audit_logs — frequently queried by user
@@index([userId],           name: "idx_audit_logs_user_id")

// email_logs — admin retries
@@index([applicantId],      name: "idx_email_logs_applicant_id")
```

---

## 13. Constraint Naming

### Primary Key Constraints

```
pk_{table}
```

```sql
CONSTRAINT pk_applicants PRIMARY KEY (id)
CONSTRAINT pk_users PRIMARY KEY (id)
```

### Unique Constraints

```
uq_{table}_{column}
uq_{table}_{column1}_{column2}   ← composite unique
```

```sql
CONSTRAINT uq_users_email UNIQUE (email)
CONSTRAINT uq_applicants_tracking_number UNIQUE (tracking_number)
CONSTRAINT uq_applicants_lrn UNIQUE (lrn)   -- if LRN uniqueness per school year is enforced
CONSTRAINT uq_teachers_employee_id UNIQUE (employee_id)
CONSTRAINT uq_school_years_year_label UNIQUE (year_label)
CONSTRAINT uq_scp_configs_school_year_scp_type UNIQUE (school_year_id, scp_type)
CONSTRAINT uq_enrollments_applicant_id UNIQUE (applicant_id)
CONSTRAINT uq_requirement_checklists_applicant_id UNIQUE (applicant_id)
```

### Foreign Key Constraints

```
fk_{child_table}_{parent_table}
fk_{child_table}_{qualifier}_{parent_table}
```

Full list for this schema:

```sql
-- users
CONSTRAINT fk_users_created_by_users
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL

-- grade_levels
CONSTRAINT fk_grade_levels_school_years
  FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE CASCADE

-- strands
CONSTRAINT fk_strands_school_years
  FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE CASCADE

-- sections
CONSTRAINT fk_sections_grade_levels
  FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE CASCADE
CONSTRAINT fk_sections_advising_teachers
  FOREIGN KEY (advising_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL

-- applicants
CONSTRAINT fk_applicants_school_years
  FOREIGN KEY (school_year_id) REFERENCES school_years(id)
CONSTRAINT fk_applicants_grade_levels
  FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id)
CONSTRAINT fk_applicants_strands
  FOREIGN KEY (strand_id) REFERENCES strands(id)
CONSTRAINT fk_applicants_encoded_by_users
  FOREIGN KEY (encoded_by_id) REFERENCES users(id) ON DELETE SET NULL

-- documents
CONSTRAINT fk_documents_applicants
  FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE

-- requirement_checklists
CONSTRAINT fk_requirement_checklists_applicants
  FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE

-- enrollments
CONSTRAINT fk_enrollments_applicants
  FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
CONSTRAINT fk_enrollments_sections
  FOREIGN KEY (section_id) REFERENCES sections(id)
CONSTRAINT fk_enrollments_school_years
  FOREIGN KEY (school_year_id) REFERENCES school_years(id)
CONSTRAINT fk_enrollments_enrolled_by_users
  FOREIGN KEY (enrolled_by_id) REFERENCES users(id)

-- audit_logs
CONSTRAINT fk_audit_logs_users
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL

-- email_logs
CONSTRAINT fk_email_logs_applicants
  FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE SET NULL

-- scp_configs
CONSTRAINT fk_scp_configs_school_years
  FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE CASCADE

-- school_settings
CONSTRAINT fk_school_settings_active_school_years
  FOREIGN KEY (active_school_year_id) REFERENCES school_years(id)

-- school_years (self-referential)
CONSTRAINT fk_school_years_cloned_from_school_years
  FOREIGN KEY (cloned_from_id) REFERENCES school_years(id) ON DELETE SET NULL
```

### Check Constraints

```
chk_{table}_{rule}
```

```sql
-- Scores must be within valid ranges
CONSTRAINT chk_applicants_exam_score
  CHECK (exam_score IS NULL OR (exam_score >= 0 AND exam_score <= 100))
CONSTRAINT chk_applicants_nat_score
  CHECK (nat_score IS NULL OR (nat_score >= 0 AND nat_score <= 100))
CONSTRAINT chk_applicants_grade10_science
  CHECK (grade10_science_grade IS NULL OR (grade10_science_grade >= 0 AND grade10_science_grade <= 100))
CONSTRAINT chk_applicants_grade10_math
  CHECK (grade10_math_grade IS NULL OR (grade10_math_grade >= 0 AND grade10_math_grade <= 100))
CONSTRAINT chk_applicants_general_average
  CHECK (general_average IS NULL OR (general_average >= 0 AND general_average <= 100))

-- Section capacity must be positive
CONSTRAINT chk_sections_max_capacity
  CHECK (max_capacity > 0)

-- LRN must be exactly 12 digits if present
CONSTRAINT chk_applicants_lrn_format
  CHECK (lrn IS NULL OR lrn ~ '^\d{12}$')

-- Enrollment dates must be logically ordered
CONSTRAINT chk_school_years_dates
  CHECK (class_opening_date < class_end_date)
CONSTRAINT chk_school_years_early_reg_dates
  CHECK (early_reg_open_date < early_reg_close_date)
```

---

## 14. Abbreviation Rules

### Rule 14.1 — Approved Abbreviations for This System

These abbreviations are universally understood within DepEd and are approved for use in column names:

| Abbreviation | Meaning | Approved Usage |
|---|---|---|
| `id` | identifier | `id`, `user_id`, `school_year_id` |
| `url` | Uniform Resource Locator | `logo_url` |
| `ip` | Internet Protocol | `ip_address` |
| `lrn` | Learner Reference Number | `lrn` — DepEd-universal |
| `scp` | Special Curricular Program | `scp_type`, `scp_config`, `is_scp_application` |
| `shs` | Senior High School | `shs_track` |
| `jhs` | Junior High School | Used in documentation — avoid in column names |
| `psa` | Philippine Statistics Authority | `psa_birth_cert_number` |
| `sf9` | School Form 9 (Report Card) | `is_sf9_submitted` |
| `sf10` | School Form 10 (Permanent Record) | `is_sf10_requested` |
| `pept` | Philippine Educational Placement Test | `is_pept_ae_submitted` |
| `nat` | National Achievement Test | `nat_score` |
| `pwd` | Person With Disability | `has_pwd_id` |
| `hsl` | Hue-Saturation-Lightness | `selected_accent_hsl` |
| `hsl` | in color context only | acceptable |
| `4ps` | Pantawid Pamilyang Pilipino Program | `is_4ps_beneficiary`, `household_id_4ps` |

### Rule 14.2 — Prohibited Abbreviations

These abbreviations appeared in the schema and are **prohibited going forward**:

| Prohibited | Was Used In | Correct Form |
|---|---|---|
| `sy` (school year) | `syLastAttended` | `school_year_last_attended` |
| `sned` | `snedCategory` | `special_needs_category` |
| `bc` (birth cert, standalone) | `psaBcNumber` | Use `psa_birth_cert_number` |
| `spa`, `sps`, `spfl` as column **prefixes** | `spaArtField`, `spsSports`, `spflLanguage` | The SCP type is a separate column — remove prefix from the data field |
| `AY` (academic year) | Relation name `"AYClone"` | `SchoolYearClone` |

### Rule 14.3 — When In Doubt, Spell It Out

If an abbreviation requires domain knowledge to understand, spell out the full word. A developer joining the project six months from now should be able to read the schema without a glossary.

---

## 15. Relation Name Conventions (Prisma)

Prisma relation names (the string argument in `@relation("name")`) are used when disambiguating multiple relations between the same two models. They should use **`PascalCase`** and spell out the full concept.

### Current Issues

| Current Relation Name | Correct Relation Name | Reason |
|---|---|---|
| `"AYClone"` | `"SchoolYearClone"` | `AY` is an abbreviation; model is `SchoolYear` |
| `"ApplicantEncodedBy"` | `"ApplicantEncodedBy"` | ✅ Clear and correct |
| `"UserCreatedBy"` | `"UserCreatedBy"` | ✅ Clear and correct |

### Pattern

```
"{ChildModel}{RelationshipDescriptor}"
```

Examples:
```
"SchoolYearClone"     ← SchoolYear cloned from another SchoolYear
"ApplicantEncodedBy"  ← Applicant was encoded by a User
"UserCreatedBy"       ← User was created by another User
```

---

## 16. Prisma `@@map` and `@map` Directives

Every model must have a `@@map` directive. Every field with a camelCase name that maps to a snake_case column must have a `@map` directive.

### Model-Level Maps

```prisma
model User           { @@map("users") }
model Teacher        { @@map("teachers") }
model SchoolSettings { @@map("school_settings") }
model SchoolYear     { @@map("school_years") }
model GradeLevel     { @@map("grade_levels") }
model Strand         { @@map("strands") }
model Section        { @@map("sections") }
model Applicant      { @@map("applicants") }
model Document       { @@map("documents") }
model RequirementChecklist { @@map("requirement_checklists") }
model Enrollment     { @@map("enrollments") }
model AuditLog       { @@map("audit_logs") }
model EmailLog       { @@map("email_logs") }
model ScpConfig      { @@map("scp_configs") }
```

### Field-Level Maps (Selected Examples)

```prisma
model User {
  id                 Int      @id @default(autoincrement())
  name               String
  email              String   @unique
  password           String
  role               Role
  isActive           Boolean  @default(true)   @map("is_active")
  lastLoginAt        DateTime?                 @map("last_login_at")
  mustChangePassword Boolean  @default(false)  @map("must_change_password")
  createdById        Int?                      @map("created_by_id")
  createdAt          DateTime @default(now())  @map("created_at")
  updatedAt          DateTime @updatedAt       @map("updated_at")

  @@map("users")
}

model SchoolYear {
  id                 Int              @id @default(autoincrement())
  yearLabel          String           @unique          @map("year_label")
  status             SchoolYearStatus @default(DRAFT)
  isActive           Boolean          @default(false)  @map("is_active")
  classOpeningDate   DateTime?                         @map("class_opening_date")
  classEndDate       DateTime?                         @map("class_end_date")
  earlyRegOpenDate   DateTime?                         @map("early_reg_open_date")
  earlyRegCloseDate  DateTime?                         @map("early_reg_close_date")
  enrollOpenDate     DateTime?                         @map("enroll_open_date")
  enrollCloseDate    DateTime?                         @map("enroll_close_date")
  manualOverrideOpen Boolean          @default(false)  @map("is_manual_override_open")
  clonedFromId       Int?                              @map("cloned_from_id")
  createdAt          DateTime         @default(now())  @map("created_at")

  clonedFrom    SchoolYear?  @relation("SchoolYearClone", fields: [clonedFromId], references: [id])
  clones        SchoolYear[] @relation("SchoolYearClone")

  @@map("school_years")
}

model Applicant {
  // ... most fields map one-to-one ...
  psaBcNumber         String?   @map("psa_birth_cert_number")
  birthDate           DateTime  @map("birth_date")
  placeOfBirth        String?   @map("place_of_birth")
  motherTongue        String?   @map("mother_tongue")
  currentAddress      Json      @map("current_address")
  permanentAddress    Json?     @map("permanent_address")
  motherName          Json      @map("mother_name")
  fatherName          Json      @map("father_name")
  guardianInfo        Json?     @map("guardian_info")
  emailAddress        String?   @map("email_address")
  isIpCommunity       Boolean   @default(false) @map("is_ip_community")
  ipGroupName         String?   @map("ip_group_name")
  is4PsBeneficiary    Boolean   @default(false) @map("is_4ps_beneficiary")
  householdId4Ps      String?   @map("household_id_4ps")
  isBalikAral         Boolean   @default(false) @map("is_balik_aral")
  lastYearEnrolled    String?   @map("last_year_enrolled")
  isLearnerWithDisability Boolean @default(false) @map("is_learner_with_disability")
  disabilityType      String[]  @map("disability_types")
  lastSchoolName      String?   @map("last_school_name")
  lastSchoolId        String?   @map("last_school_id")
  lastGradeCompleted  String?   @map("last_grade_completed")
  syLastAttended      String?   @map("school_year_last_attended")
  lastSchoolAddress   String?   @map("last_school_address")
  lastSchoolType      String?   @map("last_school_type")
  learnerType         LearnerType @default(NEW_ENROLLEE) @map("learner_type")
  electiveCluster     String?   @map("elective_cluster")
  scpApplication      Boolean   @default(false) @map("is_scp_application")
  scpType             String?   @map("scp_type")
  spaArtField         String?   @map("art_field")
  spsSports           String[]  @map("sports_list")
  spflLanguage        String?   @map("foreign_language")
  trackingNumber      String    @unique @map("tracking_number")
  status              ApplicationStatus @default(SUBMITTED)
  rejectionReason     String?   @map("rejection_reason")
  gradeLevelId        Int       @map("grade_level_id")
  strandId            Int?      @map("strand_id")
  schoolYearId        Int       @map("school_year_id")
  applicantType       ApplicantType @default(REGULAR) @map("applicant_type")
  shsTrack            SHSTrack? @map("shs_track")
  examDate            DateTime? @map("exam_date")
  examVenue           String?   @map("exam_venue")
  examScore           Float?    @map("exam_score")
  examResult          String?   @map("exam_result")
  examNotes           String?   @map("exam_notes")
  assessmentType      String?   @map("assessment_type")
  interviewDate       DateTime? @map("interview_date")
  interviewResult     String?   @map("interview_result")
  interviewNotes      String?   @map("interview_notes")
  auditionResult      String?   @map("audition_result")
  tryoutResult        String?   @map("tryout_result")
  natScore            Float?    @map("nat_score")
  grade10ScienceGrade Float?    @map("grade10_science_grade")
  grade10MathGrade    Float?    @map("grade10_math_grade")
  generalAverage      Float?    @map("general_average")
  privacyConsentGiven Boolean   @default(false) @map("is_privacy_consent_given")
  admissionChannel    AdmissionChannel @default(ONLINE) @map("admission_channel")
  encodedById         Int?      @map("encoded_by_id")
  snedCategory        String?   @map("special_needs_category")
  hasPwdId            Boolean   @default(false) @map("has_pwd_id")
  learningModalities  String[]  @map("learning_modalities")
  isTemporarilyEnrolled Boolean @default(false) @map("is_temporarily_enrolled")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt      @map("updated_at")

  @@index([status, schoolYearId], name: "idx_applicants_status_school_year_id")
  @@index([lrn],                  name: "idx_applicants_lrn")
  @@index([applicantType, status],name: "idx_applicants_type_status")
  @@map("applicants")
}
```

---

## 17. Corrected Schema Reference

The following table is a concise corrected mapping for every model showing the final PostgreSQL table and column names:

### `users` table

| Prisma Field | PostgreSQL Column | Type |
|---|---|---|
| `id` | `id` | `INTEGER` |
| `name` | `name` | `TEXT` |
| `email` | `email` | `TEXT` |
| `password` | `password` | `TEXT` |
| `role` | `role` | `user_role` |
| `isActive` | `is_active` | `BOOLEAN` |
| `lastLoginAt` | `last_login_at` | `TIMESTAMPTZ` |
| `mustChangePassword` | `must_change_password` | `BOOLEAN` |
| `createdById` | `created_by_id` | `INTEGER` |
| `createdAt` | `created_at` | `TIMESTAMPTZ` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ` |

### `school_years` table

| Prisma Field | PostgreSQL Column | Type |
|---|---|---|
| `id` | `id` | `INTEGER` |
| `yearLabel` | `year_label` | `TEXT` |
| `status` | `status` | `school_year_status` |
| `isActive` | `is_active` | `BOOLEAN` |
| `classOpeningDate` | `class_opening_date` | `DATE` |
| `classEndDate` | `class_end_date` | `DATE` |
| `earlyRegOpenDate` | `early_reg_open_date` | `DATE` |
| `earlyRegCloseDate` | `early_reg_close_date` | `DATE` |
| `enrollOpenDate` | `enroll_open_date` | `DATE` |
| `enrollCloseDate` | `enroll_close_date` | `DATE` |
| `manualOverrideOpen` | `is_manual_override_open` | `BOOLEAN` |
| `clonedFromId` | `cloned_from_id` | `INTEGER` |
| `createdAt` | `created_at` | `TIMESTAMPTZ` |

### `requirement_checklists` table

| Prisma Field | PostgreSQL Column | Type |
|---|---|---|
| `id` | `id` | `INTEGER` |
| `applicantId` | `applicant_id` | `INTEGER` |
| `psaBirthCertStatus` | `is_psa_birth_cert_presented` | `BOOLEAN` |
| `psaBcOnFile` | `is_psa_bc_on_file` | `BOOLEAN` |
| `originalPsaBcCollected` | `is_original_psa_bc_collected` | `BOOLEAN` |
| `secondaryBirthProofStatus` | `is_secondary_birth_proof_submitted` | `BOOLEAN` |
| `sf9ReportCardStatus` | `is_sf9_submitted` | `BOOLEAN` |
| `sf10PermanentStatus` | `is_sf10_requested` | `BOOLEAN` |
| `goodMoralStatus` | `is_good_moral_presented` | `BOOLEAN` |
| `peptAeCertificateStatus` | `is_pept_ae_submitted` | `BOOLEAN` |
| `pwdIdStatus` | `is_pwd_id_presented` | `BOOLEAN` |
| `medicalEvaluationStatus` | `is_medical_eval_submitted` | `BOOLEAN` |
| `undertakingStatus` | `is_undertaking_signed` | `BOOLEAN` |
| `confirmationSlipStatus` | `is_confirmation_slip_received` | `BOOLEAN` |
| `otherStatus` | `is_other_doc_submitted` | `BOOLEAN` |
| `lastUpdated` | `updated_at` | `TIMESTAMPTZ` |

### `audit_logs` table

| Prisma Field | PostgreSQL Column | Note |
|---|---|---|
| `subjectType` | `subject_type` | Polymorphic — stores the model name |
| `subjectId` | `record_id` | Renamed — clarifies polymorphic nature |
| `ipAddress` | `ip_address` | |
| `userAgent` | `user_agent` | |

---

## 18. Quick Reference Card

```
─────────────────────────────────────────────────────────────────────
TABLES           lower_snake_case, plural
                 users, applicants, school_years, grade_levels

COLUMNS          lower_snake_case
                 school_year_id, tracking_number, is_active

PRIMARY KEYS     Always named "id", autoincrement
                 id INTEGER GENERATED ALWAYS AS IDENTITY

FOREIGN KEYS     {referenced_table_singular}_id
                 school_year_id, grade_level_id, section_id
                 → qualified when ambiguous: encoded_by_id, verified_by_id

BOOLEANS         is_ prefix for state/classification
                 has_ prefix when subject possesses something
                 is_active, is_4ps_beneficiary, has_pwd_id
                 → Exception: must_change_password (natural phrase)
                 → NEVER use _status suffix on booleans

TIMESTAMPS       past_tense_verb_at
                 created_at, enrolled_at, verified_at, sent_at
                 → Date-only columns: class_opening_date, exam_date

ARRAYS           plural noun
                 subjects[], disability_types[], sports_list[]

ENUMS (PG)       lower_snake_case type name, UPPER_SNAKE_CASE values
                 user_role, application_status, learner_type

INDEXES          idx_{table}_{column(s)}
                 idx_applicants_lrn, idx_audit_logs_action_type

CONSTRAINTS      pk_{table}
                 uq_{table}_{column}
                 fk_{child}_{parent}
                 fk_{child}_{qualifier}_{parent}
                 chk_{table}_{rule}

ABBREVIATIONS    Approved: id, url, ip, lrn, scp, shs, psa, sf9, sf10,
                           pept, nat, pwd, hsl, 4ps
                 Prohibited: sy, sned, bc (standalone), spa/sps/spfl as
                             column prefixes, AY (use full word)
─────────────────────────────────────────────────────────────────────
```

---

*Document v1.0.0*
*System: School Admission, Enrollment & Information Management System*
*Database: PostgreSQL 18 · ORM: Prisma 6*
*Role: Professional DBA Reference — Naming Conventions*
*Schema Audit Basis: `server/prisma/schema.prisma` — SY 2026–2027*
