# SMART Transferee API

This document describes the SMART integration endpoint for retrieving Transferee learner records from EnrollPro.

## Overview

The Transferee API provides SMART with a synchronized list of learners currently classified as `TRANSFEREE` within the active school year. This endpoint follows the exact same schema and data minimization rules as the standard SMART Students API, ensuring privacy and data protection (DPA compliance) by withholding sensitive PII like birthdate, sex, user ID, and portal account references.

This endpoint is used by SMART to build and update grading rosters specifically for transferee students who may need distinct handling in academic records.

## Endpoint

\`\`\`http
GET /api/integration/default/smart/transferees
\`\`\`

## Authentication

All requests must include the SMART machine integration API key in the `x-api-key` header.

\`\`\`http
x-api-key: <SMART_INTEGRATION_API_KEY>
\`\`\`

## Query Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `page` | Integer | No | `1` | Page number for pagination |
| `limit` | Integer | No | `100` | Number of records per page (max 500) |

## Response Schema

The response is a JSON object containing a `data` array and `meta` pagination information.

### Success (200 OK)

\`\`\`json
{
  "data": [
    {
      "enrollmentApplicationId": "app_123",
      "enrollmentStatus": "ENROLLED",
      "lrn": "123456789012",
      "isPendingLrn": false,
      "fullName": "Dela Cruz, Juan M.",
      "firstName": "Juan",
      "lastName": "Dela Cruz",
      "middleName": "M.",
      "extensionName": null,
      "gradeLevel": {
        "id": 1,
        "name": "Grade 7",
        "displayOrder": 1
      },
      "section": {
        "id": "sec_456",
        "name": "Mabini"
      },
      "enrolledAt": "2026-08-01T08:00:00Z",
      "eosyStatus": null,
      "dropOutDate": null,
      "dropOutReason": null,
      "transferOutDate": null,
      "schoolYear": {
        "id": 1,
        "yearLabel": "2026-2027"
      }
    }
  ],
  "meta": {
    "sourceSystem": "SMART",
    "generatedAt": "2026-08-10T10:00:00Z",
    "scopeSchoolYearId": 1,
    "scopeSchoolYearLabel": "2026-2027",
    "total": 50,
    "page": 1,
    "limit": 100,
    "totalPages": 1
  }
}
\`\`\`

## Behavior and Constraints

1. **Filtering:** Returns only enrollment applications with `learnerType: "TRANSFEREE"`.
2. **Status Inclusion:** Includes all official enrollment statuses (e.g., `ENROLLED`, `DROPPED`, `TRANSFERRED_OUT`) so SMART can reflect status changes in grading records.
3. **Historical Data:** When the requested school year is `ARCHIVED`, the endpoint currently returns an empty data array (`[]`) along with a meta message: `"Archived transferees not yet supported in integration feed."`
4. **Data Minimization:** No demographic or authentication data (birthdate, gender, user credentials) is exposed through this endpoint.
