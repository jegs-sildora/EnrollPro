# EnrollPro REST API Reference

This document provides a comprehensive reference for the EnrollPro backend API. It is aligned with the current routing structure in the `server` package.

## Runtime Endpoints

- **Local Base:** `http://localhost:5002/api`
- **Production Base:** `https://dev-jegs.buru-degree.ts.net/api`
- **Static Assets:** `/uploads/*` (e.g., `https://dev-jegs.buru-degree.ts.net/uploads/logo.png`)

## Auth Model

- **Protected Endpoints:** Require an `Authorization: Bearer <jwt>` header.
- **JWT Issuance:** Staff JWT obtained via `POST /api/auth/login`. Learner JWT obtained via `POST /api/auth/learner-login`.
- **Role-Based Access Control (RBAC):** Enforced at the router/route level using the following roles:
  - `SYSTEM_ADMIN`: Full system access, management of users, settings, and school years.
  - `HEAD_REGISTRAR`: Management of admissions, enrollments, sections, and reports.
  - `TEACHER`: Read-only access to relevant stats, student lists, and school year data.
  - `LEARNER`: Limited self-service access (confirm BOSY intent). Isolated JWT payload — no `userId`, uses `learnerId` + `enrollmentApplicationId`.

## Response Conventions

- **Success:** JSON objects with descriptive keys. Some endpoints return envelope-style `{ "data": ... }`.
- **Errors:** Standard HTTP status codes with a JSON body:
  ```json
  { "message": "Error description", "code": "ERROR_CODE" }
  ```
- **Validation Failures:** Return `400 Bad Request` or `422 Unprocessable Entity` with details on specific field failures.

---

## 1) Platform Health

| Method | Path          | Auth | Description                                   |
| :----- | :------------ | :--- | :-------------------------------------------- |
| GET    | `/api/health` | None | Basic health check. Returns `{ "ok": true }`. |
| GET    | `/api/ping`   | None | Returns "pong".                               |

---

## 2) Authentication (`/api/auth`)

| Method | Path                        | Auth     | Roles     | Description                                                                          |
| :----- | :-------------------------- | :------- | :-------- | :----------------------------------------------------------------------------------- |
| POST   | `/api/auth/login`           | None     | -         | Authenticates staff user and returns JWT + profile.                                  |
| POST   | `/api/auth/learner-login`   | None     | -         | Authenticates a returning learner by LRN + portal PIN. Returns a `LEARNER`-role JWT. |
| POST   | `/api/auth/verify`          | None     | -         | Verifies credentials without establishing a session.                                 |
| POST   | `/api/auth/logout`          | None     | -         | Invalides current staff session.                                                     |
| POST   | `/api/auth/logout-learner`  | None     | -         | Explicitly terminates the `learner_session` cookie.                                  |
| GET    | `/api/auth/me`              | Required | All Staff | Returns current user profile from JWT.                                               |
| PATCH  | `/api/auth/change-password` | Required | All Staff | Updates user password.                                                               |

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

### Sample: `POST /api/auth/learner-login`

**Request body:**

```json
{ "lrn": "123456789012", "pin": "082915" }
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "learner": {
    "id": 101,
    "lrn": "123456789012",
    "firstName": "JUAN",
    "lastName": "DELA CRUZ",
    "middleName": "SAMSON",
    "enrollmentApplicationId": 45,
    "schoolYear": { "id": 2, "yearLabel": "2026-2027" },
    "gradeLevel": { "name": "Grade 8" },
    "applicationStatus": "PENDING_CONFIRMATION"
  }
}
```

---

## 3) Settings (`/api/settings`)

| Method | Path                       | Auth     | Roles        | Description                                  |
| :----- | :------------------------- | :------- | :----------- | :------------------------------------------- |
| GET    | `/api/settings/public`     | None     | -            | Public branding and active SY context.       |
| GET    | `/api/settings/scp-config` | None     | -            | Active Special Curricular Program configs.   |
| PUT    | `/api/settings/identity`   | Required | SYSTEM_ADMIN | Update school name, email, and social links. |
| POST   | `/api/settings/logo`       | Required | SYSTEM_ADMIN | Upload school logo (extracts accent color).  |
| DELETE | `/api/settings/logo`       | Required | SYSTEM_ADMIN | Resets logo and theme to defaults.           |
| PUT    | `/api/settings/accent`     | Required | SYSTEM_ADMIN | Manually override the theme accent color.    |

> **Logo path note:** `logoPath` is the absolute server-side disk path used internally to delete old files on re-upload. It is never included in any API response. Consumers should use `logoUrl` (a relative path e.g. `/uploads/logo.png`) combined with the API base URL to render the logo image.

### Sample: `GET /api/settings/public`

```json
{
  "schoolName": "BuruanganAPPLICANT National High School",
  "logoUrl": "/uploads/logo.png",
  "colorScheme": {
    "palette": [
      { "hex": "#1a56db", "hsl": "221 83% 53%", "label": "Primary" }
    ]
  },
  "selectedAccentHsl": "221 83% 53%",
  "activeSchoolYearId": 3,
  "viewingSchoolYearId": 3,
  "activeSchoolYearLabel": "2026-2027",
  "viewingSchoolYearLabel": "2026-2027",
  "activeSchoolYearStatus": "ACTIVE",
  "systemStatus": "ACTIVE",
  "portalControl": "AUTO",
  "earlyRegOpenDate": "2026-01-10T00:00:00.000Z",
  "earlyRegCloseDate": "2026-02-28T00:00:00.000Z",
  "classOpeningDate": "2026-06-02T00:00:00.000Z",
  "classEndDate": "2027-03-31T00:00:00.000Z",
  "enrollOpenDate": "2026-05-15T00:00:00.000Z",
  "enrollCloseDate": "2026-06-30T00:00:00.000Z",
  "facebookPageUrl": "https://facebook.com/bnhs.official",
  "depedEmail": "bnhs@deped.gov.ph",
  "schoolWebsite": null,
  "enrollmentPhase": "REGULAR_ENROLLMENT",
  "isBosyEnrollmentOpen": true
}
```

### Sample: `POST /api/settings/logo`

**Request:** `multipart/form-data` with field `logo` (PNG/JPG/WEBP, max 5 MB).

**Response:**

```json
{
  "logoUrl": "/uploads/logo.png",
  "colorScheme": {
    "palette": [
      { "hex": "#1a56db", "hsl": "221 83% 53%", "label": "Primary" }
    ],
    "extracted_at": "2026-05-25T08:00:00.000Z"
  },
  "selectedAccentHsl": "221 83% 53%"
}
```

### Sample: `DELETE /api/settings/logo`

**Response:**

```json
{
  "logoUrl": null,
  "colorScheme": null,
  "selectedAccentHsl": null
}
```

---

## 4) Dashboard (`/api/dashboard`)

| Method | Path                   | Auth     | Roles     | Description                                  |
| :----- | :--------------------- | :------- | :-------- | :------------------------------------------- |
| GET    | `/api/dashboard/stats` | Required | ALL STAFF | Aggregated enrollment and admission metrics. |

---

## 5) School Years (`/api/school-years`)

| Method | Path                              | Auth     | Roles     | Description                                      |
| :----- | :-------------------------------- | :------- | :-------- | :----------------------------------------------- |
| GET    | `/api/school-years`               | Required | ALL STAFF | List all academic years.                         |
| GET    | `/api/school-years/next-defaults` | Required | ADMIN     | Get suggested dates for the next SY.             |
| GET    | `/api/school-years/:id`           | Required | ADMIN     | Detailed SY configuration.                       |
| POST   | `/api/school-years/activate`      | Required | ADMIN     | Create and activate a new academic year.         |
| POST   | `/api/school-years/rollover`      | Required | ADMIN     | Clone data from previous year to new year.       |
| PUT    | `/api/school-years/:id`           | Required | ADMIN     | Update SY settings.                              |
| PATCH  | `/api/school-years/:id/status`    | Required | ADMIN     | Transition SY status (e.g., ACTIVE -> ARCHIVED). |

---

## 6) Curriculum (`/api/curriculum`)

| Method | Path                                 | Auth     | Roles     | Description                               |
| :----- | :----------------------------------- | :------- | :-------- | :---------------------------------------- |
| GET    | `/api/curriculum/:ayId/grade-levels` | Required | ADMIN     | List grade levels for a specific year.    |
| GET    | `/api/curriculum/:ayId/scp-config`   | Required | REGISTRAR | List SCP configurations (STE, SPA, etc.). |
| PUT    | `/api/curriculum/:ayId/scp-config`   | Required | ADMIN     | Update SCP admission requirements.        |

---

## 7) Sections (`/api/sections`)

| Method | Path                                 | Auth     | Roles     | Description                              |
| :----- | :----------------------------------- | :------- | :-------- | :--------------------------------------- |
| GET    | `/api/sections`                      | Required | REGISTRAR | List all sections for the active year.   |
| GET    | `/api/sections/teachers`             | Required | REGISTRAR | List teachers eligible for advisership.  |
| POST   | `/api/sections`                      | Required | REGISTRAR | Create a new section.                    |
| GET    | `/api/sections/:id/roster`           | Required | REGISTRAR | List all learners enrolled in a section. |
| POST   | `/api/sections/:id/handover-adviser` | Required | REGISTRAR | Transfer advisership to another teacher. |

---

## 8) Students & Masterlist (`/api/students`)

| Method | Path                               | Auth     | Roles     | Description                                      |
| :----- | :--------------------------------- | :------- | :-------- | :----------------------------------------------- |
| GET    | `/api/students`                    | Required | ALL STAFF | List all learners (Active and Historical).       |
| GET    | `/api/students/:id`                | Required | ALL STAFF | Detailed learner profile.                         |
| GET    | `/api/students/:id/health-records` | Required | ALL STAFF | BMI and physical assessment history.              |
| POST   | `/api/students/:id/health-records` | Required | REGISTRAR | Add a new health measurement.                     |
| POST   | `/api/students/:id/verify-psa`     | Required | REGISTRAR | Mark PSA Birth Certificate as verified.           |
| GET    | `/api/learner/lookup`              | Required | REGISTRAR | **DPA SECURED:** Lookup learner PII by LRN/name. |

---

## 9) Admissions & Enrollment (`/api/applications`)

| Method | Path                            | Auth     | Roles     | Description                               |
| :----- | :------------------------------ | :------- | :-------- | :---------------------------------------- |
| POST   | `/api/applications`             | None     | -         | Public enrollment application submission. |
| GET    | `/api/applications/track/:no`   | None     | -         | Track status by tracking number.          |
| GET    | `/api/applications`             | Required | REGISTRAR | List and filter applications.             |
| PATCH  | `/api/applications/:id/verify`  | Required | REGISTRAR | Verify documents/identity.                |
| PATCH  | `/api/applications/:id/enroll`  | Required | REGISTRAR | Finalize enrollment into a section.       |
| GET    | `/api/applications/exports/sf1` | Required | REGISTRAR | Export School Form 1 data.                |

---

## 10) Early Registration (`/api/early-registrations`)

| Method | Path                                    | Auth     | Roles     | Description                        |
| :----- | :-------------------------------------- | :------- | :-------- | :--------------------------------- |
| POST   | `/api/early-registrations`              | None     | -         | Public BEERF submission.           |
| GET    | `/api/early-registrations`              | Required | ALL STAFF | List pre-registrations.            |
| GET    | `/api/early-registrations/:id/detailed` | Required | ALL STAFF | Expanded profile for screening.    |
| PATCH  | `/api/early-registrations/:id/verify`   | Required | REGISTRAR | Mark documents as verified.        |
| PATCH  | `/api/early-registrations/:id/pass`     | Required | REGISTRAR | Mark as PASSED (for SCP programs). |

---

## 11) Teachers & Faculty (`/api/teachers`)

| Method | Path                            | Auth     | Roles | Description                      |
| :----- | :------------------------------ | :------- | :---- | :------------------------------- |
| GET    | `/api/teachers`                 | Required | STAFF | List all faculty members.        |
| GET    | `/api/teachers/:id`             | Required | STAFF | Single teacher profile.          |
| POST   | `/api/teachers`                 | Required | ADMIN | Create new teacher profile.      |
| PUT    | `/api/teachers/:id/designation` | Required | ADMIN | Set advisory or ancillary roles. |

---

## 12) EOSY - End of School Year (`/api/eosy`)

| Method | Path                                 | Auth     | Roles     | Description                                                                                |
| :----- | :----------------------------------- | :------- | :-------- | :----------------------------------------------------------------------------------------- |
| GET    | `/api/eosy/sections`                 | Required | REGISTRAR | List sections for EOSY processing.                                                         |
| GET    | `/api/eosy/sections/:id/records`     | Required | REGISTRAR | Final grades and promotion status list.                                                    |
| PATCH  | `/api/eosy/records/:id`              | Required | REGISTRAR | Update learner's final EOSY status.                                                        |
| POST   | `/api/eosy/sections/:id/finalize`    | Required | REGISTRAR | Lock section records for the year.                                                         |
| POST   | `/api/eosy/school-year/finalize`     | Required | ADMIN     | Close academic year and promote all.                                                       |
| GET    | `/api/eosy/sections/:id/exports/sf5` | Required | REGISTRAR | **SF5** — Section-scoped learner promotion & proficiency report (JSON).                    |
| GET    | `/api/eosy/exports/sf6`              | Required | REGISTRAR | **SF6** — School-wide enrollment summary by grade level (JSON). Requires `?schoolYearId=`. |

---

## 13) Admin & System (`/api/admin`)

| Method | Path                         | Auth     | Roles | Description                     |
| :----- | :--------------------------- | :------- | :---- | :------------------------------ |
| GET    | `/api/admin/users`           | Required | ADMIN | Manage system user accounts.    |
| GET    | `/api/admin/system/health`   | Required | ADMIN | Detailed server and DB metrics. |
| GET    | `/api/admin/dashboard/stats` | Required | ADMIN | High-level system overview.     |
| GET    | `/api/admin/atlas/health`    | Required | ADMIN | ATLAS Sync subsystem status.    |

---

## 14) Audit Logs (`/api/audit-logs`)

| Method | Path                     | Auth     | Roles     | Description                        |
| :----- | :----------------------- | :------- | :-------- | :--------------------------------- |
| GET    | `/api/audit-logs`        | Required | REGISTRAR | View system activity trail.        |
| GET    | `/api/audit-logs/export` | Required | ADMIN     | Export logs to CSV for compliance. |

---

## 15) Integration v1 (`/api/integration/v1`)

Public read-only feeds for companion systems (ATLAS, SMART, AIMS). No auth required. All endpoints respect `schoolYearId` query param; if omitted the active school year is used.

> **DPA Compliance Note:** Each feed is scoped to the minimum fields required by the consuming system, per RA 10173. **Note:** As of May 15, these feeds now correctly include historical students (e.g., JHS Completers) when querying past school years to ensure accurate end-of-year reconciliations for SMART and AIMS.

| Method | Path                                               | Auth | Description                                                                         |
| :----- | :------------------------------------------------- | :--- | :---------------------------------------------------------------------------------- |
| GET    | `/api/integration/v1/health`                       | None | Connectivity and DB health check.                                                   |
| GET    | `/api/integration/v1/school-year`                  | None | Active school year `id` and `yearLabel`.                                            |
| GET    | `/api/integration/v1/learners`                     | None | Paginated enrolled learner list. **Includes Historical Students**.                  |
| GET    | `/api/integration/v1/faculty`                      | None | Paginated faculty list.                                                             |
| GET    | `/api/integration/v1/sections`                     | None | Paginated section list with capacity and adviser.                                   |
| GET    | `/api/integration/v1/sections/:sectionId/learners` | None | Paginated roster for a specific section.                                            |
| GET    | `/api/integration/v1/default/faculty`              | None | Active faculty feed (ATLAS/AIMS optimised).                                         |
| GET    | `/api/integration/v1/default/smart/students`       | None | SMART-grade-encoding roster. **Includes Historical Students**.                      |
| GET    | `/api/integration/v1/default/aims/context`         | None | AIMS LMS enrollment context. **Includes Historical Students**.                      |

---

## 16) BOSY — Beginning of School Year (`/api/bosy`)

| Method   | Path                                      | Auth            | Roles         | Description                                                                 |
| :------- | :---------------------------------------- | :-------------- | :------------ | :-------------------------------------------------------------------------- |
| GET      | `/api/bosy/readiness`                     | Required        | REGISTRAR     | BOSY readiness checklist for a given SY.                                    |
| GET      | `/api/bosy/queue`                         | Required        | REGISTRAR     | Learners in the PENDING_CONFIRMATION queue.                                 |
| POST     | `/api/bosy/confirm-return/:applicationId` | Required        | REGISTRAR     | Staff confirms a single learner's return.                                   |
| GET      | `/api/bosy/tle-programs`                  | None            | -             | **Public:** returns tracks and `availableSlots`. Requires `?schoolYearId=`. |
| **POST** | **`/api/learner/confirm-return`**         | **Learner JWT** | **LEARNER**   | **Self-service: learner acknowledges return + TLE tracks.**                 |
| **POST** | **`/api/learner/request-transfer`**       | **Learner JWT** | **LEARNER**   | **Self-service: learner signals intent to transfer out.**                   |
| **GET**  | **`/api/bosy/expected-queue`**            | **Required**    | **REGISTRAR** | **Prior-year PROMOTED learners not yet in current SY pipeline.**            |

### Sample: `POST /api/learner/confirm-return`

**Authorization:** `Bearer <learner-jwt>`

**Request body:**

```json
{ 
  "applicationId": 45, 
  "guardianName": "MARIA CLARA DE LA CRUZ",
  "tleProgramId": 1,
  "tleProgramChoice2Id": 3
}
```

**Response:**

```json
{
  "applicationId": 45,
  "status": "READY_FOR_SECTIONING"
}
```

---

## 17) Remedial Processing (`/api/remedial`)

| Method    | Path                                   | Auth         | Roles         | Description                                                     |
| :-------- | :------------------------------------- | :----------- | :------------ | :-------------------------------------------------------------- |
| **GET**   | **`/api/remedial/pending`**            | **Required** | **REGISTRAR** | **List all applications with remedial pending.**                |
| **PATCH** | **`/api/remedial/:learnerId/resolve`** | **Required** | **REGISTRAR** | **Mark remedial as passed; set final average and EOSY status.** |

---

## 18) Integration Triggers (`/api/integration`)

| Method   | Path                                                  | Auth         | Roles            | Description                                                            |
| :------- | :---------------------------------------------------- | :----------- | :--------------- | :--------------------------------------------------------------------- |
| **POST** | **`/api/integration/smart/sections/:id/sync-grades`** | **Required** | **SYSTEM_ADMIN** | **Pull final averages from S.M.A.R.T. for a section.**                 |
| **POST** | **`/api/integration/atlas/sync-faculty`**             | **Required** | **SYSTEM_ADMIN** | **Pull faculty list from ATLAS and upsert `Teacher` by `employeeId`.** |

---

## 19) API Updates (2026-05-15)

The following updates were implemented to ensure DPA compliance and isolated portal workflows:

1. **Authentication Isolation**:
   - `POST /api/auth/logout-learner`: New endpoint to clear the isolated `learner_session` cookie.
   - `POST /api/auth/learner-login`: Now issues a dedicated cookie, preventing session collisions with staff accounts.

2. **DPA Security Hardening**:
   - `GET /api/learner/lookup`: Now requires `HEAD_REGISTRAR` or `SYSTEM_ADMIN` role. Unauthenticated public LRN lookup is no longer supported to prevent student PII leaks.

3. **Digital Confirmation Wall (BOSY)**:
   - `POST /api/learner/confirm-return`: Replaced the legacy `confirm-intent`. Now captures `guardianName` (legal signature equivalent) and TLE track choices (Primary and Fallback).
   - `POST /api/learner/request-transfer`: New endpoint allowing learners to formally signal they are not returning, triggering registrar notification.
   - `GET /api/bosy/tle-programs`: Now public to allow unauthenticated enrollment checks. Requires `schoolYearId` and returns real-time slot availability.

4. **Integration Feed Behavioral Changes**:
   - All learner-fetching endpoints (Section 8 and Section 15) have been updated to correctly include historical learners (e.g., `JHS_COMPLETER`) when querying previous academic years. This ensures **SMART** and **AIMS** have consistent data when performing end-of-year reconciliations.
