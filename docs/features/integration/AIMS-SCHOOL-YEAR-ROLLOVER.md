# AIMS School Year Rollover

Last reviewed: 2026-08-31

## Purpose

This runbook defines how AIMS should preserve source-year learning activity and
initialize new-year learner context after EnrollPro rollover. It supplements the
[AIMS API Guide](./AIMS_API_GUIDE.md).

AIMS owns interventions, LMS courses, assessments, submissions, mastery,
learning resources, and learner-support activity. EnrollPro owns identity,
enrollment, official grade and section placement, learner lifecycle status, and
the active school year.

## Rollover Rule

AIMS may switch its operational year only after EnrollPro commits rollover and
the protected school-year feed returns the new active ID and label. AIMS must
not infer enrollment from an old course, assessment, teacher workspace, or
calendar date.

The synchronization is an idempotent reconciliation keyed by stable learner
identity and school year. Repeating it must not duplicate users, memberships,
courses, intervention plans, or historical activity.

## Data Treatment

| Data | Source year | New year |
| --- | --- | --- |
| Courses and class workspaces | Preserve as read-only or archived AIMS records | Create from approved new-year setup |
| Assessments and submissions | Preserve with original timestamps and ownership | Start empty |
| Mastery and progress | Preserve under source year | Start new progress tracking |
| Intervention plans | Preserve outcome and audit history | Create only when a current need and reviewed workflow require it |
| Learner membership | Preserve historical class membership | Add only official EnrollPro section members |
| Teacher membership | Preserve historical teaching context | Reconcile current faculty and class assignment context |
| Remedial context | Preserve source deficiency evidence | Use only as a support flag; do not decide promotion |

AIMS must not copy a submission, score, mastery value, attendance value,
promotion outcome, or class membership into the new year.

## Before EnrollPro Rollover

AIMS should:

1. Keep the source school year active.
2. Preserve incomplete and completed learning activity under that year.
3. Close or archive intervention work according to AIMS policy without changing
   EnrollPro enrollment.
4. Keep source courses accessible in read-only historical views.
5. Avoid creating active new-year memberships from expected promotions.

AIMS does not write EOSY grades, promotion outcomes, section placement, or
rollover readiness into EnrollPro.

## After EnrollPro Commit

1. Read `GET /api/integration/v1/health`.
2. Verify `/api/integration/v1/school-year` returns the new active ID and label.
3. Read `/api/integration/v1/default/aims/context` through all pages.
4. Read `/api/integration/v1/sections` and faculty context where required.
5. Upsert the new-year learner and section mirrors.
6. Create active class membership only when the learner is
   `OFFICIALLY_ENROLLED` and has an `EnrollmentRecord` for that section.
7. Keep pending confirmation, remedial hold, departure, and completer records
   outside active classes.
8. Reconcile incremental learner placement as BOSY confirmation and sectioning
   continue.
9. Record received, added, changed, skipped, and failed rows with timestamps.

The current EnrollPro integration is read-only for AIMS. There is no mounted
AIMS write-back route for intervention results.

## EnrollPro Context

All feeds except health require an approved integration key.

| Feed | AIMS use |
| --- | --- |
| `GET /api/integration/v1/health` | EnrollPro and dependency reachability |
| `GET /api/integration/v1/school-year` | Active or explicit school-year identity |
| `GET /api/integration/v1/active-term` | Current term context |
| `GET /api/integration/v1/default/aims/context` | Learner, program, grade, section, modality, and remedial context |
| `GET /api/integration/v1/sections` | Section structure, capacity, and adviser context |
| `GET /api/integration/v1/default/faculty` | Active personnel context when instructor identity is needed |

The current AIMS feed contains officially enrolled and sectioned learners. It
does not expose pending confirmations as active class members. Explicit archived
requests use EnrollPro history where supported and identify
`source: ENROLLMENT_HISTORY`.

## Learner Lifecycle Handling

| EnrollPro state | AIMS behavior |
| --- | --- |
| `PENDING_CONFIRMATION` | No active new-year class membership |
| `READY_FOR_SECTIONING` | Wait for an official section record |
| `OFFICIALLY_ENROLLED` with section | Add or update current-year membership |
| Temporarily enrolled | Show required support notice without exposing documentary details |
| Late enrollee | Add after official placement; do not alter earlier class activity |
| `REMEDIAL_HOLD` | Exclude from active intake; preserve source support history |
| `CONDITIONALLY_PROMOTED` | Treat remedial information as support context only |
| `RETAINED` | Wait for confirmation and same-grade placement |
| `DROPPED_OUT` | End active membership and preserve activity history |
| `TRANSFERRED_OUT` | End active membership and preserve activity history |
| `JHS_COMPLETER` | Historical access only; no active JHS class or learner session |

AIMS must not convert a remedial flag into a promotion decision. SMART owns the
academic outcome, and EnrollPro owns whether the learner is eligible for active
intake and placement.

## Mid-Year Reconciliation

### Delayed Sectioning

Do not create an active class while the learner has no official EnrollPro
section. Show `Waiting for Official Section Assignment` to authorized staff.

### Changed Section

Move current-year membership only after the EnrollPro section feed confirms the
change. Preserve completed work and audit the old and new AIMS class references.
Do not copy or delete submissions silently.

### Late Enrollment

Add the learner after official placement. Clearly identify the later membership
start without assigning fabricated earlier submissions, scores, or mastery.

### Dropout Or Transfer

End active access, retain historical course activity, and show the effective
local lifecycle status. Do not delete the learner account or historical work.

### Repeated Or Retained Learner

Create a new school-year membership in the confirmed grade. Keep the prior-year
course and progress record separate even when the grade level repeats.

## User Experience

### Teacher And Class Adviser

- Source-year courses remain available under `Archived` and are read-only after
  closure.
- New class workspaces appear only after current assignment and roster
  synchronization.
- Empty new classes show `No Learners Officially Assigned Yet`.
- Removed learners remain in historical reports but not in active work queues.

### Learner

- Prior submissions, assessments, resources, and progress remain under the old
  school year.
- New-year courses appear only after official placement.
- Pending learners see `Waiting for Enrollment Confirmation` rather than an
  empty or copied class.
- JHS completers and transferred-out learners receive historical access only as
  allowed by policy.

### Registrar

- Show EnrollPro grade, section, program, and learner status as read-only source
  context.
- Provide lists for unmatched learners, delayed sectioning, changed sections,
  and ended memberships.
- Direct identity or placement corrections to EnrollPro.
- Do not expose assessment details not required for enrollment reconciliation.

### School Administrator And AIMS Administrator

- Show EnrollPro year, AIMS year, synchronization state, last success, counts,
  and failures.
- Provide preview, retry, and audit details for roster reconciliation.
- Prevent an administrator from making a draft AIMS year current while
  EnrollPro still reports the source year.
- Preserve the previous successful snapshot during an outage.

Use plain states: `Current School Year Aligned`, `AIMS Needs Update`, `Waiting
for Official Section Assignment`, `Learner Record Needs Review`, `Historical
Course`, and `EnrollPro Unavailable`.

## Archived-Year Views

Archived AIMS views must retain the original school-year label, course,
teacher, section snapshot, assessments, submissions, mastery, and interventions.
They must be read-only and must not use a learner's current section or program to
rewrite old activity.

An EnrollPro archived feed supplies enrollment context only. AIMS remains the
authoritative source for detailed historical LMS and intervention records.

## Failures And Recovery

- Keep the last successful current-year mirror when EnrollPro is unavailable.
- Label stale data with its school year and synchronization time.
- Block automatic year switching on missing, conflicting, or malformed context.
- Reject duplicate stable learner identities within one school year.
- Do not create placeholder sections or infer grade placement from old courses.
- Retry read-only feeds with bounded backoff and support a manual reconciliation.
- Record skipped learners and actionable reasons without logging sensitive data.

## Security And Privacy

Use only the learner, program, section, modality, remedial, and personnel fields
required for AIMS. Do not retain parent information, health records, passwords,
or unrelated demographics. Keep integration credentials server-side.

Staff and learners using a configured default password must complete the
EnrollPro password-change flow before AIMS creates a session and returns them to
the exact approved AIMS address.

## Rollover Completion Checklist

- AIMS and EnrollPro active-year IDs and labels match.
- Source courses and learner activity remain historical and unchanged.
- New courses contain no copied submissions, scores, mastery, or interventions.
- Only officially enrolled and sectioned learners have active membership.
- Pending, held, departed, and completed learners are excluded correctly.
- Changed sections and repeated learners retain separate audit history.
- Administrators can see counts, failures, last synchronization, and retry.

## References

- [Microservice Architecture](../../../ARCHITECTURE_MICROSERVICES.md)
- [Shared School Year Lifecycle](./ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md)
- [Learner Records](../learners/LEARNER_RECORDS.md)
