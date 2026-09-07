# EnrollPro Companion SSO Flow

Last reviewed: 2026-09-07

## Purpose

This document is the code-verified description of EnrollPro-initiated single sign-on to AIMS, SMART, ATLAS, and MRF. It answers the AIMS questions in `message.txt` and defines the outcome expected from every companion.

The flow is one-way:

```text
EnrollPro authenticated session
  -> EnrollPro one-time authorization code
  -> companion browser callback
  -> companion backend exchange
  -> companion-owned session
  -> companion role dashboard
```

This is an identity handoff. It is not password forwarding, JWT forwarding, database sharing, or cross-domain cookie sharing.

## Authority And Ownership

EnrollPro is the identity authority for this flow. It owns the authenticated user, stable subject, employee ID or LRN, EnrollPro roles, account status, and active school-year context.

Each companion owns:

- its callback endpoint
- its local account mapping
- its own authorization rules in addition to EnrollPro's minimum role filter
- its HTTP-only session cookie
- its role-specific dashboard routing
- its local logout

The implementation sources are:

- `server/src/features/auth/companion-sso.service.ts`
- `server/src/features/auth/companion-sso.controller.ts`
- `server/src/features/auth/auth.router.ts`
- `shared/src/schemas/companion-sso.schema.ts`
- `server/prisma/schema.prisma`
- `client/src/shared/layouts/AppLayout.tsx`

## Supported Systems And Roles

| EnrollPro role | AIMS | SMART | ATLAS | MRF |
| --- | --- | --- | --- | --- |
| `SYSTEM_ADMIN` | Allowed | Allowed | Allowed | Allowed |
| `HEAD_REGISTRAR` | Allowed | Allowed | Allowed | Denied |
| `TEACHER` | Allowed | Allowed | Allowed | Denied |
| `CLASS_ADVISER` | Allowed | Allowed | Allowed | Denied |
| `MRF` | Denied | Denied | Denied | Allowed |
| `LEARNER` | Denied | Denied | Denied | Denied |

An allowed role is necessary but not sufficient. EnrollPro also requires an active account, a completed default-password change, a non-completer learner profile when one exists, and either an employee ID or LRN.

## Configuration

Each companion uses two dedicated server environment values:

```text
AIMS_SSO_CALLBACK_URL=<AIMS browser callback URL>
AIMS_SSO_CLIENT_SECRET=<AIMS-only exchange secret>

SMART_SSO_CALLBACK_URL=<SMART browser callback URL>
SMART_SSO_CLIENT_SECRET=<SMART-only exchange secret>

ATLAS_SSO_CALLBACK_URL=<ATLAS browser callback URL>
ATLAS_SSO_CLIENT_SECRET=<ATLAS-only exchange secret>

MRF_SSO_CALLBACK_URL=<MRF browser callback URL>
MRF_SSO_CLIENT_SECRET=<MRF-only exchange secret>
```

The callback is registered by configuration. A launch request cannot supply or override `redirect_uri`. This prevents open redirects.

Configuration is enabled only when:

- callback URL and secret are both present
- the secret is at least 32 characters
- the secret does not look like an example or placeholder
- the callback uses HTTPS, except HTTP on `localhost` or `127.0.0.1` outside production
- the callback URL contains no username, password, or fragment

The SSO secret must be distinct from grade, schedule, integration-feed, JWT, and password-change secrets. It exists only in the EnrollPro server and matching companion backend.

## EnrollPro Endpoints

All routes are mounted below `/api/auth`.

### Catalog

```text
GET /api/auth/companion-sso/catalog
Authentication: EnrollPro staff session or Bearer token
```

The response tells the sidebar whether each companion is configured and whether the current user is eligible.

```json
{
  "systems": [
    {
      "system": "AIMS",
      "enabled": true,
      "eligible": true,
      "disabledReason": null
    }
  ]
}
```

### Launch

```text
POST /api/auth/companion-sso/:system/launch
Authentication: EnrollPro staff session or Bearer token
Body: none
```

`:system` is case-insensitive and accepts `aims`, `smart`, `atlas`, or `mrf`. There is no `GET .../initiate` route and no request-level redirect parameter.

Successful response: HTTP `201`.

```json
{
  "launchUrl": "https://companion.example/auth/sso/callback?code=<one-time-code>",
  "expiresAt": "2026-09-07T10:01:00.000Z"
}
```

Before issuing a code, EnrollPro:

1. Resolves the authenticated EnrollPro user.
2. Validates the configured callback and secret.
3. Rechecks account, password, role, completer, and identifier requirements.
4. Makes a three-second `HEAD` reachability check to the callback origin. A network failure or HTTP 5xx response blocks launch.
5. Generates a cryptographically random 32-byte code encoded as 43 base64url characters.
6. Stores only its SHA-256 hash.
7. Returns the configured callback URL with the plaintext code in the `code` query parameter.
8. Records a launch audit event without the code or secret.

The browser preserves the unsaved-change guard, shows loading only on the selected system, and performs same-tab navigation to `launchUrl`. The client currently allows three seconds for the launch endpoint, matching the server reachability probe.

### Exchange

```text
POST /api/auth/companion-sso/:system/exchange
Authorization: Bearer <system-specific SSO secret>
Content-Type: application/json
```

```json
{
  "code": "<43-character authorization code>"
}
```

Only the companion backend may call this endpoint. Browser JavaScript must not hold the SSO secret or perform the exchange.

## Authorization Code Semantics

- Lifetime: 60 seconds from creation.
- Scope: exactly one companion system.
- Use count: one successful exchange.
- Persistence: SHA-256 hash only; plaintext is never stored.
- Concurrency: serializable Prisma transaction plus conditional `updateMany` consumption.
- Replay: a second exchange cannot consume the same row.
- Wrong system: rejected without revealing whether the code belongs to another companion.
- Expiry: compared using the EnrollPro server clock.

Expired, replayed, unknown, and wrong-system codes deliberately share one public error. This avoids exposing code state.

## Canonical Exchange Response

The following shape from `companionSsoExchangeResponseSchema` is authoritative:

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
    "roles": ["SYSTEM_ADMIN"]
  },
  "activeSchoolYear": {
    "id": 1,
    "yearLabel": "2026-2027"
  },
  "authenticatedAt": "2026-09-07T10:00:01.000Z"
}
```

Field rules:

- `success` is always `true` on HTTP `200`.
- `companion` is the uppercase system name and must match the receiving system.
- `identity.subject` is `ENROLLPRO_USER:<positive userId>` and is the stable external account key.
- `identity.userId` is always a positive integer.
- `employeeId` and `lrn` are nullable, but EnrollPro requires at least one to exist.
- `roles` contains only roles allowed for the receiving companion, not every role on the EnrollPro account.
- `activeSchoolYear` is required and contains the authoritative active EnrollPro school-year ID and label.
- `authenticatedAt` is an ISO 8601 timestamp from EnrollPro.

There is no `identity.isActive` or `schoolYear.isActive` field. Active account status and active-year consistency are enforced before the response is issued. Companions must use this exact contract instead of inferring fields from older documents.

## Error Contract

### Malformed Request Body

A missing code, wrong type, or code that is not exactly 43 base64url characters returns HTTP `400`:

```json
{
  "message": "Validation failed",
  "errors": {
    "code": ["Authorization code is invalid"]
  }
}
```

This is the response AIMS reported. It proves request validation is reachable, but it does not test lookup, expiry, replay protection, or successful identity exchange.

### Application Errors

Other SSO failures use:

```json
{
  "code": "COMPANION_SSO_CODE_INVALID",
  "message": "The SSO authorization code is invalid, expired, or already used."
}
```

| HTTP | Code | Meaning |
| --- | --- | --- |
| `401` | `COMPANION_SSO_CLIENT_INVALID` | Missing or wrong companion Bearer secret |
| `401` | `COMPANION_SSO_CODE_INVALID` | Unknown, expired, replayed, or wrong-system valid-format code |
| `401` | `COMPANION_SSO_ACCOUNT_UNAVAILABLE` | EnrollPro account is missing or inactive |
| `403` | `COMPANION_SSO_ROLE_DENIED` | No role authorized for that companion |
| `403` | `COMPANION_SSO_COMPLETER_BLOCKED` | JHS completer cannot enter an active workspace |
| `403` | `COMPANION_SSO_IDENTITY_INCOMPLETE` | Neither employee ID nor LRN is available |
| `404` | `COMPANION_SSO_SYSTEM_NOT_FOUND` | Unsupported companion path value |
| `409` | `ACTIVE_SCHOOL_YEAR_REQUIRED` | EnrollPro has no initialized active school year |
| `409` | `ACTIVE_SCHOOL_YEAR_CONFLICT` | School settings and active school-year records disagree |
| `428` | `PASSWORD_CHANGE_REQUIRED` | Account still uses a default password |
| `503` | `COMPANION_SSO_NOT_CONFIGURED` | Callback or valid secret is absent |
| `503` | `COMPANION_SSO_UNREACHABLE` | Launch reachability check failed |
| `429` | `COMPANION_SSO_RATE_LIMITED` | Launch or exchange request limit exceeded |

Launch is limited to 10 requests per minute. Exchange is limited to 60 requests per minute. The current limiter uses the requesting IP as its default key.

## AIMS Expected Processing

AIMS reports that `/auth/sso/callback` receives the browser code and its backend calls the EnrollPro exchange route. This matches the EnrollPro design when `AIMS_SSO_CALLBACK_URL` is configured to that exact callback.

After HTTP `200`, AIMS must:

1. Validate `success`, `companion`, all required identity fields, allowed roles, and active school year through a strict runtime schema.
2. Map the local account by `identity.subject`. Employee ID is reconciliation data, not the primary immutable key.
3. Refuse ambiguous or conflicting local account mappings.
4. Store only the EnrollPro subject and fields needed by AIMS.
5. Create an AIMS-owned HTTP-only, Secure, SameSite session cookie.
6. Redirect `SYSTEM_ADMIN` to the AIMS administrator dashboard and other roles to an AIMS-owned role dashboard.
7. Replace the callback URL in browser history so the code does not remain visible.
8. Never retry the same failed code. Return to EnrollPro and request a new launch.
9. Keep logout local to AIMS because coordinated logout is not implemented.

For hardening, AIMS should test a real EnrollPro-issued code, then immediately replay that same code and confirm only the first exchange succeeds.

## Expected SMART Outcome

SMART implements the same callback and backend exchange pattern using the SMART callback URL, `SMART_SSO_CLIENT_SECRET`, `/smart/exchange`, and `companion: "SMART"`.

On success SMART creates its own session and routes the user according to the filtered role. SSO grants identity access only; it does not transfer ownership of grades, learning-area results, promotion outcomes, or attendance. SMART must not interpret the active school-year context as permission to copy prior-year grades.

## Expected ATLAS Outcome

ATLAS implements the same callback and backend exchange pattern using the ATLAS callback URL, `ATLAS_SSO_CLIENT_SECRET`, `/atlas/exchange`, and `companion: "ATLAS"`.

On success ATLAS creates its own session and routes the user according to the filtered role. SSO grants identity access only; it does not transfer ownership of schedules, teaching loads, rooms, or timetable publication. ATLAS must reconcile the supplied active school year before presenting current schedules.

## Expected MRF Outcome

MRF implements the same callback and backend exchange pattern using the MRF callback URL, `MRF_SSO_CLIENT_SECRET`, `/mrf/exchange`, and `companion: "MRF"`.

Only `SYSTEM_ADMIN` and `MRF` are accepted. On success MRF creates its own session and routes the user to its maintenance workspace. SSO does not transfer maintenance, facilities, or waste-management data into EnrollPro.

MRF appears enabled in the catalog only when both valid runtime settings exist. Reachability is checked when the user launches it.

## Reverse Direction: AIMS To EnrollPro

EnrollPro now implements reverse start and callback routes for AIMS, SMART, ATLAS, and MRF. The source companion must implement its authorization and exchange endpoints before the flow becomes operational.

The companion's EnrollPro sidebar item opens:

```text
GET /api/auth/companion-sso/:system/reverse/start
```

EnrollPro sets signed state in an HTTP-only cookie, redirects to the configured companion authorization endpoint, validates the returned state and one-time code, exchanges the code from the EnrollPro backend, links the stable external subject, and creates an EnrollPro-owned session.

The reverse configuration and complete contract are maintained in [Integrated Systems Sidebar and SSO](INTEGRATED-SYSTEMS-SIDEBAR-SSO.md). Generic companion JWTs and shared cross-domain cookies remain unsupported.

## Audit And Privacy

EnrollPro records successful launch, successful exchange, denial, and replay outcomes. Audit metadata includes the companion, reason code, expiration or active school-year ID, IP address, and user agent where applicable.

EnrollPro does not intentionally record:

- plaintext authorization code
- SSO client secret
- EnrollPro password
- EnrollPro JWT or cookie
- companion session token

Companion logs must also avoid full callback URLs because the query contains the short-lived plaintext code.

## Deployment Requirements

Before production use:

1. Apply the Prisma migration that creates `companion_sso_authorization_codes` during an approved deployment window.
2. Configure the exact browser callback URL for each companion.
3. Configure one distinct, random SSO secret per companion on both servers.
4. Rotate every SSO secret that has appeared in documentation, chat, screenshots, Git history, or logs.
5. Verify system clocks are synchronized because code lifetime is 60 seconds.
6. Confirm HTTPS and companion session-cookie settings.
7. Test allowed and denied roles.
8. Test malformed, unknown, expired, replayed, and wrong-system codes separately.
9. Test account deactivation and active-school-year conflict after code issuance.
10. Confirm callback pages remove the code from browser history immediately.
11. Apply the `companion_identity_links` migration before enabling reverse SSO.
12. Configure and verify the companion's reverse authorization and exchange endpoints.

## Current Audit Findings

- AIMS's reported callback and exchange architecture matches the EnrollPro implementation.
- AIMS's reported invalid-code test exercised the HTTP `400` body validator only.
- The canonical response uses `activeSchoolYear` and does not include `isActive` flags.
- Reverse SSO is implemented on the EnrollPro side and remains disabled per companion until that companion implements and configures its reciprocal endpoints.
- The exchange now rechecks account activity inside the transaction, covering deactivation between launch and exchange.
- The client launch timeout and server reachability probe are both three seconds.
- Legacy public API guides contained configured SSO secrets. The values were removed from the working tree, but all affected secrets must be rotated because deletion does not remove Git history or prior copies.
