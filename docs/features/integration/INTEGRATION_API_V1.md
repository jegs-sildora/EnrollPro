# EnrollPro Integration API v1

## Overview

This document defines the external read-only integration surface for partner systems such as ATLAS, AIMS, SMART, and MRF.

- Base path: /api/integration/v1
- Access model: public read-only endpoints for compatibility, except the keyed MRF identity feed
- Data model note: learner primary key is internal Int, external integrations should use learner.externalId (UUID)
- Scope model: schoolYearId query scoping for roster, faculty, and section routes

## System Endpoint Bases (Current Host)

For this EnrollPro deployment, use these base endpoints:

- Host base: `https://dev-jegs.buru-degree.ts.net`
- Main API base: `https://dev-jegs.buru-degree.ts.net/api`
- Integration API base: `https://dev-jegs.buru-degree.ts.net/api/integration/v1`

Connection model:

- Host machine only: Node -> PostgreSQL on `localhost:5432`.
- Team machines: API calls to host on `https://dev-jegs.buru-degree.ts.net`.
- Team machines do not connect directly to PostgreSQL.

## Companion Guides (Simple English)

Use these guides for subsystem-specific setup and fetch flow.

- Shared startup and health checks: [SUBSYSTEM_API_QUICK_START.md](./SUBSYSTEM_API_QUICK_START.md)
- ATLAS fetch guide: [ATLAS_API_GUIDE.md](./ATLAS_API_GUIDE.md)
- AIMS fetch guide: [AIMS_API_GUIDE.md](./AIMS_API_GUIDE.md)
- SMART fetch guide: [SMART_API_GUIDE.md](./SMART_API_GUIDE.md)
- Complete school-year lifecycle: [ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md](./ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md)

## Access Mode

Integration routes under `/api/integration/v1` are read-only. Existing ATLAS, AIMS, and SMART routes remain public for compatibility. `/default/mrf/identities` requires `X-Integration-Key` and the server-side `MRF_INTEGRATION_API_KEY` setting.

## Response Envelopes

Most successful responses use:

```json
{
  "data": {},
  "meta": {}
}
```

Validation errors (controller-level) use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "..."
  }
}
```

Service errors use:

```json
{
  "code": "SERVICE_UNAVAILABLE",
  "message": "..."
}
```

## Endpoints

### 1) Integration Health

- Method: GET
- Path: /health
- Purpose: liveness plus database connectivity status
- Auth: public

Sample success:

```json
{
  "data": {
    "status": "ok",
    "db": "connected",
    "dbLatencyMs": 4,
    "timestamp": "2026-04-19T11:22:33.123Z"
  }
}
```

Sample degraded:

```json
{
  "data": {
    "status": "degraded",
    "db": "down",
    "dbLatencyMs": 0,
    "timestamp": "2026-04-19T11:22:33.123Z"
  }
}
```

### 2) Learner Roster

- Method: GET
- Primary path: /learners
- Alias path: /students
- Purpose: enrolled learner roster for a school year
- Auth: public

Query params:

- schoolYearId (required, positive int)
- page (optional, positive int, default 1)
- limit (optional, positive int, default 50, max 200)
- sectionId (optional, positive int)
- gradeLevelId (optional, positive int)
- search (optional text; matches LRN, firstName, lastName, and exact externalId UUID)

Sample response:

```json
{
  "data": [
    {
      "enrollmentApplicationId": 1205,
      "status": "ENROLLED",
      "learnerType": "NEW_ENROLLEE",
      "applicantType": "REGULAR",
      "learner": {
        "id": 318,
        "externalId": "a9f28bf2-cf53-4fb7-95cc-458f456ca6ab",
        "lrn": "123456789012",
        "firstName": "JUAN",
        "lastName": "DELA CRUZ",
        "middleName": "SANTOS",
        "extensionName": null,
        "birthdate": "2011-01-15T00:00:00.000Z",
        "sex": "MALE"
      },
      "schoolYear": {
        "id": 12,
        "yearLabel": "2026-2027"
      },
      "gradeLevel": {
        "id": 47,
        "name": "Grade 7",
        "displayOrder": 7
      },
      "section": {
        "id": 88,
        "name": "RIZAL",
        "programType": "REGULAR"
      },
      "enrolledAt": "2026-05-27T03:14:15.926Z"
    }
  ],
  "meta": {
    "schoolYearId": 12,
    "total": 1,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

### 3) Faculty Registry

- Method: GET
- Primary path: /faculty
- Alias path: /teachers
- Purpose: school-year-scoped faculty list including designation metadata
- Auth: public

Query params:

- schoolYearId (optional, positive int)

If schoolYearId is omitted, activeSchoolYearId from SchoolSetting is used.

Sample response:

```json
{
  "data": [
    {
      "teacherId": 29,
      "employeeId": "T-1007",
      "firstName": "ANA",
      "lastName": "RAMOS",
      "middleName": null,
      "fullName": "RAMOS, ANA",
      "email": "ana.ramos@example.com",
      "contactNumber": "09171234567",
      "specialization": "MATH",
      "isActive": true,
      "sectionCount": 1,
      "schoolId": 1,
      "schoolName": "EnrollPro Integrated School",
      "schoolYearId": 12,
      "schoolYearLabel": "2026-2027",
      "isClassAdviser": true,
      "advisorySectionId": 88,
      "advisorySectionName": "RIZAL",
      "advisorySectionGradeLevelId": 47,
      "advisorySectionGradeLevelName": "Grade 7",
      "advisoryEquivalentHoursPerWeek": 0,
      "isTic": true,
      "isTIC": true,
      "isTeachingExempt": false,
      "customTargetTeachingHoursPerWeek": null,
      "designationNotes": null,
      "effectiveFrom": null,
      "effectiveTo": null,
      "updateReason": null,
      "updatedById": 6,
      "updatedByName": "ADMIN, REGISTRAR",
      "updatedAt": "2026-04-19T11:22:33.123Z"
    }
  ],
  "meta": {
    "generatedAt": "2026-04-19T11:22:33.123Z",
    "scope": {
      "schoolId": 1,
      "schoolName": "EnrollPro Integrated School",
      "schoolYearId": 12,
      "schoolYearLabel": "2026-2027"
    },
    "total": 1
  }
}
```

### 4) Section List

- Method: GET
- Path: /sections
- Purpose: class sections in the selected school year
- Auth: public

Query params:

- schoolYearId (optional, positive int)
- gradeLevelId (optional, positive int)

Sample response:

```json
{
  "data": [
    {
      "id": 88,
      "name": "RIZAL",
      "programType": "REGULAR",
      "maxCapacity": 40,
      "enrolledCount": 35,
      "gradeLevel": {
        "id": 47,
        "name": "Grade 7",
        "displayOrder": 7
      },
      "schoolYear": {
        "id": 12,
        "yearLabel": "2026-2027"
      },
      "advisingTeacher": {
        "id": 29,
        "name": "RAMOS, ANA"
      }
    }
  ],
  "meta": {
    "scope": {
      "schoolId": 1,
      "schoolName": "EnrollPro Integrated School",
      "schoolYearId": 12,
      "schoolYearLabel": "2026-2027"
    },
    "total": 1
  }
}
```

### 5) Section Learner Roster

- Method: GET
- Path: /sections/:sectionId/learners
- Purpose: enrolled learners within a section
- Auth: public

Path params:

- sectionId (required, positive int)

Query params:

- schoolYearId (optional, positive int)
- page (optional, positive int, default 1)
- limit (optional, positive int, default 50, max 200)

Sample response:

```json
{
  "data": {
    "section": {
      "id": 88,
      "name": "RIZAL",
      "programType": "REGULAR",
      "maxCapacity": 40,
      "gradeLevel": {
        "id": 47,
        "name": "Grade 7",
        "displayOrder": 7
      },
      "advisingTeacher": {
        "id": 29,
        "name": "RAMOS, ANA"
      }
    },
    "learners": [
      {
        "enrollmentRecordId": 503,
        "enrolledAt": "2026-05-27T03:14:15.926Z",
        "enrollmentApplicationId": 1205,
        "status": "ENROLLED",
        "learnerType": "NEW_ENROLLEE",
        "applicantType": "REGULAR",
        "learner": {
          "id": 318,
          "externalId": "a9f28bf2-cf53-4fb7-95cc-458f456ca6ab",
          "lrn": "123456789012",
          "firstName": "JUAN",
          "lastName": "DELA CRUZ",
          "middleName": "SANTOS",
          "extensionName": null,
          "sex": "MALE",
          "birthdate": "2011-01-15T00:00:00.000Z"
        }
      }
    ]
  },
  "meta": {
    "scope": {
      "schoolId": 1,
      "schoolName": "EnrollPro Integrated School",
      "schoolYearId": 12,
      "schoolYearLabel": "2026-2027"
    },
    "total": 1,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

### 6) Staff Registry

- Method: GET
- Path: /staff
- Purpose: list active EnrollPro staff accounts scoped to SYSTEM_ADMIN and REGISTRAR roles
- Auth: public

Query params:

- includeInactive (optional, boolean; default false)

Sample response:

```json
{
  "data": [
    {
      "id": 6,
      "employeeId": "ADM-1002",
      "firstName": "SYSTEM",
      "lastName": "ADMINISTRATOR",
      "middleName": null,
      "suffix": null,
      "fullName": "ADMINISTRATOR, SYSTEM",
      "email": "admin@sample.integration.local",
      "role": "SYSTEM_ADMIN",
      "designation": "SYSTEM ADMINISTRATOR",
      "mobileNumber": "09180000001",
      "isActive": true,
      "createdAt": "2026-04-19T11:22:33.123Z",
      "updatedAt": "2026-04-19T11:22:33.123Z",
      "lastLoginAt": null
    }
  ],
  "meta": {
    "generatedAt": "2026-04-19T11:22:33.123Z",
    "includeInactive": false,
    "total": 1
  }
}
```

### 7) Default Subsystem Feeds

These endpoints are pre-scoped to active school year when `schoolYearId` is omitted.
They are designed as direct read-only ingestion feeds for teammate systems.

#### 7.1 ATLAS Default Faculty Feed

- Method: GET
- Path: /default/faculty
- Purpose: ready faculty and designation feed for scheduling engines
- Auth: public

#### 7.2 SMART Default Student Feed

- Method: GET
- Path: /default/smart/students
- Purpose: ready enrolled learner feed with LRN, grade, and section
- Auth: public

#### 7.3 AIMS Default Context Feed

- Method: GET
- Path: /default/aims/context
- Purpose: ready learner-context feed for intervention/remediation pipelines
- Auth: public

#### 7.4 MRF Identity Feed

- Method: GET
- Path: /default/mrf/identities
- Purpose: school-year-scoped learner, teacher, staff, and MRF-role identity reconciliation
- Auth: `X-Integration-Key`
- Optional query: `schoolYearId`; active school year is used when omitted
- Privacy: passwords, birthdates, family details, health information, and audit-security fields are excluded

Default feed responses include school-year scope and generation metadata. The MRF feed additionally returns grouped record counts.

- `meta.sourceSystem`
- `meta.generatedAt`
- `meta.scopeSchoolYearId`
- `meta.scopeSchoolYearLabel`

## HTTP Status Reference

- 200: successful query
- 400: invalid request parameters
- 401: missing or invalid MRF integration key
- 404: scoped resource not found (for example, section outside school year)
- 503: health degraded due DB or external-service outage

## Operational Notes

- Prefer learner.externalId as partner identity key.
- Treat aliases as equivalent routes:
  - /learners and /students
  - /faculty and /teachers
- Default feeds are ingestion-only surfaces. Partner systems keep domain mutations in their own APIs.
- Current rosters recognize `OFFICIALLY_ENROLLED`, `ENROLLED`, and `SECTIONED` as officially placed learners.
- Explicit archived-school-year requests use `EnrollmentHistory` for learner, SMART, AIMS, section roster, and MRF reconciliation.
