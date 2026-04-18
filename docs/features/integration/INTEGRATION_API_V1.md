# EnrollPro Integration API v1

## Overview

This document defines the external read-only integration surface for partner systems such as ATLAS, AIMS, and SMART.

- Base path: /api/integration/v1
- Access model: service key authentication
- Data model note: learner primary key is internal Int, external integrations should use learner.externalId (UUID)
- Scope model: schoolYearId query scoping for roster, faculty, and section routes

## Authentication

Protected integration routes require one of the configured integration keys from server environment:

- INTEGRATION_API_KEY
- INTEGRATION_API_KEYS (comma-separated)

Send the key in either header format:

- X-Integration-Key: <key>
- Authorization: Bearer <key>

If authentication is not configured, protected routes return HTTP 503.

Public sample routes under `/sample/*` are keyless and intended for non-production demo/testing only.

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

Authentication errors (middleware-level) use:

```json
{
  "code": "INTEGRATION_KEY_REQUIRED",
  "message": "..."
}
```

## Endpoints

### 1) Integration Health

- Method: GET
- Path: /health
- Purpose: liveness plus database connectivity status
- Auth: required

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
- Auth: required

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
- Auth: required

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
- Auth: required

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
- Auth: required

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
- Auth: required

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

### 7) Default Subsystem Feeds (Protected)

These endpoints are pre-scoped to active school year when `schoolYearId` is omitted.
They are designed as direct read-only ingestion feeds for teammate systems.

#### 7.1 ATLAS Default Faculty Feed

- Method: GET
- Path: /default/atlas/faculty
- Purpose: ready faculty and designation feed for scheduling engines
- Auth: required

#### 7.2 SMART Default Student Feed

- Method: GET
- Path: /default/smart/students
- Purpose: ready enrolled learner feed with LRN, grade, and section
- Auth: required

#### 7.3 AIMS Default Context Feed

- Method: GET
- Path: /default/aims/context
- Purpose: ready learner-context feed for intervention/remediation pipelines
- Auth: required

All default feed responses include:

- `meta.sourceSystem`
- `meta.generatedAt`
- `meta.scopeSchoolYearId`
- `meta.scopeSchoolYearLabel`
- `meta.totalRows`

### 8) Public Sample Feeds (Keyless)

These routes are for non-production demo/testing and only expose deterministic sample records.

- GET /sample/teachers
- GET /sample/staff
- GET /sample/students

By default, these routes are enabled outside production. In production, enable explicitly with:

- `INTEGRATION_PUBLIC_SAMPLE_ENABLED=true`

## HTTP Status Reference

- 200: successful query
- 400: invalid request parameters
- 401: missing integration key
- 403: invalid integration key
- 404: scoped resource not found (for example, section outside school year)
- 503: integration auth not configured, sample feeds disabled, or health degraded due DB outage

## Operational Notes

- Prefer learner.externalId as partner identity key.
- Treat aliases as equivalent routes:
  - /learners and /students
  - /faculty and /teachers
- Default feeds are ingestion-only surfaces. Partner systems (ATLAS/SMART/AIMS) keep mutations in their own APIs.
- Rotate integration keys regularly and immediately on leakage suspicion.
