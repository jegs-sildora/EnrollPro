# Sidebar Navigation — SYSTEM_ADMIN Role
## School Admission, Enrollment & Information Management System

**Document Version:** 3.1.0
**Role:** `SYSTEM_ADMIN`
**Derived From:** PRD v3.0.0 · System Admin Specification v3.0.0 · Sidebar Navigation Spec v3.0.0
**Stack:** React 19 · React Router v7 · shadcn/ui · Tailwind CSS v4 · Lucide React Icons
**Changes in v3.1.0:**
- Teacher removed as system user — Teacher Management moved to SYSTEM group (exclusive)
- Applications split into two sub-navigation items: Admission and Enrollment

---

## Overview

The SYSTEM_ADMIN is the **highest-privilege role** in the system. It inherits every capability of the REGISTRAR and adds four exclusive items: Teacher Management, User Management, Email Logs, and System Health. The System Admin manages *who can access the system*, *the teacher directory*, and *whether the system is healthy* — not day-to-day enrollment operations (that remains the Registrar's responsibility).

The sidebar contains **12 navigation items** (including 2 subnav items under Applications) organized into 5 groups.

> **Teachers are not system users.** They have no login accounts. Teacher records are data entries managed exclusively by the System Admin for section adviser assignment and subject tracking.

---

## Key Distinctions from REGISTRAR

| Feature | REGISTRAR | SYSTEM_ADMIN |
|---|---|---|
| Walk-in Admission | ✅ | ✅ |
| Dashboard | ✅ Full | ✅ Full + System Panel |
| Applications → Admission | ✅ | ✅ |
| Applications → Enrollment | ✅ | ✅ |
| Students (SIMS) | ✅ | ✅ |
| Audit Logs | ✅ Own actions only | ✅ All users · Export CSV · User filter |
| Sections | ✅ | ✅ |
| Settings | ✅ | ✅ |
| **Teacher Management** (`/teachers`) | ❌ | ✅ **Exclusive** |
| **User Management** (`/admin/users`) | ❌ | ✅ **Exclusive** |
| **Email Logs** (`/admin/email-logs`) | ❌ | ✅ **Exclusive** |
| **System Health** (`/admin/system`) | ❌ | ✅ **Exclusive** |
| Assign SYSTEM_ADMIN role via UI | ❌ | ❌ (CLI/seed only) |
| Delete audit logs | ❌ | ❌ (no one can) |
| Delete enrollment records | ❌ | ❌ (no one can) |

---

## How a System Admin Account Is Created

The SYSTEM_ADMIN role **cannot be assigned through the UI**. The only path is via the seeder script:

```bash
# server/
pnpm prisma db seed
```

The seed creates the first admin account with a temporary password and `mustChangePassword: true`. On first login, the admin is forced to `/change-password`. The seed also creates a placeholder `SchoolSettings` record — the admin then configures the school's real name, logo, division, and region in Settings.

---

## Sidebar Anatomy

```
┌──────────────────────────────────────┐
│  [School Logo]                       │  ← settingsStore.logoUrl
│  [School Name]                       │  ← settingsStore.schoolName (never hardcoded)
│  SY 2026–2027  ● ACTIVE              │  ← settingsStore.activeYear.yearLabel
├──────────────────────────────────────┤
│                                      │
│  ── ENROLLMENT ──                    │
│  📊  Dashboard                       │  /dashboard
│  📋  Applications          [toggle]  │
│       ├─ 📝  Admission    (14)       │    /applications/admission
│       └─ ✅  Enrollment              │    /applications/enrollment
│                                      │
│  ── ADMISSION ──                     │
│  👤+  Walk-in Admission              │  /f2f-admission
│                                      │
│  ── RECORDS ──                       │
│  👥  Students                        │  /students
│  📜  Audit Logs                      │  /audit-logs
│                                      │
│  ── MANAGEMENT ──                    │
│  🏫  Sections                        │  /sections
│  ⚙️   Settings                        │  /settings
│                                      │
│  ── SYSTEM ──                        │
│  🎓  Teachers                        │  /teachers
│  🛡️   User Management                 │  /admin/users
│  📧  Email Logs                      │  /admin/email-logs
│  📡  System Health                   │  /admin/system
│                                      │
├──────────────────────────────────────┤
│  Santos, Maria T.                    │  ← user.name
│  ● System Admin                      │  ← purple / violet badge
│  [Log Out]                           │
└──────────────────────────────────────┘
```

**Sidebar header rules:**
- School logo: `settingsStore.logoUrl`. If null: `<School className="w-8 h-8 text-muted-foreground" />`
- School name: `settingsStore.schoolName`. Never a string literal. Shows `<Skeleton>` while loading.
- Active year: `settingsStore.activeYear.yearLabel` + green `● ACTIVE` badge. Shows `"No Active Year"` + amber warning icon if none set.
- Role badge color: **purple / violet** for `SYSTEM_ADMIN`

**Active nav item styling:**
```css
border-l-2 border-[hsl(var(--accent))]
bg-[hsl(var(--accent-muted))]
text-[hsl(var(--accent))]
font-medium
```

**Active subnav item styling (indented under Applications):**
```css
border-l-2 border-[hsl(var(--accent))]
bg-[hsl(var(--accent-muted))]
text-[hsl(var(--accent))]
text-sm font-medium
pl-8
```

**Inactive nav item styling:**
```css
text-muted-foreground
hover:bg-muted hover:text-foreground
```

---

## Navigation Items 1–8 (Shared with REGISTRAR)

Items 1 through 8 are shared between REGISTRAR and SYSTEM_ADMIN. The sections below note only where the System Admin's view **differs** from the Registrar's. Full detail for identical behavior is in `Sidebar_REGISTRAR.md`.

---

### Item 1 — Walk-in Admission (`/f2f-admission`)

Identical to REGISTRAR. Admin can enter F2F walk-in applications.
`admissionChannel: F2F` · `encodedById: req.user.userId`

---

### Item 2 — Dashboard (`/dashboard`) — Admin Additions

```
Icon  : LayoutDashboard
Route : /dashboard
Auth  : JWT required — REGISTRAR, SYSTEM_ADMIN
API   : GET /api/dashboard/stats
```

The System Admin sees everything the Registrar sees, **plus a System Panel** at the bottom of the page:

```
SYSTEM PANEL

  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │  Total Users     │  │  Emails Sent     │  │  Login Tokens    │
  │  2               │  │  312 (last 30d)  │  │  3 pending       │
  │  2 Registrars    │  │  3 Failed        │  │  (unexpired)     │
  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

> Teachers are not system users — they are not counted in the Total Users panel.

---

### Item 3 — Applications (Subnav Parent)

```
Icon  : ClipboardList  (parent — not a clickable link itself)
Label : Applications
```

Applications is a **parent nav item** with two clickable sub-items. Clicking the parent label toggles the subnav open or closed. The parent itself is not a route — only the children are navigable.

The subnav is **expanded by default** and auto-expands if any child route is active. In icon-only sidebar mode, hovering the Applications icon shows a popover with both sub-items.

---

#### Subnav A — Admission (`/applications/admission`)

```
Icon  : FileText
Label : Admission
Route : /applications/admission
Auth  : JWT required — REGISTRAR, SYSTEM_ADMIN
Page  : client/src/pages/applications/Admission.tsx
API   : GET /api/applications?status=PENDING,EXAM_SCHEDULED,EXAM_TAKEN,PASSED,FAILED
        GET /api/applications/:id
        POST /api/applications/f2f
        PATCH /api/applications/:id/approve
        PATCH /api/applications/:id/reject
        PATCH /api/applications/:id/schedule-exam
        PATCH /api/applications/:id/record-result
        PATCH /api/applications/:id/pass
        PATCH /api/applications/:id/fail
```

**Purpose:** The active processing queue. All applicants currently in the eligibility-checking and decision stage — being verified, examined (SCP), or awaiting approval.

This corresponds to **Phase 1 — Early Registration** work: the registrar is acting on each application, verifying documents, making pass/fail decisions, and assigning sections.

**Statuses shown:**

| Status | Meaning | Actions Available |
|---|---|---|
| `PENDING` | Submitted — awaiting review | Approve & Assign Section · Reject · (SCP) Verify & Schedule Exam |
| `EXAM_SCHEDULED` | SCP exam date set | Record Assessment Result |
| `EXAM_TAKEN` | SCP result received | Mark as Passed · Mark as Failed |
| `PASSED` | SCP passed — section not yet assigned | Assign Section |
| `FAILED` | SCP failed | Offer Regular Section · Reject |

**What the admin sees:**

```
ADMISSION APPLICANTS    [ Search by LRN or name... 🔍 ]   [Filter ▾]

  Year: SY 2026–2027   Grade: All ▾   Type: All ▾   Status: All ▾   Channel: All ▾

  #   │ Learner Name       │ LRN          │ Grade   │ Type    │ Channel  │ Status      │ Actions
  ────┼────────────────────┼──────────────┼─────────┼─────────┼──────────┼─────────────┼────────
  055 │ Dela Cruz, Juan R. │ 123456789012 │ Grade 7 │ REGULAR │ Online   │ ● PENDING   │ [View]
  054 │ Santos, Maria L.   │ 876543219012 │ Grade 11│ STEM G11│ Walk-in  │ ⏳EXAM_SCHED│ [View]
  053 │ Reyes, Pedro M.    │ 112233445566 │ Grade 7 │ STE     │ Online   │ ● PENDING   │ [View]
```

**Sidebar badge:** Shows the count of `PENDING` applications as a pill on the subnav label:
```
├─ 📝  Admission    (14)
```

---

#### Subnav B — Enrollment (`/applications/enrollment`)

```
Icon  : CheckCircle
Label : Enrollment
Route : /applications/enrollment
Auth  : JWT required — REGISTRAR, SYSTEM_ADMIN
Page  : client/src/pages/applications/Enrollment.tsx
API   : GET /api/applications?status=APPROVED,ENROLLED
        GET /api/applications/:id
        PUT /api/students/:id   (for data corrections)
```

**Purpose:** The Phase 2 confirmation queue. Applicants who have been approved and assigned a section (APPROVED) or who are officially enrolled (ENROLLED). The registrar uses this view during Brigada Eskwela week to confirm Phase 2 documents and make any data corrections.

No approval or exam workflow actions exist here — those decisions have already been made in Admission.

**Statuses shown:**

| Status | Meaning | Actions Available |
|---|---|---|
| `APPROVED` | Section assigned in Phase 1 — awaiting Phase 2 doc confirmation | View · Edit record |
| `ENROLLED` | Officially enrolled and confirmed | View only · Edit record |

**What the admin sees:**

```
ENROLLED / APPROVED    [ Search by LRN or name... 🔍 ]   [Filter ▾]

  Year: SY 2026–2027   Grade: All ▾   Section: All ▾   Status: All ▾   Channel: All ▾

  LRN            │ Full Name           │ Grade   │ Section   │ Channel  │ Status     │ Actions
  ───────────────┼─────────────────────┼─────────┼───────────┼──────────┼────────────┼────────
  123456789012   │ Dela Cruz, Juan R.  │ Grade 7 │ Rizal     │ Online   │ ✓ ENROLLED │ [View]
  876543219012   │ Santos, Maria L.    │ Grade 11│ STEM-A    │ Walk-in  │ ✓ ENROLLED │ [View]
  998877665544   │ Garcia, Pedro T.    │ Grade 9 │ Luna      │ Online   │ ◎ APPROVED │ [View]
```

**Key difference from Admission view:**
- No Approve / Reject / Exam action buttons
- Section filter added (not just Grade Level) for Phase 2 section-specific management
- Channel filter remains — useful for tracking Online vs Walk-in during Phase 2

---

### Item 4 — Students / SIMS (`/students`)

Identical to REGISTRAR. Full SIMS access including all 4 profile tabs and edit capability.

---

### Item 5 — Audit Logs (`/audit-logs`) — Admin Additions

```
Icon  : ScrollText
Route : /audit-logs
Auth  : JWT required — REGISTRAR, SYSTEM_ADMIN
Page  : client/src/pages/audit/Index.tsx
API   : GET /api/audit-logs?userId=&actionType=&startDate=&endDate=&page=
```

Three differences from REGISTRAR:

**1. User filter dropdown** (not shown to REGISTRAR):
```
  Action Type: [ All ▾ ]   User: [ All ▾ ]   Date Range: [ From ] — [ To ]
                                    ↑
                            Lists all active Registrar accounts
```

**2. All users' actions visible:**
Registrar sees only their own entries. System Admin sees every action by every Registrar account and their own.

**3. Export to CSV button:**
- `AuditLog: AUDIT_LOG_EXPORTED` on every export
- CSV file downloads with all filtered entries applied

---

### Item 6 — Sections (`/sections`)

Identical to REGISTRAR.

---

### Item 7 — Settings (`/settings`)

Identical to REGISTRAR. Full access to all 4 tabs.

---

## Navigation Items 9–12 (SYSTEM_ADMIN Exclusive — SYSTEM Group)

---

### Item 9 — Teachers (`/teachers`) — SYSTEM_ADMIN EXCLUSIVE

```
Group  : SYSTEM
Icon   : GraduationCap
Label  : Teachers
Route  : /teachers
         /teachers/:id
Auth   : JWT required — SYSTEM_ADMIN only
Page   : client/src/pages/teachers/Index.tsx
         client/src/pages/teachers/Profile.tsx
API    : GET   /api/teachers
         POST  /api/teachers
         GET   /api/teachers/:id
         PUT   /api/teachers/:id
         PATCH /api/teachers/:id/deactivate
```

> **Teachers are not system users.** No login accounts. No JWT. No access to the system. A REGISTRAR JWT on any `/api/teachers` endpoint returns `403 Forbidden`.

**Purpose:** Maintain the school's teacher directory for section adviser assignment and subject tracking.

### Teacher Directory (`/teachers`)

```
TEACHERS                                            [ + Create Teacher ]

  Employee ID   │ Full Name          │ Specialization │ Subjects              │ Sections │ Actions
  ──────────────┼────────────────────┼────────────────┼───────────────────────┼──────────┼────────
  101-458-2021  │ Santos, Caridad M. │ Mathematics    │ Mathematics · Science │ 2        │ [View]
  101-789-2020  │ Reyes, Miguel A.   │ Science        │ Science · MAPEH       │ 1        │ [View]
  —             │ Flores, Luisa B.   │ English        │ English · Filipino    │ 0        │ [View]
```

No "Account Status" column. No "Provision Account" action. Teachers are data records only.

**Create Teacher** dialog: Last Name · First Name · Middle Name · Employee ID · Contact Number · Specialization · Subjects (multi-select from DepEd-defined constants list — no free-text entry).

`POST /api/teachers` → `AuditLog: TEACHER_CREATED`

### Teacher Profile (`/teachers/:id`) — 2 Tabs Only

**Tab 1 — Profile:** Full Name · Employee ID · Contact Number · Specialization · Subjects.

```
  Subjects Taught
  [ Mathematics × ]  [ Science × ]  [ + Add Subject ▾ ]
  (multi-select from DepEd-defined subject list — no custom entry)
```

`PUT /api/teachers/:id` → `AuditLog: TEACHER_UPDATED`

**Tab 2 — Assigned Sections:** Read-only list of sections this teacher advises in the active AY. [Unassign] removes the adviser from a section.

**No Tab 3 (System Account)** — teachers have no system accounts.

**Deactivating a Teacher:** `PATCH /api/teachers/:id/deactivate` sets `isActive = false`. The teacher disappears from the section adviser dropdown. Existing section assignments are preserved.

---

### Item 10 — User Management (`/admin/users`) — SYSTEM_ADMIN EXCLUSIVE

```
Group  : SYSTEM
Icon   : Shield
Label  : User Management
Route  : /admin/users
Auth   : JWT required — SYSTEM_ADMIN only
Page   : client/src/pages/admin/UserManagement.tsx
API    : GET   /api/admin/users
         POST  /api/admin/users
         PUT   /api/admin/users/:id
         PATCH /api/admin/users/:id/deactivate
         PATCH /api/admin/users/:id/reactivate
         PATCH /api/admin/users/:id/reset-password
```

**Purpose:** Manage who can log into the system. Only **REGISTRAR** accounts are created here. Teachers are not system users — they are managed at `/teachers`.

### User Management List

```
USER MANAGEMENT                                    [ + Create User ]

  Name               Email                    Role        Status     Last Login     Actions
  ─────────────────────────────────────────────────────────────────────────────────────────
  Cruz, Regina       rcruz@school.edu.ph      Registrar   ● Active   Feb 3, 2026    [Edit] [Deactivate]
  Santos, Pablo      psantos@school.edu.ph    Registrar   ● Active   Jan 28, 2026   [Edit] [Deactivate]
  Mora, Liza         lmora@school.edu.ph      Registrar   ○ Inactive —              [Edit] [Reactivate]
```

### Create User

```
┌───────────────────────────────────────────────────────────────┐
│  Create User Account                                           │
│  Full Name *     [ __________________________ ]               │
│  Email Address * [ __________________________ ]               │
│  Role *          ●  Registrar                                  │
│  (SYSTEM_ADMIN — CLI/seed only)                               │
│  (Teachers are not system users — manage via /teachers)       │
│                                                               │
│          [ Cancel ]         [ Create Account ]               │
└───────────────────────────────────────────────────────────────┘
```

- `POST /api/admin/users` with `{ name, email, role: 'REGISTRAR' }`
- Server rejects `role === 'SYSTEM_ADMIN'` with `403`
- Temporary password auto-generated · `mustChangePassword: true`
- Welcome email sent using `SchoolSettings.schoolName`
- `AuditLog: ADMIN_USER_CREATED`

### Edit / Deactivate / Reactivate / Reset Password

| Action | API | Audit Log |
|---|---|---|
| Edit name/email | `PUT /api/admin/users/:id` | — |
| Deactivate | `PATCH .../deactivate` → `isActive = false` | `ADMIN_USER_DEACTIVATED` |
| Reactivate | `PATCH .../reactivate` → `isActive = true` | `ADMIN_USER_REACTIVATED` |
| Reset password | `PATCH .../reset-password` → new temp password + email | `ADMIN_PASSWORD_RESET` |

---

### Item 11 — Email Logs (`/admin/email-logs`) — SYSTEM_ADMIN EXCLUSIVE

```
Group  : SYSTEM
Icon   : Mail
Label  : Email Logs
Route  : /admin/email-logs
Auth   : JWT required — SYSTEM_ADMIN only
Page   : client/src/pages/admin/EmailLogs.tsx
API    : GET  /api/admin/email-logs
         POST /api/admin/email-logs/:id/retry
```

**Purpose:** Read-only log of every email the system attempted to send. All emails dispatch asynchronously via `setImmediate()` — failed emails do not surface as errors anywhere else. This is the only place failed emails are visible.

```
EMAIL LOGS                                               [Filter ▾]

  Status: [ All ▾ ]   Date: [ From ] — [ To ]   Type: [ All ▾ ]

  Recipient             Subject                                    Status   Sent At
  ───────────────────────────────────────────────────────────────────────────────────
  delacruz@gmail.com    Your Application Received — #055 · [School]  ● Sent   Feb 3, 9:14
  msantos@gmail.com     Your Enrollment is Confirmed — [School]    ● Sent   Feb 3, 8:55
  preyes@gmail.com      Your STE Entrance Exam — [School]          ✗ Failed  Feb 2, 3:00
  rcruz@school.edu.ph   Welcome to [School] — Your Account Details ● Sent   Jan 15, 10:00
```

**[Retry]** on failed entries: `POST /api/admin/email-logs/:id/retry` → `AuditLog: EMAIL_RETRY_TRIGGERED`

> All email subjects use `SchoolSettings.schoolName` at send time — never a hardcoded school name.

---

### Item 12 — System Health (`/admin/system`) — SYSTEM_ADMIN EXCLUSIVE

```
Group  : SYSTEM
Icon   : Activity
Label  : System Health
Route  : /admin/system
Auth   : JWT required — SYSTEM_ADMIN only
Page   : client/src/pages/admin/SystemHealth.tsx
API    : GET /api/admin/system
```

Read-only diagnostic dashboard. No actions — purely informational.

```
SYSTEM HEALTH                             Last checked: just now    [ Refresh ]

  ┌──────────────────────────────────────────────────────────────────┐
  │  DATABASE              ● Connected        Response time: 12ms    │
  ├──────────────────────────────────────────────────────────────────┤
  │  SERVER UPTIME         14d 3h 22m                                │
  ├──────────────────────────────────────────────────────────────────┤
  │  LOGIN TOKENS          3 pending (unexpired, unused)             │
  │  Last cleanup          1 hour ago  (tokens > 24h purged hourly)  │
  ├──────────────────────────────────────────────────────────────────┤
  │  EMAIL SERVICE         ● Connected        Failed today: 0        │
  └──────────────────────────────────────────────────────────────────┘
```

The **Login Tokens panel** exposes Layer 2 health. An unusually large count means the cleanup cron is not running.

---

## Complete Route Table for SYSTEM_ADMIN

### Shared with REGISTRAR

| Route | Page Component | Admin Notes |
|---|---|---|
| `/dashboard` | `Dashboard.tsx` | + System Panel at bottom |
| `/f2f-admission` | `F2FAdmission.tsx` | Identical |
| `/applications/admission` | `Admission.tsx` | PENDING · EXAM_* · PASSED · FAILED statuses |
| `/applications/admission/:id` | `ApplicationDetail.tsx` | Identical |
| `/applications/enrollment` | `Enrollment.tsx` | APPROVED · ENROLLED statuses |
| `/applications/enrollment/:id` | `EnrollmentDetail.tsx` | Identical |
| `/students` | `Students.tsx` | Identical |
| `/students/:id` | `StudentProfile.tsx` | Identical |
| `/sections` | `Sections.tsx` | Identical |
| `/audit-logs` | `AuditLogs.tsx` | + All users · + User filter · + Export CSV |
| `/settings` | `Settings.tsx` | Identical |
| `/change-password` | `ChangePassword.tsx` | Identical |

### Exclusive to SYSTEM_ADMIN

| Route | Page Component | API Endpoints |
|---|---|---|
| `/teachers` | `Teachers.tsx` | `GET/POST /api/teachers` |
| `/teachers/:id` | `TeacherProfile.tsx` | `GET/PUT/PATCH /api/teachers/:id` |
| `/admin/users` | `UserManagement.tsx` | `GET/POST/PUT/PATCH /api/admin/users/*` |
| `/admin/email-logs` | `EmailLogs.tsx` | `GET /api/admin/email-logs` · `POST /api/admin/email-logs/:id/retry` |
| `/admin/system` | `SystemHealth.tsx` | `GET /api/admin/system` |

---

## Security Enforced at API Level

- `/login` requires `{ state: { loginAccess: true } }` — direct URL visits bounce to `/`
- `POST /api/auth/login` requires a valid `loginToken` from `GET /api/auth/login-token`
- Rate limiting: 20 req/min on both auth endpoints
- `POST /api/admin/users` with `role: 'SYSTEM_ADMIN'` → `403 Forbidden`
- `GET/POST/PUT/PATCH /api/teachers/*` with REGISTRAR JWT → `403 Forbidden`
- Audit logs: no delete endpoint — entries are permanent
- Enrollment records: no delete endpoint — records are permanent
- Admin's own actions are logged in `AuditLog` identically to any other user

---

## SidebarContent.tsx — Rendering Logic for SYSTEM_ADMIN

```tsx
// client/src/components/layout/SidebarContent.tsx
const { user }    = useAuthStore();
const isAdmin     = user?.role === 'SYSTEM_ADMIN';
const isRegistrar = user?.role === 'REGISTRAR';

// Shared — REGISTRAR + SYSTEM_ADMIN
{(isRegistrar || isAdmin) && (
  <>
    <SidebarSection label="Admission">
      <NavItem href="/f2f-admission" icon={UserPlus} label="Walk-in Admission" />
    </SidebarSection>

    <SidebarSection label="Enrollment">
      <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />

      {/* Applications — collapsible parent, not itself a route */}
      <NavItemParent icon={ClipboardList} label="Applications">
        <NavItemChild
          href="/applications/admission"
          icon={FileText}
          label="Admission"
          badgeCount={pendingCount}   // from dashboardStatsStore
        />
        <NavItemChild
          href="/applications/enrollment"
          icon={CheckCircle}
          label="Enrollment"
        />
      </NavItemParent>
    </SidebarSection>

    <SidebarSection label="Records">
      <NavItem href="/students"   icon={Users}      label="Students" />
      <NavItem href="/audit-logs" icon={ScrollText} label="Audit Logs" />
    </SidebarSection>

    <SidebarSection label="Management">
      <NavItem href="/sections" icon={School}    label="Sections" />
      <NavItem href="/settings" icon={Settings}  label="Settings" />
    </SidebarSection>
  </>
)}

// SYSTEM_ADMIN exclusive
{isAdmin && (
  <SidebarSection label="System">
    <NavItem href="/teachers"         icon={GraduationCap} label="Teachers" />
    <NavItem href="/admin/users"      icon={Shield}        label="User Management" />
    <NavItem href="/admin/email-logs" icon={Mail}          label="Email Logs" />
    <NavItem href="/admin/system"     icon={Activity}      label="System Health" />
  </SidebarSection>
)}
```

**`NavItemParent` component behavior:**
- Renders a non-link toggle that shows/hides its children
- Auto-expands when any child route is currently active
- Defaults to expanded
- In icon-only sidebar mode: hovering shows a popover with sub-items

**`pendingCount`:** Sourced from `dashboardStatsStore.admissionPending` — count of `PENDING` status applications for the active AY. Updates on dashboard load.

---

## Role Badge Reference

| Role | Badge Text | Color |
|---|---|---|
| `SYSTEM_ADMIN` | System Admin | Purple / violet |
| `REGISTRAR` | Registrar | Accent (school logo color via `var(--accent)`) |

---

## Log Out Behavior

1. `authStore.clearAuth()` → `{ token: null, user: null }`
2. `localStorage['auth-storage']` cleared
3. Navigate to `/` → redirects to `/apply` or `/closed` based on `enrollmentOpen`
4. "Staff Login" link in the public portal footer is the re-entry point to `/login`

---

*Document v3.1.0 — SYSTEM_ADMIN Role Sidebar*
*System: School Admission, Enrollment & Information Management System*
*Derived from: PRD v3.0.0 · System Admin Specification v3.0.0*
*Changes in v3.1.0: Teacher removed as system user · Applications split into Admission + Enrollment subnav*