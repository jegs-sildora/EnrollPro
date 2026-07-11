# AIMS API Guide (Fetch from EnrollPro)

This guide shows how AIMS can fetch learner context from EnrollPro.

It also shows how to use the generic learner route as a compatibility fallback.

## What AIMS Should Fetch

AIMS should fetch these feeds:

1. Default feed (public main source):

- `GET /api/integration/v1/default/aims/context`

2. Generic paginated feed:

- `GET /api/integration/v1/learners`

## API-First Rule for AIMS Startup

AIMS must not start learner sync until EnrollPro API is healthy.

Even if teammate starts AIMS using:

- `pnpm dev`
- `npm run dev`
- `npm run serve`

AIMS should run health checks first, then fetch.

See [Subsystem API Quick Start](./SUBSYSTEM_API_QUICK_START.md) for shared startup flow.

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

## 3. Fetch AIMS Default Feed

```bash
curl https://dev-jegs.buru-degree.ts.net/api/integration/v1/default/aims/context
```

Optional school year override:

```bash
curl "https://dev-jegs.buru-degree.ts.net/api/integration/v1/default/aims/context?schoolYearId=12"
```

If `schoolYearId` is not provided, EnrollPro uses active school year.

## 4. Fetch Generic Learner Feed

```bash
curl "https://dev-jegs.buru-degree.ts.net/api/integration/v1/learners?schoolYearId=12&page=1&limit=50"
```

Use this route when AIMS requires generic learner filters or a compatibility fallback.

## 5. Minimal Field Mapping for AIMS

Map these fields into AIMS learner context records:

- `enrollmentApplicationId` -> `sourceEnrollmentId`
- `learner.externalId` -> `learnerExternalId`
- `learner.lrn` -> `learnerLrn`
- `learner.fullName` -> `learnerName`
- `applicantType` -> `intakeType`
- `learnerType` -> `learnerType`
- `learningModalities` -> `modalities`
- `context.gradeLevel.name` -> `gradeName`
- `context.section.name` -> `sectionName`
- `context.schoolYear.yearLabel` -> `schoolYearLabel`

Meta fields to keep for logging:

- `meta.sourceSystem`
- `meta.generatedAt`
- `meta.scopeSchoolYearId`
- `meta.totalRows`

## 6. Simple JS Fetch Example

```js
async function fetchAimsContext() {
  const integrationBase =
    process.env.ENROLLPRO_INTEGRATION_BASE_URL ||
    "https://dev-jegs.buru-degree.ts.net/api/integration/v1";

  const defaultRes = await fetch(`${integrationBase}/default/aims/context`);

  if (defaultRes.ok) {
    return defaultRes.json();
  }

  const genericRes = await fetch(`${integrationBase}/learners`);
  if (!genericRes.ok) {
    throw new Error("Both default and generic AIMS feeds failed");
  }

  return genericRes.json();
}
```

## 7. Suggested Sync Flow in AIMS

1. Wait for API health checks.
2. Pull default context feed.
3. Validate learner identity fields.
4. Upsert context records into AIMS store.
5. Save sync metadata (`generatedAt`, school year, total rows).
6. Use the generic feed only when additional filters are required.

## 8. Common Errors

- `503`: Service degraded.

## 9. Done Checklist

- AIMS can pass both health checks.
- AIMS can fetch default context feed.
- AIMS can fetch the generic learner feed.
- AIMS waits for API readiness before first sync.
