# Registrar — Complete System Storyboard
## School Admission, Enrollment & Information Management System

**Document Version:** 3.0.0
**Document Type:** Full Workflow Storyboard — All Scenarios, All Screens
**Primary Actor:** School Registrar (role: `REGISTRAR`)
**Supporting Actor:** System Administrator (role: `SYSTEM_ADMIN`)
**Policy Basis:** DepEd Order No. 017, s. 2025 — Revised Basic Education Enrollment Policy
**System Reference:** PRD v3.0.0 (PERN Stack — PostgreSQL · Express · React · Node.js)
**Modules Covered:** Admission (Online + F2F) · Enrollment Management · SIMS · Teacher Management · Grade Level & Sectioning Management

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

Scenes are organized into **six acts** that map to the real DepEd school year, plus a special scenarios section:

| Act | Title | Real-World Period |
|---|---|---|
| **Act 0** | System Setup & Annual Rollover | April–January (off-peak preparation) |
| **Act 1** | Phase 1 — Early Registration | Last Saturday of January → Last Friday of February |
| **Act 2** | Phase 2 — Regular Enrollment | ~1 week before class opening in June |
| **Act 3** | Active School Year — Ongoing Operations | June → March |
| **Act 4** | SHS Second Semester | December–January |
| Act 5 | End of Year & Archival | March–April |

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
                                         New AY config · Sections
                                         Teachers · SCP Programs
                                            │
                                         JUNE (1 week before opening)
                                         │◄─ PHASE 2: REGULAR ENROLLMENT ─►│
                                         │  All grade levels confirm        │
                                         │  G8/9/10/12 confirmation slips   │
                                         │  G7/G11 section finalization     │
                                            │
                                         JUNE (First Monday)
                                         CLASSES OPEN — ACT 3 BEGINS
                                         Ongoing: F2F walk-ins, transferees,
                                         late enrollees, SIMS record edits
                                            │
                                         DECEMBER–JANUARY
                                         ACT 4: SHS 2nd Semester (G12)
                                            │
                                         MARCH 31 — CLASSES END — ACT 5
```

---

## System Navigation Map — Registrar's Full Menu

```
[SIDEBAR — always visible on desktop ≥1024px; hamburger drawer on mobile]
│
├─ 📊  /dashboard       — Stats, charts, SCP pipeline, recent activity
│
├─ 👤+ /f2f-admission   — Walk-in (F2F) admission entry (NEW)
│
├─ 📋  /applications    — All applications (Online + F2F); approve/reject/enroll/SCP workflow
│
├─ 👤  /students        — Full SIMS: search, view, and edit any student record
│
├─ 🎓  /teachers        — Teacher directory; create profiles; provision system accounts
│
├─ 🏫  /sections        — Section CRUD; capacity monitor; teacher assignment
│
├─ 📜  /audit-logs      — Full immutable activity log
│
└─ ⚙️   /settings       — 4 tabs:
         Tab 1: School Profile  (logo, school name, division, region)
         Tab 2: Academic Year   (create, activate, archive; smart date auto-fill)
         Tab 3: Grade Levels, Strands & SCP Programs
         Tab 4: Enrollment Gate (open/close public portal)

[PUBLIC-FACING — not the registrar's screen, but the registrar monitors it]
│
├─ /apply              — Online admission form (open when gate is ON)
├─ /closed             — Shown when gate is OFF; contains "Staff Login" link
└─ /track/:trackingNo  — Applicant self-service status lookup
```

> **Dynamic rule:** All school-specific values — school name, logo, grade levels, strand options, SCP programs — are read from the database at runtime. No page in this system has any school name, division, or grade level hardcoded.

---

---

# ═══════════════════════════════════════════
# ACT 0 — SYSTEM SETUP & ANNUAL ROLLOVER
# ═══════════════════════════════════════════
## Period: April (after classes end March 31) through January (before Early Registration opens)
## Purpose: Build the scaffold for the incoming school year before the public portal opens.

---

## SCENE 0.1 — First Login (with Layer 1 & Layer 2 Security Gates)

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time — typically April after the school year ends  │
│ WHERE  │ /login (reached via the "Staff Login" link only)       │
│ WHY    │ Registrar needs authenticated access to all modules    │
│ POLICY │ JWT-based auth; 8-hour token expiry (PRD §9)           │
└─────────────────────────────────────────────────────────────────┘
```

**How to reach the login page (Layer 1):**

The `/login` route is **not directly accessible** by URL. Typing `/login` in the address bar redirects to `/` (the public portal or closed page). The only valid entry points are:

1. Clicking **"Staff Login"** in the footer of `/apply` or `/closed` (injects `{ loginAccess: true }` navigation state)
2. Being redirected by `ProtectedRoute` after attempting to visit a dashboard route while unauthenticated
3. Being redirected by the Axios interceptor after a session expires (401 response)

This is by design — the login page is a staff tool, not a publicly bookmarkable URL.

**What the registrar sees:**
The login page renders full-screen, centered. It shows:
- The school logo (if already uploaded) and school name — **always from `SchoolSettings`, never hardcoded**
- An email field, a password field, and a "Sign In" button
- No registration link — accounts are created by the System Administrator only

**Steps:**
1. Registrar clicks **"Staff Login"** from the public portal footer.
2. `/login` opens (Layer 1 gate passed via navigation state).
3. The page silently fetches a one-time pre-flight token from `GET /api/auth/login-token` (Layer 2 — invisible to the user, happens on mount).
4. Registrar enters their email address and password.
5. Clicks **Sign In**.

**System:**
- `POST /api/auth/login` with `{ email, password, loginToken }` (Layer 2 token included).
- `validateLoginToken` middleware verifies the token, marks it as used — **any direct API call without this token returns 400**.
- `bcrypt.compare(password, user.password)` — 12 salt rounds.
- On success → JWT signed `{ userId, role: 'REGISTRAR', mustChangePassword }` with 8-hour expiry.
- Zustand `authStore.setAuth(token, user)` → persisted in `localStorage`.
- If `mustChangePassword = true` (first login): React Router redirects to `/change-password`.
- Otherwise: React Router redirects to `/dashboard`.
- `AuditLog` entry: `USER_LOGIN — "User [email] logged in from [IP]"`.
- Sileo `success` toast: *"Welcome back, [Name]."*

**Outcome:** Registrar is authenticated and lands on the Dashboard (or forced password change screen on first login).

**Edge — Wrong password:** Sileo `error` toast: *"Invalid email or password."* Rate-limited to 20 req/min.
**Edge — Login token expired:** Token has a 5-minute TTL. If the page sits idle > 5 min before submitting, the page auto-fetches a fresh token on submit. The user never sees this.

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
║  [SchoolSettings.schoolName]     SY 2025–2026  ACTIVE           ║
╠══════════════╦══════════════╦══════════════╦════════════════════╣
║  1,243       ║  0           ║  0           ║  0                 ║
║  ENROLLED    ║  PENDING     ║  APPROVED    ║  SECTIONS          ║
║              ║  Applications║  Awaiting    ║  At Capacity       ║
╠══════════════╩══════════════╩══════════════╩════════════════════╣
║  [BAR CHART — Enrollment by Grade Level]                         ║
║  [DONUT CHART — Status Distribution]                             ║
║  [DONUT CHART — Online vs F2F Admission]                         ║
║                                                                  ║
║  RECENT ACTIVITY                                                 ║
║  • Mar 31  Registrar [Name]  ENROLLMENT_GATE_TOGGLED → CLOSED   ║
║  • Mar 30  Registrar [Name]  APPLICATION_APPROVED → #1243       ║
╚══════════════════════════════════════════════════════════════════╝
```

> Note: All text shown in `[brackets]` above is dynamically sourced from `SchoolSettings` or the active `AcademicYear`. No school name, grade label, or section name is hardcoded.

**Steps:**
1. Registrar reads the final enrollment count.
2. Notes pending and approved are zero — the school year is fully closed.
3. Reviews the grade-level bar chart and the Online vs F2F breakdown chart.
4. Proceeds to Settings to begin configuring the next school year.

---

## SCENE 0.3 — Creating the New Academic Year Record

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ April–May — after current SY ends                      │
│ WHERE  │ /settings → Tab 2: Academic Year                       │
│ WHY    │ System needs a year record before sections, grade       │
│        │ levels, and SCP programs can be configured             │
│ POLICY │ One academic year active at a time (PRD §6.8)          │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Registrar clicks **+ New Academic Year**.
2. Dialog opens with a single field: Year Label (e.g., `2026–2027`).
3. Registrar types the year label and clicks **Create Year**.

**System:**
- Smart auto-fill: the system calculates `classStart` (first Monday of June), `classEnd` (March 31), `phase1Start` (last Saturday of January), `phase1End` (last Friday of February), `phase2Start` (~1 week before class opening) — all from the typed year label.
- A confirmation dialog shows the auto-filled dates for the registrar to verify before saving.
- `POST /api/academic-years` → new `AcademicYear` record with `isActive: false`.
- `AuditLog`: `ACADEMIC_YEAR_CREATED`.
- Sileo toast: *"Academic Year Created — SY 2026–2027 has been added."*

**Outcome:** SY 2026–2027 exists as an inactive scaffold. SY 2025–2026 remains active.

> ⚠️ **Critical:** Do NOT activate the new year yet. Grade levels, strands, SCP programs, teachers, and sections must all be built first. Activation happens in Scene 0.8.

---

## SCENE 0.4 — Configuring Grade Levels for the New Academic Year

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ April–May — immediately after Scene 0.3               │
│ WHERE  │ /settings → Tab 3: Grade Levels & Strands              │
│ WHY    │ Grade levels are the base unit — sections, SCP         │
│        │ programs, and applicant routing all depend on them     │
│ POLICY │ DepEd K-12 framework (RA 10533)                        │
└─────────────────────────────────────────────────────────────────┘
```

The tab has a year-context dropdown at the top. Registrar must switch to `SY 2026–2027` first.

**Steps:**
1. Switch year context to `SY 2026–2027`.
2. Click **+ Add Grade Level** for each grade the school offers.
3. For each entry: Grade Level Name (e.g., "Grade 7") and Display Order (1–6).

**Grade levels the registrar adds (example for a standard secondary school):**

| Grade Level Name | Display Order | `requiresEarlyReg` |
|---|---|---|
| Grade 7  | 1 | ✅ Yes |
| Grade 8  | 2 | ❌ No (pre-registered) |
| Grade 9  | 3 | ❌ No |
| Grade 10 | 4 | ❌ No |
| Grade 11 | 5 | ✅ Yes |
| Grade 12 | 6 | ❌ No |

> **School-agnostic:** A JHS-only school adds only Grades 7–10. A school with a non-standard structure can configure whatever grade names apply. The admission form, filters, and section management all read from this list dynamically.

**System:** `POST /api/grade-levels` per entry → cascade-linked to `SY 2026–2027`.

**Outcome:** Grade levels configured. The admission portal's grade-level dropdown will show exactly these grades when the portal opens.

---

## SCENE 0.5 — Configuring Strands and SCP Programs

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ April–May — immediately after Scene 0.4               │
│ WHERE  │ /settings → Tab 3: Grade Levels & Strands (three       │
│        │ sub-tabs: Grade Levels · Strands · SCP Programs)       │
│ WHY    │ Strands drive the Grade 11 admission form. SCP         │
│        │ programs drive the SCP type dropdown and the entire    │
│        │ SCP workflow in /applications.                          │
│ POLICY │ DM 012, s. 2026 (SHS tracks) · DM 149, s. 2011 (SCPs)│
└─────────────────────────────────────────────────────────────────┘
```

### Sub-tab A: Strands

**Steps:**
1. Still on `SY 2026–2027` context. Click **Strands** sub-tab. Click **+ Add Strand**.
2. Fill in: Strand Name · Track (Academic / TechPro) · Applicable Grade Levels (checkboxes).
3. Save each strand.

**Example — school offers Academic track only:**

| Strand Name | Track | Applicable Grades |
|---|---|---|
| STEM | Academic | Grade 11, Grade 12 |
| ABM  | Academic | Grade 11, Grade 12 |
| HUMSS | Academic | Grade 11, Grade 12 |
| GAS  | Academic | Grade 11, Grade 12 |

> **School-agnostic:** A school offering TechPro adds ICT, HospTour, etc. A school offering no SHS leaves this sub-tab empty — no strand fields will appear in the admission form or filters.

**System:** `POST /api/strands` → `{ name, track, applicableGradeLevelIds, academicYearId }`.

### Sub-tab B: SCP Programs

**Steps:**
1. Click **SCP Programs** sub-tab. Click **+ Add SCP Program**.
2. Fill in each SCP the school offers:

| SCP Code | Full Name | Assessment Type | Requires Interview | Applicable Grades |
|---|---|---|---|---|
| STE | Science, Technology, Engineering | EXAM_ONLY | No | Grade 7–10 |
| SPA | Special Program in the Arts | EXAM_AUDITION | Yes | Grade 7–10 |

**If the school offers no SCP programs:** leave this sub-tab empty. The SCP dropdown will not appear anywhere — not in `/apply`, not in `/f2f-admission`, not in the `/applications` filter. The system adapts automatically.

**System:** `POST /api/scp-programs` → `{ code, name, assessmentType, requiresInterview, applicableGradeLevelIds, academicYearId }`.

**Outcome:** The admission form, F2F form, and applications inbox all reflect exactly what this school has configured — no hardcoded SCP lists anywhere.

---

## SCENE 0.6 — Building All Sections

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ April–May — after grade levels, strands, and SCP       │
│        │ programs are configured                                 │
│ WHERE  │ /sections                                               │
│ WHY    │ Sections are the physical classrooms. The enrollment   │
│        │ approval workflow requires at least one section per    │
│        │ grade level before any applicant can be enrolled.      │
│ POLICY │ PRD §6.7 — sections have name, capacity, grade level, │
│        │ optional advising teacher, optional SCP code           │
└─────────────────────────────────────────────────────────────────┘
```

**Create Section dialog:**

```
┌─────────────────────────────────────────────────────┐
│  Create Section                                      │
│  ─────────────────────────────────────────────────  │
│  Grade Level *                                       │
│  [ Grade 7                                    ▾ ]    │
│  (loaded from active AY grade levels)                │
│                                                      │
│  Section Name *                                      │
│  [ Rizal                                        ]    │
│                                                      │
│  Max Capacity *                                      │
│  [ 45                                           ]    │
│                                                      │
│  Advising Teacher (optional)                         │
│  [ Santos, Caridad                            ▾ ]    │
│  (loaded from Teacher directory — see Scene 0.7)     │
│                                                      │
│  SCP Code (optional — for designated SCP sections)   │
│  [ STE                                        ▾ ]    │
│  (loaded from active AY SCP programs)                │
│                                                      │
│           [Cancel]        [Create Section]           │
└─────────────────────────────────────────────────────┘
```

> **Advising teacher assignment** pulls from the **Teacher directory** (`/teachers`), not from the User table directly. This ensures only teachers with complete profiles (name, employee ID) are assigned. See Scene 0.7 for teacher setup.

**System:** `POST /api/sections` → `{ name, maxCapacity, gradeLevelId, advisingTeacherId, scpCode }`.
- `advisingTeacherId` references `Teacher.id`, not `User.id`.
- `AuditLog`: `SECTION_CREATED` for each section.

**Outcome:** All sections are built. The enrollment approval workflow is now fully operational.

---

## SCENE 0.7 — Managing the Teacher Directory

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time — typically before building sections (Scene   │
│        │ 0.6) so teachers are available in the adviser dropdown │
│ WHERE  │ /teachers                                               │
│ WHY    │ Teacher profiles are the source of truth for section   │
│        │ adviser assignment. They also optionally hold system   │
│        │ login accounts (role: TEACHER) for My Sections access. │
│ POLICY │ PRD §6.6 — Teacher module; REGISTRAR can create        │
│        │ profiles and provision login accounts                  │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees at `/teachers`:**

```
TEACHERS                                              [ + Create Teacher ]

  Employee ID   │  Full Name           │  Specialization │  Sections  │  Account      │  Actions
  ──────────────┼──────────────────────┼─────────────────┼────────────┼───────────────┼──────────
  101-458-2021  │  Santos, Caridad M.  │  Mathematics    │  2 sections│  ● Active     │  [View]
  101-789-2020  │  Reyes, Miguel A.    │  Science        │  1 section │  ● Active     │  [View]
  —             │  Flores, Luisa B.    │  English        │  0 sections│  No Account   │  [View]
```

### Creating a Teacher Profile

**Steps:**
1. Click **+ Create Teacher**.
2. Fill in: Last Name, First Name, Middle Name, Employee ID (DepEd), Contact Number, Specialization.
3. Click **Save**.

**System:**
- `POST /api/teachers` → new `Teacher` record.
- `AuditLog`: `TEACHER_CREATED — "Registrar [name] added teacher [name] (EmpID: [id])"`.
- Sileo toast: *"Teacher Created."*

The teacher profile now appears in the **Advising Teacher** dropdown when creating or editing sections.

### Provisioning a System Login Account

A teacher profile can exist without a login account (used only for section assignment). When the teacher needs to view their class roster via `/my-sections`, the registrar provisions an account:

**Steps from the teacher profile (`/teachers/:id` → Tab 3: System Account):**
1. Click **Provision System Account**.
2. Enter the teacher's email address.
3. Click **Create Account**.

**System:**
- Creates a `User` record with `role: TEACHER`, `mustChangePassword: true`, auto-generated temporary password.
- Links `Teacher.userId` to the new `User.id`.
- Sends a welcome email using `SchoolSettings.schoolName` in the subject — **never a hardcoded school name**.
- `AuditLog`: `TEACHER_ACCOUNT_PROVISIONED — "Registrar [name] provisioned login for teacher [name]"`.
- Sileo toast: *"Account Created — [Teacher Name] will receive login instructions by email."*

**Teacher's first-login experience:** Teacher receives the welcome email with a temporary password. On first login, they are redirected to `/change-password`. After setting a new password, they land on `/dashboard` (limited) and `/my-sections`.

### Editing a Teacher Profile

**From `/teachers/:id` → Tab 1: Profile:**
- Edit Name, Employee ID, Contact Number, Specialization.
- `AuditLog`: `TEACHER_UPDATED`.

### Deactivating a Teacher Account

If a teacher leaves the school:
1. Go to `/teachers/:id` → Tab 3: System Account.
2. Click **Deactivate Account**.
3. Confirm. The teacher's `User.isActive` is set to `false`.
4. The teacher's very next API call returns 401 — they are effectively logged out.
5. Their sections remain assigned; the registrar can reassign them at any time.

**Outcome:** Teacher directory is populated. All teachers appear in the section adviser dropdown. Teachers with accounts can log in and view their assigned sections.

---

## SCENE 0.8 — Updating School Identity (Logo & School Name)

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time — typically at initial setup                  │
│ WHERE  │ /settings → Tab 1: School Profile                      │
│ WHY    │ The school name and logo appear on the public portal,  │
│        │ login page, email notifications, and the dashboard     │
│        │ header. Division and region appear in the privacy      │
│        │ notice on both the online and F2F admission forms.     │
│ POLICY │ PRD §3.2 — logo dominant color extracted and applied   │
│        │ as the system's accent color across all modules        │
└─────────────────────────────────────────────────────────────────┘
```

**Fields in Tab 1:**

```
SETTINGS > School Profile

  School Name *
  [ _________________________________ ]      [Save]

  DepEd School ID (optional)
  [ ____________ ]

  Schools Division
  [ _________________________________ ]

  Region
  [ _________________________________ ]

  School Logo
  ┌───────────────────────────────┐
  │  [current logo thumbnail]     │   PNG · JPG · WEBP · max 2MB
  └───────────────────────────────┘
  [Change Logo]

  Accent Color Preview
  Extracted from logo: ██████  HSL(221 83% 53%)  (default blue)
```

**Logo upload steps:**
1. Click **Change Logo** → OS file picker.
2. Select PNG/JPG/WEBP (< 2MB).
3. Client-side preview appears immediately.
4. Click **Save** to submit.

**System:**
- `POST /api/settings/logo` (multipart/form-data via Multer, MIME + size validation).
- Server: `color-thief-node` extracts the dominant chromatic color → stored as `SchoolSettings.colorScheme.accent_hsl`.
- API returns `{ logoUrl, colorScheme }`.
- Zustand `settingsStore` updates → `RootLayout` `useLayoutEffect` fires → CSS variable `--accent` (and all aliases) override.
- The entire dashboard, sidebar, public portal, F2F form, and all interactive elements repaint to the school's brand color.
- `--background`, `--card`, `--foreground`, `--border` are **never touched** — the white layout is permanent.
- `AuditLog`: `SCHOOL_SETTINGS_UPDATED`.
- Sileo toast: *"Logo updated. Accent color applied from logo."*

> **Why this matters for all 5 modules:** The school name appears in every email subject, the privacy notice on both admission forms, the sidebar header, and the dashboard. The accent color appears on every button, active nav item, and focus ring across all five modules. These are runtime configuration — not hardcoded anywhere.

---

## SCENE 0.9 — Activating the New Academic Year

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ May–January — after all setup is complete              │
│ WHERE  │ /settings → Tab 2: Academic Year                       │
│ WHY    │ Activating the year makes it the operating context:    │
│        │ dashboard shows its stats, portal labels applications  │
│        │ under it, sections become live for enrollment.         │
│ POLICY │ Only one active year at a time; transaction-safe swap  │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Click **[Activate]** next to `2026–2027`.
2. Confirmation dialog warns: "SY 2025–2026 will be moved to ARCHIVED. This cannot be undone."
3. Registrar confirms: **Yes, Activate**.

**System:**
```sql
BEGIN TRANSACTION;
  UPDATE academic_years SET is_active = false WHERE is_active = true;
  UPDATE academic_years SET is_active = true  WHERE id = [2026–2027 id];
  UPDATE school_settings SET active_academic_year_id = [2026–2027 id];
COMMIT;
```
- Dashboard header updates immediately to `SY 2026–2027 ● ACTIVE`.
- `AuditLog`: `ACADEMIC_YEAR_ACTIVATED`.

**Outcome:**
- SY 2026–2027 is the live operating year.
- SY 2025–2026 is ARCHIVED — preserved and viewable, no modifications.
- The Enrollment Gate is still `CLOSED`. Portal not yet open to the public.

---

---

# ═══════════════════════════════════════════
# ACT 1 — PHASE 1: EARLY REGISTRATION
# ═══════════════════════════════════════════
## Period: Last Saturday of January → Last Friday of February
## Purpose: Pre-registration of incoming Grade 7, Grade 11, transferees, Balik-Aral.
## Legal Status: Pre-registration ONLY — not official enrollment.

---

## SCENE 1.1 — Opening the Enrollment Gate

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Last Saturday of January (e.g., January 31, 2026)      │
│ WHERE  │ /settings → Tab 4: Enrollment Gate                     │
│ WHY    │ The online portal must be turned on so parents can      │
│        │ submit online applications. F2F admission is always     │
│        │ available regardless of this gate.                      │
│ POLICY │ DO 017, s. 2025 — Early Registration opens last        │
│        │ Saturday of January.                                    │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees:**

```
SETTINGS > Enrollment Gate

  ┌───────────────────────────────────────────────────────────────┐
  │  Enrollment Portal — Online Admission                          │
  │                                                               │
  │  ○────────────   OFF   (current state)                        │
  │  Status: ● CLOSED                                             │
  │                                                               │
  │  When OPEN: the public /apply portal accepts applications     │
  │  When CLOSED: /apply redirects to /closed                     │
  │                                                               │
  │  Note: Face-to-face (walk-in) admission at /f2f-admission    │
  │  is unaffected by this gate — always accessible to staff.    │
  └───────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Registrar clicks the toggle → `ON`.
2. Confirmation dialog: *"This will open the public online admission portal. Proceed?"*
3. Confirms.

**System:**
- `PATCH /api/settings/enrollment-gate` → `{ enrollmentOpen: true }`.
- `AuditLog`: `ENROLLMENT_GATE_TOGGLED — "Registrar [name] opened the enrollment gate"`.
- `/apply` is now accessible to the public.
- `/f2f-admission` was already accessible and remains so.

---

## SCENE 1.2 — The Applications Inbox During Early Registration

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Daily during Early Registration (January–February)     │
│ WHERE  │ /applications                                           │
│ WHY    │ The registrar's primary daily workspace during this     │
│        │ period. Applications arrive from both channels:        │
│        │ Online (/apply) and Walk-in (/f2f-admission).          │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees — the updated applications inbox:**

```
APPLICATIONS    [ Search by LRN or name... 🔍 ]   [Filter ▾]

  Year: SY 2026–2027   Grade: All ▾   Type: All ▾   Status: All ▾   Channel: All ▾

  #   │ Learner Name          │ LRN          │ Grade    │ Type      │ Channel  │ Status      │ Actions
  ────┼───────────────────────┼──────────────┼──────────┼───────────┼──────────┼─────────────┼────────
  055 │ Dela Cruz, Juan R.    │ 123456789012 │ Grade 7  │ REGULAR   │ Online   │ ● PENDING   │ [View]
  054 │ Santos, Maria L.      │ 876543219012 │ Grade 11 │ STEM G11  │ Walk-in  │ ● PENDING   │ [View]
  053 │ Reyes, Pedro M.       │ 112233445566 │ Grade 7  │ STE       │ Online   │ ● PENDING   │ [View]
  052 │ Garcia, Ana B.        │ 998877665544 │ Grade 7  │ SPA(Dance)│ Walk-in  │ ⏳EXAM_SCHED│ [View]
  051 │ Torres, Carlo M.      │ 444433332222 │ Grade 7  │ STE       │ Online   │ ✅ PASSED   │ [View]
```

**Channel badge:** "Online" (globe icon) · "Walk-in" (person icon with +). Filterable.

**Registrar's daily routine:**
1. Filter by `Status: PENDING` to isolate unprocessed applications.
2. Filter by `Channel: Walk-in` when processing F2F applications entered by the registrar.
3. Process each application — approve, reject, or for SCP applicants, schedule exam (see Scenes 1.3–1.8).

---

## SCENE 1.3 — Opening and Approving a Regular Grade 7 Application

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ During Early Registration review                       │
│ WHERE  │ /applications → click [View] on a PENDING regular app  │
│ WHY    │ Registrar verifies submitted data before approving.    │
│        │ Physical document verification happens at the counter; │
│        │ the system is the digital record.                       │
│ POLICY │ DO 017, s. 2025 — Grade 7 requires BEEF + Grade 6     │
│        │ SF9 + PSA Birth Certificate (once-only)                │
└─────────────────────────────────────────────────────────────────┘
```

**Application detail panel:**

```
╔══════════════════════════════════════════════════════════════════════╗
║  APPLICATION DETAIL                                                  ║
║  #APP-2026-00055                              Status: ● PENDING      ║
║  Channel: Online ● (submitted via /apply)                            ║
╠══════════════════════════════════════════════════════════════════════╣
║  PERSONAL INFORMATION                                                ║
║  Full Name    :  DELA CRUZ, Juan Reyes                               ║
║  Date of Birth:  March 12, 2014  (Age: 11 yrs, 10 months)           ║
║  Sex          :  Male                                                ║
║  LRN          :  123456789012                                        ║
║                                                                      ║
║  FAMILY & CONTACT                                                    ║
║  Home Address :  123 [Street], [Barangay], [Municipality], [Province]║
║  Guardian     :  Maria Dela Cruz (Mother)                            ║
║  Contact No.  :  0917-123-4567                                       ║
║  Email        :  delacruz.maria@gmail.com                            ║
║                                                                      ║
║  ENROLLMENT PREFERENCE                                               ║
║  Grade Level  :  Grade 7      Program: Regular Admission             ║
╠══════════════════════════════════════════════════════════════════════╣
║         [ Approve & Assign Section ]    [ Reject Application ]       ║
╚══════════════════════════════════════════════════════════════════════╝
```

**Registrar verification checklist:**

| Check | Criterion |
|---|---|
| LRN format | Exactly 12 digits |
| Age | ~11–13 years for Grade 7 |
| Grade level match | Applying for Grade 7 |
| PSA Birth Certificate | Verified in person; PSA# noted |
| Grade 6 SF9 | Present; signed by sending school head |

**Registrar clicks Approve & Assign Section. Section dialog opens:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Assign Section                                                   │
│  Juan Dela Cruz  ·  Grade 7                                      │
│  ────────────────────────────────────────────────────────────── │
│  Available sections for Grade 7:                                 │
│  ○  Rizal       Ms. Santos    38/45  ● 7 slots                  │
│  ○  Bonifacio   Mr. Reyes     41/45  ● 4 slots                  │
│  ○  Luna        Ms. Flores    44/45  ⚠ 1 slot                   │
│  ✗  Mabini      Mr. Torres    45/45  ✗ FULL (disabled)           │
│                                                                  │
│           [ Cancel ]     [ Confirm Enrollment ]                  │
└──────────────────────────────────────────────────────────────────┘
```

**System — Race-Condition-Safe Transaction:**
```
POST /api/applications/55/approve  { sectionId: [Rizal ID] }

  BEGIN TRANSACTION;
    SELECT id, "maxCapacity" FROM "Section"
    WHERE id = [Rizal ID] FOR UPDATE   ← row-level lock prevents race conditions
    COUNT enrollments WHERE sectionId = [Rizal ID]  → 38
    38 < 45 → OK
    INSERT INTO enrollments { applicantId: 55, sectionId, enrolledById: [reg ID] }
    UPDATE applicants SET status = 'APPROVED' WHERE id = 55
  COMMIT;

  AuditLog: APPLICATION_APPROVED — "Registrar approved #055 → Grade 7 Rizal"

  setImmediate(() => sendEmail(to: delacruz.maria@gmail.com,
    subject: "Congratulations! Your Enrollment is Confirmed — [SchoolSettings.schoolName]"))
```

**Email subject uses `SchoolSettings.schoolName` — never a hardcoded school name.**

**Outcome:** Application shows `✓ APPROVED`. Section capacity: 39/45. Parent receives confirmation email.

---

## SCENE 1.4 — Entering a Walk-In Application via F2F Admission

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time a parent walks in to apply in person          │
│ WHERE  │ /f2f-admission                                          │
│ WHY    │ The parent did not apply online. The registrar enters  │
│        │ the application directly on behalf of the applicant.   │
│ POLICY │ DO 017, s. 2025 — enrollment may be done in-person     │
│        │ (Mode A). F2F route is unaffected by the enrollment    │
│        │ gate — always accessible to REGISTRAR.                 │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees at `/f2f-admission`:**

```
WALK-IN ADMISSION                         [WALK-IN (F2F) badge]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  PHYSICAL CONSENT CONFIRMATION
  ────────────────────────────────────────────────────────────────
  ☐  The applicant / parent / guardian has physically signed the
     RA 10173 Data Privacy Consent form and a copy has been
     retained on file. *  (Required before submission)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  A. PERSONAL INFORMATION
  ─ (all BEEF fields in a 2-column grid) ─

  B. FAMILY & CONTACT
  ─ (guardian, contact, email — email is optional for F2F) ─

  C. BACKGROUND & CLASSIFICATION
  ─ (IP, 4Ps, PWD checkboxes + conditional sub-fields) ─

  D. PREVIOUS SCHOOL
  ─ (last school, grade completed, general average) ─

  E. ENROLLMENT PREFERENCES
  ─ Grade Level: [dropdown from active AY — dynamic, not hardcoded] ─
  ─ SCP Program: [only shown if SCP programs are configured] ─
  ─ Strand:      [only shown if SHS grade level selected] ─

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ Save as Pending ]         [ Save as Approved ]
  (docs need further review)  (all docs verified in person now)
```

**Key differences from the online form:**
- Auth required (REGISTRAR or SYSTEM_ADMIN JWT)
- Always accessible — the enrollment gate (`enrollmentOpen`) does not affect this route
- All sections on one scrollable page (no wizard steps)
- "Save as Approved" fast-track button: sets `status = APPROVED` immediately if all documents are verified at the counter
- Physical consent checkbox replaces the online scroll-to-consent gate
- Email field is optional — if left blank, no notification is sent; registrar prints or notes the tracking number

**Steps:**
1. Parent arrives at the registrar's window.
2. Registrar checks the physical consent checkbox (after showing the applicant/parent the RA 10173 notice).
3. Fills in all fields on behalf of the parent/applicant.
4. Verifies documents (Grade 6 SF9, PSA BC, etc.) in person.
5. If documents are complete: clicks **Save as Approved** → section assignment dialog opens immediately.
6. If documents need follow-up: clicks **Save as Pending** → applicant can bring remaining docs later.

**System (`POST /api/applications/f2f`):**
- `admissionChannel: 'F2F'` stored on the `Applicant` record.
- `encodedById: req.user.userId` stored — the registrar's user ID.
- All other validation rules are identical to the online form.
- `AuditLog`: `F2F_APPLICATION_ENTERED — "Registrar [name] entered walk-in application for [LRN], Tracking #[n]"`.
- If email provided: confirmation email sent (same template as online, using `SchoolSettings.schoolName`).
- Sileo toast: *"Walk-in Application Saved — Tracking #APP-2026-00198."*

**Outcome:** Walk-in application appears in `/applications` inbox with a "Walk-in" channel badge. Indistinguishable from an online application in terms of data — only the `admissionChannel` field differs.

---

## SCENE 1.5 — Approving a Grade 11 Application (SHS — Strand-Sensitive)

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ During Early Registration review                       │
│ WHERE  │ Application detail → Grade 11 applicant               │
│ WHY    │ Grade 11 approval requires strand-matched section      │
│        │ selection. The section dialog shows all Grade 11       │
│        │ sections; the registrar's judgment picks the right one.│
└─────────────────────────────────────────────────────────────────┘
```

Identical flow to Scene 1.3, with two differences:
1. The application detail shows **SHS Track** and **Elective Cluster** (loaded from configured strands for Grade 11).
2. The section assignment dialog lists all Grade 11 sections. The registrar selects the section matching the applicant's declared strand/cluster. The system does not filter by strand — section assignment is the registrar's judgment call.

---

## SCENE 1.6 — Rejecting an Application

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ When a data integrity issue is found (duplicate LRN,  │
│        │ fictitious information, already enrolled)              │
│ WHERE  │ Application detail view → "Reject Application"        │
│ POLICY │ DO 017, s. 2025: Rejection is NEVER for missing docs, │
│        │ disability, or unpaid fees. Only for verified data     │
│        │ integrity failures.                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Registrar clicks **Reject Application**.
2. Rejection dialog opens with an optional (but strongly recommended) reason textarea.
3. Registrar types a clear, actionable reason.
4. Clicks **Confirm Rejection**.

**System:**
- `PATCH /api/applications/:id/reject` → `{ rejectionReason }`.
- `Applicant.status = 'REJECTED'`.
- `AuditLog`: `APPLICATION_REJECTED`.
- Email dispatched with the rejection reason and instructions to resubmit if applicable.
- Subject uses `SchoolSettings.schoolName` — never hardcoded.

**When rejection is NOT appropriate:**
- ❌ PSA BC missing → Approve provisionally; collect by October 31.
- ❌ Grade 6 SF9 missing → Accept PEPT result or school certification letter.
- ❌ Unpaid fees at previous school → Enroll + Affidavit of Undertaking.
- ❌ Learner has a disability → Never reject for this reason.

---

## SCENE 1.7 — Monitoring Section Capacity

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Daily during Early Registration                        │
│ WHERE  │ /sections                                               │
│ WHY    │ Registrar tracks which sections are filling up and     │
│        │ makes proactive decisions                               │
└─────────────────────────────────────────────────────────────────┘
```

**Section list view with capacity bars:**

```
SECTIONS                      Year: [ SY 2026–2027 ▾ ]

  Grade 7
  ┌────────────────────────────────────────────────────────────┐
  │  Rizal     │ Ms. Santos    │  43/45  ████████████████░  ⚠  │
  │  Bonifacio │ Mr. Reyes     │  40/45  ████████████████     │
  │  Luna      │ Ms. Flores    │  45/45  ████████████████  ✗  │  ← FULL
  │  Mabini    │ Mr. Torres    │  22/45  ████████░░░░░░░░     │
  └────────────────────────────────────────────────────────────┘
```

**Capacity bar colors:**
- < 80% → `bg-green-500` (available)
- 80–99% → `bg-amber-500` (near full)
- 100% → `bg-red-500` (full)

> These semantic colors are **never** the school's accent color. Their meaning (safe/warning/full) must be consistent across all schools.

**If a section fills up and more applicants are incoming:**
1. Click **[Edit]** on the section → increase `maxCapacity` (must have school head approval).
2. Or click **+ New Section** to create an additional section for the grade level.

---

## SCENE 1.8 — Closing the Enrollment Gate After Early Registration

**Steps:**
1. Navigate to `/settings → Tab 4`.
2. Toggle gate from `ON` → `OFF`.
3. Confirm. `/apply` now redirects to `/closed`.
4. `AuditLog`: `ENROLLMENT_GATE_TOGGLED — "closed"`.

**Note:** F2F admission (`/f2f-admission`) remains accessible to the registrar regardless.

---

---

# ═══════════════════════════════════════════
# ACT 2 — PHASE 2: REGULAR ENROLLMENT
# ═══════════════════════════════════════════
## Period: ~1 week before class opening (first Monday of June)
## Purpose: Official enrollment of record for all grade levels.

---

## SCENE 2.1 — Re-opening the Gate for Regular Enrollment

Same process as Scene 1.1. Registrar opens the gate `ON` during Brigada Eskwela week (~1 week before class opening).

---

## SCENE 2.2 — Confirming a Pre-Registered Grade 7 Applicant

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Phase 2 — June Brigada Eskwela week                    │
│ WHERE  │ /applications → search for pre-approved applicant      │
│ WHY    │ A learner approved in Phase 1 returns for Phase 2      │
│        │ document verification and official enrollment.         │
│ POLICY │ DO 017, s. 2025 — Phase 2 is the official enrollment.  │
│        │ Phase 1 approval is pre-registration only.             │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Registrar searches for the applicant in `/applications`.
2. Record shows: **APPROVED** (section already assigned from Phase 1).
3. Registrar verifies physical documents in hand.
4. No additional system action needed — the enrollment record exists.
5. Registrar informs the parent: *"Your child is officially enrolled."*

If a data correction is needed: `PUT /api/students/:id` → corrects the field → `AuditLog: STUDENT_RECORD_UPDATED`.

---

## SCENE 2.3 — Processing Continuing Grade 8–10 and Grade 12 Learners

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Phase 2 — June enrollment week                        │
│ WHERE  │ /students → find existing learner → assign to section  │
│ WHY    │ Pre-registered continuing learners submit Confirmation │
│        │ Slips (Annex C) — no full BEEF required.              │
│ POLICY │ DO 017, s. 2025 §4 — continuing learners pre-         │
│        │ registered in LIS; Confirmation Slip only             │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Registrar goes to `/students` and searches the learner's name or LRN.
2. Learner's prior year record appears.
3. Initiates enrollment for the new year via the "Enroll for New Year" action.
4. Section assignment dialog opens, filtered to the next grade level's sections.
5. Registrar selects a section and confirms.

**System:**
- `Enrollment` record created for the new `academicYearId`.
- `AuditLog`: `APPLICATION_APPROVED — "Registrar confirmed enrollment for [name] → [section]"`.
- Sileo toast: *"Enrollment Confirmed."*

**Scale reality:** During Phase 2 week, 200–400 confirmation slips may be processed in a single day. The 300ms debounce search and single-dialog confirmation flow are the primary speed tools.

---

## SCENE 2.4 — Processing a Walk-In Grade 7 Applicant Who Missed Phase 1

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Phase 2 — June enrollment week                        │
│ WHERE  │ /f2f-admission (preferred) or /apply at the office     │
│ WHY    │ A parent arrives during Brigada Eskwela with a child  │
│        │ who did not pre-register. School CANNOT turn them away.│
│ POLICY │ DO 017, s. 2025 — all learners must be accepted if    │
│        │ capacity allows; missed early registration is not      │
│        │ grounds for denial.                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Parent arrives at the registrar's window.
2. Registrar opens `/f2f-admission` and enters the application on the parent's behalf.
3. Since documents are present, clicks **Save as Approved** → section dialog → confirms.
4. Walk-in applicant is enrolled within the same visit.

If all sections for the grade level are full: the registrar does not reject the applicant. Informs the school head; school head raises a section's capacity or creates a new section. Applicant is placed in `APPROVED` status until capacity is resolved.

---

## SCENE 2.5 — Processing a Transferee

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Phase 2 or any time during the school year             │
│ WHERE  │ /f2f-admission → /applications                         │
│ POLICY │ DO 017, s. 2025 §5.5 — schools cannot deny transferee  │
│        │ enrollment due to unpaid private school fees.          │
│        │ LRN must be validated; SF10 is requested post-         │
│        │ enrollment through DepEd LIS (external system).        │
└─────────────────────────────────────────────────────────────────┘
```

**Registrar enters the application via `/f2f-admission`** (or the parent submits via `/apply`). Verifies SF9 and LRN. If transferring from a private school with unpaid fees: assists parent with Affidavit of Undertaking (physical, not in this system). Approves and assigns section. SF10 transfer request is initiated separately in DepEd LIS.

---

## SCENE 2.6 — Processing a Balik-Aral (Returning Learner)

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Phase 2 or any time during the school year             │
│ POLICY │ DO 017, s. 2025 §5.6 — Balik-Aral learners cannot be  │
│        │ turned away due to gaps or missing records.            │
└─────────────────────────────────────────────────────────────────┘
```

**Key registrar behavior:** Never refuse. Accept whatever documentation is available. If SF9 is missing, accept a school certification letter, barangay certification, or any credible attestation of last grade attended. Enroll provisionally and coordinate with SDO for any LIS reconciliation needed.

---

## SCENE 2.7 — Closing the Gate After Regular Enrollment

Same as Scene 1.8. Gate toggled `OFF` after Brigada Eskwela week. Classes begin Monday. `/apply` redirects to `/closed`. F2F admission at `/f2f-admission` remains available for late enrollees.

---

---

# ═══════════════════════════════════════════
# ACT 3 — ACTIVE SCHOOL YEAR: ONGOING OPERATIONS
# ═══════════════════════════════════════════
## Period: June → March (classes in session)

---

## SCENE 3.1 — Processing a Late Enrollee

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time after class opening                           │
│ WHERE  │ /f2f-admission (the preferred entry point for walk-ins)│
│ WHY    │ Student missed all enrollment periods                  │
│ POLICY │ DO 017, s. 2025 §15 — late enrollment accepted if      │
│        │ learner can attend ≥80% of school days remaining.      │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. School head authorizes in writing (physical document).
2. Registrar enters the application via `/f2f-admission` — no need to toggle the online gate.
3. Selects an available section with remaining capacity.
4. Confirms enrollment.
5. Notes in physical enrollment logbook: *"Late enrollment authorized by School Head [name] on [date]."*

**Critical note:** The online gate controls only `/apply`. The registrar's access to `/f2f-admission` is governed by their JWT — it is always accessible.

---

## SCENE 3.2 — Editing a Student Record in SIMS

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time — parent reports a name spelling error,       │
│        │ address change, or updated guardian contact            │
│ WHERE  │ /students → /students/:id                              │
│ WHY    │ Student information must remain accurate in the system │
│        │ for LIS encoding and official records.                 │
│ POLICY │ RA 10173 — all edits are audit-logged; field names     │
│        │ (not values) logged for SPI fields                     │
└─────────────────────────────────────────────────────────────────┘
```

**What the registrar sees at `/students/:id`:**

```
STUDENT PROFILE — DELA CRUZ, Juan Reyes
LRN: 123456789012  [read-only — immutable]

  Tab 1: Personal Information  |  Tab 2: Academic History
  Tab 3: Application Record    |  Tab 4: Classifications

[ Edit Record ]    [ Cancel ]    [ Save Changes ]
```

**Tab 1 — Personal Information (editable fields):**
- Name (Last, First, Middle, Suffix)
- Date of Birth · Sex · Place of Birth · Nationality · Religion · Mother Tongue
- Home Address · Barangay · Municipality · Province
- Guardian Name · Relationship · Contact Number · Email Address

**LRN is immutable.** Displayed as plain text — not an `<input>`. The API rejects any `PUT /students/:id` body that includes the `lrn` field.

**Tab 2 — Academic History:**
- All enrollment records across academic years: AY · Grade Level · Section · Date Enrolled · Enrolled By
- Read-only.

**Tab 3 — Application Record:**
- Original submission details: tracking number, admission channel (Online/F2F), date.
- SCP assessment records: exam date, score, results (read-only).
- Status history derived from AuditLog entries.

**Tab 4 — Classifications (SPI — restricted display):**
- Learner type badge · IP status · 4Ps status + Household ID · PWD status + Disability type.
- These SPI fields are **only visible to REGISTRAR and SYSTEM_ADMIN**. TEACHER cannot see them.

**Editing steps:**
1. Click **Edit Record**.
2. Fields become editable. LRN remains read-only.
3. Make corrections.
4. Click **Save Changes**.

**System:**
- `PUT /api/students/:id` with the updated fields.
- `AuditLog`: `STUDENT_RECORD_UPDATED — "Registrar [name] updated record for LRN [lrn] — Changed: [fieldList]"`.
- For SPI fields: the audit log records field **names only**, never values (e.g., `Changed: is4PsBeneficiary, householdId`).
- Sileo toast: *"Record Updated."*

---

## SCENE 3.3 — Searching for a Student Record

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time during the school year                        │
│ WHERE  │ /students                                               │
│ WHY    │ A teacher asks which section a student is in, or a    │
│        │ parent calls about their child's enrollment status.    │
└─────────────────────────────────────────────────────────────────┘
```

**Registrar types the student's LRN or name in the search bar. Results appear after 300ms debounce.**

```
STUDENTS    [ Dela Cruz                    🔍 ]

  LRN            │  Full Name            │  Grade   │  Section  │  Channel  │  Status
  ───────────────┼───────────────────────┼──────────┼───────────┼───────────┼──────────
  123456789012   │  Dela Cruz, Juan R.   │  Grade 7 │  Rizal    │  Online   │  ENROLLED
```

**Filters available:** Grade Level · Section · Academic Year · Status · Admission Channel (Online/Walk-in).

---

## SCENE 3.4 — Adjusting Section Capacity or Reassigning Adviser

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time — when school head approves more seats, or    │
│        │ a teacher transfers / goes on leave                    │
│ WHERE  │ /sections → [Edit] on the section                      │
└─────────────────────────────────────────────────────────────────┘
```

**Capacity increase:**
1. Click **[Edit]** on the target section.
2. Change `Max Capacity` to new value (e.g., 45 → 48).
3. Save. Cannot decrease below current enrolled count.

**Adviser reassignment:**
1. Click **[Edit]** → change Advising Teacher dropdown to a different teacher from the directory.
2. Save.
3. The old teacher loses the section assignment; the new teacher gains it in `/my-sections`.

Both actions: `PUT /api/sections/:id` → `AuditLog: SECTION_UPDATED`.

---

## SCENE 3.5 — Parent Calls to Track Application Status

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ Any time after application submission                  │
│ WHERE  │ /track/:trackingNumber — public page, no login needed  │
│ WHY    │ Parents check status without calling the school.       │
└─────────────────────────────────────────────────────────────────┘
```

**What the parent sees at `/track/APP-2026-00055`:**

```
┌──────────────────────────────────────────────────────────────────┐
│  [SchoolSettings.schoolName]                                     │
│  Application Status Tracker                                      │
│                                                                  │
│  Tracking Number:  APP-2026-00055                                │
│  ✓  APPROVED & ENROLLED                                          │
│                                                                  │
│  Learner  :  DELA CRUZ, Juan Reyes                               │
│  Grade    :  Grade 7 — Section Rizal                             │
│  SY       :  2026–2027                                           │
└──────────────────────────────────────────────────────────────────┘
```

No API authentication required. Tracking number is the only identifier — no LRN or other PII exposed in the URL.

---

---

# ═══════════════════════════════════════════
# ACT 4 — SHS SECOND SEMESTER (GRADE 12)
# ═══════════════════════════════════════════

## SCENE 4.1 — Processing Grade 12 Second Semester Enrollment

```
┌─────────────────────────────────────────────────────────────────┐
│ WHEN   │ December–January (before or after Christmas break)     │
│ WHERE  │ /students → locate Grade 12 learners                   │
│ POLICY │ DO 017, s. 2025 §5.4 — SHS is semester-based.         │
│        │ Grade 12 Confirmation Slip required for Semester 2.    │
└─────────────────────────────────────────────────────────────────┘
```

Grade 12 learners submit Confirmation Slips. Registrar confirms their continued enrollment in the same section for Semester 2 — no new section assignment needed. In DepEd LIS (external system, outside this application), the registrar encodes the SHS 2nd Semester Enrollment facility separately.

---

---

# ═══════════════════════════════════════════
# ACT 5 — END OF YEAR & ARCHIVAL
# ═══════════════════════════════════════════

## SCENE 5.1 — Final Dashboard Review

**Steps:**
1. Review all four stat cards — confirm zero pending, zero approved-awaiting.
2. Cross-check bar chart totals with physical enrollment logbook.
3. Review the Online vs F2F admission breakdown chart for the annual report.
4. Identify any remaining APPROVED applications (no-shows) → resolve by contacting parents or formally rejecting.
5. Note the final totals for the school head's EOSY report.

---

## SCENE 5.2 — Confirming Gate is Closed & No Outstanding Actions

1. `/settings → Tab 4` — confirm gate is **CLOSED**.
2. `/applications → filter Status: PENDING` — confirm zero.
3. `/applications → filter Status: APPROVED` — resolve any remaining.
4. `/audit-logs` — final week review for unauthorized actions.

---

## SCENE 5.3 — Archiving and Starting the Next Cycle

1. Navigate to `/settings → Tab 2`.
2. Click **[Activate]** on the next SY row.
3. Confirm.

**What happens:**
- Current SY → `ARCHIVED`. All data preserved permanently. Historical data viewable via the year-context dropdown in `/sections` and `/students`.
- Next SY → `ACTIVE`. Dashboard, sections, and portal operate under it.

**System loop returns to Act 0.** The cycle repeats.

---

---

# APPENDIX A — Complete Applicant Status Lifecycle

```
                   APPLICANT SUBMITS FORM
                   (Online: POST /api/applications)
                   (F2F:    POST /api/applications/f2f)
                          │
                          ▼
                    ● PENDING
                    Tracking number assigned.
                    Email sent (if address provided).
                          │
              ┌───────────┴────────────────┐
              │                            │
              ▼                            ▼
    ── REGULAR PATH ──          ── SCP PATH ──────────────────┐
    ✓ APPROVED                  ⏳ EXAM_SCHEDULED             │
    + section assigned           (after doc verification)     │
    Enrollment record created.         │                      │
    Email: "Confirmed"                 ▼                      │
                                  📋 EXAM_TAKEN               │
                                  (after assessment)          │
                                       │              ────────┘
                                   ✅ PASSED    ❌ FAILED
                                   + section     Offer regular
                                   assigned      section OR reject
                                       │
                              ✓ APPROVED
                              + enrollment record
                                       │
                              ✓ ENROLLED (Phase 2 confirmation)
                                       │
                              ARCHIVED (end of year)
                              Read-only. Never deleted.
        ✗ REJECTED (any path)
        Parent notified. May resubmit.
```

---

# APPENDIX B — Section Capacity Indicators

| Badge | Condition | Color | Registrar Action |
|---|---|---|---|
| `● Available` | enrolled < 80% of maxCapacity | Green | Normal approvals |
| `⚠ Near Full` | enrolled ≥ 80% of maxCapacity | Amber | Monitor; consider adding section |
| `✗ Full` | enrolled ≥ maxCapacity | Red | Cannot approve into section; edit capacity or add section |

Capacity bar always uses semantic colors (green/amber/red) — **never the school's accent color** — so the meaning is consistent across all schools.

---

# APPENDIX C — DO 017 Compliance Checklist for the Registrar

| ❌ PROHIBITED | ✅ CORRECT ALTERNATIVE | Legal Basis |
|---|---|---|
| Reject for missing PSA Birth Certificate | Enroll provisionally; collect by October 31 | DO 017, s. 2025; RA 11909 |
| Reject for missing SF9 | Accept PEPT/A&E result or school certification letter | DO 017, s. 2025 §13 |
| Reject transferee for unpaid private school fees | Enroll; assist with Affidavit of Undertaking | DO 017, s. 2025 §5.5 |
| Block enrollment of learner with disability | Enroll; coordinate with SPED/inclusive ed | RA 7277; DO 017 §5 |
| Require Good Moral Certificate (public schools) | Not required by DepEd | DO 017, s. 2025 §III |
| Withhold SF9 or SF10 for any reason | Issue immediately upon request | DO 017, s. 2025 §1.5 |
| Collect any fee during enrollment | All enrollment is FREE | DO 017 §II; RA 10533 |
| Create a duplicate LRN | Validate existing LRN before encoding | LIS Data Integrity Policy |
| Re-submit PSA BC annually | PSA BC collected ONCE per school | RA 11909; DO 017 §1.3 |

---

# APPENDIX D — Quick Grade-Level Reference

| Grade Level | Phase 1 Required? | Document | Phase 2 Action | Strand/Cluster? |
|---|---|---|---|---|
| **Grade 7** | ✅ Yes | BEEF + PSA BC + Grade 6 SF9 | Confirm + section assign | No |
| **Grade 8** | ❌ Pre-registered | Confirmation Slip (Annex C) | Section assign | No |
| **Grade 9** | ❌ Pre-registered | Confirmation Slip (Annex C) | Section assign | No |
| **Grade 10** | ❌ Pre-registered | Confirmation Slip (Annex C) | Section assign | No |
| **Grade 11** | ✅ Yes | BEEF + PSA BC + Grade 10 SF9 | Confirm + section assign | ✅ Yes |
| **Grade 12** | ❌ Pre-registered | Confirmation Slip (Annex C) | Section assign; 2nd sem Dec–Jan | Continues from G11 |
| **Transferee** | ✅ During Phase 1 | BEEF + SF9 + LRN validation | Same as new entrant | If Grade 11/12 |
| **Balik-Aral** | ✅ During Phase 1 | Last SF9 or alternative | Same as new entrant | If Grade 11/12 |

> **School-agnostic:** This table shows a standard Grades 7–12 secondary school. A school offering only Grades 7–10 would have no Grade 11/12 rows. The actual grade levels available in the system's dropdowns and filters always reflect what was configured in Settings Tab 3.

---

---

# ADDENDUM A — DM 012, s. 2026: Strengthened SHS Curriculum Workflow

**Governing Memorandum:** DepEd Memorandum No. 012, s. 2026
**Starting:** SY 2026–2027 — incoming Grade 11 only. Grade 12 continues old strand system.

The Addendum A scenes (A.1 through A.7 and Appendix E) from the original storyboard remain fully applicable. Key updates for v3.0.0:

- **SCENE A.1** (Configure elective clusters): now uses the **SCP Programs sub-tab** in Settings Tab 3 — NOT a separate UI. The Track/Cluster configuration for DM 012 is handled through the Strand configuration system with `track: 'ACADEMIC'` or `track: 'TECHPRO'` field.

- **SCENE A.6** (Unavailable cluster): The system displays a warning banner `"Selected cluster is not configured for this school"` because the admission form only shows clusters loaded from the active AY's strand configuration. If the applicant somehow submitted a cluster not in the database, it would be rejected at the API level. This is the school-agnostic dynamic system enforcing consistency.

- All section names in Addendum A scenes (STEM-A, ICT-A, etc.) are **examples only** — the actual section names for any school are whatever the registrar configured in `/sections`.

---

---

# ADDENDUM B — Admission Process Workflows (Open Admission & SCP)

**Policy Basis:** DepEd Memorandum No. 149, s. 2011 · DO 017, s. 2025
**PRD Reference:** v3.0.0

The Addendum B scenes (B.1 through B.10 and Appendix F) from the original storyboard remain fully applicable. Key updates for v3.0.0:

- **SCP programs shown in the applications inbox and the admission form** are loaded dynamically from the school's `ScpProgram` configuration. A school that does not offer SPA will not see the SPA type badge, the SPA exam fields, or the SPA row in the SCP pipeline dashboard panel.

- **All email subjects and bodies** in SCP workflow emails (exam scheduled, passed, failed) use `SchoolSettings.schoolName` at send time — never a hardcoded school name.

- **Division Memorandum references** in the SCP scenes describe the general DepEd framework for division-administered exams. The specific division memorandum number for STE testing will vary by SDO — the system is not tied to any specific division.

- **The `ScpProgram.assessmentType` field** drives which dialog fields appear in each SCP scene. A school that configures STE with `EXAM_ONLY` and no interview will never see an audition result field in Scene B.3. The scenes in Addendum B describe the general workflow pattern; the system adapts based on each SCP program's configuration.

---

*Document v3.0.0*
*System: School Admission, Enrollment & Information Management System*
*Modules: Admission (Online + F2F) · Enrollment Management · SIMS · Teacher Management · Grade Level & Sectioning Management*
*Stack: PERN (PostgreSQL 18 · Express.js 5.1 · React 19.x · Node.js 22 LTS)*
*Auth: JWT + Layer 1 (navigation state guard) + Layer 2 (pre-flight login token)*
*Policy: DepEd Order No. 017, s. 2025 · DM 012, s. 2026 · DM 149, s. 2011 · RA 7797 as amended · RA 10173*
*Design: School-agnostic — all school name, grade levels, strands, SCP programs, and section names are runtime-configurable*