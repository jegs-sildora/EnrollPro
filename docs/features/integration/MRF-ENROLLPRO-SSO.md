# MRF EnrollPro SSO

Last reviewed: 2026-09-17

## Status

MRF now has callback, reverse-flow URLs, client IDs, and both SSO secret variables configured in EnrollPro. This makes the EnrollPro catalog configuration-complete. Operational availability still requires MRF to expose the documented routes, use byte-identical paired secrets, and return a role-appropriate landing session.

This is not cross-domain cookie sharing. MRF must never receive an EnrollPro password, JWT, or session cookie.

## Effective EnrollPro Configuration

```text
ENROLLPRO_PUBLIC_URL=https://dev-jegs.buru-degree.ts.net
MRF_SSO_CALLBACK_URL=https://mrf.buru-degree.ts.net/auth/sso/callback
MRF_SSO_CLIENT_SECRET=<read from server/.env; server-only>
MRF_SSO_REVERSE_AUTHORIZE_URL=https://mrf.buru-degree.ts.net/auth/sso/authorize
MRF_SSO_REVERSE_EXCHANGE_URL=https://mrf.buru-degree.ts.net/auth/sso/exchange
MRF_SSO_REVERSE_CLIENT_ID=enrollpro_client_id
MRF_SSO_REVERSE_CLIENT_SECRET=<read from server/.env; server-only>
```

The EnrollPro reverse callback registered by MRF must be exactly:

```text
https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/mrf/reverse/callback
```

These are the effective non-secret values currently present in `server/.env`.
Secrets are intentionally not duplicated in this tracked document. MRF must
receive the matching values through a secure out-of-band channel.

The callback must use HTTPS outside local development. The secret must not be reused for the MRF identity feed or any other integration.

`MRF_SSO_CLIENT_SECRET` authenticates MRF to EnrollPro for an EnrollPro-issued code. `MRF_SSO_REVERSE_CLIENT_SECRET` authenticates EnrollPro to MRF for an MRF-issued code. `MRF_INTEGRATION_API_KEY` remains a minimized data-feed credential and must never authorize SSO.

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

## MRF to EnrollPro Reverse Flow

1. The authenticated MRF sidebar opens `GET <ENROLLPRO_PUBLIC_URL>/api/auth/companion-sso/mrf/reverse/start` in the same tab.
2. EnrollPro creates signed state and redirects to `MRF_SSO_REVERSE_AUTHORIZE_URL`.
3. MRF validates its session, client ID, and exact EnrollPro callback before issuing a 60-second single-use code.
4. MRF stores only the code hash, bound user, client, callback, expiry, and consumption state.
5. EnrollPro exchanges the code once at `MRF_SSO_REVERSE_EXCHANGE_URL` using `MRF_SSO_REVERSE_CLIENT_SECRET`.
6. MRF returns `identity.userId`, using the numeric EnrollPro user ID saved from EnrollPro's earlier outbound SSO assertion.
7. EnrollPro finds `User.id = identity.userId` and creates an EnrollPro-owned session for an existing active account. EnrollPro routes using its locally stored roles.

MRF must fail closed if its deployed callback, reverse routes, client ID, or paired secrets do not match the effective EnrollPro configuration above.

The reverse response must include `success`, `issuer: "MRF"`, `identity.userId`, and `authenticatedAt`. Names, employee ID, LRN, subject, roles, and school-year context may be returned but do not participate in EnrollPro account matching. Signed state, the exact callback, the single-use code, issuer validation, and the MRF reverse Bearer secret remain mandatory.
