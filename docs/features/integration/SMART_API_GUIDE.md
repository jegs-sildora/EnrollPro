# SMART API Guide (Fetch from EnrollPro)

This guide shows how SMART can fetch enrolled learner records from EnrollPro.

It also shows how to fetch sample learner records for testing.

## What SMART Should Fetch

SMART should fetch these feeds:

1. Default feed (public main source):

- `GET /api/integration/v1/default/smart/students`

2. Keyless sample feed (testing source):

- `GET /api/integration/v1/sample/students`

## API-First Rule for SMART Startup

SMART must wait for EnrollPro API readiness before fetching learners.

Even if teammate starts SMART with:

- `pnpm dev`
- `npm run dev`
- `npm run serve`

SMART should do health checks first, then sync.

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

## 3. Fetch SMART Default Feed

```bash
curl https://dev-jegs.buru-degree.ts.net/api/integration/v1/default/smart/students
```

Optional school year override:

```bash
curl "https://dev-jegs.buru-degree.ts.net/api/integration/v1/default/smart/students?schoolYearId=12"
```

If `schoolYearId` is not provided, EnrollPro uses active school year.

## 4. Fetch Sample Students Feed (No Key)

```bash
curl https://dev-jegs.buru-degree.ts.net/api/integration/v1/sample/students
```

Use sample feed for:

- local testing
- demo import run
- fallback dry run in non-production

## 5. Minimal Field Mapping for SMART

Map these fields into SMART student records:

- `enrollmentApplicationId` -> `sourceEnrollmentId`
- `learner.externalId` -> `learnerExternalId`
- `learner.lrn` -> `lrn`
- `learner.fullName` -> `studentName`
- `gradeLevel.id` -> `gradeLevelId`
- `gradeLevel.name` -> `gradeLevelName`
- `section.id` -> `sectionId`
- `section.name` -> `sectionName`
- `section.programType` -> `programType`
- `schoolYear.id` -> `schoolYearId`
- `schoolYear.yearLabel` -> `schoolYearLabel`
- `enrolledAt` -> `enrolledAt`

Meta fields to keep for logging:

- `meta.sourceSystem`
- `meta.generatedAt`
- `meta.scopeSchoolYearId`
- `meta.totalRows`

## 6. Simple JS Fetch Example

```js
async function fetchSmartStudents() {
  const integrationBase =
    process.env.ENROLLPRO_INTEGRATION_BASE_URL ||
    "https://dev-jegs.buru-degree.ts.net/api/integration/v1";

  const defaultRes = await fetch(`${integrationBase}/default/smart/students`);

  if (defaultRes.ok) {
    return defaultRes.json();
  }

  // Optional testing fallback
  const sampleRes = await fetch(`${integrationBase}/sample/students`);
  if (!sampleRes.ok) {
    throw new Error("Both default and sample SMART feeds failed");
  }

  return sampleRes.json();
}
```

## 7. Suggested Sync Flow in SMART

1. Wait for API health checks.
2. Pull default students feed.
3. Validate learner and section fields.
4. Upsert records in SMART.
5. Save sync metadata (`generatedAt`, school year, total rows).
6. Use sample feed for testing only.

## 8. Common Errors

- `503`: Service degraded.

## 9. Done Checklist

- SMART can pass both health checks.
- SMART can fetch default students feed.
- SMART can fetch sample students feed.
- SMART waits for API readiness before first sync.
