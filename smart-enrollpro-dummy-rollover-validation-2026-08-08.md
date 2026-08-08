# SMART and EnrollPro Dummy Rollover Validation Handoff

Date: 2026-08-08  
Target: dummy-data validation only, not production-grade academic rollover.

## Current ATLAS State

- ATLAS treats EnrollPro as the active school-year authority.
- ATLAS expects EnrollPro to expose the active school year through `/api/integration/v1/school-year`.
- ATLAS can mirror the active EnrollPro school year and block stale-year generation.
- ATLAS blocks current-year timetable generation until Teaching Load is built and reviewed.
- ATLAS faculty mirror matching has been corrected locally so reused EnrollPro employee IDs do not block rollover sync when external teacher IDs drift.

## SMART Dev Minimum Requirements

For dummy validation, SMART only needs to prove that EnrollPro can receive final outcome data in the expected shape.

Required routes:

- `GET /api/health`
- `POST /api/integration/smart/sections/:sectionId/sync-grades`
- `POST /api/integration/sections/:sectionId/sync-grades`

The two `sync-grades` routes may return dummy values while this remains a test-only validation pass.

Minimum response shape:

```json
{
  "success": true,
  "ready": true,
  "sectionId": 1,
  "outcomesSynced": 4,
  "outcomes": [
    {
      "lrn": "100000000001",
      "studentName": "Test Learner",
      "finalGeneralAverage": 88,
      "finalOutcome": "PROMOTED",
      "publishedAt": "2026-08-08T00:00:00.000Z",
      "revision": 1
    }
  ]
}
```

Dummy `PROMOTED` and `finalGeneralAverage` values are acceptable only when the deployment/configuration makes clear that the source is test-only.

## EnrollPro Dev Minimum Requirements

EnrollPro is the current blocker for full dummy rollover validation.

EnrollPro must do one of the following:

1. Configure SMART base URL and API key so EnrollPro can call SMART's `sync-grades` endpoint.
2. Add a guarded dummy SMART outcome adapter for development only.

Validation must stop failing with `SMART_OUTCOME_MISSING` after dummy outcomes are returned.

After EOSY validation passes, EnrollPro must keep exposing active school-year truth through:

- `GET /api/integration/v1/school-year`
- `GET /api/integration/v1/sections`
- `GET /api/integration/v1/default/faculty`

## Validation Sequence

1. Probe SMART health.
2. Probe SMART section grade sync for one section.
3. Run EnrollPro EOSY or rollover validation.
4. Confirm EnrollPro no longer reports missing SMART outcomes.
5. Confirm EnrollPro exposes the expected active school year.
6. Probe ATLAS rollover status.
7. Apply ATLAS rollover sync.
8. Confirm ATLAS generation is blocked only by expected Teaching Load review state.

## GO / NO-GO Criteria

GO for dummy validation:

- SMART or EnrollPro supplies SMART-like final outcomes.
- EnrollPro consumes those outcomes without `SMART_OUTCOME_MISSING`.
- EnrollPro exposes the expected active school year through integration v1.
- ATLAS rollover status can see the active year and mirror it.
- ATLAS blocks generation with Teaching Load guidance, not active-year drift.

NO-GO:

- EnrollPro still cannot receive or synthesize SMART final outcomes.
- EnrollPro active-year integration endpoint does not reflect the rollover state.
- ATLAS cannot read EnrollPro sections or faculty for the active year.

## Explicitly Out of Scope

- Production-grade SMART grade computation.
- SF9/SF10 academic correctness.
- Cross-system production secrets rotation.
- ATLAS writes back to EnrollPro or SMART.
- Automatic Teaching Load generation as final truth.
