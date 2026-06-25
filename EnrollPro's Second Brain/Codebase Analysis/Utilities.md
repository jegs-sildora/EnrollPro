# Utilities

## Purpose

Documents shared utility and helper modules.

## Summary

Utilities support Prisma access, upload handling, audit context, app errors, query keys, API clients, PDF helpers, motion, hooks, and UI formatting.

## Detailed Analysis

Backend utilities:

- `server/src/lib/prisma.ts`: Prisma client.
- `server/src/lib/context.ts`: audit/request context.
- `server/src/lib/AppError.ts`: application error class.
- `server/src/lib/multer.ts`, `fileUploader.ts`: upload helpers.
- `server/src/lib/tracking.ts`: tracking number or state helper.

Frontend utilities:

- `client/src/shared/api/axiosInstance.ts`: API transport.
- `client/src/shared/lib/queryClient.ts`, `queryKeys.ts`: TanStack Query setup.
- `client/src/shared/lib/utils.ts`: formatting and Tailwind class helpers.
- `client/src/shared/hooks`: page title, school-year context, historical read-only, delayed loading, debouncing, API toast, accessibility, responsive checks.

## Dependencies

- [[Frontend Architecture]]
- [[Backend Architecture]]
- [[Security Architecture]]

## Risks

- Utility modules can become dumping grounds if not scoped.
- Formatting helpers may encode role or DepEd semantics that should live in shared constants.

## Recommendations

- Keep domain-specific helpers near their feature unless reused.
- Move cross-stack constants to `shared/src/constants`.
- Add tests for helpers that encode business rules.

## Related Notes

- [[Dependencies]]
- [[Technical Debt]]

