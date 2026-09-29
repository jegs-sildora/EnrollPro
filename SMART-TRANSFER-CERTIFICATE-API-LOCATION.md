# SMART: Where to Fetch the Transfer Certificate Number

Verified against EnrollPro source and the local database on 2026-09-29.

## Official endpoint

Use the existing SMART-only server-to-server transferee feed:

```http
GET /api/integration/v1/default/smart/transferees?schoolYearId=<EnrollPro school-year ID>&page=1&limit=50
X-Integration-Key: <SMART_INTEGRATION_API_KEY>
```

`Authorization: Bearer <SMART_INTEGRATION_API_KEY>` is also accepted. The `/v1` segment is required. The key belongs on the SMART backend, not in a browser or URL. Page through the entire response before reconciling. Omit `schoolYearId` only when the authoritative active year is intended.

The value is a **top-level property of each item in `data`**:

```json
{
  "data": [
    {
      "enrollmentApplicationId": 321,
      "lrn": "123456789012",
      "transferCertificateNo": "TC-2030-001",
      "schoolYear": { "id": 12, "yearLabel": "2030-2031" }
    }
  ],
  "meta": {
    "contractVersion": "1.1",
    "scopeSchoolYearId": 12,
    "scopeSchoolYearLabel": "2030-2031"
  }
}
```

This is a shortened example showing the field location; real rows also contain the other roster and v1.1 detail fields. Read `data[i].transferCertificateNo`, **not** `data[i].previousSchool.transferCertificateNo` and not the general `/default/smart/students` feed. Match the row using the existing `enrollmentApplicationId` and school-year/LRN identity, then fill SMART's `Student.transferCertNo` only when that SMART field has no registrar-entered value.

## When the value can be null

EnrollPro stores this optional value in `application_previous_schools.transfer_certificate_no`. Staff walk-in enrollment reads `transferCertificateNo` from the form and saves it on the application's previous-school record; the SMART feed selects that field and returns a trimmed string, or explicit `null` when empty or missing. It does not derive a certificate number. The Grade 7 seed scripts now assign deterministic `TC-<entry year>-<LRN suffix>` values to seeded transferees only.

Local database verification after the targeted backfill on 2026-09-29:

| Scope | Rows | Non-null transfer certificate numbers |
| --- | ---: | ---: |
| Officially enrolled transferees, 2022-2023 | 10 | 10 |
| All previous-school records | 20 | 10 |

The 10 existing 2022-2023 Grade 7 transferees were updated in place; new enrollees were not assigned transfer certificates. Other records may still legitimately return `null` when no certificate was entered. SMART should keep a manual-entry/registrar-correction path for null values and must not overwrite a corrected SMART value with null.

The feed includes only officially enrolled `TRANSFEREE` applications with an `EnrollmentRecord` in the requested year. Pending sectioning is excluded; archived years return an empty transferee feed with an explanatory metadata message. If SMART sees no row, first verify the year ID, pagination, and enrollment status. If a row lacks the key entirely, verify EnrollPro is running the v1.1 implementation (`meta.contractVersion === "1.1"`).

## Source references

- Route: `server/src/features/integration/integration.router.ts`
- Selection and response: `server/src/features/integration/integration.default.controller.ts`
- Field mapping: `server/src/features/integration/smart-transferee-details.ts`
- Intake persistence: `server/src/features/enrollment/enrollment.controller.ts`
- Full contract and error behavior: `SMART-TRANSFEREE-DETAILS-CONTRACT.md`

Do not use `/api/learner/lookup` for SMART synchronization; it is a staff-facing lookup, not the versioned integration contract. Do not log the integration key, certificate numbers, or complete learner response bodies.
