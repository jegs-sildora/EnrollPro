# EnrollPro to ATLAS: Authoritative Term Contract Implementation Handoff

Date: 2026-09-11
Status: Implemented in EnrollPro source; correction worktree not yet committed or deployed

## Purpose

EnrollPro now provides ATLAS with the complete authoritative school-year term
contract. ATLAS no longer needs to generate term identities, labels, order, or
date ranges locally.

EnrollPro remains the owner of:

- Active school-year identity
- Term format
- Ordered term identities
- Display labels
- Term start and end dates
- Current active-term resolution

ATLAS remains the owner of schedules, teaching loads, rooms, timetable
generation, and schedule publication.

## Implemented Endpoints

The existing protected endpoints remain unchanged:

```text
GET /api/integration/v1/school-year
GET /api/integration/v1/active-term
```

Both endpoints accept an approved server-side integration key through:

```text
X-Integration-Key: <ATLAS_INTEGRATION_API_KEY>
```

or:

```text
Authorization: Bearer <ATLAS_INTEGRATION_API_KEY>
```

The key must remain on the ATLAS server. It must not be exposed to browser
JavaScript, URLs, logs, or client-visible errors.

## School-Year Response

`GET /api/integration/v1/school-year` now returns `termFormat` and a complete
ordered `terms` collection. The existing date properties remain in the response
for backward compatibility with AIMS and SMART.

Trimester example:

```json
{
  "data": {
    "id": 12,
    "yearLabel": "2030-2031",
    "termFormat": "TRIMESTER",
    "terms": [
      {
        "identity": "T1",
        "displayLabel": "TERM 1",
        "order": 1,
        "startDate": "2030-06-03",
        "endDate": "2030-09-06"
      },
      {
        "identity": "T2",
        "displayLabel": "TERM 2",
        "order": 2,
        "startDate": "2030-09-07",
        "endDate": "2030-12-18"
      },
      {
        "identity": "T3",
        "displayLabel": "TERM 3",
        "order": 3,
        "startDate": "2031-01-04",
        "endDate": "2031-04-08"
      }
    ],
    "term1Start": "2030-06-03T00:00:00.000Z",
    "term1End": "2030-09-06T00:00:00.000Z",
    "term2Start": "2030-09-07T00:00:00.000Z",
    "term2End": "2030-12-18T00:00:00.000Z",
    "term3Start": "2031-01-04T00:00:00.000Z",
    "term3End": "2031-04-08T00:00:00.000Z",
    "term4Start": null,
    "term4End": null
  }
}
```

Quarter example:

```json
{
  "data": {
    "id": 13,
    "yearLabel": "2031-2032",
    "termFormat": "QUARTERS",
    "terms": [
      { "identity": "T1", "displayLabel": "QUARTER 1", "order": 1, "startDate": "2031-06-02", "endDate": "2031-08-15" },
      { "identity": "T2", "displayLabel": "QUARTER 2", "order": 2, "startDate": "2031-08-16", "endDate": "2031-10-31" },
      { "identity": "T3", "displayLabel": "QUARTER 3", "order": 3, "startDate": "2031-11-03", "endDate": "2032-01-30" },
      { "identity": "T4", "displayLabel": "QUARTER 4", "order": 4, "startDate": "2032-02-02", "endDate": "2032-04-10" }
    ]
  }
}
```

Contract rules:

- `TRIMESTER` returns exactly three entries: `T1`, `T2`, and `T3`.
- `QUARTERS` returns exactly four entries: `T1` through `T4`.
- `order` is one-based and must match the identity position.
- Dates use the inclusive `YYYY-MM-DD` Philippine calendar format.
- Display labels are stored by EnrollPro and returned without reconstruction by ATLAS.
- Terms must not overlap and must be chronologically ordered.

An optional canonical positive base-10 integer `schoolYearId` query parameter
returns the complete contract for that specific current or historical year.
Fractions, suffixes, scientific notation, signs, leading zeros, blank values,
unsafe integers, and duplicate query values return
`400 SCHOOL_YEAR_ID_INVALID`.

School-year create and update operations validate the complete merged term
contract before persistence. Invalid dates, missing required entries, overlap,
out-of-order terms, whitespace-only labels, and `QUARTERS` without T4 fail with
a typed 400 response and produce no school-year or audit write. Valid partial
updates preserve persisted values. A format change regenerates unspecified
canonical labels while preserving explicitly supplied valid labels.

## Active-Term Response

`GET /api/integration/v1/active-term` now resolves the current term from the
same validated collection returned by `/school-year`.

```json
{
  "data": {
    "schoolYearId": 12,
    "activeTerm": "T1",
    "activeTermLabel": "TERM 1",
    "termFormat": "TRIMESTER"
  }
}
```

Changes from the previous behavior:

- The silent `T1` fallback was removed.
- Resolution uses the current Manila calendar date.
- The date must match exactly one configured term.
- `activeTerm` and `activeTermLabel` come from the same ordered term entry.
- An explicitly requested historical year cannot produce a current active term.

## Typed Failure Responses

Failures return a non-200 status using:

```json
{
  "error": {
    "code": "ACTIVE_TERM_UNRESOLVED",
    "message": "No single configured term contains the current Manila calendar date."
  }
}
```

| Code | Meaning |
| --- | --- |
| `SCHOOL_YEAR_ID_INVALID` | `schoolYearId` is not a positive integer |
| `ACTIVE_SCHOOL_YEAR_UNINITIALIZED` | EnrollPro has no initialized active year |
| `ACTIVE_SCHOOL_YEAR_CONFLICT` | Active rows and the school-settings pointer disagree |
| `SCHOOL_SETTINGS_UNAVAILABLE` | The authoritative school-settings row is unavailable |
| `SCHOOL_YEAR_NOT_FOUND` | The requested school year does not exist |
| `TERM_FORMAT_UNSUPPORTED` | Term format is not `TRIMESTER` or `QUARTERS` |
| `TERM_ENTRY_INVALID` | A required term label or date is missing |
| `TERM_DATE_RANGE_INVALID` | A date is invalid or a term starts after it ends |
| `TERM_ORDER_INVALID` | Terms overlap or are not chronologically ordered |
| `ACTIVE_TERM_UNRESOLVED` | No single term contains the current Manila date |
| `HISTORICAL_ACTIVE_TERM_UNAVAILABLE` | Active-term resolution was requested for a historical year |

ATLAS must fail closed for these responses. It may show a previously verified
exact-school-year cache as read-only degraded context, but it must not create a
new local term contract or enable schedule publication from unverified data.

## EnrollPro Source Changes

### Shared contract

- Added `shared/src/schemas/integration-term.schema.ts`.
- Added typed identities `T1` through `T4`.
- Added schemas for term entries, school-year contracts, active-term responses,
  and configurable labels.
- Added exact term-count, identity, and order validation.

### Database model

- Added `term1Label`, `term2Label`, `term3Label`, and `term4Label` to
  `SchoolYear`.
- Added an additive migration that backfills existing labels according to
  `termFormat`.
- School-year creation accepts optional term labels and otherwise assigns
  EnrollPro canonical labels.
- Changing the term format refreshes canonical labels unless explicit labels
  are supplied.
- Rollover preserves the source term labels when creating a new-year copy.
- Audit-log field names now include term-label updates.

### Integration service and controllers

- Added one reusable term-contract service.
- `/school-year` validates the complete contract before responding.
- `/active-term` uses the same validated contract.
- Active-school-year pointer conflicts continue to fail closed.
- Removed the unsafe `as any` term-format access.

### Documentation

Updated:

- `ACTIVE-TERM-INTEGRATION.md`
- `ARCHITECTURE_MICROSERVICES.md`
- `docs/README.md`
- `docs/features/integration/ATLAS_API_GUIDE.md`
- `docs/features/integration/ENROLLPRO-API.md`

## Deployment Requirement

The following additive migration must be applied before deploying the updated
server code:

```text
server/prisma/migrations/20260911100000_add_authoritative_term_labels/migration.sql
```

The additive migration was applied to the configured local EnrollPro database
on 2026-09-11 under a separate explicit administrator request. The correction
described in this document added no migration and performed no database write.
The migration added and backfilled label columns; it did not reset, delete,
reseed, or rewrite learner, personnel, enrollment, grade, or schedule records.

After the migration, regenerate the Prisma client and restart the EnrollPro
server before ATLAS performs live verification.

## Verification Completed in EnrollPro

- Seven focused ordered-term tests passed.
- Trimester and quarters counts passed.
- Custom label preservation passed.
- Missing term rejection passed.
- Overlap and ordering rejection passed.
- Active identity and label agreement passed.
- No-date-match rejection passed.
- Duplicate and out-of-order shared-contract rejection passed.
- Prisma schema validation passed.
- EnrollPro server build passed.
- EnrollPro client build passed.
- `git diff --check` passed.

No database migration, rollover, seed, wipe, or companion-system mutation was
executed as part of the correction implementation.

## ATLAS Acceptance Checklist

1. Call `/school-year` with the ATLAS server integration key.
2. Verify the returned year matches the intended EnrollPro year exactly.
3. Verify `termFormat`, term count, identities, labels, order, and date ranges.
4. Call `/active-term`.
5. Verify `schoolYearId` matches `/school-year`.
6. Verify `activeTerm` exists in `terms`.
7. Verify `activeTermLabel` exactly equals that entry's `displayLabel`.
8. Confirm ATLAS blocks activation when EnrollPro returns a typed error.
9. Confirm ATLAS does not synthesize labels or default to `T1`.
10. Confirm existing verified exact-year cache behavior remains read-only during an outage.

## Delivery Metadata

- Base implementation commit SHA: `396a9892c0124d5e85e0586a23ab953efa24c496`
- Correction commit SHA: not created yet
- Deployment revision: not deployed yet
- Local migration status: applied before this correction under a separate explicit request
- ATLAS migration authorization: not granted by this handoff
- ATLAS schedule generation or publication authorization: not granted by this handoff
