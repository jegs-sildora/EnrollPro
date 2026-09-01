# Subsystem API Quick Start

Last reviewed: 2026-09-01

This guide gives SMART, ATLAS, AIMS, and MRF teams the minimum EnrollPro setup. The complete catalog is in [EnrollPro API](ENROLLPRO-API.md).

## Shared Configuration

```text
ENROLLPRO_BASE_URL=https://configured-enrollpro-host
ENROLLPRO_INTEGRATION_BASE_URL=https://configured-enrollpro-host/api/integration/v1
```

Do not commit a real host or key. A Tailscale address may be supplied through these variables for a private deployment.

## Sidebar SSO

The EnrollPro staff sidebar uses a 60-second, single-use authorization code. It
does not share an EnrollPro password, JWT, or cookie. Each companion must expose
a browser callback, exchange the code from its backend, and create its own
HTTP-only session.

```text
POST <ENROLLPRO_BASE_URL>/api/auth/companion-sso/<system>/exchange
Authorization: Bearer <SYSTEM_SSO_CLIENT_SECRET>
Content-Type: application/json

{"code":"<single-use-code>"}
```

The `<system>` value is `atlas`, `aims`, `smart`, or `mrf`. Do not exchange the
code in browser JavaScript or retry a failed code. Return the user to EnrollPro
to start a new launch after an expired or failed exchange.

Implementation guides:

- [ATLAS EnrollPro SSO](ATLAS-ENROLLPRO-SSO.md)
- [AIMS EnrollPro SSO](AIMS-ENROLLPRO-SSO.md)
- [SMART EnrollPro SSO](SMART-ENROLLPRO-SSO.md)
- [MRF EnrollPro SSO](MRF-ENROLLPRO-SSO.md)

## Shared Staff Login

SMART, AIMS, and ATLAS may verify an EnrollPro-managed staff account through:

```text
POST <ENROLLPRO_BASE_URL>/api/auth/verify
```

Send the exact browser page that initiated sign-in so EnrollPro can return the
user to that page after the required password change:

```json
{
  "accountName": "<employee ID or account name>",
  "password": "<submitted password>",
  "returnTo": "https://configured-smart-host/login/teacher"
}
```

When the response is HTTP `428` with
`code: PASSWORD_CHANGE_REQUIRED`, do not create a companion-system session.
Navigate the current browser window to the returned absolute
`passwordChangeUrl`, or open it in a popup. The user completes the existing
EnrollPro password-change form and EnrollPro redirects to the signed `returnTo`
URL. The companion system must then require sign-in with the replacement
password. The ticket expires after five minutes and cannot authenticate any
other EnrollPro route.

The companion browser host must match its configured SMART, AIMS, or ATLAS API
host, or its browser origin must be listed in `COMPANION_APP_URLS` on the
EnrollPro server. `ENROLLPRO_PUBLIC_URL` should identify the browser-facing
EnrollPro application when the API and frontend use different hosts. A
companion login page that treats HTTP `428` as a generic error will not open the
password-change form.

Companion systems must not copy, store, or replace EnrollPro passwords.

## Health And School Year

```bash
curl "$ENROLLPRO_INTEGRATION_BASE_URL/health"
curl "$ENROLLPRO_INTEGRATION_BASE_URL/school-year"
```

Persist the returned EnrollPro school-year ID with synchronized records.

## Consumer Feeds

### SMART

```bash
curl "$ENROLLPRO_INTEGRATION_BASE_URL/default/smart/students?schoolYearId=12"
curl "$ENROLLPRO_INTEGRATION_BASE_URL/sections?schoolYearId=12"
```

SMART returns finalized academic outcomes through the contract described in [SMART API Guide](SMART_API_GUIDE.md).

### ATLAS

```bash
curl "$ENROLLPRO_INTEGRATION_BASE_URL/default/faculty?schoolYearId=12"
curl "$ENROLLPRO_INTEGRATION_BASE_URL/sections?schoolYearId=12"
```

ATLAS owns published schedules. See [ATLAS API Guide](ATLAS_API_GUIDE.md).

### AIMS

```bash
curl "$ENROLLPRO_INTEGRATION_BASE_URL/default/aims/context?schoolYearId=12"
```

AIMS owns intervention data. See [AIMS API Guide](AIMS_API_GUIDE.md).

### MRF

```bash
curl "$ENROLLPRO_INTEGRATION_BASE_URL/default/mrf/identities?schoolYearId=12" \
  -H "X-Integration-Key: $MRF_INTEGRATION_API_KEY"
```

MRF owns maintenance and waste-management records. See [MRF API Guide](MRF_API_GUIDE.md).

## Client Example

```ts
interface SchoolYearContext {
  id: number
  name: string
}

const baseUrl = process.env.ENROLLPRO_INTEGRATION_BASE_URL

if (!baseUrl) {
  throw new Error("ENROLLPRO_INTEGRATION_BASE_URL is required")
}

const response = await fetch(`${baseUrl}/school-year`)

if (!response.ok) {
  throw new Error(`EnrollPro request failed with ${response.status}`)
}

const payload: unknown = await response.json()
```

Narrow `unknown` through a runtime schema or type guard before use.

## Operational Rules

- Use explicit school-year scope for reconciliation.
- Retry read-only failures with bounded backoff.
- Do not fabricate missing EnrollPro or companion data.
- Refresh only after atomic rollover exposes the new active year.
- Request only fields owned and needed by the consumer.
