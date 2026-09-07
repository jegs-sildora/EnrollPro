# EnrollPro Response to AIMS Companion SSO Questions

**Date:** September 7, 2026  
**For:** AIMS integration team  
**Scope:** EnrollPro to AIMS SSO, current limitations, and the AIMS, EnrollPro, and ATLAS roadmap

## Executive Answer

The AIMS callback implementation described in `message.txt` and `message2.txt` follows the intended EnrollPro companion SSO flow. EnrollPro is currently the identity issuer. A user starts from an authenticated EnrollPro session, EnrollPro issues a short-lived one-time authorization code, and the AIMS backend exchanges that code for a minimized verified identity. AIMS then creates its own local session.

The reverse direction is now implemented on the EnrollPro side through signed state, an AIMS-issued one-time code, backend exchange, and a stable identity link. It becomes operational after AIMS implements its authorization and exchange endpoints and deployment configuration is completed. EnrollPro still does not accept a generic AIMS JWT or AIMS browser session, and AIMS cannot directly sign a user into ATLAS through this contract.

## Response to the Reported AIMS Incident

The AIMS fixes are consistent with the one-time-code contract:

- Restarting the stale AIMS development server was necessary for the new callback route to become active.
- Preventing React StrictMode from submitting the same code twice is required because an authorization code is consumed by the first successful exchange.
- A consumed code must never be retried. The user must return to EnrollPro and request a new launch.
- A clean `start again` state is the correct response to an expired or consumed code.

One caution remains. AIMS should retry a callback route only when it can prove the request never reached EnrollPro. It must not resend the same code after a timeout, connection reset, or other ambiguous result because the first request may have consumed the code even when AIMS did not receive the response.

## 1. EnrollPro to AIMS Initiation Flow

### Is there an initiate endpoint

There is no `GET /api/auth/companion-sso/AIMS/initiate` endpoint.

The supported EnrollPro endpoints are:

| Purpose | Method and path | Authentication |
| --- | --- | --- |
| List configured companions | `GET /api/auth/companion-sso/catalog` | EnrollPro user session |
| Launch a companion | `POST /api/auth/companion-sso/:system/launch` | EnrollPro user session |
| Exchange a code | `POST /api/auth/companion-sso/:system/exchange` | Companion-specific Bearer secret |

For AIMS, the launch endpoint is:

```http
POST /api/auth/companion-sso/aims/launch
```

The system path is accepted case-insensitively, but lowercase URLs are recommended.

### Launch request

The launch request has no JSON body and does not accept `redirect_uri`.

```http
POST /api/auth/companion-sso/aims/launch
Cookie: <EnrollPro session cookie>
```

### Launch response

On success, EnrollPro returns HTTP `201`:

```json
{
  "launchUrl": "https://aims.example.edu/auth/sso/callback?code=<one-time-code>",
  "expiresAt": "2026-09-07T10:01:00.000Z"
}
```

The EnrollPro browser navigates to `launchUrl` in the same tab. The browser delivers only the one-time code to AIMS. It does not deliver the EnrollPro password, JWT, session cookie, companion secret, or identity payload.

### Callback registration and redirect control

The AIMS callback is statically configured on the EnrollPro server through:

```text
AIMS_SSO_CALLBACK_URL
```

The client cannot provide or override a redirect URI. This prevents open redirects and authorization-code delivery to an untrusted destination. EnrollPro validates that the callback uses HTTPS, except for explicitly permitted local development addresses.

Before issuing a code, EnrollPro performs a short reachability check against the configured callback origin. If AIMS is unavailable, launch fails without placing a code in the browser URL.

### Complete sequence

1. The user signs in to EnrollPro.
2. The user selects AIMS from the EnrollPro sidebar.
3. EnrollPro checks the user's account status, default-password state, role, active-school-year state, and AIMS configuration.
4. EnrollPro creates a cryptographically random code with a 60-second lifetime.
5. EnrollPro stores only the SHA-256 hash of that code.
6. EnrollPro returns the configured AIMS callback URL with the plaintext code in the query string.
7. The EnrollPro browser navigates to AIMS in the same tab.
8. The AIMS callback sends the code to the AIMS backend.
9. The AIMS backend exchanges the code with EnrollPro using the AIMS-specific Bearer secret.
10. EnrollPro atomically consumes the code and returns the minimized identity.
11. AIMS maps the EnrollPro identity to one local account, creates its own secure session, and redirects to the role-appropriate AIMS dashboard.

## 2. Authorization Code Semantics

### Format and storage

- The plaintext code is 43 URL-safe Base64 characters generated from 32 random bytes.
- EnrollPro stores only its SHA-256 hash.
- The code is scoped to one companion system and one EnrollPro user.
- The code expires 60 seconds after issuance.
- The code is single use.
- Consumption occurs in a serializable Prisma transaction using a conditional database update, so concurrent exchange attempts cannot both succeed.

### Exchange request

```http
POST /api/auth/companion-sso/aims/exchange
Authorization: Bearer <AIMS_SSO_CLIENT_SECRET>
Content-Type: application/json

{
  "code": "<43-character-one-time-code>"
}
```

The AIMS secret is backend-only. It must never appear in browser JavaScript, browser storage, URLs, screenshots, client logs, or user-facing error messages.

### Code-related results

| Condition | HTTP status | Error code | Meaning |
| --- | ---: | --- | --- |
| Missing or malformed 43-character code | `400` | Validation response | Request does not satisfy the input schema |
| Unknown code with valid format | `401` | `COMPANION_SSO_CODE_INVALID` | Code is not usable |
| Expired code | `401` | `COMPANION_SSO_CODE_INVALID` | Code lifetime has ended |
| Replayed or already consumed code | `401` | `COMPANION_SSO_CODE_INVALID` | Code has already been used |
| Code issued for another companion | `401` | `COMPANION_SSO_CODE_INVALID` | Wrong-system exchange is denied |

The `400 "Authorization code is invalid"` observed by AIMS confirms schema rejection of a malformed code. It does not exercise expiry or replay handling. Tests for expiry and replay must use a correctly formatted code.

### Exact code-invalid envelope

Unknown, expired, replayed, and wrong-system codes intentionally share one response so EnrollPro does not reveal which condition occurred:

```json
{
  "code": "COMPANION_SSO_CODE_INVALID",
  "message": "The SSO authorization code is invalid, expired, or already used."
}
```

### Validation envelope

A malformed request returns HTTP `400` in this form:

```json
{
  "message": "Validation failed",
  "errors": {
    "code": [
      "Authorization code is invalid"
    ]
  }
}
```

### Other exchange and launch failures

| Condition | HTTP status | Error code |
| --- | ---: | --- |
| Missing or incorrect AIMS Bearer secret | `401` | `COMPANION_SSO_CLIENT_INVALID` |
| User account missing or inactive | `401` | `COMPANION_SSO_ACCOUNT_UNAVAILABLE` |
| Role not permitted for the companion | `403` | `COMPANION_SSO_ROLE_DENIED` |
| JHS completer cannot enter a staff companion | `403` | `COMPANION_SSO_COMPLETER_BLOCKED` |
| Required employee ID or LRN missing | `403` | `COMPANION_SSO_IDENTITY_INCOMPLETE` |
| Unsupported companion system | `404` | `COMPANION_SSO_SYSTEM_NOT_FOUND` |
| No initialized active school year | `409` | `ACTIVE_SCHOOL_YEAR_REQUIRED` |
| Active-year pointer and active rows conflict | `409` | `ACTIVE_SCHOOL_YEAR_CONFLICT` |
| Account still uses its default password | `428` | Default-password change required |
| AIMS callback or secret not configured | `503` | `COMPANION_SSO_NOT_CONFIGURED` |
| Configured AIMS callback is unreachable | `503` | `COMPANION_SSO_UNREACHABLE` |
| Request limit exceeded | `429` | `COMPANION_SSO_RATE_LIMITED` |

There is no separate `inactive school year` success state. EnrollPro resolves the authoritative current year at exchange time. If there is no valid active year, exchange fails with one of the `409` responses above.

## 3. Canonical Exchange Response

The authoritative response uses `activeSchoolYear`. It does not use `schoolYear.isActive` or `identity.isActive`.

Account activity and active-year consistency are enforced before a successful response is returned. The absence of boolean flags is intentional.

### Successful response

```json
{
  "success": true,
  "companion": "AIMS",
  "identity": {
    "subject": "ENROLLPRO_USER:1",
    "userId": 1,
    "employeeId": "1234501",
    "lrn": null,
    "firstName": "Jose",
    "middleName": null,
    "lastName": "Rizal",
    "roles": [
      "SYSTEM_ADMIN"
    ]
  },
  "activeSchoolYear": {
    "id": 1,
    "yearLabel": "2026-2027"
  },
  "authenticatedAt": "2026-09-07T10:00:15.000Z"
}
```

### Field contract

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `success` | `true` | Yes | Always true on a successful exchange |
| `companion` | `"AIMS"` | Yes | Uppercase canonical companion name |
| `identity.subject` | string | Yes | Stable value `ENROLLPRO_USER:<userId>` |
| `identity.userId` | positive integer | Yes | EnrollPro user primary identifier |
| `identity.employeeId` | string or null | Yes | Present for staff when recorded |
| `identity.lrn` | string or null | Yes | Present only when applicable |
| `identity.firstName` | string | Yes | Verified EnrollPro identity |
| `identity.middleName` | string or null | Yes | Nullable |
| `identity.lastName` | string | Yes | Verified EnrollPro identity |
| `identity.roles` | role array | Yes | Roles authorized for AIMS only |
| `activeSchoolYear.id` | positive integer | Yes | Current EnrollPro school-year ID |
| `activeSchoolYear.yearLabel` | string | Yes | Canonical `YYYY-YYYY` label |
| `authenticatedAt` | ISO 8601 string | Yes | Time EnrollPro completed the exchange |

At least one of `employeeId` or `lrn` must be non-null. For the currently supported AIMS staff flow, `employeeId` is the expected account-mapping identifier. AIMS should use `identity.subject` as the stable external identity key and keep employee ID as an operational identifier rather than treating a name as identity.

### Error envelope

Service errors use:

```json
{
  "code": "COMPANION_SSO_CODE_INVALID",
  "message": "The SSO authorization code is invalid, expired, or already used."
}
```

Input validation errors use the separate validation envelope shown earlier. AIMS should branch first on the HTTP status and then on `code` when present. It should not parse human-readable message text as application logic.

## 4. Roles and Subject Format

### EnrollPro roles authorized for AIMS

The canonical EnrollPro-to-AIMS role list is:

- `SYSTEM_ADMIN`
- `HEAD_REGISTRAR`
- `TEACHER`
- `CLASS_ADVISER`

`LEARNER` and `MRF` are not authorized for the AIMS staff sidebar launch.

The returned `identity.roles` array is the intersection of the user's current EnrollPro roles and the roles allowed for AIMS. AIMS must not infer or add permissions beyond those roles. Local AIMS authorization may further restrict access, but it must never elevate the EnrollPro identity.

### Subject format

The canonical subject is:

```text
ENROLLPRO_USER:<positive-user-id>
```

Example:

```text
ENROLLPRO_USER:1
```

`identity.userId` is always present in a successful response and matches the numeric suffix of `identity.subject`.

## 5. Reverse Direction and Three-System Roadmap

### Is AIMS to EnrollPro SSO supported now

Yes on the EnrollPro side, subject to AIMS completing the reciprocal endpoints and deployment configuration. EnrollPro now provides `/api/auth/companion-sso/aims/reverse/start` and the source-bound reverse callback. It validates signed state, exchanges the AIMS-issued one-time code from the backend, maps a stable AIMS subject through `CompanionIdentityLink`, and creates an EnrollPro-owned session.

AIMS must implement the authorization and exchange contract documented in [Integrated Systems Sidebar and SSO](INTEGRATED-SYSTEMS-SIDEBAR-SSO.md). Generic AIMS JWT login, cross-domain cookie sharing, and coordinated logout remain unsupported.

### Is shared-cookie SSO supported

No. EnrollPro will not widen its session cookie to companion domains. Each system must own its own HTTP-only, Secure session cookie. This avoids sharing session material across independently deployed applications.

### Is direct AIMS to ATLAS SSO supported

No. The current authorization code is audience-bound to one companion. A code issued for AIMS cannot be exchanged by ATLAS, and AIMS must not forward its EnrollPro identity payload or local session to ATLAS.

ATLAS can participate by implementing its own EnrollPro callback and exchanging an ATLAS-scoped code with its own dedicated secret. The existing ATLAS machine-to-machine Bearer integration for schedule or context APIs is separate from user SSO and cannot be used as a browser login credential.

### Current supported topology

```text
Authenticated EnrollPro user
  -> EnrollPro one-time AIMS code
  -> AIMS backend exchange
  -> AIMS local session

Authenticated EnrollPro user
  -> EnrollPro one-time ATLAS code
  -> ATLAS backend exchange
  -> ATLAS local session
```

This topology now also supports a companion-to-EnrollPro return after reciprocal companion endpoints are configured. It does not directly provide one-click companion-to-companion federation.

### Recommended roadmap

For login-free navigation among AIMS, EnrollPro, and ATLAS in every direction, the preferred long-term design is a shared standards-based identity provider using OpenID Connect authorization code flow with PKCE. Each application remains a separate relying party and creates its own local session.

If a shared identity provider is not currently feasible, each reverse direction requires a separately reviewed one-time-code contract with:

- A distinct issuer and audience
- Registered callback URLs with no browser-supplied override
- Separate per-client secrets or asymmetric signatures
- 60-second or shorter expiry
- Hashed, single-use authorization codes
- Atomic consumption and replay protection
- Canonical stable subject identifiers
- Explicit role mapping and least privilege
- Current account-status checks at exchange time
- Audit records without codes, tokens, or secrets
- Clear local logout behavior

EnrollPro must not accept a generic AIMS JWT or ATLAS JWT until issuer, audience, signature keys, key rotation, nonce handling, expiry, account status, role mapping, and revocation behavior are formally specified and implemented.

Reverse identities use a source-owned, stable, namespaced subject such as `AIMS_USER:<id>` or `ATLAS_USER:<id>`. They must not copy `ENROLLPRO_USER:<id>`. EnrollPro stores the source and external subject in a unique account link and always uses current EnrollPro roles for the resulting session.

## 6. Required AIMS Behavior

On a successful exchange, AIMS should:

1. Confirm `success` is `true` and `companion` is exactly `AIMS`.
2. Validate `identity.subject`, `identity.userId`, names, allowed roles, and `activeSchoolYear`.
3. Match exactly one active local AIMS account using the stored EnrollPro subject binding.
4. Refuse ambiguous, inactive, or missing local account mappings.
5. Apply the least-privileged local role mapping.
6. Create an AIMS-owned HTTP-only, Secure, SameSite session cookie.
7. Redirect to the correct AIMS dashboard for the mapped role.
8. Remove the authorization code from the visible browser URL through redirect navigation.

On failure, AIMS should:

- Show `Start again from EnrollPro` for `COMPANION_SSO_CODE_INVALID`.
- Never automatically exchange the same code again after an ambiguous network outcome.
- Send the user back to EnrollPro for a fresh code after expiry or replay.
- Avoid creating a partial local session before identity validation and account mapping complete.
- Avoid putting authorization codes, Bearer secrets, identity payloads, or session tokens in logs.
- Keep AIMS logout local unless coordinated logout is designed later.

## 7. Joint Verification Checklist

The EnrollPro and AIMS teams should verify these cases together:

- A permitted active user reaches AIMS without another login form.
- The same valid code succeeds exactly once.
- Two concurrent exchanges result in one success and one `401` code-invalid response.
- A valid-format code expires after 60 seconds.
- An AIMS code cannot be exchanged through the ATLAS, SMART, or MRF exchange path.
- A malformed code returns the documented `400` validation envelope.
- A wrong or missing AIMS secret returns `401 COMPANION_SSO_CLIENT_INVALID`.
- An inactive EnrollPro account is rejected even when the code was issued before deactivation.
- A missing or inconsistent active school year returns the documented `409` error.
- Unsupported roles and JHS completers are denied.
- React StrictMode does not cause a second exchange.
- Browser refresh of a consumed callback displays a clean restart state.
- AIMS creates no session when identity mapping fails.
- URLs, browser responses, application logs, and audit logs contain no secrets or identity payload dumps.

## 8. Security and Configuration Note

The following EnrollPro server settings are required for AIMS:

```text
AIMS_SSO_CALLBACK_URL
AIMS_SSO_CLIENT_SECRET
AIMS_SSO_REVERSE_AUTHORIZE_URL
AIMS_SSO_REVERSE_EXCHANGE_URL
AIMS_SSO_REVERSE_CLIENT_ID
AIMS_SSO_REVERSE_CLIENT_SECRET
```

The actual secret must be exchanged through an approved secure channel and stored only in server-side secret configuration. It must not be committed to source control or copied into documentation. SSO secrets must not reuse grade, learner-context, schedule, feed, JWT, or password-change integration credentials.

## Final Answers

1. EnrollPro initiates AIMS SSO with authenticated `POST /api/auth/companion-sso/aims/launch`. There is no GET initiate route and no `redirect_uri` parameter. The callback is registered in `AIMS_SSO_CALLBACK_URL`.
2. Codes live for 60 seconds, are scoped to AIMS, are stored only as hashes, and are consumed once atomically. Malformed codes return `400`; valid-format invalid, expired, replayed, or wrong-system codes return `401 COMPANION_SSO_CODE_INVALID`.
3. The authoritative successful response contains `activeSchoolYear: { id, yearLabel }`. It contains neither `identity.isActive` nor `schoolYear.isActive`.
4. AIMS-to-EnrollPro reverse SSO is implemented on the EnrollPro side and requires AIMS authorization and exchange endpoints before activation. Direct AIMS-to-ATLAS SSO, shared cookies, and generic companion JWT login are not supported.
5. AIMS accepts `SYSTEM_ADMIN`, `HEAD_REGISTRAR`, `TEACHER`, and `CLASS_ADVISER`. The outbound EnrollPro subject format is `ENROLLPRO_USER:<userId>`. Reverse identities use a stable AIMS-owned subject linked to one EnrollPro account, while EnrollPro local roles remain authoritative.
