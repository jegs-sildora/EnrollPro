# SMART Feed Integration (Student API)

This document is intended as a context guide and prompt for the **SMART AI Agent** regarding the learner list payload fetched from EnrollPro.

## Overview
EnrollPro exposes an API endpoint specifically designed for SMART to fetch active and recently dropped/transferred students for grade encoding and EOSY operations.

### API Endpoint
`GET /api/integration/v1/default/smart/students`

### Payload Structure

The `data` array in the response contains objects for each student. The payload includes minimum demographic data (respecting data privacy) and crucial lifecycle indicators. 

The structure of each student object is as follows:

```json
{
  "enrollmentApplicationId": 1234,
  "enrollmentStatus": "ENROLLED",
  "lrn": "123456789012",
  "isPendingLrn": false,
  "fullName": "Doe, John Smith",
  "firstName": "John",
  "lastName": "Doe",
  "middleName": "Smith",
  "extensionName": null,
  "gradeLevel": {
    "id": 8,
    "name": "GRADE 8",
    "displayOrder": 2
  },
  "section": {
    "id": 105,
    "name": "Rizal",
    "programType": "REGULAR"
  },
  "enrolledAt": "2026-06-15T08:00:00Z",
  "eosyStatus": "DROPPED_OUT",
  "dropOutDate": "2026-08-20T00:00:00Z",
  "dropOutReason": "Financial constraints",
  "transferOutDate": null,
  "schoolYear": {
    "id": 3,
    "yearLabel": "2026-2027"
  }
}
```

## Lifecycle States & Handling

SMART AI Agent must correctly interpret the lifecycle indicators: `eosyStatus`, `dropOutDate`, and `transferOutDate`.

### 1. Active Enrolled Learners
If the learner is actively studying:
- `eosyStatus` will typically be `IN_PROGRESS` or `null`.
- `dropOutDate` and `transferOutDate` will be `null`.
- SMART should allow teachers to encode grades normally.

### 2. Dropped Out Learners
If a learner drops out:
- `eosyStatus` will be `DROPPED_OUT`.
- `dropOutDate` will indicate the exact date they officially dropped out.
- `dropOutReason` may contain the reason code (e.g., financial, relocation, prolonged absence).
- **SMART Action:** SMART should lock grading for this learner and reflect their dropped status in class records. Do not expect final outcomes.

### 3. Transferred Out Learners
If a learner transfers out to another school:
- `eosyStatus` will be `TRANSFERRED_OUT`.
- `transferOutDate` will indicate the exact date they transferred.
- **SMART Action:** SMART should lock grading for this learner and reflect their transferred status in class records. Do not expect final outcomes.

## Mechanism
EnrollPro DOES NOT push data to SMART via a webhook for these specific learner status changes. SMART must poll this endpoint periodically to synchronize its masterlist and reflect the `eosyStatus`, `dropOutDate`, and `transferOutDate` updates.
