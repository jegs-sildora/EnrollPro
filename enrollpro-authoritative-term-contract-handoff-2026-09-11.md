# EnrollPro Developer Handoff: Authoritative Ordered Term Contract

## Purpose

EnrollPro owns the active school year, term format, ordered terms, term labels,
term dates, and active term. ATLAS must consume that authority without asking a
scheduler to reproduce it and without inventing identities or labels.

This is an EnrollPro developer request. The EnrollPro repository is a
`READ_ONLY` reference from ATLAS work; no EnrollPro source was modified.

## Revisions inspected

| System | Clean synced revision | Relevance |
|---|---|---|
| EnrollPro | `bf12d0deb128ada93178bab198c386a315fd8452` | Owning implementation |
| AIMS | `a22c9c88891967f4df9087eeacca3fc9b6a3626f` | Existing active-term consumer |
| SMART | `c3806e12eb7852c58337149c403b7edc4e12abf3` | Existing active-term consumer |
| ATLAS TERM-SUBJ-C01 | `8abc2ab1335be07f5b25f0513a27b9ed12d897d1` | Fail-closed consumer contract |

All three companion worktrees were clean before a fast-forward-only pull and
clean afterward.

## Current EnrollPro behavior

1. `server/src/features/integration/integration.router.ts:32-33` mounts protected
   `GET /api/integration/v1/school-year` and
   `GET /api/integration/v1/active-term`.
2. `server/src/features/integration/integration.shared.ts:123-152` already reads
   `termFormat` plus the four possible start/end date pairs into the resolved
   school-year scope.
3. `server/src/features/integration/integration.controller.ts:120-132` returns
   the year id, label, and dates but omits `termFormat`, ordered term identities,
   ordered display labels, and a complete `terms` collection.
4. `server/src/features/integration/integration.controller.ts:159-181` returns
   only `activeTerm`, a generated `activeTermLabel`, `termFormat`, and
   `schoolYearId`.
5. `server/src/features/integration/integration.controller.ts:168-174`
   silently substitutes `T1`, defaults a missing format to `TRIMESTER`, and
   constructs the label when the current date is outside every configured term.
   This can misstate authority instead of reporting incomplete or out-of-range
   configuration.
6. `ACTIVE-TERM-INTEGRATION.md:21-30` documents the same narrow active-term
   payload and does not define the complete ordered contract ATLAS needs.

## Required contract

EnrollPro should extend its protected integration response so one school-year
read provides a complete ordered term contract. An additive response is
preferred so AIMS and SMART remain compatible.

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
      }
    ]
  }
}
```

The example is structural; the response must include exactly three terms for
`TRIMESTER` and exactly four for `QUARTERS`, in configured order, with EnrollPro
supplying every identity and display label. ATLAS must not synthesize them.

`GET /api/integration/v1/active-term` should continue to expose
`schoolYearId`, `activeTerm`, `activeTermLabel`, and `termFormat`, but its active
identity and label must match one entry in the ordered school-year contract.

## Failure behavior

- If the active school-year pointer is missing, conflicting, or does not resolve
  to exactly one active year, return a typed non-200 integration error.
- If required term entries, identities, labels, order, or format are incomplete,
  return a typed non-200 integration error; do not return a partially authoritative
  success payload.
- If no configured term date range contains the current server time, return a
  typed state such as `ACTIVE_TERM_UNRESOLVED`; do not default to `T1`.
- If an explicit historical `schoolYearId` is supported, return its ordered term
  contract but do not describe a fabricated current active term for that year.
- Preserve the existing integration-key protection and do not expose credentials
  in browser payloads, logs, tests, or documentation.

## ATLAS consumer behavior

At TERM-SUBJ-C01 candidate `8abc2ab1`, ATLAS calls:

- `GET <ENROLLPRO_API>/integration/v1/school-year`
- `GET <ENROLLPRO_API>/integration/v1/active-term`

ATLAS verifies exact school/year agreement, supported format, expected term
count, unique identities, ordered entries, valid date ranges, and an active
identity contained in the ordered contract. Missing identities or labels return
`TERM_ENTRY_INVALID`; an out-of-contract active identity returns
`ACTIVE_TERM_OUTSIDE_CONTRACT`. A verified exact-year cache is used only as a
degraded fallback.

Until EnrollPro supplies the complete contract, ATLAS correctly blocks new
term-authority resolution rather than reverting to manual Curriculum
Requirements or locally invented `T1..Tn` labels.

## Acceptance tests for EnrollPro

1. A trimester fixture returns exactly three ordered entries and a quarters
   fixture returns exactly four.
2. Every returned entry includes a non-empty identity, display label, matching
   one-based order, and its configured nullable or valid date range.
3. Arbitrary configured display labels survive byte-for-byte; consumers need no
   local label map.
4. `activeTerm` and `activeTermLabel` match the same returned entry.
5. Missing identity, label, invalid order, duplicate identity, unsupported
   format, conflicting active year, and no date-matched active term each fail
   with a typed non-200 response.
6. A no-date-match fixture proves the prior silent `T1` fallback is gone.
7. Existing AIMS and SMART active-term consumers continue to read their current
   fields from the additive response.
8. Integration-key rejection remains covered and no secret is returned or
   logged.

## Delivery back to ATLAS

Provide the EnrollPro commit SHA, exact changed paths, endpoint examples for
both formats, test command/results, and the deployed integration base revision.
ATLAS will then run its live term-contract verification and prepare its separate
schema-migration approval. This handoff authorizes no ATLAS migration, derived
demand activation, Teaching Load mutation, generation, or publication.
