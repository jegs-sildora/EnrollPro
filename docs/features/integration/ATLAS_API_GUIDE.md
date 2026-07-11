# ATLAS API Guide (Fetch from EnrollPro)

This guide shows how ATLAS can fetch teacher and designation data from EnrollPro.

It also shows how to use the generic faculty route as a compatibility fallback.

## What ATLAS Should Fetch

ATLAS should fetch these feeds:

1. Default feed:

- `GET /api/integration/v1/default/faculty`

2. Generic paginated feed:

- `GET /api/integration/v1/faculty`

## API-First Rule for ATLAS Startup

Before ATLAS starts sync jobs, EnrollPro API must already be healthy.

If your teammate runs:

- `pnpm dev`
- `npm run dev`
- `npm run serve`

ATLAS should still wait for EnrollPro health before first fetch.

Use this order:

1. EnrollPro host runs API first.
2. ATLAS machine runs ATLAS app command.
3. ATLAS checks health endpoints.
4. ATLAS starts faculty sync.

See [Subsystem API Quick Start](./SUBSYSTEM_API_QUICK_START.md) for shared setup.

## Connection Model (Host and Team)

- Host machine only: Node connects to PostgreSQL at `localhost:5432`.
- Team machines: fetch API from host at `https://dev-jegs.buru-degree.ts.net`.

API endpoint bases for this system:

- Main API base: `https://dev-jegs.buru-degree.ts.net/api`
- Integration API base: `https://dev-jegs.buru-degree.ts.net/api/integration/v1`

## 1. Environment Values

```env
ENROLLPRO_BASE_URL="https://dev-jegs.buru-degree.ts.net"
ENROLLPRO_API_BASE_URL="https://dev-jegs.buru-degree.ts.net/api"
ENROLLPRO_INTEGRATION_BASE_URL="https://dev-jegs.buru-degree.ts.net/api/integration/v1"
```

## 2. Health Checks Before Fetch

### Public health

```bash
curl https://dev-jegs.buru-degree.ts.net/api/health
```

### Integration health

```bash
curl https://dev-jegs.buru-degree.ts.net/api/integration/v1/health
```

## 3. Fetch ATLAS Default Feed

```bash
curl https://dev-jegs.buru-degree.ts.net/api/integration/v1/default/faculty
```

Optional school year override:

```bash
curl "https://dev-jegs.buru-degree.ts.net/api/integration/v1/default/faculty?schoolYearId=12"
```

If `schoolYearId` is not provided, EnrollPro uses active school year.

## 4. Fetch Generic Faculty Feed

```bash
curl "https://dev-jegs.buru-degree.ts.net/api/integration/v1/faculty?schoolYearId=12&page=1&limit=50"
```

Use this paginated feed when ATLAS needs filtering or incremental ingestion.

## 5. Minimal Field Mapping for ATLAS

Map these fields into ATLAS teacher records:

- `teacherId` -> `atlasTeacherId`
- `employeeId` -> `employeeCode`
- `fullName` -> `displayName`
- `specialization` -> `subjectSpecialization`
- `isClassAdviser` -> `isAdvisor`
- `advisorySection.name` -> `advisorSectionName`

Meta fields to keep for logging:

- `meta.sourceSystem`
- `meta.generatedAt`
- `meta.scopeSchoolYearId`
- `meta.totalRows`

## 6. Simple JS Fetch Example

```js
async function fetchAtlasFaculty() {
  const integrationBase =
    process.env.ENROLLPRO_INTEGRATION_BASE_URL ||
    "https://dev-jegs.buru-degree.ts.net/api/integration/v1";

  const defaultRes = await fetch(`${integrationBase}/default/faculty`);

  if (defaultRes.ok) {
    return defaultRes.json();
  }

  const genericRes = await fetch(`${integrationBase}/faculty`);
  if (!genericRes.ok) {
    throw new Error("Both default and generic ATLAS feeds failed");
  }

  return genericRes.json();
}
```

## 7. Suggested Sync Flow in ATLAS

1. Wait for EnrollPro health checks.
2. Pull default feed.
3. Validate required fields.
4. Upsert teacher records in ATLAS.
5. Save `generatedAt` and `scopeSchoolYearId` for trace logs.
6. Use the generic faculty feed only when pagination or filtering is required.

## 8. Common Errors

- `503`: API degraded.

## 9. Done Checklist

- ATLAS can pass both health checks.
- ATLAS can fetch default faculty feed.
- ATLAS can fetch the generic faculty feed.
- ATLAS waits for API readiness before sync starts.
