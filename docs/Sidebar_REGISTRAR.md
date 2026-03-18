# Sidebar Navigation — REGISTRAR Role
## School Admission, Enrollment & Information Management System

**Document Version:** 3.0.0
**Role:** `REGISTRAR`
**Derived From:** PRD v3.0.0 · Sidebar Navigation Spec v3.0.0
**Stack:** React 19 · React Router v7 · shadcn/ui · Tailwind CSS v4 · Lucide React Icons

---

## Overview

The REGISTRAR is the **primary operational role** of the system. The registrar manages the entire school enrollment lifecycle — from accepting applications (both online and walk-in), processing them, assigning students to sections, maintaining student records, managing teachers and sections, and configuring the system for each school year.

The sidebar contains **8 navigation items** organized into 4 logical groups.

---

## Sidebar Anatomy

```
┌──────────────────────────────────────┐
│  [School Logo]                       │  ← settingsStore.logoUrl
│  [School Name]                       │  ← settingsStore.schoolName (never hardcoded)
│  SY 2026–2027  ● ACTIVE              │  ← settingsStore.activeYear.yearLabel
├──────────────────────────────────────┤
│                                      │
│  ── ADMISSION ──                     │
│  👤+  Walk-in Admission              │  /f2f-admission
│                                      │
│  ── ENROLLMENT ──                    │
│  📊  Dashboard                       │  /dashboard
│  📋  Applications                    │  /applications
│                                      │
│  ── RECORDS ──                       │
│  👥  Students                        │  /students
│  📜  Audit Logs                      │  /audit-logs
│                                      │
│  ── MANAGEMENT ──                    │
│  🎓  Teachers                        │  /teachers
│  🏫  Sections                        │  /sections
│  ⚙️   Settings                        │  /settings
│                                      │
├──────────────────────────────────────┤
│  Cruz, Regina M.                     │  ← user.name
│  ● Registrar                         │  ← accent color badge (from school logo)
│  [Log Out]                           │
└──────────────────────────────────────┘
```

**Sidebar header rules:**
- School logo: `settingsStore.logoUrl`. If null: default school icon (`<School />`).
- School name: `settingsStore.schoolName`. Never a string literal. Shows `<Skeleton>` while loading.
- Active year: `settingsStore.activeYear.yearLabel` + green `● ACTIVE` badge. If no active year: `"No Active Year"` + amber `AlertCircle`.
- Role badge: accent color — matches the school's extracted logo color via `var(--accent)`.

**Active nav item:**
```css
border-l-2 border-[hsl(var(--accent))]
bg-[hsl(var(--accent-muted))]
text-[hsl(var(--accent))]
font-medium
```

**Inactive nav item:**
```css
text-muted-foreground
hover:bg-muted hover:text-foreground
```

Driven by React Router v7 `<NavLink>` `isActive` prop. Never uses `window.location.pathname`.

---

## Navigation Item 1 — Walk-in Admission

```
Group  : ADMISSION
Icon   : UserPlus
Label  : Walk-in Admission
Route  : /f2f-admission
Auth   : JWT required — REGISTRAR, SYSTEM_ADMIN
Page   : client/src/pages/admission/F2FAdmission.tsx
API    : POST /api/applications/f2f
```

### Purpose

Used when a student or parent arrives at the school office in person to apply. The registrar fills out the full admission form on behalf of the applicant. This route is **always accessible regardless of whether the public online enrollment gate is open or closed**.

### What the Registrar Sees

A single scrollable page (not a wizard) with all BEEF sections in a 2-column grid layout. A "Walk-in (F2F)" badge is prominently displayed at the top.

```
WALK-IN ADMISSION                              [WALK-IN (F2F) badge]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  PHYSICAL CONSENT CONFIRMATION  *
  ☐  The applicant / parent has physically signed the RA 10173
     Data Privacy Consent form. A copy is on file.
  (Required before submission)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  A. Personal Information         B. Family & Contact
  C. Background & Classification  D. Previous School
  E. Enrollment Preferences       (grade, SCP, strand — all dynamic)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ Save as Pending ]        [ Save as Approved ]
```

### Key Behaviors

| Aspect | Detail |
|---|---|
| Enrollment gate | Unaffected — always open for REGISTRAR |
| `admissionChannel` stored | `F2F` |
| `encodedById` stored | Registrar's `User.id` (auto from JWT) |
| Privacy consent | Physical signature confirmation checkbox |
| Fast-track option | "Save as Approved" sets `status = APPROVED` immediately when docs are verified at the counter |
| Email | Sent if `emailAddress` field is populated; optional for F2F |
| Tracking number | Shown in success toast; registrar prints or notes it |

### Grade Level / SCP / Strand Dropdowns

All three dropdowns are **loaded from the database** for the active academic year:
- `GET /api/grade-levels` → Grade Level dropdown
- `GET /api/scp-programs?gradeLevelId=` → SCP dropdown (shown only if SCPs are configured; hidden otherwise)
- `GET /api/strands?gradeLevelId=` → Strand dropdown (shown only for SHS grade levels)

No school name, grade level name, SCP code, or strand name is hardcoded.

### API

```
POST /api/applications/f2f
Authorization: Bearer <JWT>
Body: { ...all BEEF fields, privacyConsentGiven: true }

Server sets:
  admissionChannel = 'F2F'
  encodedById      = req.user.userId
  academicYearId   = active AY id (auto)
  trackingNumber   = generated (auto)
  status           = 'PENDING' or 'APPROVED' (based on button clicked)

Response: { trackingNumber: "APP-2026-00198" }
AuditLog: F2F_APPLICATION_ENTERED
```

---

## Navigation Item 2 — Dashboard

```
Group  : ENROLLMENT
Icon   : LayoutDashboard
Label  : Dashboard
Route  : /dashboard
Auth   : JWT required — REGISTRAR, SYSTEM_ADMIN
Page   : client/src/pages/dashboard/Index.tsx
API    : GET /api/dashboard/stats
```

### Purpose

The Registrar's home base — a real-time overview of the enrollment status for the active academic year.

### What the Registrar Sees

#### Stat Cards (4-column grid, collapses to 2 on tablet, 1 on mobile)

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  🕐 14           │  │  ✓ 1,243          │  │  ⏳ 5            │  │  🏫 3            │
│  Total Pending   │  │  Total Enrolled   │  │  Approved /      │  │  Sections        │
│  Applications    │  │                   │  │  Awaiting        │  │  At Capacity     │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

| Card | Icon | Data Source |
|---|---|---|
| Total Pending | `Clock` | COUNT applicants WHERE `status = 'PENDING'` AND active AY |
| Total Enrolled | `UserCheck` | COUNT enrollments for active AY |
| Approved Awaiting | `Hourglass` | COUNT applicants WHERE `status = 'APPROVED'` AND active AY |
| Sections at Capacity | `AlertCircle` | COUNT sections WHERE enrolled_count ≥ maxCapacity |

#### Charts (Recharts)

**Chart 1 — Enrollment by Grade Level** (`BarChart`, horizontal)
- Horizontal bars, one per configured grade level
- Count shows confirmed `Enrollment` records per grade for the active AY
- Grade level names come from the database — not hardcoded

**Chart 2 — Application Status Distribution** (`PieChart`, donut)
- Slices: PENDING · APPROVED · ENROLLED · REJECTED · EXAM_SCHEDULED · PASSED · FAILED
- Only statuses with count > 0 render a slice
- Color-coded by status (amber/green/blue/red/etc.)

**Chart 3 — Admission Channel Breakdown** (`PieChart`, donut)
- Online vs Walk-in (F2F) split
- Helps registrar monitor how many applications came through each channel

#### SCP Pipeline Panel

Shown only when the active AY has at least one active SCP program configured. Collapses entirely if no SCP programs exist.

```
SCP ADMISSION PIPELINE                        SY 2026–2027

  STE — Science, Technology & Engineering
  ├─ PENDING (docs review)    :  8
  ├─ EXAM_SCHEDULED           :  24
  ├─ EXAM_TAKEN               :  3
  ├─ PASSED                   :  19
  └─ FAILED (offered regular) :  2

  SPA — Special Program in the Arts
  ├─ PENDING                  :  4
  ├─ EXAM_SCHEDULED           :  10
  ├─ PASSED                   :  7
  └─ FAILED                   :  3
```

Each SCP program listed here matches one active `ScpProgram` record in the database. The program names are never hardcoded.

#### Recent Activity Feed

Last 10 `AuditLog` entries in reverse chronological order, displayed as a vertical timeline inside a `Card`:

```
  • Feb 3, 9:14 AM   Cruz, Regina    APPLICATION_APPROVED   #APP-2026-00042
  • Feb 3, 8:55 AM   Cruz, Regina    F2F_APPLICATION_ENTERED  #APP-2026-00055
  • Feb 1, 8:00 AM   Cruz, Regina    ENROLLMENT_GATE_TOGGLED  → OPEN
  • Jan 31, 4:15 PM  Cruz, Regina    SECTION_CREATED  Grade 7 – Rizal
```

Each entry shows: timestamp · user name · action type badge · description.

---

## Navigation Item 3 — Applications

```
Group  : ENROLLMENT
Icon   : ClipboardList
Label  : Applications
Route  : /applications
Auth   : JWT required — REGISTRAR, SYSTEM_ADMIN
Pages  : client/src/pages/applications/Index.tsx
         client/src/pages/applications/[id].tsx
API    : GET  /api/applications
         GET  /api/applications/:id
         POST /api/applications/f2f
         PATCH /api/applications/:id/approve
         PATCH /api/applications/:id/reject
         PATCH /api/applications/:id/schedule-exam
         PATCH /api/applications/:id/record-result
         PATCH /api/applications/:id/pass
         PATCH /api/applications/:id/fail
```

### Purpose

The Registrar's primary daily workspace during enrollment periods. All applications — whether submitted online or entered via walk-in — appear here.

### Application Inbox (`/applications`)

#### Filter Toolbar

```
APPLICATIONS           [ Search by LRN or name...  🔍 ]     [Filter ▾]

  Year:     [ SY 2026–2027 ▾ ]
  Grade:    [ All ▾ ]           ← dynamic from DB
  Type:     [ All ▾ ]           ← REGULAR + active SCP codes from DB
  Status:   [ All ▾ ]           ← all ApplicationStatus enum values
  Channel:  [ All ▾ ]           ← Online · Walk-in (F2F)
```

All filter options are data-driven. The "Type" dropdown shows only SCP codes the school has configured — schools with no SCPs see only "Regular".

#### Table Columns

```
  #   │ Learner Name          │ LRN          │ Grade    │ Type      │ Channel  │ Status      │ Applied    │ Actions
  ────┼───────────────────────┼──────────────┼──────────┼───────────┼──────────┼─────────────┼────────────┼─────────
  055 │ Dela Cruz, Juan R.    │ 123456789012 │ Grade 7  │ REGULAR   │ Online   │ ● PENDING   │ Feb 3      │ [View]
  054 │ Santos, Maria L.      │ 876543219012 │ Grade 11 │ STEM G11  │ Walk-in  │ ● PENDING   │ Feb 3      │ [View]
  053 │ Reyes, Pedro M.       │ 112233445566 │ Grade 7  │ STE       │ Online   │ ⏳EXAM_SCHED│ Feb 2      │ [View]
```

- Search: LRN (exact 12-digit) or name. Debounced 300ms. No page reload.
- Pagination: 15 records per page
- All columns sortable
- Status badge colors: PENDING → amber · APPROVED → green · REJECTED → red · EXAM_SCHEDULED → amber · EXAM_TAKEN → blue · PASSED → green · FAILED → red

### Application Detail (`/applications/:id`)

#### Regular Admission Detail

```
APPLICATION DETAIL  #APP-2026-00055          Status: ● PENDING
Channel: Online
────────────────────────────────────────────────────────────
PERSONAL INFORMATION
  Full Name   : DELA CRUZ, Juan Reyes
  LRN         : 123456789012
  Date of Birth: March 12, 2014 (Age: 11)
  Sex         : Male

FAMILY & CONTACT
  Guardian    : Maria Dela Cruz (Mother)
  Contact     : 0917-123-4567
  Email       : delacruz.maria@gmail.com
  Address     : [street], [barangay], [municipality], [province]

PREVIOUS SCHOOL
  Last School : [Elementary School Name]
  Last Grade  : Grade 6
  Average     : 92.5

ENROLLMENT PREFERENCE
  Grade Level : Grade 7
  Program     : Regular Admission

────────────────────────────────────────────────────────────
[ Approve & Assign Section ]     [ Reject Application ]
```

#### SCP Admission Detail

```
ENROLLMENT PREFERENCE
  Grade Level : Grade 7
  Application : ⚡ SPECIAL CURRICULAR PROGRAM
  SCP Type    : Science, Technology & Engineering (STE)

SCP ASSESSMENT STATUS
  Exam Date   : Not yet scheduled
  Exam Score  : —
  Result      : —

────────────────────────────────────────────────────────────
[ ✓ Verify & Schedule Exam ]     [ ✗ Reject Application ]
```

### Action Button Logic

Buttons rendered conditionally based on `applicantType` + `status`:

| `applicantType` | `status` | Buttons Shown |
|---|---|---|
| `REGULAR` | `PENDING` | Approve & Assign Section · Reject |
| Any SCP | `PENDING` | Verify & Schedule Exam · Reject |
| Any SCP | `EXAM_SCHEDULED` | Record Assessment Result |
| Any SCP | `EXAM_TAKEN` | Mark as Passed · Mark as Failed |
| Any SCP | `PASSED` | Assign Section |
| Any SCP | `FAILED` | Offer Regular Section · Reject |

### Section Assignment Dialog

Opened when "Approve & Assign Section" or "Assign Section" is clicked:

```
┌───────────────────────────────────────────────────────────────┐
│  Assign Section                                                │
│  Juan Dela Cruz  ·  Grade 7                                   │
│  ─────────────────────────────────────────────────────────── │
│  ○  Rizal       Ms. Santos    38/45  ● 7 slots available     │
│  ○  Bonifacio   Mr. Reyes     41/45  ● 4 slots available     │
│  ○  Luna        Ms. Flores    44/45  ⚠ 1 slot remaining      │
│  ✗  Mabini      Mr. Torres    45/45  ✗ FULL — cannot select  │
│                                                               │
│          [ Cancel ]       [ Confirm Enrollment ]             │
└───────────────────────────────────────────────────────────────┘
```

- Sections loaded from `GET /api/sections?gradeLevelId=` for the active AY
- Full sections (`enrolled >= maxCapacity`) are displayed but disabled
- Confirmed with a `FOR UPDATE` PostgreSQL row-level lock to prevent race conditions

### Rejection Dialog

```
┌───────────────────────────────────────────────────────────────┐
│  Reject Application #APP-2026-00055                           │
│  Rejection Reason (optional but strongly recommended):        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ [reason text here]                                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ⚠  The parent will be notified by email with this reason.   │
│         [ Cancel ]          [ Confirm Rejection ]             │
└───────────────────────────────────────────────────────────────┘
```

---

## Navigation Item 4 — Students (SIMS)

```
Group  : RECORDS
Icon   : Users
Label  : Students
Route  : /students  (list)
         /students/:id  (profile)
Auth   : JWT required — REGISTRAR, SYSTEM_ADMIN
Pages  : client/src/pages/students/Index.tsx
         client/src/pages/students/Profile.tsx
API    : GET /api/students
         GET /api/students/:id
         PUT /api/students/:id
         GET /api/students/:id/history
```

### Purpose

The Student Information Management System (SIMS). A searchable, permanent record of every student who has ever applied or enrolled in the school — across all academic years.

### Student Directory (`/students`)

```
STUDENTS        [ Search by LRN or name...  🔍 ]         [Filter ▾]

  Grade: [ All ▾ ]  Section: [ All ▾ ]  AY: [ All ▾ ]  Status: [ All ▾ ]  Channel: [ All ▾ ]

  LRN            │  Full Name            │  Grade   │  Section  │  Channel  │  Status    │  Actions
  ───────────────┼───────────────────────┼──────────┼───────────┼───────────┼────────────┼──────────
  123456789012   │  Dela Cruz, Juan R.   │  Grade 7 │  Rizal    │  Online   │  ENROLLED  │  [View] [Edit]
  876543219012   │  Santos, Maria L.     │  Grade 11│  STEM-A   │  Walk-in  │  ENROLLED  │  [View] [Edit]
```

- LRN or name search — 300ms debounce, no full reload
- Filterable by grade level, section, academic year, enrollment status, admission channel
- All filter options are data-driven from the database

### Student Profile (`/students/:id`) — 4 Tabs

#### Tab 1 — Personal Information

All BEEF demographic fields. **Editable** by REGISTRAR. The LRN field is **always read-only** — displayed as plain text, not an `<input>`.

```
STUDENT PROFILE  — DELA CRUZ, Juan Reyes
LRN: 123456789012  [read-only]                      [ Edit Record ]

  Full Name      : Dela Cruz, Juan Reyes
  Date of Birth  : March 12, 2014
  Sex            : Male
  Place of Birth : [City/Municipality], [Province]
  Nationality    : Filipino
  Religion       : [religion]
  Mother Tongue  : [language]

  Home Address   : [street], [barangay], [municipality], [province]
  Guardian       : Maria Dela Cruz (Mother) · 0917-123-4567
  Email          : delacruz.maria@gmail.com
```

On saving edits:
- `PUT /api/students/:id`
- `AuditLog: STUDENT_RECORD_UPDATED` — lists changed field **names** only (values for SPI fields are never logged)
- Sensitive fields (IP status, 4Ps, PWD) require an additional confirmation dialog before saving

#### Tab 2 — Academic History

Read-only. All `Enrollment` records for this student across all academic years.

```
  AY          │  Grade Level  │  Section    │  Date Enrolled  │  Enrolled By
  ────────────┼───────────────┼─────────────┼─────────────────┼────────────────
  2026–2027   │  Grade 7      │  Rizal      │  Feb 3, 2026    │  Cruz, Regina
  2025–2026   │  Grade 6      │  (prev. school) │  —          │  —
```

Also shows general average carried from previous school if captured on the application form.

#### Tab 3 — Application Record

Read-only. The original application that created this student record.

```
  Tracking Number  : APP-2026-00055
  Admission Channel: Online
  Submitted        : February 3, 2026 at 9:14 AM
  Program Type     : Regular Admission

  STATUS HISTORY (from AuditLog)
  • Feb 3, 2026  APPLICATION_APPROVED → Grade 7 Rizal
  • Feb 3, 2026  APPLICATION_SUBMITTED → #APP-2026-00055
```

For SCP students, this tab also shows the full assessment history: exam date, score, result, audition result, interview result, and registrar notes.

#### Tab 4 — Classifications

Sensitive Personal Information (SPI). Read-only in display; editable via the Edit Record button in Tab 1 with extra confirmation.

```
  Learner Type      : New Enrollee
  IP Learner        : No
  4Ps Beneficiary   : No
  Person w/ Disability : No
```

If any of these are `Yes`, the sub-fields (IP community name, 4Ps Household ID, disability type) are shown here.

> **Note:** Tab 4 data is **never returned in the paginated list API response** (`GET /api/students`). It is returned only on single-record fetch (`GET /api/students/:id`) for REGISTRAR and SYSTEM_ADMIN roles.

---

## Navigation Item 5 — Audit Logs

```
Group  : RECORDS
Icon   : ScrollText
Label  : Audit Logs
Route  : /audit-logs
Auth   : JWT required — REGISTRAR, SYSTEM_ADMIN
Page   : client/src/pages/audit/Index.tsx
API    : GET /api/audit-logs?actionType=&startDate=&endDate=&page=
```

### Purpose

An immutable log of every significant action in the system. No entry can be deleted or modified. The Registrar sees **their own actions + system-level events**.

### What the Registrar Sees

```
AUDIT LOGS                                                [Filter ▾]

  Action Type: [ All ▾ ]    Date Range: [ From ] — [ To ]

  Timestamp           │  User            │  Action Type               │  Description
  ────────────────────┼──────────────────┼────────────────────────────┼──────────────────────────
  Feb 3, 2026 9:14 AM │  Cruz, Regina    │  APPLICATION_APPROVED      │  #055 → Grade 7 Rizal
  Feb 3, 2026 8:55 AM │  Cruz, Regina    │  F2F_APPLICATION_ENTERED   │  #054, LRN: 876543219012
  Feb 1, 2026 8:00 AM │  Cruz, Regina    │  ENROLLMENT_GATE_TOGGLED   │  → OPEN
  Jan 31, 4:15 PM     │  Cruz, Regina    │  SECTION_CREATED           │  Grade 7 – Rizal (cap: 45)
```

**Filterable by:** action type · date range.
**No user filter** for REGISTRAR — they see only their own entries plus system-level events. SYSTEM_ADMIN additionally sees a user filter dropdown.
**No delete, export, or modify actions** are available to REGISTRAR. These entries are permanent.

### Action Types Visible to REGISTRAR

All of the following when performed by this registrar:
`USER_LOGIN` · `USER_LOGOUT` · `APPLICATION_SUBMITTED` · `F2F_APPLICATION_ENTERED` · `APPLICATION_APPROVED` · `APPLICATION_REJECTED` · `EXAM_SCHEDULED` · `EXAM_RESULT_RECORDED` · `APPLICATION_PASSED` · `APPLICATION_FAILED` · `STUDENT_RECORD_UPDATED` · `ENROLLMENT_GATE_TOGGLED` · `SECTION_CREATED` · `SECTION_UPDATED` · `SECTION_DELETED` · `TEACHER_CREATED` · `TEACHER_UPDATED` · `TEACHER_ACCOUNT_PROVISIONED` · `ACADEMIC_YEAR_CREATED` · `ACADEMIC_YEAR_ACTIVATED` · `SCHOOL_SETTINGS_UPDATED`

---

## Navigation Item 6 — Teachers

```
Group  : MANAGEMENT
Icon   : GraduationCap
Label  : Teachers
Route  : /teachers  (directory)
         /teachers/:id  (profile)
Auth   : JWT required — REGISTRAR, SYSTEM_ADMIN
Pages  : client/src/pages/teachers/Index.tsx
         client/src/pages/teachers/Profile.tsx
API    : GET   /api/teachers
         POST  /api/teachers
         GET   /api/teachers/:id
         PUT   /api/teachers/:id
         POST  /api/teachers/:id/provision-account
         PATCH /api/teachers/:id/deactivate
```

### Purpose

Manage the school's teacher profiles and optionally provision system login accounts for advisers who need access to `/my-sections`.

### Teacher Directory (`/teachers`)

```
TEACHERS                                                 [ + Create Teacher ]

  Employee ID   │  Full Name           │  Specialization │  Sections  │  Account       │  Actions
  ──────────────┼──────────────────────┼─────────────────┼────────────┼────────────────┼────────────
  101-458-2021  │  Santos, Caridad M.  │  Mathematics    │  2         │  ● Active      │  [View]
  101-789-2020  │  Reyes, Miguel A.    │  Science        │  1         │  ● Active      │  [View]
  —             │  Flores, Luisa B.    │  English        │  0         │  Not Provisioned│  [View] [Provision]
```

**Create Teacher** modal fields: Last Name · First Name · Middle Name · Employee ID (DepEd) · Contact Number · Specialization.
`POST /api/teachers` → `AuditLog: TEACHER_CREATED`

### Teacher Profile (`/teachers/:id`) — 3 Tabs

#### Tab 1 — Profile

Editable. Fields: Full Name · Employee ID · Contact Number · Specialization.
`PUT /api/teachers/:id` → `AuditLog: TEACHER_UPDATED`

#### Tab 2 — Assigned Sections

Read-only list of sections this teacher currently advises in the active AY.

```
  Grade Level  │  Section     │  Enrolled / Max  │  AY
  ─────────────┼──────────────┼──────────────────┼───────────
  Grade 7      │  Rizal       │  43 / 45         │  2026–2027
  Grade 8      │  Bonifacio   │  38 / 45         │  2026–2027
```

**[Unassign]** button removes the teacher from that section (confirmation dialog required).
`PATCH /api/sections/:id/assign-teacher` → `AuditLog: SECTION_UPDATED`

#### Tab 3 — System Account

Shows account status badge: **Active / Inactive / Not Provisioned**.
If Active: last login timestamp · account creation date · role badge.

**[Provision Account]** — shown when status is "Not Provisioned". Opens a dialog asking for the teacher's email address.

```
┌───────────────────────────────────────────────────────────────┐
│  Provision System Account                                      │
│  Santos, Caridad M.                                           │
│  ─────────────────────────────────────────────────────────── │
│  Email Address *                                              │
│  [ csantos@school.edu.ph                                  ]   │
│                                                               │
│  A temporary password will be generated and emailed.          │
│  The teacher will be required to change it on first login.    │
│                                                               │
│          [ Cancel ]          [ Create Account ]              │
└───────────────────────────────────────────────────────────────┘
```

On confirm:
- `POST /api/teachers/:id/provision-account`
- Creates `User` with `role: TEACHER`, `mustChangePassword: true`
- Welcome email sent using `SchoolSettings.schoolName` — never a hardcoded school name
- `AuditLog: TEACHER_ACCOUNT_PROVISIONED`

> **Note:** The Registrar can provision teacher accounts and deactivate them. However, the "Reset Password" button is visible **only to SYSTEM_ADMIN**, not to REGISTRAR.

---

## Navigation Item 7 — Sections

```
Group  : MANAGEMENT
Icon   : School
Label  : Sections
Route  : /sections
Auth   : JWT required — REGISTRAR, SYSTEM_ADMIN
Page   : client/src/pages/sections/Index.tsx
API    : GET    /api/sections
         POST   /api/sections
         PUT    /api/sections/:id
         DELETE /api/sections/:id
         PATCH  /api/sections/:id/assign-teacher
```

### Purpose

Full CRUD management of all sections for the active academic year. The capacity monitor allows the registrar to track available slots across every grade level at a glance.

### Section List View

Grouped by grade level. Each section is displayed as a card:

```
SECTIONS                    Year: [ SY 2026–2027 ▾ ]           [ + New Section ]

  GRADE 7
  ┌─────────────────────────────────────────────────────────────┐
  │  Rizal       │  Ms. Santos   │  43 / 45  ████████████░ ⚠   │  [Edit] [Delete]
  │  Bonifacio   │  Mr. Reyes    │  40 / 45  ███████████░░      │  [Edit] [Delete]
  │  Luna        │  Ms. Flores   │  45 / 45  ████████████ ✗ FULL│  [Edit]
  │  Mabini      │  Mr. Torres   │  22 / 45  █████░░░░░░░░      │  [Edit] [Delete]
  └─────────────────────────────────────────────────────────────┘

  GRADE 8
  ...
```

**Capacity bar colors:**
- `< 80%` enrolled → `bg-green-500` (available)
- `80–99%` enrolled → `bg-amber-500` (near full)
- `= 100%` enrolled → `bg-red-500` (full)

These colors are **semantic and fixed** — never the school's accent color.

### Create Section Dialog

```
┌──────────────────────────────────────────────────────────────┐
│  Create Section                                               │
│  ─────────────────────────────────────────────────────────  │
│  Grade Level *                                                │
│  [ Grade 7                                          ▾ ]       │
│  (loaded from active AY grade levels — dynamic)               │
│                                                               │
│  Section Name *                                               │
│  [ Rizal                                              ]       │
│                                                               │
│  Max Capacity *   [ 40 ]    (default: 40, minimum: 1)         │
│                                                               │
│  Advising Teacher  (optional)                                 │
│  [ Santos, Caridad M.                               ▾ ]       │
│  (loaded from Teacher directory — Employee ID + Name)         │
│                                                               │
│  SCP Code  (optional — for designated SCP sections)           │
│  [ STE                                              ▾ ]       │
│  (loaded from active AY SCP programs)                         │
│                                                               │
│          [ Cancel ]         [ Create Section ]               │
└──────────────────────────────────────────────────────────────┘
```

- Grade Level dropdown: `GET /api/grade-levels` for active AY — school-configured, never hardcoded
- Advising Teacher dropdown: `GET /api/teachers` — `Teacher.id` + Employee ID + Full Name
- SCP Code dropdown: `GET /api/scp-programs/all` for active AY — only shown when SCPs are configured

`POST /api/sections` → `AuditLog: SECTION_CREATED`

### Edit Section Rules

- `maxCapacity` cannot be reduced below the current enrolled count → returns `422 Unprocessable Entity`
- Section name, adviser, and SCP code are freely editable
- `PUT /api/sections/:id` → `AuditLog: SECTION_UPDATED`

### Delete Section Rules

- Blocked if any `Enrollment` records reference this section
- UI shows a blocking message: *"This section has [n] enrolled students. Reassign them before deleting."*
- `DELETE /api/sections/:id` → `AuditLog: SECTION_DELETED`

---

## Navigation Item 8 — Settings

```
Group  : MANAGEMENT
Icon   : Settings
Label  : Settings
Route  : /settings
Auth   : JWT required — REGISTRAR, SYSTEM_ADMIN
Page   : client/src/pages/settings/Index.tsx
```

### Purpose

All school-wide configuration. Everything in Settings determines how every other module behaves. This is where the annual setup happens before Early Registration opens.

### Tab 1 — School Profile

Fields: School Name · DepEd School ID · Schools Division · Region · Logo Upload.

**Logo upload:**
- `POST /api/settings/logo` (multipart/form-data, Multer, max 2MB, PNG/JPG/WEBP)
- Server extracts dominant color using `color-thief-node`
- CSS variables `--accent`, `--primary`, `--ring` and all sidebar tokens updated system-wide
- `PUT /api/settings/identity` for name, ID, division, region fields
- `AuditLog: SCHOOL_SETTINGS_UPDATED`

> School name is used in every email subject, the privacy notice on both admission forms, and the sidebar header. Division and region appear in the RA 10173 privacy notice. None of these are hardcoded.

### Tab 2 — Academic Year

```
SETTINGS > Academic Year

  SY 2026–2027   ● ACTIVE   [Edit Dates]
  Classes: June 1, 2026 → March 31, 2027
  Phase 1: Jan 31 – Feb 27, 2026
  Phase 2: May 25 – May 31, 2026
  Past Years: [ SY 2025–2026   Archived   View ]

  [ + Create Next Year ]  ← Smart auto-fill
```

**Smart auto-fill:** when the registrar types `2027-2028`, the system auto-computes all DepEd calendar dates (class opening, class end, Phase 1, Phase 2). Registrar confirms or adjusts before saving.

Only one academic year can be `isActive = true` at a time. Activating a new year deactivates the previous one (transaction-safe swap).

`POST /api/academic-years` · `PATCH /api/academic-years/:id/activate` → `AuditLog: ACADEMIC_YEAR_CREATED / ACTIVATED`

### Tab 3 — Grade Levels, Strands & SCP Programs

Three sub-tabs:

**Grade Levels sub-tab:**
CRUD for grade levels within the active AY. Each has a `requiresEarlyReg` toggle (true for Grade 7, Grade 11, transferees per DepEd). Display order controls how they appear in dropdowns.

**Strands & Tracks sub-tab:**
CRUD for strands. Each strand has a name, optional track label (e.g., "Academic", "TechPro"), and applicable grade level IDs. Schools with no SHS leave this empty → no strand field appears anywhere in the system.

**SCP Programs sub-tab:**
CRUD for SCP programs. Each has code, full name, applicable grade levels, assessment type, requires interview toggle, active/inactive toggle. Schools that offer no SCPs leave this empty → no SCP fields appear anywhere in the system.

### Tab 4 — Enrollment Gate

```
ENROLLMENT GATE

  ┌──────────────────────────────────────────────────────────────┐
  │  Public Admission Portal                                     │
  │  ○──────────●  OPEN                                          │
  │                                                              │
  │  The online admission form at /apply is currently accepting  │
  │  applications. Toggle OFF to close it.                       │
  │                                                              │
  │  Last changed: Feb 1, 2026, 8:00 AM  by Cruz, Regina        │
  └──────────────────────────────────────────────────────────────┘
```

| Gate State | `/apply` | `/f2f-admission` |
|---|---|---|
| OPEN | Accepts applications | Always accessible |
| CLOSED | Redirects to `/closed` | Always accessible (registrar override) |

`PATCH /api/settings/enrollment-gate` → `AuditLog: ENROLLMENT_GATE_TOGGLED`

---

## Complete Route Table for REGISTRAR

| Route | Page Component | API Endpoints |
|---|---|---|
| `/dashboard` | `Dashboard.tsx` | `GET /api/dashboard/stats` |
| `/f2f-admission` | `F2FAdmission.tsx` | `POST /api/applications/f2f` |
| `/applications` | `Applications.tsx` | `GET /api/applications` |
| `/applications/:id` | `ApplicationDetail.tsx` | `GET /api/applications/:id` · `PATCH /api/applications/:id/*` |
| `/students` | `Students.tsx` | `GET /api/students` |
| `/students/:id` | `StudentProfile.tsx` | `GET/PUT /api/students/:id` |
| `/teachers` | `Teachers.tsx` | `GET /api/teachers` · `POST /api/teachers` |
| `/teachers/:id` | `TeacherProfile.tsx` | `GET/PUT /api/teachers/:id` · `POST /api/teachers/:id/provision-account` |
| `/sections` | `Sections.tsx` | `GET/POST/PUT/DELETE /api/sections` |
| `/audit-logs` | `AuditLogs.tsx` | `GET /api/audit-logs` |
| `/settings` | `Settings.tsx` | All `/api/settings/*` · `/api/academic-years/*` · `/api/grade-levels/*` · `/api/strands/*` · `/api/scp-programs/*` |
| `/change-password` | `ChangePassword.tsx` | `POST /api/auth/change-password` |

**Cannot access (403):** `/admin/users` · `/admin/email-logs` · `/admin/system`

---

## Log Out Behavior

The Log Out button at the bottom of the sidebar:
1. Calls `authStore.clearAuth()` → sets `{ token: null, user: null }`
2. Removes `auth-storage` from `localStorage`
3. Navigates to `/` — **not directly to `/login`**
4. `/` redirects to `/apply` or `/closed` based on `enrollmentOpen`

The "Staff Login" link in the footer of `/closed` or `/apply` is the path back to the login page (Layer 1 gate).

---

## SidebarContent.tsx — Rendering Logic for REGISTRAR

```tsx
const isRegistrar = user?.role === 'REGISTRAR';
const isAdmin     = user?.role === 'SYSTEM_ADMIN';

{(isRegistrar || isAdmin) && (
  <>
    <SidebarSection label="Admission">
      <NavItem href="/f2f-admission"  icon={UserPlus}        label="Walk-in Admission" />
    </SidebarSection>

    <SidebarSection label="Enrollment">
      <NavItem href="/dashboard"      icon={LayoutDashboard} label="Dashboard" />
      <NavItem href="/applications"   icon={ClipboardList}   label="Applications" />
    </SidebarSection>

    <SidebarSection label="Records">
      <NavItem href="/students"       icon={Users}           label="Students" />
      <NavItem href="/audit-logs"     icon={ScrollText}      label="Audit Logs" />
    </SidebarSection>

    <SidebarSection label="Management">
      <NavItem href="/teachers"       icon={GraduationCap}   label="Teachers" />
      <NavItem href="/sections"       icon={School}          label="Sections" />
      <NavItem href="/settings"       icon={Settings}        label="Settings" />
    </SidebarSection>
  </>
)}
```

---

*Document v3.0.0 — REGISTRAR Role Sidebar*
*System: School Admission, Enrollment & Information Management System*
*Derived from: PRD v3.0.0 §4 · §6 · §7 · §8*
