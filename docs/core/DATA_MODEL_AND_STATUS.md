# Data Model And Status

Last reviewed: 2026-07-24

`server/prisma/schema.prisma` is the authoritative data model.

## Model Inventory

| Prisma model | Responsibility |
| --- | --- |
| `User` | Staff and learner account identity, roles, credentials, and access status |
| `Teacher` | Personnel identity, service, appointment, funding, qualifications, and SF7 profile |
| `TeacherSchedulePeriod` | School-year SF7 teaching-period snapshot |
| `SchoolSetting` | School identity, active-year reference, branding, and operational configuration |
| `SchoolYear` | Academic-year label, dates, phase, finalization, and active or archived state |
| `SchoolYearCalendarPolicy` | Versioned draft, approved, and applied DepEd calendar details |
| `GradeLevel` | Grade 7 to Grade 10 reference and display order |
| `Section` | School-year section, program, capacity, order, and ranking |
| `SectionAdviser` | Time-bound adviser assignment, handover, and revocation history |
| `Learner` | Stable learner identity, LRN, profile, portal, and current status |
| `EnrollmentApplication` | School-year intake, verification, confirmation, remedial, and readiness state |
| `EnrollmentPreviousSchool` | Previous-school details linked to an application |
| `ApplicationAddress` | Current or permanent address captured for an application |
| `ApplicationFamilyMember` | Mother, father, or guardian details captured for an application |
| `EnrollmentRecord` | Live official grade and section placement |
| `SmartAcademicOutcome` | Final published SMART outcome for an enrollment |
| `SmartLearningAreaResult` | Per-learning-area result belonging to a SMART outcome |
| `Department` | Personnel department reference |
| `AuditLog` | Actor, action, subject, metadata, and request context |
| `HealthRecord` | Protected BOSY or EOSY learner health measurement |
| `TeacherDesignation` | School-year personnel designation and ancillary duties |
| `Region` | PSGC region reference |
| `Province` | PSGC province reference |
| `CityMunicipality` | PSGC city or municipality reference |
| `Barangay` | PSGC barangay reference |
| `EnrollmentHistory` | Immutable school-year learner ledger and outcome snapshot |
| `SchoolFormArtifact` | Immutable SF5 or SF6 source payload, checksum, and version |

## Core Statuses

### Academic Phase

- `OFFICIAL_ENROLLMENT` enables learner intake, verification, confirmation, and sectioning.
- `CLASSES_ONGOING` permits authorized late walk-in processing but closes public online submission.
- `EOSY_CLOSING` locks intake actions and enables final-outcome and rollover preparation.

### Application

The active enrollment path uses:

1. `PENDING_VERIFICATION` or `PENDING_CONFIRMATION`
2. `READY_FOR_SECTIONING`, with `isTemporarilyEnrolled` set while documentary requirements remain pending
3. `OFFICIALLY_ENROLLED`

Lifecycle outcomes include `TRANSFERRING_OUT`, `TRANSFERRED_OUT`, `DROPPED`, `ARCHIVED_NO_SHOW`, `REMEDIAL_HOLD`, and `REMEDIAL_RESOLVED`.

### Learner

`ACTIVE`, `INACTIVE`, `RESTRICTED`, `JHS_COMPLETER`, `DROPPED`, and `TRANSFERRED_OUT` describe the current learner record.

### EOSY

`PROMOTED`, `CONDITIONALLY_PROMOTED`, `RETAINED`, `DROPPED_OUT`, and `TRANSFERRED_OUT` are the final school-year outcomes.

### School Year And Calendar

- School years are `ACTIVE` or `ARCHIVED`.
- Calendar policies move through `DRAFT`, `APPROVED`, and `APPLIED`.
- SF artifacts are `SF5` or `SF6`.

### Sectioning

`BATCH_ALGORITHM`, `INLINE_SLOTTING`, `MANUAL_OVERRIDE`, `MANUAL_REASSIGNMENT`, and `TRANSFER` preserve how a learner entered a section.

### Personnel

Roles are `SYSTEM_ADMIN`, `HEAD_REGISTRAR`, `CLASS_ADVISER`, `TEACHER`, `LEARNER`, and `MRF`.

Appointments include regular or permanent, provisional, substitute, contractual, volunteer, Local School Board, and other. Funding sources include national, Special Education Fund, Local School Board, PTA, NGO, and other.

## Complete Enum Inventory

| Prisma enum | Values and use |
| --- | --- |
| `SectionAdviserStatus` | `ACTIVE`, `HANDED_OVER`, `REVOKED` |
| `Role` | `SYSTEM_ADMIN`, `HEAD_REGISTRAR`, `CLASS_ADVISER`, `TEACHER`, `LEARNER`, `MRF` |
| `ComplianceStatus` | `PENDING`, `COMPLIED`, `OVERDUE` |
| `PrimaryContactType` | `FATHER`, `MOTHER`, `GUARDIAN` |
| `Sex` | `MALE`, `FEMALE` |
| `ApplicationStatus` | Intake, verification, sectioning, enrollment, departure, archive, and remedial states described above |
| `SystemAcademicPhase` | `OFFICIAL_ENROLLMENT`, `CLASSES_ONGOING`, `EOSY_CLOSING` |
| `SchoolYearStatus` | `ACTIVE`, `ARCHIVED` |
| `CalendarPolicyStatus` | `DRAFT`, `APPROVED`, `APPLIED` |
| `SchoolFormType` | `SF5`, `SF6` |
| `LearningAreaResultStatus` | `PASSED`, `FAILED`, `INCOMPLETE` |
| `ApplicantType` | Regular BEC, STE, SPA, SPS, SPJ, SPFL, SPTVE, and authorized late enrollee |
| `AdmissionChannel` | `ONLINE`, `F2F` |
| `DocumentType` | Birth, SF9, SF10, good moral, medical, recognition, PWD, undertaking, confirmation, and other supported document classifications |
| `LearnerType` | `NEW_ENROLLEE`, `TRANSFEREE`, `RETURNING`, `CONTINUING`, `OSCYA`, `ALS` |
| `AssessmentPeriod` | `BOSY`, `EOSY` |
| `AddressType` | `CURRENT`, `PERMANENT` |
| `AcademicStatus` | `PROMOTED`, `RETAINED`, `CONDITIONALLY_PROMOTED` |
| `EosyStatus` | `PROMOTED`, `CONDITIONALLY_PROMOTED`, `RETAINED`, `DROPPED_OUT`, `TRANSFERRED_OUT` |
| `FamilyRelationship` | `MOTHER`, `FATHER`, `GUARDIAN` |
| `SectioningMethod` | `BATCH_ALGORITHM`, `INLINE_SLOTTING`, `MANUAL_OVERRIDE`, `MANUAL_REASSIGNMENT`, `TRANSFER` |
| `LearnerStatus` | `ACTIVE`, `INACTIVE`, `RESTRICTED`, `JHS_COMPLETER`, `DROPPED`, `TRANSFERRED_OUT` |
| `TermFormat` | `TRIMESTER`, `QUARTERS` |
| `TeacherNatureOfAppointment` | `REGULAR_PERMANENT`, `PROVISIONAL`, `SUBSTITUTE`, `CONTRACTUAL`, `VOLUNTEER`, `LOCAL_SCHOOL_BOARD`, `OTHER` |
| `TeacherFundingSource` | `NATIONAL`, `SPECIAL_EDUCATION_FUND`, `LOCAL_SCHOOL_BOARD`, `PTA`, `NGO`, `OTHER` |
| `Weekday` | `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY` |

## Live Records And History

`EnrollmentRecord` represents the current operational placement. During atomic rollover, the source-year learner outcome is preserved in `EnrollmentHistory`, source live enrollments are removed, and target-year applications are created only for eligible learners.

Historical data must be read from history-aware services. It must not be reconstructed by changing current records.

## Naming

Prisma uses singular PascalCase model names and camelCase fields. PostgreSQL mappings use lowercase snake_case table and column names. New migrations must preserve this convention.
