# Security Architecture

## Purpose

Documents authentication, authorization, privacy, and operational security concerns.

## Summary

Security is built around JWT sessions, role-based guards, CORS allowlists, Helmet, audit context, historical read-only protection, and minimized integration feeds. Data privacy remains a high-priority area because learner records and public school operational data are sensitive.

## Detailed Analysis

Authentication:

- `authenticate.ts` verifies JWTs from bearer header, configured cookie, or query token.
- User accounts are checked for `isActive` before request continuation.
- Audit context is updated with `userId`.

Authorization:

- `authorize.ts` permits a route when any user role matches the allowed role list.
- Frontend `ProtectedRoute` provides UI-level route gates but must not be trusted as enforcement.

Operational controls:

- Helmet is enabled with relaxed image and inline script directives.
- CORS uses a static default origin list plus env-provided origins.
- Uploads are served statically under `/uploads`.
- Historical read-only guard protects archived contexts.

## Dependencies

- `server/src/middleware/authenticate.ts`
- `server/src/middleware/authorize.ts`
- `server/src/middleware/historical-read-only.guard.ts`
- `server/src/features/audit-logs`

## Risks

- Query-string tokens can be leaked via logs, browser history, proxy logs, or screenshots.
- Public integration feeds need network and contract controls.
- `authorize` accepts raw strings instead of a shared role enum type.

## Recommendations

- Remove or tightly scope query-token auth.
- Type `authorize` roles with shared `Role`.
- Add integration-feed tokening, allowlists, or mTLS-equivalent controls for production.
- Keep audit logs immutable and exportable for administrative review.

## Related Notes

- [[Risk Register]]
- [[User Roles]]
- [[Audit Trails]]

