# ATLAS EnrollPro SSO

Last reviewed: 2026-09-14

## Purpose

This contract lets an eligible EnrollPro user open ATLAS without entering another password. EnrollPro transfers a short-lived identity assertion; ATLAS still owns and creates the ATLAS session.

This is not cross-domain cookie sharing. ATLAS must never receive an EnrollPro password, JWT, or session cookie.

## EnrollPro Configuration

```text
ATLAS_SSO_CALLBACK_URL=https://configured-atlas-host/auth/enrollpro/callback
ATLAS_SSO_CLIENT_SECRET=<distinct random secret of at least 32 characters>
ATLAS_SSO_REVERSE_AUTHORIZE_URL=https://configured-atlas-host/auth/enrollpro/authorize
ATLAS_SSO_REVERSE_EXCHANGE_URL=https://configured-atlas-host/api/v1/auth/sso/exchange
ATLAS_SSO_REVERSE_CLIENT_ID=enrollpro
ATLAS_SSO_REVERSE_CLIENT_SECRET=<different random secret of at least 32 characters>
```

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
6. ATLAS returns a stable ATLAS subject, canonical employee ID or LRN, matching names, roles, and mirrored EnrollPro school year.
7. EnrollPro reconciles exactly one local account and creates an EnrollPro-owned session.

The stable subject and employee ID must not change with term, school year, schedule revision, teaching load, or adviser assignment.
