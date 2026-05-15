# EnrollPro API Changelog

This file tracks all changes to the EnrollPro API per the **Strict API Governance Directive**.

---

## Change Entry Template

```markdown
### [Date] - [Endpoint Name]

- **Action:** [Added / Modified / Deprecated]
- **What Changed:** [Brief technical description]
- **The 'Why' (Business Justification):** [Detailed reason]
- **Impact Radius:** [List which systems—ATLAS, AIMS, SMART—need to update their frontend/fetching logic to handle this change.]
```

---

## 2026-07-15 - SY Switcher + Seed Determinism + UI Label Fixups

### School Year Switcher (Phases 1–4)

- **Action:** Added
- **What Changed:**
  - Added `viewingSchoolYearLabel` field to `settings.slice.ts`; `setViewingSY` now updates both id and label together.
  - Created `client/src/shared/hooks/useSchoolYearContext.ts` — single source of truth for `ayId`, `ayLabel`, `isViewingOverride`, and `viewingStatus` across all feature pages.
  - `AppLayout.tsx` SYSwitcher now passes `yearLabel` to the store; bypass routes (`/bosy`, `/walk-in`) are excluded from SY context override.
  - Dashboard headings use `ayLabel` from the hook instead of bare store values.
- **The 'Why' (Business Justification):** Registrars need to view historical data per school year without accidentally seeing active-year labels on archived views.
- **Impact Radius:** Client only — no backend API changes.

### Dashboard — Historical Data Banner

- **Action:** Added
- **What Changed:**
  - Dashboard now renders a slate-colored banner with an Archive icon when `isViewingOverride` is true (user is viewing a non-active school year).
  - Banner displays the viewed SY label and its status badge (e.g., ARCHIVED).
- **The 'Why' (Business Justification):** Prevents user confusion when browsing historical enrollment data by making the context switch visually explicit.
- **Impact Radius:** Client only.

### Enrollment & Sections Pages — Label Fixups

- **Action:** Modified
- **What Changed:**
  - `client/src/features/enrollment/pages/Index.tsx`: Replaced 3 usages of `activeSchoolYearLabel` (LIS export filename, BOSY banner text, LIS description) with `ayLabel` from `useSchoolYearContext`.
  - `client/src/features/sections/pages/Index.tsx`: Replaced 1 usage of `activeSchoolYearLabel` (roster sheet header) with `ayLabel` from `useSchoolYearContext`.
- **The 'Why' (Business Justification):** These pages were still showing the active school year label even when the user was viewing a different year via the SY Switcher.
- **Impact Radius:** Client only.

### Seed Determinism — All Seed Files

- **Action:** Modified
- **What Changed:**
  - `server/prisma/seeds/03-eosy/seed-eosy-grades.ts`: Replaced Box-Muller normal distribution (`generateNormalRandom`, `generateGrade`) with `deterministicGrade(index, isSTE)` — an index-modulo formula. Added `orderBy: { id: "asc" }` to `findMany`. Threaded batch index into grade computation.
  - `server/prisma/seeds/03-eosy/seed-eosy-grades-incoming.ts`: Same deterministic grade function. Replaced `Math.random() < 0.05` conditional remark with `(i + batchIdx) % 20 === 0`.
  - `server/prisma/seeds/01-global/seed-teachers.ts`: Replaced `PLANTILLA_POSITIONS` + `getRandomFromWeighted` / `generateRandomEmployeeId` / `generateRandomContactNumber` with `DEPT_SEQUENCE` and `PLANTILLA_SEQUENCE` arrays. Replaced the `do-while` random generation loop with a deterministic index-based loop.
  - `server/prisma/seeds/04-sy-2026-2027/seed-transition.ts`: Removed `Math.random()` from tracking number generation; uses learner LRN or stable ID suffix.
- **The 'Why' (Business Justification):** `wipe` + `re-seed` must produce identical data every run for reproducible demos, stable regression baselines, and predictable QA scenarios.
- **Impact Radius:** Developer tooling only — no production data or API changes.

---

## 2026-05-15 - DPA Compliance + Learner Portal Isolation + TLE Intercept

### Learner Portal Isolation & Auth

- **Action:** Added / Modified
- **What Changed:**
  - Added `POST /api/auth/logout-learner` to independently terminate learner sessions.
  - Modified `POST /api/auth/learner-login` to set a dedicated `learner_session` cookie.
  - Updated `authenticate` middleware to support multi-cookie targets (staff vs learner).
- **The 'Why' (Business Justification):** Ensuring that parents/learners can manage their portal session without accidentally killing an active Registrar/Admin session on the same device.
- **Impact Radius:** Learner Portal frontend.

### DPA Compliance — Secure LRN Lookup

- **Action:** Modified
- **What Changed:**
  - Secured `GET /api/learner/lookup` with `HEAD_REGISTRAR` authorization.
  - Repurposed public "Returning Learner" flow on the landing page to a guided instruction screen.
- **The 'Why' (Business Justification):** Prevents unauthorized users from guessing LRNs and leaking Student PII (Names, Grades) on the public website (R.A. 10173).
- **Impact Radius:** Public Enrollment Site, Registrar Lookup.

### BOSY Digital Confirmation Wall & TLE Intercept

- **Action:** Added / Modified
- **What Changed:**
  - `POST /api/learner/confirm-return`: Now accepts `guardianName` and `tleProgramChoice2Id`.
  - Added `POST /api/learner/request-transfer`: Allows learners to signal intent to transfer out.
  - `GET /api/bosy/tle-programs`: Now public and requires `schoolYearId`; returns real-time `availableSlots`.
  - COMPLIANCE: Every confirmation now logs IP and User-Agent to the `AuditLog`.
- **The 'Why' (Business Justification):** Digitizes the physical confirmation slip and captures Grade 9 technical track choices upfront.
- **Impact Radius:** Learner Portal, TLE Admin.

### Data Integrity — Historical Enrollment Fix

- **Action:** Modified
- **What Changed:** Removed the forced `status: "ACTIVE"` filter from `findStudents` and `getStudentsSummary` services when a specific `schoolYearId` is provided.
- **The 'Why' (Business Justification):** Allows the system to correctly report total enrolled counts for past years, including students who have since graduated (`JHS_COMPLETER`).
- **Impact Radius:** **SMART**, **AIMS**. These systems now receive the correct student population when querying historical academic years.

