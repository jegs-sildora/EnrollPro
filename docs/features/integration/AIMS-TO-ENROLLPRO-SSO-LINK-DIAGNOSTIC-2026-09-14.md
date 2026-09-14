# AIMS to EnrollPro SSO Identity-Link Diagnostic

Date: 2026-09-14  
Direction: AIMS -> EnrollPro  
Status: Action required from AIMS

## Reported Error

EnrollPro redirects the browser to its personnel login page with:

```text
COMPANION_REVERSE_SSO_LINK_REQUIRED
```

The user-facing message is:

```text
Your AIMS identity is not linked to an EnrollPro account.
```

This is not a generic connection or callback error. EnrollPro emits this code only when the AIMS exchange completed successfully but the returned identity could not be reconciled to exactly one EnrollPro account.

## EnrollPro Verification Result

EnrollPro verified the following using read-only checks. No account, identity link, or database record was changed.

| Check | Result |
| --- | --- |
| EnrollPro employee ID `1234501` exists | Yes |
| EnrollPro account is active | Yes |
| Password change is still required | No |
| EnrollPro role permits staff access | Yes, `SYSTEM_ADMIN` |
| Teacher record is connected to the EnrollPro user | Yes |
| An AIMS identity link already exists for this EnrollPro user | Yes |
| Last successful authentication through that AIMS link | 2026-09-11 09:26:58 UTC |
| Latest recorded denial | `COMPANION_REVERSE_SSO_LINK_REQUIRED` on 2026-09-14 11:47:21 UTC |

The callback progressed far enough to rule out these failures:

- missing or invalid EnrollPro state cookie
- invalid or expired signed state
- malformed callback query
- unreachable AIMS exchange endpoint
- rejected reverse client secret
- non-JSON AIMS exchange response
- invalid AIMS exchange response schema
- wrong `issuer`
- active-school-year mismatch
- inactive EnrollPro account
- default-password requirement
- denied EnrollPro role

Those conditions have separate error codes and occur before identity-link reconciliation.

## Conclusion

The current failure is caused by the identity assertion returned by AIMS, or by AIMS selecting the wrong local account while issuing the authorization code.

EnrollPro first searches for this exact link:

```text
(companion = AIMS, externalSubject = identity.subject)
```

The user already has an AIMS link, but the latest assertion did not match it. This means AIMS is now returning a different `identity.subject`, or the code was issued for a different AIMS account.

When the subject is not linked, EnrollPro permits controlled first-time reconciliation only through:

1. `identity.employeeId` matching one EnrollPro user or connected teacher; or
2. `identity.lrn` matching one EnrollPro learner user.

The returned error was `LINK_REQUIRED`, which means EnrollPro found zero candidates. If AIMS had returned `employeeId: "1234501"`, EnrollPro would have found the existing user. Therefore, the latest AIMS assertion most likely returned a null, blank, or different employee ID. The employee ID entered on the AIMS login screen does not prove that the exchange response contains the same value.

## Required AIMS Exchange Response

AIMS must return HTTP `200` with this structure from its server-to-server exchange endpoint:

```json
{
  "success": true,
  "issuer": "AIMS",
  "identity": {
    "subject": "AIMS_USER:<stable-non-recycled-user-id>",
    "employeeId": "1234501",
    "lrn": null,
    "accountName": "1234501",
    "email": null,
    "firstName": "<matching EnrollPro first name>",
    "middleName": "<matching value or null>",
    "lastName": "<matching EnrollPro last name>",
    "roles": ["SYSTEM_ADMIN"]
  },
  "activeSchoolYear": {
    "id": 9,
    "yearLabel": "2030-2031"
  },
  "authenticatedAt": "<ISO-8601 timestamp with offset>"
}
```

The example school-year ID must be replaced with the EnrollPro-authoritative ID currently mirrored by AIMS. Both the ID and label must match EnrollPro.

### Mandatory Identity Rules

- `identity.subject` must be stable for the lifetime of the AIMS account.
- Do not generate a new subject per login, token, session, role, or school year.
- Do not use a mutable email address as the subject.
- `identity.employeeId` must be the canonical seven-character DepEd employee ID for staff.
- For this account, return the exact string `1234501`, without spaces or numeric conversion.
- `identity.lrn` must be `null` for staff and a valid 12-digit string only for learners.
- Names must represent the same person as the employee ID and must match EnrollPro after trimming and case normalization.
- The authorization code must remain bound to the AIMS user who authorized it.
- AIMS must not copy an EnrollPro subject into `identity.subject`; the subject must identify the AIMS account.

## Requested AIMS Investigation

Please inspect the AIMS authorize and exchange implementation for the failed request and answer these questions:

1. What exact non-secret `identity.subject` was stored with the authorization code?
2. Is that subject the immutable AIMS user ID, and is it the same value AIMS returned during the successful September 11 login?
3. What exact `identity.employeeId` did the exchange return? It must be the string `1234501`.
4. Does the authorize handler obtain the current user from the fully hydrated AIMS session before issuing the code?
5. Does the code row store the authenticated AIMS user ID, rather than reading whichever user is active during exchange?
6. Does the exchange handler load identity from the code's stored `userId`?
7. Could a stale browser JWT, local-storage session, account switch, or administrator impersonation cause the code to belong to another AIMS account?
8. Is AIMS converting the employee ID to a number, reading it from the wrong profile column, or returning it as `null`?
9. Is AIMS generating or replacing local users during synchronization, thereby changing the stable subject?
10. Are multiple AIMS accounts using employee ID `1234501`?

Do not send authorization codes, client secrets, passwords, cookies, JWTs, or signed state values in the response. AIMS may provide the identity fields above and a one-way hash of the subject if policy prohibits sharing the internal subject.

## Required AIMS Fix

1. Resolve the authenticated user before issuing the authorization code.
2. Store that immutable AIMS user ID on the one-time code record.
3. During exchange, atomically consume the code and load the same stored user.
4. Return a stable subject derived from the immutable AIMS user ID.
5. Return the canonical employee ID from the personnel record, not from an optional UI/session field.
6. Reject issuance when a staff identity has no employee ID or has conflicting personnel records.
7. Keep the subject stable across school years, role changes, profile edits, and password changes.
8. Add a regression test proving two logins by the same AIMS user return the same subject and employee ID.

If AIMS intentionally changed the stable subject, do not ask EnrollPro to silently create or replace a link. The two system administrators must verify the old and new AIMS identities refer to the same person before any link remediation. Automatic relinking would create an account-takeover risk.

## Endpoint Contract

## SSO Token and Configuration Key Matrix

Only key names are documented here. Secret values must be exchanged through an approved secure channel and must never be committed, placed in browser code, included in URLs, or copied into support logs.

| System | EnrollPro -> system exchange key | System -> EnrollPro exchange key | Non-SSO integration key; never reuse for SSO |
| --- | --- | --- | --- |
| AIMS | `AIMS_SSO_CLIENT_SECRET` | `AIMS_SSO_REVERSE_CLIENT_SECRET` | `AIMS_API_KEY` |
| SMART | `SMART_SSO_CLIENT_SECRET` | `SMART_SSO_REVERSE_CLIENT_SECRET` | `SMART_API_KEY` |
| ATLAS | `ATLAS_SSO_CLIENT_SECRET` | `ATLAS_SSO_REVERSE_CLIENT_SECRET` | `ATLAS_API_KEY` |
| MRF | `MRF_SSO_CLIENT_SECRET` | `MRF_SSO_REVERSE_CLIENT_SECRET` | `MRF_INTEGRATION_API_KEY` |

Each companion has these complete EnrollPro-side SSO settings:

```text
ATLAS_SSO_CALLBACK_URL
ATLAS_SSO_CLIENT_SECRET
ATLAS_SSO_REVERSE_AUTHORIZE_URL
ATLAS_SSO_REVERSE_EXCHANGE_URL
ATLAS_SSO_REVERSE_CLIENT_ID
ATLAS_SSO_REVERSE_CLIENT_SECRET

AIMS_SSO_CALLBACK_URL
AIMS_SSO_CLIENT_SECRET
AIMS_SSO_REVERSE_AUTHORIZE_URL
AIMS_SSO_REVERSE_EXCHANGE_URL
AIMS_SSO_REVERSE_CLIENT_ID
AIMS_SSO_REVERSE_CLIENT_SECRET

SMART_SSO_CALLBACK_URL
SMART_SSO_CLIENT_SECRET
SMART_SSO_REVERSE_AUTHORIZE_URL
SMART_SSO_REVERSE_EXCHANGE_URL
SMART_SSO_REVERSE_CLIENT_ID
SMART_SSO_REVERSE_CLIENT_SECRET

MRF_SSO_CALLBACK_URL
MRF_SSO_CLIENT_SECRET
MRF_SSO_REVERSE_AUTHORIZE_URL
MRF_SSO_REVERSE_EXCHANGE_URL
MRF_SSO_REVERSE_CLIENT_ID
MRF_SSO_REVERSE_CLIENT_SECRET
```

`*_SSO_CLIENT_SECRET` authenticates the companion when it exchanges an EnrollPro-issued code. `*_SSO_REVERSE_CLIENT_SECRET` authenticates EnrollPro when it exchanges a companion-issued code. These must be different random values of at least 32 characters. The `*_API_KEY` values authorize data feeds and must not be accepted by either SSO exchange endpoint.

## Mirrored Authorization-Code Pattern

Both directions use the same security pattern with issuer and destination reversed:

| Step | EnrollPro -> AIMS | AIMS -> EnrollPro |
| --- | --- | --- |
| Start | EnrollPro authenticated sidebar action | AIMS authenticated sidebar action opens EnrollPro `reverse/start` |
| Code issuer | EnrollPro | AIMS |
| Code storage | EnrollPro stores only the hash | AIMS stores only the hash |
| Browser callback | AIMS registered callback | EnrollPro fixed reverse callback |
| Backend exchange caller | AIMS | EnrollPro |
| Exchange authentication | `AIMS_SSO_CLIENT_SECRET` | `AIMS_SSO_REVERSE_CLIENT_SECRET` |
| Identity authority | EnrollPro assertion | AIMS assertion reconciled against EnrollPro |
| Final session owner | AIMS | EnrollPro |

Neither direction shares a password, cookie, JWT, session token, API key, or database connection.

### Start URL used by the AIMS sidebar

```http
GET https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/aims/reverse/start
```

AIMS should navigate to this URL in the same browser tab. It must not construct the AIMS authorize URL itself.

### Authorization request EnrollPro sends to AIMS

```http
GET https://tfrog.buru-degree.ts.net/auth/enrollpro/authorize
  ?response_type=code
  &client_id=enrollpro
  &redirect_uri=https%3A%2F%2Fdev-jegs.buru-degree.ts.net%2Fapi%2Fauth%2Fcompanion-sso%2Faims%2Freverse%2Fcallback
  &state=<opaque-signed-state>
```

### Exchange request EnrollPro sends to AIMS

```http
POST https://tfrog.buru-degree.ts.net/api/v1/auth/sso/exchange
Authorization: Bearer <AIMS reverse SSO client secret>
Content-Type: application/json

{
  "code": "<single-use-code>",
  "clientId": "enrollpro",
  "redirectUri": "https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/aims/reverse/callback"
}
```

The code must be single-use, expire within 60 seconds, and be bound to `clientId`, redirect URI, and the authorizing AIMS user.

## Expected Successful Result

After AIMS returns the correct stable identity:

1. EnrollPro finds the existing `(AIMS, subject)` link, or identifies exactly one first-time candidate by employee ID.
2. EnrollPro confirms names and optional account/email fields do not conflict.
3. EnrollPro confirms the linked account is active and authorized.
4. EnrollPro creates its own HTTP-only authentication session.
5. A system administrator or head registrar is redirected to `/dashboard`.
6. No EnrollPro password prompt is shown.

## Acceptance Checklist

- [ ] AIMS returns `issuer: "AIMS"`.
- [ ] The same AIMS account returns the same `identity.subject` on every login.
- [ ] Employee `1234501` is returned as `identity.employeeId: "1234501"`.
- [ ] The code is associated with the currently authenticated AIMS account.
- [ ] AIMS and EnrollPro active school-year ID and label match.
- [ ] One code produces exactly one successful exchange.
- [ ] A replayed or expired code fails.
- [ ] A successful exchange redirects to the EnrollPro dashboard.
- [ ] A second login succeeds through the existing identity link.
- [ ] Logs contain stable error codes but no codes, secrets, tokens, or full identity payloads.

## EnrollPro Status

No EnrollPro controller or database correction is required for this error. The EnrollPro reverse callback, AIMS exchange validation, school-year validation, candidate matching, and existing identity-link support are operational. EnrollPro correctly fails closed when AIMS changes or omits the identifiers required to prove account ownership.

Related EnrollPro implementation:

- `server/src/features/auth/companion-sso-reverse.service.ts`
- `server/src/features/auth/companion-sso.controller.ts`
- `server/src/features/auth/auth.router.ts`
- `shared/src/schemas/companion-sso.schema.ts`
- `docs/features/integration/INTEGRATED-SYSTEMS-SIDEBAR-SSO.md`
