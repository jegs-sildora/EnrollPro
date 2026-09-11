# EnrollPro School Year and Term API Changes

**Implementation date:** 2026-09-11  
**Audience:** EnrollPro, ATLAS, AIMS, SMART, and MRF engineering teams  
**Status:** Implemented in EnrollPro

## 1. Purpose

This document consolidates every EnrollPro API, validation, persistence, and rollover change made for the authoritative school-year and term contract.

The implementation gives companion systems one ordered term contract while retaining the legacy school-year date fields required by existing consumers. It also prevents malformed year identifiers or invalid term calendars from being accepted silently.

EnrollPro remains the authority for:

- the active school year;
- the school-year label;
- the term format;
- term display labels;
- term date boundaries; and
- the active term derived from those boundaries.

Companion systems must consume these values through EnrollPro APIs. They must not infer the current year or term from their own local clocks, locally maintained labels, or record recency.

## 2. Mounted API Surfaces

### 2.1 Companion integration reads

The integration router is mounted under `/api/integration/v1`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/integration/v1/school-year` | Returns the authoritative school-year term contract. It also supports an exact current or historical year through `schoolYearId`. |
| `GET` | `/api/integration/v1/active-term` | Returns the term containing the current Manila calendar date for the authoritative active school year. |

Both routes require a machine integration key. EnrollPro accepts the key through either:

```http
X-Integration-Key: <system-specific-key>
```

or:

```http
Authorization: Bearer <system-specific-key>
```

The shared route accepts a configured key from `ATLAS_INTEGRATION_API_KEY`, `SMART_INTEGRATION_API_KEY`, `AIMS_INTEGRATION_API_KEY`, or `MRF_INTEGRATION_API_KEY`. Keys remain server-side and must not be placed in browser code, URLs, or logs.

### 2.2 EnrollPro administrator writes

The school-year router is mounted under `/api/school-years`.

| Method | Route | Authorization | Relevant behavior |
| --- | --- | --- | --- |
| `POST` | `/api/school-years/activate` | Authenticated `SYSTEM_ADMIN` | Creates and activates the initial school year only. Validates the complete term contract before writing. |
| `PUT` | `/api/school-years/:id` | Authenticated `SYSTEM_ADMIN` | Updates a school year. Any term-related change is merged with stored values and validated as a complete contract before writing. |
| `POST` | `/api/school-years/rollover` | Authenticated `SYSTEM_ADMIN` | Retains request body `{ "sourceSchoolYearId": number }`. The new year inherits the persisted term labels. |
| `PATCH` | `/api/school-years/:id/dates` | Authenticated `SYSTEM_ADMIN` | Existing calendar-date endpoint; no new standalone term-label behavior was added here. |
| `GET` | `/api/school-years` | `HEAD_REGISTRAR`, `SYSTEM_ADMIN`, or `TEACHER` | Existing authenticated school-year list. |
| `GET` | `/api/school-years/:id` | `SYSTEM_ADMIN` | Existing school-year detail route. |

`POST /activate` is not a general next-year activation endpoint. It rejects creation when a school year or active-year pointer already exists and instructs the administrator to use the approved rollover operation.

## 3. Authoritative School-Year Read Contract

### 3.1 Request

```http
GET /api/integration/v1/school-year
X-Integration-Key: <key>
```

Omitting `schoolYearId` resolves the authoritative active school year.

To read a specific current or historical school year:

```http
GET /api/integration/v1/school-year?schoolYearId=8
X-Integration-Key: <key>
```

### 3.2 Response

The route now returns:

```json
{
  "data": {
    "id": 8,
    "yearLabel": "2029-2030",
    "termFormat": "TRIMESTER",
    "terms": [
      {
        "identity": "T1",
        "displayLabel": "TERM 1",
        "order": 1,
        "startDate": "2029-06-04",
        "endDate": "2029-09-07"
      },
      {
        "identity": "T2",
        "displayLabel": "TERM 2",
        "order": 2,
        "startDate": "2029-09-10",
        "endDate": "2029-12-14"
      },
      {
        "identity": "T3",
        "displayLabel": "TERM 3",
        "order": 3,
        "startDate": "2030-01-07",
        "endDate": "2030-04-05"
      }
    ],
    "term1Start": "2029-06-04T04:00:00.000Z",
    "term1End": "2029-09-07T04:00:00.000Z",
    "term2Start": "2029-09-10T04:00:00.000Z",
    "term2End": "2029-12-14T04:00:00.000Z",
    "term3Start": "2030-01-07T04:00:00.000Z",
    "term3End": "2030-04-05T04:00:00.000Z",
    "term4Start": null,
    "term4End": null
  }
}
```

The example timestamps on legacy fields are illustrative. Consumers must use the exact values returned by the server.

### 3.3 Ordered term entries

Every item in `terms` contains:

| Field | Type | Meaning |
| --- | --- | --- |
| `identity` | `T1 \| T2 \| T3 \| T4` | Stable machine identity. Store and compare this value in integrations. |
| `displayLabel` | `string` | EnrollPro-owned user-facing label. Display it exactly as returned. |
| `order` | `1 \| 2 \| 3 \| 4` | Authoritative chronological position. |
| `startDate` | `YYYY-MM-DD` | Inclusive start date. |
| `endDate` | `YYYY-MM-DD` | Inclusive end date. |

The cardinality is determined by `termFormat`:

- `TRIMESTER` returns exactly `T1`, `T2`, and `T3`.
- `QUARTERS` returns exactly `T1`, `T2`, `T3`, and `T4`.

The machine identity is intentionally separate from the display label. A companion must not derive `T1` from text such as `TERM 1` or `FIRST QUARTER`.

### 3.4 Backward compatibility

The existing fields `term1Start`, `term1End`, through `term4Start`, and `term4End` remain in the response. This preserves existing AIMS and SMART consumers while ATLAS and newer consumers migrate to the ordered `terms` array.

The legacy fields are compatibility fields, not a second source of truth. New implementations should consume `termFormat` and `terms`.

## 4. Authoritative Active-Term Read Contract

### 4.1 Request

```http
GET /api/integration/v1/active-term
X-Integration-Key: <key>
```

### 4.2 Successful response

```json
{
  "data": {
    "activeTerm": "T1",
    "activeTermLabel": "TERM 1",
    "termFormat": "TRIMESTER",
    "schoolYearId": 8
  }
}
```

### 4.3 Resolution rules

The endpoint:

1. Resolves the authoritative active school year.
2. Builds and validates its complete ordered term contract.
3. Computes today's calendar date in `Asia/Manila`.
4. Finds the one term whose inclusive range contains that date.
5. Returns its stable identity and stored display label.

There is no fallback to `T1`. If zero terms or more than one term matches, the request fails with `ACTIVE_TERM_UNRESOLVED`.

The integration response does not trust the mutable `SchoolYear.activeTerm` column as the authority. The current term is derived from the validated dates so stale manually stored state cannot override the calendar contract.

### 4.4 Historical-year restriction

`GET /active-term?schoolYearId=<historical-id>` is rejected with HTTP `409` and `HISTORICAL_ACTIVE_TERM_UNAVAILABLE`. A historical school year has term definitions but cannot have the institution's current active term.

## 5. Strict `schoolYearId` Parsing

The shared integration scope resolver now uses one strict parser. A supplied `schoolYearId` is accepted only when it is a canonical, positive, base-10 safe integer.

Accepted:

```text
1
8
2030
```

Rejected:

```text
0
-1
+1
01
1.5
1abc
1e2
<blank>
schoolYearId=8&schoolYearId=9
```

Malformed values return HTTP `400`:

```json
{
  "error": {
    "code": "SCHOOL_YEAR_ID_INVALID",
    "message": "schoolYearId must be a positive integer"
  }
}
```

This check occurs before school-year database scope resolution. Values such as `1abc` can no longer be truncated to `1`, and duplicate query parameters cannot accidentally select a year.

## 6. Active School-Year Integrity

School-year reads fail closed unless all of the following are true:

- exactly one `SchoolSetting` row exists;
- `SchoolSetting.activeSchoolYearId` is populated;
- exactly one `SchoolYear` row has status `ACTIVE`; and
- the pointer and active row identify the same school year.

An inconsistent pointer is never resolved by choosing the newest school year or the first active row.

Relevant failures include:

| HTTP | Code | Meaning |
| --- | --- | --- |
| `409` | `ACTIVE_SCHOOL_YEAR_UNINITIALIZED` | No authoritative active year has been initialized. |
| `409` | `ACTIVE_SCHOOL_YEAR_CONFLICT` | The settings pointer and active school-year rows disagree, or the settings cardinality is invalid. |
| `409` | `SCHOOL_SETTINGS_UNAVAILABLE` | Required school settings are unavailable. |
| `404` | `SCHOOL_YEAR_NOT_FOUND` | A valid requested identifier does not exist. |

## 7. Administrator Write Contract

### 7.1 New request fields

The create and update schemas support:

```ts
type TermFormat = "TRIMESTER" | "QUARTERS"

interface TermLabels {
  T1: string
  T2: string
  T3: string
  T4?: string
}
```

For updates, `termLabels` is partial, so an administrator can change one display label without resending every label:

```json
{
  "termLabels": {
    "T2": "SECOND QUARTER"
  }
}
```

Whitespace-only labels are rejected. Valid non-empty labels are preserved exactly rather than normalized or rewritten.

### 7.2 Initial school-year creation

`POST /api/school-years/activate` continues to require `yearLabel`, `classOpeningDate`, and `classEndDate`. It can additionally receive:

- `termFormat`;
- `termLabels`;
- `term1Start` through `term4End`; and
- the existing enrollment and clone fields.

When term dates are omitted, the existing initial schedule builder supplies defaults. Before Prisma writes the school year, EnrollPro builds the complete term contract and validates all required terms, dates, labels, order, and overlap rules.

Default format and labels are:

| Format | Default labels |
| --- | --- |
| `TRIMESTER` | `TERM 1`, `TERM 2`, `TERM 3` |
| `QUARTERS` | `QUARTER 1`, `QUARTER 2`, `QUARTER 3`, `QUARTER 4` |

The internal `term4Label` field still has `QUARTER 4` for a trimester record, but a trimester response returns only three ordered terms.

### 7.3 Updating an existing school year

`PUT /api/school-years/:id` now validates term changes against the complete merged state:

1. Load the stored school year.
2. Merge supplied dates with existing dates.
3. Merge supplied labels with existing labels.
4. Resolve the requested or stored format.
5. Build the entire three-term or four-term contract.
6. Reject an invalid result before the Prisma update, audit write, or realtime broadcast.
7. Persist the complete validated term state in one update.

This prevents a partial update from leaving a school year with missing dates, overlapping terms, or labels incompatible with its format.

When `termFormat` changes:

- unspecified labels reset to the canonical labels for the new format;
- explicitly supplied valid labels are retained; and
- all required dates for the new format must exist and form a valid sequence.

When the format does not change, unspecified labels retain their stored values.

### 7.4 Write-side effects

A rejected term mutation performs no school-year update. Successful existing controller behavior, including audit recording and school-year invalidation, occurs only after validation and persistence succeed.

## 8. Term Validation Rules

The shared term-contract service enforces:

- format is exactly `TRIMESTER` or `QUARTERS`;
- a trimester has exactly three terms;
- a quarter-based year has exactly four terms;
- identities are sequential `T1` through the required final identity;
- orders are sequential `1` through `3` or `4`;
- every returned term has a non-blank display label;
- every required term has a valid start and end date;
- a term start is not after its end;
- each later term starts after the preceding term ends; and
- the current Manila date matches exactly one term before an active term is returned.

Typed term errors are:

| Code | Meaning |
| --- | --- |
| `TERM_FORMAT_UNSUPPORTED` | The format is not `TRIMESTER` or `QUARTERS`. |
| `TERM_ENTRY_INVALID` | A required identity, label, date, or order is missing or malformed. |
| `TERM_DATE_RANGE_INVALID` | A term starts after it ends or contains an invalid date. |
| `TERM_ORDER_INVALID` | Terms overlap or are not strictly chronological. |
| `ACTIVE_TERM_UNRESOLVED` | The current Manila date does not match exactly one configured term. |

Integration read errors use the stable envelope:

```json
{
  "error": {
    "code": "TERM_ORDER_INVALID",
    "message": "T2 must start after T1 ends."
  }
}
```

Administrator controller term-contract failures return HTTP `400` with the typed `code` and message. Request-schema errors also preserve a Zod issue's typed `TERM_ENTRY_INVALID` code when a term label is blank.

## 9. Shared TypeScript Contracts

The workspace package now exports runtime Zod schemas and inferred TypeScript types for:

- `IntegrationTermIdentity`;
- `IntegrationTermLabels`;
- `IntegrationTermEntry`;
- `IntegrationSchoolYearTermContract`; and
- `IntegrationActiveTermContract`.

The school-year response schema verifies the exact number, identity, and order of terms for its format. This allows companion clients to reject malformed EnrollPro responses rather than accepting incomplete calendar state.

No `any` type was introduced. External and caught values use specific types or `unknown`.

## 10. Database Changes

The `SchoolYear` Prisma model now persists four display-label columns:

```text
term1Label -> term1_label
term2Label -> term2_label
term3Label -> term3_label
term4Label -> term4_label
```

Migration:

```text
server/prisma/migrations/20260911100000_add_authoritative_term_labels/migration.sql
```

The migration:

- adds all four columns as non-null text fields;
- assigns safe database defaults;
- backfills trimester records with `TERM 1` through `TERM 3`;
- backfills quarter records with `QUARTER 1` through `QUARTER 4`; and
- sets the stored T4 label to `QUARTER 4`.

This migration was applied previously under an explicit database-migration request. No database reset, seed, rollover, or data deletion was performed as part of the later contract correction.

## 11. Rollover Behavior

The rollover request remains:

```http
POST /api/school-years/rollover
Content-Type: application/json

{
  "sourceSchoolYearId": 8
}
```

No rollover route or request-body contract was added or renamed for this term work.

The rollover service was updated to carry `term1Label`, `term2Label`, `term3Label`, and `term4Label` into the target school-year record together with the existing term format and dates. This prevents the target year from reverting to unrelated presentation labels.

Rollover remains an explicit administrator operation. This implementation did not execute rollover automatically.

## 12. Consumer Expectations

### ATLAS

- Read `/school-year` and use the ordered `terms` array.
- Store the stable `identity` as the integration key.
- Display `displayLabel` exactly as supplied.
- Use `/active-term` when current-term context is required.
- Treat typed `409` responses as configuration blockers, not as permission to default to T1.

### AIMS and SMART

- Existing consumers may continue using the retained legacy date fields during migration.
- New work should adopt `termFormat` and `terms`.
- Neither system may calculate or overwrite EnrollPro's active year or active term.

### MRF

- Use the same school-year identity and term contract when term scope is relevant.
- Do not infer the active year from maintenance records or local timestamps.

### All companion systems

- Cache only with an explicit refresh strategy.
- Keep stable term identities separate from user-facing labels.
- Stop current-term operations on `ACTIVE_TERM_UNRESOLVED` or active-year conflicts.
- Do not display historical data as the current school year.
- Do not use legacy date fields and the ordered array as competing authorities.

## 13. Files Changed

### Initial authoritative-term implementation

- `ACTIVE-TERM-INTEGRATION.md`
- `ARCHITECTURE_MICROSERVICES.md`
- `docs/README.md`
- `docs/features/integration/ATLAS-AUTHORITATIVE-TERM-CONTRACT-HANDOFF-2026-09-11.md`
- `docs/features/integration/ATLAS_API_GUIDE.md`
- `docs/features/integration/ENROLLPRO-API.md`
- `server/prisma/schema.prisma`
- `server/prisma/migrations/20260911100000_add_authoritative_term_labels/migration.sql`
- `server/src/features/audit-logs/field-mapper.ts`
- `server/src/features/integration/integration.controller.ts`
- `server/src/features/integration/integration.shared.ts`
- `server/src/features/school-year/controllers/school-year.admin.controller.ts`
- `server/src/features/school-year/services/school-year-rollover.service.ts`
- `server/src/features/school-year/services/term-contract.service.ts`
- `server/src/features/school-year/services/term-contract.service.test.ts`
- `shared/src/schemas/index.ts`
- `shared/src/schemas/integration-term.schema.ts`
- `shared/src/schemas/school-year.schema.ts`

### Contract-correction implementation

- Added `server/src/features/integration/integration-query.service.ts` for strict integer parsing.
- Added `server/src/features/integration/integration-query.service.test.ts`.
- Added `server/src/features/integration/integration-school-year.route.test.ts` using the mounted integration router.
- Updated `server/src/features/integration/integration.shared.ts` to use and re-export the strict parser.
- Updated `server/src/features/school-year/controllers/school-year.admin.controller.ts` to validate merged create and update contracts before writes.
- Updated `server/src/features/school-year/services/term-contract.service.ts` with typed label resolution and merge behavior.
- Expanded `server/src/features/school-year/services/term-contract.service.test.ts`.
- Updated `shared/src/schemas/integration-term.schema.ts` with strict non-blank labels and partial update labels.
- Updated `shared/src/schemas/school-year.schema.ts` to accept partial term-label updates.
- Updated `server/src/middleware/validate.ts` to preserve typed schema error codes.
- Updated the EnrollPro, ATLAS, and active-term documentation.
- Added `docs/features/integration/ATLAS-AUTHORITATIVE-TERM-CONTRACT-CORRECTION-REPORT-2026-09-11.md`.

Generated build output is not part of the source implementation.

## 14. Verification Completed

The implementation was verified with:

- focused term and integration-route tests: 25 passed, 0 failed;
- Prisma schema validation: passed;
- `pnpm --filter server build`: passed;
- `pnpm --filter client build`: passed;
- `git diff --check`: passed.

The client lint command still reports the repository's pre-existing unrelated lint backlog. No client source was changed by the contract correction.

The mounted-route regression test confirms malformed `schoolYearId` values return `400 SCHOOL_YEAR_ID_INVALID` before database school-year scope resolution.

## 15. Explicit Non-Changes

This work did not:

- modify ATLAS, AIMS, SMART, or MRF source code;
- expose integration keys to browsers;
- remove the legacy term date fields;
- add a fallback active term;
- make `SchoolYear.activeTerm` authoritative for integrations;
- alter the rollover request contract;
- execute a rollover;
- reset or seed the database;
- fabricate a current school year or term when configuration is inconsistent; or
- add Early Registration, hardware, or IoT behavior.

## 16. Canonical Implementation References

For implementation-level truth, use:

1. `server/prisma/schema.prisma`
2. `shared/src/schemas/integration-term.schema.ts`
3. `shared/src/schemas/school-year.schema.ts`
4. `server/src/features/school-year/services/term-contract.service.ts`
5. `server/src/features/school-year/services/active-school-year.service.ts`
6. `server/src/features/integration/integration.shared.ts`
7. `server/src/features/integration/integration.controller.ts`
8. `server/src/features/integration/integration.router.ts`
9. `server/src/features/school-year/school-year.router.ts`

If this document and the mounted implementation differ, the source files above are authoritative.
