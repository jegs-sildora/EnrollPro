# System Understanding

## Purpose

Persistent high-level understanding of what EnrollPro is, how it is structured, and where future agents should look first.

## Summary

EnrollPro manages public junior high school enrollment, learner records, sectioning, school-year lifecycle, BOSY/EOSY workflows, teachers, audit logs, and public integration feeds. It is implemented as a TypeScript PERN-style monorepo using React, Express, Prisma, PostgreSQL, Zod, Zustand, and Tailwind CSS v4.

## Detailed Analysis

The backend mounts all API modules in `server/src/app.ts` under `/api`. Feature routers live in `server/src/features/*`. Authentication is JWT-based in `server/src/middleware/authenticate.ts`; authorization is role-based in `server/src/middleware/authorize.ts`.

The frontend is a React 19 Vite app. Route gates are defined in `client/src/router/index.tsx` using `ProtectedRoute`, with persistent auth state in `client/src/store/auth.slice.ts`. Shared UI components live in `client/src/shared/ui`, layouts in `client/src/shared/layouts`, and feature screens in `client/src/features`.

The database schema in `server/prisma/schema.prisma` is the strongest source of truth. Core entities include `User`, `Teacher`, `SchoolYear`, `GradeLevel`, `Section`, `Learner`, `EnrollmentApplication`, `EnrollmentRecord`, `EnrollmentHistory`, `AuditLog`, `HealthRecord`, PSGC geography tables, and SF-related records.

## Dependencies

- `server/prisma/schema.prisma`
- `server/src/app.ts`
- `client/src/router/index.tsx`
- `shared/src/constants/index.ts`

## Risks

- Some docs and API references include routes that are not mounted exactly as described.
- The frontend accepts `REGISTRAR` as a compatibility role, while Prisma role enum does not include it.
- There is a nested SMART app that can be confused with the main workspace.

## Recommendations

- Validate every new workflow against schema, router, and frontend route state.
- Keep cross-system integration documentation linked to [[API Architecture]] and [[Risk Register]].
- Resolve role naming drift through a shared migration plan.

## Related Notes

- [[System Overview]]
- [[Routes]]
- [[Tables]]
- [[User Roles]]

