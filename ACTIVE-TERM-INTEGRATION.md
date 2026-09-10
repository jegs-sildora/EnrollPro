# Authoritative Term Integration

Last reviewed: 2026-09-11

EnrollPro owns the active school year, term format, ordered term identities,
display labels, date ranges, and active term. SMART, ATLAS, AIMS, and MRF must
consume this contract and must not create local term identities or labels.

## Authentication

Both endpoints require an approved server-side integration key through either
`X-Integration-Key` or `Authorization: Bearer <key>`. Keys must never be sent to
browser JavaScript or written to logs.

## Ordered School-Year Contract

`GET /api/integration/v1/school-year`

An optional positive `schoolYearId` returns that year's contract. Without it,
EnrollPro returns the authoritative active year. Legacy date properties remain
in the payload for existing SMART and AIMS consumers; new consumers must use
`terms`.

Trimester example:

```json
{
  "data": {
    "id": 12,
    "yearLabel": "2030-2031",
    "termFormat": "TRIMESTER",
    "terms": [
      { "identity": "T1", "displayLabel": "TERM 1", "order": 1, "startDate": "2030-06-03", "endDate": "2030-09-06" },
      { "identity": "T2", "displayLabel": "TERM 2", "order": 2, "startDate": "2030-09-07", "endDate": "2030-12-18" },
      { "identity": "T3", "displayLabel": "TERM 3", "order": 3, "startDate": "2031-01-04", "endDate": "2031-04-08" }
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

`TRIMESTER` returns exactly `T1` through `T3`. `QUARTERS` returns exactly `T1`
through `T4`. Dates are inclusive Philippine calendar dates in `YYYY-MM-DD`
format. Display labels are stored by EnrollPro and are returned unchanged.

## Active Term

`GET /api/integration/v1/active-term`

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

The current Manila date must match exactly one configured term. The returned
identity and label always come from the same entry in the ordered school-year
contract. This endpoint does not provide an active term for an explicitly
requested historical year.

## Typed Failures

Errors use `{ "error": { "code": "...", "message": "..." } }` and a non-200
status. Consumers must fail closed and may retain only a previously verified
exact-year cache as degraded read-only context.

| Code | Meaning |
| --- | --- |
| `SCHOOL_YEAR_ID_INVALID` | Query value is not a positive integer |
| `ACTIVE_SCHOOL_YEAR_UNINITIALIZED` | EnrollPro has no initialized active year |
| `ACTIVE_SCHOOL_YEAR_CONFLICT` | The settings pointer and active rows disagree |
| `SCHOOL_SETTINGS_UNAVAILABLE` | The authoritative school settings row is missing |
| `SCHOOL_YEAR_NOT_FOUND` | The requested year does not exist |
| `TERM_FORMAT_UNSUPPORTED` | Format is not `TRIMESTER` or `QUARTERS` |
| `TERM_ENTRY_INVALID` | A required label or date is absent |
| `TERM_DATE_RANGE_INVALID` | A term starts after it ends or contains an invalid date |
| `TERM_ORDER_INVALID` | Terms overlap or are not chronologically ordered |
| `ACTIVE_TERM_UNRESOLVED` | No single term contains the current Manila date |
| `HISTORICAL_ACTIVE_TERM_UNAVAILABLE` | Active-term resolution was requested for a historical year |

There is no fallback to `T1`.
