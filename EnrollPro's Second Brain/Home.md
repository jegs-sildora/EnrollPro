# EnrollPro Second Brain

## Purpose

Central dashboard for the EnrollPro Obsidian vault. This vault documents the current codebase, architecture, business workflows, risks, and implementation decisions for future developers and AI agents.

## Summary

EnrollPro is a DepEd-aligned enrollment management system for Philippine public junior high schools. The main codebase is a pnpm workspace with `client`, `server`, and `shared` packages. A separate `SMART/CapstoneFinal` grading system also exists in the repository and should be treated as a distinct app unless a task explicitly crosses systems.

## Detailed Analysis

Start onboarding with [[System Understanding]], then read [[System Overview]], [[Directory Audit]], [[Database Architecture]], [[API Architecture]], and [[Enrollment Workflow]]. The source-of-truth order is:

1. `server/prisma/schema.prisma`
2. `shared/src/constants/index.ts` and `shared/src/schemas`
3. `server/src/app.ts`
4. `client/src/router/index.tsx` and `client/src/store`
5. Current documentation under `docs/README.md`

The active app areas are:

- Backend: `server/src/features`, `server/src/middleware`, `server/src/lib`, `server/prisma`
- Frontend: `client/src/features`, `client/src/shared`, `client/src/router`, `client/src/store`
- Shared contracts: `shared/src/constants`, `shared/src/schemas`, `shared/src/types`
- Reference docs: `docs/core`, `docs/features`, `docs/public-APIS`

## Dependencies

- [[Frontend Architecture]]
- [[Backend Architecture]]
- [[Database Architecture]]
- [[API Architecture]]
- [[Security Architecture]]
- [[Executive Summary]]

## Risks

- Some existing docs describe target-state behavior and may diverge from current code.
- Public integration endpoints expose read-only operational data and require ongoing DPA review.
- Role naming is not fully normalized across backend, shared constants, and frontend compatibility types.

## Recommendations

- Treat this vault as a living index and update [[Decision Log]] whenever a meaningful conclusion changes.
- Keep implementation notes linked to code paths and avoid duplicating stale copies of API contracts.
- Prioritize the items in [[Refactoring Recommendations]] before adding new cross-module workflows.

## Related Notes

- [[Current Findings]]
- [[Open Questions]]
- [[Technical Debt]]
- [[Risk Register]]
- [[Full Audit Report]]

