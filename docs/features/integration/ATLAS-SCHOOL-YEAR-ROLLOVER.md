# ATLAS School Year Rollover

Last reviewed: 2026-08-31

## Purpose

This runbook defines how ATLAS should react when EnrollPro publishes a new
active school year. It supplements the [ATLAS API Guide](./ATLAS_API_GUIDE.md),
which remains the endpoint reference.

ATLAS owns schedules, teaching loads, room assignments, timetable generation,
and published schedule revisions. EnrollPro owns personnel identity, section
structure, official adviser records, enrollment, and school-year context.

## Rollover Rule

ATLAS must not switch school years because a calendar date passed or a target
year exists in either database. It may switch only after EnrollPro successfully
commits rollover and `GET /api/integration/v1/school-year` returns the new active
`schoolYearId` and `yearLabel`.

The ATLAS reconciliation must be idempotent. Repeating it for the same school
and school year must update mirrors without duplicating faculty, sections,
policies, or schedule ownership records.

## Data Treatment

| Data | Source year | New year |
| --- | --- | --- |
| Published schedules and revisions | Preserve as read-only ATLAS history | Start with no published schedule |
| Draft generation runs | Retain under source year or archive by ATLAS policy | Do not copy |
| Teaching loads | Preserve as source-year evidence | Empty and review required |
| Room assignments | Preserve with source timetable | Do not copy |
| Section structure | Keep historical snapshot | Reconcile cloned EnrollPro sections |
| Faculty identity | Keep historical assignment references | Reconcile active EnrollPro faculty |
| Adviser assignment | Preserve source-year history | Empty until a new EnrollPro adviser is assigned |
| Learner placement | Not owned by ATLAS | Read only when required for a published class schedule |

The EnrollPro rollover clones section structure but copies no active adviser,
teaching schedule, or learner. ATLAS must not restore those relationships from
the previous year.

## Before EnrollPro Rollover

ATLAS should:

1. Keep the source school year selected.
2. Preserve current published schedules and their effective revisions.
3. Complete or cancel unfinished generation work according to ATLAS policy.
4. Show the EnrollPro source year as aligned when IDs and labels match.
5. Avoid creating a new-year timetable from a proposed or draft EnrollPro year.

ATLAS availability is not a reason to run EnrollPro rollover early. EnrollPro
does not call ATLAS inside its atomic transaction.

## After EnrollPro Commit

1. Read `/api/integration/v1/health`.
2. Read `/api/integration/v1/school-year` and compare the returned ID and label
   with the ATLAS selected year.
3. Read `/api/integration/v1/sections` through all pages.
4. Read `/api/integration/v1/default/faculty` through all pages.
5. Preview the change set before applying ATLAS mirror updates.
6. Upsert the new year, cloned sections, and active faculty.
7. Mark old adviser links inactive and leave new sections without advisers when
   EnrollPro returns none.
8. Create or verify the ATLAS new-year scheduling policy without copying a
   source timetable.
9. Keep generation blocked until teaching loads, rooms, subjects, advisers, and
   applicable constraints have been reviewed.
10. Record counts, skipped records, source generation time, and completion time.

The EnrollPro administrator may use
`POST /api/integration/atlas/sync-faculty` to ask ATLAS to reconcile faculty.
The EnrollPro SF7 workflow may use `POST /api/sf7/sync-atlas` to pull published
ATLAS assignments into the school-year reporting snapshot. Neither route gives
EnrollPro ownership of the live timetable.

## EnrollPro Feeds

All feeds except health require an approved integration key.

| Feed | ATLAS use |
| --- | --- |
| `GET /api/integration/v1/health` | Connection and dependency status |
| `GET /api/integration/v1/school-year` | Authoritative active-year ID, label, and dates |
| `GET /api/integration/v1/active-term` | Term context for current operations |
| `GET /api/integration/v1/sections` | Grade, program, capacity, roster count, and adviser context |
| `GET /api/integration/v1/default/faculty` | Active personnel, department, designation, and adviser context |
| `GET /api/integration/v1/faculty` | Detailed faculty compatibility feed |

`schoolYearId` should be explicit during reconciliation. ATLAS must follow
pagination and treat an archived year as historical scope.

## Alignment States

| State | Meaning | Required action |
| --- | --- | --- |
| `Aligned` | ATLAS and EnrollPro use the same active year | Continue current operations |
| `ATLAS Needs Update` | EnrollPro has committed a newer active year | Preview and apply reconciliation |
| `EnrollPro Unavailable` | Current authority cannot be verified | Preserve the last snapshot and block year switching |
| `Mapping Conflict` | The EnrollPro ID maps to incompatible ATLAS data | Block apply and require administrator review |
| `Teaching Load Not Yet Prepared` | New sections exist without reviewed loads | Keep schedule generation disabled |
| `Draft Schedule` | A reviewed generation is not yet published | Show staff preview only; do not expose to learners |
| `Published Schedule` | The active-year revision is official in ATLAS | Show the effective schedule to authorized users |

Do not use an old schedule as the new-year default. If the new year has no
published schedule, show `Schedule Not Yet Published`.

## User Experience

### Teacher And Class Adviser

- The source-year schedule remains available under `Archived`.
- The new year initially shows `No Teaching Load Assigned` or
  `Schedule Not Yet Published`.
- A previous advisership must not appear as current unless EnrollPro returns a
  new active assignment.
- Draft schedules are clearly marked and must not replace the published source
  schedule in historical views.

### Learner

- Old schedules remain attached to their old school year.
- No new-year schedule appears before official publication.
- The learner sees only the schedule for the section EnrollPro officially
  assigned for the selected year.
- A pending confirmation, remedial hold, dropout, transfer, or JHS completer
  status must not produce an active new-year schedule.

### Registrar

- Show section and adviser alignment as read-only EnrollPro context.
- Show missing or mismatched sections and faculty without offering enrollment
  changes from ATLAS.
- Provide the last synchronization time and a review link to EnrollPro for
  official placement corrections.

### School Administrator And ATLAS Officer

- Show EnrollPro year, ATLAS year, drift state, row counts, and last sync.
- Require preview before applying new-year mirrors.
- Block generation while teaching load or mapping review remains incomplete.
- Keep the manual retry action available after a network or validation failure.

## Mid-Year Changes

- New sections are upserted under the same active school year.
- Renamed or reconfigured sections require a reviewed mapping update.
- New or returning faculty are reconciled by employee number and stable ATLAS
  mapping, never by name alone.
- Adviser changes update current context without rewriting source-year history.
- Late learners and departures do not authorize ATLAS to alter EnrollPro
  enrollment.

## Failures And Recovery

- Preserve the last successful mirror when EnrollPro is unreachable.
- Never mark an unverified year as aligned.
- Reject incomplete section or faculty payloads instead of creating placeholders.
- If a published schedule exists for a conflicting mapping, do not delete or
  remap it automatically.
- Retry read-only synchronization with bounded backoff.
- Record the failed endpoint, school year, status, and plain corrective action.

## Security And Privacy

Keep EnrollPro and ATLAS keys server-side. Do not synchronize learner health,
parent information, passwords, or unrelated profile fields. Staff using the
configured default password must finish the EnrollPro password-change flow
before ATLAS creates a session and returns them to the original ATLAS address.

## Rollover Completion Checklist

- EnrollPro and ATLAS active-year IDs and labels match.
- New section count and grade/program distribution match EnrollPro.
- Active faculty reconciliation completed with no unresolved employee mapping.
- Source schedules remain historical and unchanged.
- New sections have no copied adviser, teaching load, room, or timetable.
- Generation remains blocked until teaching load review is complete.
- The administrator can see synchronization evidence and retry failures.

## References

- [Microservice Architecture](../../../ARCHITECTURE_MICROSERVICES.md)
- [Shared School Year Lifecycle](./ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md)
- [Personnel And SF7](../personnel/PERSONNEL_AND_SF7.md)

