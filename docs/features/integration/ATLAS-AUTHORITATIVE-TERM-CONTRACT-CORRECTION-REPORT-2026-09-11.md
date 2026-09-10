# EnrollPro to ATLAS: Authoritative Term Contract Correction Report

Date: 2026-09-11

Status: Implemented and verified in the EnrollPro worktree; not committed or deployed

## Scope

This report answers the ATLAS correction handoff findings `EP-TERM-01` and
`EP-TERM-02`. The accepted authoritative-term design remains unchanged:

- EnrollPro owns the term format, stable `T1` through `T4` identities, display
  labels, order, inclusive dates, and active-term resolution.
- ATLAS consumes the protected EnrollPro integration endpoints and does not
  synthesize term identities or labels.
- This correction adds no Prisma model change or migration.

## Changes Made

### Strict school-year ID parsing

Added a pure canonical integer parser and routed integration query parsing
through it. `schoolYearId` now accepts exactly one positive, safe, base-10
integer with no sign, suffix, fraction, exponent, whitespace, or leading zero.
Duplicate query values are rejected instead of selecting the first value.

Omitting `schoolYearId` still resolves EnrollPro's authoritative active year.
Malformed values return:

```json
{
  "error": {
    "code": "SCHOOL_YEAR_ID_INVALID",
    "message": "schoolYearId must be a positive integer"
  }
}
```

### Write-time term-contract validation

School-year creation now builds and validates the complete proposed term
contract before `SchoolYear.create()`. Explicit term dates override generated
initial defaults, while omitted trimester dates retain the existing defaults.
A new quarter-format year requires complete T4 dates.

School-year updates now merge partial term input with the persisted row and run
the same production `buildOrderedTermContract()` validation before
`SchoolYear.update()`. Validation covers:

- Required dates for every term in the selected format
- Valid date values
- Start date not later than end date
- Strict chronological ordering
- No overlapping inclusive date ranges
- Nonblank display labels
- Exactly three trimester terms or four quarter terms

Invalid requests return a typed 400 response using `TERM_ENTRY_INVALID`,
`TERM_DATE_RANGE_INVALID`, or `TERM_ORDER_INVALID`. The controller returns
before the Prisma update, active-year pointer changes, realtime broadcast, or
automatic audit write.

### Partial labels and format changes

The update contract now permits a nested partial label update such as:

```json
{
  "termLabels": {
    "T2": "MIDYEAR"
  }
}
```

For an unchanged format, unspecified labels retain their stored values. When
the format changes, unspecified labels are regenerated from the new canonical
format and explicit valid labels are preserved. Accepted labels are returned
byte-for-byte. A whitespace-only label is rejected with
`TERM_ENTRY_INVALID`.

### Typed schema validation

The shared validation middleware now preserves a typed error code supplied by
a Zod issue. Other validation responses keep their existing generic behavior.
This allows blank term labels to fail in middleware with the same
`TERM_ENTRY_INVALID` contract used by the term service.

## Strict-ID Rejection Matrix

| Input | Result |
| --- | --- |
| `3` | Accepted as school-year ID 3 |
| omitted | Resolve authoritative active year |
| `3.5` | `400 SCHOOL_YEAR_ID_INVALID` |
| `3abc` | `400 SCHOOL_YEAR_ID_INVALID` |
| `1e2` | `400 SCHOOL_YEAR_ID_INVALID` |
| `0` | `400 SCHOOL_YEAR_ID_INVALID` |
| `-1` | `400 SCHOOL_YEAR_ID_INVALID` |
| blank or whitespace | `400 SCHOOL_YEAR_ID_INVALID` |
| `03` | `400 SCHOOL_YEAR_ID_INVALID` |
| duplicate values | `400 SCHOOL_YEAR_ID_INVALID` |
| unsafe integer | `400 SCHOOL_YEAR_ID_INVALID` |

## Invalid-Update Zero-Write Matrix

| Invalid update | Typed result | Write behavior |
| --- | --- | --- |
| Missing required date | `TERM_ENTRY_INVALID` | Returns before Prisma update |
| Reversed term range | `TERM_DATE_RANGE_INVALID` | Returns before Prisma update |
| Overlapping terms | `TERM_ORDER_INVALID` | Returns before Prisma update |
| Out-of-order terms | `TERM_ORDER_INVALID` | Returns before Prisma update |
| Whitespace-only label | `TERM_ENTRY_INVALID` | Rejected by middleware before controller |
| `QUARTERS` without complete T4 | `TERM_ENTRY_INVALID` | Returns before Prisma update |

Because each failure exits before persistence, it also produces no active-year
pointer mutation, realtime invalidation, or automatic audit record.

## Exact Changed Paths

- `server/src/features/integration/integration-query.service.ts`
- `server/src/features/integration/integration-query.service.test.ts`
- `server/src/features/integration/integration-school-year.route.test.ts`
- `server/src/features/integration/integration.shared.ts`
- `server/src/features/school-year/controllers/school-year.admin.controller.ts`
- `server/src/features/school-year/services/term-contract.service.ts`
- `server/src/features/school-year/services/term-contract.service.test.ts`
- `server/src/middleware/validate.ts`
- `shared/src/schemas/integration-term.schema.ts`
- `shared/src/schemas/school-year.schema.ts`
- `ACTIVE-TERM-INTEGRATION.md`
- `docs/features/integration/ENROLLPRO-API.md`
- `docs/features/integration/ATLAS-AUTHORITATIVE-TERM-CONTRACT-HANDOFF-2026-09-11.md`
- `docs/features/integration/ATLAS-AUTHORITATIVE-TERM-CONTRACT-CORRECTION-REPORT-2026-09-11.md`
- `docs/README.md`

The generated `server/tsconfig.tsbuildinfo` delta was removed from the
correction worktree.

## Verification

Focused Node tests:

```text
pnpm exec tsx --test \
  src/features/integration/integration-query.service.test.ts \
  src/features/integration/integration-school-year.route.test.ts \
  src/features/school-year/services/term-contract.service.test.ts
```

Result: 25 passed, 0 failed. The mounted integration-router suite passed all
9 malformed-ID HTTP cases. It does not resolve school-year scope or connect to
the database because every case is rejected first by strict query parsing.

The reviewed baseline parser would pass only 4 of the 9 expected rejection
cases; it incorrectly accepted `3.5`, `3abc`, `1e2`, `03`, and duplicate values.
The corrected mounted route passes 9 of 9.

Coverage includes the malformed ID matrix, omitted-ID behavior, trimester and
quarter counts, missing terms, overlap, active-term resolution, no-date-match,
duplicate identities, blank labels, partial label updates, exact label
preservation, format label regeneration, and missing T4 rejection.

Server type-check and build:

```text
pnpm --filter server build
```

Result: passed.

Client build:

```text
pnpm --filter client build
```

Result: passed.

Client lint:

```text
pnpm --filter client lint
```

Result: failed on the repository's existing unrelated frontend backlog with
231 errors and 27 warnings. This correction changes no client source, and no
reported lint finding points to a file changed by this correction.

Prisma schema validation passed. Documentation paths exist and
`git diff --check` passed.

## Delivery State

- Base implementation SHA: `396a9892c0124d5e85e0586a23ab953efa24c496`
- Correction commit SHA: not created
- Deployment revision: not deployed
- New migration required by this correction: no
- Migration applied during this correction: no
- Database data mutated during this correction: no
- Rollover, seed, wipe, timetable generation, and publication executed: no
- ATLAS source modified: no

The earlier additive term-label migration had already been applied to the
configured local EnrollPro database under a separate explicit request before
this correction. This report does not authorize any ATLAS migration, schedule
generation, or publication.
