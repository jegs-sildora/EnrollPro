# Architecture Proposal
## Smart Academic Year Configuration Module
**For:** Web-Based School Admission, Enrollment & Information Management System
**Author Role:** System Architect
**Bases On:** DepEd Order No. 12, s. 2025 · DepEd Order No. 03, s. 2018 (Basic Education Enrollment Policy)
**Aligned With:** PRD v3.0.0
**Status:** Integrated into PRD — reference document retained for architecture rationale

---

## 1. Research Foundation — DepEd School Year Reality

Before designing any UI, the system must be built around how DepEd *actually* operates the school year. The calendar is not arbitrary — it is legally mandated and highly predictable, which means the system can be designed to **know the rules in advance** and eliminate manual data entry.

### 1.1 School Year Calendar (RA 7797, as amended by RA 11480)

| Calendar Milestone | Fixed Rule | Concrete Date (SY 2025–2026) |
|---|---|---|
| **School Year Label** | `YYYY–YYYY` format, always spans two calendar years | `2025–2026` |
| **Class Opening** | First Monday of June | June 16, 2025 |
| **Class End** | March 31 of the following year | March 31, 2026 |
| **Total Class Days** | Not more than 220; typically ~197 | 197 days |
| **Summer Break** | April 1 – last Sunday before June opening | April 1 – June 15, 2026 |
| **Christmas Break** | December 20 – January 4 | Dec 20, 2025 – Jan 4, 2026 |

> **Source:** DepEd Order No. 12, s. 2025 — Multi-Year Implementing Guidelines on the School Calendar and Activities

### 1.2 Two-Phase Enrollment Structure (DepEd Order No. 03, s. 2018)

DepEd does not have a single enrollment period. It has **two legally distinct phases**:

#### Phase 1: Early Registration
| Attribute | Rule |
|---|---|
| **Who it covers** | Incoming Grade 7, Grade 11, transferees to public schools, first-time enrollees |
| **Who is excluded** | Grades 8–10 and Grade 12 (they are automatically "pre-registered") |
| **When it happens** | Last Saturday of January → Last Friday of February, every year |
| **SY 2026–2027 dates** | January 31, 2026 → February 27, 2026 |
| **Purpose** | Schools forecast needs: classrooms, teachers, materials |
| **Legal basis** | DepEd Order No. 03, s. 2018; reinforced by DepEd Order No. 17, s. 2025 |

#### Phase 2: Regular Enrollment
| Attribute | Rule |
|---|---|
| **Who it covers** | All grade levels; pre-registered students confirm; new students finalize |
| **When it happens** | One week before the official opening of classes |
| **SY 2025–2026 dates** | ~June 9–13, 2025 (coincides with Brigada Eskwela week) |
| **Purpose** | Official enrollment of record; students become officially enrolled |
| **Legal basis** | DepEd Order No. 12, s. 2025, §6.b |

#### Phase Summary (Grade 7–12 only)

```
JANUARY              FEBRUARY             MARCH–MAY     JUNE
─────────────────────────────────────────────────────────────────────
[  EARLY REGISTRATION  ]                               [ENROLLMENT]  [CLASSES OPEN]
Last Sat Jan → Last Fri Feb                            -1 week        First Mon June
(Grade 7, Grade 11, Transferees)                       (All grades)
```

### 1.3 Key Implication for System Design

Because the DepEd calendar is **legally fixed and annually predictable**, the system already knows:
- What the next year label should be
- When Early Registration opens and closes
- When Regular Enrollment opens and closes
- When classes start and end
- Which grade levels need Early Registration vs. which are pre-registered

**The registrar should not have to type or configure any of this from scratch.** The system should derive it automatically and ask only for confirmation.

---

## 2. Current UX Audit — Problems Identified

The current §6.4 in the PRD (v2.2.0) has four tabs: School Identity, Academic Year (CRUD), Grade Levels & Strands, Enrollment Gate. Below is an honest click-count audit for the most common annual task: **setting up a new school year**.

### Task: "Set up SY 2026–2027 before January early registration"

| Step | Current System | Clicks |
|---|---|---|
| 1 | Navigate to Settings → Tab 2 (Academic Year) | 2 |
| 2 | Click "Create New" | 1 |
| 3 | Type year label "2026–2027" | _(typing)_ |
| 4 | Save | 1 |
| 5 | Navigate to Tab 3 (Grade Levels) | 1 |
| 6 | Create Grade 7 | 2 (click + save) |
| 7 | Create Grade 8 | 2 |
| 8 | Create Grade 9 | 2 |
| 9 | Create Grade 10 | 2 |
| 10 | Create Grade 11 | 2 |
| 11 | Create Grade 12 | 2 |
| 12 | Create Strand: STEM + assign grades | 3 |
| 13 | Create Strand: ABM + assign grades | 3 |
| 14 | Create Strand: HUMSS + assign grades | 3 |
| 15 | Create Strand: GAS + assign grades | 3 |
| 16 | Navigate to Tab 4 (Enrollment Gate) | 1 |
| 17 | Toggle gate ON | 1 |
| 18 | Save | 1 |
| **Total** | | **~32 clicks + repetitive typing** |

This is the single most common annual administrative task — and it takes 30+ clicks with no smart defaults, no date awareness, and full re-entry of data that was entered identically last year.

---

## 3. Proposed Architecture — Smart Academic Year Setup

### 3.1 Core Design Philosophy

> **"The system knows DepEd's rules. The registrar only confirms."**

Three UX principles drive the redesign:

1. **Smart Defaults** — Pre-fill everything the system can compute from DepEd rules. Registrar edits only the exceptions.
2. **Progressive Disclosure** — Show complexity only when the registrar opts into it. The simple path is one screen, one click.
3. **Phase-Aware Gate** — Replace the single enrollment toggle with a two-phase schedule that mirrors DepEd's actual structure.

---

### 3.2 Revised Settings Page Layout (PRD v3.0.0 — 4 Tabs)

The PRD v3.0.0 implements Settings as **4 tabs** using shadcn/ui `Tabs`, all on the `/settings` route:

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚙  Settings                                                      │
├──────────────────────────────────────────────────────────────────┤
│  Tab 1 │ School Profile      (name, school ID, division,         │
│         │                      region, logo upload)               │
│  Tab 2 │ Academic Year        ← smart auto-fill (see §3.3)       │
│  Tab 3 │ Grade Levels, Strands & SCP Programs                    │
│         │   ├─ Grade Levels CRUD                                  │
│         │   ├─ Strands/Clusters (DM 012)                         │
│         │   └─ SCP Programs CRUD (school-configured)             │
│  Tab 4 │ Enrollment Gate      (enrollmentOpen toggle)            │
└──────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Tab 2 — Smart Academic Year Setup (Auto-Fill)

This is the most significant redesign. Instead of a blank CRUD form, this tab uses a **smart auto-fill** that pre-calculates DepEd dates when the registrar types a year label.

#### State 1: No Year Configured Yet (First-Time Setup)

The card renders with every field **pre-filled** using DepEd rules computed from the current server date:

```
┌─────────────────────────────────────────────────────────┐
│  📅  Academic Year Setup                                  │
│  ─────────────────────────────────────────────────────  │
│  System detected: You have no active academic year.      │
│  We've pre-filled the fields based on DepEd's calendar.  │
│                                                         │
│  School Year Label    [  2026 – 2027  ]  ← auto-filled  │
│  Class Opening        [  June 2, 2026  ] ← auto-filled  │
│  Class End            [  March 31, 2027] ← auto-filled  │
│                                                         │
│  ┌─ Clone from previous year? ─────────────────────┐   │
│  │  ☑  Grade Levels (Grade 7–12)                   │   │
│  │  ☑  Strand names (STEM, ABM, HUMSS, GAS)        │   │
│  │  ☑  Section names (without student assignments) │   │
│  │  ☐  Section capacities                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [  Activate This Year  ]  (primary button, 1 click)    │
└─────────────────────────────────────────────────────────┘
```

**What the system auto-computes:**

```ts
// server/src/services/academicYearService.ts — aligned with PRD v3.0.0 schema field names

export function deriveNextAcademicYear(today: Date): AcademicYearDefaults {
  const year = today.getMonth() >= 5   // June or later
    ? today.getFullYear()              // already in the new school year
    : today.getFullYear() - 1;         // still in the previous school year

  const nextStartYear = year + 1;
  const nextEndYear   = year + 2;

  // Class start = first Monday of June of nextStartYear
  const classStart = firstMondayOfJune(nextStartYear);

  // Class end = March 31 of nextEndYear
  const classEnd = new Date(nextEndYear, 2, 31); // Month is 0-indexed

  // Phase 1: Early Registration = last Saturday of January → last Friday of February
  const phase1Start = lastSaturdayOfJanuary(nextStartYear);
  const phase1End   = lastFridayOfFebruary(nextStartYear);

  // Phase 2: Regular Enrollment = 7 days before class opening
  const phase2Start = subDays(classStart, 7);
  const phase2End   = subDays(classStart, 1);

  return {
    yearLabel:   `${nextStartYear}-${nextEndYear}`,
    classStart,
    classEnd,
    phase1Start,
    phase1End,
    phase2Start,
    phase2End,
  };
}
```

The frontend calls `GET /api/academic-years/next-defaults` on Panel B mount and **populates every field immediately** — the registrar sees a fully-formed setup card, not a blank form.

#### State 2: Active Year Exists (Annual Rollover)

When an active year is already set, the card shows a compact **year status banner** (current year) plus a **"Prepare Next Year"** secondary action that expands the same smart setup card. This means the registrar does not accidentally overwrite the running year.

```
┌─────────────────────────────────────────────────────────┐
│  📅  Academic Year                                        │
│                                                         │
│  ● ACTIVE   2025–2026                                    │
│  Classes: June 16, 2025 → March 31, 2026                │
│  Enrolled: 1,243 students   Sections: 24                 │
│                                                         │
│  [ Prepare SY 2026–2027 ▾ ]   (expands the setup card)  │
└─────────────────────────────────────────────────────────┘
```

#### Click Count After Redesign

| Step | New System | Clicks |
|---|---|---|
| 1 | Open Settings page (Panel B is already visible) | 0 (it's on the page) |
| 2 | Review pre-filled year label, dates, clone options | _(reading)_ |
| 3 | Toggle "Clone from previous year" checkboxes if needed | 0–3 |
| 4 | Click "Activate This Year" | **1** |
| **Total** | | **1–4 clicks** vs. previous 32 |

---

### 3.4 Tab 4 — Enrollment Gate (Manual Toggle)

Per PRD v3.0.0, the enrollment gate is a **manual toggle** (`SchoolSettings.enrollmentOpen`). The registrar toggles it ON when the enrollment period opens and OFF when it closes. The phase dates stored on `AcademicYear` serve as reference information — they remind the registrar of DepEd's schedule but do not automatically control the gate.

#### Tab 4 Layout (per PRD v3.0.0)

```
┌────────────────────────────────────────────────────────────────┐
│  Enrollment Gate                                                │
│                                                                │
│  ────●────────  ON                                             │
│  Status:  ● OPEN  (green badge)                                │
│                                                                │
│  The public admission portal is currently LIVE at:             │
│  https://[school-domain]/apply                                 │
│                                                                │
│  Toggle OFF to close the portal. Visitors will be             │
│  redirected to the "Enrollment Closed" page.                   │
│                                                                │
│  Note: The F2F admission route (/f2f-admission) is            │
│  unaffected by this gate — registrars can enter walk-in       │
│  applications regardless of the toggle state.                  │
└────────────────────────────────────────────────────────────────┘
```

#### How It Works

- **Phase dates are auto-filled** when creating a new Academic Year. The registrar confirms or adjusts before saving.
- **The portal (`/apply`) opens and closes based on the manual toggle.** The React Router loader on `/apply` calls `GET /api/settings/public` on every page load — if `enrollmentOpen = false`, it redirects to `/closed`.
- **F2F admission bypasses the gate entirely.** The `/f2f-admission` route is always accessible to REGISTRAR and SYSTEM_ADMIN, regardless of the toggle state (PRD v3.0.0 §6.2).
- **Phase awareness** — When Phase 1 dates are active, the admission form can show: *"Early Registration is open for incoming Grade 7, Grade 11, and transferees."* This is informational; the gate logic remains the manual toggle.

#### Enrollment Gate Toggle States (per PRD v3.0.0)

| State | Visual | Public Portal Behavior |
|---|---|---|
| OFF | `● CLOSED` red badge | `/apply` redirects to `/closed` via React Router loader |
| ON | `● OPEN` green badge | `/apply` renders the full admission form |

---

### 3.5 Pre-registration Awareness — Reducing Applicant Confusion

Since DepEd policy states Grades 8–10 and Grade 12 students are **automatically pre-registered** (they are returning students at the same school), the admission portal should reflect this:

- When Phase 1 (Early Registration) is active, the Grade Level selector shows a helper message:

  > *"Grades 8–10 and Grade 12 are pre-registered. This form is for incoming Grade 7, Grade 11, transferees, and first-time enrollees only."*

- If a continuing student (Grade 8–10 or 12) attempts to submit, the form can warn them instead of hard-blocking, since transferees at those levels are still valid applicants.

This is a **zero-click improvement** — the UI explains the rule, reducing phone calls to the school.

---

## 4. Revised Database Schema Additions

The current Prisma schema needs the following additions to support the two-phase gate and smart defaults:

```prisma
// AcademicYear model in server/prisma/schema.prisma — aligned with PRD v3.0.0

model AcademicYear {
  id             Int      @id @default(autoincrement())
  yearLabel      String   @unique           // e.g. "2025-2026"
  isActive       Boolean  @default(false)

  // ── DepEd Calendar Dates (auto-computed on create; editable) ──
  classStart     DateTime?                 // First Monday of June
  classEnd       DateTime?                 // March 31

  // ── Phase 1: Early Registration ─────────────────────
  phase1Start    DateTime?                 // Last Saturday of January
  phase1End      DateTime?                 // Last Friday of February

  // ── Phase 2: Regular Enrollment ─────────────────────
  phase2Start    DateTime?                 // ~7 days before classStart
  phase2End      DateTime?                 // ~1 day before classStart

  createdAt      DateTime @default(now())

  gradeLevels    GradeLevel[]
  strands        Strand[]
  scpPrograms    ScpProgram[]
  applicants     Applicant[]
  enrollments    Enrollment[]
  SchoolSettings SchoolSettings[]
}
```

**`SchoolSettings.enrollmentOpen` remains the runtime gate.** The PRD v3.0.0 retains this boolean toggle (Settings Tab 4 — Enrollment Gate). The phase dates on `AcademicYear` serve as a reference for the registrar, who manually toggles the gate according to DepEd's schedule. The system auto-fills dates as smart defaults when creating an academic year.

```ts
// server/src/services/enrollmentGateService.ts — reference helper for phase awareness

export function getEnrollmentPhase(year: AcademicYear): 'EARLY_REGISTRATION' | 'REGULAR_ENROLLMENT' | 'CLOSED' {
  const now = new Date();
  if (year.phase1Start && year.phase1End && now >= year.phase1Start && now <= year.phase1End) {
    return 'EARLY_REGISTRATION';
  }
  if (year.phase2Start && year.phase2End && now >= year.phase2Start && now <= year.phase2End) {
    return 'REGULAR_ENROLLMENT';
  }
  return 'CLOSED';
}
```

**Note:** Per PRD v3.0.0, the enrollment gate is a manual toggle (`SchoolSettings.enrollmentOpen`), not an automated schedule. The phase dates serve as smart defaults and reference information for the registrar. No cron job is needed for gate management.

---

## 5. Revised API Additions

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/academic-years` | JWT (REGISTRAR, SYSTEM_ADMIN) | List all academic years |
| `POST` | `/api/academic-years` | JWT (REGISTRAR, SYSTEM_ADMIN) | Create AY with auto-calculated dates from year label |
| `PUT` | `/api/academic-years/:id` | JWT (REGISTRAR, SYSTEM_ADMIN) | Update AY dates or label |
| `PATCH` | `/api/academic-years/:id/activate` | JWT (REGISTRAR, SYSTEM_ADMIN) | Set as active (deactivates all others in one transaction) |
| `GET` | `/api/settings/public` | None | Returns school name, logo, colorScheme, `enrollmentOpen`, active AY |
| `PATCH` | `/api/settings/enrollment-gate` | JWT (REGISTRAR, SYSTEM_ADMIN) | Toggle `enrollmentOpen` ON/OFF |

---

## 6. Click Count Comparison — Before vs. After

| Task | Current PRD (v2.2.0) | Proposed Architecture |
|---|---|---|
| Set up a new academic year | ~32 clicks + typing | **1–4 clicks** (review + confirm) |
| Open enrollment for Early Registration | Manual toggle (1 click, but must remember the date) | **0 clicks** (automatic on schedule) |
| Open enrollment for Regular Enrollment | Manual toggle again | **0 clicks** (automatic on schedule) |
| Close enrollment | Manual toggle | **0 clicks** (automatic) |
| Emergency manual override | Not supported | **1 click** |
| Change enrollment dates for SDO extension | Not supported | **Edit date field + save (2 clicks)** |

---

## 7. Summary — How This Architecture Aligns with PRD v3.0.0

| Architecture Proposal | PRD v3.0.0 Implementation |
|---|---|
| Smart Year Setup Card with auto-computed DepEd defaults | Tab 2 (Academic Year): Smart Auto-Fill when year label is typed — auto-calculates all dates (§6.8) |
| Two-Phase Enrollment Schedule with auto-open/close | Phase dates stored on `AcademicYear` as reference; manual `enrollmentOpen` toggle in Tab 4 (§6.8) |
| Derived runtime enrollment state from date fields | `enrollmentOpen` remains on `SchoolSettings` as the authoritative gate (§6.8, §6.1) |
| Phase-aware gate exposed in the public API and admission form UI | Phase dates serve as registrar reference; F2F route bypasses gate entirely (§6.2) |
| Grades and strands re-entered manually every year | School-agnostic: grade levels, strands, SCP programs are CRUD per academic year (§6.8 Tab 3) |

---

## 8. Decision Required

Before this proposal is merged into the PRD, please confirm the following:

| # | Decision Point | Options |
|---|---|---|
| D-01 | Should the system hard-filter the Grade Level dropdown during Phase 1 to only show Grade 7 and Grade 11? | A) Filter (strict) · B) Show all with a helper warning (lenient, recommended) |
| D-02 | Should Grades 8–10 and Grade 12 be completely blocked from submitting the online admission form during Phase 1? | A) Block with error · B) Allow with a confirmation prompt · C) Allow freely |
| D-03 | Who should be able to edit the auto-computed enrollment dates? | A) Registrar (flexible) · B) No one — enforce DepEd dates strictly |

---

*Proposal prepared by: System Architect*
*Based on: DepEd Order No. 12 s. 2025, DepEd Order No. 03 s. 2018, RA 7797 as amended by RA 11480*
*Ready to integrate into PRD once decisions in §8 are confirmed.*

---

---

## ADDENDUM — Impact of DM 012, s. 2026 on the School Year Setup Architecture

**Governing Memorandum:** DepEd Memorandum No. 012, s. 2026 — Full Implementation of the Strengthened Senior High School Curriculum in School Year 2026–2027
**Issued:** February 27, 2026
**Source:** https://www.deped.gov.ph/2026/02/27/february-27-2026-dm-012-s-2026-full-implementation-of-the-strengthened-senior-high-school-curriculum-in-school-year-2026-2027/

---

### What DM 012 Changes About SHS Configuration

The Strengthened SHS Curriculum eliminates traditional strands (STEM, ABM, HUMSS, GAS, TVL variants) for **incoming Grade 11 learners starting SY 2026–2027**. Grade 12 learners in SY 2026–2027 continue under the old strand-based system as a transition measure.

This creates a **dual-policy SHS configuration requirement** that the Settings module must support simultaneously within the same academic year.

---

### Revised Panel C — Curriculum Structure (SY 2026–2027 and beyond)

The existing `Strand` model in the system remains valid but must be expanded to accommodate two concurrent systems:

#### What the Registrar configures in Settings for SY 2026–2027

**For Grade 11 (new Strengthened SHS Curriculum):**

Instead of configuring strands like `STEM`, `ABM`, `HUMSS`, `GAS`, the registrar now configures:

**Track entries** (two fixed options, not CRUD-able — they are mandated by DepEd):
- `Academic`
- `Technical-Professional (TechPro)`

**Elective Cluster entries** (school-specific — only configure clusters the school actually offers):

| Cluster Name | Track | School Offers? |
|---|---|---|
| STEM | Academic | Configure if offered |
| Arts, Social Sciences, and Humanities | Academic | Configure if offered |
| Sports, Health, and Wellness | Academic | Configure if offered |
| Business and Entrepreneurship | Academic | Configure if offered |
| Field Experience | Academic | Configure if offered |
| ICT Support and Computer Programming | TechPro | Configure if offered |
| Hospitality and Tourism | TechPro | Configure if offered |
| Construction and Building Technologies | TechPro | Configure if offered |
| Industrial Technologies | TechPro | Configure if offered |
| *(and other TechPro clusters per school capacity)* | TechPro | — |

**For Grade 12 (old strand-based curriculum — SY 2026–2027 only):**

The registrar retains the old strand entries for Grade 12 sections:
- STEM (Grade 12 only)
- ABM (Grade 12 only)
- HUMSS (Grade 12 only)
- GAS (Grade 12 only)

> **Design implication:** The existing `Strand` model's `applicableGradeLevelIds` field handles this naturally. Old strands are linked only to `Grade 12`; new elective clusters are linked only to `Grade 11`. The grade-level filter on the admission portal correctly shows the right options per grade.

---

### Updated Click-Count for SY 2026–2027 Setup (Revised from §2)

The original click-count audit in §2 was based on creating 4 strands (STEM, ABM, HUMSS, GAS). Under DM 012 for SY 2026–2027, the Registrar must now configure:

- **Grade 11:** 2 tracks + N elective clusters (school-dependent; a typical school offering STEM + ICT + HE = 3 clusters across 2 tracks)
- **Grade 12:** Same 4 old strands (for Grade 12 continuation only)

This means slightly **more configuration items** in the first year of transition, but subsequent years (when Grade 12 is also on the new system) will be simpler.

**Revised click count for SY 2026–2027 setup under the Smart Year Setup Card proposal:**

| Step | Current System | Smart Setup (proposed) |
|---|---|---|
| Create Academic Year | 2 + typing | 1 (review + confirm) |
| Grade Levels | 6 × 2 = 12 | Cloned automatically |
| Grade 12 Strands (old) | 4 × 3 = 12 | Cloned automatically |
| Grade 11 Tracks (new) | 2 × 2 = 4 | Template-assisted (pre-filled from DM 012) |
| Grade 11 Elective Clusters | N × 2 = N×2 | Checklist from DM 012 master list |
| Activate year | 2 | 1 |
| **Total** | **~40+ clicks** | **~5–10 clicks** |

---

### Updated Section Naming Conventions (Panel D — Sections & Capacity)

Under the new curriculum, SHS sections for Grade 11 are no longer named by strand. The registrar has two common options:

**Option A — Track-level sections (simpler, fewer sections):**
```
Grade 11 – Academic-A     (all Academic track learners mixed)
Grade 11 – Academic-B
Grade 11 – TechPro-A      (all TechPro track learners mixed)
Grade 11 – TechPro-B
```

**Option B — Cluster-focused sections (mirrors old strand naming):**
```
Grade 11 – STEM-A         (Academic track, STEM cluster focus)
Grade 11 – BusEnt-A       (Academic track, Business and Entrepreneurship focus)
Grade 11 – ICT-A          (TechPro track, ICT cluster)
Grade 11 – HospTour-A     (TechPro track, Hospitality and Tourism)
```

**Grade 12 sections remain unchanged (old strand labels):**
```
Grade 12 – STEM-A         (continues old STEM strand)
Grade 12 – ABM-A          (continues old ABM strand)
Grade 12 – HUMSS-A        (continues old HUMSS strand)
Grade 12 – GAS-A          (continues old GAS strand)
```

> The system's section naming is free-text — the registrar types whatever naming convention the school adopts. No system change is required to support either option above.

---

### Updated Revised API Additions (§5 Extension)

One additional endpoint is needed to serve the DM 012 dual-policy context to the public portal:

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/scp-programs?gradeLevelId=` | None (public) | Returns active SCP programs for the given grade level in the active AY — drives the admission form dynamically |
| `GET` | `/api/scp-programs/all` | JWT (REGISTRAR, SYSTEM_ADMIN) | All SCP programs for active AY (including inactive) |
| `POST` | `/api/scp-programs` | JWT (REGISTRAR, SYSTEM_ADMIN) | Create SCP program config |
| `PUT` | `/api/scp-programs/:id` | JWT (REGISTRAR, SYSTEM_ADMIN) | Update SCP program |
| `PATCH` | `/api/scp-programs/:id/toggle` | JWT (REGISTRAR, SYSTEM_ADMIN) | Activate / deactivate |

The public admission form uses `GET /api/scp-programs?gradeLevelId=X` to dynamically render SCP options. **No hardcoded SCP list exists in the frontend** — a school that does not offer SPA simply has no SPA entry in the database, and the form shows no SPA option.

---

### Decision Required (Addendum to §8)

| # | Decision Point | Options |
|---|---|---|
| D-04 | How should the school name Grade 11 sections for SY 2026–2027? | A) Track-level (Academic-A, TechPro-A) · B) Cluster-focused (STEM-A, ICT-A) |
| D-05 | Which TechPro elective clusters will the school offer in SY 2026–2027? | Registrar/School Head to confirm based on available equipment, teachers, TESDA accreditation |
| D-06 | Should the system expose both "Track" and "Elective Cluster" as separate fields on the BEEF form, or collapse them into a single "Program" selector? | A) Two separate selectors (accurate, mirrors DepEd structure) · B) Single combined selector (simpler UX) |
| D-07 | For Grade 12 transferees in SY 2026–2027 applying through the portal: should the form show the old strand options or the new cluster options? | A) Old strands only (Grade 12 is on old curriculum) · B) Both, conditionally based on grade level selected |

---

*Addendum prepared by: System Architect*
*Based on: DepEd Memorandum No. 012, s. 2026 — Strengthened SHS Curriculum (February 27, 2026)*
*Source: https://www.deped.gov.ph/2026/02/27/february-27-2026-dm-012-s-2026-full-implementation-of-the-strengthened-senior-high-school-curriculum-in-school-year-2026-2027/*


---

---

## ADDENDUM — Special Curricular Program (SCP) Configuration in System Setup
**Research Basis:** DepEd Memorandum No. 149, s. 2011 · PRD v2.4.0
**Document Version:** School Year Setup Architecture v2.4.0

---

### SCP Configuration as Part of Annual School Year Setup

The introduction of the two-path admission system (Open Admission + SCP) means the **Panel C — Curriculum Structure** and **Panel D — Sections & Capacity** in Settings must now also capture which SCPs the school offers, so the admission portal and registrar workflow can correctly route applicants.

---

### Updated Panel C — Curriculum Structure (SCP Addition)

Panel C is extended to include an SCP configuration block alongside the existing Grade Level and Strand/Cluster management:

```
SETTINGS > Panel C: Curriculum Structure        Year: [ SY 2026–2027 ▾ ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GRADE LEVELS
 (unchanged — Grade 7 through Grade 12 CRUD list)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPECIAL CURRICULAR PROGRAMS (JHS — Grade 7)
 Check programs offered by this school:

 ☑  Science, Technology & Engineering (STE)
      Cut-off score: [ 75.0 ]   Exam date: [ Feb 22, 2027  📅 ]

 ☑  Special Program in the Arts (SPA)
      Art Fields: [ ☑ Dance  ☑ Visual Arts  ☐ Theatre  ☑ Music ]
      Audition date: [ Mar 8, 2027  📅 ]

 ☐  Special Program in Sports (SPS)
 ☐  Special Program in Journalism (SPJ)
 ☐  Special Program in Foreign Language (SPFL)
 ☐  Special Program in Technical-Vocational Education (SPTVE)

                                              [ Save SCP Config ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GRADE 11 SHS TRACKS (unchanged from DM 012 addendum)
 Grade 11 Elective Clusters · Grade 12 Old Strands
```

**SCP configuration drives the admission portal:** When the admission portal loads, it calls `GET /api/scp-programs?gradeLevelId=X` and shows only the active SCP programs the school has configured for that grade level. If SPS is not configured in the database, it does not appear as an option in the applicant's form. This is fully school-agnostic — no SCP program is hardcoded.

---

### New Database Model — `ScpProgram` (aligned with PRD v3.0.0)

```prisma
// server/prisma/schema.prisma — from PRD v3.0.0

model ScpProgram {
  id                Int          @id @default(autoincrement())
  code              String       // e.g. "STE", "SPA", "SPS", "SPJ", "SPFL", "SPTVE"
  name              String       // Full program name for display
  applicableGradeLevelIds Int[]  // which grade levels can apply
  assessmentType    String       // "EXAM_ONLY" | "EXAM_AUDITION" | "AUDITION_ONLY" | "APTITUDE" | "NAT_REVIEW"
  requiresInterview Boolean      @default(false)
  academicYearId    Int
  isActive          Boolean      @default(true)
  createdAt         DateTime     @default(now())

  academicYear      AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
}
```

> **Note:** The old `ScpConfig` model proposed in the original architecture addendum has been replaced by `ScpProgram` in PRD v3.0.0. SCP programs are now fully configurable per academic year with CRUD operations in Settings Tab 3 (SCP Programs sub-tab). Schools add only the programs they offer — a school with no SCP programs simply leaves the sub-tab empty and no SCP fields appear in the admission form.

---

### Updated Click-Count for SY 2026–2027 Setup (Including SCP)

| Step | Action | Clicks |
|---|---|---|
| Create Academic Year | Review smart defaults + confirm | 1 |
| Grade Levels | Cloned from previous year | 0 |
| SHS Elective Clusters | Checklist (DM 012) | 3–5 |
| Grade 12 Old Strands | Cloned | 0 |
| **SCP Config (new)** | Check offered SCPs + enter cut-off + exam date | 5–8 |
| Sections (STE/SPA named) | Create SCP-specific sections | 4–6 |
| Activate Year | 1 click | 1 |
| **Total** | | **~15–22 clicks** (vs. original ~40+) |

---

### Updated Decision Required (§8 Extension)

| # | Decision Point | Options |
|---|---|---|
| D-08 | Which SCPs does the school currently offer? | Registrar/School Head to confirm — determines which checkboxes are enabled in Panel C |
| D-09 | For STE: is the cut-off score set by the SDO or by the school? | A) SDO-set (registrar inputs after division memo is released) · B) School-set (configurable in Settings) |
| D-10 | For SPA: does the school offer all art fields or only specific ones? | Registrar/School Head to specify which art fields are assessed during the audition |
| D-11 | Should failed SCP applicants be automatically offered a regular section in the system, or does the registrar handle this manually per case? | A) Automatic offer prompt (recommended) · B) Manual — registrar decides per applicant |

---

*Addendum to School Year Setup Architecture*
*Based on: DepEd Memorandum No. 149, s. 2011 · PRD v3.0.0*