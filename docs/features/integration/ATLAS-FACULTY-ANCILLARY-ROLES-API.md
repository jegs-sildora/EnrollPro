# ATLAS Faculty Ancillary Roles API

Last reviewed: 2026-09-24

## Purpose

ATLAS uses this EnrollPro feed to reconcile active faculty identity,
school-year assignments, advisership, and ancillary responsibilities. EnrollPro
is authoritative for these personnel fields. ATLAS must not infer authority
from names or manufacture ancillary roles.

## Endpoint

```http
GET /api/integration/v1/default/faculty
```

Production example:

```text
https://dev-jegs.buru-degree.ts.net/api/integration/v1/default/faculty
```

The optional `schoolYearId` query parameter selects one EnrollPro school year:

```http
GET /api/integration/v1/default/faculty?schoolYearId=12
```

When omitted, EnrollPro uses its authoritative active school year. An invalid,
missing, or conflicting active-year configuration fails closed.

## Authentication

Send the ATLAS integration key from the ATLAS backend. Never call this endpoint
from browser JavaScript or expose the key to the browser.

```http
Authorization: Bearer <ATLAS_INTEGRATION_API_KEY>
Accept: application/json
```

`X-Integration-Key: <ATLAS_INTEGRATION_API_KEY>` is also accepted. The actual
key is deployment configuration and is intentionally not included in this
document, source code, issues, or logs.

This service key is separate from ATLAS SSO secrets and from the key EnrollPro
uses when calling ATLAS.

## Response

The endpoint returns all active EnrollPro teacher profiles. It is intentionally
unpaginated for the ATLAS full-faculty reconciliation operation.

```json
{
  "data": [
    {
      "teacherId": 6,
      "employeeId": "1234506",
      "firstName": "Juan Miguel",
      "lastName": "Santos",
      "middleName": null,
      "fullName": "Santos, Juan Miguel",
      "email": null,
      "contactNumber": null,
      "specialization": null,
      "isActive": true,
      "departmentCode": "SCI",
      "departmentName": "SCIENCE",
      "sectionCount": 0,
      "ancillaryRoles": [
        "STE HEAD TEACHER",
        "GRADE 7 COORDINATOR"
      ],
      "isClassAdviser": false,
      "effectiveFrom": null,
      "effectiveTo": null,
      "advisorySection": null
    }
  ],
  "meta": {
    "sourceSystem": "ENROLLPRO",
    "generatedAt": "2026-09-24T00:00:00.000Z",
    "scopeSchoolYearId": 12,
    "scopeSchoolYearLabel": "2030-2031",
    "totalRows": 42
  }
}
```

IDs and timestamps above are illustrative. ATLAS must use the returned values.

## `ancillaryRoles` Contract

`ancillaryRoles` is always a JSON string array. EnrollPro builds it from:

1. profile-level `Teacher.ancillaryRoles`; and
2. `TeacherDesignation.ancillaryRoles` for the requested school year.

EnrollPro trims blank values, removes empty entries, and deduplicates exact
role strings while preserving source order. A teacher with no ancillary
assignment receives `"ancillaryRoles": []`, never `null` and never an omitted
field.

School-year roles are scoped only to the requested `schoolYearId`. ATLAS must
replace its mirrored ancillary-role set on each successful reconciliation so a
removed EnrollPro role is removed from ATLAS as well. Do not append forever or
retain a role that disappeared from a later response.

Ancillary labels describe operational responsibilities. Application access is
authorized separately through EnrollPro application roles and SSO claims. For
example, the exact `GRADE_LEVEL_COORDINATOR` application role authorizes the
ATLAS scheduler role; the ancillary label `GRADE 7 COORDINATOR` is not an
authorization substitute.

## ATLAS Reconciliation

1. Read `/api/integration/v1/school-year` and retain its canonical ID.
2. Fetch `/api/integration/v1/default/faculty?schoolYearId=<id>`.
3. Match faculty by `employeeId`; keep `teacherId` as the stable EnrollPro
   record reference.
4. Upsert identity, department, adviser context, and the complete returned
   `ancillaryRoles` array in one reconciliation transaction.
5. Remove mirrored roles absent from the latest successful response.
6. Record synchronization time and source status without logging the key or
   full response payload.

Do not erase the last successful ATLAS mirror when EnrollPro is unreachable or
returns an error. Mark it stale and retry idempotently.

## Detailed Compatibility Feed

ATLAS may use the paginated detailed endpoint when it needs professional and
academic profile fields:

```http
GET /api/integration/v1/faculty?schoolYearId=<id>&page=1&limit=200
```

Its `ancillaryRoles` field uses the same merge, trimming, empty-array, and
deduplication contract. Continue until `page >= totalPages`.

## Errors

| Status | Meaning | ATLAS action |
| --- | --- | --- |
| `400` | Invalid query value | Correct the request; do not retry unchanged |
| `401` | Missing or incorrect integration key | Correct server configuration |
| `404` | Requested school year does not exist | Reconcile the school-year ID |
| `409` | Active-year settings are uninitialized or inconsistent | Keep prior data stale and alert an administrator |
| `500` | EnrollPro could not produce the feed | Keep prior data and retry with backoff |

## Acceptance Checks

- Every returned faculty row contains `ancillaryRoles` as an array.
- Profile and requested-year assignments are both present and deduplicated.
- Grade coordinators retain their exact ancillary labels.
- A teacher with no assignments returns an empty array.
- Querying another school year does not leak the current year's designation
  roles into that year.
- Removing a role in EnrollPro removes it after the next successful ATLAS sync.
- No integration key or SSO secret appears in client code, URLs, logs, or sync
  records.

