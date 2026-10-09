# ATLAS Integration: Fetching Faculty Complete Profile Details

This guide describes how ATLAS (or any integrated system with the required API keys) can retrieve comprehensive faculty profile information in EnrollPro, including `natureOfAppointment`, `accessExpirationDate`, and other fields.

These additional fields are now explicitly included in the integration faculty feed, enabling ATLAS to accurately categorize teachers based on their employment status (e.g., `REGULAR_PERMANENT`, `PROVISIONAL`, `SUBSTITUTE`), manage system access based on their contract end dates (`accessExpirationDate`), and synchronize their full profile details.

## Relevant API Endpoint

To retrieve this data, ATLAS should use the standard **Integration Faculty Feed**.

**Endpoint:**  
`GET /api/integration/v1/faculty` (or `/api/integration/v1/teachers`)

**Authentication:**  
Requires the ATLAS Integration API Key passed as a header:
```http
X-Integration-Key: <ATLAS_INTEGRATION_API_KEY>
```

**Query Parameters:**
- `page` (optional): The page number (default: 1)
- `limit` (optional): The page size (default: 100, max: 1000)
- `includeInactive` (optional): Set to `true` to include inactive faculty members (default: `false`)
- `personnelType` (optional): Filter by personnel type, such as `TEACHING` or `NON_TEACHING`.

---

## Response Structure

The endpoint returns a paginated JSON object where the `data` array contains the faculty records. Each faculty record object now includes all the input fields found in the Teacher Profile Panel.

### Example Response Payload:

```json
{
  "data": [
    {
      "userId": 45,
      "teacherId": 12,
      "employeeId": "T-123456",
      "firstName": "JUAN",
      "lastName": "DELA CRUZ",
      "middleName": "SANTOS",
      "suffix": null,
      "fullName": "DELA CRUZ, JUAN S.",
      "sex": "MALE",
      "birthdate": "1990-01-01T00:00:00.000Z",
      "email": "juan.delacruz@deped.gov.ph",
      "contactNumber": "09171234567",
      "personnelType": "TEACHING",
      "functionalAssignment": null,
      "specialization": "MATHEMATICS",
      "undergraduateDegree": "BACHELOR OF SECONDARY EDUCATION",
      "bachelorMajor": "MATHEMATICS",
      "bachelorMinor": null,
      "postgraduateDegree": null,
      "majorSpecialization": "MATHEMATICS",
      "minorSpecialization": null,
      "postgraduateDegrees": [],
      "indigenousCommunity": "NOT APPLICABLE",
      "natureOfAppointment": "SUBSTITUTE",
      "fundingSource": "NATIONAL",
      "serviceStatus": "ACTIVE",
      "serviceEffectiveDate": "2024-01-01T00:00:00.000Z",
      "serviceRemarks": null,
      "portalActive": true,
      "accessExpirationDate": "2026-12-31T00:00:00.000Z",
      "roles": ["TEACHER"],
      "isActive": true,
      "departmentCode": "MATH",
      "departmentName": "Mathematics Department",
      "sectionCount": 1,
      "schoolId": 1,
      "schoolName": "Sample High School",
      "schoolYearId": 5,
      "schoolYearLabel": "2026-2027",
      "plantillaPosition": "SUBSTITUTE TEACHER",
      "designationTitle": "Subject Teacher",
      "ancillaryRoles": [],
      "isClassAdviser": false,
      "advisorySectionId": null,
      "advisorySectionName": null,
      "advisorySectionGradeLevelId": null,
      "advisorySectionGradeLevelName": null,
      "atlasAssignTeachingLoad": true,
      "atlasBuildSchedules": true,
      "effectiveFrom": "2026-08-01T00:00:00.000Z",
      "effectiveTo": null,
      "companionAccess": null
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 100,
    "totalPages": 1
  }
}
```

## Newly Available Fields for ATLAS

Here are the fields exposed specifically to support external synchronization:

- **`natureOfAppointment`**: Important for ATLAS to identify the employment status (e.g. `"SUBSTITUTE"` vs `"REGULAR_PERMANENT"`).
- **`accessExpirationDate`**: Useful for automatically disabling external access to systems when a temporary contract ends.
- **`atlasAssignTeachingLoad` & `atlasBuildSchedules`**: Used directly by ATLAS to identify if the personnel has teaching assignments and if they are part of the school's schedule generation.
- **`roles`**: Contains a list of the user's role strings (e.g. `["TEACHER"]`).
- **Demographic Information**: `sex`, `birthdate`, `suffix`, `indigenousCommunity`.
- **Educational Background**: `bachelorMajor`, `bachelorMinor`, `postgraduateDegrees` (Array).
- **Service Info**: `serviceStatus`, `serviceEffectiveDate`, `serviceRemarks`, `fundingSource`.

ATLAS can now consume these properties dynamically without requiring additional sub-system API calls.
