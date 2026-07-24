# Subsystem API Quick Start

Last reviewed: 2026-07-24

This guide gives SMART, ATLAS, AIMS, and MRF teams the minimum EnrollPro setup. The complete catalog is in [EnrollPro API](ENROLLPRO-API.md).

## Shared Configuration

```text
ENROLLPRO_BASE_URL=https://configured-enrollpro-host
ENROLLPRO_INTEGRATION_BASE_URL=https://configured-enrollpro-host/api/integration/v1
```

Do not commit a real host or key. A Tailscale address may be supplied through these variables for a private deployment.

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
