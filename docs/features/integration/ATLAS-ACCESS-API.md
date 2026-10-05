# ATLAS Access API (C01)

Last reviewed: 2026-10-05

## Purpose and Source of Truth

This API contract details how ATLAS retrieves the granular administrative access toggles assigned to personnel within EnrollPro. 

EnrollPro is the sole source of truth for the personnel directory and their access configurations. ATLAS must **not** duplicate this list or maintain a second copy of the configuration. The switches that decide who may do what in ATLAS are configured in EnrollPro's personnel admin, exposed through this contract, and enforced by ATLAS on every route.

## Access Toggles

The ATLAS access profile is school-year scoped, allowing permissions to roll over deliberately and differ by year without ATLAS maintaining a duplicate mapping.

| Field | Type | Meaning in ATLAS |
|---|---|---|
| `assignTeachingLoad` | `boolean` | May create and change teaching-load assignments |
| `buildSchedules` | `boolean` | May edit, generate and review the timetable, and request publication |

> **Note**: ATLAS enforces these capabilities. If a personnel has neither flag enabled, they only have access to faculty self-service features. ATLAS does not use ancillary roles (e.g. `GRADE 7 COORDINATOR`) to infer access if this profile is provided.

## Exposed Payload Shape

Both the SSO exchange identity and the Faculty integration feed expose the access toggles within a new `companionAccess` property.

```jsonc
"companionAccess": {
  "atlas": {
    "schoolYearId": 12,                 // The school year these switches belong to
    "assignTeachingLoad": true,         // Allows teaching load management
    "buildSchedules": false,            // Allows schedule building
    "gradeLevelIds": null               // Optional scope; null or [] = all grades
  }
}
```

## Integration Endpoints

### 1. Companion SSO Exchange

**Endpoint:** `POST /api/auth/companion-sso/atlas/exchange`

When ATLAS exchanges an SSO authorization code during login, the resulting JSON identity response includes the `companionAccess.atlas` property for the active school year. This allows ATLAS to determine user capabilities immediately at login without a secondary API call.

**Response Example Fragment:**
```json
{
  "success": true,
  "companion": "ATLAS",
  "identity": {
    "subject": "12345",
    "employeeId": "EMP-987",
    "firstName": "JUAN",
    "lastName": "DELA CRUZ",
    "roles": ["TEACHER", "CLASS_ADVISER"],
    "companionAccess": {
      "atlas": {
        "schoolYearId": 12,
        "assignTeachingLoad": true,
        "buildSchedules": true,
        "gradeLevelIds": null
      }
    }
  }
}
```

### 2. Faculty Integration Feed

**Endpoint:** `GET /api/integration/v1/default/faculty` (or `/api/integration/v1/faculty`)
**Auth:** Integration Key (`X-Integration-Key`)

This machine-to-machine integration feed provides a paginated roster of active faculty. The feed now includes the `companionAccess.atlas` profile and a `userId` field (nullable) so ATLAS can join a feed row to an SSO identity exactly.

**Response Example Fragment:**
```json
{
  "data": [
    {
      "id": 102,
      "userId": 505,
      "employeeId": "EMP-987",
      "firstName": "JUAN",
      "lastName": "DELA CRUZ",
      "plantillaPosition": "MASTER TEACHER I",
      "ancillaryRoles": ["GRADE 7 COORDINATOR"],
      "companionAccess": {
        "atlas": {
          "schoolYearId": 12,
          "assignTeachingLoad": true,
          "buildSchedules": true,
          "gradeLevelIds": null
        }
      }
    }
  ],
  "meta": {
    "generatedAt": "2026-10-05T00:00:00.000Z"
  }
}
```

## Error Handling & Fail Closed

In the event of a missing field, an unexpected school-year mismatch, inactive personnel, or a duplicate match, ATLAS will fail closed and deny load or scheduling rights. 
