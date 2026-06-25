# Tables

## Purpose

Table/model inventory from Prisma.

## Summary

Prisma defines 24 models covering identity, school-year operations, enrollment, faculty, geography, audit, health, and historical records.

## Detailed Analysis

Core models:

- `User`, `Teacher`, `TeacherDesignation`, `Department`
- `SchoolSetting`, `SchoolYear`, `GradeLevel`, `Section`, `SectionAdviser`
- `Learner`, `EnrollmentApplication`, `EnrollmentPreviousSchool`, `ApplicationAddress`, `ApplicationFamilyMember`, `EnrollmentRecord`, `EnrollmentHistory`, `EnrollmentListing`
- `AuditLog`, `HealthRecord`, `SF4Log`
- `Region`, `Province`, `CityMunicipality`, `Barangay`

Core enums:

- Roles and identity: `Role`, `Sex`
- Enrollment: `ApplicationStatus`, `ApplicantType`, `AdmissionChannel`, `LearnerType`, `ComplianceStatus`, `DocumentType`, `IntakeMethod`, `SectioningMethod`
- School year and outcomes: `SystemAcademicPhase`, `SchoolYearStatus`, `AcademicStatus`, `EosyStatus`, `LearnerStatus`, `TermFormat`
- Support: `AssessmentKind`, `AssessmentPeriod`, `AddressType`, `FamilyRelationship`, `ReadingProfileLevel`, `SF10Status`

## Dependencies

- `server/prisma/schema.prisma`
- [[ERD]]

## Risks

- Some enums contain legacy or target-state values that may not be fully implemented in UI.
- JSON fields require runtime validation.

## Recommendations

- Maintain a model-to-feature ownership table.
- Add migration notes to [[Decision Log]] for schema changes.

## Related Notes

- [[Database Architecture]]
- [[Relationships]]

