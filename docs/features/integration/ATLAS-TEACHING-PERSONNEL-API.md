# ATLAS Teaching Personnel API Update

Last reviewed: 2026-09-29

## Purpose and Source of Truth

ATLAS requires a clear distinction between teaching and non-teaching personnel when synchronizing faculty data from EnrollPro. ATLAS has explicitly stated that it will only fetch and reconcile **teaching personnel** and will not consume non-teaching personnel records.

This document serves as the verified API reference for explicitly separating teaching and non-teaching personnel when fetching faculty data.

## Authentication and School-Year Scope

| Mode | Transport | Used by |
| --- | --- | --- |
| Integration key | `X-Integration-Key: <secret>` or `Authorization: Bearer <secret>` | ATLAS and other integration feeds (`/api/integration/*`) |
| Staff JWT | `Authorization: Bearer <token>` or `enrollpro_session` cookie | Protected internal UI routes (`/api/teachers`) |

For the integration endpoints, `schoolYearId` can optionally be passed to bind the results to a specific school year.

## Faculty Endpoints

| Method | Path | Auth and roles | Purpose |
| --- | --- | --- | --- |
| GET | `/api/integration/v1/default/faculty` | Integration key | ATLAS-ready active faculty feed with deduplicated profile and school-year ancillary roles |
| GET | `/api/integration/v1/faculty` | Integration key | Paginated faculty and designation context |
| GET | `/api/teachers` | `HEAD_REGISTRAR`, `SYSTEM_ADMIN` | Internal EnrollPro UI personnel directory |

*(Note: `/api/integration/v1/teachers` is an alias of `/api/integration/v1/faculty`)*

## Query Parameters and Filtering

All of the endpoints listed above support the `personnelType` query parameter to enforce explicit filtering:

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `personnelType` | `string` | No | Filters the returned faculty list to only include personnel with an exactly matching `personnelType`. Matches are case-insensitive during input parsing. |

### Behavior

1. **Omitted Parameter**: When the `personnelType` parameter is omitted, the API returns all personnel (both teaching and non-teaching), maintaining backward compatibility.
2. **Provided Parameter**: When provided (e.g., `?personnelType=TEACHING`), the API strictly filters `Teacher` records where the database field `personnel_type` exactly matches the normalized query string.

### Response JSON Example

When requested with `GET /api/integration/v1/default/faculty?personnelType=TEACHING`, the response maintains the standard integration envelope format:

```json
{
  "data": [
    {
      "id": 12,
      "employeeId": "1000123",
      "firstName": "JUAN",
      "lastName": "DELA CRUZ",
      "personnelType": "TEACHING",
      "designationTitle": "SUBJECT TEACHER",
      "isActive": true
    }
  ],
  "meta": {
    "generatedAt": "2026-09-29T00:00:00.000Z",
    "total": 1
  }
}
```

## ATLAS Integration Requirements

ATLAS **must** configure its upstream requests to EnrollPro's `/default/faculty` endpoint to include `?personnelType=TEACHING`. 

This guarantees that only valid teaching staff are sent down to ATLAS, completely avoiding the ingestion of administrative, maintenance, or other non-teaching staff into the ATLAS schedule generation systems.
