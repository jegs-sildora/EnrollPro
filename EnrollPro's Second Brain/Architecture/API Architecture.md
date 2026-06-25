# API Architecture

## Purpose

Documents the REST API surface and integration boundaries.

## Summary

All primary backend routes mount under `/api` in `server/src/app.ts`. Routes are modular by feature, with public endpoints for settings, admissions, learner portal, geography, and integration feeds, and protected routes for staff workflows.

## Detailed Analysis

Mounted route groups include:

- `/api/auth`
- `/api/system`
- `/api/settings`
- `/api/dashboard`
- `/api/school-years` and `/api/school-year`
- `/api/sections`
- `/api/sectioning`
- `/api/students`
- `/api/admin`
- `/api/audit-logs`
- `/api/teachers`
- `/api/learner`
- `/api/applications`
- `/api/enrollment-listings`
- `/api/eosy`
- `/api/teacher-eosy`
- `/api/enrollment`
- `/api/export`
- `/api/bosy`
- `/api/reading-assessment`
- `/api/remedial`
- `/api/integration`
- `/api/integration/v1`
- `/api/address`
- `/api/geography`

`docs/features/integration/ENROLLPRO-API.md` is the current human-facing reference, but it should be reconciled with route files.

## Dependencies

- `server/src/app.ts`
- `server/src/features/*/*.router.ts`
- `shared/src/schemas`

## Risks

- Public integration routes can expose more data than necessary if response contracts drift.
- Docs currently appear partly stale.
- Protected and public route groups are mixed under the same API router after school-year context.

## Recommendations

- Maintain a generated route inventory in [[Routes]].
- Add contract tests for integration feeds.
- Add explicit DPA review checklist for public read endpoints.

## Related Notes

- [[Routes]]
- [[Security Architecture]]
- [[DepEd Compliance]]

