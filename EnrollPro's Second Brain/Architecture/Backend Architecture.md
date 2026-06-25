# Backend Architecture

## Purpose

Documents the Express API, middleware stack, feature module layout, and backend concerns.

## Summary

The backend is an Express 5 TypeScript service using Prisma, JWT auth, Zod validation, cookie parsing, CORS, Helmet, file upload utilities, and feature routers.

## Detailed Analysis

`server/src/app.ts` builds the Express app, configures trusted proxy support, CORS allowlists, Helmet, JSON parsing, cookie parsing, audit context, historical read-only guard, school-year context, API routers, uploads static serving, and the error handler.

Feature modules under `server/src/features` include address, admin, admission, audit logs, auth, BOSY, dashboard, enrollment, enrollment listing, export, geography, integration, learner, reading assessment, remedial, school year, sections, settings, students, system, and teachers.

Middleware:

- `authenticate.ts`: JWT verification from bearer header, cookie, or query token; active-user check.
- `authorize.ts`: role guard.
- `school-year-context.middleware.ts`: request context for active/viewing year.
- `historical-read-only.guard.ts`: protects historical data from mutation.
- `validate.ts`: Zod request validation.

## Dependencies

- Prisma client generated to `server/src/generated/prisma`
- `@enrollpro/shared`
- PostgreSQL through Prisma adapter/pg
- `exceljs`, `multer`, `sharp` for exports/uploads/media

## Risks

- Query-token auth fallback increases token leakage risk.
- Feature controllers can become too large when they own validation, orchestration, and persistence together.
- CORS allowlist includes many tailnet/local origins and must be reviewed before production exposure.

## Recommendations

- Add service-layer extraction for complex workflows.
- Add route inventory tests or generated API docs.
- Review auth middleware for learner-specific payload separation.

## Related Notes

- [[Services]]
- [[Utilities]]
- [[Security Architecture]]
- [[API Architecture]]

