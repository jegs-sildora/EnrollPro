# Registrar & Enrollment Clerk — Complete System Storyboard
## Hinigaran National High School
## Web-Based Admission Portal & Enrollment Information Management System

**Document Type:** Full Workflow Storyboard — All Scenarios, All Screens
**Primary Actor:** School Registrar / Enrollment Clerk (role: `REGISTRAR`)
**Supporting Actor:** Advising Teacher (role: `TEACHER`)
**Policy Basis:** DepEd Order No. 017, s. 2025 — Revised Basic Education Enrollment Policy
**System Reference:** PRD v2.2.0 (PERN Stack — PostgreSQL · Express · React · Node.js)

---

## How to Read This Document

Each scene follows a consistent anatomy:

```
SCENE [X.Y] — Title
┌─────────────────────────────────────────────────────────────────┐
│ WHEN      │ Real-world time / calendar context                  │
│ WHERE     │ System screen / URL                                 │
│ WHY       │ What triggers this workflow                         │
│ POLICY    │ Relevant DepEd rule governing this action           │
└─────────────────────────────────────────────────────────────────┘

What the registrar sees on screen — exact UI description.
What the registrar does — numbered step-by-step actions.
What the system does — API calls, DB writes, emails, toasts.
Outcome — final system state after this scene.
Branch points — what happens in alternate / edge cases.
```

Scenes are organized into **six acts** that map to the real DepEd school year:

| Act | Title | Real-World Period |
|---|---|---|
| **Act 0** | System Setup & Annual Rollover | April–January (off-peak preparation) |
| **Act 1** | Phase 1 — Early Registration | Last Saturday of January → Last Friday of February |
| **Act 2** | Phase 2 — Regular Enrollment | ~1 week before class opening in June |
| **Act 3** | Active School Year — Ongoing Operations | June → March (transferees, late, management) |
| **Act 4** | SHS Second Semester | December–January |
| **Act 5** | End of Year & Archival | March–April |

---

## The Full Annual Calendar for This System

```
JANUARY         FEBRUARY        MARCH    APRIL–DECEMBER       JANUARY      FEBRUARY       MARCH
────────────────────────────────────────────────────────────────────────────────────────────────
│◄──── PHASE 1: EARLY REGISTRATION ────►│ CLASSES │           │◄─────── PHASE 1 NEXT SY ────►│
│  Last Sat Jan → Last Fri Feb          │  END    │           │  Last Sat Jan → Last Fri Feb  │
│  (G7, G11, Transferees, Balik-Aral)   │ Mar 31  │           │                               │
                                            │
                                         APRIL–MAY
                                         ACT 0: SETUP
                                         New AY config
                                         Sections / Strands
                                            │
                                         JUNE (1 week before opening)
                                         │◄─ PHASE 2: REGULAR ENROLLMENT ─►│
                                         │  All grade levels confirm        │
                                         │  G8/9/10/12 confirmation slips   │
                                         │  G7/G11 section finalization     │
                                            │
                                         JUNE (First Monday)
                                         CLASSES OPEN — ACT 3 BEGINS
                                         Ongoing: transferees, late, updates
                                            │
                                         DECEMBER–JANUARY
                                         ACT 4: SHS 2nd Semester (G12)
                                            │
                                         MARCH 31 — CLASSES END — ACT 5
```

---

## System Navigation Map (Registrar's Full Menu)

```
[SIDEBAR — always visible on desktop ≥1024px; hamburger drawer on mobile]
│
├─ 📊  /dashboard       — Stats, charts, recent activity
│
├─ 📋  /applications    — All submitted applications; approve/reject/enroll
│
├─ 👤  /students        — Search any applicant/enrolled student by LRN or name
│
├─ 🏫  /sections        — Section CRUD; capacity monitor; teacher assignment
│
├─ 📜  /audit-logs      — Full immutable activity log
│
└─ ⚙️   /settings       — 4 tabs:
         Tab 1: School Profile  (logo, school name)
         Tab 2: Academic Year   (create, activate, archive)
         Tab 3: Grade Levels & Strands
         Tab 4: Enrollment Gate (open/close public portal)

[PUBLIC-FACING — not the registrar's screen, but the registrar monitors it]
│
├─ /apply              — Online admission form (open when gate is ON)
├─ /closed             — Shown when gate is OFF
└─ /track/:trackingNo  — Applicant self-service status lookup
```

---

---

# ═══════════════════════════════════════════
# ACT 0 — SYSTEM SETUP & ANNUAL ROLLOVER
# ═══════════════════════════════════════════
## Period: April (after classes end March 31) through January (before Early Registration opens)
## Purpose: Build the scaffold for the incoming school year before the public portal opens.

---

## SCENE 0.1 — First Login

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time — typically April after the school year ends  │
│ WHERE  │ /login                                                  │
│ WHY    │ Registrar needs authenticated access to all modules    │
│ POLICY │ JWT-based auth; 8-hour token expiry (PRD §2)           │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees:**
The login page renders full-screen, centered. It shows:
- The school logo (if already uploaded) and school name
- An email field, a password field, and a "Sign In" button
- No registration link — accounts are created by system administrators only

**Steps:**
1. Registrar navigates to the school system URL in the browser.
2. Enters their `@` email address and password.
3. Clicks **Sign In**.

**System:**
- `POST /api/auth/login` — bcrypt validates password (12 salt rounds).
- On success → JWT signed `{ userId, role: 'REGISTRAR' }` with 8-hour expiry is returned.
- Zustand `authStore` saves the token; React Router redirects to `/dashboard`.
- `AuditLog` entry written: `USER_LOGIN — "User [email] logged in from [IP]"`.
- Sileo `success` toast: *"Welcome back, [Name]."*

**Outcome:** Registrar is authenticated and lands on the Dashboard.

**Edge — Wrong password:** Sileo `error` toast: *"Invalid email or password."* No account lockout on first attempt but rate-limited to 20 req/min on this endpoint.

---

## SCENE 0.2 — Reading the Dashboard on First Visit of the Season

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ April — reviewing the closed school year's final state │
│ WHERE  │ /dashboard                                              │
│ WHY    │ Registrar wants a final enrollment snapshot before      │
│        │ configuring the next academic year                      │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees:**

```
╔══════════════════════════════════════════════════════════════════╗
║  HINIGARAN NATIONAL HIGH SCHOOL           SY 2025–2026  ACTIVE  ║
╠══════════════╦══════════════╦══════════════╦════════════════════╣
║  1,243       ║  0           ║  0           ║  0                 ║
║  ENROLLED    ║  PENDING     ║  APPROVED    ║  SECTIONS          ║
║              ║  Applications║  Awaiting    ║  At Capacity       ║
╠══════════════╩══════════════╩══════════════╩════════════════════╣
║                                                                  ║
║  [BAR CHART — Enrollment by Grade Level]                         ║
║   Grade 7   ████████████████████ 215                            ║
║   Grade 8   ███████████████████  203                            ║
║   Grade 9   ███████████████████  198                            ║
║   Grade 10  █████████████████    188                            ║
║   Grade 11  ████████████████████ 214                            ║
║   Grade 12  ████████████████     183                            ║
║                                                                  ║
║  [DONUT CHART — Status Distribution]                             ║
║   ENROLLED 1243 · REJECTED 14 · PENDING 0                       ║
║                                                                  ║
║  RECENT ACTIVITY                                                 ║
║  • Mar 31  Registrar Cruz  ENROLLMENT_GATE_TOGGLED → CLOSED      ║
║  • Mar 30  Registrar Cruz  APPLICATION_APPROVED → #1243          ║
║  • Mar 28  Registrar Cruz  SECTION_UPDATED → Grade 12 Mabini     ║
╚══════════════════════════════════════════════════════════════════╝
```

**Steps:**
1. Registrar reads the final enrollment count: **1,243 enrolled students**.
2. Notes all pending and approved are zero — the school year is fully closed.
3. Reviews the grade-level bar chart to see distribution across JHS and SHS.
4. Reads the recent activity feed to confirm no actions were taken incorrectly.
5. Proceeds to Settings to begin configuring the next school year.

**Outcome:** Registrar has a clean end-of-year reference point before starting setup.

---

## SCENE 0.3 — Creating the New Academic Year Record

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ April–May — after current SY ends                      │
│ WHERE  │ /settings → Tab 2: Academic Year                       │
│ WHY    │ System needs a year record before sections and grade    │
│        │ levels can be configured for the incoming SY           │
│ POLICY │ One academic year active at a time (PRD §6.4)         │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees:**

```
SETTINGS > Academic Year

 Year Label     │  Status   │  Actions
─────────────────┼───────────┼──────────────────
 2025–2026       │  ● ACTIVE │  [Edit]
 2024–2025       │  Archived │  [View]

                                    [ + New Academic Year ]
```

**Steps:**
1. Registrar clicks **+ New Academic Year**.
2. A `Dialog` modal opens with a single field:

```
┌─────────────────────────────────────────────────────┐
│  Create Academic Year                                │
│  ─────────────────────────────────────────────────  │
│  Year Label *                                        │
│  [ 2026–2027                                    ]    │
│                                                      │
│  Format: YYYY–YYYY (e.g. 2026–2027)                  │
│                                                      │
│           [Cancel]        [Create Year]              │
└─────────────────────────────────────────────────────┘
```

3. Registrar types `2026–2027` and clicks **Create Year**.

**System:**
- `POST /api/academic-years` → `{ yearLabel: "2026–2027" }`.
- New `AcademicYear` record created with `isActive: false`.
- Table now shows three rows; the new year appears as `INACTIVE`.
- `AuditLog`: `SETTINGS_UPDATED — "Admin created Academic Year 2026–2027"`.
- Sileo `success` toast: *"Academic Year Created — SY 2026–2027 has been added."*

**Outcome:** SY 2026–2027 exists in the system as an inactive scaffold. SY 2025–2026 remains active — the system still reports under it.

> ⚠️ **Critical:** Do NOT activate the new year yet. Grade levels and sections must be built first. The new year is activated in Scene 0.7 only after the full structure is in place.

---

## SCENE 0.4 — Configuring Grade Levels for the New Academic Year

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ April–May — immediately after Scene 0.3               │
│ WHERE  │ /settings → Tab 3: Grade Levels & Strands              │
│ WHY    │ Grade levels are the base unit — sections and          │
│        │ applicant routing depend on them                       │
│ POLICY │ HNHS offers Grade 7 through Grade 12 (RA 10533)        │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees:**

The tab has a year-context dropdown at the top. Registrar must switch it to `SY 2026–2027` first, otherwise additions will be attached to the wrong year.

```
SETTINGS > Grade Levels & Strands

  Academic Year Context:  [ SY 2026–2027 ▾ ]    ← must switch this first

  GRADE LEVELS                     │  STRANDS
  ─────────────────────────────────│─────────────────────────────
  (empty — no grade levels yet)    │  (empty — no strands yet)
                  [+ Add Grade Level]         [+ Add Strand]
```

**Steps:**
1. Registrar switches year context to `SY 2026–2027` from the dropdown.
2. Clicks **+ Add Grade Level**.
3. Small inline form or mini-Dialog appears:

```
  Grade Level Name *   [ Grade 7         ]
  Display Order *      [ 1               ]
                       [Add]
```

4. Registrar types `Grade 7`, display order `1`, clicks **Add**.
5. Repeats for each grade level:

| Grade Level Name | Display Order |
|---|---|
| Grade 7  | 1 |
| Grade 8  | 2 |
| Grade 9  | 3 |
| Grade 10 | 4 |
| Grade 11 | 5 |
| Grade 12 | 6 |

6. After all six, the left panel shows an ordered list.

**System:**
- `POST /api/grade-levels` per entry → `{ name, displayOrder, academicYearId: [2026–2027 ID] }`.
- Each `GradeLevel` is cascade-linked to the academic year.
- Sileo `success` toast after each: *"Grade Level Added."*

**Outcome:** Six grade levels exist under SY 2026–2027. The admission portal's grade-level dropdown will now show these six when the portal is opened.

---

## SCENE 0.5 — Configuring SHS Strands

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ April–May — immediately after Scene 0.4               │
│ WHERE  │ /settings → Tab 3: Grade Levels & Strands (right panel)│
│ WHY    │ Grade 11 applicants must select a strand on the portal │
│ POLICY │ HNHS offers Academic track (STEM/ABM/HUMSS/GAS) for   │
│        │ Grades 11–12 (DO 17, s. 2025; RA 10533 K–12 framework) │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Still on `SY 2026–2027` context, Registrar clicks **+ Add Strand** in the right panel.
2. Dialog opens:

```
┌─────────────────────────────────────────────────────┐
│  Add Strand                                          │
│  ─────────────────────────────────────────────────  │
│  Strand Name *                                       │
│  [ STEM                                         ]    │
│                                                      │
│  Applicable Grade Levels *                           │
│  ┌────────────────────────────────────────────┐     │
│  │  ☑ Grade 7     ☑ Grade 8     ☑ Grade 9   │     │
│  │  ☑ Grade 10   ☑ Grade 11   ☑ Grade 12   │     │
│  └────────────────────────────────────────────┘     │
│  (Check only Grade 11 and Grade 12 for STEM)         │
│                                                      │
│           [Cancel]         [Save Strand]             │
└─────────────────────────────────────────────────────┘
```

3. Registrar types `STEM`, checks **Grade 11** and **Grade 12** only, clicks **Save Strand**.
4. Repeats for:

| Strand | Applicable Grades |
|---|---|
| ABM   | Grade 11, Grade 12 |
| HUMSS | Grade 11, Grade 12 |
| GAS   | Grade 11, Grade 12 |

**System:**
- `POST /api/strands` → `{ name, applicableGradeLevelIds: [G11.id, G12.id], academicYearId }`.
- `applicableGradeLevelIds` stored as `Int[]` in Prisma (PostgreSQL array).
- Sileo `success` toast after each: *"Strand Saved."*

**Effect on the public portal:**
When an applicant on `/apply` selects **Grade 11** or **Grade 12** as their grade level, the Strand dropdown dynamically loads `STEM`, `ABM`, `HUMSS`, `GAS`. For Grades 7–10, the Strand dropdown does not appear (not applicable to JHS).

**Outcome:** Four SHS strands fully configured for SY 2026–2027.

---

## SCENE 0.6 — Building All Sections

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ April–May — after grade levels and strands are done    │
│ WHERE  │ /sections                                               │
│ WHY    │ Sections are the physical classrooms. The enrollment   │
│        │ approval workflow requires at least one section to     │
│        │ exist per grade level before any applicant can be      │
│        │ enrolled.                                               │
│ POLICY │ PRD §6.3.1 — sections have name, max capacity,        │
│        │ grade level, and optional advising teacher              │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees:**

```
SECTIONS                      Year: [ SY 2026–2027 ▾ ]       [ + New Section ]

  Grade Level  │  Section     │  Adviser         │  Capacity  │  Enrolled
  ─────────────┼──────────────┼──────────────────┼────────────┼────────────
  (empty)
```

**Steps — Creating one section (full dialog walkthrough):**
1. Registrar clicks **+ New Section**.
2. Dialog opens:

```
┌─────────────────────────────────────────────────────┐
│  Create Section                                      │
│  ─────────────────────────────────────────────────  │
│  Grade Level *                                       │
│  [ Grade 7                                    ▾ ]    │
│                                                      │
│  Section Name *                                      │
│  [ Rizal                                        ]    │
│                                                      │
│  Max Capacity *                                      │
│  [ 45                                           ]    │
│                                                      │
│  Advising Teacher (optional)                         │
│  [ Ms. Caridad Santos                         ▾ ]    │
│                                                      │
│           [Cancel]        [Create Section]           │
└─────────────────────────────────────────────────────┘
```

3. Registrar fills in all fields and clicks **Create Section**.
4. Repeats the dialog for each planned section.

**Sections the registrar creates (example for HNHS):**

*Junior High School — 4 sections per grade level:*

| Grade | Section Name | Capacity | Adviser |
|---|---|---|---|
| Grade 7 | Rizal     | 45 | Ms. Santos |
| Grade 7 | Bonifacio | 45 | Mr. Reyes  |
| Grade 7 | Luna      | 45 | Ms. Flores |
| Grade 7 | Mabini    | 45 | Mr. Torres |
| Grade 8 | Rizal     | 45 | Ms. Cruz   |
| Grade 8 | Bonifacio | 45 | Mr. Garcia |
| Grade 8 | Luna      | 45 | Ms. Bautista |
| Grade 8 | Mabini    | 45 | Mr. Villanueva |
| *(repeat for Grade 9, Grade 10)* | | | |

*Senior High School — sections named by strand:*

| Grade | Section Name | Strand Context | Capacity | Adviser |
|---|---|---|---|---|
| Grade 11 | STEM-A  | STEM strand  | 45 | Mr. Lim    |
| Grade 11 | ABM-A   | ABM strand   | 45 | Ms. Aquino |
| Grade 11 | HUMSS-A | HUMSS strand | 45 | Mr. Marcos |
| Grade 11 | GAS-A   | GAS strand   | 45 | Ms. Palma  |
| Grade 12 | STEM-A  | STEM strand  | 45 | Mr. Lim    |
| *(repeat for G12 ABM, HUMSS, GAS)* | | | |

> **Note:** The system does not link sections to strands directly at the database level. The registrar names SHS sections descriptively (e.g., "STEM-A") and the section is associated to Grade 11 (the grade level). When approving a Grade 11 STEM applicant, the registrar manually selects the STEM-A section from the filtered list. This is by PRD design.

**System:**
- `POST /api/sections` per entry → `{ name, maxCapacity, gradeLevelId, advisingTeacherId }`.
- `AuditLog`: `SECTION_CREATED` for each.
- Sileo `success` toast: *"Section Created — Grade 7 Rizal (max: 45)."*

**What the registrar sees after building all sections:**

```
SECTIONS                      Year: [ SY 2026–2027 ▾ ]

  Grade Level  │  Section  │  Adviser           │  Capacity  │  Enrolled
  ─────────────┼───────────┼────────────────────┼────────────┼──────────────
  Grade 7      │  Rizal    │  Ms. Santos        │  45        │  0/45  ● Avail
  Grade 7      │  Bonifacio│  Mr. Reyes         │  45        │  0/45  ● Avail
  Grade 7      │  Luna     │  Ms. Flores        │  45        │  0/45  ● Avail
  Grade 7      │  Mabini   │  Mr. Torres        │  45        │  0/45  ● Avail
  Grade 8      │  Rizal    │  Ms. Cruz          │  45        │  0/45  ● Avail
  ...
  Grade 11     │  STEM-A   │  Mr. Lim           │  45        │  0/45  ● Avail
  Grade 11     │  ABM-A    │  Ms. Aquino        │  45        │  0/45  ● Avail
  ...
```

**Outcome:** All sections are built. The enrollment approval workflow is now fully operational — the registrar can assign applicants to these sections.

---

## SCENE 0.7 — Activating the New Academic Year

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ May–January — any time before Early Registration opens │
│ WHERE  │ /settings → Tab 2: Academic Year                       │
│ WHY    │ Activating the year makes it the system's operating    │
│        │ context: the dashboard shows its stats, the portal     │
│        │ labels applications under it, sections become live     │
│ POLICY │ Only one active year at a time; transaction-safe swap  │
│        │ (PRD §6.4 Tab 2)                                       │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees:**

```
SETTINGS > Academic Year

 Year Label    │  Status    │  Actions
───────────────┼────────────┼──────────────────────────
 2026–2027     │  INACTIVE  │  [Activate]  [Edit]
 2025–2026     │  ● ACTIVE  │  [Edit]
 2024–2025     │  Archived  │  [View]
```

**Steps:**
1. Registrar clicks **[Activate]** next to `2026–2027`.
2. A confirmation Dialog appears — this is a high-impact irreversible action:

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠  Activate SY 2026–2027?                                   │
│  ──────────────────────────────────────────────────────────  │
│  This will make SY 2026–2027 the active operating year.      │
│  SY 2025–2026 will be moved to ARCHIVED.                     │
│                                                              │
│  All new applications, sections, and enrollments will be     │
│  recorded under SY 2026–2027 from this point forward.        │
│                                                              │
│  Historical SY 2025–2026 data is preserved and viewable,     │
│  but cannot be modified.                                     │
│                                                              │
│  This cannot be undone. Proceed?                             │
│                                                              │
│        [ Cancel ]               [ Yes, Activate ]           │
└──────────────────────────────────────────────────────────────┘
```

3. Registrar confirms: **Yes, Activate**.

**System:**
```
DB transaction:
  UPDATE academic_years SET is_active = false WHERE is_active = true
  UPDATE academic_years SET is_active = true  WHERE id = [2026–2027 id]
  UPDATE school_settings SET active_academic_year_id = [2026–2027 id]
```
- `AuditLog`: `SETTINGS_UPDATED — "Admin activated Academic Year SY 2026–2027"`.
- Dashboard header immediately updates to show `SY 2026–2027  ACTIVE`.
- Sileo `success` toast: *"SY 2026–2027 is now the active academic year."*

**Outcome:**
- SY 2026–2027 is now the live operating year.
- SY 2025–2026 is ARCHIVED — all data preserved and viewable, no modifications.
- The public portal `/apply` will tag any future applications under SY 2026–2027.
- The Enrollment Gate is still `CLOSED`. The portal is not yet open to the public.

---

## SCENE 0.8 — Updating School Identity (Logo & School Name)

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time — typically done during initial setup or      │
│        │ when the school receives a new official logo from SDO  │
│ WHERE  │ /settings → Tab 1: School Profile                      │
│ WHY    │ The logo and school name appear on the public portal,  │
│        │ login page, email notifications, and dashboard header  │
│ POLICY │ PRD §3.2 — logo dominant color auto-extracted and      │
│        │ applied as the system's accent color                   │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees:**

```
SETTINGS > School Profile

  School Name
  [ Hinigaran National High School               ]      [Save Name]

  School Logo
  ┌───────────────────────────────┐
  │  [current logo thumbnail]     │    PNG · JPG · WEBP · max 2MB
  └───────────────────────────────┘
  [Change Logo]

  Accent Color Preview
  Extracted from logo:  ██████  HSL(221 83% 53%)  (default blue)
  ┌─────────────────────────────────────────────────────────────┐
  │  Button  │  Badge   │  Sidebar Highlight  │  Link           │
  │ [Save]   │  ●ACTIVE │  ▌ Applications     │  View details → │
  └─────────────────────────────────────────────────────────────┘
```

**Steps — Logo upload:**
1. Registrar clicks **Change Logo**.
2. OS file picker opens. Registrar selects the new official logo PNG (< 2MB).
3. `FileReader` API immediately shows a preview thumbnail on-screen.
4. Below the preview, a color swatch updates in real time (client-side preview).
5. Registrar confirms the extracted accent color looks correct.
6. Clicks **Save** to submit.

**System:**
- `POST /api/settings/logo` (multipart/form-data via Multer).
- Server validates: MIME type must be `image/png`, `image/jpeg`, or `image/webp`; size ≤ 2MB.
- `logoColorService` runs `color-thief-node`:
  - Extracts top 5 dominant palette colors from the image.
  - Filters out near-whites (lightness > 85%) and near-blacks (lightness < 15%, saturation < 20%).
  - Picks the most saturated remaining color as the accent.
  - Stores `{ accent_hsl: "0 72% 38%", extracted_at: "..." }` in `SchoolSettings.colorScheme`.
- API returns `{ logoUrl, colorScheme }`.
- React: Zustand `settingsStore` updates → `RootLayout.tsx` `useEffect` fires:
  ```ts
  document.documentElement.style.setProperty('--accent', accent_hsl)
  document.documentElement.style.setProperty('--primary', accent_hsl)
  document.documentElement.style.setProperty('--ring', accent_hsl)
  ```
- The entire dashboard, sidebar, and all interactive elements instantly repaint.
- `--background`, `--card`, `--foreground`, `--border`, `--muted` are **never touched** — the white layout is permanent.
- `AuditLog`: `SETTINGS_UPDATED — "Admin updated school identity settings"`.
- Sileo `success` toast: *"Logo updated. Accent color applied from logo."*

**Outcome:** New logo appears in the sidebar, login page header, and all email templates. Dashboard repaints to the school's brand accent color.

**Edge — Logo with no extractable color (all white/black):**
System falls back to default blue `HSL(221 83% 53%)`. Toast: *"Logo saved. Could not extract accent color — default blue applied."*

---

---

# ═══════════════════════════════════════════
# ACT 1 — PHASE 1: EARLY REGISTRATION
# ═══════════════════════════════════════════
## Period: Last Saturday of January → Last Friday of February
## Purpose: Pre-registration of incoming Grade 7, Grade 11, transferees, Balik-Aral.
## Legal Status: Pre-registration ONLY — not official enrollment.
## DepEd Basis: DO 017, s. 2025 § Definition (d): Early Registration

---

## SCENE 1.1 — Opening the Enrollment Gate

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Last Saturday of January (e.g., January 31, 2026)      │
│ WHERE  │ /settings → Tab 4: Enrollment Gate                     │
│ WHY    │ The public portal must be turned on so parents can      │
│        │ submit their children's pre-registration online         │
│ POLICY │ DO 017, s. 2025 — Early Registration opens last Sat    │
│        │ of January. School head determines portal access.       │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees:**

```
SETTINGS > Enrollment Gate

  ┌───────────────────────────────────────────────────────────────┐
  │  Enrollment Period                                             │
  │                                                               │
  │  ○────────────   OFF                                          │
  │  Status: ● CLOSED                                             │
  │                                                               │
  │  When OPEN, the public admission portal is accessible at:     │
  │  https://[school-domain]/apply                                │
  │                                                               │
  │  When CLOSED, all visitors are redirected to /closed          │
  └───────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Registrar clicks the toggle switch to `ON`.
2. A confirmation Dialog appears:

```
┌──────────────────────────────────────────────────────────────┐
│  Open Enrollment Portal?                                     │
│  ──────────────────────────────────────────────────────────  │
│  The public admission form will become accessible.           │
│  Parents and students can begin submitting applications.     │
│                                                              │
│        [ Cancel ]           [ Yes, Open Enrollment ]        │
└──────────────────────────────────────────────────────────────┘
```

3. Registrar confirms: **Yes, Open Enrollment**.

**System:**
- `PATCH /api/settings/enrollment-gate` → `{ enrollmentOpen: true }`.
- `SchoolSettings.enrollmentOpen = true` in database.
- React Router loader on `/apply` now returns settings (not redirect).
- `AuditLog`: `ENROLLMENT_GATE_TOGGLED — "Admin [user] set enrollment to OPEN"`.
- Sileo `success` toast: *"Enrollment is now OPEN. The portal is live."*

**What the public portal now shows at `/apply`:**

```
┌──────────────────────────────────────────────────────────────────┐
│            HINIGARAN NATIONAL HIGH SCHOOL                        │
│            [school logo]                                         │
│            Admission Application — SY 2026–2027                  │
│                                                                  │
│  ●────────○────────○                                             │
│  Step 1: Personal Info                                           │
│                                                                  │
│  Last Name *        [ __________________________ ]               │
│  First Name *       [ __________________________ ]               │
│  Middle Name        [ __________________________ ]               │
│  Suffix             [ N/A ▾ ]                                    │
│  Date of Birth *    [ MM/DD/YYYY          📅 ]                  │
│  Sex *              ○ Male   ○ Female                            │
│  LRN *              [ ____________ ] (12 digits)                 │
│                                                                  │
│                              [ Next → ]                          │
└──────────────────────────────────────────────────────────────────┘
```

**Outcome:** The portal is live. Parents can now submit applications for Grade 7, Grade 11, transferees, and Balik-Aral learners.

---

## SCENE 1.2 — The Applications Inbox: Daily Monitoring

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Every morning during Early Registration (Jan–Feb)      │
│ WHERE  │ /applications                                           │
│ WHY    │ New applications arrive overnight from parents who     │
│        │ submitted online. Registrar reviews and processes them. │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees (example: Day 5 of Early Registration, 42 applications in):**

```
APPLICATIONS           [ Search by LRN or name... 🔍 ]      [Filter ▾]

  Academic Year: SY 2026–2027    Grade: All ▾    Status: All ▾

  #   │  Learner Name          │  LRN             │  Grade    │  Strand  │  Status    │  Applied On       │  Actions
  ────┼────────────────────────┼──────────────────┼───────────┼──────────┼────────────┼───────────────────┼──────────
  42  │  Dela Cruz, Juan R.    │  123456789012    │  Grade 7  │  —       │  ● PENDING │  Feb 3, 2026 9:14 │  [View]
  41  │  Santos, Maria L.      │  876543219012    │  Grade 11 │  STEM    │  ● PENDING │  Feb 3, 2026 8:55 │  [View]
  40  │  Reyes, Pedro M.       │  112233445566    │  Grade 7  │  —       │  ● PENDING │  Feb 2, 2026 7:22 │  [View]
  39  │  Fernandez, Clara B.   │  998877665544    │  Grade 11 │  ABM     │  ● PENDING │  Feb 1, 2026      │  [View]
  38  │  Torres, Miguel A.     │  444433332222    │  Grade 7  │  —       │  ✓ APPROVED│  Jan 31, 2026     │  [View]
  ...
```

**Registrar's daily routine:**
1. Sorts by `Status: PENDING` to isolate unprocessed applications.
2. Filters by `Grade: Grade 7` first to batch-process JHS new entrants.
3. Reviews each application → approves or rejects (see Scenes 1.3 and 1.4).
4. Switches filter to `Grade: Grade 11` and processes SHS new entrants.
5. Notes any unusual entries (duplicate LRN, suspiciously young birth dates).

**Tracking number format visible in each record:** `HNS-2026-00042`

---

## SCENE 1.3 — Opening and Reading a Grade 7 Application Record

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ During Early Registration review session               │
│ WHERE  │ /applications → click [View] on a PENDING application  │
│ WHY    │ Registrar must verify all submitted data before        │
│        │ approving. Physical document verification happens in   │
│        │ the office; the system is the digital record.          │
│ POLICY │ DO 017, s. 2025 — Grade 7 requires: BEEF + Grade 6    │
│        │ SF9 + PSA Birth Certificate (once-only)                │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees (application detail panel/sheet):**

```
╔══════════════════════════════════════════════════════════════════════╗
║  APPLICATION DETAIL                                                  ║
║  #HNS-2026-00042                              Status: ● PENDING      ║
╠══════════════════════════════════════════════════════════════════════╣
║  PERSONAL INFORMATION                                                ║
║  Full Name    :  DELA CRUZ, Juan Reyes                               ║
║  Date of Birth:  March 12, 2014  (Age: 11 yrs, 10 months)           ║
║  Sex          :  Male                                                ║
║  LRN          :  123456789012                                        ║
║                                                                      ║
║  FAMILY & CONTACT                                                    ║
║  Home Address :  123 Brgy. San Antonio, Hinigaran, Negros Occidental ║
║  Guardian     :  Maria Dela Cruz (Mother)                            ║
║  Contact No.  :  0917-123-4567                                       ║
║  Email        :  delacruz.maria@gmail.com                            ║
║                                                                      ║
║  ENROLLMENT PREFERENCE                                               ║
║  Grade Level  :  Grade 7                                             ║
║  Strand       :  Not Applicable (JHS)                                ║
║                                                                      ║
║  SUBMISSION                                                          ║
║  Submitted    :  February 3, 2026 at 9:14 AM                        ║
║  Tracking No. :  HNS-2026-00042                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ⚠  PHASE 1: This is a PRE-REGISTRATION. Approval assigns a section ║
║     slot. Official enrollment is confirmed in Phase 2 (June).        ║
║                                                                      ║
║         [ Approve & Assign Section ]    [ Reject Application ]       ║
╚══════════════════════════════════════════════════════════════════════╝
```

**Registrar's verification checklist (done in person when parent visits, or by phone):**

| Check | Criterion | Result |
|---|---|---|
| LRN format | Exactly 12 digits | ✓ 123456789012 |
| Age appropriateness | ~11–13 years for Grade 7 | ✓ Born March 12, 2014 → 11 yrs |
| Grade level match | Applying for Grade 7 (JHS) | ✓ |
| Duplicate LRN | LRN not already in system under different name | ✓ (system would flag on submission) |
| PSA Birth Certificate | Present and verified in person | ✓ PSA# noted in physical log |
| Grade 6 SF9 | Present and signed by sending school head | ✓ SF9 from [Elementary School name] |

All checks pass → proceed to approval.

---

## SCENE 1.4 — Approving a Grade 7 Application & Assigning a Section

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ After in-person/phone document verification            │
│ WHERE  │ Application detail view → "Approve & Assign Section"  │
│ WHY    │ Approval locks in a section slot for the applicant     │
│ POLICY │ PRD §6.3.2 — capacity enforced via FOR UPDATE lock;   │
│        │ full sections not selectable                           │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Registrar clicks **Approve & Assign Section**.
2. A second Dialog opens — the section selector:

```
┌──────────────────────────────────────────────────────────────────┐
│  Assign Section                                                   │
│  Juan Dela Cruz  ·  Grade 7                                      │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  Available sections for Grade 7:                                 │
│                                                                  │
│  ○  Grade 7 – Rizal       Ms. Santos        38 / 45   ● 7 slots │
│  ○  Grade 7 – Bonifacio   Mr. Reyes         41 / 45   ● 4 slots │
│  ○  Grade 7 – Luna        Ms. Flores        44 / 45   ⚠ 1 slot  │
│  ✗  Grade 7 – Mabini      Mr. Torres        45 / 45   ✗ FULL    │
│                                                                  │
│  Selected: ○ Grade 7 – Rizal                                     │
│                                                                  │
│           [ Cancel ]           [ Confirm Enrollment ]           │
└──────────────────────────────────────────────────────────────────┘
```

> **Key UX detail:** Grade 7 – Mabini is shown greyed-out and marked FULL. It cannot be selected. The registrar can only pick from sections with available slots.

3. Registrar selects **Grade 7 – Rizal** (7 available slots, most balanced choice).
4. Clicks **Confirm Enrollment**.

**System — Race-Condition-Safe Enrollment Transaction:**
```
POST /api/applications/42/approve  { sectionId: [Rizal ID] }

Server:
  BEGIN TRANSACTION (Prisma $transaction)
    SELECT id, "maxCapacity" FROM "Section"
    WHERE id = [Rizal ID] FOR UPDATE       ← row-level lock
    COUNT enrollments WHERE sectionId = [Rizal ID]  → 38
    38 < 45 → capacity OK
    INSERT INTO enrollments { applicantId: 42, sectionId: [Rizal ID], enrolledById: [Reg ID] }
    UPDATE applicants SET status = 'APPROVED' WHERE id = 42
  COMMIT

  AuditLog:
    actionType: APPLICATION_APPROVED
    description: "Registrar Cruz approved #HNS-2026-00042 — assigned to Grade 7 Rizal"

  setImmediate(() => {
    sendEmail(to: "delacruz.maria@gmail.com",
              subject: "Congratulations! Your Enrollment is Confirmed",
              body: includes name, grade, section, tracking number, school logo)
  })
```

**Email sent to parent (non-blocking, fire-and-forget):**

```
From: noreply@hnhs.edu.ph
To:   delacruz.maria@gmail.com
Subject: Congratulations! Your Enrollment is Confirmed

[SCHOOL LOGO HEADER — accent color band]
HINIGARAN NATIONAL HIGH SCHOOL

Dear Ms. Dela Cruz,

We are pleased to confirm that your child's application
has been approved for SY 2026–2027.

  Learner Name  :  DELA CRUZ, Juan Reyes
  Grade Level   :  Grade 7
  Section       :  Grade 7 – Rizal
  Tracking No.  :  HNS-2026-00042

Please report to the school during the regular enrollment
period (1 week before June class opening) for final
document verification and official enrollment confirmation.

[SCHOOL FOOTER]
```

**System outcome in the UI:**
- Sileo `success` toast: *"Application Approved — Juan Dela Cruz enrolled in Grade 7 Rizal."*
- Application row in the inbox now shows `✓ APPROVED` (green badge).
- Grade 7 Rizal section capacity: **39/45** (was 38/45).

**Registrar returns to inbox — SCENE 1.2 — and processes the next application.**

---

## SCENE 1.5 — Approving a Grade 11 Application (SHS — Strand-Sensitive Sectioning)

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ During Early Registration review                       │
│ WHERE  │ Application detail → Grade 11 STEM applicant          │
│ WHY    │ Grade 11 approval is slightly more complex than G7:    │
│        │ the section dialog must be filtered not only by grade  │
│        │ level but also by the chosen strand                    │
│ POLICY │ DO 017, s. 2025 §9 — Strand declared at enrollment.   │
│        │ Sections must match the strand.                        │
└─────────────────────────────────────────────────────────────────┘
```

**Applicant: Santos, Maria L. — Grade 11 STEM**

Documents verified in person:
- ✓ PSA Birth Certificate (new to this school — recorded once)
- ✓ Grade 10 SF9 from her previous JHS, signed by school head
- ✓ LRN: 876543219012 (matches SF9)

**Registrar clicks Approve & Assign Section. Section dialog opens:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Assign Section                                                   │
│  Maria Santos  ·  Grade 11  ·  Strand: STEM                     │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  Showing Grade 11 sections:                                      │
│                                                                  │
│  ○  Grade 11 – STEM-A    Mr. Lim          32 / 45   ● 13 slots  │
│  ✗  Grade 11 – STEM-B    Ms. Bautista     45 / 45   ✗ FULL      │
│  ○  Grade 11 – ABM-A     Ms. Aquino       28 / 45   ● 17 slots  │
│  ○  Grade 11 – HUMSS-A   Mr. Marcos       25 / 45   ● 20 slots  │
│  ○  Grade 11 – GAS-A     Ms. Palma        30 / 45   ● 15 slots  │
│                                                                  │
│  Selected: ○ Grade 11 – STEM-A                                   │
│                                                                  │
│           [ Cancel ]           [ Confirm Enrollment ]           │
└──────────────────────────────────────────────────────────────────┘
```

> **Design note:** The dialog lists ALL Grade 11 sections regardless of strand. The registrar selects the section that matches the applicant's declared strand (STEM-A for a STEM applicant). This is a process control, not a technical filter — the registrar's judgment is the gate.

**Registrar selects STEM-A. Confirms enrollment.**

**System:** Same transaction as Scene 1.4. Email sent. STEM-A capacity: 33/45.

---

## SCENE 1.6 — Rejecting an Application

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ When a data integrity issue is found (duplicate LRN,  │
│        │ fictitious information, applicant already enrolled)    │
│ WHERE  │ Application detail view → "Reject Application"        │
│ WHY    │ The system must prevent duplicate records or invalid   │
│        │ entries from entering the enrollment data              │
│ POLICY │ DO 017, s. 2025: Rejection is NEVER for missing docs  │
│        │ or disability. Rejection is only for verified          │
│        │ data integrity failures. Missing docs → still enroll. │
└─────────────────────────────────────────────────────────────────┘
```

**Scenario:** Application #55 — Applicant submitted LRN `123456789012` which is already in the system under a different learner's name. Possible typo on the form.

**Steps:**
1. Registrar opens Application #55. Notices the LRN matches Application #42 (Juan Dela Cruz) but the name is entirely different.
2. Clicks **Reject Application**.
3. Rejection Dialog opens:

```
┌──────────────────────────────────────────────────────────────────┐
│  Reject Application #HNS-2026-00055                              │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  Rejection Reason (optional but strongly recommended):           │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ The submitted LRN 123456789012 is already registered    │     │
│  │ under a different learner in our system. Please         │     │
│  │ resubmit your application using the correct 12-digit    │     │
│  │ LRN found on your Grade 6 Report Card (SF9).            │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ⚠  The parent will be notified by email with this reason.      │
│                                                                  │
│           [ Cancel ]           [ Confirm Rejection ]            │
└──────────────────────────────────────────────────────────────────┘
```

4. Registrar types a clear, actionable reason and clicks **Confirm Rejection**.

**System:**
- `PATCH /api/applications/55/reject` → `{ rejectionReason: "LRN conflict..." }`.
- `Applicant.status = 'REJECTED'`, `Applicant.rejectionReason` saved.
- `AuditLog`: `APPLICATION_REJECTED — "Registrar Cruz rejected #55. Reason: LRN conflict."`.
- Email dispatched (non-blocking):
  ```
  Subject: Update on Your Application — Hinigaran NHS
  Body: Rejection reason + clear instructions to resubmit correctly.
  ```
- Sileo `info` toast: *"Application Rejected — Notification sent to parent."*

**Outcome:** Parent receives an email with the exact reason. They can resubmit via `/apply` with the corrected LRN. The new submission will be a fresh application with a new tracking number.

**When rejection is NOT appropriate (DO 017, s. 2025):**
- ❌ Parent does not have PSA BC yet → Do NOT reject. Approve with a note to bring PSA by October 31.
- ❌ Grade 6 SF9 missing → Do NOT reject. Accept PEPT result or school certification letter.
- ❌ Learner has unpaid fees at previous school → Do NOT reject. Enroll + Affidavit of Undertaking.
- ❌ Learner has a disability → Do NOT reject under any circumstances.

---

## SCENE 1.7 — Monitoring Section Capacity Throughout Early Registration

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Daily during Early Registration (January–February)     │
│ WHERE  │ /sections                                               │
│ WHY    │ Registrar must track which sections are filling up     │
│        │ and make proactive decisions (open a new section,      │
│        │ raise capacity, or inform SDO)                         │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees at mid-February (example):**

```
SECTIONS              Year: [ SY 2026–2027 ▾ ]   Grade: [ Grade 7 ▾ ]

  Grade   │  Section   │  Adviser       │  Capacity │  Enrolled       │  Status
  ────────┼────────────┼────────────────┼───────────┼─────────────────┼──────────
  Grade 7 │  Rizal     │  Ms. Santos    │  45       │  █████████ 42/45 │  ⚠ Near Full
  Grade 7 │  Bonifacio │  Mr. Reyes     │  45       │  ████████  38/45 │  ● Available
  Grade 7 │  Luna      │  Ms. Flores    │  45       │  ████████  36/45 │  ● Available
  Grade 7 │  Mabini    │  Mr. Torres    │  45       │  ██████████45/45 │  ✗ FULL
```

**Registrar observes:** Grade 7 Mabini is FULL. Rizal is nearly full. At current rate, all Grade 7 sections may fill before February ends.

**Options available:**
- **Edit capacity** on a near-full section (if school head approves):
  - Click `[Edit]` on Grade 7 Rizal → Change Max Capacity from 45 to 48 → Save.
- **Create a new Grade 7 section** (if a room and teacher are available):
  - Click `+ New Section` → Grade 7, new section name, new teacher.
- **Inform the school head** and document that the section is full — new applicants to Grade 7 Rizal and Mabini will be redirected to other sections.

**What the registrar does NOT do:** Block or reject applicants because sections are full. Per DO 017, every learner has the right to enroll. If the school genuinely cannot accommodate, the SDO must be consulted for guidance.

---

## SCENE 1.8 — Closing the Enrollment Gate at End of Early Registration

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Last Friday of February — end of Early Registration    │
│ WHERE  │ /settings → Tab 4: Enrollment Gate                     │
│ WHY    │ The school enters the preparation period (March–May).  │
│        │ No more pre-registrations should be accepted until     │
│        │ Phase 2 Regular Enrollment opens in June.              │
│ POLICY │ DO 017, s. 2025 — Phase 1 window closes last Friday    │
│        │ of February. SDO may grant extensions.                 │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Registrar opens Settings → Tab 4.
2. Toggles the gate switch from `ON` to `OFF`.
3. Confirmation Dialog: *"Close the portal? All visitors will be redirected to the Enrollment Closed page."*
4. Confirms: **Yes, Close**.

**System:**
- `PATCH /api/settings/enrollment-gate` → `{ enrollmentOpen: false }`.
- `/apply` now redirects all visitors to `/closed`:
  ```
  ┌────────────────────────────────────────────────────────────┐
  │         HINIGARAN NATIONAL HIGH SCHOOL                     │
  │         [logo]                                             │
  │                                                            │
  │  Enrollment is currently CLOSED.                           │
  │                                                            │
  │  The Early Registration period has ended.                  │
  │  Regular Enrollment will open before the start of          │
  │  classes in June.                                          │
  │                                                            │
  │  Track your existing application:                          │
  │  [ HNS-2026-_____ ]     [ Track Status ]                   │
  └────────────────────────────────────────────────────────────┘
  ```
- `AuditLog`: `ENROLLMENT_GATE_TOGGLED — "Admin set enrollment to CLOSED"`.
- Sileo `info` toast: *"Enrollment Closed — The portal has been disabled."*

**Outcome:** Phase 1 is complete. All pre-registrations are in the system. The registrar now has March–May to finalize section capacity, prepare for Phase 2, and report Early Registration data to the school head.

---

---

# ═══════════════════════════════════════════
# ACT 2 — PHASE 2: REGULAR ENROLLMENT
# ═══════════════════════════════════════════
## Period: ~1 week before class opening (e.g., June 9–14, coinciding with Brigada Eskwela)
## Purpose: OFFICIAL enrollment of ALL grade levels.
## Legal Status: THIS is the official enrollment of record. DepEd LIS BOSY encoding happens here.
## DepEd Basis: DO 017, s. 2025; RA 7797 as amended by RA 11480

---

## SCENE 2.1 — Re-Opening the Gate for Regular Enrollment

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ ~June 9 (1 week before class opening on June 16)       │
│ WHERE  │ /settings → Tab 4: Enrollment Gate                     │
│ WHY    │ Phase 2 serves ALL grade levels — it is the gate for   │
│        │ confirming pre-registered G7/G11, processing walk-ins, │
│        │ and enrolling continuing G8–10 and G12 learners        │
└─────────────────────────────────────────────────────────────────┘
```

Same gate-open procedure as Scene 1.1. Registrar toggles `ON` → Confirms → Portal live.

**Important difference from Phase 1:** During Phase 2, the registrar is processing far higher volumes — all grade levels simultaneously, parents arriving in person, walk-ins, and confirmation slips. The system's search capability (`/students`, `/applications`) and the filtered sections dialog become the primary productivity tools.

---

## SCENE 2.2 — Confirming a Pre-Registered Grade 7 Applicant (Phase 2 Confirmation)

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Phase 2 — June Brigada Eskwela week                    │
│ WHERE  │ /applications → search for pre-approved applicant      │
│ WHY    │ Juan Dela Cruz was approved in Phase 1 (SCENE 1.4).    │
│        │ He is now back at school with his parent for final     │
│        │ document verification. The registrar confirms his      │
│        │ enrollment in the system.                               │
│ POLICY │ DO 017, s. 2025 — Phase 2 is the official enrollment.  │
│        │ Phase 1 approval is pre-registration only.             │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Registrar types `Dela Cruz` in the search bar at `/applications`.
2. Application #42 appears: **Juan Dela Cruz — Grade 7 Rizal — ✓ APPROVED**.
3. Registrar opens the record.
4. Verifies physical documents in hand:
   - ✓ PSA Birth Certificate (original — PSA number matches what was noted in Phase 1)
   - ✓ Grade 6 SF9 (original, signed by sending school head)
5. All documents verified. Section assignment (Grade 7 Rizal) is already in the system from Phase 1.
6. **No change needed.** The enrollment record is already created. The registrar simply notes *"Phase 2 docs verified — June 10, 2026"* in the physical enrollment logbook.
7. Registrar informs the parent: *"Your child is officially enrolled in Grade 7 Rizal. Classes begin June 16."*

**System:** No additional API call is needed if all data was correctly captured in Phase 1. The enrollment record exists. The registrar's action here is physical document verification and verbal confirmation.

**If a data correction is needed** (e.g., parent reports a name typo in the form):
- Registrar edits the applicant record: `PUT /api/applicants/42` → corrects the field → saves.
- `AuditLog` captures the edit.

**Outcome:** Juan Dela Cruz's enrollment is officially confirmed for SY 2026–2027, Grade 7 Rizal.

---

## SCENE 2.3 — Processing Continuing Grade 8–10 and Grade 12 Learners (Confirmation Slips)

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Phase 2 — June enrollment week                        │
│ WHERE  │ /students → find existing learner → assign to section  │
│ WHY    │ Grades 8–10 and Grade 12 do NOT submit a full BEEF.   │
│        │ They submit a Confirmation Slip (Annex C of DO 017).   │
│        │ The registrar locates their existing record and        │
│        │ assigns them to a section for the new school year.     │
│ POLICY │ DO 017, s. 2025 §4 — continuing learners are          │
│        │ pre-registered in LIS; only a Confirmation Slip needed │
└─────────────────────────────────────────────────────────────────┘
```

**Scenario:** A Grade 8 student, Pedro Reyes, arrives with his Confirmation Slip. He was in Grade 7 last year and is now moving up.

**Steps:**
1. Registrar goes to `/students` and searches `Reyes Pedro`.
2. His record appears: **Grade 7 – Rizal — SY 2025–2026 — ENROLLED**. (His last year's record.)
3. Since it is SY 2026–2027 now, the registrar initiates his enrollment for the new year:
   - Clicks **[Enroll for New Year]** or the equivalent action button.
   - Or navigates through `/applications` if he submitted a fresh Confirmation Slip online.
4. Section assignment dialog opens, now filtered to **Grade 8** sections:

```
┌──────────────────────────────────────────────────────────────────┐
│  Assign Section                                                   │
│  Pedro Reyes  ·  Grade 8  (Promoted from Grade 7 – Rizal)       │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  Available sections for Grade 8:                                 │
│                                                                  │
│  ○  Grade 8 – Rizal       Ms. Cruz         20 / 45   ● 25 slots │
│  ○  Grade 8 – Bonifacio   Mr. Garcia       18 / 45   ● 27 slots │
│  ○  Grade 8 – Luna        Ms. Bautista     22 / 45   ● 23 slots │
│  ○  Grade 8 – Mabini      Mr. Villanueva   19 / 45   ● 26 slots │
│                                                                  │
│           [ Cancel ]           [ Confirm Enrollment ]           │
└──────────────────────────────────────────────────────────────────┘
```

5. Registrar selects **Grade 8 – Rizal** and confirms.

**System:**
- Enrollment record created: `{ learnerId: [Pedro], sectionId: [G8-Rizal], academicYearId: [SY2026-2027] }`.
- Status: **ENROLLED**.
- Sileo `success` toast: *"Enrollment Confirmed — Pedro Reyes enrolled in Grade 8 Rizal."*
- `AuditLog`: `APPLICATION_APPROVED — "Registrar Cruz confirmed enrollment for Pedro Reyes → Grade 8 Rizal"`.

**Scale reality:** During Phase 2 week, the registrar and clerks may process 200–400 confirmation slips in a single day. The 300ms debounce search and streamlined one-dialog confirmation flow are the primary speed tools.

---

## SCENE 2.4 — Processing a Walk-In Grade 7 Applicant Who Missed Phase 1

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Phase 2 — June enrollment week                        │
│ WHERE  │ /apply (school computer) OR /applications (registrar) │
│ WHY    │ A parent arrives during Brigada Eskwela with a child  │
│        │ who did NOT pre-register in January–February.         │
│ POLICY │ DO 017, s. 2025 — School CANNOT turn away a learner   │
│        │ who missed early registration. All learners must be   │
│        │ accepted during the regular enrollment period if       │
│        │ capacity allows.                                       │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Parent arrives at the registrar's window with child (no prior application).
2. Registrar directs the parent to fill out the online form at a computer in the office — or offers to fill it out on their behalf.
3. The form at `/apply` is filled out (3-step wizard: Personal Info → Family & Contact → Enrollment Preferences).
4. On submission, the system generates a tracking number: `HNS-2026-00198`.
5. The application immediately appears in the registrar's `/applications` inbox as **PENDING**.
6. Since the parent is physically present, the registrar:
   a. Verifies documents immediately.
   b. Processes the application on the spot (Scene 1.3 → 1.4 flow).
7. Result: Walk-in applicant is approved and section-assigned **within the same visit**.

**Capacity check before approving:**

If the first section the registrar tries is full, they see the full section greyed out in the dialog and select a different one. If **all** Grade 7 sections are full, the registrar:
- Does NOT reject the applicant.
- Informs the school head immediately.
- School head decides: raise capacity on an existing section, open a new section, or escalate to SDO.
- Applicant is placed in **APPROVED** status (section assigned as soon as capacity is resolved) — never rejected for capacity reasons.

---

## SCENE 2.5 — Processing a Transferee During Phase 2

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Phase 2 or any time during the school year             │
│ WHERE  │ /apply → then /applications                            │
│ WHY    │ A learner is changing schools. The receiving school    │
│        │ must enroll them regardless of outstanding fees at     │
│        │ the sending school.                                     │
│ POLICY │ DO 017, s. 2025 §5.5 — Schools cannot deny transferee  │
│        │ enrollment due to unpaid private school fees.          │
│        │ LRN must be validated; SF10 is requested post-         │
│        │ enrollment, not pre-enrollment.                        │
└─────────────────────────────────────────────────────────────────┘
```

**Scenario:** Carlos Fernandez, Grade 9, transferring from a private school in Bacolod. He has his Grade 8 SF9 but the private school has unpaid tuition.

**Document checklist:**

| Document | Presented? | Action |
|---|---|---|
| SF9 (Grade 8 Report Card) | ✓ Yes | Verified; grades noted |
| PSA Birth Certificate | ✓ Yes | New to this school — recorded once |
| LRN: 998877665544 | ✓ Yes | Found on SF9; validated in system |
| Private school unpaid fees | ⚠ Yes | DO NOT block. Assist with Affidavit of Undertaking. |
| SF10 (Grade 7 and 8 records) | ✗ No | NOT required at enrollment. Registrar initiates request to sending school through DepEd LIS (external system). |

**Steps:**
1. Parent fills `/apply` form with Carlos's information and LRN.
2. Registrar reviews application — notes the LRN (`998877665544`) exists in DepEd LIS under a private school.
3. Verifies SF9 grade and completion.
4. Informs parent about the Affidavit of Undertaking for the private school fees — assists them in preparing it (done offline/physically, not in this system).
5. Clicks **Approve & Assign Section** → selects Grade 9 section → confirms.
6. Separately, in DepEd LIS (external system), initiates the SF10 transfer request from the sending school.

**System outcome:** Carlos Fernandez enrolled in Grade 9. The school system shows `ENROLLED`. The SF10 transfer is tracked outside this system in DepEd LIS.

---

## SCENE 2.6 — Processing a Balik-Aral (Returning Learner)

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Phase 2 or any time during the school year             │
│ WHERE  │ /apply → then /applications                            │
│ WHY    │ A learner who dropped out ≥1 year ago wants to return. │
│ POLICY │ DO 017, s. 2025 §5.6 — Balik-Aral learners cannot be  │
│        │ turned away due to gaps or missing records. Physical   │
│        │ submission of SF9 is required (the last report card    │
│        │ they received before dropping out).                    │
└─────────────────────────────────────────────────────────────────┘
```

**Scenario:** Ana Gonzales, 18 years old, dropped out 2 years ago during Grade 9. She now wants to return to Grade 10.

**Document scenarios:**

| Case | Documents Available | Registrar Action |
|---|---|---|
| **Best case** | Grade 9 SF9 (last report card) + PSA BC | Standard approval flow |
| **No SF9** | PSA BC only | Accept certification letter from previous school, or barangay certification of last grade attended |
| **No LRN** | Has PSA BC but never had an LRN | Enroll anyway; coordinator handles LRN generation through SDO |
| **No documents at all** | Nothing available | Enroll provisionally; give family until October 31 to submit; coordinate with SDO |

**Key registrar behavior:** Never refuse. Process the enrollment with whatever documents are available. Flag the record for follow-up in the physical enrollment logbook.

---

## SCENE 2.7 — Closing the Gate After Regular Enrollment

Same process as Scene 1.8. Registrar toggles gate `OFF` after Brigada Eskwela week ends. Classes begin Monday. The portal closes — `/apply` redirects to `/closed` for the rest of the school year (except for exceptional late enrollment periods).

---

---

# ═══════════════════════════════════════════
# ACT 3 — ACTIVE SCHOOL YEAR: ONGOING OPERATIONS
# ═══════════════════════════════════════════
## Period: June → March (classes in session)
## Purpose: Manage sections, process late enrollees and mid-year transferees, monitor data.

---

## SCENE 3.1 — Processing a Late Enrollee (After Classes Open)

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time after class opening, through roughly March    │
│ WHERE  │ /settings → enrollment gate toggle → /apply → process  │
│ WHY    │ A student missed all enrollment periods due to a       │
│        │ family emergency, illness, or other legitimate cause   │
│ POLICY │ DO 017, s. 2025 §15 — Late enrollment accepted if      │
│        │ learner can attend ≥80% of school days remaining.      │
│        │ School head decides in edge cases.                     │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. School head authorizes the late enrollment in writing (physical document).
2. Registrar temporarily opens the Enrollment Gate (`ON`) — this is a deliberate act.
3. Applicant fills the form at `/apply`, or registrar fills it on their behalf.
4. Application reviewed and approved → section assigned.
5. Registrar immediately closes the gate again (`OFF`) after processing.
6. Notes in the physical enrollment logbook: *"Late enrollment authorized by School Head [name] on [date]."*

**Critical note:** The system does not prevent late enrollment technically — the gate toggle is the registrar's control. The registrar is responsible for ensuring the school head's authorization exists before opening the gate outside the scheduled periods.

---

## SCENE 3.2 — Mid-Year Transferee (After Classes Open)

Same flow as Scene 2.5. Gate opened → application submitted → application reviewed → approved → section assigned → gate closed.

Additional step for mid-year transfer: The registrar also notes in the record which quarter the learner entered so the class adviser can give appropriate catch-up work. This is noted in the physical records, not this system.

---

## SCENE 3.3 — Adjusting Section Capacity

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time — when school head approves more seats        │
│ WHERE  │ /sections → [Edit] on the section                      │
│ WHY    │ A section nearing capacity needs more slots to         │
│        │ accommodate approved applicants from the waiting list  │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Registrar clicks `[Edit]` on the target section.
2. Edit Dialog opens with current values.
3. Registrar changes `Max Capacity` from `45` to `48` (or whatever the school head approved).
4. Clicks **Save**.

**System:**
- `PUT /api/sections/:id` → updates `maxCapacity`.
- Capacity badge on the sections list immediately reflects the new value.
- `AuditLog`: `SECTION_UPDATED — "Admin updated capacity for Grade 11 STEM-A to 48"`.
- Sileo `success` toast: *"Section Updated."*

---

## SCENE 3.4 — Searching for a Student Record

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time during the school year                        │
│ WHERE  │ /students                                               │
│ WHY    │ A teacher asks "Which section is [student] in?" or a   │
│        │ parent calls asking for their child's section name.    │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Registrar types the student's LRN or name in the search bar.
2. Results appear after **300ms debounce** (no page reload, no search button needed).
3. Table shows: LRN, Full Name, Grade Level, Section, Status, Date Applied.
4. Registrar reads the section assignment and informs the teacher or parent.

**Example search — "Dela Cruz":**

```
STUDENTS    [ Dela Cruz                    🔍 ]

  LRN            │  Full Name            │  Grade   │  Section  │  Status    │  Applied
  ───────────────┼───────────────────────┼──────────┼───────────┼────────────┼──────────
  123456789012   │  Dela Cruz, Juan R.   │  Grade 7 │  Rizal    │  ✓ ENROLLED│  Feb 3
```

---

## SCENE 3.5 — Parent Calls to Track Application Status

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time during or after the enrollment period         │
│ WHERE  │ /track/:trackingNumber (public page — no login needed) │
│ WHY    │ Parents who submitted online can check their child's   │
│        │ current application status without calling the school. │
└─────────────────────────────────────────────────────────────────┘
```

**What the parent sees at `/track/HNS-2026-00042`:**

```
┌──────────────────────────────────────────────────────────────────┐
│          HINIGARAN NATIONAL HIGH SCHOOL                          │
│          Application Status Tracker                              │
│                                                                  │
│  Tracking Number:  HNS-2026-00042                                │
│                                                                  │
│  ✓  APPROVED & ENROLLED                                          │
│                                                                  │
│  Learner   :  DELA CRUZ, Juan Reyes                              │
│  Grade     :  Grade 7                                            │
│  Section   :  Grade 7 – Rizal                                    │
│  Applied   :  February 3, 2026                                   │
│  Approved  :  February 3, 2026                                   │
│                                                                  │
│  Please report to school during the enrollment week.            │
└──────────────────────────────────────────────────────────────────┘
```

**Registrar's role here:** Zero — this is a fully self-service public page. The system handles it. Registrar only needs to tell the parent the URL and their tracking number.

---

## SCENE 3.6 — Reading the Audit Log (Accountability & Compliance)

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time — on demand from the school head, auditor,   │
│        │ or in response to a complaint                          │
│ WHERE  │ /audit-logs                                             │
│ WHY    │ Every critical action is logged: who did what, when,  │
│        │ from which IP address, with what outcome               │
│ POLICY │ PRD §6.6 — Non-destructive. No delete endpoint.       │
│        │ All logs are permanent.                                │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees:**

```
AUDIT LOGS         [ Action Type: All ▾ ]   [ Date: Feb 1–3, 2026 ▾ ]

  Timestamp              │  User          │  Action Type              │  Description
  ───────────────────────┼────────────────┼───────────────────────────┼─────────────────────────────────────────────
  Feb 3, 2026  9:14 AM   │  Cruz, Regina  │  APPLICATION_APPROVED     │  Approved #42 → assigned to Grade 7 Rizal
  Feb 3, 2026  9:11 AM   │  Cruz, Regina  │  APPLICATION_SUBMITTED    │  Guest submitted application for Juan Dela Cruz (LRN: 123456789012)
  Feb 3, 2026  8:55 AM   │  Cruz, Regina  │  APPLICATION_APPROVED     │  Approved #41 → assigned to Grade 11 STEM-A
  Feb 2, 2026  4:30 PM   │  Cruz, Regina  │  SECTION_UPDATED          │  Updated capacity for Grade 7 Mabini to 48
  Feb 1, 2026  8:00 AM   │  Cruz, Regina  │  ENROLLMENT_GATE_TOGGLED  │  Admin set enrollment to OPEN
```

**Logged events for every critical action:**

| Action Type | When It Fires |
|---|---|
| `USER_LOGIN` | Every successful login |
| `APPLICATION_SUBMITTED` | When any applicant submits the public form |
| `APPLICATION_APPROVED` | When registrar approves + assigns section |
| `APPLICATION_REJECTED` | When registrar rejects with reason |
| `SECTION_CREATED` | When registrar creates a new section |
| `SECTION_UPDATED` | When registrar edits section name/capacity/teacher |
| `ENROLLMENT_GATE_TOGGLED` | Every open or close of the public portal |
| `SETTINGS_UPDATED` | School name, logo, or academic year changes |

**The audit log cannot be deleted** — no delete button, no delete API endpoint exists in the system.

---

---

# ═══════════════════════════════════════════
# ACT 4 — SHS SECOND SEMESTER (GRADE 12)
# ═══════════════════════════════════════════
## Period: December–January (within the school year)
## Purpose: Senior High School operates on semesters. Grade 12 must be formally enrolled for 2nd semester in DepEd LIS.
## Note: This is handled primarily in the external DepEd LIS system. This school system records the enrollment; the LIS update is done separately.

---

## SCENE 4.1 — Processing Grade 12 Second Semester Enrollment

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ December–January (typically before Christmas break or  │
│        │ first week back in January)                             │
│ WHERE  │ /students → locate Grade 12 learners                   │
│ WHY    │ SHS is semester-based. Grade 12 learners need a formal  │
│        │ enrollment record for Semester 2 in both this system   │
│        │ and DepEd LIS.                                          │
│ POLICY │ DO 017, s. 2025 §5.4 — Grade 12 is pre-registered.     │
│        │ Confirmation Slip (Annex C) required for official       │
│        │ enrollment of record in 2nd semester.                  │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Grade 12 learners submit their Confirmation Slips (same physical form as Grades 8–10).
2. Registrar processes each in the system — confirming their continued enrollment in the same section for Semester 2.
3. Section assignments do not change between 1st and 2nd semester for Grade 12 (learners stay in their strand section).
4. In DepEd LIS (external system), registrar accesses the SHS 2nd Semester Enrollment facility and encodes accordingly.

**In this system:** Grade 12 2nd Semester is a confirmation action — no new section assignment needed. The registrar simply confirms their status remains `ENROLLED` in the existing section.

---

---

# ═══════════════════════════════════════════
# ACT 5 — END OF YEAR & ARCHIVAL
# ═══════════════════════════════════════════
## Period: March–April (after March 31 class end)
## Purpose: Close the school year, verify final numbers, archive data, prepare for next cycle.

---

## SCENE 5.1 — Final Dashboard Review (End-of-Year Snapshot)

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ First week of April — after March 31 class end         │
│ WHERE  │ /dashboard                                              │
│ WHY    │ School head needs final enrollment numbers for the     │
│        │ annual report and for submission to the SDO            │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees and reports to the school head:**

```
╔══════════════════════════════════════════════════════════════════╗
║  HINIGARAN NATIONAL HIGH SCHOOL           SY 2026–2027  ACTIVE  ║
╠══════════════╦══════════════╦══════════════╦════════════════════╣
║  1,284       ║  0           ║  0           ║  0                 ║
║  ENROLLED    ║  PENDING     ║  APPROVED    ║  AT CAPACITY       ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Final Enrollment by Grade Level:                                ║
║   Grade 7   215  Grade 8  203  Grade 9  199                     ║
║   Grade 10  188  Grade 11 214  Grade 12 183   TOTAL: 1,202      ║
║                                                                  ║
║  NOTE: 1,284 enrolled vs 1,202 still in section. The difference ║
║  may represent drop-outs or transfers during the year —         ║
║  these would be handled through the DepEd LIS EOSY facility.   ║
╚══════════════════════════════════════════════════════════════════╝
```

**Steps:**
1. Registrar reviews all four stat cards — confirms zero pending, zero approved-awaiting.
2. Cross-checks bar chart totals by grade level with the physical enrollment logbook.
3. Identifies any remaining APPROVED applications (learners who got a slot but never confirmed in Phase 2) — resolves them by contacting parents or formally rejecting after no-show.
4. Screenshots or notes the final totals for the school head's EOSY report.

---

## SCENE 5.2 — Confirming Gate is Closed & No Outstanding Actions

**Steps:**
1. Registrar goes to `/settings → Tab 4: Enrollment Gate` — confirms it is **CLOSED**.
2. Goes to `/applications` → filters `Status: PENDING` — confirms zero.
3. Filters `Status: APPROVED` — resolves any remaining (contact parent or reject).
4. Runs a final audit log check for the last week of school — no unauthorized actions.

---

## SCENE 5.3 — Archiving the School Year (Activating Next Year)

When the registrar has already configured the next academic year (SY 2027–2028) in Act 0:

1. Navigate to `/settings → Tab 2: Academic Year`.
2. Click **[Activate]** on the `SY 2027–2028` row.
3. Confirm activation.

**What happens:**
- SY 2026–2027 → `ARCHIVED`. All data preserved permanently.
- SY 2027–2028 → `ACTIVE`. Dashboard, sections, and portal now operate under it.
- Historical data for SY 2026–2027 is still viewable — change the year context dropdown in `/sections` or `/students` to see past records.

**Outcome:** System is fully reset for the next annual cycle. The loop returns to **Act 0**.

---

---

# ═══════════════════════════════════════════
# SPECIAL SCENARIO: ADVISING TEACHER LOGIN
# ═══════════════════════════════════════════

## SCENE T.1 — Teacher Logs In and Views Their Section

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time during the school year                        │
│ WHERE  │ /login → /my-sections                                  │
│ WHY    │ Advising teachers need to see the list of students     │
│        │ officially enrolled in their section                   │
│ POLICY │ PRD §4 — TEACHER role has READ-ONLY access to their   │
│        │ assigned sections only. No approval/rejection access.  │
└─────────────────────────────────────────────────────────────────┘
```

**What the teacher sees after login:**

The sidebar shows a reduced menu — only Dashboard (limited) and **My Sections**. All registrar-only routes (`/applications`, `/settings`, `/sections` edit, `/audit-logs`) return `HTTP 403`.

```
MY SECTIONS

  Section         │  Grade    │  Enrolled  │  Available
  ────────────────┼───────────┼────────────┼──────────────
  Grade 7 – Rizal │  Grade 7  │  43        │  [View Class List]


[View Class List] → shows all enrolled students in this section:

  #   │  LRN             │  Full Name           │  Status
  ────┼──────────────────┼──────────────────────┼──────────
  1   │  123456789012    │  DELA CRUZ, Juan R.  │  ENROLLED
  2   │  234567890123    │  GARCIA, Ana M.      │  ENROLLED
  ...
```

**The teacher cannot:** approve applications, reject applications, change section capacity, view other sections, or access settings.

---

---

# APPENDIX A — Complete Applicant Status Lifecycle

```
                   APPLICANT SUBMITS FORM
                   (POST /api/applications)
                          │
                          ▼
                    ● PENDING
                    System assigns tracking number.
                    Parent receives "Application Received" email.
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
        ✓ APPROVED                ✗ REJECTED
        Registrar selects         Registrar enters
        section → enrollment      optional reason →
        record created.           parent notified
        Parent receives           by email.
        "Confirmed" email.        Parent may resubmit.
              │
              │  (Phase 2 physical doc verification)
              │
              ▼
         ✓ ENROLLED
         Official enrollment of record.
         Section assigned, capacity decremented.
              │
              │  (End of school year)
              │
              ▼
         ARCHIVED
         Read-only. Data permanent.
         Never deleted.
```

---

# APPENDIX B — Section Capacity Status Indicators

| Badge | Condition | Meaning | Registrar Action |
|---|---|---|---|
| `● Available` (green) | `enrolled < maxCapacity` | Slots open | Normal approvals |
| `⚠ Near Full` (amber) | `enrolled >= 86% of maxCapacity` | Approaching limit | Monitor; consider adding section |
| `✗ Full` (red) | `enrolled >= maxCapacity` | No slots | Cannot approve into this section; see Scene 1.7 |

---

# APPENDIX C — DO 017 Compliance Checklist for the Registrar

The registrar must **never** do the following. The system does not technically block all of these, so the registrar's knowledge is the safeguard:

| ❌ PROHIBITED ACTION | ✅ CORRECT ALTERNATIVE | Legal Basis |
|---|---|---|
| Reject applicant for missing PSA Birth Certificate | Enroll provisionally; collect by October 31 | DO 017, s. 2025; RA 11909 |
| Reject applicant for missing SF9 | Accept PEPT/A&E result or school certification letter | DO 017, s. 2025 §13 |
| Reject transferee due to unpaid private school fees | Enroll; assist with Affidavit of Undertaking | DO 017, s. 2025 §5.5 |
| Block enrollment of learner with disability | Enroll; coordinate with SPED/inclusive ed | RA 7277; DO 017 §5 |
| Require Good Moral Character certificate | Not a DepEd public school requirement | DO 017, s. 2025 §III |
| Withhold SF9 or SF10 for any reason | Issue immediately upon request | DO 017, s. 2025 §1.5 |
| Collect any fee during enrollment | All enrollment is FREE | DO 017 §II; RA 10533 |
| Create a duplicate LRN | Validate existing LRN before encoding in LIS | LIS Data Integrity Policy |
| Require PSA BC to be re-submitted annually | PSA BC collected ONCE per school | RA 11909; DO 017 §1.3 |

---

# APPENDIX D — Quick Grade-Level Reference for the Registrar

| Grade Level | Phase 1 Required? | Document | Phase 2 Action | Strand Required? |
|---|---|---|---|---|
| **Grade 7** | ✅ Yes | BEEF + PSA BC + Grade 6 SF9 | Confirm + section assign | No |
| **Grade 8** | ❌ Pre-registered | Confirmation Slip (Annex C) | Section assign | No |
| **Grade 9** | ❌ Pre-registered | Confirmation Slip (Annex C) | Section assign | No |
| **Grade 10** | ❌ Pre-registered | Confirmation Slip (Annex C) | Section assign | No |
| **Grade 11** | ✅ Yes | BEEF + PSA BC + Grade 10 SF9 + Strand | Confirm + strand section assign | ✅ Yes |
| **Grade 12** | ❌ Pre-registered | Confirmation Slip (Annex C) | Section assign; 2nd sem in Dec–Jan | No (continues from G11) |
| **Transferee (any)** | ✅ During Phase 1 window | BEEF + SF9 + LRN validation | Same as new entrant | If Grade 11/12 |
| **Balik-Aral (any)** | ✅ During Phase 1 window | Last SF9 (physical) or alternative | Same as new entrant | If Grade 11/12 |

---

*Storyboard prepared by: System Design Team*
*Sources: DepEd Order No. 017, s. 2025 · PRD v2.2.0 · RA 7797 as amended by RA 11480 · RA 11909*
*Covers: Full SY Cycle — Act 0 (Setup) through Act 5 (Year Close) + Special Scenarios*
*School: Hinigaran National High School · System: PERN Stack (PostgreSQL · Express · React · Node.js)*