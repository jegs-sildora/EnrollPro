# EnrollPro School Year Lifecycle

Last reviewed: 2026-08-31

## Purpose

This document is the shared school-year rollover reference for EnrollPro,
SMART, ATLAS, AIMS, and MRF. It explains the operational sequence, the atomic
publication boundary, the records that remain historical, and the point at
which companion systems may begin using a new school year.

The companion runbooks provide system-specific instructions:

- [ATLAS School Year Rollover](./ATLAS-SCHOOL-YEAR-ROLLOVER.md)
- [SMART School Year Rollover](./SMART-SCHOOL-YEAR-ROLLOVER.md)
- [AIMS School Year Rollover](./AIMS-SCHOOL-YEAR-ROLLOVER.md)

The implementation sources of truth are the Prisma schema, shared contracts,
mounted Express routes, and school-year domain services. This guide does not
authorize a rollover or replace the administrator readiness review.

## Ownership And Publication Authority

| System | Authoritative data | Rollover responsibility |
| --- | --- | --- |
| EnrollPro | Learner and personnel identity, enrollment, official section placement, school-year context, adviser records, school forms, and enrollment history | Publishes the new active school year after the atomic transaction commits |
| SMART | Grades, learning-area results, promotion outcomes, and attendance | Publishes complete final outcomes before EnrollPro rollover and starts new-year class records from EnrollPro rosters |
| ATLAS | Schedules, teaching loads, rooms, and published timetable revisions | Mirrors the committed EnrollPro year, then prepares new teaching loads and schedules |
| AIMS | Interventions, LMS activity, assessments, submissions, and mastery | Archives old-year learning activity and creates new class context from official EnrollPro placement |
| MRF | Maintenance, facilities, waste, and related operations | Refreshes only the minimized identity and school-year context it requires |

Only EnrollPro may activate the next operational school year. Companion systems
must not infer a rollover from dates, create a competing section masterlist, or
switch years while EnrollPro still reports the source year as active.

## Authoritative School Year State

`SchoolSetting.activeSchoolYearId` and exactly one `SchoolYear` row with
`status=ACTIVE` must identify the same year. EnrollPro fails closed when the
settings record is missing or duplicated, when no single active row exists, or
when the pointer and active row disagree.

Companion systems resolve current context through the protected integration
feeds. They should store the numeric `schoolYearId`, readable `yearLabel`, and
their last successful synchronization time. An explicit archived
`schoolYearId` is immutable historical scope and must never replace the current
year in a user session.

## Lifecycle Phases

`SchoolSetting.systemPhase` controls the EnrollPro workflow.

| Phase | EnrollPro operations | Companion-system behavior |
| --- | --- | --- |
| `OFFICIAL_ENROLLMENT` | Intake, continuing-learner confirmation, documentary review, and sectioning | Refresh official rosters after placement; do not include pending confirmation as class membership |
| `CLASSES_ONGOING` | Public intake is closed; authorized staff may encode and section late learners; transfers and dropouts remain available | Apply roster additions and departures without changing historical activity |
| `EOSY_CLOSING` | Intake and profile mutations are restricted; SMART outcomes and school forms are prepared | Keep source-year context active until EnrollPro publishes the new year |

EnrollPro has no Early Registration workflow. Incoming Grade 7, transferee,
Balik-Aral, and staff-assisted walk-in processing are enrollment operations.

## Official Enrollment And BOSY

### Continuing Learners

Atomic rollover creates a target-year `EnrollmentApplication` only for an
eligible continuing learner.

1. `PENDING_CONFIRMATION` means the learner has not yet confirmed return.
2. `REMEDIAL_HOLD` means the learner is excluded from active intake pending an
   approved SMART remedial-result contract.
3. Registrar confirmation checks required records and moves an eligible learner
   to `READY_FOR_SECTIONING`.
4. Missing documentary requirements may produce temporary enrollment and
   follow-up, but do not create section membership by themselves.
5. Section placement creates the target-year `EnrollmentRecord` and changes the
   application to `OFFICIALLY_ENROLLED`.

Pending confirmation and remedial hold records are not official SMART or AIMS
class members. ATLAS may see empty cloned sections before any learner is placed.

### New And Returning Intake

Incoming Grade 7, transferees, Balik-Aral learners, and authorized walk-ins use
the current enrollment workflow. EnrollPro validates documentary status, grade,
program, school-year scope, duplicate placement, and section capacity before it
creates an official enrollment record.

### Section Assignment Boundary

EnrollPro owns section names, grade level, program, capacity, rank, order, and
official learner placement. Companion systems consume that placement. A course,
gradebook, timetable, or LMS class in another system cannot enroll a learner in
EnrollPro.

## Classes Ongoing

During classes ongoing:

- authorized late enrollees receive the current school-year and late-enrollee
  context before section placement
- SMART and AIMS add a learner only after an official section record appears
- ATLAS refreshes changed section, faculty, and adviser context without
  rewriting a published historical schedule
- dropped-out and transferred-out learners leave the active population but
  remain visible in the correct historical and audit views
- each system preserves its own attendance, schedule, intervention, and
  transaction history

The authenticated EnrollPro browser stream at `GET /api/events/stream` is for
EnrollPro cache invalidation. It is not a general cross-system event bus.

## EOSY Closing

### SMART Final Outcomes

1. SMART publishes final section outcomes for the active source year.
2. EnrollPro synchronizes a section through
   `POST /api/integration/smart/sections/:id/sync-grades`.
3. The EnrollPro server calls SMART by shared section name and school-year label
   using its server-only Bearer credential.
4. EnrollPro validates the section, Grade 7 to 10 level, school year, unique
   12-digit LRN, learner name, complete T1 to T3 grades, final rating, remarks,
   general average, publication time, and final promotion outcome.
5. `PARTIAL`, `NG`, missing, unpublished, duplicate, mismatched, or malformed
   results remain blockers. EnrollPro does not create fallback grades.
6. Valid outcomes are stored in the versioned `__smartOutcome` envelope and
   compatibility fields are updated from the same validated result.

Teachers and class advisers do not encode or finalize grades in EnrollPro.
SMART owns academic results and attendance. EnrollPro permits local EOSY status
entry only for an official dropout or transfer-out record.

### Section And School Forms

Authorized staff review SMART synchronization status, resolve unmatched
learners, finalize sections, and record immutable SF5 and SF6 artifacts. Each
artifact version stores its source checksum, payload checksum, recording user,
and timestamp. A later SMART correction changes the academic source and should
make the affected SF5 and school-wide SF6 version stale.

Recording a form does not archive learners, activate a school year, or notify a
companion system to switch years.

## Rollover Readiness Contract

The coordinated production contract requires:

- the selected source year is the single active year and is in `EOSY_CLOSING`
- every populated source section is finalized
- every active academic learner has a checksum-valid SMART outcome matching the
  source year, section, final average, and EOSY status
- dropped-out and transferred-out learners have their applicable local status
- every required SF5 and the school-wide SF6 artifact are current
- the consecutive target year has a reviewed complete calendar
- the target year contains no sections, applications, enrollment records,
  history, advisers, designations, schedules, health records, or form artifacts
- no conflicting source-year enrollment history already exists

The readiness endpoint is `GET /api/system/rollover-readiness`. A failed gate
must show plain blockers such as Missing SMART Outcome, SMART Outcome Mismatch,
Unfinished Section, Missing or Stale SF5, Missing or Stale SF6, Target Year Has
Records, Active School Year Conflict, or Enrollment History Conflict.

## Atomic Rollover

`POST /api/school-years/rollover` accepts `sourceSchoolYearId` and is restricted
to a system administrator. The service uses a serializable Prisma transaction
and a PostgreSQL advisory transaction lock.

Inside the transaction, EnrollPro:

1. Rechecks readiness after acquiring the lock.
2. Resolves the consecutive target school year.
3. Clones section name, grade, capacity, program, sort order, grouping flags,
   and rank.
4. Copies no learners, enrollment records, active advisers, teaching schedules,
   or companion-system records into target sections.
5. Creates one immutable `EnrollmentHistory` row per source learner and verifies
   complete history coverage.
6. Applies the Grade 7 to Grade 10 outcome matrix.
7. Creates target-year pending confirmations and Grade 10 remedial holds where
   applicable.
8. Revokes source-year active adviserships.
9. Removes source live applications and enrollment records only after history
   coverage succeeds.
10. Archives the source year, activates the target year, points school settings
    to it, resets the phase to `OFFICIAL_ENROLLMENT`, and writes one rollover
    audit record.

No SMART, ATLAS, AIMS, or MRF network call belongs inside this transaction.

## Outcome Matrix

| Source result | Target-year result |
| --- | --- |
| Grade 7 to 9 `PROMOTED` | Next grade, `PENDING_CONFIRMATION` |
| Grade 7 to 9 `CONDITIONALLY_PROMOTED` | Next grade, `PENDING_CONFIRMATION`, remedial flag retained |
| Grade 7 to 9 `RETAINED` | Same grade, `PENDING_CONFIRMATION` |
| Grade 10 `PROMOTED` | `JHS_COMPLETER`; no active target application |
| Grade 10 `CONDITIONALLY_PROMOTED` | Grade 10 `REMEDIAL_HOLD`; excluded from active intake |
| Grade 10 `RETAINED` | Grade 10 `PENDING_CONFIRMATION` |
| `TRANSFERRED_OUT` | Historical transfer record; no target application |
| `DROPPED_OUT` | Historical dropout record; no automatic target application |

A returning dropout uses the reviewed returning-learner intake process. A JHS
completer must not receive an active learner session in SMART or AIMS.

## Commit And Companion Refresh

The successful rollover response is the publication boundary. After commit,
EnrollPro broadcasts browser invalidations containing the source year, new
active year, rollover time, and event revision. It also sends its optional SMART
webhook. ATLAS and AIMS do not currently receive a shared service event and must
poll or run their documented reconciliation action.

Recommended order:

1. Confirm the rollover request returned success.
2. Read `GET /api/integration/v1/health`.
3. Read `GET /api/integration/v1/school-year` and verify the new ID and label.
4. ATLAS reconciles the active year, empty section structure, and active faculty.
5. Registrars confirm returning learners and complete new-year sectioning.
6. SMART and AIMS ingest only officially sectioned learners.
7. MRF refreshes minimized identity context where required.
8. Each companion records source ID, row counts, completion time, and failures.

## Current And Archived Data

Current-year feeds use live `EnrollmentApplication` and `EnrollmentRecord`
rows. After rollover removes those source-year rows, supported archived feeds
read `EnrollmentHistory` and return `source: ENROLLMENT_HISTORY` in metadata.

Archived views must:

- display the archived school-year label prominently
- remain read-only
- use the historical grade, section, adviser, final average, and EOSY outcome
- keep old schedules, attendance, interventions, submissions, and grades in the
  system that owns them
- never combine archived rows with the current operational roster

## Protected Integration Feeds

Except for health, these routes require an approved integration key through
`X-Integration-Key` or `Authorization: Bearer`:

| Route | Rollover use |
| --- | --- |
| `GET /api/integration/v1/health` | Reachability and dependency status |
| `GET /api/integration/v1/school-year` | Active or explicit school-year identity and dates |
| `GET /api/integration/v1/active-term` | Current term derived from configured dates |
| `GET /api/integration/v1/sections` | Section, grade, program, capacity, count, and adviser context |
| `GET /api/integration/v1/sections/:sectionId/learners` | Official current roster or archived history roster |
| `GET /api/integration/v1/default/faculty` | Active personnel and current-year designation context |
| `GET /api/integration/v1/default/smart/students` | SMART-ready current or archived learner rows |
| `GET /api/integration/v1/default/aims/context` | AIMS-ready current or archived learner context |

Consumers must follow pagination and use `schoolYearId` for deterministic
reconciliation. Stable learner identity is `externalId`; the 12-digit LRN is the
DepEd identifier. Personnel matching uses the EnrollPro employee number where
the specific contract requires it.

## Role-Facing Experience

Every companion screen must show the selected school year, `Current` or
`Archived` state, source status, last successful synchronization, and a clear
retry action when appropriate.

| User | Required rollover experience |
| --- | --- |
| Teacher or class adviser | Retain read-only old-year records; show no new assignment, gradebook, or class until the owning workflow publishes it |
| Learner | Retain historical grades and activity; show new-year data only after official placement and companion synchronization |
| Registrar | Show roster alignment, pending confirmation, unmatched learner, departure, and sectioning status without permitting companion data to change enrollment |
| School administrator | Show readiness, active-year alignment, synchronization progress, row counts, failures, and audit evidence |

Do not replace old content with an empty current-year view while synchronization
is still running. Use plain DepEd wording such as Waiting for New School Year
Data, Roster Needs Review, No Adviser Assigned, and Schedule Not Yet Published.

## Reliability, Privacy, And Audit

- Synchronization is an idempotent upsert keyed by stable identity and school
  year; do not match by name alone.
- Preserve the last successful snapshot during an outage and label it with its
  year and synchronization time.
- Never switch to a year that EnrollPro has not published as active.
- Do not connect directly to the EnrollPro PostgreSQL database.
- Do not copy passwords, parent details, health records, or unrelated learner
  information into companion systems.
- Do not expose integration keys in browser code, logs, screenshots, or API
  responses.
- Record endpoint, school-year ID, generated time, row count, skipped rows, and
  failure reason for each reconciliation.
- Do not fabricate a grade, schedule, adviser, intervention, enrollment, or
  promotion outcome when an owning system is unavailable.

Staff using a configured default password must complete the EnrollPro password
change flow before a companion system creates its own session. The companion
must supply and restore its exact approved `returnTo` address.

## Code-Verified Release-Safety Gaps

The following current implementation details differ from the coordinated
production contract and must be treated as release blockers, not approved
rollover behavior:

1. If no target-year shell exists, the rollover service currently creates one
   by adding one year to source dates. A reviewed next-year calendar is not
   guaranteed.
2. Current readiness can count SF5 as acceptable for a finalized or empty
   section even when no current artifact exists.
3. SF6 status is calculated, but the current rollover readiness gate does not
   block when SF6 is missing or stale.
4. The academic phase endpoint currently accepts movement between any of the
   three phases instead of enforcing forward-only transitions.
5. EnrollPro browser SSE and the SMART webhook do not provide a shared ATLAS or
   AIMS event bus. Those systems require explicit post-commit reconciliation.
6. The active-term feed currently defaults to T1 when the date is outside every
   configured term. Consumers must display the returned term as EnrollPro
   context and must not infer rollover from it.
7. The SMART synchronization service still contains an environment-controlled
   development fallback that can generate academic values. It must remain
   disabled in production and should be removed before rollover approval.
8. SMART publication time is optional in the current response schema and is not
   required by rollover matching. The production contract requires published
   final outcomes, so a missing publication time must not be treated as final.

Until these gaps are remediated and verified, administrators must not treat a
green screen alone as sufficient evidence for a coordinated production
rollover.

## References

- [Microservice Architecture](../../../ARCHITECTURE_MICROSERVICES.md)
- [EnrollPro API](./ENROLLPRO-API.md)
- [Subsystem Quick Start](./SUBSYSTEM_API_QUICK_START.md)
- [School Year Operations](../school-year/SCHOOL_YEAR_OPERATIONS.md)
