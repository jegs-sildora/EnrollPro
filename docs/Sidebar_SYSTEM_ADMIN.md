# Sidebar Navigation — SYSTEM_ADMIN Role
## School Admission, Enrollment & Information Management System

**Document Version:** 3.0.0
**Role:** `SYSTEM_ADMIN`
**Derived From:** PRD v3.0.0 · System Admin Specification v3.0.0 · Sidebar Navigation Spec v3.0.0
**Stack:** React 19 · React Router v7 · shadcn/ui · Tailwind CSS v4 · Lucide React Icons

---

## Overview

The SYSTEM_ADMIN is the **highest-privilege role** in the system. It inherits every capability of the REGISTRAR and adds three exclusive items: User Management, Email Logs, and System Health. The System Admin manages *who can access the system* and *whether the system is healthy* — not day-to-day enrollment operations (that remains the Registrar's responsibility).

The sidebar contains **11 navigation items** organized into 5 groups.

---

## Key Distinctions from REGISTRAR

| Feature | REGISTRAR | SYSTEM_ADMIN |
|---|---|---|
| All 8 Registrar nav items | ✅ | ✅ (identical access) |
| User Management (`/admin/users`) | ❌ | ✅ |
| Email Logs (`/admin/email-logs`) | ❌ | ✅ |
| System Health (`/admin/system`) | ❌ | ✅ |
| Dashboard System Panel | ❌ | ✅ |
| Audit Logs — all users visible | ❌ (own actions only) | ✅ (full cross-user) |
| Audit Logs — export to CSV | ❌ | ✅ |
| Audit Logs — user filter dropdown | ❌ | ✅ |
| Teacher Profile — Deactivate Account | ❌ | ✅ |
| Teacher Profile — Reset Password | ❌ | ✅ |
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
│  ── SYSTEM ──                        │
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
- Role badge color: **purple / violet** for `SYSTEM_ADMIN` (distinct from Registrar's accent color and Teacher's blue)

**Active nav item styling:**
```css
border-l-2 border-[hsl(var(--accent))]
bg-[hsl(var(--accent-muted))]
text-[hsl(var(--accent))]
font-medium
```

**Inactive nav item styling:**
```css
text-muted-foreground
hover:bg-muted hover:text-foreground
```

---

## Navigation Items 1–8 (Inherited from REGISTRAR)

Items 1 through 8 are **identical in content and behavior** to the REGISTRAR sidebar. Full detail for each is in `Sidebar_REGISTRAR.md`. The sections below note only where the System Admin's view **differs** from the Registrar's.

### Item 1 — Walk-in Admission (`/f2f-admission`)
Identical to REGISTRAR. Admin can enter F2F walk-in applications. `admissionChannel: F2F` · `encodedById: req.user.userId`.

### Item 2 — Dashboard (`/dashboard`) — Admin Additions

The System Admin sees everything the Registrar sees, **plus a System Panel** at the bottom of the page:

```
SYSTEM PANEL

  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │  Total Users     │  │  Emails Sent     │  │  Login Tokens    │
  │  4               │  │  312 (last 30d)  │  │  3 pending       │
  │  2 Registrars    │  │  3 Failed        │  │  (unexpired)     │
  │  2 Teachers      │  │                  │  │                  │
  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

This panel is never visible to REGISTRAR or TEACHER.

### Item 3 — Applications (`/applications`)
Identical to REGISTRAR. Full enrollment workflow access.

### Item 4 — Students / SIMS (`/students`)
Identical to REGISTRAR. Full SIMS access including all 4 profile tabs and edit capability.

### Item 5 — Audit Logs (`/audit-logs`) — Admin Additions

The System Admin's audit log view is the **full cross-user view**. Three differences from REGISTRAR:

**1. User filter dropdown** (not shown to REGISTRAR):
```
  Action Type: [ All ▾ ]   User: [ All ▾ ]   Date Range: [ From ] — [ To ]
                                    ↑
                            Dropdown lists all active system accounts
                            Used to filter by a specific registrar or teacher
```

**2. All users' actions visible:**
The Registrar sees only their own entries. The System Admin sees every action taken by every user — all Registrars, all Teachers, and their own actions.

**3. Export to CSV:**
An **[Export CSV]** button appears in the top-right of the audit log page for SYSTEM_ADMIN only. The export applies the current filters. Exporting triggers:
- `AuditLog: AUDIT_LOG_EXPORTED — "Admin [name] exported audit log (filters: [params])"`
- A CSV file download with all filtered entries

**API:** `GET /api/audit-logs?userId=&actionType=&startDate=&endDate=&page=`
The `userId` filter parameter is only accepted from SYSTEM_ADMIN JWTs; ignored for REGISTRAR.

### Item 6 — Teachers (`/teachers`) — Admin Additions

Identical to REGISTRAR **plus** two additional controls on **Tab 3 — System Account** of each teacher profile:

**[Deactivate Account]:**
- Available for any teacher with an active system account
- Sets `User.isActive = false`
- Teacher's very next API call returns 401 — effectively logged out immediately
- `PATCH /api/teachers/:id/deactivate`
- `AuditLog: ADMIN_USER_DEACTIVATED`

**[Reset Password]:**
- Available for any teacher with an active system account
- Generates a new temporary password
- Sets `mustChangePassword: true`
- Sends a password reset email using `SchoolSettings.schoolName`
- `PATCH /api/admin/users/:id/reset-password`
- `AuditLog: ADMIN_PASSWORD_RESET`

> Neither of these buttons is visible to REGISTRAR on the teacher profile.

### Item 7 — Sections (`/sections`)
Identical to REGISTRAR.

### Item 8 — Settings (`/settings`)
Identical to REGISTRAR. Full access to all 4 tabs.

---

## Navigation Item 9 — User Management (SYSTEM_ADMIN EXCLUSIVE)

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

### Purpose

The primary tool for managing who can log into the system. The System Admin creates, edits, deactivates, and reactivates REGISTRAR and TEACHER accounts. The SYSTEM_ADMIN role itself cannot be assigned through this interface.

### User Management List

```
USER MANAGEMENT                                    [ + Create User ]

  Name               Email                    Role        Status     Last Login     Actions
  ───────────────────────────────────────────────────────────────────────────────────────────
  Cruz, Regina       rcruz@school.edu.ph      Registrar   ● Active   Feb 3, 2026    [Edit] [Deactivate]
  Santos, Pablo      psantos@school.edu.ph    Registrar   ● Active   Jan 28, 2026   [Edit] [Deactivate]
  Reyes, Ana         areyes@school.edu.ph     Teacher     ● Active   Feb 1, 2026    [Edit] [Deactivate]
  Dela Cruz, Jose    jdelacruz@school.edu.ph  Teacher     ○ Inactive —              [Edit] [Reactivate]
```

- Shows all REGISTRAR and TEACHER accounts (not the SYSTEM_ADMIN's own account)
- Last login timestamp from `User.lastLoginAt`
- Status badge: ● Active (green) · ○ Inactive (grey)

### Create User

```
┌───────────────────────────────────────────────────────────────┐
│  Create User Account                                           │
│  ─────────────────────────────────────────────────────────── │
│  Full Name *                                                   │
│  [ ______________________________ ]                            │
│                                                               │
│  Email Address *                                              │
│  [ ______________________________ ]                            │
│                                                               │
│  Role *                                                        │
│  ●  Registrar     ○  Teacher                                  │
│  (SYSTEM_ADMIN cannot be selected — only via CLI seed)        │
│                                                               │
│  A temporary password will be auto-generated and emailed.     │
│  The user must change it on first login.                      │
│                                                               │
│          [ Cancel ]         [ Create Account ]               │
└───────────────────────────────────────────────────────────────┘
```

On confirm:
- `POST /api/admin/users` with `{ name, email, role: 'REGISTRAR' | 'TEACHER' }`
- Server rejects `role === 'SYSTEM_ADMIN'` with `403 Forbidden`
- Temporary password auto-generated (`crypto.randomBytes`, 12+ chars, mixed case + digits)
- Welcome email sent using `SchoolSettings.schoolName` in the subject
- `mustChangePassword: true`
- `AuditLog: ADMIN_USER_CREATED`

### Edit User

Changes name, email, or role (between REGISTRAR ↔ TEACHER only). Cannot promote to or demote from SYSTEM_ADMIN.
`PUT /api/admin/users/:id`

### Deactivate / Reactivate

**Deactivate:**
- Sets `User.isActive = false`
- User's very next API call returns 401 → Axios interceptor → clears auth → redirects to login
- Effective within one API request — no logout forced immediately
- `PATCH /api/admin/users/:id/deactivate` → `AuditLog: ADMIN_USER_DEACTIVATED`

**Reactivate:**
- Sets `User.isActive = true`
- User can log in again immediately
- `PATCH /api/admin/users/:id/reactivate` → `AuditLog: ADMIN_USER_REACTIVATED`

### Reset Password

- Generates new temporary password
- Sets `mustChangePassword: true`
- Sends email using `SchoolSettings.schoolName`
- `PATCH /api/admin/users/:id/reset-password` → `AuditLog: ADMIN_PASSWORD_RESET`

---

## Navigation Item 10 — Email Logs (SYSTEM_ADMIN EXCLUSIVE)

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

### Purpose

A read-only log of every email the system has attempted to send, with delivery status. Allows the admin to identify failed emails and retry them.

### Email Log List

```
EMAIL LOGS                                               [Filter ▾]

  Status: [ All ▾ ]   Date: [ From ] — [ To ]   Type: [ All ▾ ]

  Recipient             Subject                                   Status   Sent At
  ──────────────────────────────────────────────────────────────────────────────────
  delacruz@gmail.com    Your Application Received — #055 · [School]  ● Sent   Feb 3, 9:14
  msantos@gmail.com     Enrollment Confirmed — [School], SY 2026-2027  ● Sent   Feb 3, 8:55
  preyes@gmail.com      Your STE Entrance Exam — [School]           ✗ Failed  Feb 2, 3:00
  csantos@school.edu.ph Welcome to [School] — Your System Account   ● Sent   Jan 15, 10:00
```

**Columns:** Recipient email · Subject (truncated) · Status (Sent/Failed) · Sent At timestamp · Trigger action type · [Retry] button (failed only)

**Filterable by:** status (Sent / Failed) · date range · email trigger type (application submitted, exam scheduled, account provisioned, etc.)

**[Retry] button** on failed emails:
- Triggers re-send of the exact same email template
- `POST /api/admin/email-logs/:id/retry`
- `AuditLog: EMAIL_RETRY_TRIGGERED`

> **Note:** Email subjects always contain `SchoolSettings.schoolName` substituted at send time. The log entry shows the actual sent subject, including the real school name.

### Why This Matters

All system emails are dispatched **asynchronously** via `setImmediate()` — the HTTP response returns before the email is sent. This means failed emails do not block the API. The Email Logs page is the only place the admin can see which emails silently failed and manually retry them.

---

## Navigation Item 11 — System Health (SYSTEM_ADMIN EXCLUSIVE)

```
Group  : SYSTEM
Icon   : Activity
Label  : System Health
Route  : /admin/system
Auth   : JWT required — SYSTEM_ADMIN only
Page   : client/src/pages/admin/SystemHealth.tsx
API    : GET /api/admin/system
```

### Purpose

A read-only diagnostic dashboard showing the system's operational status. No actions are available — this page is purely informational.

### What the Admin Sees

```
SYSTEM HEALTH                             Last checked: just now    [ Refresh ]

  ┌──────────────────────────────────────────────────────────────────┐
  │  DATABASE              ● Connected                               │
  │  Response time         12ms                                      │
  ├──────────────────────────────────────────────────────────────────┤
  │  SERVER UPTIME         14d 3h 22m                                │
  ├──────────────────────────────────────────────────────────────────┤
  │  LOGIN TOKENS          3 pending (unexpired, unused)             │
  │  Last cleanup          1 hour ago                                │
  │  (Tokens older than 24h are purged hourly)                       │
  ├──────────────────────────────────────────────────────────────────┤
  │  EMAIL SERVICE         ● Connected (Resend SMTP)                 │
  │  Emails sent today     4    Failed today    0                    │
  └──────────────────────────────────────────────────────────────────┘
```

**Panels:**

| Panel | Data Shown |
|---|---|
| Database | Connection status · Query response time |
| Server Uptime | Time since last restart |
| Login Tokens | Count of unexpired unused `LoginToken` records (Layer 2) · Last cleanup timestamp |
| Email Service | SMTP connectivity status · Today's sent/failed email counts |

**[Refresh]** button re-fetches `GET /api/admin/system` to update the status.

**Login Tokens panel** directly exposes the health of the Layer 2 security mechanism. If the token count grows unusually large, it may indicate the cleanup cron task is not running.

---

## Complete Route Table for SYSTEM_ADMIN

### Inherited from REGISTRAR

| Route | Page Component | Notes |
|---|---|---|
| `/dashboard` | `Dashboard.tsx` | + System Panel at bottom |
| `/f2f-admission` | `F2FAdmission.tsx` | Identical |
| `/applications` | `Applications.tsx` | Identical |
| `/applications/:id` | `ApplicationDetail.tsx` | Identical |
| `/students` | `Students.tsx` | Identical |
| `/students/:id` | `StudentProfile.tsx` | Identical |
| `/teachers` | `Teachers.tsx` | Identical |
| `/teachers/:id` | `TeacherProfile.tsx` | + Deactivate + Reset Password on Tab 3 |
| `/sections` | `Sections.tsx` | Identical |
| `/audit-logs` | `AuditLogs.tsx` | + All users · + User filter · + Export CSV |
| `/settings` | `Settings.tsx` | Identical |
| `/change-password` | `ChangePassword.tsx` | Identical |

### Exclusive to SYSTEM_ADMIN

| Route | Page Component | API Endpoints |
|---|---|---|
| `/admin/users` | `UserManagement.tsx` | `GET/POST/PUT/PATCH /api/admin/users/*` |
| `/admin/email-logs` | `EmailLogs.tsx` | `GET /api/admin/email-logs` · `POST /api/admin/email-logs/:id/retry` |
| `/admin/system` | `SystemHealth.tsx` | `GET /api/admin/system` |

---

## Security Enforced at API Level

Layer 1 and Layer 2 apply to the System Admin **equally**:
- The `/login` route requires `{ state: { loginAccess: true } }` navigation state — the admin cannot bypass this by typing `/login` directly
- `POST /api/auth/login` requires a valid `loginToken` from `GET /api/auth/login-token` — the admin cannot bypass this with Postman or curl without a valid token
- Rate limiting: 20 req/min on both auth endpoints

Additional constraints that apply specifically to the SYSTEM_ADMIN:
- `POST /api/admin/users` with `role: 'SYSTEM_ADMIN'` → `403 Forbidden` — the admin cannot escalate another account to SYSTEM_ADMIN
- Audit logs cannot be deleted — `AuditLog` has no delete endpoint in the entire API
- Enrollment records cannot be deleted — `Enrollment` and `Applicant` have no delete endpoint
- The admin's own actions are logged in `AuditLog` just like any other user's

---

## SidebarContent.tsx — Rendering Logic for SYSTEM_ADMIN

```tsx
const isAdmin     = user?.role === 'SYSTEM_ADMIN';
const isRegistrar = user?.role === 'REGISTRAR';

// Items 1–8: shared between REGISTRAR and SYSTEM_ADMIN
{(isRegistrar || isAdmin) && (
  <>
    <SidebarSection label="Admission">
      <NavItem href="/f2f-admission"      icon={UserPlus}        label="Walk-in Admission" />
    </SidebarSection>

    <SidebarSection label="Enrollment">
      <NavItem href="/dashboard"          icon={LayoutDashboard} label="Dashboard" />
      <NavItem href="/applications"       icon={ClipboardList}   label="Applications" />
    </SidebarSection>

    <SidebarSection label="Records">
      <NavItem href="/students"           icon={Users}           label="Students" />
      <NavItem href="/audit-logs"         icon={ScrollText}      label="Audit Logs" />
    </SidebarSection>

    <SidebarSection label="Management">
      <NavItem href="/teachers"           icon={GraduationCap}   label="Teachers" />
      <NavItem href="/sections"           icon={School}          label="Sections" />
      <NavItem href="/settings"           icon={Settings}        label="Settings" />
    </SidebarSection>
  </>
)}

// Items 9–11: SYSTEM_ADMIN only
{isAdmin && (
  <SidebarSection label="System">
    <NavItem href="/admin/users"          icon={Shield}          label="User Management" />
    <NavItem href="/admin/email-logs"     icon={Mail}            label="Email Logs" />
    <NavItem href="/admin/system"         icon={Activity}        label="System Health" />
  </SidebarSection>
)}
```

---

## Role Badge Reference (All Three Roles)

| Role | Badge Text | Color |
|---|---|---|
| `SYSTEM_ADMIN` | System Admin | Purple / violet |
| `REGISTRAR` | Registrar | Accent (extracted from school logo, via `var(--accent)`) |
| `TEACHER` | Teacher | Blue |

---

## Log Out Behavior

Same as all roles:
1. `authStore.clearAuth()` → `{ token: null, user: null }`
2. `localStorage['auth-storage']` cleared
3. Navigate to `/` → redirects to `/apply` or `/closed`
4. "Staff Login" link in the public portal footer is the re-entry point to `/login`

---

*Document v3.0.0 — SYSTEM_ADMIN Role Sidebar*
*System: School Admission, Enrollment & Information Management System*
*Derived from: PRD v3.0.0 §4 · §6 · §7 · §8 · System Admin Specification v3.0.0*
