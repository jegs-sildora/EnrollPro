# AIMS API Guide

Last reviewed: 2026-07-24

## Boundary

AIMS owns intervention, LMS, and learner-support activity. EnrollPro owns identity, enrollment, grade and section placement, personnel, and school-year context.

AIMS must not write EnrollPro learner placement or infer enrollment from its own course data.

## Configuration

```text
ENROLLPRO_INTEGRATION_BASE_URL=https://configured-enrollpro-host/api/integration/v1
```

## Recommended Reads

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Verify EnrollPro integration availability |
| GET | `/school-year` | Resolve active or explicit school-year context |
| GET | `/default/aims/context` | Read the AIMS-ready learner, grade, section, program, and remedial context |
| GET | `/sections` | Read section metadata and advisers |
| GET | `/default/faculty` | Read active personnel context where instructor identity is required |

Pass `schoolYearId` for deterministic reconciliation. Omit it only when the active year is intended.

## Current And Archived Data

Current feeds use live applications and enrollment records. Explicit archived-year requests use immutable enrollment history where the route supports historical reconciliation.

After atomic rollover, AIMS must wait for the new active year to be returned by `/school-year` before refreshing class context.

## Privacy

Use only the fields required for interventions. Do not request or retain parent, health, password, or unrelated demographic data.

## Errors

- `400` invalid query
- `404` school year or section not found
- `500` unexpected EnrollPro failure
- `503` dependency unavailable

See [EnrollPro API](ENROLLPRO-API.md) for the authoritative route catalog and [School Year Lifecycle](ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md) for refresh timing.
