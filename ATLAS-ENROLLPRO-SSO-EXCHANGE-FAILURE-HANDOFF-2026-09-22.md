# ATLAS EnrollPro SSO Exchange Failure Handoff

Date: 2026-09-22  
Direction: EnrollPro to ATLAS  
Status: ATLAS callback correction required

## Purpose

This handoff is for the ATLAS AI developer. It documents why a user clicking
**ATLAS** in the EnrollPro Integrated Systems sidebar reaches the ATLAS result
page but receives:

> This sign-in link expired or was already used. Start again from EnrollPro.

The current evidence places the failure in the ATLAS callback flow. EnrollPro
successfully creates valid authorization codes and accepts them at its public
exchange endpoint. The failed ATLAS browser callbacks do not send an exchange
request back to EnrollPro.

## Confirmed EnrollPro Configuration

EnrollPro launches the browser to the ATLAS server callback:

```text
GET https://njgrm.buru-degree.ts.net/api/v1/auth/enrollpro/callback?code=<single-use-code>
```

The callback URL is intentionally different from the ATLAS SPA result page:

```text
Server callback: /api/v1/auth/enrollpro/callback
SPA result page: /auth/sso/callback
```

The authorization code is random, stored by EnrollPro only as a SHA-256 hash,
valid for 60 seconds, bound to `ATLAS`, and consumable exactly once.

## Evidence

### Failed real sidebar attempts

Two fresh EnrollPro-to-ATLAS sidebar launches were recorded on 2026-09-22:

| EnrollPro code record | Created UTC | Expires UTC | Consumed |
| --- | --- | --- | --- |
| `165` | `12:22:32.155Z` | `12:23:32.154Z` | No |
| `166` | `12:22:47.621Z` | `12:23:47.620Z` | No |

For both attempts:

- EnrollPro recorded `COMPANION_SSO_LAUNCHED`.
- The browser reached the ATLAS result page and displayed an expired-or-used
  error.
- EnrollPro did not record `COMPANION_SSO_EXCHANGED`.
- EnrollPro did not record `COMPANION_SSO_EXCHANGE_DENIED`.
- Both authorization-code records remained unconsumed.

This means the ATLAS callback did not submit either code to the EnrollPro
exchange endpoint that issued it.

### Positive EnrollPro control

At `12:19:19Z`, EnrollPro created another fresh ATLAS authorization code and
submitted it directly to the public EnrollPro exchange endpoint with the
configured ATLAS client credential.

Result:

```json
{
  "status": 200,
  "success": true,
  "companion": "ATLAS",
  "hasIdentity": true,
  "hasSchoolYear": true
}
```

That code was consumed at `12:19:19.441Z`, and EnrollPro recorded
`COMPANION_SSO_EXCHANGED` at `12:19:19.490Z`.

This verifies all of the following on the deployed EnrollPro side:

- authorization-code generation works;
- the public exchange route is mounted and reachable;
- the configured ATLAS outbound SSO secret is accepted;
- single-use atomic code consumption works;
- the identity and active-school-year response is generated successfully.

## Required ATLAS Behavior

The ATLAS handler for this route:

```text
GET /api/v1/auth/enrollpro/callback?code=<authorization-code>
```

must perform the following sequence exactly once:

1. Read the `code` query parameter without decoding, hashing, normalizing,
   truncating, or replacing it.
2. From the ATLAS backend, immediately call:

   ```text
   POST https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/exchange
   Authorization: Bearer <ATLAS_SSO_CLIENT_SECRET>
   Content-Type: application/json
   ```

   ```json
   {
     "code": "<the exact code received by the callback>"
   }
   ```

3. Require HTTP 200, `success: true`, and `companion: "ATLAS"`.
4. Validate the returned identity, roles, active status, and school-year
   context.
5. Map the stable EnrollPro identity to an existing ATLAS account.
6. Create the ATLAS-owned session.
7. Redirect to `/auth/sso/callback#atlasToken=<ATLAS-session-token>` or the
   equivalent secure ATLAS result flow.

The browser must not call the EnrollPro exchange endpoint. The exchange uses a
server-only secret and must happen only from the ATLAS backend.

## ATLAS Configuration To Verify

Verify the deployed ATLAS process, not only a local `.env` file:

```text
ENROLLPRO_BASE_URL=https://dev-jegs.buru-degree.ts.net
```

The final exchange URL must resolve byte-for-byte to:

```text
https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/exchange
```

ATLAS must authenticate this exchange with the shared outbound
`ATLAS_SSO_CLIENT_SECRET` value installed by EnrollPro. Do not use any of these
unrelated credentials:

- `ATLAS_SSO_REVERSE_CLIENT_SECRET`
- `ENROLLPRO_API_KEY`
- schedule or integration feed keys
- an ATLAS JWT
- an EnrollPro browser cookie
- an EnrollPro user token

After changing environment configuration, restart or redeploy the ATLAS server
process so the running callback uses the new values.

## Likely ATLAS Defects

Audit the ATLAS callback for these causes, in this order:

1. `ENROLLPRO_BASE_URL` points to a different EnrollPro deployment, localhost,
   an old tunnel hostname, or an API proxy backed by another database.
2. The callback calls ATLAS's own reverse exchange endpoint
   `/api/v1/auth/sso/exchange` instead of EnrollPro's outbound exchange endpoint.
3. The callback validates the EnrollPro code against an ATLAS authorization-code
   table before contacting EnrollPro.
4. The callback maps a local lookup failure directly to
   `COMPANION_SSO_CODE_INVALID` without attempting the server-to-server exchange.
5. The callback changes the code through URL decoding, trimming, serialization,
   or another transformation.
6. A stale deployed process still uses old environment values.
7. Middleware redirects or handles `/api/v1/auth/enrollpro/callback` as an SPA
   route instead of executing the server controller.

A duplicate exchange is not the current primary symptom. EnrollPro would show
one successful exchange followed by one denied replay. The observed failed
codes show zero exchange attempts and remain unconsumed.

## Required ATLAS Diagnostics

Add temporary structured diagnostics around the callback without logging the
authorization code or secret. Record only:

- callback request received;
- whether a non-empty code was present;
- code length, not code value;
- resolved EnrollPro exchange origin and pathname;
- exchange start time and elapsed milliseconds;
- EnrollPro HTTP status;
- EnrollPro typed response `code`, when present;
- whether ATLAS session creation succeeded;
- final redirect destination pathname.

Do not log query strings, authorization headers, response identity payloads,
authorization codes, or session tokens.

## Server-Side Verification

Use a newly issued code and call the exchange within 60 seconds. The request
must be made from the ATLAS backend with the secret supplied through its
environment. Do not paste the secret into source, shell history, logs, issues,
or this document.

Expected success:

```text
HTTP 200
success = true
companion = ATLAS
identity is present
activeSchoolYear is present
```

Expected negative behavior for the same code after successful consumption:

```text
HTTP 401
code = COMPANION_SSO_CODE_INVALID
```

Do not run the replay test until after confirming the first request succeeded.

## Acceptance Criteria

The issue is resolved only when all conditions pass:

1. Clicking ATLAS in EnrollPro requests
   `/api/v1/auth/enrollpro/callback?code=...` on ATLAS.
2. ATLAS sends exactly one backend exchange request to the canonical EnrollPro
   endpoint.
3. EnrollPro records `COMPANION_SSO_EXCHANGED` and marks that code consumed.
4. ATLAS creates its own secure session.
5. The browser reaches the appropriate authenticated ATLAS dashboard without a
   second login form.
6. Refreshing the final ATLAS result page does not repeat the code exchange.
7. Expired, malformed, mismatched, or replayed codes fail closed with a typed
   error.
8. No code, client secret, identity payload, or session token appears in logs.

## Ownership Conclusion

No additional EnrollPro code change is indicated by the current evidence. The
deployed EnrollPro issuer and exchange endpoint pass the positive control. ATLAS
must correct or redeploy its `/api/v1/auth/enrollpro/callback` implementation so
it exchanges the exact browser-delivered code against the canonical EnrollPro
endpoint before displaying an expired-or-used result.
