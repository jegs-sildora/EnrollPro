# SMART Transferee Enrollment Handoff

Last code verification: 2026-09-11

## Purpose

This document defines how a transferee is encoded in EnrollPro, when that learner becomes part of the official SMART roster, and the API SMART must use to fetch the enrollment.

EnrollPro owns learner identity, enrollment applications, incoming grade level, curriculum, official section placement, and school-year scope. SMART consumes the official roster and owns grade encoding, attendance, finalized learning-area results, and EOSY academic outcomes.

SMART must not call EnrollPro's staff-facing walk-in endpoints. Those endpoints require an authenticated registrar session and mutate EnrollPro records. SMART must use the server-to-server integration endpoints under `/api/integration/v1`.

## Authoritative Flow

```text
Registrar opens Walk-In Learner Enrollment
  -> selects TRANSFEREE
  -> enters or looks up the 12-digit LRN
  -> selects incoming grade and curriculum
  -> records previous-school and document information
  -> records the SF9 eligibility status
  -> conditionally promoted learners receive 1 or 2 ATLAS back subjects
  -> EnrollPro creates a READY_FOR_SECTIONING application
  -> registrar assigns the learner to an official section
  -> EnrollPro creates EnrollmentRecord and sets OFFICIALLY_ENROLLED
  -> SMART fetches the learner from the protected transferee feed
  -> SMART upserts its local class membership without another enrollment decision
```

Creating the walk-in application is not the publication boundary. A new transferee is intentionally absent from SMART until EnrollPro has both:

- an `EnrollmentApplication.status` of `OFFICIALLY_ENROLLED`; and
- a related `EnrollmentRecord` containing the official school year and section.

## EnrollPro Staff Workflow

The implementation starts in [`WalkInEncodePanel.tsx`](../../../client/src/features/enrollment/components/WalkInEncodePanel.tsx).

### 1. Open and initialize the form

The panel loads EnrollPro's active-year grade levels through:

```http
GET /api/school-years/grade-levels
```

This request uses the logged-in EnrollPro staff session. The panel is available to the enrollment workflow, while the backing mutation is restricted to `HEAD_REGISTRAR` and `SYSTEM_ADMIN`.

### 2. Select `TRANSFEREE` and verify the LRN

A transferee must provide an LRN with a length of 12 characters. When 12 characters have been entered, the panel attempts:

```http
GET /api/learner/lookup?lrn=123456789012
```

If EnrollPro already knows the learner, the response can populate the name, birthdate, sex, previous-school information, previous general average, and primary family member. A `404` means the registrar may continue with a new learner profile.

The intended business identifier is a 12-digit LRN. The current shared walk-in schema checks the length but does not apply a numeric-only regular expression. SMART must therefore validate `^\d{12}$` and quarantine an invalid LRN rather than creating an unsafe local identity match.

### 3. Record the incoming enrollment

The registrar records:

| Field | Contract |
| --- | --- |
| `learnerType` | Must be `TRANSFEREE` for this flow |
| `lrn` | Required; intended as exactly 12 digits |
| `firstName`, `lastName` | Required |
| `middleName` | Optional |
| `birthdate` | Required; the browser date control submits a date string |
| `sex` | `MALE` or `FEMALE` |
| `gradeLevelId` | Required EnrollPro incoming Grade 7-10 identifier |
| `assignedProgram` | `REGULAR`, `SCIENCE_TECHNOLOGY_AND_ENGINEERING`, `SPECIAL_PROGRAM_IN_THE_ARTS`, or `SPECIAL_PROGRAM_IN_SPORTS` |
| `previousSchoolName` | Required |
| `originatingSchoolId` | Required |
| `transferCertificateNo` | Optional |
| `previousGenAve` | Optional; when supplied, from `75` through `99.99`, with at most two decimal places |
| guardian name | First and last names required; middle name optional |
| `guardianRelationship` | `MOTHER`, `FATHER`, or `GUARDIAN` |
| `guardianContact` | Exactly 11 numeric digits |
| `hasSf9`, `hasPsa` | Document-presence flags |
| `sf9EligibilityStatus` | `PROMOTED`, `CONDITIONALLY_PROMOTED`, or `RETAINED` |
| `conditionalSubjectCodes` | Required only for conditional promotion; 1 or 2 unique ATLAS codes |

The active school year is never accepted from the browser payload. The server resolves it from EnrollPro's authoritative active-school-year state.

### 4. Resolve conditional-promotion back subjects

For a conditionally promoted transferee, the panel requests the subject catalog through EnrollPro:

```http
GET /api/enrollment/walk-in/atlas-subjects?gradeLevelId={incomingGradeLevelId}&programType={assignedProgram}
```

EnrollPro calls ATLAS server-side and returns active subjects for the immediately preceding JHS grade and selected curriculum. For example, an incoming Grade 8 transferee selects from Grade 7 offerings. Homeroom Guidance subjects are excluded. The UI shows the full ATLAS subject name and permits at most two selections.

An incoming Grade 7 learner has no Grade 6 offering in the JHS ATLAS catalog. EnrollPro returns `422` and requires registrar review instead of fabricating a subject.

The server re-fetches and revalidates every selected code at submission time. A stale or unavailable subject is rejected with `422`; an unavailable or unconfigured ATLAS service returns `503`; an invalid ATLAS response returns `502`.

### 5. Submit the staff mutation

The panel submits:

```http
POST /api/enrollment/walk-in
Content-Type: application/json
Authorization: Bearer <EnrollPro staff JWT>
```

The EnrollPro session cookie may be used by the browser instead of a bearer header. This is an internal mutation and is not a SMART integration API.

Example transferee payload:

```json
{
  "learnerType": "TRANSFEREE",
  "lrn": "123456789012",
  "firstName": "JUAN",
  "lastName": "DELA CRUZ",
  "middleName": "SANTOS",
  "birthdate": "2017-03-12",
  "sex": "MALE",
  "gradeLevelId": 2,
  "assignedProgram": "REGULAR",
  "previousSchoolName": "RIZAL NATIONAL HIGH SCHOOL",
  "originatingSchoolId": "123456",
  "transferCertificateNo": "TC-2030-001",
  "previousGenAve": 84.5,
  "guardianFirstName": "MARIA",
  "guardianMiddleName": "REYES",
  "guardianLastName": "DELA CRUZ",
  "guardianRelationship": "MOTHER",
  "guardianContact": "09123456789",
  "hasSf9": true,
  "hasPsa": true,
  "sf9EligibilityStatus": "CONDITIONALLY_PROMOTED",
  "conditionalSubjectCodes": ["MATH"]
}
```

On success EnrollPro returns `201`:

```json
{
  "message": "Walk-in application directly encoded",
  "application": {
    "id": 321,
    "status": "READY_FOR_SECTIONING",
    "learnerType": "TRANSFEREE",
    "schoolYearId": 12,
    "gradeLevelId": 2
  }
}
```

The returned application object can contain additional EnrollPro fields. SMART must not depend on this response because SMART does not call this endpoint.

### 6. Transactional persistence

The mutation runs in a Prisma transaction. It updates an existing learner found by LRN or creates a learner, then creates one school-year application. The database enforces one application for each learner and school year.

EnrollPro stores the intake across these records:

| Table/model | Stored responsibility |
| --- | --- |
| `learners` / `Learner` | LRN, official name, birthdate, sex, and PSA presence |
| `enrollment_applications` / `EnrollmentApplication` | Active year, incoming grade, learner type, curriculum, `READY_FOR_SECTIONING`, SF9 eligibility, document flags, guardian summary, and encoder |
| `enrollment_previous_schools` / `EnrollmentPreviousSchool` | Originating school, school ID, previous average, and transfer certificate number |
| `application_family_members` / `ApplicationFamilyMember` | Guardian identity, relationship, and contact |
| `enrollment_back_subjects` / `EnrollmentBackSubject` | Previous-grade ATLAS subject code and exact subject name for conditional promotion |

`isTemporarilyEnrolled` is `true` when either SF9 or PSA is missing. `isMissingSf9` mirrors the SF9 document state. `isRemedialRequired` is set only when validated back subjects were stored.

### 7. Section assignment publishes the official enrollment

After successful encoding, the learner enters the unassigned sectioning pool. A sectioning commit rechecks that the application is still `READY_FOR_SECTIONING`, creates exactly one `EnrollmentRecord`, and changes the application status to `OFFICIALLY_ENROLLED` in one transaction.

The `EnrollmentRecord` contains the official section, school year, learner, enrollment timestamp, staff encoder, late-enrollee flag, and sectioning method. This is the point at which the dedicated SMART transferee feed includes the learner.

## SMART Fetch API

### Endpoint

```http
GET /api/integration/v1/default/smart/transferees
```

Optional explicit school-year scope:

```http
GET /api/integration/v1/default/smart/transferees?schoolYearId=12&page=1&limit=50
```

The former `/api/integration/default/smart/transferees` path is incorrect and must not be used. The mounted route contains `/v1`.

### Authentication

SMART should send its EnrollPro machine key using either header:

```http
X-Integration-Key: <SMART_INTEGRATION_API_KEY>
```

or:

```http
Authorization: Bearer <SMART_INTEGRATION_API_KEY>
```

The key belongs only on the SMART backend. It must not be sent to browser JavaScript, placed in a URL, persisted in SMART learner records, or logged.

The current route uses EnrollPro's shared companion-key middleware and technically accepts any configured ATLAS, SMART, AIMS, or MRF integration key. SMART must still use `SMART_INTEGRATION_API_KEY`; system-specific enforcement is a future hardening item and must not be treated as permission to reuse another subsystem's secret.

### Query parameters

| Parameter | Required | Behavior |
| --- | --- | --- |
| `schoolYearId` | No | Positive EnrollPro school-year ID. Omit to use the authoritative active year. |
| `page` | No | Positive integer; defaults to `1`. Invalid or non-positive input currently falls back to `1`. |
| `limit` | No | Positive integer; defaults to `50` and is capped at `200`. Invalid or non-positive input currently falls back to `50`. |

Before selecting the roster, EnrollPro validates its active-year pointer. Requests fail closed when the active year is missing or when `SchoolSetting.activeSchoolYearId` conflicts with active school-year rows. This validation still occurs when an explicit historical `schoolYearId` is supplied.

### Inclusion rule

A row is returned only when all of the following are true:

- the application belongs to the resolved school year;
- `learnerType` is `TRANSFEREE`;
- application status is exactly `OFFICIALLY_ENROLLED`; and
- an `EnrollmentRecord` exists.

`READY_FOR_SECTIONING`, `PENDING_VERIFICATION`, `FOR_REVISION`, `WITHDRAWN`, `TRANSFERRED_OUT`, `DROPPED`, and every other application status are excluded by the current implementation. SMART must not infer that an excluded learner was deleted; the learner may be awaiting official section placement or may have changed status.

### Active-year response

```json
{
  "data": [
    {
      "enrollmentApplicationId": 321,
      "enrollmentStatus": "OFFICIALLY_ENROLLED",
      "lrn": "123456789012",
      "isPendingLrn": false,
      "fullName": "DELA CRUZ, JUAN SANTOS",
      "firstName": "JUAN",
      "lastName": "DELA CRUZ",
      "middleName": "SANTOS",
      "extensionName": null,
      "gradeLevel": {
        "id": 2,
        "name": "Grade 8",
        "displayOrder": 8
      },
      "section": {
        "id": 45,
        "name": "Makakalikasan",
        "programType": "REGULAR"
      },
      "enrolledAt": "2030-06-03T01:30:00.000Z",
      "eosyStatus": null,
      "dropOutDate": null,
      "dropOutReason": null,
      "transferOutDate": null,
      "schoolYear": {
        "id": 12,
        "yearLabel": "2030-2031"
      }
    }
  ],
  "meta": {
    "sourceSystem": "SMART",
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

The actual `section.id`, grade-level ID, and application ID are EnrollPro integer identifiers. SMART must treat them as opaque external identifiers and must not assume matching primary keys in its database.

When no rows match, `data` is empty and active-year `meta.totalPages` is currently `1` because the controller applies a minimum of one page.

### Archived-year response

The dedicated transferee feed does not currently reconstruct archived transferees from `EnrollmentHistory`. An archived-year request returns `200`, an empty `data` array, and:

```json
{
  "meta": {
    "sourceSystem": "SMART",
    "source": "ENROLLMENT_HISTORY",
    "scopeSchoolYearId": 11,
    "scopeSchoolYearLabel": "2029-2030",
    "total": 0,
    "page": 1,
    "limit": 50,
    "totalPages": 0,
    "message": "Archived transferees not yet supported in integration feed."
  }
}
```

SMART must preserve its own previously synchronized school-year roster as read-only history. It must not interpret this empty archived response as an instruction to delete historical class membership.

## Data Deliberately Not Exposed

The dedicated SMART transferee response is a minimized roster projection. It does not expose:

- birthdate or sex;
- guardian or contact information;
- previous school, originating school ID, transfer certificate, or previous general average;
- SF9 and PSA document flags;
- `academicStatus` or the registrar-selected SF9 eligibility status;
- `isTemporarilyEnrolled` or `isRemedialRequired`;
- conditional-promotion back subjects;
- portal account identifiers, credentials, passwords, or EnrollPro user IDs.

Most of these fields are intentionally private and are not required to create a SMART gradebook roster. Back subjects and SF9 eligibility may be legitimate future academic inputs, but they are not part of the currently implemented response. SMART must not infer, fabricate, or scrape them from another endpoint. A separate versioned contract and explicit data-minimization review are required before EnrollPro exposes them.

## SMART Synchronization Rules

SMART should implement the pull as an idempotent server-side reconciliation:

1. Fetch `/api/integration/v1/school-year` and retain `data.id` as the EnrollPro school-year ID together with `data.yearLabel`.
2. Fetch `/api/integration/v1/sections?schoolYearId={id}` to establish the authoritative section map.
3. Page through `/api/integration/v1/default/smart/transferees?schoolYearId={id}` until `page >= totalPages`.
4. Validate that response and metadata school-year IDs agree with the requested year.
5. Require `enrollmentStatus === "OFFICIALLY_ENROLLED"`, a valid 12-digit LRN, a section, and a Grade 7-10 grade level before activating the local class membership.
6. Upsert by EnrollPro school-year ID plus LRN. Retain `enrollmentApplicationId` as the EnrollPro application reference, not as a SMART primary key.
7. Reconcile grade and section changes without creating a second learner.
8. Store `meta.generatedAt` as the source generation time and store a separate local synchronization time.
9. Finish every page before marking the synchronization successful.
10. On an error or incomplete page set, retain the last known roster and mark it stale. Never replace it with an empty current roster.

SMART must not create grades during roster synchronization. New-year gradebook rows begin empty. Grades and attendance remain SMART-owned.

For a complete all-learner roster, SMART may use:

```http
GET /api/integration/v1/default/smart/students?schoolYearId={id}&page=1&limit=200
```

The transferee endpoint is a filtered view for workflows that need to distinguish incoming transferees. SMART should not combine the two responses by inserting duplicates; use the same school-year-plus-LRN identity key.

## Refresh and Notification Behavior

After a walk-in application is created, EnrollPro sends its internal client invalidations and may send an optional background webhook to SMART:

```http
POST {SMART_API_BASE_URL}/api/integration/enrollpro-webhook
X-API-Key: <SMART_API_KEY>
```

The webhook body contains invalidation `topics` and a `timestamp`; it is a refresh hint, not an enrollment payload. SMART must respond by pulling the protected EnrollPro feed.

Current implementation caveat: the sectioning commit publishes EnrollPro browser SSE invalidations but does not invoke the external SMART webhook helper. Because official section assignment is the event that makes the transferee visible, SMART must also perform scheduled polling or provide a manual roster refresh. Do not rely only on the walk-in-created webhook.

Webhook delivery is best effort. EnrollPro does not block enrollment when SMART is unavailable and does not retry this notification transactionally.

## HTTP Outcomes

| Status | Meaning | SMART action |
| --- | --- | --- |
| `200` | Roster page returned, including an empty valid page | Validate metadata and reconcile only after all pages succeed |
| `400` | Invalid explicit `schoolYearId` | Correct the request; do not retry unchanged |
| `401` | Missing or incorrect integration key | Stop and correct secret configuration |
| `404` | Requested school year does not exist | Stop and reconcile the EnrollPro school-year ID |
| `409` | Active school year is missing or inconsistent | Retain cached data as stale and require EnrollPro administrator action |
| `500` | Unexpected EnrollPro failure | Retain cached data and retry with bounded backoff |

The integration error body uses this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable reason"
  }
}
```

Authentication failures use `INVALID_INTEGRATION_KEY` instead of `VALIDATION_ERROR`.

## Security and Privacy

- Call the feed only from the SMART backend over HTTPS.
- Store the integration key in server environment configuration or a secret manager.
- Never log the key, authorization header, guardian data, or full response body.
- Log request time, status, page, school-year ID, item count, and a correlation ID.
- Enforce least privilege in SMART; teachers see only assigned class rosters.
- Preserve EnrollPro identifiers exactly and never use a learner name as an identity key.
- Do not write directly to the EnrollPro database.
- Do not call staff JWT endpoints with a machine integration key.
- Do not make promotion or enrollment decisions from a missing roster row.

## Acceptance Checklist for SMART

- [ ] Uses `GET /api/integration/v1/default/smart/transferees`, including `/v1`.
- [ ] Sends `SMART_INTEGRATION_API_KEY` from the SMART backend only.
- [ ] Resolves and verifies the EnrollPro school year before roster synchronization.
- [ ] Fetches all pages and handles the `50` default and `200` maximum page size.
- [ ] Activates only `OFFICIALLY_ENROLLED` transferees with a section.
- [ ] Upserts by school-year ID plus 12-digit LRN without duplicating the standard student feed.
- [ ] Starts the gradebook without copied grades or attendance.
- [ ] Retains the last successful roster during EnrollPro outages or validation errors.
- [ ] Does not delete history when the dedicated archived feed returns an empty response.
- [ ] Does not infer back subjects, SF9 eligibility, or document status from omitted fields.
- [ ] Supports scheduled or manual refresh because sectioning does not currently trigger the external SMART webhook.
- [ ] Shows the EnrollPro school-year label, last successful sync, stale/error state, and retry action.

## Code References

- Staff panel: [`WalkInEncodePanel.tsx`](../../../client/src/features/enrollment/components/WalkInEncodePanel.tsx)
- Shared validation: [`walk-in.schema.ts`](../../../shared/src/schemas/walk-in.schema.ts)
- Intake routes: [`enrollment.router.ts`](../../../server/src/features/enrollment/enrollment.router.ts)
- Intake persistence: [`enrollment.controller.ts`](../../../server/src/features/enrollment/enrollment.controller.ts)
- ATLAS subject adapter: [`atlas-subject-catalog.service.ts`](../../../server/src/features/integration/atlas-subject-catalog.service.ts)
- SMART roster controller: [`integration.default.controller.ts`](../../../server/src/features/integration/integration.default.controller.ts)
- Integration route mount: [`integration.router.ts`](../../../server/src/features/integration/integration.router.ts)
- Integration authentication: [`integration-api-key.middleware.ts`](../../../server/src/features/integration/integration-api-key.middleware.ts)
- Database models: [`schema.prisma`](../../../server/prisma/schema.prisma)

Related contracts:

- [SMART API Guide](./SMART_API_GUIDE.md)
- [EnrollPro API](./ENROLLPRO-API.md)
- [Architecture](../../../ARCHITECTURE_MICROSERVICES.md)
