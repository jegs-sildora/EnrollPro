# ATLAS EnrollPro SSO

Last reviewed: 2026-09-17

## Purpose

This contract lets an eligible EnrollPro user open ATLAS without entering another password. EnrollPro transfers a short-lived identity assertion; ATLAS still owns and creates the ATLAS session.

This is not cross-domain cookie sharing. ATLAS must never receive an EnrollPro password, JWT, or session cookie.

## Effective EnrollPro Configuration

```text
ENROLLPRO_PUBLIC_URL=https://dev-jegs.buru-degree.ts.net
ATLAS_SSO_CALLBACK_URL=https://njgrm.buru-degree.ts.net/auth/sso/callback
ATLAS_SSO_CLIENT_SECRET=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
ATLAS_SSO_REVERSE_AUTHORIZE_URL=https://njgrm.buru-degree.ts.net/auth/sso/authorize
ATLAS_SSO_REVERSE_EXCHANGE_URL=https://njgrm.buru-degree.ts.net/auth/sso/exchange
ATLAS_SSO_REVERSE_CLIENT_ID=enrollpro_client_id
ATLAS_SSO_REVERSE_CLIENT_SECRET=4661849a647bbd9435b8014529ec96c342f5efb581b2a92c454e9bc3532cc4b4
```

The EnrollPro reverse callback registered by ATLAS must be exactly:

```text
https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/reverse/callback
```

These are the effective values currently present in `server/.env`.

### ATLAS Route Verification Required

The current EnrollPro environment points reverse authorization and exchange to
`/auth/sso/authorize` and `/auth/sso/exchange`. The ATLAS handoff dated
2026-09-17 reports mounted server routes at `/api/v1/auth/sso/authorize` and
`/api/v1/auth/sso/exchange`. Before joint testing, ATLAS must confirm which pair
is canonical. If the `/api/v1` routes are canonical, update the two EnrollPro
environment values and restart EnrollPro; do not implement an unverified client
fallback between paths.

The callback must use HTTPS outside local development. The secret must not be reused for schedule feeds or any other integration.

`ATLAS_SSO_CLIENT_SECRET` authenticates ATLAS to EnrollPro for an EnrollPro-issued code. `ATLAS_SSO_REVERSE_CLIENT_SECRET` authenticates EnrollPro to ATLAS for an ATLAS-issued code. `ATLAS_API_KEY` remains a data-feed credential and must never authorize SSO.

## ATLAS Callback Flow

1. Accept `GET /auth/enrollpro/callback?code=<authorization-code>` on the ATLAS server.
2. Read the code on the server. Do not exchange it from browser JavaScript.
3. Send `POST <ENROLLPRO_BASE_URL>/api/auth/companion-sso/atlas/exchange` with `Authorization: Bearer <ATLAS_SSO_CLIENT_SECRET>` and the JSON body `{ "code": "<authorization-code>" }`.
4. Require `success: true`, `companion: "ATLAS"`, an active identity, at least one permitted role, and a valid active school-year object.
5. Map `identity.subject` as the stable external identifier. Reconcile the employee ID and name without changing EnrollPro-owned identity.
6. Create an ATLAS-owned HTTP-only, Secure, SameSite session cookie.
7. Remove the code from browser history by redirecting to the role dashboard.

## Role Routing

- `SYSTEM_ADMIN` redirects to the ATLAS main dashboard at `https://njgrm.buru-degree.ts.net/`.
- `HEAD_REGISTRAR`, `TEACHER`, and `CLASS_ADVISER` redirect to the matching ATLAS workspace selected by ATLAS.
- All other roles are denied.

## Required Rejections

ATLAS must reject expired, replayed, wrong-system, malformed, inactive, default-password, JHS-completer, and unauthorized identities. A failed exchange must return the user to EnrollPro with a plain retry message; it must not retry the same code.

Do not log the callback query, authorization code, Bearer secret, identity payload, or session token. Security logs may retain the event result, EnrollPro subject, ATLAS account ID, time, and non-sensitive denial code.

Signing out of ATLAS ends only the ATLAS session. Coordinated logout is not part of this contract.

## ATLAS to EnrollPro Reverse Flow

1. The authenticated ATLAS sidebar opens `GET <ENROLLPRO_PUBLIC_URL>/api/auth/companion-sso/atlas/reverse/start` in the same tab.
2. EnrollPro creates signed state and redirects to `ATLAS_SSO_REVERSE_AUTHORIZE_URL`.
3. ATLAS validates its session, client ID, and exact EnrollPro callback before issuing a 60-second single-use code.
4. ATLAS stores only the code hash, bound user, client, callback, expiry, and consumption state.
5. EnrollPro exchanges the code once at `ATLAS_SSO_REVERSE_EXCHANGE_URL` using `ATLAS_SSO_REVERSE_CLIENT_SECRET`.
6. ATLAS returns `identity.userId`, using the numeric EnrollPro user ID saved from EnrollPro's earlier outbound SSO assertion.
7. EnrollPro finds `User.id = identity.userId` and creates an EnrollPro-owned session for an existing active account.

The reverse response must include `success`, `issuer: "ATLAS"`, `identity.userId`, and `authenticatedAt`. Names, employee ID, LRN, subject, roles, and school-year context may be returned but do not participate in EnrollPro account matching. Signed state, the exact callback, the single-use code, issuer validation, and the ATLAS reverse Bearer secret remain mandatory.
