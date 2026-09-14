# AIMS EnrollPro SSO

Last reviewed: 2026-09-14

## Purpose

This contract lets an eligible EnrollPro user open AIMS without entering another password. EnrollPro transfers a minimized identity assertion; AIMS owns the resulting AIMS session and all intervention or learning activity.

This is not cross-domain cookie sharing. AIMS must never receive an EnrollPro password, JWT, or session cookie.

## EnrollPro Configuration

```text
AIMS_SSO_CALLBACK_URL=https://configured-aims-host/auth/enrollpro/callback
AIMS_SSO_CLIENT_SECRET=<distinct random secret of at least 32 characters>
AIMS_SSO_REVERSE_AUTHORIZE_URL=https://configured-aims-host/auth/enrollpro/authorize
AIMS_SSO_REVERSE_EXCHANGE_URL=https://configured-aims-host/api/v1/auth/sso/exchange
AIMS_SSO_REVERSE_CLIENT_ID=enrollpro
AIMS_SSO_REVERSE_CLIENT_SECRET=<different random secret of at least 32 characters>
```

The callback must use HTTPS outside local development. The secret must not be reused for AIMS feeds or any other integration.

`AIMS_SSO_CLIENT_SECRET` authenticates AIMS to EnrollPro when AIMS exchanges an EnrollPro-issued code. `AIMS_SSO_REVERSE_CLIENT_SECRET` authenticates EnrollPro to AIMS when EnrollPro exchanges an AIMS-issued code. They are separate credentials. `AIMS_API_KEY` is only for data feeds and must never authorize SSO.

## AIMS Callback Flow

1. Accept `GET /auth/enrollpro/callback?code=<authorization-code>` on the AIMS server.
2. Read the code on the server. Do not exchange it from browser JavaScript.
3. Send `POST <ENROLLPRO_BASE_URL>/api/auth/companion-sso/aims/exchange` with `Authorization: Bearer <AIMS_SSO_CLIENT_SECRET>` and the JSON body `{ "code": "<authorization-code>" }`.
4. Require `success: true`, `companion: "AIMS"`, an active identity, at least one permitted role, and a valid active school-year object.
5. Map `identity.subject` as the stable external identifier. Reconcile the employee ID and name without changing EnrollPro-owned identity.
6. Create an AIMS-owned HTTP-only, Secure, SameSite session cookie.
7. Remove the code from browser history by redirecting to the role dashboard.

## Role Routing

- `SYSTEM_ADMIN` redirects to `https://tfrog.buru-degree.ts.net/admin/dashboard`.
- `HEAD_REGISTRAR`, `TEACHER`, and `CLASS_ADVISER` redirect to the matching AIMS workspace selected by AIMS.
- All other roles are denied.

## Required Rejections

AIMS must reject expired, replayed, wrong-system, malformed, inactive, default-password, JHS-completer, and unauthorized identities. A failed exchange must return the user to EnrollPro with a plain retry message; it must not retry the same code.

Do not log the callback query, authorization code, Bearer secret, identity payload, or session token. Security logs may retain the event result, EnrollPro subject, AIMS account ID, time, and non-sensitive denial code.

Signing out of AIMS ends only the AIMS session. Coordinated logout is not part of this contract.

## AIMS to EnrollPro Reverse Flow

The reverse direction mirrors the flow above:

1. The authenticated AIMS sidebar navigates in the same tab to `GET <ENROLLPRO_PUBLIC_URL>/api/auth/companion-sso/aims/reverse/start`.
2. EnrollPro sets signed state in an HTTP-only cookie and redirects to `AIMS_SSO_REVERSE_AUTHORIZE_URL`.
3. AIMS validates its local session, `client_id=enrollpro`, and the exact registered EnrollPro callback.
4. AIMS issues a 60-second single-use code, stores only its SHA-256 hash, and binds it to the AIMS user, client, and callback.
5. AIMS redirects to the EnrollPro callback with the code and unchanged state.
6. EnrollPro calls `AIMS_SSO_REVERSE_EXCHANGE_URL` once with `Authorization: Bearer <AIMS_SSO_REVERSE_CLIENT_SECRET>`.
7. AIMS atomically consumes the code and returns `identity.userId`, using the numeric EnrollPro user ID saved from EnrollPro's earlier outbound SSO assertion.
8. EnrollPro finds `User.id = identity.userId`, creates its own session for an existing active account, and routes by EnrollPro roles.

The reverse response must include `success`, `issuer: "AIMS"`, `identity.userId`, and `authenticatedAt`. Names, employee ID, LRN, subject, roles, and school-year context may be returned but do not participate in EnrollPro account matching. Signed state, the exact callback, the single-use code, issuer validation, and the AIMS reverse Bearer secret remain mandatory.
