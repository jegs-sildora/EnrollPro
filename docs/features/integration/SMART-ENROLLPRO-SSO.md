# SMART EnrollPro SSO

Last reviewed: 2026-09-14

## Purpose

This contract lets an eligible EnrollPro user open SMART without entering another password. EnrollPro transfers a minimized identity assertion; SMART owns the resulting SMART session, grades, promotion outcomes, and attendance.

This is not cross-domain cookie sharing. SMART must never receive an EnrollPro password, JWT, or session cookie.

## EnrollPro Configuration

```text
SMART_SSO_CALLBACK_URL=https://configured-smart-host/api/auth/enrollpro/callback
SMART_SSO_CLIENT_SECRET=<distinct random secret of at least 32 characters>
SMART_SSO_REVERSE_AUTHORIZE_URL=https://configured-smart-host/auth/enrollpro/authorize
SMART_SSO_REVERSE_EXCHANGE_URL=https://configured-smart-host/api/v1/auth/sso/exchange
SMART_SSO_REVERSE_CLIENT_ID=enrollpro
SMART_SSO_REVERSE_CLIENT_SECRET=<different random secret of at least 32 characters>
```

The callback must use HTTPS outside local development. The secret must not be reused for grade synchronization, SMART SSE, or any other integration.

`SMART_SSO_CLIENT_SECRET` authenticates SMART to EnrollPro for an EnrollPro-issued code. `SMART_SSO_REVERSE_CLIENT_SECRET` authenticates EnrollPro to SMART for a SMART-issued code. `SMART_API_KEY` remains the grade/SSE integration credential and must never authorize SSO.

## SMART Callback Flow

1. Accept `GET /api/auth/enrollpro/callback?code=<authorization-code>` on the SMART server.
2. Read the code on the server. Do not exchange it from browser JavaScript.
3. Send `POST <ENROLLPRO_BASE_URL>/api/auth/companion-sso/smart/exchange` with `Authorization: Bearer <SMART_SSO_CLIENT_SECRET>` and the JSON body `{ "code": "<authorization-code>" }`.
4. Require `success: true`, `companion: "SMART"`, an active identity, at least one permitted role, and a valid active school-year object.
5. Map `identity.subject` as the stable external identifier. Reconcile the employee ID and name without changing EnrollPro-owned identity.
6. Create a SMART-owned HTTP-only, Secure, SameSite session cookie.
7. Remove the code from browser history by redirecting to the role dashboard.

## Role Routing

- `SYSTEM_ADMIN` redirects to `https://laptop-pfvh73qk.buru-degree.ts.net/admin`.
- `HEAD_REGISTRAR`, `TEACHER`, and `CLASS_ADVISER` redirect to the matching SMART workspace selected by SMART.
- All other roles are denied.

## Required Rejections

SMART must reject expired, replayed, wrong-system, malformed, inactive, default-password, JHS-completer, and unauthorized identities. A failed exchange must return the user to EnrollPro with a plain retry message; it must not retry the same code.

Do not log the callback query, authorization code, Bearer secret, identity payload, or session token. Security logs may retain the event result, EnrollPro subject, SMART account ID, time, and non-sensitive denial code.

Signing out of SMART ends only the SMART session. Coordinated logout is not part of this contract.

## SMART to EnrollPro Reverse Flow

1. The authenticated SMART sidebar opens `GET <ENROLLPRO_PUBLIC_URL>/api/auth/companion-sso/smart/reverse/start` in the same tab.
2. EnrollPro creates signed state and redirects to `SMART_SSO_REVERSE_AUTHORIZE_URL`.
3. SMART validates its session, client ID, and exact EnrollPro callback before issuing a 60-second single-use code.
4. SMART stores only the code hash, bound user, client, callback, expiry, and consumption state.
5. EnrollPro exchanges the code once at `SMART_SSO_REVERSE_EXCHANGE_URL` using `SMART_SSO_REVERSE_CLIENT_SECRET`.
6. SMART returns `identity.userId`, using the numeric EnrollPro user ID saved from EnrollPro's earlier outbound SSO assertion.
7. EnrollPro finds `User.id = identity.userId` and creates an EnrollPro-owned session for an existing active account.

Grade finalization, attendance, SF9, and EOSY data must not affect the SSO subject. SSO remains separate from the SMART grade API and SSE channel.

The reverse response must include `success`, `issuer: "SMART"`, `identity.userId`, and `authenticatedAt`. Names, employee ID, LRN, subject, roles, and school-year context may be returned but do not participate in EnrollPro account matching. Signed state, the exact callback, the single-use code, issuer validation, and the SMART reverse Bearer secret remain mandatory.

The SMART reverse exchange endpoint is a server-to-server Bearer-authenticated route. SMART must exempt this exact route from browser CSRF middleware while retaining Bearer validation, request-schema validation, rate limiting, atomic code consumption, and audit logging. A response such as `Invalid or missing CSRF token` is an integration configuration failure, not a user-role denial.

EnrollPro coalesces repeated SMART callbacks carrying the same signed state and authorization code for 30 seconds. SMART should navigate to the EnrollPro reverse callback only once, but accidental concurrent callback requests now share one backend exchange instead of consuming the code twice.

`SMART_SSO_CLIENT_SECRET` and `SMART_SSO_REVERSE_CLIENT_SECRET` are different credentials. The first authenticates SMART when it exchanges an EnrollPro-issued code. The second authenticates EnrollPro when it exchanges a SMART-issued code. A SMART response with `COMPANION_SSO_CLIENT_INVALID` means the deployed `SMART_SSO_REVERSE_CLIENT_SECRET` values do not match; EnrollPro reports this as `COMPANION_REVERSE_SSO_CONFIGURATION_ERROR`, not as an expired authorization code.
