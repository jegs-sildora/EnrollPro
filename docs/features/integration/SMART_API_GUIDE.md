# SMART API Guide

Last reviewed: 2026-08-15

## Ownership

SMART owns grades, learning-area results, final promotion outcomes, and attendance. EnrollPro owns learner identity, enrollment, official section placement, personnel, and school-year context.

SMART never writes to EnrollPro. EnrollPro does not create grades, promotion outcomes, learning-area results, or fallback values when SMART is unavailable.

## Server Configuration

Configure these variables on the EnrollPro server only:

```text
SMART_API_BASE_URL=https://configured-smart-host
SMART_API_KEY=server-only-bearer-token
```

The key is never sent to the browser, returned by EnrollPro, or written to logs.

## Final Outcome Pull

When an authorized EnrollPro administrator selects `Sync SMART Outcomes`, EnrollPro calls the SMART endpoint below:

```text
POST /api/integration/sections/:sectionId/sync-grades?schoolYear=YYYY-YYYY
```

Enrolled learners are matched by their 12-digit LRN. EnrollPro sends the configured server-only token using the `Authorization: Bearer ...` header.

The `sectionId` path value is the shared DepEd section name by default, such as `Bonifacio` or `Makatao`. EnrollPro's local numeric section primary key is not assumed to exist in SMART's separate database.

The EnrollPro staff trigger remains:

```text
POST /api/integration/smart/sections/:id/sync-grades
```

This route requires an authenticated EnrollPro `SYSTEM_ADMIN` session or bearer token. It calls SMART server-side and never exposes the SMART key.

## Automatic Updates Through SMART SSE

EnrollPro also maintains one server-side connection to SMART's:

```text
GET /api/integration/sync/stream
```

The connection uses the server-only `SMART_API_KEY`. Browser pages do not connect
directly to SMART. When SMART publishes a scoped notification containing a section
reference, school-year label, and timestamp, EnrollPro pulls the complete section
outcomes through the same validated synchronization service used by the manual
button. Repeated notifications for one section are coalesced.

After a successful automatic pull, EnrollPro broadcasts its authenticated SSE
invalidation event to EOSY Updating, learner records, the dashboard, and the
integration status views. This means SMART changes appear in EnrollPro without
clicking `Sync SMART` or refreshing the browser. The button remains available for
manual retry and full verification.

If SMART is offline, sends an invalid notification, or returns incomplete final
outcomes, EnrollPro leaves the existing data unchanged or marks the affected
learner as `Action Required`. It never creates fallback grades.

## Required SMART Response

SMART must return the selected school-year label and an outcome for every active learner in the section. Each outcome must include:

- a valid 12-digit `lrn`
- `studentName`
- `subjectGrades`
- `generalAverage` or `finalGeneralAverage`
- `promotionStatus` or `finalOutcome`
- optional `publishedAt`
- optional `revision`

Each `subjectGrades` row must include:

- `subjectCode`
- `subjectName`
- `T1`, `T2`, and `T3`
- `finalRating`
- `remarks`
- `status` set to `GRADED`, `PARTIAL`, or `NG`

For EOSY rollover, every subject must be `GRADED` with a final rating. `PARTIAL` and `NG` rows remain unresolved and keep the learner in `Action Required` status. They do not create or update a finalized EnrollPro academic outcome.

The supported final outcomes are `Promoted`, `Conditionally Promoted`, and `Retained`. EnrollPro normalizes them to `PROMOTED`, `CONDITIONALLY_PROMOTED`, and `RETAINED`.

## Validation and Storage

EnrollPro rejects the complete synchronization request when it contains:

- duplicate LRNs
- an LRN not found in the selected EnrollPro section
- an active EnrollPro learner missing from the SMART response
- an invalid grade or date
- a school-year mismatch
- an invalid promotion outcome

Successful results are stored in the normalized SMART outcome tables with learning-area results, optional publication time and revision, synchronization time, and a payload checksum. Compatibility fields on `EnrollmentRecord` are updated from the same validated result. Learners with `PARTIAL`, `NG`, a null promotion status, or a missing final subject rating remain unresolved and stay marked `Action Required`.

Conditionally promoted deficiency notes are derived only from failed or incomplete learning-area results returned by SMART. EnrollPro does not infer or invent subjects.

The database update is transactional for finalized and unresolved learner states. Valid finalized learners are stored, while learners with incomplete SMART results are cleared back to `Action Required` in the same transaction. A malformed response, duplicate LRN, school-year mismatch, or cross-section learner prevents the section update.

## EOSY and Rollover Order

1. SMART publishes final outcomes.
2. EnrollPro pulls and validates the section outcomes.
3. EnrollPro stores normalized outcomes.
4. Staff resolve all remaining `Action Required` learners.
5. Sections are finalized.
6. SF5 and SF6 artifacts are recorded.
7. The atomic school-year rollover may proceed.

A corrected SMART result invalidates affected form checksums. SMART synchronization occurs before rollover and never inside the rollover transaction.

## Errors

- `401`: SMART rejected the configured bearer token.
- `422`: SMART data is incomplete, mismatched, or not finalized.
- `502`: SMART returned a malformed response.
- `503`: SMART is unavailable or EnrollPro integration is not configured.

EnrollPro does not retry through undocumented endpoints and does not fall back to quarterly grade or local placeholder data.

## EnrollPro Feeds for SMART

SMART reads learner and section context from the protected or compatibility feeds documented in [ENROLLPRO-API.md](./ENROLLPRO-API.md):

```text
GET /api/integration/v1/default/smart/students?schoolYearId=:id
GET /api/integration/v1/sections?schoolYearId=:id
GET /api/integration/v1/sections/:sectionId/learners?schoolYearId=:id
GET /api/integration/v1/school-year?schoolYearId=:id
```

Historical school-year requests use immutable `EnrollmentHistory` data where live enrollment rows have been archived.

Attendance remains entirely in SMART. EnrollPro supplies identity, enrollment, section, and school-year context only.
