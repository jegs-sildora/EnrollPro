# Database Schema Alignment Review

Date: 2026-04-14
Scope mode: Implemented baseline required, planned enhancements separated
Schema reviewed: [server/prisma/schema.prisma](../server/prisma/schema.prisma)

## Link/Path to Generated Plan (.md)

- [docs/database-review-plan.md](database-review-plan.md)

## Summary of Findings

- Core schema coverage is strong across implemented domains: admission, early registration, enrollment, school-year setup, sectioning, SIMS health records, teacher/admin, audit logs, and email logs.
- Highest-impact previously flagged gaps are now addressed in schema:
  - `Applicant.documentaryDeadlineAt` and `Applicant.complianceStatus` exist.
  - `Role` enum now includes `TEACHER`.
  - `ApplicantDocument.verifiedById` now has explicit Prisma relation `verifiedBy`.
  - Early registration has staged typed fields (`statusV2`, `learnerTypeV2`, `gradeLevelIdV2`, `channelV2`, `primaryContactV2`).
- Current primary risks are no longer missing core entities; they are consistency and normalization risks:
  - dual-field transition state in `EarlyRegistration` (legacy + V2 typed fields),
  - denormalized arrays and checklist booleans,
  - missing structural uniqueness in grade-level/section naming,
  - cross-table school-year consistency not DB-enforced.

## Prisma Schema Inventory

Source: [server/prisma/schema.prisma](../server/prisma/schema.prisma)

### Inventory Counts

- Models: 26
- Enums: 19
- Array-backed relational sets (`String[]`): 4
- Table-level index/unique declarations (`@@index`, `@@unique`): 46

### Domain Map

1. Identity and access
   - `User`, `Teacher`, `TeacherSubject`
2. School-year and curriculum structure
   - `SchoolSetting`, `SchoolYear`, `GradeLevel`, `Section`
   - `ScpProgramConfig`, `ScpProgramStep`, `ScpProgramOption`
3. Admission and enrollment
   - `Applicant`, `ApplicantAddress`, `ApplicantFamilyMember`, `ApplicantPreviousSchool`
   - `ApplicantAssessment`, `ApplicantProgramDetail`, `ApplicantDocument`, `ApplicantChecklist`
   - `Enrollment`
4. SIMS / learner operations
   - `HealthRecord`
5. DO 017 lane
   - `EarlyRegistrant`, `EarlyRegistrantGuardian`, `EarlyRegistration`
6. Observability and communications
   - `AuditLog`, `EmailLog`

### Constraint and Relationship Highlights

- One-to-one guards:
  - `Enrollment.applicantId` unique
  - `ApplicantChecklist.applicantId` unique
  - `ApplicantPreviousSchool.applicantId` unique
  - `ApplicantProgramDetail.applicantId` unique
- Composite uniqueness:
  - `HealthRecord(applicantId, schoolYearId, assessmentPeriod)`
  - `EarlyRegistration(registrantId, schoolYearId)`
  - `ApplicantAddress(applicantId, addressType)`
  - `ApplicantFamilyMember(applicantId, relationship)`
  - SCP config/step/option composites
- High-value indexes exist on applicant status/school-year, document status/type, enrollment dimensions, and audit log actor/time.

## Extracted Implemented Requirement Matrix

Requirement sources:

- [docs/features/admission/MODULE_1_EARLY_REGISTRATION_IMPLEMENTATION_SPEC.md](features/admission/MODULE_1_EARLY_REGISTRATION_IMPLEMENTATION_SPEC.md)
- [docs/features/enrollment/MODULE_2_ENROLLMENT_IMPLEMENTATION_SPEC.md](features/enrollment/MODULE_2_ENROLLMENT_IMPLEMENTATION_SPEC.md)
- [docs/features/sims/MODULE_3_SIMS_IMPLEMENTATION_SPEC.md](features/sims/MODULE_3_SIMS_IMPLEMENTATION_SPEC.md)
- [docs/features/teachers/MODULE_4_TEACHER_MANAGEMENT_IMPLEMENTATION_SPEC.md](features/teachers/MODULE_4_TEACHER_MANAGEMENT_IMPLEMENTATION_SPEC.md)
- [docs/features/academic-year/MODULE_5_GRADE_SECTIONING_IMPLEMENTATION_SPEC.md](features/academic-year/MODULE_5_GRADE_SECTIONING_IMPLEMENTATION_SPEC.md)
- [docs/features/admission/DOCUMENTARY_REQUIREMENTS.md](features/admission/DOCUMENTARY_REQUIREMENTS.md)
- [docs/core/APPLICATION_STATUS_LIFECYCLE.md](core/APPLICATION_STATUS_LIFECYCLE.md)
- [docs/core/REALITY_ALIGNMENT_NOTES.md](core/REALITY_ALIGNMENT_NOTES.md)
- [docs/core/DB_NAMING_CONVENTIONS.md](core/DB_NAMING_CONVENTIONS.md)

Implemented baseline requirements extracted:

1. Active school-year pivot must be persisted and referenceable.
2. Grade levels and sections must be school-year scoped with capacity controls.
3. Admission statuses and transition states must support current lifecycle semantics.
4. Temporary enrollment and documentary compliance tracking must be persisted.
5. Early-registration lane must support one registration per learner per school year.
6. Early-registration lane must support online/F2F channels and verification attribution.
7. SIMS health records must enforce one record per period per learner per school year.
8. Teacher and staff access domains must support read/write separation and role-based policy.
9. Mutating operations must be auditable with actor and request metadata.
10. Email delivery outcomes must be logged for operational visibility.
11. Naming conventions must stay implementation-aligned (snake_case SQL, explicit maps, explicit index names).

Planned/non-baseline items (not scored as defects):

1. Full autonomous sectioning ranking engine.
2. Full LIS/SF10 automation and Brigada pipelines.
3. Learner identity spine and status event ledger (from refinement roadmap docs).

## Alignment Crosswalk

Legend: `Aligned`, `Partially Aligned`, `Missing`, `Contradictory`

1. Active school-year pointer
   - Status: `Aligned`
   - Evidence: `SchoolSetting.activeSchoolYearId` FK to `SchoolYear`
2. School-year lifecycle and windows persistence
   - Status: `Aligned`
   - Evidence: `SchoolYear.status`, date window fields, override flag
3. Grade-level and section school-year scoping
   - Status: `Partially Aligned`
   - Evidence: `GradeLevel.schoolYearId`, `Section.gradeLevelId`
   - Gap: no uniqueness for grade-level name per school year or section name per grade level
4. Admission lifecycle state support
   - Status: `Aligned`
   - Evidence: `ApplicationStatus` enum includes current canonical states from lifecycle docs
5. Temporary enrollment compliance persistence
   - Status: `Aligned`
   - Evidence: `isTemporarilyEnrolled`, `documentaryDeadlineAt`, `complianceStatus`
6. Early-registration per-school-year dedupe
   - Status: `Aligned`
   - Evidence: `@@unique([registrantId, schoolYearId])` in `EarlyRegistration`
7. Early-registration typed domain constraints
   - Status: `Partially Aligned`
   - Evidence: V2 typed fields exist (`statusV2`, `learnerTypeV2`, `gradeLevelIdV2`, `channelV2`, `primaryContactV2`)
   - Gap: legacy string fields still co-exist and remain unconstrained by enums/FKs
8. Verification attribution on applicant documents
   - Status: `Aligned`
   - Evidence: `verifiedBy` relation present in `ApplicantDocument`
9. SIMS health uniqueness per period
   - Status: `Aligned`
   - Evidence: `@@unique([applicantId, schoolYearId, assessmentPeriod])`
10. Audit persistence requirements

- Status: `Aligned`
- Evidence: `AuditLog` model contains actor/context fields and time indexes

11. Email delivery persistence requirements

- Status: `Aligned`
- Evidence: `EmailLog` model with trigger/status/applicant linkage

12. Role model alignment with runtime TEACHER access

- Status: `Aligned` (schema), `Contradictory` (some docs)
- Evidence: `Role` enum includes `TEACHER`, while several core docs still claim two-role baseline

## Normalization and Integrity Audit

### 1NF

Findings:

1. Multi-value columns are still modeled as arrays:
   - `Applicant.disabilityTypes`
   - `Applicant.learningModalities`
   - `ApplicantProgramDetail.sportsList`
   - `EarlyRegistrant.disabilityTypes`
2. Checklist policy is column-expanded (`ApplicantChecklist`) instead of requirement-item rows.
3. Early-registration transitional dual-shape (legacy and V2 fields) creates a non-atomic domain representation for the same business dimensions.

Impact:

- Harder relational reporting, referential control, and future policy evolution.

### 2NF

Findings:

1. No critical classical 2NF violations (most tables use surrogate primary keys).
2. Practical risk remains where business keys are encoded in unconstrained strings (legacy early-registration fields).

Impact:

- Structural dependency rules are partly delegated to application logic.

### 3NF

Findings:

1. Redundant school-year storage can drift:
   - `Enrollment` stores both `applicantId` and `schoolYearId`
   - `HealthRecord` stores both `applicantId` and `schoolYearId`
2. Program semantics can diverge:
   - `Applicant.applicantType` and `ApplicantProgramDetail.scpType`
3. Disability summary/detail can drift:
   - `isLearnerWithDisability` versus `disabilityTypes`

Impact:

- Consistency depends on service logic and disciplined write paths.

### Referential Integrity and Constraint Quality

Strengths:

1. Most high-value relations are explicitly declared with appropriate optionality.
2. Cascades are used in expected dependent rows (addresses, family members, assessments, early registrant guardians).
3. Critical uniqueness exists for many business rules (health period uniqueness, early registration per school year).

Gaps:

1. Missing structural uniqueness:
   - `GradeLevel`: no `(schoolYearId, name)` or `(schoolYearId, displayOrder)` uniqueness
   - `Section`: no `(gradeLevelId, name)` uniqueness
2. School-year consistency across `Applicant`, `Enrollment`, and `HealthRecord` is not DB-enforced.
3. `EarlyRegistrantGuardian.relationship` is free-form `String` (comment-constrained), not enum-constrained.
4. `SchoolSetting` is described as singleton in docs but not singleton-constrained at DB level.

### Naming and Implementation Alignment

Status:

1. Schema follows naming conventions well: snake_case SQL, explicit `@map`, descriptive index names.
2. Documentation drift remains in some files that still state pre-change role reality (two-role enum only).

## Recommended Schema Improvements

### P1 (High Priority)

1. Add uniqueness constraints that business logic already expects.
   - `GradeLevel`: `@@unique([schoolYearId, name], name: "uq_grade_levels_sy_name")`
   - `Section`: `@@unique([gradeLevelId, name], name: "uq_sections_grade_level_name")`
2. Complete EarlyRegistration typed migration and retire legacy string dimensions.
   - Migrate reads/writes fully to `*V2` fields.
   - Replace `String` fields (`status`, `learnerType`, `channel`, `primaryContact`) with typed fields only.
3. Normalize `EarlyRegistrantGuardian.relationship` to enum.
   - Reuse `FamilyRelationship` or define dedicated guardian relationship enum.
4. Enforce school-year consistency.
   - Add migration-time quality checks and DB constraints/triggers where practical to ensure `Enrollment.schoolYearId` and `HealthRecord.schoolYearId` match applicant school year.

### P2 (Medium Priority)

1. Normalize array-backed sets into lookup + junction tables.
   - disabilities, learning modalities, sports preferences
2. Normalize documentary checklist model.
   - Replace column-expanded boolean checklist with requirement catalog + applicant requirement item rows.
3. Add selective indexes for operational queries likely to scale.
   - `Section(advisingTeacherId)`
   - `ApplicantDocument(verifiedById)` if verifier dashboards are required
   - `EarlyRegistration(schoolYearId, submittedAt)` if list sorting/filtering by submission date is hot path

### P3 (Roadmap)

1. Add status transition event ledger table for richer lifecycle analytics and troubleshooting.
2. Add singleton enforcement strategy for `SchoolSetting` if multiple-row safety is required by policy.
3. Define archival strategy for high-growth logs (`AuditLog`, `EmailLog`) as volume increases.

## Optional: Revised Prisma Schema Snippets

### Snippet A: Structural uniqueness for grade-level and section naming

```prisma
model GradeLevel {
  id           Int       @id @default(autoincrement())
  name         String
  displayOrder Int       @map("display_order")
  schoolYearId Int       @map("school_year_id")

  @@index([schoolYearId], name: "idx_grade_levels_school_year_id")
  @@unique([schoolYearId, name], name: "uq_grade_levels_sy_name")
  @@map("grade_levels")
}

model Section {
  id           Int       @id @default(autoincrement())
  name         String
  gradeLevelId Int       @map("grade_level_id")

  @@index([gradeLevelId], name: "idx_sections_grade_level_id")
  @@unique([gradeLevelId, name], name: "uq_sections_grade_level_name")
  @@map("sections")
}
```

### Snippet B: Typed guardian relationship

```prisma
model EarlyRegistrantGuardian {
  id           Int                @id @default(autoincrement())
  registrantId Int                @map("registrant_id")
  relationship FamilyRelationship
  lastName     String             @map("last_name")
  firstName    String             @map("first_name")

  registrant   EarlyRegistrant @relation(fields: [registrantId], references: [id], onDelete: Cascade)

  @@index([registrantId], name: "idx_early_registrant_guardians_registrant_id")
  @@map("early_registrant_guardians")
}
```

## Notes on Planned (Non-Baseline) Items

- Items from [docs/core/DOMAIN_MODEL_REFINEMENT_PLAN.md](core/DOMAIN_MODEL_REFINEMENT_PLAN.md) remain valid roadmap enhancements but are not baseline defects.
- Legacy wording in older docs (for example `[SCP]_QUALIFIED`, `PRE_REGISTERED_BEC`) should continue to be treated as target-state vocabulary only, per [docs/core/REALITY_ALIGNMENT_NOTES.md](core/REALITY_ALIGNMENT_NOTES.md).
