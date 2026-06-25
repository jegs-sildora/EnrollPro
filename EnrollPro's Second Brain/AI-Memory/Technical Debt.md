# Technical Debt

## Purpose

Catalogs maintainability issues that should be addressed as the system matures.

## Summary

The largest technical debt clusters are documentation drift, route-role inconsistency, controller-heavy business logic, public integration feed hardening, and mixed generated/local artifacts in the repository.

## Detailed Analysis

- Controller concentration: many modules keep workflow rules directly in controllers instead of isolated service functions.
- Role drift: frontend supports compatibility roles that are not Prisma roles.
- Route drift: docs mention groups that do not match mounted routers.
- Integration exposure: read-only public endpoints are useful for companion systems but need explicit privacy controls.
- Generated artifacts: TypeScript build info and uploaded documents/images appear in repo inventory and should stay out of source changes unless intentionally tracked.
- Nested app risk: `SMART/CapstoneFinal` has its own package and server, which increases monorepo confusion.

## Dependencies

- [[Services]]
- [[Routes]]
- [[Security Architecture]]
- [[Directory Audit]]

## Risks

- Business rules become harder to test and reason about.
- Inconsistent docs increase operational support burden.
- Public data feeds can become privacy liabilities.

## Recommendations

- Extract enrollment, sectioning, BOSY, and EOSY rules into tested service modules.
- Generate API docs from router metadata or maintain a route audit note.
- Normalize roles in shared constants and Prisma.
- Add explicit integration-feed allowlist or token strategy.

## Related Notes

- [[Refactoring Recommendations]]
- [[Risk Register]]
- [[Full Audit Report]]

