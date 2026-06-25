# Current Findings

## Purpose

Working list of current audit findings discovered from the repository scan.

## Summary

The main EnrollPro workspace is coherent and feature-oriented, but it carries documentation drift, role compatibility drift, duplicated address/geography APIs, public integration exposure, and a large amount of domain logic concentrated in controllers.

## Detailed Analysis

- The backend contains 21 feature folders under `server/src/features`.
- The frontend contains 15 feature folders under `client/src/features`.
- `server/src/app.ts` mounts both public and protected API modules under one `apiRouter` after `schoolYearContext`.
- `server/prisma/schema.prisma` defines 24 models and 24 enums.
- `docs/features/integration/ENROLLPRO-API.md` is useful but appears partly stale: it mentions `/api/early-registrations` and `/api/curriculum`, while current app mounting centers admissions under `/api/applications` and does not mount a `curriculum` router in `server/src/app.ts`.
- `client/src/store/auth.slice.ts` defines `AuthRole = Role | "REGISTRAR" | (string & {})`, which preserves runtime compatibility but weakens compile-time role guarantees.
- `server/src/middleware/authenticate.ts` supports bearer tokens, cookies, and query tokens. Query-token fallback is convenient but should be reviewed for logging and URL leakage.

## Dependencies

- [[Directory Audit]]
- [[Routes]]
- [[API Architecture]]
- [[Security Architecture]]
- [[Risk Register]]

## Risks

- Stale docs can mislead integrators and AI agents.
- Role drift can produce unauthorized UI visibility or unexpected 403s.
- Controller-heavy modules can make business rule changes risky.

## Recommendations

- Reconcile API docs against live routers.
- Normalize role terminology and retire compatibility-only role names after migration.
- Extract high-risk enrollment, BOSY, EOSY, and sectioning business rules into service-layer functions with tests.

## Related Notes

- [[Technical Debt]]
- [[Refactoring Recommendations]]
- [[Decision Log]]

