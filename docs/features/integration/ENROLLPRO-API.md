# EnrollPro REST API Reference

This document provides a comprehensive reference for the EnrollPro backend API. It is aligned with the current routing structure in the `server` package.

## Runtime Endpoints

- **Local Base:** `http://localhost:5002/api`
- **Production Base:** `https://dev-jegs.buru-degree.ts.net/api`
- **Static Assets:** `/uploads/*` (e.g., `https://dev-jegs.buru-degree.ts.net/uploads/logo.png`)

## Auth Model

- **Protected Endpoints:** Require an `Authorization: Bearer <jwt>` header.
- **JWT Issuance:** Obtained via `POST /api/auth/login`.
- **Role-Based Access Control (RBAC):** Enforced at the router/route level using the following roles:
  - `SYSTEM_ADMIN`: Full system access, management of users, settings, and school years.
  - `HEAD_REGISTRAR`: Management of admissions, enrollments, sections, and reports.
  - `TEACHER`: Read-only access to relevant stats, student lists, and school year data.

## Response Conventions

- **Success:** JSON objects with descriptive keys. Some endpoints return envelope-style `{ "data": ... }`.
- **Errors:** Standard HTTP status codes with a JSON body:
  ```json
  { "message": "Error description", "code": "ERROR_CODE" }
  ```
- **Validation Failures:** Return `400 Bad Request` or `422 Unprocessable Entity` with details on specific field failures.

---

## 1) Platform Health

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/health` | None | Basic health check. Returns `{ "ok": true }`. |
| GET | `/api/ping` | None | Returns "pong". |

---

## 2) Authentication (`/api/auth`)

| Method | Path | Auth | Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/api/auth/login` | None | - | Authenticates user and returns JWT + profile. |
| POST | `/api/auth/verify` | None | - | Verifies credentials without establishing a session. |
| POST | `/api/auth/logout` | None | - | Invalides current session (if applicable). |
| GET | `/api/auth/me` | Required | All | Returns current user profile from JWT. |
| PATCH | `/api/auth/change-password` | Required | All | Updates user password. |

### Sample: `POST /api/auth/login`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "firstName": "SYSTEM",
    "lastName": "ADMINISTRATOR",
    "email": "admin@deped.edu.ph",
    "role": "SYSTEM_ADMIN",
    "sex": "MALE",
    "employeeId": "SYSADMIN-001",
    "mustChangePassword": false
  }
}
```

---

## 3) Settings (`/api/settings`)

| Method | Path | Auth | Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/settings/public` | None | - | Public branding and active SY context. |
| GET | `/api/settings/scp-config` | None | - | Active Special Curricular Program configs. |
| PUT | `/api/settings/identity` | Required | ADMIN | Update school name, email, and social links. |
| POST | `/api/settings/logo` | Required | ADMIN | Upload school logo (extracts accent color). |
| DELETE | `/api/settings/logo` | Required | ADMIN | Resets logo and theme to defaults. |
| PUT | `/api/settings/accent` | Required | ADMIN | Manually override the theme accent color. |

### Sample: `GET /api/settings/public`
```json
{
  "schoolName": "EnrollPro Integrated School",
  "logoUrl": "/uploads/logo_1715380000.png",
  "colorScheme": {
    "palette": [{ "hsl": "221 83% 53%", "count": 1200 }],
    "accent_foreground": "white"
  },
  "selectedAccentHsl": "221 83% 53%",
  "activeSchoolYearId": 1,
  "activeSchoolYearLabel": "2026-2027",
  "enrollmentPhase": "OPEN",
  "systemStatus": "ACTIVE",
  "portalControl": "AUTO"
}
```

---

## 4) Dashboard (`/api/dashboard`)

| Method | Path | Auth | Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/dashboard/stats` | Required | ALL STAFF | Aggregated enrollment and admission metrics. |

### Sample: `GET /api/dashboard/stats`
```json
{
  "stats": {
    "totalPending": 12,
    "totalEnrolled": 145,
    "totalPreRegistered": 28,
    "sectionsAtCapacity": 3,
    "enrollmentTarget": {
      "current": 145,
      "target": 560,
      "seatsRemaining": 415,
      "progressPercent": 25.9
    },
    "gradeLevelBreakdown": [
      { "id": 1, "name": "Grade 7", "current": 40, "target": 160, "progressPercent": 25.0 }
    ],
    "earlyRegistration": {
      "submitted": 45,
      "verified": 32,
      "examScheduled": 10,
      "readyForEnrollment": 5,
      "total": 92
    }
  }
}
```

---

## 5) School Years (`/api/school-years`)

| Method | Path | Auth | Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/school-years` | Required | ALL STAFF | List all academic years. |
| GET | `/api/school-years/next-defaults` | Required | ADMIN | Get suggested dates for the next SY. |
| GET | `/api/school-years/:id` | Required | ADMIN | Detailed SY configuration. |
| POST | `/api/school-years/activate` | Required | ADMIN | Create and activate a new academic year. |
| POST | `/api/school-years/rollover` | Required | ADMIN | Clone data from previous year to new year. |
| PUT | `/api/school-years/:id` | Required | ADMIN | Update SY settings. |
| PATCH | `/api/school-years/:id/status` | Required | ADMIN | Transition SY status (e.g., ACTIVE -> ARCHIVED). |

### Sample: `GET /api/school-years/1`
```json
{
  "year": {
    "id": 1,
    "yearLabel": "2026-2027",
    "status": "ACTIVE",
    "classOpeningDate": "2026-06-01",
    "classEndDate": "2027-03-31",
    "earlyRegOpenDate": "2026-01-15",
    "earlyRegCloseDate": "2026-02-28",
    "enrollOpenDate": "2026-05-01",
    "enrollCloseDate": "2026-05-31"
  }
}
```

---

## 6) Curriculum (`/api/curriculum`)

| Method | Path | Auth | Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/curriculum/:ayId/grade-levels` | Required | ADMIN | List grade levels for a specific year. |
| GET | `/api/curriculum/:ayId/scp-config` | Required | REGISTRAR | List SCP configurations (STE, SPA, etc.). |
| PUT | `/api/curriculum/:ayId/scp-config` | Required | ADMIN | Update SCP admission requirements. |

---

## 7) Sections (`/api/sections`)

| Method | Path | Auth | Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/sections` | Required | REGISTRAR | List all sections for the active year. |
| GET | `/api/sections/teachers` | Required | REGISTRAR | List teachers eligible for advisership. |
| POST | `/api/sections` | Required | REGISTRAR | Create a new section. |
| GET | `/api/sections/:id/roster` | Required | REGISTRAR | List all learners enrolled in a section. |
| POST | `/api/sections/:id/handover-adviser`| Required | REGISTRAR | Transfer advisership to another teacher. |

### Sample: `GET /api/sections/1/roster`
```json
{
  "section": { "id": 1, "name": "7-A", "gradeLevel": "Grade 7" },
  "learners": [
    { "id": 101, "lrn": "123456789012", "firstName": "JUAN", "lastName": "DELA CRUZ", "sex": "MALE" }
  ],
  "total": 1
}
```

---

## 8) Students & Masterlist (`/api/students`)

| Method | Path | Auth | Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/students` | Required | ALL STAFF | List all active/enrolled learners. |
| GET | `/api/students/:id` | Required | ALL STAFF | Detailed learner profile. |
| GET | `/api/students/:id/health-records` | Required | ALL STAFF | BMI and physical assessment history. |
| POST | `/api/students/:id/health-records` | Required | REGISTRAR | Add a new health measurement. |
| POST | `/api/students/:id/verify-psa` | Required | REGISTRAR | Mark PSA Birth Certificate as verified. |

### Sample: `GET /api/students/101`
```json
{
  "student": {
    "id": 101,
    "lrn": "123456789012",
    "firstName": "JUAN",
    "lastName": "DELA CRUZ",
    "birthdate": "2013-05-20",
    "sex": "MALE",
    "status": "ACTIVE",
    "currentEnrollment": {
      "sectionName": "7-A",
      "gradeLevel": "Grade 7"
    }
  }
}
```

---

## 9) Admissions & Enrollment (`/api/applications`)

Manages Phase 2 (BEEF/Enrollment applications).

| Method | Path | Auth | Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/api/applications` | None | - | Public enrollment application submission. |
| GET | `/api/applications/track/:no` | None | - | Track status by tracking number. |
| GET | `/api/applications` | Required | REGISTRAR | List and filter applications. |
| PATCH | `/api/applications/:id/verify` | Required | REGISTRAR | Verify documents/identity. |
| PATCH | `/api/applications/:id/enroll` | Required | REGISTRAR | Finalize enrollment into a section. |
| GET | `/api/applications/exports/sf1` | Required | REGISTRAR | Export School Form 1 data. |

---

## 10) Early Registration (`/api/early-registrations`)

Manages Phase 1 (BEERF submission and screening).

| Method | Path | Auth | Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/api/early-registrations` | None | - | Public BEERF submission. |
| GET | `/api/early-registrations` | Required | ALL STAFF | List pre-registrations. |
| GET | `/api/early-registrations/:id/detailed`| Required | ALL STAFF | Expanded profile for screening. |
| PATCH | `/api/early-registrations/:id/verify` | Required | REGISTRAR | Mark documents as verified. |
| PATCH | `/api/early-registrations/:id/pass` | Required | REGISTRAR | Mark as PASSED (for SCP programs). |

---

## 11) Teachers & Faculty (`/api/teachers`)

| Method | Path | Auth | Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/teachers` | Required | REGISTRAR | List all faculty members. |
| GET | `/api/teachers/:id` | Required | REGISTRAR | Single teacher profile. |
| POST | `/api/teachers` | Required | ADMIN | Create new teacher profile. |
| PUT | `/api/teachers/:id/designation` | Required | ADMIN | Set advisory or ancillary roles. |

---

## 12) EOSY - End of School Year (`/api/eosy`)

| Method | Path | Auth | Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/eosy/sections` | Required | REGISTRAR | List sections for EOSY processing. |
| GET | `/api/eosy/sections/:id/records` | Required | REGISTRAR | Final grades and promotion status list. |
| PATCH | `/api/eosy/records/:id` | Required | REGISTRAR | Update learner's final EOSY status. |
| POST | `/api/eosy/sections/:id/finalize`| Required | REGISTRAR | Lock section records for the year. |
| POST | `/api/eosy/school-year/finalize` | Required | ADMIN | Close academic year and promote all. |

---

## 13) Admin & System (`/api/admin`)

| Method | Path | Auth | Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/admin/users` | Required | ADMIN | Manage system user accounts. |
| GET | `/api/admin/system/health` | Required | ADMIN | Detailed server and DB metrics. |
| GET | `/api/admin/dashboard/stats` | Required | ADMIN | High-level system overview. |
| GET | `/api/admin/atlas/health` | Required | ADMIN | ATLAS Sync subsystem status. |

---

## 14) Audit Logs (`/api/audit-logs`)

| Method | Path | Auth | Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/audit-logs` | Required | REGISTRAR | View system activity trail. |
| GET | `/api/audit-logs/export` | Required | ADMIN | Export logs to CSV for compliance. |

---

## 15) Integration v1 (`/api/integration/v1`)

Public read-only feeds for companion systems (ATLAS, SMART, AIMS).

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/integration/v1/health` | None | Connectivity and DB health check. |
| GET | `/api/integration/v1/learners` | None | List of all learners in the system. |
| GET | `/api/integration/v1/faculty` | None | List of all faculty members. |
| GET | `/api/integration/v1/sections` | None | List of active sections with occupancy. |
| GET | `/api/integration/v1/ecosystem/status`| None | Status of cross-system sync jobs. |

### Sample: `GET /api/integration/v1/health`
```json
{
  "status": "UP",
  "timestamp": "2026-05-11T12:00:00Z",
  "database": "CONNECTED",
  "activeSchoolYear": "2026-2027"
}
```

---

## Notes & Guidelines

1. **Date Format:** All dates in requests/responses follow ISO-8601 (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss.sssZ`).
2. **Numeric IDs:** Primary keys are autoincrementing integers.
3. **Upper Case Names:** Learner and Teacher names (First, Middle, Last) are strictly stored and returned in UPPERCASE as per DepEd standards.
4. **Rate Limiting:** Public endpoints (Tracking, Submission) are subject to rate limiting (typically 100 requests per 15 minutes per IP).


