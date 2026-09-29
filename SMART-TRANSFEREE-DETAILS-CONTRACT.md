# EnrollPro to SMART: Transferee Details Contract

Contract revision: **v1.1 (additive fields on the existing v1 route)**  
Effective: **2026-09-29**  
Implementation: **EnrollPro implemented; SMART consumption pending**

## Endpoint and authentication

Option **A** is implemented. Each existing transferee feed row now includes the fields below; no detail endpoint or per-learner request is needed.

```http
GET /api/integration/v1/default/smart/transferees?schoolYearId=12&page=1&limit=50
X-Integration-Key: <SMART_INTEGRATION_API_KEY>
```

`Authorization: Bearer <SMART_INTEGRATION_API_KEY>` is also accepted. The expanded transferee route now accepts **only** the configured SMART integration key. The general SMART students feed is unchanged. The key must remain on the SMART server; never place it in browser code, URLs, logs, or this document.

## Added row fields

Every active-year row contains every key in this table. Unknown stored values are `null`, not omitted.

| Field | JSON type | Null? | EnrollPro source and meaning |
| --- | --- | --- | --- |
| `previousSchoolName` | string | Yes | `EnrollmentPreviousSchool.schoolName` |
| `originatingSchoolId` | string | Yes | `EnrollmentPreviousSchool.schoolId`; preserve leading zeroes |
| `transferCertificateNo` | string | Yes | `EnrollmentPreviousSchool.transferCertificateNo` |
| `previousGenAve` | number | Yes | `EnrollmentPreviousSchool.generalAverage`; no inferred grade |
| `lastGradeCompleted` | string | Yes | `EnrollmentPreviousSchool.lastGradeCompleted`; entered by staff, never inferred from incoming grade |
| `sf9EligibilityStatus` | `PROMOTED` \| `CONDITIONALLY_PROMOTED` \| `RETAINED` | No | `EnrollmentApplication.academicStatus` |
| `conditionalSubjectCodes` | string[] (0-2) | No | `EnrollmentBackSubject.subjectCode`, ordered by record ID; `[]` means no selected back subjects |
| `hasSf9` | boolean | No | Inverse of `EnrollmentApplication.isMissingSf9` |
| `hasPsa` | boolean | No | `Learner.hasPsaBirthCertificate` |
| `isTemporarilyEnrolled` | boolean | No | `EnrollmentApplication.isTemporarilyEnrolled` |

The underlying previous-school table is `application_previous_schools`, not `enrollment_previous_schools`. Existing records without `lastGradeCompleted` return `null`; the walk-in form now optionally captures and stores it for future records. The non-nullable eligibility/document fields have database defaults on legacy applications. A default value is **not** proof that staff verified a historical SF9 or PSA document; SMART should distinguish this feed from a document-audit trail.

`birthdate` and `sex` are intentionally not added. SMART already receives them from its main learner feed and does not need another copy here.

## Complete example

```json
{
  "data": [{
    "enrollmentApplicationId": 321,
    "enrollmentStatus": "OFFICIALLY_ENROLLED",
    "lrn": "123456789012",
    "isPendingLrn": false,
    "fullName": "DELA CRUZ, JUAN SANTOS",
    "firstName": "JUAN",
    "lastName": "DELA CRUZ",
    "middleName": "SANTOS",
    "extensionName": null,
    "gradeLevel": { "id": 2, "name": "Grade 8", "displayOrder": 8 },
    "section": { "id": 45, "name": "Makakalikasan", "programType": "REGULAR" },
    "enrolledAt": "2030-06-03T01:30:00.000Z",
    "eosyStatus": null,
    "dropOutDate": null,
    "dropOutReason": null,
    "transferOutDate": null,
    "previousSchoolName": "RIZAL NATIONAL HIGH SCHOOL",
    "originatingSchoolId": "123456",
    "transferCertificateNo": "TC-2030-001",
    "previousGenAve": 84.5,
    "lastGradeCompleted": "Grade 7",
    "sf9EligibilityStatus": "CONDITIONALLY_PROMOTED",
    "conditionalSubjectCodes": ["MATH", "ENG"],
    "hasSf9": true,
    "hasPsa": false,
    "isTemporarilyEnrolled": true,
    "schoolYear": { "id": 12, "yearLabel": "2030-2031" }
  }],
  "meta": {
    "sourceSystem": "SMART",
    "contractVersion": "1.1",
    "generatedAt": "2030-06-03T01:31:00.000Z",
    "scopeSchoolYearId": 12,
    "scopeSchoolYearLabel": "2030-2031",
    "total": 1,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

## Unknown-value example

The request is the same endpoint and headers shown above. When optional previous-school values are absent, a complete response can be:

```json
{
  "data": [{
    "enrollmentApplicationId": 322,
    "enrollmentStatus": "OFFICIALLY_ENROLLED",
    "lrn": "123456789013",
    "isPendingLrn": false,
    "fullName": "SANTOS, MARIA",
    "firstName": "MARIA",
    "lastName": "SANTOS",
    "middleName": null,
    "extensionName": null,
    "gradeLevel": { "id": 1, "name": "Grade 7", "displayOrder": 7 },
    "section": { "id": 46, "name": "Bonifacio", "programType": "REGULAR" },
    "enrolledAt": "2030-06-03T02:00:00.000Z",
    "eosyStatus": null,
    "dropOutDate": null,
    "dropOutReason": null,
    "transferOutDate": null,
    "previousSchoolName": null,
    "originatingSchoolId": null,
    "transferCertificateNo": null,
    "previousGenAve": null,
    "lastGradeCompleted": null,
    "sf9EligibilityStatus": "PROMOTED",
    "conditionalSubjectCodes": [],
    "hasSf9": false,
    "hasPsa": false,
    "isTemporarilyEnrolled": true,
    "schoolYear": { "id": 12, "yearLabel": "2030-2031" }
  }],
  "meta": {
    "sourceSystem": "SMART",
    "contractVersion": "1.1",
    "generatedAt": "2030-06-03T02:01:00.000Z",
    "scopeSchoolYearId": 12,
    "scopeSchoolYearLabel": "2030-2031",
    "total": 1,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

The boolean/status values in this example are stored values, not placeholders for unknown data. The feed never sends `null` for those non-nullable database fields.

## Scope and inclusion

The same versioned route still returns only applications in the resolved school year with `learnerType=TRANSFEREE`, `status=OFFICIALLY_ENROLLED`, and an `EnrollmentRecord`. Pending sectioning or other statuses are not included. Results are ordered by grade-level ID then application ID. Default page size is 50, maximum 200. Both active and archived responses set `meta.contractVersion` to `"1.1"`.

Omit `schoolYearId` to use EnrollPro's authoritative active year, or pass a positive EnrollPro school-year ID. Each row's `schoolYear.id/yearLabel` and `meta.scopeSchoolYearId/scopeSchoolYearLabel` refer to the requested resolved year. SMART must validate both before reconciliation. A conflicting or missing active-year pointer fails closed even for an explicit year.

For an archived year, the unchanged behavior is `200` with `data: []`, `meta.total: 0`, `meta.totalPages: 0`, `meta.source: "ENROLLMENT_HISTORY"`, and `meta.message: "Archived transferees not yet supported in integration feed."` SMART must preserve its own archived roster; this is not a deletion instruction.

## Errors and SMART action

| Status | Error code | Meaning | SMART action |
| --- | --- | --- | --- |
| 200 | N/A | Page or archived empty result | Verify scope and all pages before reconciling |
| 400 | `VALIDATION_ERROR` | Invalid `schoolYearId` | Correct request; do not retry unchanged |
| 401 | `INVALID_INTEGRATION_KEY` | Missing/wrong SMART key | Stop and correct server secret |
| 404 | `VALIDATION_ERROR` | School-year ID not found | Refresh ID from EnrollPro |
| 409 | `VALIDATION_ERROR` | Active-year state unavailable/inconsistent | Retain last good data; request EnrollPro admin correction |
| 500 | Server error | Unexpected failure, including invalid stored back-subject cardinality | Retain last good data; retry with backoff |

Scope errors use `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` on this route. Auth uses `INVALID_INTEGRATION_KEY`. SMART must treat a partial page set or any error as a failed sync and keep the last successful state.

## DPA review

The new fields are limited to SMART's registrar/academic mandate: previous school, school ID and TC support transfer/SF10 provenance; completed grade and previous average support SF10 context; eligibility and up to two subject codes support remedial handling; SF9/PSA and temporary flags support document follow-up. They are read-only, year-scoped, sent only over the authenticated SMART server-to-server route, and excluded from the broad SMART roster and other companion feeds. Birthdate, sex, guardian/contact data, document images, portal credentials, and full application bodies remain outside this contract. SMART should restrict display to authorized staff and follow its retention/access policy.

## Status and changelog

**Implemented in EnrollPro:** Option A projection, SMART-key-only auth, explicit nullable previous-school fields, persisted optional last completed grade in walk-in intake, ordered subject-code array with a two-subject fail-closed guard, and focused mapper/auth/scope-validation tests. No database reset, seed, or SMART source change is required by this contract. The existing additive migration for `last_grade_completed` was applied before this change.

**Verification:** focused tests and server build passed. Live SMART-side ingestion remains for SMART to verify with its own key and active-year data.

**v1.1, 2026-09-29:** This document supersedes the "Data Deliberately Not Exposed" list in `docs/features/integration/SMART-TRANSFEREE-API.md` **only** for the ten fields in the Added row fields table. All other exclusions remain in force.
