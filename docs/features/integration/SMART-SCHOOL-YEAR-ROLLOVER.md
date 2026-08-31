# SMART School Year Rollover

Last reviewed: 2026-08-31

## Purpose

This runbook defines how SMART should close one school year and initialize the
next after EnrollPro publishes rollover. It supplements the
[SMART API Guide](./SMART_API_GUIDE.md).

SMART owns grades, learning-area results, final promotion outcomes, attendance,
gradebooks, and academic publication. EnrollPro owns learner identity,
enrollment, official section placement, EOSY workflow, school forms, and the
active school year.

SMART events trigger EnrollPro synchronization. They never write directly to
the EnrollPro database.

## EOSY Finalization Before Rollover

SMART must keep the source school year active while it:

1. Completes T1, T2, and T3 grades for each required learning area.
2. Calculates and publishes the final rating, remarks, general average, and
   promotion outcome under SMART rules.
3. Uses the exact EnrollPro section and school-year context.
4. Includes one unique valid 12-digit LRN for each enrolled learner.
5. Marks incomplete, partial, or no-grade records clearly instead of assigning
   substitute values.
6. Publishes revision and publication time required by the integration contract.
7. Sends a scoped SSE notification after a finalized section changes.

The EnrollPro server then pulls the complete section response. EnrollPro rejects
wrong-year, wrong-grade, wrong-section, duplicate, unmatched, unpublished, or
mathematically inconsistent data. No grade is accepted from a teacher-facing
EnrollPro workflow.

## Synchronization Paths

### Manual Pull

An authorized EnrollPro system administrator uses:

```text
POST /api/integration/smart/sections/:id/sync-grades
```

EnrollPro calls SMART by the shared section name and selected school-year label.
The browser never receives the SMART Bearer token.

### Automatic Notification

EnrollPro maintains one server-side connection to SMART:

```text
GET /api/integration/sync/stream
```

A valid notification identifies the event, section, school year, timestamp,
and optional revision or learner LRNs. EnrollPro coalesces duplicate section
events and runs the same strict synchronization service used by the manual
button.

Authentication failures pause automatic connection attempts. Transport
failures use bounded retries. Existing grades remain unchanged during an
outage, and manual synchronization remains available.

## Accepted Final Academic Data

For a learner to satisfy EOSY readiness, SMART must return:

- a unique valid 12-digit LRN and matching learner name
- exact learning-area names and codes
- `GRADED` status for every required row
- T1, T2, and T3 grades
- final rating and consistent Passed or Failed remarks
- final general average and consistent learner remarks
- `PROMOTED`, `CONDITIONALLY_PROMOTED`, or `RETAINED`
- a valid publication time and supported revision when supplied

`PARTIAL`, `NG`, missing terms, a missing final rating, a null outcome, or an
unpublished result is not final data. EnrollPro records the unresolved reason
and shows `Action Required` or equivalent plain wording.

EnrollPro owns `DROPPED_OUT` and `TRANSFERRED_OUT` as local lifecycle outcomes.
SMART should retain their source-year academic and attendance records but must
not turn them into a new-year active roster.

## Data Treatment During Rollover

| Data | Source year | New year |
| --- | --- | --- |
| Published grades and revisions | Preserve as immutable SMART history | Start empty |
| Attendance | Preserve under source year | Start a new attendance period |
| Learning areas | Preserve exact historical labels and results | Configure for the new class; do not copy learner grades |
| Gradebooks | Lock or archive after publication | Create only for official new-year classes |
| Learner roster | Preserve source-year membership | Ingest only `OFFICIALLY_ENROLLED` learners with a section |
| Promotion outcome | Remain source-year academic evidence | Do not recalculate from EnrollPro carryover status |
| Teacher and adviser context | Preserve historical ownership | Refresh from EnrollPro and ATLAS-owned scheduling context |

SMART must not copy source grades, attendance, subject results, adviser links,
or learner membership into the new year.

## After EnrollPro Commit

1. Verify `GET /api/integration/v1/school-year` returns the new active ID and
   label.
2. Read `/api/integration/v1/default/smart/students` through all pages.
3. Read `/api/integration/v1/sections` and section learner feeds.
4. Create or update empty new-year class and learner mirrors only for official
   section placements.
5. Keep pending confirmations and remedial holds out of active gradebooks.
6. Remove no source-year grade or attendance history.
7. Reconcile incremental roster changes as registrars confirm and section
   learners.
8. Record source generation time, received rows, skipped rows, and completion.

## Learner Outcome Handling

| EnrollPro result | SMART new-year behavior |
| --- | --- |
| Grade 7 to 9 promoted | Wait for confirmation and official next-grade section placement |
| Grade 7 to 9 conditionally promoted | Wait for confirmation and placement; retain source deficiency history |
| Grade 7 to 9 retained | Wait for confirmation and same-grade placement |
| Grade 10 promoted | Keep historical SF9 and attendance; no active JHS gradebook or learner session |
| Grade 10 conditionally promoted | Keep on remedial hold until a reviewed result contract resolves it |
| Grade 10 retained | Wait for Grade 10 confirmation and placement |
| Dropped out or transferred out | Preserve history; do not create active new-year membership |

SMART remedial results require a reviewed contract. EnrollPro currently does not
accept a manually entered summer grade or promotion decision.

## Corrections And School Forms

A corrected SMART final outcome must create a new revision and notification.
After EnrollPro synchronizes it, the changed checksum should make the affected
SF5 and school-wide SF6 artifact stale. Authorized EnrollPro staff record a new
immutable form version after review.

SMART must not edit an EnrollPro school-form artifact or enrollment-history row.
It preserves its own academic revision history.

## User Experience

### Teacher And Class Adviser

- Source-year gradebooks remain read-only after final publication.
- Incomplete learners show the exact missing subject or publication requirement.
- The new-year gradebook appears only after official class synchronization.
- No old grades or attendance appear in editable new-year cells.
- An adviser sees only an EnrollPro-confirmed current advisory assignment.

### Learner

- Historical SF9 grades and attendance remain under the source year.
- New-year grades show `No Grades Yet` until SMART records them.
- Pending confirmation and remedial hold do not appear as active new-year class
  membership.
- JHS completers retain historical records but cannot enter an active JHS portal.

### Registrar

- Show roster alignment, unmatched LRN, missing SMART result, partial grades,
  and last synchronization time.
- Academic fields remain read-only in EnrollPro.
- Enrollment or section corrections link back to EnrollPro, while grade
  corrections remain in SMART.

### School Administrator

- Show SMART connection state, source school year, completed sections,
  unresolved learners, publication revisions, and last successful pull.
- Keep manual `Sync SMART` available as retry and verification.
- Do not mark rollover ready while any final academic result is unresolved.

Use plain states: `Finalized SMART Grades Received`, `Waiting for SMART
Finalization`, `Incomplete Subject Grades`, `Learner Not Matched`, and `SMART
Data Needs Review`.

## EnrollPro Feeds For SMART

All listed feeds require an approved integration key.

| Feed | SMART use |
| --- | --- |
| `GET /api/integration/v1/school-year` | Active or explicit school-year identity |
| `GET /api/integration/v1/active-term` | Current term context |
| `GET /api/integration/v1/default/smart/students` | DPA-minimized official learner rows |
| `GET /api/integration/v1/sections` | Class structure and adviser context |
| `GET /api/integration/v1/sections/:sectionId/learners` | Official section roster or archived roster |

Archived requests may return `source: ENROLLMENT_HISTORY`. SMART must keep its
own detailed grades and attendance; the EnrollPro history feed is enrollment
context, not a replacement academic ledger.

## Failures And Recovery

- Preserve the last finalized SMART revision during EnrollPro or network outage.
- Do not publish placeholder grades to make rollover pass.
- Reject a mismatched school year, section, learner, or LRN.
- Coalesce duplicate notifications but retain the highest applicable revision.
- Retry transport failures with bounded backoff; do not retry rejected
  credentials as a network problem.
- An old-year SMART event must never synchronize into the new active section.

## Security And Privacy

Keep `SMART_API_KEY` server-side. Do not send credentials, raw sensitive
payloads, or learner data to logs. SMART receives only identity and class
context required for grades and attendance. Default-password users must finish
the EnrollPro password-change flow before SMART creates a session and returns
them to the exact approved SMART address.

## Rollover Completion Checklist

- Every required source section has complete published final outcomes.
- EnrollPro synchronization has no unresolved or unmatched learner.
- Source grades and attendance remain historical and unchanged.
- SMART active-year ID and label match EnrollPro after commit.
- New gradebooks contain no copied grades or attendance.
- Only officially sectioned learners enter active classes.
- Grade 10 completers, departures, pending confirmations, and remedial holds are
  excluded from active new-year membership.

## References

- [Microservice Architecture](../../../ARCHITECTURE_MICROSERVICES.md)
- [Shared School Year Lifecycle](./ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md)
- [EnrollPro API](./ENROLLPRO-API.md)
