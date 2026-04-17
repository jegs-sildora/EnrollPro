# ATLAS-Requirements

## 1. System Profile

- System Name: A.T.L.A.S.
- Expanded Name: Automated Timetabling and Locations Allocation System
- Description: A Web-Based Academic Scheduling Application
- Document Type: System Requirements Specification
- Version: 1.0.0
- Status: Draft for implementation alignment

## 2. Purpose and Objectives

A.T.L.A.S. must produce school-year scoped teacher schedules and room allocations that are policy-aware, conflict-free, and operationally practical for registrar and academic coordinators.

Primary objectives:

1. Generate valid timetables with minimal manual correction.
2. Enforce teaching-load semantics aligned with DepEd-oriented policy interpretation.
3. Allocate rooms/locations with capacity and resource constraints.
4. Keep EnrollPro as source of truth for teacher identity and designation metadata.

## 3. Scope

In scope:

- Faculty load computation and warnings.
- Section-subject timetable generation.
- Room/location assignment.
- Conflict detection and resolution support.
- Schedule publishing, versioning, and export.

Out of scope:

- Payroll computation.
- Student billing or fees.
- Learning content delivery.

## 4. Users and Roles

- System Admin: configures policies, school-year windows, and generation settings.
- Registrar/Academic Coordinator: runs schedule generation, reviews warnings, publishes schedules.
- Teacher: views assigned timetable and load summary.
- Read-only stakeholders: view published schedules and reports.

## 5. Functional Requirements

| ID           | Requirement                                                                                                                                                                                                                       | Priority | Acceptance Criteria                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| ATLAS-FR-001 | The system must be school-year scoped for all scheduling operations.                                                                                                                                                              | Must     | All generated schedules and load metrics are tied to a single schoolYearId.                                  |
| ATLAS-FR-002 | The system must ingest faculty metadata from EnrollPro using an integration endpoint.                                                                                                                                             | Must     | Faculty import includes active status and designation fields for the selected school year.                   |
| ATLAS-FR-003 | The system must support teacher designation inputs: isClassAdviser, advisoryEquivalentHoursPerWeek, isTic (compat alias isTIC), isTeachingExempt, customTargetTeachingHoursPerWeek, designationNotes, effectiveFrom, effectiveTo. | Must     | Designation values are stored and used in load computation without loss of precision.                        |
| ATLAS-FR-004 | The system must model subjects, sections, grade levels, and required weekly periods per section-subject.                                                                                                                          | Must     | Generator consumes period demand matrix and produces a complete or partially complete plan with diagnostics. |
| ATLAS-FR-005 | The system must model time structures (days, periods, bell windows, breaks).                                                                                                                                                      | Must     | No class is scheduled outside configured valid instructional slots.                                          |
| ATLAS-FR-006 | The system must model locations with capacity, type, and availability windows.                                                                                                                                                    | Must     | Room assignment respects room type and capacity constraints by default.                                      |
| ATLAS-FR-007 | The generator must prevent teacher double-booking and section double-booking.                                                                                                                                                     | Must     | No published schedule contains overlapping assignments for teacher or section.                               |
| ATLAS-FR-008 | The generator must detect room/location conflicts.                                                                                                                                                                                | Must     | No published schedule contains overlapping room allocations in the same time slot.                           |
| ATLAS-FR-009 | The system must compute load metrics per teacher: actualTeachingHours, creditedHours, overloadHours.                                                                                                                              | Must     | Computed values are visible in load reports and API responses.                                               |
| ATLAS-FR-010 | Load semantics must support policy baselines: targetTeachingHours default 30, overload warning range 30-40 actual, over-cap beyond 40 actual.                                                                                     | Must     | Warnings and over-cap flags appear automatically based on computed values.                                   |
| ATLAS-FR-011 | The system must allow valid below-target actual teaching loads for approved designations (adviser, TIC, exempt).                                                                                                                  | Must     | No validation error for below-target actual load when designation conditions are met.                        |
| ATLAS-FR-012 | The system must support manual overrides for generated assignments with full validation.                                                                                                                                          | Must     | Override attempts that create conflicts are blocked with actionable error messages.                          |
| ATLAS-FR-013 | The system must keep schedule versions (draft, published, superseded) per school year.                                                                                                                                            | Must     | Published schedules remain immutable; new changes create a new version.                                      |
| ATLAS-FR-014 | The system must export schedules by teacher, section, and room in CSV and printable format.                                                                                                                                       | Should   | Exports include version metadata and generation timestamp.                                                   |
| ATLAS-FR-015 | The system must expose warnings for underload, overload, room mismatch, and unmet demand.                                                                                                                                         | Must     | Post-generation report enumerates all warnings grouped by severity and entity.                               |

## 6. Data and Validation Requirements

1. Current EnrollPro model must keep one active designation snapshot per teacher and schoolYearId (preventing overlap by design in the present schema).
2. Designation numeric fields must be bounded and non-negative.
3. advisoryEquivalentHoursPerWeek defaults to 5 when isClassAdviser is true and no override is provided.
4. effectiveTo must not be earlier than effectiveFrom.
5. All designation changes must be auditable with updatedBy, updatedAt, and optional reason.
6. Section-subject demand totals must be validated before generation starts.

## 7. Integration and API Requirements

Minimum integration contract with EnrollPro:

1. Faculty sync endpoint includes schoolId and schoolYearId scope.
2. Payload includes teacher identity, active status, section count, designation metadata, and audit fields.
3. ATLAS must support pull-by-school-year and incremental refresh.
4. Integration failures must be retriable and logged with correlation IDs.

Recommended API surfaces:

- GET /teachers/atlas/faculty-sync?schoolYearId=
- POST /atlas/generation-runs
- GET /atlas/generation-runs/:id/report
- POST /atlas/schedules/:version/publish
- GET /atlas/exports?view=teacher|section|room

EnrollPro faculty sync payload contract (minimum required by ATLAS load engine):

- scope: schoolId, schoolYearId
- designation fields per faculty row:
- isClassAdviser
- advisoryEquivalentHoursPerWeek (default 5 when adviser if omitted during designation write)
- isTic
- isTIC (compatibility alias of isTic)
- isTeachingExempt
- customTargetTeachingHoursPerWeek
- designationNotes
- effectiveFrom
- effectiveTo

## 8. Non-Functional Requirements

- Availability: 99.5% monthly for scheduling operations during peak windows.
- Performance: Medium-size school generation target under 3 minutes for baseline configuration.
- Scalability: Must support multi-school and multi-year datasets with tenant-safe separation.
- Reliability: Failed generation runs must not corrupt existing published versions.
- Observability: All generation runs must emit structured logs, run metrics, and diagnostic artifacts.

## 9. Security, Privacy, and Audit

1. Role-based access control must protect generation, override, and publish actions.
2. Read-only users must not mutate schedules.
3. Sensitive integration credentials must be stored in secure environment configuration.
4. Every mutation event must write an audit trail with actor, action, subject, and timestamp.

## 10. MVP Acceptance Criteria

A.T.L.A.S. MVP is acceptable when:

1. Scheduler can generate a full weekly timetable for at least one school year with no hard conflicts.
2. Teacher load computation reflects designation-aware semantics with warnings.
3. Room allocation respects capacity/type constraints.
4. Published schedules are versioned and exportable.
5. Faculty designation integration from EnrollPro is stable and auditable.
