# Architecture Proposal
## Smart Academic Year Configuration Module
**For:** Hinigaran National High School — Admission & Enrollment System
**Author Role:** System Architect
**Bases On:** DepEd Order No. 12, s. 2025 · DepEd Order No. 03, s. 2018 (Basic Education Enrollment Policy)
**Status:** Proposal — Pending Team Approval Before PRD Integration

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

#### Phase Summary for Hinigaran NHS (Grade 7–12 only)

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

### 3.2 Revised Settings Page Layout

Replace the current 4-tab layout with a **5-panel single-scroll page** (no tabs required for navigation — panels are always visible, reducing the tab-switching overhead):

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚙  System Configuration                                         │
├──────────────────────────────────────────────────────────────────┤
│  Panel A │ School Profile       (logo, name)                     │
│  Panel B │ Academic Year Setup  ← REDESIGNED (see §3.3)          │
│  Panel C │ Curriculum Structure (grade levels, strands, matrix)  │
│  Panel D │ Sections & Capacity  (section CRUD, capacity map)     │
│  Panel E │ Enrollment Schedule  ← REDESIGNED (see §3.4)          │
└──────────────────────────────────────────────────────────────────┘
```

Each panel is a `Card` component — always visible on the page, no tab switching needed. The registrar scrolls vertically through the configuration. On desktop, Panels A–E are visible with a sticky left mini-nav for jump-links.

---

### 3.3 Panel B — Smart Academic Year Setup Card

This is the most significant redesign. Instead of a blank CRUD form, this panel is a **single intelligent card** that behaves differently based on whether a current year already exists.

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
// server/src/services/academicYearService.ts

export function deriveNextAcademicYear(today: Date): AcademicYearDefaults {
  const year = today.getMonth() >= 5   // June or later
    ? today.getFullYear()              // already in the new school year
    : today.getFullYear() - 1;         // still in the previous school year

  const nextStartYear = year + 1;
  const nextEndYear   = year + 2;

  // Class opening = first Monday of June of nextStartYear
  const classOpening = firstMondayOfJune(nextStartYear);

  // Class end = March 31 of nextEndYear
  const classEnd = new Date(nextEndYear, 2, 31); // Month is 0-indexed

  // Early Registration = last Saturday of January → last Friday of February
  const earlyRegOpen  = lastSaturdayOfJanuary(nextStartYear);
  const earlyRegClose = lastFridayOfFebruary(nextStartYear);

  // Regular Enrollment = 7 days before class opening
  const enrollOpen  = subDays(classOpening, 7);
  const enrollClose = subDays(classOpening, 1);

  return {
    yearLabel:      `${nextStartYear}–${nextEndYear}`,
    classOpening,
    classEnd,
    earlyRegOpen,
    earlyRegClose,
    enrollOpen,
    enrollClose,
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

### 3.4 Panel E — Two-Phase Enrollment Schedule (Replaces the Single Toggle)

The current enrollment gate is a single ON/OFF switch. This does not reflect DepEd's two-phase structure and forces the registrar to remember to manually open and close the portal at the right times.

The new Panel E is a **schedule-driven dual-phase gate** with manual override.

#### Panel E Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🗓  Enrollment Schedule              SY 2026–2027               │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  PHASE 1 · Early Registration                                    │
│  For: Grade 7, Grade 11, Transferees, First-time enrollees      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Opens   [  Jan 31, 2026  ]   Closes  [  Feb 27, 2026  ]  │ │
│  │  Status: ● OPEN  ════════════════════════╗                 │ │
│  │          Closes in  27 days, 14 hours    ║                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  PHASE 2 · Regular Enrollment                                    │
│  For: All grade levels                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Opens   [  May 26, 2026  ]   Closes  [  Jun 1, 2026   ]  │ │
│  │  Status: ○ SCHEDULED  ·  Opens in 116 days               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Manual Override    ○──● (OFF)   Force-open regardless of       │
│                                  schedule (emergency use only)  │
└─────────────────────────────────────────────────────────────────┘
```

#### How It Works

- **Dates are pre-filled automatically** from the `AcademicYear` record (computed in §3.3). The registrar does not type dates — they only adjust if their school deviates from the DepEd standard.
- **The portal (`/apply`) opens and closes automatically** based on the schedule. A Node.js cron job (`node-cron`) runs every 5 minutes and checks: `if (now >= phase1Open && now <= phase1Close) enrollmentOpen = true`.
- **Phase awareness in the admission form** — When Phase 1 is active, the admission form shows: *"Early Registration is open for incoming Grade 7, Grade 11, and transferees."* When Phase 2 is active, it shows the regular message. The `gradeLevel` dropdown is not filtered — the school may choose to accept all grades during Phase 1 — but the Phase label informs the applicant.
- **Manual override toggle** is available for emergencies (e.g., SDO extends the period). It bypasses the schedule and forces the portal open. A Sileo `warning` toast fires to confirm the override is active.

#### Enrollment Schedule Status Values

| Status | Visual | Meaning |
|---|---|---|
| `SCHEDULED` | Grey dot + "Opens in X days" | Upcoming; portal closed |
| `OPEN` | Green dot + "Closes in X days" | Portal is live |
| `CLOSED` | Red badge | Period has passed |
| `EXTENDED` | Orange badge | Manual override active |

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
// Addition to the AcademicYear model in server/prisma/schema.prisma

model AcademicYear {
  id             Int      @id @default(autoincrement())
  yearLabel      String   @unique           // e.g. "2026–2027"
  isActive       Boolean  @default(false)

  // ── DepEd Calendar Dates (auto-computed; editable) ──
  classOpeningDate  DateTime               // First Monday of June
  classEndDate      DateTime               // March 31

  // ── Phase 1: Early Registration ─────────────────────
  earlyRegOpenDate  DateTime               // Last Saturday of January
  earlyRegCloseDate DateTime               // Last Friday of February

  // ── Phase 2: Regular Enrollment ─────────────────────
  enrollOpenDate    DateTime               // 7 days before classOpeningDate
  enrollCloseDate   DateTime               // 1 day before classOpeningDate

  // ── Manual Override ──────────────────────────────────
  manualOverrideOpen Boolean @default(false)  // Force-open regardless of schedule

  createdAt      DateTime @default(now())

  // (existing relations remain unchanged)
  gradeLevels    GradeLevel[]
  strands        Strand[]
  applicants     Applicant[]
  enrollments    Enrollment[]
  SchoolSettings SchoolSettings[]
}
```

**SchoolSettings.enrollmentOpen is deprecated.** The enrollment open state is now derived at runtime from the `AcademicYear` date fields — it is never stored as a boolean flag. The API computes it:

```ts
// server/src/services/enrollmentGateService.ts

export function isEnrollmentOpen(year: AcademicYear): boolean {
  if (year.manualOverrideOpen) return true;
  const now = new Date();
  const inPhase1 = now >= year.earlyRegOpenDate && now <= year.earlyRegCloseDate;
  const inPhase2 = now >= year.enrollOpenDate   && now <= year.enrollCloseDate;
  return inPhase1 || inPhase2;
}

export function getEnrollmentPhase(year: AcademicYear): 'EARLY_REGISTRATION' | 'REGULAR_ENROLLMENT' | 'CLOSED' | 'OVERRIDE' {
  if (year.manualOverrideOpen) return 'OVERRIDE';
  const now = new Date();
  if (now >= year.earlyRegOpenDate && now <= year.earlyRegCloseDate) return 'EARLY_REGISTRATION';
  if (now >= year.enrollOpenDate   && now <= year.enrollCloseDate)   return 'REGULAR_ENROLLMENT';
  return 'CLOSED';
}
```

The cron job is lightweight — it only needs to invalidate a cache key, not write to the database:

```ts
// server/src/jobs/enrollmentGateCron.ts
import cron from 'node-cron';
import { broadcastGateStatus } from '../services/enrollmentGateService.ts';

// Runs every 5 minutes — checks active year and updates in-memory gate status
cron.schedule('*/5 * * * *', broadcastGateStatus);
```

---

## 5. Revised API Additions

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/academic-years/next-defaults` | JWT (REGISTRAR) | Returns auto-computed Smart Defaults for the next SY (year label, all dates) |
| `POST` | `/api/academic-years/activate` | JWT (REGISTRAR) | Creates + activates a year using smart defaults (with optional clone flags) |
| `GET` | `/api/settings/public` | None | Now returns `enrollmentPhase` (`EARLY_REGISTRATION` \| `REGULAR_ENROLLMENT` \| `CLOSED` \| `OVERRIDE`) instead of a boolean |
| `PATCH` | `/api/academic-years/:id/override` | JWT (REGISTRAR) | Toggle manual override ON/OFF |
| `PATCH` | `/api/academic-years/:id/dates` | JWT (REGISTRAR) | Update any of the 4 date window fields (for SDO-approved deviations) |

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

## 7. Summary of Proposed Changes to §6.4 in the PRD

| Current | Proposed Replacement |
|---|---|
| Tab 2: CRUD table for Academic Year (blank form) | Panel B: Smart Year Setup Card with auto-computed DepEd defaults |
| Tab 4: Single `enrollmentOpen` boolean toggle | Panel E: Two-Phase Enrollment Schedule with auto-open/close and manual override |
| `SchoolSettings.enrollmentOpen` boolean column | Derived runtime from `AcademicYear` date fields |
| No concept of Early Registration vs. Regular Enrollment | Phase-aware gate exposed in the public API and admission form UI |
| Grades and strands re-entered manually every year | One-click clone from previous year (checkboxes) |

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