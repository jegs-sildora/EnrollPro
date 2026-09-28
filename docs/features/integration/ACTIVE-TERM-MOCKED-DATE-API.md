# Active Term & Mocked Date API

**EnrollPro** is the authoritative source of truth for the active academic term across the entire ecosystem, including ATLAS, AIMS, SMART, and MRF. Dependent systems must not guess or calculate the active term using their own local clocks. Instead, they must query EnrollPro to reliably resolve the current active term based on the official school calendar.

To support development, testing, and temporal debugging, EnrollPro supports a **Time Machine (Mocked System Date)**. This document outlines how integration clients interact with the Active Term API and how they can simulate time.

## 1. Active Term Endpoint

**Endpoint:** `GET /api/integration/v1/active-term`

Resolves the active term identity and label for the authoritative active school year.

### Authentication
Requires a valid integration API key passed via the HTTP Header:
```http
X-Integration-Key: <your-service-api-key>
```
Or via Bearer token:
```http
Authorization: Bearer <your-service-api-key>
```

### Supported Query Parameters
- `schoolYearId` *(optional)*: Explicitly resolve the active term for a specific school year. If omitted, EnrollPro defaults to the globally active school year (`SchoolSetting.activeSchoolYearId`).

### Success Response (`200 OK`)
```json
{
  "data": {
    "activeTerm": "T1",
    "activeTermLabel": "QUARTER 1",
    "termFormat": "QUARTERS",
    "schoolYearId": 1
  }
}
```

### Error Responses
- `401 Unauthorized`: Missing or invalid integration key.
- `409 Conflict` (`HISTORICAL_ACTIVE_TERM_UNAVAILABLE`): An active term is only available for the authoritative active school year.
- `409 Conflict` (`ACTIVE_TERM_UNRESOLVED`): The resolved date does not fall within any configured term range.

---

## 2. Temporal Resolution & Mocked Date (Time Machine)

EnrollPro evaluates the "current" time using a cascading resolution strategy. This allows integration partners to seamlessly test boundary conditions (e.g., grading periods opening/closing, EOSY transitions) without altering their own local clocks.

When `GET /api/integration/v1/active-term` is called, EnrollPro resolves the date in the following order of precedence:

### A. Client-Provided Mock Date (`X-Mock-Date` Header)
Integration clients can force a specific date for a single request by sending the `X-Mock-Date` HTTP header. This is the **highest priority** and overrides the server's state.

**Example Request:**
```http
GET /api/integration/v1/active-term HTTP/1.1
Host: enrollpro.example.com
X-Integration-Key: my-secret-key
X-Mock-Date: 2026-11-15T08:00:00.000Z
```
*(In this example, EnrollPro evaluates the active term exactly as it would be on Nov 15, 2026.)*

### B. Global System Date Override (Server Time Machine)
If the `X-Mock-Date` header is absent, EnrollPro checks its own global `SchoolSetting.mockedSystemDate`. 
If a System Administrator has enabled the Time Machine in the EnrollPro UI, the entire platform (including all incoming integration API requests) is transported to that mocked date. Time continues to tick naturally forward from the anchor point.

### C. Real System Clock
If no client header is provided and the global Time Machine is disabled, EnrollPro falls back to the real-world server clock (`new Date()`).

---

## 3. Integration Guidelines

1. **Do not cache indefinitely:** Term transitions occur strictly at midnight. Downstream systems should query the active term when a user session initializes or when critical modules load.
2. **Propagate Mock Dates:** For end-to-end testing, if your frontend (e.g., ATLAS) uses a mocked date for its UI, ensure your backend passes that same date to EnrollPro via the `X-Mock-Date` header when querying `/active-term`.
3. **Respect `ACTIVE_TERM_UNRESOLVED`:** If the active term cannot be resolved (e.g., during semestral break), systems must gracefully restrict term-specific mutations rather than fabricating a fallback term.
