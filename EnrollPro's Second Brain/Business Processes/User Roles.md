# User Roles

## Purpose

Documents current role concepts and access-control concerns.

## Summary

Canonical Prisma roles are `SYSTEM_ADMIN`, `HEAD_REGISTRAR`, `CLASS_ADVISER`, `TEACHER`, `LEARNER`, and `MRF`. Frontend compatibility also accepts `REGISTRAR`, and backend routes sometimes authorize `REGISTRAR`, creating taxonomy drift.

## Detailed Analysis

Observed role usage:

- `SYSTEM_ADMIN`: system settings, user management, integrations, finalization, admin pages.
- `HEAD_REGISTRAR`: enrollment, sections, students, exports, many registrar workflows.
- `CLASS_ADVISER` and `TEACHER`: teacher EOSY/advisory views and read-focused learner workflows.
- `LEARNER`: self-service portal.
- `MRF`: appears in auth/navigation and staff role pools.
- `REGISTRAR`: used in frontend route compatibility and some backend authorization calls, but absent from Prisma enum.

## Dependencies

- `server/prisma/schema.prisma`
- `shared/src/constants/index.ts`
- `client/src/router/index.tsx`
- `server/src/middleware/authorize.ts`

## Risks

- A role absent from Prisma cannot be assigned normally but may be checked in UI/API code.
- Broad compatibility type `(string & {})` hides role mistakes at compile time.

## Recommendations

- Publish a canonical role matrix.
- Decide whether `REGISTRAR` is retired or migrated into Prisma.
- Type backend `authorize` arguments to shared roles after taxonomy cleanup.

## Related Notes

- [[Security Architecture]]
- [[Open Questions]]
- [[Technical Debt]]

