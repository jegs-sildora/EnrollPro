# EnrollPro Integration Guide — ATLAS Subject Offerings

**Audience:** EnrollPro integration developers  
**Owner:** ATLAS  
**Status:** Live contract (no new ATLAS endpoints required)  
**Applies to:** ATLAS public subject API at `/api/v1/subjects`

> **EnrollPro is a READ_ONLY companion system in this integration.** EnrollPro consumes ATLAS's public read endpoints only. It must never read the ATLAS database directly or attempt to write ATLAS subjects. All subject catalog changes remain an ATLAS scheduling-officer action.

---

## 1. Purpose

This guide explains how EnrollPro can pull the ATLAS subject catalog for a receiving school so it can:

- display the receiving school's subject **codes**, **names**, and grade placement;
- resolve the subject(s) a **transferee** with an **End of School Year (EOSY) "Conditionally Promoted"** status will be enrolled in; and
- stay correct when ATLAS officers add, archive, or re-scope subjects.

**Ownership split (important):**

| Concern | Owner |
|---|---|
| Conditional-promotion status, carry-over/failed subjects, transferee records | **EnrollPro** |
| Subject catalog (codes, names, grade levels, program scopes, minutes) | **ATLAS** |
| Mapping a transferee's carry-over subject to an ATLAS subject code | **EnrollPro** (using the reference data below) |

ATLAS is a **reference-catalog lookup only**. ATLAS does not evaluate promotion, conditionality, or remediation eligibility, and EnrollPro must not assume it does.

---

## 2. What ATLAS Exposes

ATLAS exposes the subject catalog through two **public, unauthenticated** REST endpoints:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/subjects?schoolId=<id>` | List every subject for a school |
| `GET` | `/api/v1/subjects/:id` | Fetch one subject by its ATLAS id |

- Both are versioned under `/api/v1`.
- Both require **no token**. Authentication only applies to subject **mutations** (create/patch/archive/delete), which EnrollPro does not call.
- There is **no pagination**. A school's catalog is returned in full, ordered by `name` ascending.

Base URL is deployment-specific (for example the Tailnet host `https://njgrm.buru-degree.ts.net`). EnrollPro should treat the ATLAS base URL as configuration, not a hard-coded constant.

---

## 3. Endpoint Contracts

### 3.1 `GET /api/v1/subjects?schoolId=<id>`

Returns the full subject catalog for one school.

**Query parameters**

| Parameter | Required | Default | Notes |
|---|---|---|---|
| `schoolId` | **Yes** | — | Integer ATLAS school id (the receiving school). |
| `includeSte` | No | `true` | When set to the literal string `false`, subjects scoped to `STE` are excluded. Any other value includes them. |
| `includeSpa` | No | `true` | When set to the literal string `false`, subjects scoped to `SPA` are excluded. Any other value includes them. |

> There is **no `includeSps` filter** and **no `isActive` filter**. The endpoint returns **active and archived** subjects alike; EnrollPro must filter `isActive === true` when it wants current offerings (see §6.3).

**Success response — `200`**

```json
{
  "subjects": [
    {
      "id": 12,
      "schoolId": 1,
      "code": "FIL",
      "outputLabel": null,
      "name": "Filipino",
      "ownerDepartment": "FIL",
      "qualificationPriority": "DEPARTMENT_FIRST",
      "rotationFamily": null,
      "minMinutesPerWeek": 225,
      "preferredRoomType": "CLASSROOM",
      "modularGroupId": null,
      "modularOrder": null,
      "termGroupId": null,
      "termCount": 3,
      "gradeLevels": [7, 8, 9, 10],
      "isActive": true,
      "isSeedable": true,
      "isSystemManaged": false,
      "interSectionEnabled": false,
      "interSectionGradeLevels": [],
      "programScopes": ["REGULAR", "STE", "SPA", "SPS"],
      "allowedSpecializations": [],
      "requiredFeatures": [],
      "createdAt": "2026-01-05T00:00:00.000Z",
      "updatedAt": "2026-01-05T00:00:00.000Z",
      "displayCode": "FIL",
      "allowedOwnerDepartments": ["FIL"],
      "rotationTermRank": null,
      "rotationTermLabel": null,
      "rotationTermGroupId": null,
      "rotationTermCount": null,
      "specializationSource": "NONE"
    },
    {
      "id": 19,
      "schoolId": 1,
      "code": "SCI_BIO",
      "outputLabel": "SCIENCE",
      "name": "Science - Biology",
      "ownerDepartment": "SCI",
      "qualificationPriority": "DEPARTMENT_FIRST",
      "rotationFamily": "SCIENCE",
      "minMinutesPerWeek": 225,
      "preferredRoomType": "CLASSROOM",
      "modularGroupId": "SCIENCE",
      "modularOrder": 1,
      "termGroupId": "SCIENCE",
      "termCount": 3,
      "gradeLevels": [7, 8, 9, 10],
      "isActive": true,
      "isSeedable": false,
      "isSystemManaged": false,
      "interSectionEnabled": false,
      "interSectionGradeLevels": [],
      "programScopes": ["REGULAR", "STE", "SPA", "SPS"],
      "allowedSpecializations": [],
      "requiredFeatures": [],
      "createdAt": "2026-01-05T00:00:00.000Z",
      "updatedAt": "2026-01-05T00:00:00.000Z",
      "displayCode": "SCIENCE",
      "allowedOwnerDepartments": ["SCI"],
      "rotationTermRank": 1,
      "rotationTermLabel": "Term 1 of 3",
      "rotationTermGroupId": "SCIENCE",
      "rotationTermCount": 3,
      "specializationSource": "NONE"
    }
  ]
}
```

**Error responses**

| Status | Body `code` | When |
|---|---|---|
| `400` | `INVALID_PARAM` | `schoolId` is missing, non-numeric, or `0`. Message: `schoolId query parameter is required.` |

An unknown-but-valid `schoolId` returns `200` with `{ "subjects": [] }`, not `404`.

Example:

```bash
curl "https://<atlas-host>/api/v1/subjects?schoolId=1"
```

### 3.2 `GET /api/v1/subjects/:id`

Returns a single subject by its ATLAS numeric id.

**Success response — `200`**

```json
{
  "subject": {
    "id": 12,
    "schoolId": 1,
    "code": "FIL",
    "name": "Filipino",
    "gradeLevels": [7, 8, 9, 10],
    "programScopes": ["REGULAR", "STE", "SPA", "SPS"],
    "isActive": true,
    "minMinutesPerWeek": 225,
    "displayCode": "FIL"
  }
}
```

The `subject` object carries the **same full field set** as an item in the list response; the example above is abbreviated for readability.

**Error responses**

| Status | Body `code` | When |
|---|---|---|
| `400` | `INVALID_PARAM` | `:id` is not a number. Message: `id must be a number.` |
| `404` | `NOT_FOUND` | No subject with that id exists. Message: `Subject not found.` |

---

## 4. Subject Field Reference

Fields with a source of **stored** come from the ATLAS `subjects` row. Fields marked **derived** are computed on read by ATLAS and are safe to consume but must not be treated as stored values.

| Field | Type | Source | Meaning / use for EnrollPro |
|---|---|---|---|
| `id` | integer | stored | ATLAS-local subject id. **Do not** persist as a cross-system key (§6.1). |
| `schoolId` | integer | stored | ATLAS school that owns the row. |
| `code` | string(32) | stored | **Stable matching key**, unique per school. Examples: `FIL`, `ENG`, `MATH`, `SCI_BIO`, `TLE_ICT_EXP`. |
| `outputLabel` | string \| null | stored | Officer-set label override; null means fall back to `displayCode`. |
| `name` | string | stored | Human-readable subject name (display only). |
| `ownerDepartment` | string \| null | derived* | Department code that owns the subject: `FIL`, `ENG`, `MATH`, `AP`, `ESP`, `MAPEH`, `TLE`, `SCI`. |
| `qualificationPriority` | enum | stored/derived | `DEPARTMENT_FIRST` or `SPECIALIZATION_PRIMARY`. Not relevant to transferee enrollment. |
| `rotationFamily` | string \| null | derived* | Rotation family such as `SCIENCE` or `TLE_ROTATION`. |
| `minMinutesPerWeek` | integer | stored | Required weekly minutes. Reference only; do not use for credit computation. |
| `preferredRoomType` | enum | stored | Room vocabulary: `CLASSROOM`, `LABORATORY`, `COMPUTER_LAB`, `TLE_WORKSHOP`, `LIBRARY`, `GYMNASIUM`, `FACULTY_ROOM`, `OFFICE`, `OTHER`. |
| `modularGroupId` | string \| null | stored | Groups rotating modules, e.g. `SCIENCE`, `TLE_EXPLORATORY`. |
| `modularOrder` | integer \| null | stored | Position within the modular group. |
| `termGroupId` | string \| null | stored | Term family id. |
| `termCount` | integer | stored | Number of terms in the family (default `3`). |
| `gradeLevels` | integer[] | stored | Grades this subject is offered for. Values are `7`, `8`, `9`, `10`. **Use for grade filtering.** |
| `isActive` | boolean | stored | `true` = currently offered; `false` = archived. **Filter on this.** |
| `isSeedable` | boolean | stored | Bootstrap metadata only; not a demand signal. Ignore. |
| `isSystemManaged` | boolean | stored | ATLAS manages lifecycle (auto-created TLE/overlay rows). Informational. |
| `interSectionEnabled` | boolean | stored | Whether cross-section sharing is allowed. Ignore for reference use. |
| `interSectionGradeLevels` | integer[] | stored | Grades allowed for cross-section sharing. |
| `programScopes` | enum[] | stored* | Which programs include the subject. Values: `REGULAR`, `STE`, `SPA`, `SPS`, `OTHER`. |
| `allowedSpecializations` | string[] | stored | Specialization codes (SPA/SPS/TLE). Non-empty means a specialization subject. |
| `requiredFeatures` | string[] | stored/derived | Room/feature requirements. |
| `createdAt` / `updatedAt` | ISO-8601 | stored | `updatedAt` is useful for cache invalidation. |
| `displayCode` | string | derived | Preferred display label (`outputLabel` if set, else a normalized code). Use in UI. |
| `allowedOwnerDepartments` | string[] | derived | Departments permitted to teach the subject. |
| `rotationTermRank` | integer \| null | derived | 1-based position in a term rotation. |
| `rotationTermLabel` | string \| null | derived | Human label, e.g. `Term 1 of 3`. |
| `rotationTermGroupId` | string \| null | derived | Resolved term family id. |
| `rotationTermCount` | integer \| null | derived | Resolved term count. |
| `specializationSource` | enum | derived | `REFERENCE_METADATA` when `allowedSpecializations` is non-empty, else `NONE`. |

\* Legacy rows created before the contract columns existed may have empty `programScopes`; ATLAS infers scopes on read so the returned value is always populated. `ownerDepartment`/`rotationFamily` are filled from stored values when present, otherwise derived from `code`.

---

## 5. Subject Families You Will See

The catalog is school-agnostic and officer-editable, but these are the standard MATATAG families that EnrollPro should expect.

| Family | Codes | Grade scope | Program scopes | Notes |
|---|---|---|---|---|
| Core | `FIL`, `ENG`, `MATH`, `AP`, `ESP`, `MAPEH` | 7–10 | REGULAR, STE, SPA, SPS | Common to all programs. |
| Homeroom Guidance | `HG` | 7–10 | REGULAR, STE, SPA, SPS | Not seedable by default. |
| Science (tri-sem) | `SCI_BIO`, `SCI_CHEM`, `SCI_ES` | 7–10 | REGULAR, STE, SPA, SPS | Modular group `SCIENCE`, `termCount: 3`. |
| TLE exploratory rotation | `TLE_ICT_EXP`, `TLE_AFA_EXP`, `TLE_FCS_EXP` | 7–10 | REGULAR, STE, SPA, SPS | Modular group `TLE_EXPLORATORY`; specializations `ICT`, `AFA`, `FCS`. |
| STE overlays | `STE_ENV_SCI` (G7), `STE_BIOTECH` (G8), `STE_APPLIED_CHEM` (G9), `STE_APPLIED_PHYS` (G10), `STE_ROBOTICS` (G10), `STE_RESEARCH` (7–10) | per code | STE | Grade-specific in several cases. |
| SPA overlay | `SPA_SPEC` | 7–10 | SPA | Specializations: `MUSIC`, `VISUAL_ARTS`, `THEATER_ARTS`, `MEDIA_ARTS`, `CREATIVE_WRITING`, `DANCE`, `TRADITIONAL_ARTS`. |
| SPS overlay | `SPS_SPEC` | 7–10 | SPS | Specializations: `ATHLETICS`, `SWIMMING`, `BASKETBALL`, `VOLLEYBALL`, `FOOTBALL`, `SEPAK_TAKRAW`, `SOFTBALL`, `BASEBALL`, `BADMINTON`, `TABLE_TENNIS`, `TAEKWONDO`, `TENNIS`, `CHESS`, `GYMNASTICS`, `ARCHERY`, `ARNIS`. |
| SPA/SPS shared | `DEVL_READING` | 7–10 | SPA, SPS | |
| Dynamic TLE | `TLE_SPEC_*` | varies | REGULAR | Materialized from upstream TLE program data; may appear/disappear. |

Do **not** hard-code this table as the source of truth — always read the catalog. The table exists only to help EnrollPro interpret what it receives.

---

## 6. EOSY "Conditionally Promoted" Transferee Flow

### 6.1 Contract boundaries

- EnrollPro owns the status "Conditionally Promoted" and the list of carry-over / remediation subject(s).
- ATLAS supplies only the receiving school's catalog.
- Match on **`subject.code` scoped to the receiving `schoolId`** — never on `id`, and never on `name` (names are display-only and editable).
- `code` is unique per school (`UNIQUE (school_id, code)`), so `(schoolId, code)` is a valid foreign key from EnrollPro's perspective.

### 6.2 Recommended flow

```text
EnrollPro: transferee record (status = EOSY Conditionally Promoted)
   │  has → promotedToGrade (next grade) + carryOverSubject(s)
   ▼
1. Resolve the receiving ATLAS schoolId for the transferee's school.
2. GET /api/v1/subjects?schoolId=<receivingSchoolId>
3. Keep only rows where isActive === true.
4. For each carry-over subject:
     a. normalize its local label/code to an ATLAS code (uppercase, non-alphanumerics → "_");
     b. find the catalog row where code matches;
     c. confirm gradeLevels.includes(promotedToGrade);
     d. optionally confirm programScopes contains the transferee's program.
5. Store (receivingSchoolId, subject.code) as the link — not the ATLAS id.
6. For display, use displayCode + name.
7. If no match: mark the carry-over subject as "unresolved — request ATLAS catalog review".
```

### 6.3 Matching rules

1. **Normalize codes the same way ATLAS does.** Uppercase, replace any run of non-alphanumeric characters with `_`, trim leading/trailing `_`. Example: `"Science - Biology"` → `SCIENCE_BIOLOGY` (which will **not** match `SCI_BIO`; carry-over labels often need an explicit local mapping table).
2. **Prefer an explicit EnrollPro-side code map** over string guessing for Science and TLE, because ATLAS codes are modular (`SCI_BIO`, `SCI_CHEM`, `SCI_ES`) while EnrollPro may store a single "Science" subject.
3. **Filter by `isActive === true`.** Archived subjects (`isActive: false`) must not be offered to a new transferee.
4. **Grade-check with `gradeLevels`.** A code may exist for the school but not for the promoted grade (STE overlays are the common case).
5. **Program-check with `programScopes`.** REGULAR transferees generally match `programScopes` containing `REGULAR`.
6. **Specialization subjects.** Rows with a non-empty `allowedSpecializations` (SPA/SPS/TLE) require the transferee's specialization to be in that array before they can be treated as a direct substitute.

### 6.4 Worked example

A transferee is **conditionally promoted to Grade 8** with a carry-over in **Filipino** and **Science**. The receiving ATLAS `schoolId` is `1`.

1. EnrollPro calls `GET /api/v1/subjects?schoolId=1`.
2. Filter active rows; keep those where `gradeLevels` includes `8`.
3. Resolve carry-overs:
   - Filipino → codes containing `FIL` → match `FIL` (`gradeLevels: [7,8,9,10]`, active).
   - Science → EnrollPro's local map resolves to the Grade 8 Science offer. If the receiving program is regular tri-sem, the ATLAS reference rows are `SCI_BIO` / `SCI_CHEM` / `SCI_ES` (all active, grade 8 in scope). EnrollPro decides which of these its remediation record maps to; ATLAS only supplies the reference.
4. EnrollPro persists `{ schoolId: 1, subjectCode: "FIL" }` and the selected `SCI_*` code(s) against the transferee.
5. UI renders `displayCode` + `name` from the ATLAS payload.

> The conditional-promotion decision itself never leaves EnrollPro. ATLAS has no endpoint that returns "eligible for a conditionally promoted transferee."

### 6.5 Why not use the ATLAS subject `id`

- `id` is ATLAS-autoincrement and is not guaranteed stable across environments or database rebuilds.
- `code` is the business key and is unique per school.
- EnrollPro should re-resolve code → id on each session if it ever needs the single-subject endpoint.

---

## 7. Error Handling & Edge Cases

| Situation | ATLAS behavior | EnrollPro action |
|---|---|---|
| `schoolId` omitted / invalid | `400 INVALID_PARAM` | Treat as a configuration error; do not retry blindly. |
| Unknown but valid `schoolId` | `200 { "subjects": [] }` | Treat as "no catalog yet"; surface a setup warning, do not crash. |
| School has zero subjects | `200 { "subjects": [] }` | Fall back to the CSV snapshot (§9). |
| ATLAS unreachable / timeout | Connection error or non-2xx | Retry with backoff, then use the cached catalog / CSV fallback. |
| Archived subject returned | `isActive: false` row present | Filter it out of offerings. |
| Duplicate local label (e.g. two "Science" rows) | Multiple `SCI_*` codes | Require an explicit EnrollPro code map; never auto-pick. |
| `programScopes` empty on a legacy row | ATLAS infers scopes before returning | Consume the returned value; no special handling. |
| Subject renamed by an ATLAS officer | `name`/`displayCode` change, `code` stable | Match on `code`; refresh display labels from the latest pull. |
| Subject archived by an ATLAS officer | `isActive` flips to `false` | Re-validate cached mappings; stop offering it. |

**Never** parse an error body for a `subjects` array — on `4xx` the response is an error object, not a catalog.

---

## 8. Caching, Retries, and Freshness

- **Cache key:** `(atlasBaseUrl, schoolId)`.
- **Freshness:** the catalog changes only when an ATLAS officer edits it. A cache TTL in the hours-to-1-day range is reasonable. Use `updatedAt` (max across rows) as a cheap change signal.
- **Invalidation:** refresh on TTL expiry, on a `404`/`NOT_FOUND` when resolving a cached code, or on an operator-triggered "Refresh subjects" action.
- **Retries:** apply bounded exponential backoff on network errors and `5xx`. Do not retry `400`.
- **Concurrency:** the list endpoint returns the whole school catalog in one call; cache it and filter locally rather than issuing one call per subject.

---

## 9. CSV Fallback (EnrollPro-side)

If the ATLAS API is unavailable, EnrollPro may load a previously exported catalog snapshot. This fallback is an **EnrollPro-side artifact**; it is not served by ATLAS and must be labeled as potentially stale in the UI.

Recommended columns (one row per subject per school):

```csv
school_id,code,name,display_code,grade_levels,program_scopes,is_active,specializations,min_minutes_per_week,updated_at
1,FIL,Filipino,FIL,"7|8|9|10","REGULAR|STE|SPA|SPS",true,,225,2026-01-05T00:00:00.000Z
1,SCI_BIO,Science - Biology,SCIENCE,"7|8|9|10","REGULAR|STE|SPA|SPS",true,,225,2026-01-05T00:00:00.000Z
1,STE_ROBOTICS,Robotics,STE_ROBOTICS,10,STE,true,,225,2026-01-05T00:00:00.000Z
```

Rules:

- Multi-value arrays use `|` as the separator inside a quoted field.
- Never derive `is_active` from the snapshot alone for a new enrollment; re-check against the live API when it recovers.
- Record the snapshot timestamp and show a "using saved subject data" indicator, mirroring ATLAS's own source-honesty pattern.

---

## 10. Quick Reference

```bash
# Full catalog for the receiving school
curl "https://<atlas-host>/api/v1/subjects?schoolId=1"

# Catalog excluding STE and SPA subjects
curl "https://<atlas-host>/api/v1/subjects?schoolId=1&includeSte=false&includeSpa=false"

# One subject by ATLAS id
curl "https://<atlas-host>/api/v1/subjects/12"

# Health check before a batch pull
curl "https://<atlas-host>/api/v1/health"   # { "status": "ok", "service": "atlas" }
```

| Item | Value |
|---|---|
| Version prefix | `/api/v1` |
| Auth | None for the two GET endpoints |
| Pagination | None |
| Matching key | `(schoolId, code)` |
| Active filter | `isActive === true` |
| Program vocabulary | `REGULAR`, `STE`, `SPA`, `SPS`, `OTHER` |
| Grade vocabulary | `7`, `8`, `9`, `10` |

---

## 11. Out of Scope

- Any write to ATLAS from EnrollPro (create/patch/archive/delete/sync).
- Promotion, conditionality, remediation eligibility, or credit computation logic (EnrollPro-owned).
- Published schedules and generation endpoints (separate ATLAS contracts).
- Direct database access between the two services — ATLAS is an isolated microservice and shares no database.

## 12. Assumptions

- EnrollPro already knows the receiving school's ATLAS `schoolId` for each transferee.
- EnrollPro maintains an explicit local map from its carry-over subject labels to ATLAS `code`s for Science and TLE.
- The ATLAS subject API remains public and unauthenticated.

## 13. Change Control

- ATLAS subject field additions are backward-compatible; EnrollPro must ignore unknown fields.
- A breaking change to this contract requires a new `/api/v1` sub-path or an ATLAS handoff notice dropped in `D:/ATLAS/docs/`.
- ATLAS officers can change the catalog at any time; EnrollPro must never assume the catalog is static.
