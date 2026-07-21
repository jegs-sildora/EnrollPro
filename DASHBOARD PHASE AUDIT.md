# Master Dashboard Phase Audit

## Scope and Sources of Truth

This audit describes the implemented EnrollPro Master Dashboard and its supporting API controls.

The implementation is verified against:

- `server/prisma/schema.prisma` for school-year, learner, personnel, section, and enrollment state.
- `server/src/features/dashboard/dashboard.controller.ts` for dashboard calculations.
- `server/src/features/settings/enrollment-gate.service.ts` for public and staff intake rules.
- `server/src/middleware/staff-intake-phase.guard.ts` for EOSY mutation enforcement.
- `client/src/features/dashboard` for the phase-aware dashboard interface.
- `ARCHITECTURE_MICROSERVICES.md` for companion-system ownership boundaries.

SMART remains the source of truth for attendance and academic records. EnrollPro owns learner identity, enrollment status, curriculum placement, section membership, personnel identity, and school-year context. The dashboard provides a gateway to SMART; it does not duplicate attendance records.

## Dashboard Phase Mapping

| Stored academic phase | Dashboard mode | Intake behavior |
| --- | --- | --- |
| `PRE_REGISTRATION` | Enrollment Operations | Staff workflow available according to role; regular public online enrollment remains closed |
| `BOSY_ENROLLMENT` | Enrollment Operations | Staff workflow available according to role; regular public online enrollment remains closed |
| `OFFICIAL_ENROLLMENT` | Enrollment Operations | Public online enrollment opens only inside the configured enrollment dates |
| `CLASSES_ONGOING` | Classes Ongoing | Public online enrollment is closed; authorized late walk-in encoding remains available |
| `EOSY_CLOSING` | EOSY Closing | Public and staff intake mutations are locked |
| Archived school year | Historical Outcomes | Read-only historical enrollment, section, and EOSY results |

## Summary Ribbon

The four summary cards remain visible in every dashboard mode.

| Metric | Calculation | School-year behavior |
| --- | --- | --- |
| Total Enrolled Learners | Active sectioned enrollment records plus confirmed unassigned applications | Uses `EnrollmentHistory` for archived school years |
| Active Faculty Roster | Teachers where `isActive` is true and `serviceStatus` is `ACTIVE` | Current active personnel roster |
| Total Enrolled Sections | Sections with at least one active learner | Uses historical section enrollment counts for archived years |
| Learner Records for Review | Distinct learners with verification, section placement, missing requirements, LRN, or SF1 information issues | A learner is counted once even when several issues exist |

## Enrollment Operations Workspace

This workspace is used for enrollment preparation, BOSY enrollment, and official enrollment. EnrollPro does not manage the DepEd Early Registration process and does not include Early Registration in dashboard totals.

| Widget | Purpose | Route | Zero state |
| --- | --- | --- | --- |
| Pending Enrollment | Applications awaiting school verification | `/continuing-learners?tab=incoming` | `No Pending Enrollment Records` |
| Unsectioned Learners | Confirmed learners waiting for an SF1 section | `/monitoring/enrollment` | `All Enrolled Learners Have Sections` |
| Missing School Requirements | Learners requiring SF9, PSA, or other school requirement follow-up | `/continuing-learners?tab=incoming` | `All Required Documents Recorded` |
| Curriculum Enrollment Distribution | Active learners grouped by effective program | Informational | Basic Education Curriculum remains visible at zero |
| Enrollment Records by Grade | Continuing learner, walk-in learner, and transferee totals by grade | Informational | Grade rows remain visible at zero |
| Active Section Capacity | Enrollment against each configured section limit | `/sections` | Shows that no sections are configured when empty |
| SF1 Learner Information Check | LRN, birthdate, mother tongue, current address, and guardian contact checks | `/students` | `Records Complete` |

Curriculum distribution uses the learner's section program when sectioned, then assigned program, then applicant program. `LATE_ENROLLEE` is reported under regular Basic Education Curriculum.

## Classes Ongoing Workspace

| Widget | Purpose | Route | Zero state |
| --- | --- | --- | --- |
| Late Learners to Process | Campus walk-in records awaiting verification | `/continuing-learners?tab=incoming` | `Zero Pending Late Registrations` |
| Unsectioned Learners | Verified learners not yet listed in an SF1 section | `/monitoring/enrollment` | `All Enrolled Learners Have Sections` |
| Missing School Requirements | Temporary enrollment requirements still unresolved | `/continuing-learners?tab=incoming` | `All Required Documents Recorded` |
| Current Enrollment Count | Verified BOSY enrollment plus late enrollees minus officially dropped learners | Informational | All components remain visible at zero |
| Section Capacity | Overload and section disparity review | `/sections` | Within-capacity state |
| SF1 Compliance | Learner profile data required by SF1 | `/students` | `Records Complete` |
| SMART Attendance Gateway | Opens SMART attendance | `/smart` | EnrollPro does not calculate attendance |

Transferred-out enrollment records do not inflate the active BOSY baseline. A dropped learner remains part of the original BOSY or late-admission input and is subtracted once in the displayed formula.

## EOSY Closing Workspace

| Widget | Purpose | Route | Zero or ready state |
| --- | --- | --- | --- |
| Sections Pending Finalization | Sections whose EOSY records are not final | `/eosy?status=pending` | `All Class Sections Finalized` |
| Incomplete Learner Outcomes | Active learners without a final EOSY status | `/eosy` | `All Learner Outcomes Recorded` |
| Academic Deficiency Backlog | Conditionally promoted and retained learners | `/eosy` | `No Academic Deficiency Cases` |
| Promotion and Finalization Progress | Percentage of active learner outcomes recorded | Informational | Zero percent when no outcomes exist |
| Grade-Level Completion | Finalized sections by grade | `/eosy?gradeLevelId=:id&status=pending` | Grade cards remain visible |
| SF5 Readiness | All sections and learner outcomes complete | Informational | Ready only when both pending counts are zero |
| SF6 Readiness | School-level totals complete | Informational | Ready only when both pending counts are zero |

The dashboard disables learner intake controls during EOSY. The server independently rejects protected intake and section-placement mutations with `EOSY_INTAKE_LOCKED`.

## Quick Action and Permission Matrix

| Action | Dashboard phases | Roles | Destination or behavior |
| --- | --- | --- | --- |
| Walk-In Learner Encoding | Enrollment Operations and Classes Ongoing | `REGISTRAR`, `HEAD_REGISTRAR`, `SYSTEM_ADMIN` | Opens `/continuing-learners?tab=incoming&action=walk-in` and the walk-in encoder |
| Upload School Forms | Enrollment Operations and Classes Ongoing | `HEAD_REGISTRAR`, `SYSTEM_ADMIN` | Opens a chooser for SF1 or SF7 workflows |
| Learner SF1 Roster | Enrollment Operations and Classes Ongoing | `HEAD_REGISTRAR`, `SYSTEM_ADMIN` | Opens `/sections` for section selection and SF1 roster actions |
| Personnel SF7 Roster | Enrollment Operations and Classes Ongoing | `HEAD_REGISTRAR`, `SYSTEM_ADMIN` | Opens `/teachers` for SF7 Actions |
| Auto Assign Sections | Enrollment Operations and Classes Ongoing | `HEAD_REGISTRAR`, `SYSTEM_ADMIN` | Opens `/monitoring/enrollment` |
| Monitor Final Grades | EOSY Closing | Authorized EOSY users | Opens `/eosy` |

Unauthorized roles see disabled controls rather than controls that fail after navigation. Archived school years replace the toolbar with a read-only notice.

## Backend Mutation Enforcement

The UI state is not the security boundary. The API also enforces phase restrictions.

### Public enrollment

The following public mutations call the public enrollment gate:

- `POST /api/admission`
- `POST /api/admission/update-existing`

Both require:

- `systemPhase` equal to `OFFICIAL_ENROLLMENT`
- configured enrollment opening and closing dates
- current Manila date inside the configured range

When closed, the API returns `403` with `PUBLIC_ENROLLMENT_CLOSED`.

### Authorized staff intake

Staff walk-in processing remains allowed during `CLASSES_ONGOING`. It is blocked during `EOSY_CLOSING` for:

- walk-in and special enrollment
- confirmation-slip and batch confirmation actions
- intake finalization and documentary status changes
- BOSY confirmation, reversal, transfer-out, and bulk confirmation
- draft and bulk section assignment commits
- inline section placement
- SF1 roster import commit

The shared route guard returns `403` with `EOSY_INTAKE_LOCKED`.

## Public Closed-Registration Page

During classes ongoing, the public page shows:

- configured school crest and school name
- active school year
- a clear notice that online applications are closed
- instructions to visit the School Registrar's Office for authorized late walk-in enrollment
- a short list of common school requirements

During EOSY Closing or any other closed window, the page remains closed and does not offer an online submission path.

## Archived School Years

Archived dashboards use `EnrollmentHistory` for total enrollment, curriculum totals, section occupancy, promotion, retention, transfer-out, dropout, and Grade 10 completer outcomes. Operational queue counts are zero and mutation controls are removed. Historical section review remains subject to the global read-only guard.

## Realtime Refresh

Dashboard data listens for the shared realtime invalidation topics `dashboard:summary` and `settings:public`. Enrollment, learner, personnel, section, school-year, and EOSY mutations broadcast these topics as appropriate, so the active dashboard reloads without a browser refresh.
