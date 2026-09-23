# ATLAS EnrollPro SSO

Last reviewed: 2026-09-22

## Purpose

This contract lets an eligible EnrollPro user open ATLAS without entering another password. EnrollPro transfers a short-lived identity assertion; ATLAS still owns and creates the ATLAS session.

This is not cross-domain cookie sharing. ATLAS must never receive an EnrollPro password, JWT, or session cookie.

## Effective EnrollPro Configuration

```text
ENROLLPRO_PUBLIC_URL=https://dev-jegs.buru-degree.ts.net
ATLAS_SSO_CALLBACK_URL=https://njgrm.buru-degree.ts.net/api/v1/auth/enrollpro/callback
ATLAS_SSO_CLIENT_SECRET=<securely-provisioned-random-secret>
ATLAS_SSO_REVERSE_AUTHORIZE_URL=https://njgrm.buru-degree.ts.net/auth/enrollpro/authorize
ATLAS_SSO_REVERSE_EXCHANGE_URL=https://njgrm.buru-degree.ts.net/api/v1/auth/sso/exchange
ATLAS_SSO_REVERSE_CLIENT_ID=enrollpro
ATLAS_SSO_REVERSE_CLIENT_SECRET=<securely-provisioned-distinct-random-secret>
```

The EnrollPro reverse callback registered by ATLAS must be exactly:

```text
https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/reverse/callback
```

The URLs and client ID above are the effective non-secret values in
`server/.env`. Secret values are intentionally omitted from this document and
must be transferred through an approved secure channel.

### ATLAS Authorization Transport

ATLAS exposes two different endpoints for reverse authorization:

- Browser mediator: `GET /auth/enrollpro/authorize`
- Authenticated API used by that mediator: `POST /api/v1/auth/sso/authorize`

EnrollPro must redirect the browser to the mediator, not directly to the
POST-only API. The mediator receives `response_type`, `client_id`,
`redirect_uri`, and signed `state`, authenticates the current ATLAS user, calls
the API with the ATLAS session token, and navigates once to the returned
EnrollPro callback URL. Direct checks on 2026-09-17 verified that the mediator
returns HTTP 200 and that the exchange API is mounted at
`POST /api/v1/auth/sso/exchange`.

The callback must use HTTPS outside local development. The secret must not be reused for schedule feeds or any other integration.

`ATLAS_SSO_CLIENT_SECRET` authenticates ATLAS to EnrollPro for an EnrollPro-issued code. It must be installed in ATLAS as `ENROLLPRO_SSO_CLIENT_SECRET`. `ATLAS_SSO_REVERSE_CLIENT_SECRET` authenticates EnrollPro to ATLAS for an ATLAS-issued code and must use the same value as ATLAS's `ATLAS_SSO_REVERSE_CLIENT_SECRET`. The two secrets must be different. `ATLAS_API_KEY` remains a data-feed credential and must never authorize SSO.

The values exposed in the earlier plaintext handoff are revoked. Do not keep
them as fallback values. EnrollPro generated replacements on 2026-09-17; ATLAS
must receive and install both replacements out of band before joint testing.

## ATLAS Callback Flow

1. Accept `GET /api/v1/auth/enrollpro/callback?code=<authorization-code>` on the ATLAS server. This is the server callback, not the `/auth/sso/callback` SPA result page.
2. Read the code on the server. Do not exchange it from browser JavaScript.
3. Send `POST <ENROLLPRO_BASE_URL>/api/auth/companion-sso/atlas/exchange` with `Authorization: Bearer <ATLAS_SSO_CLIENT_SECRET>` and the JSON body `{ "code": "<authorization-code>" }`.
4. Require `success: true`, `companion: "ATLAS"`, an active identity, at least one permitted role, and a valid active school-year object.
5. Map `identity.subject` as the stable external identifier. Reconcile the employee ID and name without changing EnrollPro-owned identity.
6. Create an ATLAS-owned HTTP-only, Secure, SameSite session cookie.
7. Remove the code from browser history by redirecting to the role dashboard.

## Role Routing

- `SYSTEM_ADMIN` redirects to the ATLAS main dashboard at `https://njgrm.buru-degree.ts.net/`.
- `HEAD_REGISTRAR`, `TEACHER`, `CLASS_ADVISER`, and
  `GRADE_LEVEL_COORDINATOR` redirect to the matching ATLAS workspace selected
  by ATLAS. ATLAS may map the exact `GRADE_LEVEL_COORDINATOR` application role
  to its least-privilege scheduler role.
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
6. ATLAS returns its stable `identity.subject` and the user's EnrollPro-aligned `identity.employeeId`. A numeric `identity.userId` is optional and must not be an ATLAS-local account ID.
7. EnrollPro resolves `User.employeeId` first and creates an EnrollPro-owned session for the existing active account. Numeric `userId` remains a compatibility fallback only when no employee ID is asserted.

The reverse response must include `success`, `issuer: "ATLAS"`, a usable identity, and `authenticatedAt`. When both `employeeId` and `userId` are supplied and resolve to different EnrollPro users, EnrollPro rejects the assertion with `COMPANION_REVERSE_SSO_IDENTITY_CONFLICT`; it never signs in the numeric-ID user. A supplied employee ID that has no EnrollPro match does not fall back to `userId`. Signed state, the exact callback, the single-use code, issuer validation, and the ATLAS reverse Bearer secret remain mandatory.

When ATLAS rejects reverse authorization with HTTP 403, EnrollPro retains the
stable top-level error `COMPANION_REVERSE_SSO_ACCESS_DENIED` and forwards the
validated originating ATLAS code as `companionError`. The login notice displays
that code for support diagnosis without exposing credentials or identity data.

## Implementation Verification

Verified on 2026-09-22:

- A fresh EnrollPro process redirects `/atlas/reverse/start` to the live ATLAS
  mediator at `/auth/enrollpro/authorize`.
- The redirect contains `response_type=code`, `client_id=enrollpro`, the exact
  registered EnrollPro callback, and signed state.
- The ATLAS mediator returns HTTP 200.
- EnrollPro resolves a valid authoritative active school year for S.Y.
  2030–2031. Active-year validity is based on the settings pointer and the
  unique `ACTIVE` row, not the host calendar date.
- The outbound EnrollPro-to-ATLAS launch targets the ATLAS server callback at
  `/api/v1/auth/enrollpro/callback`; `/auth/sso/callback` remains ATLAS's result
  page and must not receive an EnrollPro authorization code directly.
