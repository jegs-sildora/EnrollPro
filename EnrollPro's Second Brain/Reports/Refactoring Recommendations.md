# Refactoring Recommendations

## Purpose

Prioritized technical roadmap based on the initial audit.

## Summary

Refactoring should focus on correctness and operational safety before cosmetic cleanup. The highest-value work is role normalization, API contract reconciliation, service extraction, integration privacy hardening, and workflow tests.

## Detailed Analysis

Priority 1: Role and authorization cleanup

- Decide the fate of `REGISTRAR`.
- Type backend authorization against shared roles.
- Add a role matrix for routes and frontend navigation.

Priority 2: API documentation reconciliation

- Generate route inventory from `server/src/app.ts` and feature routers.
- Update `docs/features/integration/ENROLLPRO-API.md`.
- Add contract tests for public integration endpoints.

Priority 3: Domain service extraction

- Extract enrollment status transitions.
- Extract BOSY confirmation/transfer workflows.
- Extract EOSY finalization/history generation.
- Extract sectioning capacity and assignment rules.

Priority 4: Security and privacy hardening

- Remove or restrict query-token auth.
- Add scoped credentials or allowlists for integration feeds.
- Review CORS origins and upload serving.

Priority 5: UI consistency and accessibility

- Create canonical status labels.
- Add keyboard and focus tests for modal workflows.
- Audit mobile layouts for dense tables.

## Dependencies

- [[Technical Debt]]
- [[Risk Register]]
- [[Full Audit Report]]

## Risks

- Large refactors without tests can destabilize school-year workflows.

## Recommendations

- Implement each priority as small, build-verified tasks.
- Add tests before changing status transition logic.

## Related Notes

- [[Services]]
- [[Security Architecture]]
- [[Accessibility Review]]
