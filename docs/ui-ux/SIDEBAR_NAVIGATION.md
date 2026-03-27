# Sidebar Navigation Specification
## Web-Based School Admission, Enrollment & Information Management System

**Document Type:** Sidebar Navigation Reference
**Derived From:** PRD v3.0.0 · Registrar Storyboard Workflow · School Year Setup Architecture
**Policy Basis:** DepEd Order No. 017, s. 2025 · DepEd Memorandum No. 012, s. 2026
**Stack:** React 19 · React Router v7 · shadcn/ui · Tailwind CSS v4 · Lucide React Icons

---

## Overview

The application has two distinct navigation contexts:

| Context | Who Sees It | Layout |
|---|---|---|
| **Public** | Unauthenticated visitors | No sidebar — full-page guest layout |
| **Authenticated Dashboard** | REGISTRAR · SYSTEM_ADMIN | Left sidebar with role-filtered nav items |

The sidebar is rendered inside `AppLayout.tsx` and is shared by both roles. Each nav item is conditionally rendered based on the JWT role decoded from the Zustand `authStore`.

---

## Responsive Sidebar Behavior

| Viewport | Behavior | Component |
|---|---|---|
| **Mobile & Tablet** (`< 1024px`) | Sidebar hidden by default. Hamburger icon in the top header opens a full-height drawer from the left. | shadcn/ui `Sheet` with `side="left"`, `className="w-64 p-0"` |
| **Desktop** (`≥ 1024px`) | Sidebar always visible as a fixed left panel. | `<aside className="hidden lg:flex lg:w-64 lg:flex-col ...">` |
| **Icon-only collapse** | Desktop sidebar is collapsible to `w-16` (icons only, no labels) via a toggle button at the bottom. | State managed by `useSidebarStore` (Zustand) |

---

## Sidebar Anatomy

```
┌─────────────────────────────────┐
│  [School Logo]                  │  ← from SchoolSettings.logoUrl
│  [School Name]               │  ← from SchoolSettings.schoolName
│  SY 2026–2027  ● ACTIVE         │  ← from active AcademicYear.yearLabel
├─────────────────────────────────┤
│  [Nav Items — role-filtered]    │
│                                 │
│  ...                            │
├─────────────────────────────────┤
│  [User Info at Bottom]          │  ← logged-in user name + role badge
│  Cruz, Regina                   │
│  ● Registrar                    │
│  [Log Out]                      │
└─────────────────────────────────┘
```

**Sidebar header elements:**
- School logo thumbnail (shows default school icon if no logo uploaded)
- School name (from `SchoolSettings.schoolName`)
- Active academic year label + green `ACTIVE` badge
- Both logo and name are data-driven — they update immediately when the registrar changes them in Settings

**Active nav item styling:**
- Active route: accent-colored left border, accent background tint (`--accent-muted`), accent text color
- Inactive route: `text-muted-foreground`, no border, subtle hover background
- Active state driven by React Router v7's `NavLink` `isActive` prop

---

## Complete Navigation Item Reference

### REGISTRAR Role — Full Sidebar

| # | Label | Icon (Lucide React) | Route | Role Access | PRD Section |
|---|---|---|---|---|---|
| 1 | Dashboard | `LayoutDashboard` | `/dashboard` | ALL roles | §6.3 |
| 2 | Walk-in Admission | `UserPlus` | `/f2f-admission` | REGISTRAR, SYSTEM_ADMIN | §6.2 |
| 3 | Applications | `ClipboardList` | `/applications` | REGISTRAR, SYSTEM_ADMIN | §6.4 |
| 4 | Students | `Users` | `/students` | REGISTRAR, SYSTEM_ADMIN | §6.5 |
| 5 | Teachers | `GraduationCap` | `/teachers` | REGISTRAR, SYSTEM_ADMIN | §6.6 |
| 6 | Sections | `School` | `/sections` | REGISTRAR, SYSTEM_ADMIN | §6.7 |
| 7 | Audit Logs | `ScrollText` | `/audit-logs` | REGISTRAR, SYSTEM_ADMIN | §6.9 |
| 8 | Settings | `Settings` | `/settings` | REGISTRAR, SYSTEM_ADMIN | §6.8 |

---

## Per-Item Detail

---

### 1. Dashboard — `/dashboard`

```
Icon  : LayoutDashboard
Route : /dashboard
Auth  : JWT required — ALL roles (different content per role)
Page  : client/src/pages/dashboard/Index.tsx
API   : GET /api/dashboard/stats
```

**What the REGISTRAR sees:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  STAT CARDS  (grid-cols-1 → md:grid-cols-2 → lg:grid-cols-4)        │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │ 🕐 14        │  │ ✓ 1,243      │  │ ⏳ 5         │  │ 🏫 3    │ │
│  │ Pending      │  │ Enrolled     │  │ Approved     │  │ Sections│ │
│  │ Applications │  │ (Total)      │  │ Awaiting     │  │ at Full │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────┘ │
│                                                                      │
│  CHARTS                                                              │
│  ┌─────────────────────────────┐  ┌──────────────────────────────┐  │
│  │  BarChart (horizontal)      │  │  PieChart (donut)            │  │
│  │  Enrollment by Grade Level  │  │  Application Status          │  │
│  │  Grade 7  ████████  215     │  │  Distribution                │  │
│  │  Grade 8  ███████   203     │  │  ● Enrolled  ● Rejected      │  │
│  │  ...                        │  │  ● Pending   ● Approved      │  │
│  └─────────────────────────────┘  └──────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────┐                                    │
│  │  PieChart (donut)            │                                    │
│  │  Admission Channel Breakdown │                                    │
│  │  ● Online  ● F2F (Walk-in)   │                                    │
│  └──────────────────────────────┘                                    │
│                                                                      │
│  SCP PIPELINE  (shown only if SCP programs are configured)           │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │  STE: 5 Pending · 3 Exam Scheduled · 2 Passed · 1 Failed       ││
│  │  SPA: 3 Pending · 2 Exam Scheduled · 1 Passed · 0 Failed       ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  RECENT ACTIVITY (last 10 AuditLog entries)                         │
│  • Feb 3, 9:14 AM  Registrar Cruz  APPLICATION_APPROVED → #42      │
│  • Feb 1, 8:00 AM  Registrar Cruz  ENROLLMENT_GATE_TOGGLED → OPEN  │
│  • Jan 31, 4:15 PM Admin           SECTION_CREATED → Grade 7 Rizal │
└──────────────────────────────────────────────────────────────────────┘
```

**Stat Card definitions:**

| Card | Label | Icon | Data Source |
|---|---|---|---|
| Card 1 | Total Pending | `Clock` | `COUNT(applicants WHERE status = 'PENDING' AND academicYearId = active)` |
| Card 2 | Total Enrolled | `UserCheck` | `COUNT(enrollments WHERE academicYearId = active)` |
| Card 3 | Approved (Awaiting) | `Hourglass` | `COUNT(applicants WHERE status = 'APPROVED' AND academicYearId = active)` |
| Card 4 | Sections at Capacity | `AlertCircle` | `COUNT(sections WHERE enrolled_count >= maxCapacity)` |

**Charts:**
- `BarChart` (Recharts, horizontal) — enrollment count per grade level for the active academic year
- `PieChart` (Recharts, donut) — proportion of PENDING / APPROVED / ENROLLED / REJECTED applications
- `PieChart` (Recharts, donut) — Admission Channel Breakdown: Online vs F2F

**SCP Pipeline Panel:**
- Shown only when the school has configured and activated SCP programs for the active AY
- Displays PENDING / EXAM_SCHEDULED / EXAM_TAKEN / PASSED / FAILED counts per SCP program code
- Collapses gracefully if no SCP programs are configured

**Recent Activity Feed:**
- Last 10 `AuditLog` entries in chronological reverse order
- Each entry shows: timestamp, user, `actionType` badge, description
- Rendered inside a shadcn/ui `Card` with a vertical timeline line

---

### 2. Walk-in Admission — `/f2f-admission`

```
Icon  : UserPlus
Route : /f2f-admission
Auth  : JWT required — REGISTRAR, SYSTEM_ADMIN
Page  : client/src/pages/admission/F2FAdmission.tsx
API   : POST /api/applications/f2f
```

**What the registrar sees:**

The F2F admission form is the registrar-facing equivalent of the public portal, used when a student or parent walks in to apply in person. The registrar fills all fields on the applicant's behalf.

**Key differences from online admission:**

| Aspect | Online | F2F |
|---|---|---|
| Enrollment gate | Redirects to `/closed` when OFF | Always accessible (registrar override) |
| `admissionChannel` stored | `ONLINE` | `F2F` |
| `encodedById` | null | Registrar's `User.id` |
| Privacy consent | Applicant checks on screen | Registrar confirms physical signature checkbox |
| Email delivery | Always attempted | Attempted if `emailAddress` provided |
| Fast-track option | Not available | Registrar may set initial status to `APPROVED` if documents are complete |
| Tracking number delivery | On-screen + email | On-screen (registrar prints or writes down) + email if address provided |

All the same validation rules, SCP conditional fields, and strand selection logic apply identically.

---

### 3. Applications — `/applications`

```
Icon  : ClipboardList
Route : /applications
Auth  : JWT required — REGISTRAR, SYSTEM_ADMIN
Page  : client/src/pages/applications/Index.tsx
        client/src/pages/applications/[id].tsx  (detail view)
API   : GET  /api/applications?status=&gradeLevelId=&applicantType=&admissionChannel=&page=&limit=
        GET  /api/applications/:id
        POST /api/applications/f2f
        PATCH /api/applications/:id/approve  { sectionId }
        PATCH /api/applications/:id/reject   { rejectionReason? }
        PATCH /api/applications/:id/schedule-exam
        PATCH /api/applications/:id/record-result
        PATCH /api/applications/:id/pass
        PATCH /api/applications/:id/fail
```

**What the registrar sees:**

```
APPLICATIONS                     [ Search by LRN or name... 🔍 ]  [Filter ▾]

  Year: SY 2026–2027    Grade: All ▾    Status: All ▾

  #    │ Learner Name          │ LRN              │ Grade    │ Track/Strand │ Status    │ Applied     │ Actions
  ─────┼───────────────────────┼──────────────────┼──────────┼──────────────┼───────────┼─────────────┼────────
  042  │ Dela Cruz, Juan R.    │ 123456789012     │ Grade 7  │ —            │ ● PENDING │ Feb 3, 2026 │ [View]
  041  │ Santos, Maria L.      │ 876543219012     │ Grade 11 │ Academic·STEM│ ● PENDING │ Feb 3, 2026 │ [View]
  040  │ Reyes, Pedro M.       │ 112233445566     │ Grade 7  │ —            │ ✓ APPROVED│ Feb 2, 2026 │ [View]
  ...
  (15 per page — paginated)
```

**Filter toolbar:**
- Real-time search: 300ms debounce on LRN or full name → `?search=` query param (no page reload)
- Grade Level filter: dynamic dropdown from active academic year's grade levels
- Applicant Type filter: ALL / REGULAR / configured SCP codes (dynamic from `GET /api/scp-programs/all`)
- Status filter: ALL / PENDING / APPROVED / REJECTED / ENROLLED / EXAM_SCHEDULED / EXAM_TAKEN / PASSED / FAILED
- Admission Channel filter: ALL / ONLINE / F2F
- Academic Year filter: defaults to active year; can be switched to view historical data

**Application detail view (`/applications/:id`):**
- Full applicant record: personal info, family & contact, enrollment preference (grade, track, cluster/strand)
- Phase indicator: PHASE 1 (pre-registration) or PHASE 2 (official enrollment)
- Admission channel badge: `ONLINE` or `F2F`
- Two-path approval actions determined by `applicantType` and current `status`:
  - **Regular path:** `[ Approve & Assign Section ]` · `[ Reject Application ]`
  - **SCP path:** `[ Verify & Schedule Exam ]` → `[ Record Result ]` → `[ Mark as Passed & Assign Section ]` or `[ Mark as Failed ]`
- For SY 2026–2027 Grade 11: shows `Track` and `Elective Cluster` fields instead of `Strand`
- For Grade 12 and JHS: shows `Strand` (Grade 12) or `N/A` (Grade 7–10)

**Status badge colors:**
- `PENDING` → amber/yellow `outline` badge
- `APPROVED` → green `outline` badge
- `REJECTED` → red `outline` badge
- `ENROLLED` → blue/accent `outline` badge

**Sub-route — `/applications/:id`:** Not a separate sidebar item. Opens as a full page or as a `Sheet` side panel depending on screen width. The breadcrumb shows `Applications › #APP-2026-00042`.

---

### 4. Students — `/students`

```
Icon  : Users
Route : /students
Auth  : JWT required — REGISTRAR, SYSTEM_ADMIN
Page  : client/src/pages/students/Index.tsx
        client/src/pages/students/Profile.tsx  (student profile)
API   : GET /api/students?search=&gradeLevelId=&sectionId=&status=&admissionChannel=&academicYearId=&page=&limit=
        GET /api/students/:id
        PUT /api/students/:id
        GET /api/students/:id/history
```

**What the registrar sees:**

```
STUDENTS                   [ Search by LRN or name... 🔍 ]

  Year: SY 2026–2027   Grade: All ▾   Section: All ▾   Status: All ▾

  LRN             │ Full Name             │ Grade    │ Section   │ Status    │ Date Applied │ Actions
  ────────────────┼───────────────────────┼──────────┼───────────┼───────────┼──────────────┼────────
  123456789012    │ DELA CRUZ, Juan R.    │ Grade 7  │ Rizal     │ ✓ ENROLLED│ Feb 3, 2026  │ [View]
  876543219012    │ SANTOS, Maria L.      │ Grade 11 │ STEM-A    │ ✓ ENROLLED│ Feb 3, 2026  │ [View]
  112233445566    │ REYES, Pedro M.       │ Grade 8  │ Bonifacio │ ✓ ENROLLED│ Feb 2, 2026  │ [View]
  ...
```

**Table columns:**

| Column | Sortable | Display Notes |
|---|---|---|
| LRN | Yes | Monospace font — 12-digit number |
| Full Name | Yes | LAST, First MI — uppercase last name |
| Grade Level | Yes | `Badge` component |
| Section | Yes | Plain text |
| Admission Channel | Yes | `Badge` — `ONLINE` or `F2F` |
| Status | Yes | Colored `Badge` (PENDING / APPROVED / ENROLLED / REJECTED) |
| Date Applied | Yes | Formatted: `Mon DD, YYYY` |
| Actions | No | `[View]` · `[Edit]` buttons → opens student profile |

**Filter toolbar:**
- Real-time search: 300ms debounce — searches both LRN and full name simultaneously
- All filters bound to URL search params via `useSearchParams()` — shareable deep-link URLs
- Section dropdown is dynamically filtered by the selected Grade Level (cascading filter)
- Admission Channel filter: ALL / ONLINE / F2F
- Pagination: 15 records per page (server-side)

**Student Profile (`/students/:id`) — 4 tabs:**

**Tab 1 — Personal Information:** All demographic fields from the `Applicant` model. Editable by REGISTRAR and SYSTEM_ADMIN. LRN is read-only. All changes write an `AuditLog` entry with `actionType: STUDENT_RECORD_UPDATED`.

**Tab 2 — Academic History:** Chronological list of all enrollments across academic years (year, grade, section, date enrolled, enrolled by).

**Tab 3 — Application Record:** Original application details, SCP assessment records (if applicable), status timeline from AuditLog entries.

**Tab 4 — Classifications & Special Programs:** Learner type, IP community, 4Ps, PWD, current SCP designation.

**Purpose:** This is the primary lookup tool during busy enrollment days. When a parent calls asking about their child's section, or a teacher asks which section a student is in, the registrar searches here. It is also used to find a specific learner before editing their record or assigning/confirming their section.

**On mobile:** Lower-priority columns (`Section`, `Date Applied`) are hidden via `hidden md:table-cell`. Table is wrapped in `overflow-x-auto` for horizontal scrolling.

---

### 5. Teachers — `/teachers`

```
Icon  : GraduationCap
Route : /teachers
Auth  : JWT required — REGISTRAR, SYSTEM_ADMIN
Page  : client/src/pages/teachers/Index.tsx
        client/src/pages/teachers/Profile.tsx  (teacher profile)
API   : GET    /api/teachers?search=&page=&limit=
        POST   /api/teachers
        GET    /api/teachers/:id
        PUT    /api/teachers/:id
        POST   /api/teachers/:id/provision-account
```

**What the registrar sees:**

```
TEACHERS                                    [ + Add Teacher ]

  Employee ID │ Full Name             │ Specialization     │ Assigned Sections │ Account Status │ Actions
  ────────────┼───────────────────────┼────────────────────┼───────────────────┼────────────────┼──────────────────────────
  T-2024-001  │ Santos, Caridad M.    │ Math & Science     │ 2                 │ ● Active       │ [View] [Edit]
  T-2024-002  │ Reyes, Jun P.         │ English            │ 1                 │ ● Active       │ [View] [Edit]
  —           │ Flores, Ana L.        │ Filipino           │ 1                 │ ○ Not Provisioned │ [View] [Edit] [Provision Account]
```

**Create Teacher dialog fields:**
- Last Name, First Name, Middle Name
- Employee ID (optional)
- Contact Number
- Specialization

**Provision System Account:**
When a teacher profile has no system login, a "Provision Account" action opens a dialog asking for an email address. The system creates a `User` record with `role: TEACHER`, `mustChangePassword: true`, a system-generated temporary password. Sends a welcome email with the school name, temporary password, and login instructions.

**Teacher Profile (`/teachers/:id`) — 3 tabs:**

**Tab 1 — Profile:** Full name, Employee ID, Contact Number, Specialization. Editable by REGISTRAR and SYSTEM_ADMIN.

**Tab 2 — Assigned Sections:** All sections assigned to this teacher for the active AY. Shows grade level, section name, enrolled count / max capacity. "Unassign" removes the teacher (confirmation dialog; audit logged).

**Tab 3 — System Account:** Account status badge (Active / Inactive / Not Provisioned). If active: last login timestamp, account creation date, role. SYSTEM_ADMIN additionally sees: Deactivate Account button, Reset Password button.

---

### 6. Sections — `/sections`

```
Icon  : School
Route : /sections
Auth  : JWT required — REGISTRAR, SYSTEM_ADMIN
Page  : client/src/pages/sections/Index.tsx
API   : GET    /api/sections?academicYearId=&gradeLevelId=
        POST   /api/sections
        PUT    /api/sections/:id
        DELETE /api/sections/:id  (blocked if enrollments exist)
```

**What the registrar sees:**

```
SECTIONS                Year: [ SY 2026–2027 ▾ ]   Grade: [ All ▾ ]   [ + New Section ]

  Grade Level  │ Section Name │ Advising Teacher    │ Capacity │ Enrolled        │ Status
  ─────────────┼──────────────┼─────────────────────┼──────────┼─────────────────┼──────────────────────
  Grade 7      │ Rizal        │ Ms. Caridad Santos  │ 45       │ █████████ 42/45 │ ⚠ Near Full   [Edit]
  Grade 7      │ Bonifacio    │ Mr. Jun Reyes       │ 45       │ ████████  38/45 │ ● Available   [Edit]
  Grade 7      │ Luna         │ Ms. Ana Flores      │ 45       │ ██████████45/45 │ ✗ FULL        [Edit]
  Grade 7      │ Mabini       │ Mr. Carlo Torres    │ 45       │ ███████   33/45 │ ● Available   [Edit]
  Grade 8      │ Rizal        │ Ms. Eva Cruz        │ 45       │ ████████  36/45 │ ● Available   [Edit]
  ...
  Grade 11     │ STEM-A       │ Mr. Ben Lim         │ 45       │ ████████  32/45 │ ● Available   [Edit]
  Grade 11     │ ICT-A        │ Ms. Rose Palma      │ 45       │ ██████████45/45 │ ✗ FULL        [Edit]
  ...
  Grade 12     │ STEM-A       │ Mr. Ben Lim         │ 45       │ ████████  40/45 │ ● Available   [Edit]
  Grade 12     │ ABM-A        │ Ms. Nora Reyes      │ 45       │ ███████   35/45 │ ● Available   [Edit]
```

**Capacity status badge logic:**

| Badge | Color | Condition |
|---|---|---|
| `● Available` | Green | `enrolled < maxCapacity` |
| `⚠ Near Full` | Amber | `enrolled >= 86% of maxCapacity` (e.g., 39/45 or higher) |
| `✗ FULL` | Red | `enrolled >= maxCapacity` |

**Create/Edit Section Dialog fields:**

| Field | Type | Notes |
|---|---|---|
| Grade Level | `Select` | Dropdown from active academic year's grade levels |
| Section Name | `Input` | Free text (e.g., "Rizal", "STEM-A", "ICT-A") |
| Max Capacity | `Input` (number) | Default: 40, minimum: 1 |
| Advising Teacher | `Select` (optional) | Searchable dropdown from Teacher directory — shows Employee ID + Name |
| SCP Code | `Select` (optional) | Dropdown from active AY's SCP programs |

**Delete behavior:**
- A section with zero enrollments: deletable with confirmation Dialog
- A section with existing enrollments: delete is blocked (`HTTP 409`) — system shows error toast: *"Cannot delete a section with enrolled students."*

**Year-context filter:**
- Defaults to the active academic year
- Can be switched to previous years to view historical section data (read-only for archived years)

**SHS dual-policy note (DM 012, s. 2026):**
For SY 2026–2027, sections are named either by track (e.g., `Academic-A`) or by cluster focus (e.g., `STEM-A`, `ICT-A`). Grade 12 sections retain their old strand names (`STEM-A`, `ABM-A`). Both exist simultaneously in this table under the same academic year.

---

### 7. Audit Logs — `/audit-logs`

```
Icon  : ScrollText
Route : /audit-logs
Auth  : JWT required — REGISTRAR, SYSTEM_ADMIN (different visibility rules)
Page  : client/src/pages/audit-logs/Index.tsx
API   : GET /api/audit-logs?actionType=&dateFrom=&dateTo=&userId=&page=&limit=&export=csv
```

**What the registrar sees:**

```
AUDIT LOGS          [ Action Type: All ▾ ]   [ Date Range: __ to __ ]

  Timestamp              │ User              │ Action Type                │ Description                                         │ IP
  ───────────────────────┼───────────────────┼────────────────────────────┼─────────────────────────────────────────────────────┼──────────────
  Feb 3, 2026  9:14 AM   │ Cruz, Regina      │ APPLICATION_APPROVED       │ Approved #42 → assigned to Grade 7 Rizal            │ 192.168.1.10
  Feb 3, 2026  9:11 AM   │ (system)          │ APPLICATION_SUBMITTED      │ Guest submitted #42 (LRN: 123456789012)             │ 203.177.x.x
  Feb 3, 2026  8:55 AM   │ Cruz, Regina      │ APPLICATION_APPROVED       │ Approved #41 → Grade 11 STEM-A (Academic / STEM)    │ 192.168.1.10
  Feb 1, 2026  8:00 AM   │ Cruz, Regina      │ ENROLLMENT_GATE_TOGGLED    │ Admin set enrollment to OPEN                        │ 192.168.1.10
  Jan 31, 2026 4:15 PM   │ Cruz, Regina      │ SECTION_CREATED            │ Created Grade 7 Rizal (capacity: 45)                │ 192.168.1.10
  Jan 28, 2026 2:00 PM   │ Cruz, Regina      │ SETTINGS_UPDATED           │ Admin updated school identity settings              │ 192.168.1.10
  Jan 28, 2026 1:55 PM   │ Cruz, Regina      │ USER_LOGIN                 │ User registrar@school.edu.ph logged in from 192.x.x.x │ 192.168.1.10
```

**All logged action types (actionType Badge values):**

| Action Type | Trigger |
|---|---|
| `USER_LOGIN` | Every successful JWT login |
| `USER_LOGOUT` | User logs out |
| `APPLICATION_SUBMITTED` | Any applicant submits the public form at `/apply` |
| `F2F_APPLICATION_ENTERED` | Registrar enters a walk-in application via `/f2f-admission` |
| `APPLICATION_APPROVED` | Registrar approves + assigns a section |
| `APPLICATION_REJECTED` | Registrar rejects with or without a reason |
| `EXAM_SCHEDULED` | Registrar schedules SCP assessment |
| `EXAM_RESULT_RECORDED` | Registrar records assessment result (score, pass/fail) |
| `APPLICATION_PASSED` | Registrar marks SCP applicant as PASSED |
| `APPLICATION_FAILED` | Registrar marks SCP applicant as FAILED |
| `STUDENT_RECORD_UPDATED` | Registrar updates a student's personal information |
| `SECTION_CREATED` | Registrar creates a new section |
| `SECTION_UPDATED` | Registrar edits section name, capacity, or advising teacher |
| `SECTION_DELETED` | Registrar deletes a section |
| `TEACHER_CREATED` | Registrar adds a new teacher profile |
| `TEACHER_UPDATED` | Registrar updates a teacher profile |
| `TEACHER_ACCOUNT_PROVISIONED` | Registrar provisions a system account for a teacher |
| `ENROLLMENT_GATE_TOGGLED` | Registrar opens or closes the public enrollment portal |
| `ACADEMIC_YEAR_CREATED` | Registrar creates a new academic year |
| `ACADEMIC_YEAR_ACTIVATED` | Registrar activates an academic year |
| `SCHOOL_SETTINGS_UPDATED` | School name, logo, or profile changes |
| `ADMIN_USER_CREATED` | SYSTEM_ADMIN creates a user account (admin-only visibility) |
| `ADMIN_USER_UPDATED` | SYSTEM_ADMIN updates a user account (admin-only visibility) |
| `ADMIN_USER_DEACTIVATED` | SYSTEM_ADMIN deactivates a user account (admin-only visibility) |
| `ADMIN_USER_REACTIVATED` | SYSTEM_ADMIN reactivates a user account (admin-only visibility) |
| `ADMIN_PASSWORD_RESET` | SYSTEM_ADMIN resets a user's password (admin-only visibility) |
| `ADMIN_EMAIL_RESENT` | SYSTEM_ADMIN manually resends a failed email (admin-only visibility) |

**Role-based visibility:**
- **REGISTRAR** sees all action types **except** `ADMIN_*` types. No user filter dropdown. No CSV export.
- **SYSTEM_ADMIN** sees all action types including `ADMIN_*`. Has a user filter dropdown. Can export as CSV.

**Filters:**
- Action Type dropdown: ALL or any single action type
- Date Range picker: `dateFrom` and `dateTo` (inclusive)
- Pagination: 15 records per page (server-side)

**Non-destructive:** No delete button, no delete API endpoint. Audit logs are permanent and append-only by design.

**On mobile:** `IP Address` column hidden via `hidden md:table-cell`.

---

### 8. Settings — `/settings`

```
Icon  : Settings
Route : /settings
Auth  : JWT required — REGISTRAR, SYSTEM_ADMIN
Page  : client/src/pages/settings/Index.tsx
API   : Various (per tab — see below)
```

Settings is organized into **4 tabs** using shadcn/ui `Tabs`. All tabs are rendered on the same `/settings` route — no sub-routes.

---

#### Settings Tab 1 — School Profile

```
Tab Label : School Profile
API       : PUT   /api/settings/identity   (school name, school ID, division, region)
            POST  /api/settings/logo       (logo upload + color extraction)
```

**What the registrar sees:**

```
SETTINGS > School Profile

  School Name *
  [ [School Name]                                     ]

  School ID (DepEd) *
  [ 304123                                             ]

  Division *
  [ Division of Imus City                              ]

  Region *
  [ Region IV-A (CALABARZON)                           ]

  [ Save Profile ]

  ─────────────────────────────────────────────────────────────────
  School Logo

  ┌────────────────────┐
  │   [logo preview]   │    Accepted: PNG · JPG · WEBP · max 2MB
  └────────────────────┘
  [ Change Logo ]

  Accent Color — extracted from logo
  ┌────────────────────────────────────────────────────────────────┐
  │  Extracted: ██████  HSL(0 72% 38%)                            │
  │  Preview:  [Button]  [Badge]  [Sidebar Item]  [Link]          │
  └────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- School name: saved immediately on button click → `PUT /api/settings/identity`
- Logo: client-side `FileReader` preview before upload → `POST /api/settings/logo` (multipart/form-data)
- After logo upload: `logoColorService` extracts dominant accent color → updates `--accent`, `--primary`, `--ring` CSS variables globally
- White page background (`--background`) is **never changed** by logo upload
- Color preview widget shows how the extracted accent looks on real UI components before saving

---

#### Settings Tab 2 — Academic Year

```
Tab Label : Academic Year
API       : GET    /api/academic-years
            POST   /api/academic-years         { yearLabel }
            PUT    /api/academic-years/:id
            DELETE /api/academic-years/:id
            (activate via PUT — sets isActive: true, deactivates all others in one transaction)
```

**What the registrar sees:**

```
SETTINGS > Academic Year                                 [ + New Academic Year ]

  Year Label    │ Status     │ Actions
  ──────────────┼────────────┼──────────────────────────────────────────
  2026–2027     │ ● ACTIVE   │ [Edit]
  2025–2026     │  Archived  │ [View]
  2024–2025     │  Archived  │ [View]
```

**Actions:**
- `+ New Academic Year` → Dialog with `Year Label` field (free text, format: `YYYY–YYYY`)
- `[Activate]` button (on INACTIVE years) → Confirmation Dialog → activates the year, archives the current active year in one DB transaction
- `[Edit]` → Dialog to rename the year label
- `[View]` (archived years) → read-only — historical data preserved permanently

**Constraint:** Only one academic year may have `isActive: true` at any time. Activation is enforced by a DB-level transaction.

---

#### Settings Tab 3 — Grade Levels & Strands / Clusters

```
Tab Label : Grade Levels & Strands
API       : GET    /api/grade-levels/all
            POST   /api/grade-levels             { name, displayOrder, academicYearId }
            PUT    /api/grade-levels/:id
            DELETE /api/grade-levels/:id
            GET    /api/strands?gradeLevelId=&track=
            POST   /api/strands                  { name, applicableGradeLevelIds, academicYearId, curriculumType, track? }
            PUT    /api/strands/:id
            DELETE /api/strands/:id
```

**What the registrar sees (SY 2026–2027 — dual-policy layout per PRD Addendum A.3):**

```
SETTINGS > Grade Levels & Strands        Year: [ SY 2026–2027 ▾ ]

┌─────────────────────────────────────────────────────────────────────┐
│  GRADE LEVELS                           [ + Add Grade Level ]       │
│  ─────────────────────────────────────────────────────────────────  │
│  1. Grade 7                  [Edit]  [Delete]                       │
│  2. Grade 8                  [Edit]  [Delete]                       │
│  3. Grade 9                  [Edit]  [Delete]                       │
│  4. Grade 10                 [Edit]  [Delete]                       │
│  5. Grade 11                 [Edit]  [Delete]                       │
│  6. Grade 12                 [Edit]  [Delete]                       │
└─────────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────────────┐
│  GRADE 11 — Strengthened SHS Elective Clusters (DM 012, s. 2026)   │
│  Check clusters offered by this school:                             │
│                                                                     │
│  ACADEMIC TRACK                                                     │
│  ☑ STEM                                                             │
│  ☑ Arts, Social Sciences, and Humanities                            │
│  ☑ Business and Entrepreneurship                                    │
│  ☐ Sports, Health, and Wellness                                     │
│  ☐ Field Experience                                                 │
│                                                                     │
│  TECHPRO TRACK                                                      │
│  ☑ ICT Support and Computer Programming Technologies                │
│  ☑ Hospitality and Tourism                                          │
│  ☐ Construction and Building Technologies                           │
│  ☐ Automotive and Small Engine Technologies                         │
│  ☐ Industrial Technologies                                          │
│  ☐ Agri-Fishery Business and Food Innovation                        │
│  ☐ Artisanry and Creative Enterprise                                │
│  ☐ Aesthetic, Wellness, and Human Care                              │
│  ☐ Creative Arts and Design Technologies                            │
│  ☐ Maritime Transport                                               │
│                                                    [ Save Clusters ]│
└─────────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────────────┐
│  GRADE 12 — Old Strand-Based Curriculum (SY 2026–2027 Transition)  │
│                                        [ + Add Strand ]             │
│  ─────────────────────────────────────────────────────────────────  │
│  STEM    (Grade 12)       [Edit]  [Delete]                         │
│  ABM     (Grade 12)       [Edit]  [Delete]                         │
│  HUMSS   (Grade 12)       [Edit]  [Delete]                         │
│  GAS     (Grade 12)       [Edit]  [Delete]                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Two-panel split behavior:**
- **Top panel — Grade Levels:** CRUD list; items sorted by `displayOrder`; deletable only if no sections or applicants are linked
- **Middle panel — Grade 11 Clusters (DM 012, s. 2026):** Checklist of all DepEd-defined elective clusters (hardcoded master list in the frontend); registrar checks only those the school offers; each checked item saves as a `Strand` record with `curriculumType: ELECTIVE_CLUSTER`
- **Bottom panel — Grade 12 Old Strands:** Full CRUD; `curriculumType: OLD_STRAND`; linked to Grade 12 only

**Cascade behavior:**
- Deleting a Grade Level cascades and deletes all linked Sections, Strands, and Applicant records (with confirmation Dialog warning)
- Deleting a Strand/Cluster removes it from the admission portal dropdown immediately

---

#### Settings Tab 4 — Enrollment Gate

```
Tab Label : Enrollment Gate
API       : PATCH /api/settings/enrollment-gate  { enrollmentOpen: boolean }
```

**What the registrar sees:**

```
SETTINGS > Enrollment Gate

  ┌────────────────────────────────────────────────────────────────┐
  │  Enrollment Period                                              │
  │                                                                │
  │  ────●────────  ON                                             │
  │  Status:  ● OPEN  (green badge)                                │
  │                                                                │
  │  The public admission portal is currently LIVE at:             │
  │  https://[school-domain]/apply                                 │
  │                                                                │
  │  Toggle OFF to close the portal. Visitors will be             │
  │  redirected to the "Enrollment Closed" page.                   │
  └────────────────────────────────────────────────────────────────┘
```

**Toggle states:**

| State | Visual | Public Portal Behavior |
|---|---|---|
| OFF | `● CLOSED` red badge | `/apply` redirects to `/closed` via React Router loader |
| ON | `● OPEN` green badge | `/apply` renders the full admission form |

**Confirmation before toggling:** Both ON→OFF and OFF→ON actions require a confirmation Dialog. This prevents accidental opening or closing of the portal.

**Frontend guard mechanism:** The React Router v7 `loader` on `/apply` calls `GET /api/settings/public` on every page load. If `enrollmentOpen = false`, it immediately redirects to `/closed` — no admission form ever renders for a closed portal.

**DepEd usage context:**
- Toggle ON → Last Saturday of January (Early Registration opens)
- Toggle OFF → Last Friday of February (Early Registration closes)
- Toggle ON again → ~1 week before class opening in June (Regular Enrollment opens)
- Toggle OFF → After Brigada Eskwela week
- May be toggled ON briefly for late enrollees or transferees, then OFF immediately after

---

## Route Access Matrix

| Route | REGISTRAR | SYSTEM_ADMIN | Unauthenticated |
|---|---|---|---|
| `/dashboard` | ✅ Full | ✅ Full + System Panel | → `/login` |
| `/f2f-admission` | ✅ Full | ✅ Full | → `/login` |
| `/applications` | ✅ Full | ✅ Full | → `/login` |
| `/applications/:id` | ✅ Full | ✅ Full | → `/login` |
| `/students` | ✅ Full | ✅ Full | → `/login` |
| `/students/:id` | ✅ Full (4-tab profile) | ✅ Full (4-tab profile) | → `/login` |
| `/teachers` | ✅ Full CRUD | ✅ Full CRUD | → `/login` |
| `/teachers/:id` | ✅ Full (3-tab profile) | ✅ Full (3-tab profile + admin actions) | → `/login` |
| `/sections` | ✅ Full CRUD | ✅ Full CRUD | → `/login` |
| `/audit-logs` | ✅ Own + system events (no ADMIN_ types, no user filter, no export) | ✅ Full (all users, ADMIN_ types, user filter, CSV export) | → `/login` |
| `/settings` | ✅ Full (all 4 tabs) | ✅ Full (all 4 tabs) | → `/login` |
| `/admin/users` | ❌ 403 | ✅ Full CRUD | → `/login` |
| `/admin/email-logs` | ❌ 403 | ✅ Full + Resend | → `/login` |
| `/admin/system` | ❌ 403 | ✅ Read-only | → `/login` |
| `/change-password` | ✅ (when required) | ✅ (when required) | → `/login` |
| `/apply` | N/A (public) | N/A (public) | ✅ if gate OPEN; → `/closed` if gate OFF |
| `/closed` | N/A (public) | N/A (public) | ✅ Always accessible |
| `/track/:trackingNumber` | N/A (public) | N/A (public) | ✅ Always accessible |
| `/login` | → `/dashboard` | → `/dashboard` | ✅ Login form |

---

## Sidebar Component File References

```
client/src/
│
├── layouts/
│   ├── AppLayout.tsx           ← renders sidebar + main content area
│   ├── GuestLayout.tsx         ← no sidebar (public pages: /apply, /closed, /track)
│   └── AuthLayout.tsx          ← no sidebar, centered (login page only)
│
├── components/
│   └── sidebar/
│       ├── SidebarContent.tsx  ← shared between desktop <aside> and mobile <Sheet>
│       ├── NavItem.tsx         ← individual nav link with icon, label, active state
│       ├── NavDivider.tsx      ← section divider with label ("Enrollment", "System", "Records")
│       └── SidebarHeader.tsx   ← school logo + name + active year badge
│
├── pages/
│   ├── dashboard/Index.tsx     ← /dashboard
│   ├── admission/
│   │   └── F2FAdmission.tsx    ← /f2f-admission
│   ├── applications/
│   │   ├── Index.tsx           ← /applications
│   │   └── [id].tsx            ← /applications/:id
│   ├── students/
│   │   ├── Index.tsx           ← /students
│   │   └── Profile.tsx         ← /students/:id
│   ├── teachers/
│   │   ├── Index.tsx           ← /teachers
│   │   └── Profile.tsx         ← /teachers/:id
│   ├── sections/Index.tsx      ← /sections
│   ├── audit-logs/Index.tsx    ← /audit-logs
│   ├── settings/Index.tsx      ← /settings (4 tabs)
│   ├── auth/
│   │   ├── Login.tsx           ← /login
│   │   └── ChangePassword.tsx  ← /change-password
│   └── admin/
│       ├── Users.tsx           ← /admin/users (admin only)
│       ├── EmailLogs.tsx       ← /admin/email-logs (admin only)
│       └── SystemHealth.tsx    ← /admin/system (admin only)
│
└── stores/
    ├── authStore.ts            ← { user, token, role } — drives nav item visibility
    └── settingsStore.ts        ← { schoolName, logoUrl, colorScheme, activeYear }
                                   — drives sidebar header content + accent color
```

---

## Sidebar Implementation Notes for Claude Code

1. **Role filtering** — The sidebar renders three conditional sections based on role:
   - **Always visible:** Dashboard
   - **Admission section** (REGISTRAR + SYSTEM_ADMIN): Walk-in Admission, Applications, Students, Teachers, Sections
   - **System section** (SYSTEM_ADMIN only): User Management, Email Logs, System Health
   - **Records section** (REGISTRAR + SYSTEM_ADMIN): Audit Logs, Settings

   Section dividers use the `NavDivider` component with labels ("Enrollment", "System", "Records").

2. **Active state** — Use React Router v7 `<NavLink>` with `className={({ isActive }) => isActive ? 'active-styles' : 'default-styles'}`. Do NOT use manual `window.location.pathname` comparisons.

3. **Accent color on sidebar** — Active nav item background tint uses `bg-[var(--accent-muted)]` and active text/border uses `text-[var(--accent)]` and `border-l-2 border-[var(--accent)]`. This ensures the active highlight always matches the school's extracted logo color.

4. **School logo in sidebar header** — Fetched from `settingsStore.logoUrl`. If null (no logo uploaded), show a default school building icon (`<School className="w-8 h-8" />`). Never hardcode the school logo path.

5. **Active academic year in sidebar header** — Fetched from `settingsStore.activeYear.yearLabel`. Show a green dot + the year label. If no active year is set (fresh installation), show `"No Active Year"` with an amber warning icon.

6. **Mobile hamburger** — The `AppLayout.tsx` top header bar (visible only on `< lg`) contains a `<MenuIcon>` button that toggles `mobileOpen` state, which controls the `Sheet` `open` prop.

7. **Sidebar collapse (desktop)** — A `<ChevronLeft>` / `<ChevronRight>` toggle button at the bottom of the sidebar switches between `w-64` (expanded) and `w-16` (icon-only). When collapsed, `NavItem` shows only the icon (no label), with a `Tooltip` on hover showing the label.

8. **Log Out** — At the bottom of the sidebar below the user info. Clicking it calls `authStore.logout()` which clears the token from Zustand + localStorage, then redirects to `/login`.

---

*Document compiled from: PRD v3.0.0 · Registrar Storyboard Workflow · School Year Setup Architecture · System Admin Specification*
*Policy: DepEd Order No. 017, s. 2025 · DepEd Memorandum No. 012, s. 2026*

---

## Admin Sidebar Layout (Quick Reference)

The SYSTEM_ADMIN role sees the full sidebar including admin-only items. The sidebar renders three grouped sections with `NavDivider` labels.

```
┌─────────────────────────────────┐
│  [School Logo]                  │
│  [School Name]                  │
│  SY 2026–2027  ● ACTIVE         │
├─────────────────────────────────┤
│  📊  Dashboard                  │  ← all roles
│                                 │
│  ── ADMISSION ──                │
│  ✍️  Walk-in Admission          │  ← REGISTRAR, ADMIN
│  📋  Applications               │  ← REGISTRAR, ADMIN
│  👤  Students                   │  ← REGISTRAR, ADMIN
│  🎓  Teachers                   │  ← REGISTRAR, ADMIN
│  🏫  Sections                   │  ← REGISTRAR, ADMIN
│                                 │
│  ── SYSTEM ──                   │  ← ADMIN ONLY section
│  👥  User Management            │  ← ADMIN only
│  📧  Email Logs                 │  ← ADMIN only
│  🖥️  System Health              │  ← ADMIN only
│                                 │
│  ── RECORDS ──                  │
│  📜  Audit Logs                 │  ← REGISTRAR, ADMIN
│  ⚙️   Settings                  │  ← REGISTRAR, ADMIN
├─────────────────────────────────┤
│  Santos, Maria T.               │
│  ● System Admin  (purple badge) │
│  [Log Out]                      │
└─────────────────────────────────┘
```

### Two-Role Sidebar Comparison

| Nav Item | Route | REGISTRAR | SYSTEM_ADMIN |
|---|---|---|---|
| Dashboard | `/dashboard` | ✅ Full | ✅ Full + System Panel |
| Walk-in Admission | `/f2f-admission` | ✅ | ✅ |
| Applications | `/applications` | ✅ | ✅ |
| Students | `/students` | ✅ | ✅ |
| Teachers | `/teachers` | ✅ | ✅ |
| Sections | `/sections` | ✅ | ✅ |
| User Management | `/admin/users` | ❌ | ✅ |
| Email Logs | `/admin/email-logs` | ❌ | ✅ |
| System Health | `/admin/system` | ❌ | ✅ |
| Audit Logs | `/audit-logs` | ✅ (partial) | ✅ (full + export) |
| Settings | `/settings` | ✅ | ✅ |

### `SidebarContent.tsx` Rendering Logic

```tsx
const isAdmin     = user?.role === 'SYSTEM_ADMIN';
const isRegistrar = user?.role === 'REGISTRAR';

// Dashboard:         always shown
// Walk-in/Applications/Students/Teachers/Sections: isRegistrar || isAdmin
// User Mgmt/Email Logs/System Health: isAdmin only
// Audit Logs/Settings: isRegistrar || isAdmin
```

### Role Badge Colors (Sidebar Footer)

| Role | Sidebar Footer Badge | Color |
|---|---|---|
| `SYSTEM_ADMIN` | `● System Admin` | Purple / violet |
| `REGISTRAR` | `● Registrar` | Accent (school logo color) |

---

### Status Badge Reference (All Applicant Statuses)

| Status | Badge | Path |
|---|---|---|
| `PENDING` | ● amber | Both paths |
| `APPROVED` | ✓ green | Both paths |
| `REJECTED` | ✗ red | Both paths |
| `ENROLLED` | ✓ blue/accent | Both paths |
| `EXAM_SCHEDULED` | ⏳ amber | SCP path only |
| `EXAM_TAKEN` | 📋 blue | SCP path only |
| `PASSED` | ✅ green | SCP path only |
| `FAILED` | ❌ red | SCP path only |

### Applicant Type Badge Reference

| Type | Badge Label | Color |
|---|---|---|
| `REGULAR` | Regular | Grey outline |
| `STE` | STE | Blue outline |
| `SPA` | SPA — [art field] | Blue outline |
| `SPS` | SPS | Blue outline |
| `SPJ` | SPJ | Blue outline |
| `SPFL` | SPFL | Blue outline |
| `SPTVE` | SPTVE | Blue outline |
| `STEM_GRADE11` | STEM G11 | Purple outline |

---

*Full per-item detail for admin-only pages: System_admin_specification.md §5*