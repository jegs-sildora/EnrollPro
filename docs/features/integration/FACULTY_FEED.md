# ATLAS Integration API: Faculty Feed Payload Updates

> **Target Audience:** This document is explicitly written to serve as prompt context for the **ATLAS AI Agent** (or integration engineers) responsible for ingesting faculty data from EnrollPro.

## Overview

The integration endpoints `GET /api/integration/v1/faculty` (and its alias `GET /api/integration/v1/teachers`) have been upgraded. Historically, ATLAS fetched 0 records for detailed professional and academic background fields because EnrollPro did not map them to the public API JSON output.

This has been resolved. EnrollPro now exposes a richer, extended personnel context payload directly from the core `Teacher` and `TeacherDesignation` models.

## Newly Exposed JSON Properties

The following fields are now explicitly returned in the integration JSON response for each faculty member. When ingesting or syncing, **ATLAS must expect and map these fields**:

### Academic & Educational Background
- **`undergraduateDegree`** (`string | null`): The teacher's completed undergraduate degree (e.g., "Bachelor of Secondary Education"). Sourced directly from `Teacher.undergraduateDegree`.
- **`postgraduateDegree`** (`string | null`): Any postgraduate degree attained (e.g., "Master of Arts in Education"). Sourced from `Teacher.postgraduateDegree`.
- **`majorSpecialization`** (`string | null`): The primary subject specialization focus of the teacher. Sourced from `Teacher.majorSpecialization`.
- **`minorSpecialization`** (`string | null`): The secondary or minor subject specialization. Sourced from `Teacher.minorSpecialization`.

### Professional & Employment Status
- **`plantillaPosition`** (`string | null`): The official HR Plantilla Position title (e.g., "Teacher I", "Master Teacher II"). Sourced from `Teacher.plantillaPosition`.
- **`designationTitle`** (`string | null`): The active, school-year-specific designation title. Sourced from the `TeacherDesignation` record attached to the current school year (e.g., "Department Head").

### Roles & Responsibilities
- **`ancillaryRoles`** (`string[]`): An array of strings representing additional administrative or extracurricular roles assigned to the teacher (e.g., "SPG Adviser", "DRRM Coordinator"). 
  - *Data Source & Logic:* EnrollPro dynamically builds this list by merging the permanent roles defined in the `Teacher` model with the active, school-year-specific roles defined in the `TeacherDesignation` model. The final array is automatically deduplicated (using a `Set`) so ATLAS will not receive duplicate string values.

## Expected ATLAS Agent Behavior

When the ATLAS AI Agent triggers the `ATLAS_FACULTY_SYNC` mechanism (or pulls from the `/faculty` endpoint), it should:
1. **Parse the updated payload:** Ensure the data ingestion pipeline explicitly maps these new keys instead of ignoring them.
2. **Handle Null Values:** All the new string fields (except the array `ancillaryRoles`) are nullable. The ATLAS system must safely accept `null` for teachers whose profiles lack complete academic or HR records.
3. **Array Handling:** `ancillaryRoles` will always be a valid array. If a teacher has no roles, it returns an empty array `[]` rather than `null`.

## Example JSON Object (Faculty Member)

```json
{
  "teacherId": 104,
  "employeeId": "T-12345",
  "firstName": "Juan",
  "lastName": "Dela Cruz",
  "fullName": "Dela Cruz, Juan",
  "undergraduateDegree": "BSEd Mathematics",
  "postgraduateDegree": null,
  "majorSpecialization": "Mathematics",
  "minorSpecialization": "Physics",
  "plantillaPosition": "Teacher III",
  "designationTitle": "Subject Coordinator",
  "ancillaryRoles": ["Math Club Adviser", "Property Custodian"]
}
```
