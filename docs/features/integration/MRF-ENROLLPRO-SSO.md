# MRF EnrollPro SSO

Last reviewed: 2026-09-01

## Status

MRF SSO is intentionally unavailable until its browser callback and landing routes are supplied. EnrollPro keeps the MRF sidebar item visible to eligible users and displays `MRF login is not configured` while either SSO setting is absent.

This is not cross-domain cookie sharing. MRF must never receive an EnrollPro password, JWT, or session cookie.

## Required EnrollPro Configuration

```text
MRF_SSO_CALLBACK_URL=https://configured-mrf-host/auth/enrollpro/callback
MRF_SSO_CLIENT_SECRET=<distinct random secret of at least 32 characters>
```

The callback must use HTTPS outside local development. The secret must not be reused for the MRF identity feed or any other integration.

## MRF Callback Flow

1. Accept `GET /auth/enrollpro/callback?code=<authorization-code>` on the MRF server.
2. Read the code on the server. Do not exchange it from browser JavaScript.
3. Send `POST <ENROLLPRO_BASE_URL>/api/auth/companion-sso/mrf/exchange` with `Authorization: Bearer <MRF_SSO_CLIENT_SECRET>` and the JSON body `{ "code": "<authorization-code>" }`.
4. Require `success: true`, `companion: "MRF"`, an active identity, at least one permitted role, and a valid active school-year object.
5. Map `identity.subject` as the stable external identifier. Reconcile the employee ID and name without changing EnrollPro-owned identity.
6. Create an MRF-owned HTTP-only, Secure, SameSite session cookie.
7. Remove the code from browser history by redirecting to the role dashboard configured by MRF.

## Role Routing

- `SYSTEM_ADMIN` and `MRF` may open MRF.
- All other roles are denied.
- MRF owns the final role-to-dashboard mapping.

## Required Rejections

MRF must reject expired, replayed, wrong-system, malformed, inactive, default-password, JHS-completer, and unauthorized identities. A failed exchange must return the user to EnrollPro with a plain retry message; it must not retry the same code.

Do not log the callback query, authorization code, Bearer secret, identity payload, or session token. Security logs may retain the event result, EnrollPro subject, MRF account ID, time, and non-sensitive denial code.

Signing out of MRF ends only the MRF session. Coordinated logout is not part of this contract.
