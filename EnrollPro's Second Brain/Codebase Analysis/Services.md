# Services

## Purpose

Identifies service-layer and domain-logic organization.

## Summary

The codebase has some service files, but many workflows still appear controller-centered. High-risk domain workflows should be migrated toward explicit service modules with focused tests.

## Detailed Analysis

Known service/util areas:

- `server/src/features/enrollment/services/sectioning-engine.service.ts`
- `server/src/features/enrollment/enrollment-requirement.service.ts`
- `server/src/features/school-year/*.service.ts`
- `server/src/features/learner/*.service.ts`
- `server/src/features/settings/*.service.ts`
- `server/src/features/bosy/bosy.service.ts`
- `server/src/features/students/students.service.ts`
- `server/src/lib/tracking.ts`

Service candidates:

- Application status transitions.
- BOSY confirmation and transfer intent.
- EOSY finalization and history generation.
- Section capacity and assignment rules.
- Audit-log field mapping and presentation.

## Dependencies

- [[Backend Architecture]]
- [[Enrollment Workflow]]
- [[School Operations]]

## Risks

- Controller-heavy logic is harder to test and easier to regress.
- Cross-module workflows can duplicate status rules.

## Recommendations

- Introduce small domain services around status transitions.
- Keep Prisma transaction boundaries explicit in services.
- Add integration tests around service-level workflows.

## Related Notes

- [[Technical Debt]]
- [[Refactoring Recommendations]]

