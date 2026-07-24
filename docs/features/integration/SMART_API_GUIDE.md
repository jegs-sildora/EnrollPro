# SMART API Guide

Last reviewed: 2026-07-24

## Boundary

SMART owns grades, learning-area results, final promotion outcomes, and attendance. EnrollPro owns learner identity, enrollment, official section placement, personnel, and school-year context.

SMART must not create EnrollPro enrollment records. EnrollPro must not fabricate SMART outcomes.

## Configuration

```text
ENROLLPRO_INTEGRATION_BASE_URL=https://configured-enrollpro-host/api/integration/v1
```

EnrollPro connects to SMART using server-side integration configuration.

## SMART Reads

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Verify EnrollPro integration availability |
| GET | `/school-year` | Resolve active or explicit year |
| GET | `/default/smart/students` | Current or archived SMART-ready learner roster |
| GET | `/sections` | Section and adviser context |
| GET | `/sections/:sectionId/learners` | Current or archived section masterlist |

Pass `schoolYearId` for reconciliation. Current accepted enrollment statuses include officially enrolled, enrolled, and sectioned records.

## Final Outcome Synchronization

EnrollPro calls:

```text
POST /api/integration/smart/sections/:id/sync-grades
```

SMART must return, for every active learner:

- valid LRN
- final general average
- final outcome
- learning-area results
- publication time
- revision

The supported final outcomes are promoted, conditionally promoted, retained, dropped out, and transferred out. Missing, malformed, or unpublished outcomes are rejected.

## EOSY And Rollover

SMART synchronization occurs before section finalization and before SF5 or SF6 artifacts are recorded. A corrected SMART result invalidates stale form checksums. EnrollPro activates the new year only after the atomic rollover commits.

SMART refreshes the new active roster after receiving the post-commit integration invalidation or observing the new value from `/school-year`.

## Attendance

Attendance remains in SMART. EnrollPro provides identity, section, and school-year context only.

See [School Year Lifecycle](ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md) and [EnrollPro API](ENROLLPRO-API.md).
