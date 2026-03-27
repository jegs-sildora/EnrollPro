# System Administrator Role Specification
## Web-Based School Admission, Enrollment & Information Management System

**Document Type:** Full Role Specification — System Admin
**Derives From:** PRD v3.0.0 · Sidebar Navigation Spec · Registrar Storyboard
**Policy Basis:** DepEd Order No. 017, s. 2025 · DM 012, s. 2026 · RA 10173 (Data Privacy Act)
**Stack:** PERN (PostgreSQL · Express · React · Node.js) · Prisma 6 · JWT · shadcn/ui

---

## Table of Contents

1. [Role Definition & Design Philosophy](#1-role-definition--design-philosophy)
2. [Role Hierarchy — All Three Roles](#2-role-hierarchy--all-three-roles)
3. [Database Schema Changes](#3-database-schema-changes)
4. [System Admin Sidebar Navigation — Full Reference](#4-system-admin-sidebar-navigation--full-reference)
5. [Per-Item Detail](#5-per-item-detail)
   - 5.1 [Dashboard (Admin View)](#51-dashboard-admin-view----dashboard)
   - 5.2 [Applications](#52-applications----applications)
   - 5.3 [Students](#53-students----students)
   - 5.4 [Sections](#54-sections----sections)
   - 5.5 [Audit Logs (Full Cross-User)](#55-audit-logs-full-cross-user----audit-logs)
   - 5.6 [Settings](#56-settings----settings)
   - 5.7 [User Management](#57-user-management----admin-users)
   - 5.8 [Email Logs](#58-email-logs----admin-email-logs)
   - 5.9 [System Health](#59-system-health----admin-system)
6. [Complete Role Access Matrix](#6-complete-role-access-matrix)
7. [New API Endpoints](#7-new-api-endpoints)
8. [New Audit Log Action Types](#8-new-audit-log-action-types)
9. [Frontend Routing Changes](#9-frontend-routing-changes)
10. [Sidebar Component Changes](#10-sidebar-component-changes)
11. [Security Considerations](#11-security-considerations)
12. [New Acceptance Criteria](#12-new-acceptance-criteria)
13. [First-Time Setup — How the First Admin Account is Created](#13-first-time-setup--how-the-first-admin-account-is-created)

---

## 1. Role Definition & Design Philosophy

### Who is the System Administrator?

The System Administrator is the **technical owner** of the deployed school system. In a single-school public high school context like the school, this is typically one of the following:

- The school's designated IT coordinator
- A DepEd ICT advocate teacher assigned to manage school systems
- The school's principal or registrar who also holds technical responsibility
- A contracted IT person who set up the system

The System Admin is **not** involved in day-to-day enrollment operations — that is the Registrar's job. The Admin's purpose is to manage the *people and infrastructure* that make the system run.

### Core Design Principles for the Admin Role

**1 — Superuser, but scoped.** The Admin can do everything the Registrar can do, plus manage user accounts, monitor system health, and view email delivery logs. However, the Admin does **not** bypass data privacy rules, cannot delete audit logs, and cannot delete applicant or enrollment records.

**2 — Separation of concerns.** The Admin manages *who can access the system* and *whether the system is healthy*. The Registrar manages *enrollment operations*. These are deliberately separate so that a teacher or external IT person managing accounts does not inadvertently interfere with enrollment workflows.

**3 — Audit everything the Admin does.** Every Admin action — creating a user, resetting a password, deactivating an account — is captured in the audit log. Admin actions use a distinct set of `actionType` values prefixed with `ADMIN_` so they are immediately identifiable.

**4 — The Admin cannot promote themselves or another Admin.** To prevent privilege escalation, the `ADMIN` role cannot be assigned through the UI. The only way to create or assign the ADMIN role is through a seeder script or direct database access (or the CLI seed command defined in §13). This is enforced at the API level.

---

## 2. Role Hierarchy — All Three Roles

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         ROLE HIERARCHY                                   │
│                                                                          │
│   SYSTEM_ADMIN  ──── highest privilege ─────────────────────────────┐   │
│       │                                                             │   │
│       │  Inherits all REGISTRAR capabilities                        │   │
│       │  + User Management                                          │   │
│       │  + Email Logs                                               │   │
│       │  + System Health                                            │   │
│       │  + Full cross-user Audit Log access                         │   │
│       │                                                             │   │
│   REGISTRAR  ──── operational privilege ─────────────────────────┐  │   │
│       │                                                          │  │   │
│       │  Applications · Students · Sections                      │  │   │
│       │  Settings · Audit Logs (own + system)                    │  │   │
│       │  Dashboard (full)                                         │  │   │
│       │                                                          │  │   │
└──────────────────────────────────────────────────────────────────┴──┴───┘
```

**Updated Role Comparison Table:**

| Capability | REGISTRAR | SYSTEM_ADMIN |
|---|---|---|
| View sections + class lists | ✅ | ✅ |
| View all applications | ✅ | ✅ |
| Approve / Reject applications | ✅ | ✅ |
| Manage SCP assessment workflow | ✅ | ✅ |
| Enter F2F walk-in applications | ✅ | ✅ |
| Manage sections (CRUD) | ✅ | ✅ |
| Search all students | ✅ | ✅ |
| Edit student records (4-tab profile) | ✅ | ✅ |
| Manage teachers (CRUD) | ✅ | ✅ |
| Manage settings (school profile, AY, strands, SCP, gate) | ✅ | ✅ |
| View audit logs | ✅ (own + system) | ✅ (all users) |
| Create / Edit / Deactivate user accounts | ❌ | ✅ |
| Reset another user's password | ❌ | ✅ |
| View email delivery logs | ❌ | ✅ |
| View system health & diagnostics | ❌ | ✅ |
| Assign the ADMIN role to a user | ❌ | ❌ (CLI/seed only) |
| Delete audit logs | ❌ | ❌ (no one can) |
| Delete enrollment records | ❌ | ❌ (no one can) |

---

## 3. Database Schema Changes

### 3.1 — Updated `Role` Enum

```prisma
// server/prisma/schema.prisma — UPDATED

enum Role {
  REGISTRAR
  TEACHER
  SYSTEM_ADMIN   // ← new
}
```

### 3.2 — Updated `User` Model

```prisma
model User {
  id                 Int       @id @default(autoincrement())
  name               String
  email              String    @unique
  password           String    // bcrypt hash, 12 rounds
  role               Role
  isActive           Boolean   @default(true)   // soft deactivation
  mustChangePassword Boolean   @default(true)   // force PW change on first login
  lastLoginAt        DateTime?                  // track last login timestamp
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  createdById        Int?                        // who created this account

  teacher    Teacher?
  sections     Section[]
  enrollments  Enrollment[]
  auditLogs    AuditLog[]
  createdBy    User?     @relation("UserCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  createdUsers User[]    @relation("UserCreatedBy")
}
```

**Fields explained:**

| Field | Type | Purpose |
|---|---|---|
| `isActive` | `Boolean` | Soft-deactivation flag. Inactive users cannot log in but their data (audit logs, enrollment records) is preserved. |
| `mustChangePassword` | `Boolean` | When `true`, user is redirected to `/change-password` after login. Set on account creation and admin password reset. |
| `lastLoginAt` | `DateTime?` | Updated on every successful login. Shown in the User Management table. Helps Admin identify dormant accounts. |
| `createdById` | `Int?` | Foreign key to the Admin who created this account. Enables accountability on who provisioned each account. |

### 3.3 — New `EmailLog` Model

```prisma
// server/prisma/schema.prisma — NEW MODEL

model EmailLog {
  id          Int      @id @default(autoincrement())
  recipient   String                        // email address
  subject     String
  trigger     EmailTrigger                  // enum: what caused the email
  status      EmailStatus @default(PENDING) // PENDING | SENT | FAILED
  applicantId Int?                          // linked applicant if applicable
  errorMessage String?                      // Nodemailer error if FAILED
  attemptedAt DateTime @default(now())
  sentAt      DateTime?                     // null if FAILED or still PENDING

  applicant   Applicant? @relation(fields: [applicantId], references: [id], onDelete: SetNull)
}

enum EmailTrigger {
  APPLICATION_SUBMITTED
  APPLICATION_APPROVED
  APPLICATION_REJECTED
}

enum EmailStatus {
  PENDING
  SENT
  FAILED
}
```

> **Instruction for Claude Code:** The existing `setImmediate()` email dispatch in `applicationController.ts` must be updated to write an `EmailLog` record. On success: set `status = 'SENT'`, `sentAt = now()`. On catch: set `status = 'FAILED'`, `errorMessage = err.message`. This gives the Admin visibility into email delivery without blocking the HTTP response.

---

## 4. System Admin Sidebar Navigation — Full Reference

### Visual Layout

```
┌─────────────────────────────────┐
│  [School Logo]                  │
│  [School Name]               │
│  SY 2026–2027  ● ACTIVE         │
├─────────────────────────────────┤
│                                 │
│  📊  Dashboard                  │  ← all 3 roles (different content)
│                                 │
│  ── ENROLLMENT ──────────────── │  ← section divider label
│  📋  Applications               │  ← REGISTRAR + ADMIN
│  👤  Students                   │  ← REGISTRAR + ADMIN
│  🏫  Sections                   │  ← REGISTRAR + ADMIN
│                                 │
│  ── SYSTEM ──────────────────── │  ← ADMIN-ONLY section
│  👥  User Management            │  ← ADMIN only
│  📧  Email Logs                 │  ← ADMIN only
│  🖥️  System Health              │  ← ADMIN only
│                                 │
│  ── RECORDS ─────────────────── │
│  📜  Audit Logs                 │  ← REGISTRAR + ADMIN (full for Admin)
│  ⚙️   Settings                  │  ← REGISTRAR + ADMIN
│                                 │
├─────────────────────────────────┤
│  Cruz, Maria T.                 │
│  ● System Admin                 │
│  [Log Out]                      │
└─────────────────────────────────┘
```

### Sidebar Items — Quick Reference Table

| # | Label | Icon | Route | Visible To | Admin Access Level |
|---|---|---|---|---|---|
| 1 | Dashboard | `LayoutDashboard` | `/dashboard` | ALL roles | Full stats + admin-specific panels |
| 2 | Applications | `ClipboardList` | `/applications` | REGISTRAR, ADMIN | Full — approve, reject, enroll |
| 3 | Students | `Users` | `/students` | REGISTRAR, ADMIN | Full — search, view, edit |
| 4 | Sections | `School` | `/sections` | REGISTRAR, ADMIN | Full CRUD |
| 5 | User Management | `UserCog` | `/admin/users` | **ADMIN only** | Full CRUD + deactivate + reset password |
| 6 | Email Logs | `Mail` | `/admin/email-logs` | **ADMIN only** | Read-only + manual resend |
| 7 | System Health | `Monitor` | `/admin/system` | **ADMIN only** | Read-only diagnostics |
| 8 | Audit Logs | `ScrollText` | `/audit-logs` | REGISTRAR, ADMIN | Admin sees **all users**; Registrar sees own + system |
| 9 | Settings | `Settings` | `/settings` | REGISTRAR, ADMIN | Full — all 4 tabs |

> **Section dividers** (`── ENROLLMENT ──`, `── SYSTEM ──`, `── RECORDS ──`) are non-clickable visual group labels rendered between nav items. They are visible only when the user's role has at least one item in that group.

---

## 5. Per-Item Detail

---

### 5.1 Dashboard (Admin View) — `/dashboard`

```
Icon  : LayoutDashboard
Route : /dashboard
Auth  : JWT — all roles (content differs per role)
Page  : client/src/pages/dashboard/Index.tsx
API   : GET /api/dashboard/stats
        GET /api/admin/dashboard/stats  ← new, admin-only panel data
```

The Admin sees everything the Registrar sees (4 stat cards, bar chart, donut chart, activity feed), **plus** a fourth panel exclusive to the Admin role:

```
╔══════════════════════════════════════════════════════════════════╗
║  DASHBOARD                              SY 2026–2027  ACTIVE    ║
╠══════════╦═══════════╦══════════════╦═══════════════════════════╣
║  14      ║  1,243    ║  5           ║  3                        ║
║  PENDING ║  ENROLLED ║  APPROVED    ║  SECTIONS AT CAPACITY     ║
╠══════════╩═══════════╩══════════════╩═══════════════════════════╣
║  [Bar Chart — Enrollment by Grade]   [Donut — Status Split]     ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  SYSTEM PANEL  (Admin only)                                      ║
║  ──────────────────────────────────────────────────────────────  ║
║  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  ║
║  │  👥  4           │  │  📧  98.2%        │  │  ✅  Online   │  ║
║  │  Active Users    │  │  Email Delivery   │  │  System       ║
║  │  2 Registrars    │  │  Rate (last 30d)  │  │  Status       ║
║  │  2 Teachers      │  │  54/55 delivered  │  │  DB Connected ║
║  └──────────────────┘  └──────────────────┘  └───────────────┘  ║
║                                                                  ║
║  RECENT ACTIVITY  (All users — not filtered to current user)     ║
║  • Feb 3  Cruz, Regina (REGISTRAR)  APPLICATION_APPROVED → #42  ║
║  • Feb 3  Reyes, Juan  (REGISTRAR)  APPLICATION_APPROVED → #41  ║
║  • Feb 1  Cruz, Regina (REGISTRAR)  ENROLLMENT_GATE_TOGGLED     ║
║  • Jan 28 Santos, Maria (ADMIN)     ADMIN_USER_CREATED → Reyes  ║
╚══════════════════════════════════════════════════════════════════╝
```

**Admin-only system panel — 3 stat cards:**

| Card | Label | Icon | Data Source |
|---|---|---|---|
| Active Users | Count of `User` records where `isActive = true` + breakdown by role | `UserCog` | `GET /api/admin/dashboard/stats` |
| Email Delivery Rate | `(SENT / total EmailLog) * 100` for last 30 days | `Mail` | `GET /api/admin/dashboard/stats` |
| System Status | Database connectivity check + server uptime | `Monitor` | `GET /api/admin/dashboard/stats` |

**Recent Activity Feed — Admin difference:**
The Registrar's activity feed shows the last 10 audit log entries system-wide. The Admin's feed also shows **`ADMIN_*` action types** (user created, password reset, account deactivated) that are hidden from Registrar's feed.

---

### 5.2 Applications — `/applications`

```
Icon  : ClipboardList
Route : /applications
Auth  : JWT — REGISTRAR, ADMIN
```

**Identical to the Registrar's view.** The Admin has full approve, reject, and section-assign capabilities. No behavioral differences from the Registrar experience.

**Why the Admin has this access:** If the Registrar is absent or a high-volume enrollment day requires backup processing, the Admin can step in and process applications directly.

---

### 5.3 Students — `/students`

```
Icon  : Users
Route : /students
Auth  : JWT — REGISTRAR, ADMIN
```

**Identical to the Registrar's view.** Full search, filter, and view access across all students and applicants.

---

### 5.4 Sections — `/sections`

```
Icon  : School
Route : /sections
Auth  : JWT — REGISTRAR, ADMIN
```

**Identical to the Registrar's view.** Full CRUD — create, edit capacity, assign advising teacher, delete empty sections.

---

### 5.5 Audit Logs (Full Cross-User) — `/audit-logs`

```
Icon  : ScrollText
Route : /audit-logs
Auth  : JWT — REGISTRAR (partial) · ADMIN (full)
Page  : client/src/pages/audit-logs/Index.tsx
API   : GET /api/audit-logs?actionType=&dateFrom=&dateTo=&userId=&page=
```

**The key difference between Registrar and Admin access to this page:**

| | REGISTRAR | SYSTEM_ADMIN |
|---|---|---|
| Whose logs are visible? | All users' actions (same as admin — the full log is shown) | All users' actions |
| `ADMIN_*` action types visible? | ❌ Hidden | ✅ Visible (user creation, password resets, deactivations) |
| User filter dropdown | ❌ Not available | ✅ Available — filter by any specific user account |
| Export capability | ❌ Not available | ✅ Export filtered results as CSV (for compliance/reporting) |

**What the Admin sees with the extra `User` filter:**

```
AUDIT LOGS
  Action Type: [ All ▾ ]   Date: [ Feb 1 to Feb 28, 2026 ]   User: [ All Users ▾ ]

  Timestamp              │ User                    │ Role       │ Action Type            │ Description
  ───────────────────────┼─────────────────────────┼────────────┼────────────────────────┼────────────────────────────────────────
  Feb 28, 2026  5:00 PM  │ Santos, Maria (Admin)   │ ADMIN      │ ADMIN_USER_DEACTIVATED │ Deactivated account: Torres, Carlos
  Feb 20, 2026  9:00 AM  │ Santos, Maria (Admin)   │ ADMIN      │ ADMIN_PASSWORD_RESET   │ Password reset for: Reyes, Juan
  Feb 3,  2026  9:14 AM  │ Cruz, Regina            │ REGISTRAR  │ APPLICATION_APPROVED   │ Approved #42 → Grade 7 Rizal
  Feb 3,  2026  9:11 AM  │ (system / guest)        │ —          │ APPLICATION_SUBMITTED  │ Guest submitted #42 (LRN: 123456789012)
  Feb 1,  2026  8:00 AM  │ Cruz, Regina            │ REGISTRAR  │ ENROLLMENT_GATE_TOGGLED│ Admin set enrollment to OPEN
  Jan 28, 2026  2:30 PM  │ Santos, Maria (Admin)   │ ADMIN      │ ADMIN_USER_CREATED     │ Created account: Cruz, Regina (REGISTRAR)
  Jan 28, 2026  1:55 PM  │ Santos, Maria (Admin)   │ ADMIN      │ USER_LOGIN             │ User admin@school.edu.ph logged in
```

**CSV Export (Admin only):**
- Button: `[ Export CSV ]` at top-right of the page
- Exports the currently filtered result set (respects all active filters)
- Filename format: `audit-log-[dateFrom]-[dateTo].csv`
- Columns: Timestamp, User, Role, Action Type, Description, IP Address, User Agent
- Intended use: submitting records to the SDO or school head upon request

---

### 5.6 Settings — `/settings`

```
Icon  : Settings
Route : /settings
Auth  : JWT — REGISTRAR, ADMIN
```

**Identical to the Registrar's view** — all 4 tabs (School Profile, Academic Year, Grade Levels & Strands, Enrollment Gate). No behavioral differences. The Admin has full access to all 4 tabs.

---

### 5.7 User Management — `/admin/users`

```
Icon  : UserCog
Route : /admin/users
Auth  : JWT — SYSTEM_ADMIN only
Page  : client/src/pages/admin/Users.tsx
API   : GET    /api/admin/users
        POST   /api/admin/users
        PUT    /api/admin/users/:id
        PATCH  /api/admin/users/:id/deactivate
        PATCH  /api/admin/users/:id/reactivate
        PATCH  /api/admin/users/:id/reset-password
```

This is the most important Admin-exclusive module. It is the system's only user provisioning interface.

---

#### User Management — Main Table View

```
USER MANAGEMENT                                           [ + Create User ]

  Role Filter: [ All ▾ ]    Status: [ Active ▾ ]

  Name                  │ Email                       │ Role        │ Status   │ Last Login          │ Created By       │ Actions
  ──────────────────────┼─────────────────────────────┼─────────────┼──────────┼─────────────────────┼──────────────────┼───────────────────────────
  Cruz, Regina          │ registrar@school.edu.ph       │ REGISTRAR   │ ● Active │ Feb 3, 2026 9:14 AM │ Santos, Maria    │ [Edit]  [Reset PW]  [⊘ Deactivate]
  Reyes, Juan           │ registrar2@school.edu.ph      │ REGISTRAR   │ ● Active │ Feb 2, 2026 8:00 AM │ Santos, Maria    │ [Edit]  [Reset PW]  [⊘ Deactivate]
  Lim, Benjamin         │ teacher.lim@school.edu.ph     │ TEACHER     │ ● Active │ Jan 30, 2026 7:45 AM│ Santos, Maria    │ [Edit]  [Reset PW]  [⊘ Deactivate]
  Aquino, Nora          │ teacher.aquino@school.edu.ph  │ TEACHER     │ ● Active │ Jan 29, 2026 8:00 AM│ Santos, Maria    │ [Edit]  [Reset PW]  [⊘ Deactivate]
  Torres, Carlos        │ teacher.torres@school.edu.ph  │ TEACHER     │ ⊘ Inactive│ Dec 10, 2025 9:00 AM│ Santos, Maria  │ [Edit]              [✓ Reactivate]
```

**Table columns:**

| Column | Description |
|---|---|
| Name | Full name of the user account |
| Email | Login email — must be unique across all users |
| Role | `REGISTRAR` or `TEACHER` — shown as a colored Badge. `SYSTEM_ADMIN` is never shown in this list (Admins manage themselves only via CLI). |
| Status | `● Active` (green) or `⊘ Inactive` (grey) — controlled by `isActive` field |
| Last Login | From `User.lastLoginAt` — shows "Never" if the user has never logged in |
| Created By | Name of the Admin who created this account — from `User.createdById` relation |
| Actions | Context-aware: active users show Deactivate; inactive users show Reactivate. Reset Password always available. |

---

#### Creating a New User Account

**Admin clicks `+ Create User`. Dialog opens:**

```
┌────────────────────────────────────────────────────────────────┐
│  Create User Account                                           │
│  ──────────────────────────────────────────────────────────── │
│                                                                │
│  Full Name *                                                   │
│  [ Cruz, Regina A.                                        ]    │
│                                                                │
│  Email Address *                                               │
│  [ registrar@school.edu.ph                                  ]    │
│  (This will be the login email)                                │
│                                                                │
│  Role *                                                        │
│  ○  Registrar     (full enrollment operations access)          │
│  ○  Teacher       (read-only, own sections only)               │
│  (System Admin role cannot be assigned through this form)      │
│                                                                │
│  Temporary Password *                                          │
│  [ ••••••••••••                                           ]    │
│  [ Generate Strong Password ]                                  │
│                                                                │
│  ☑  Require password change on first login                     │
│                                                                │
│        [ Cancel ]              [ Create Account ]             │
└────────────────────────────────────────────────────────────────┘
```

**Form fields:**

| Field | Type | Validation |
|---|---|---|
| Full Name | Text | Required, max 100 chars |
| Email Address | Email | Required, unique across all users, valid format |
| Role | Radio | Required — `REGISTRAR` or `TEACHER` only; `SYSTEM_ADMIN` is not an option |
| Temporary Password | Password | Required, min 8 chars, at least 1 uppercase + 1 number + 1 symbol |
| Generate Strong Password | Button | Generates a secure random password and fills the field |
| Require password change on first login | Checkbox | Checked by default — stores a `mustChangePassword: true` flag on the User record |

**System on Create:**
- `POST /api/admin/users` → `{ name, email, password, role, mustChangePassword }`
- Password is hashed with `bcryptjs` (12 salt rounds) before storing
- `createdById` automatically set to the Admin's `userId` from JWT
- `AuditLog` entry: `ADMIN_USER_CREATED — "Admin [admin name] created account: [new user name] (REGISTRAR/TEACHER)"`
- The new user's password is **never** stored or logged in plaintext anywhere — not in the audit log, not in the email
- Sileo `success` toast: *"Account Created — Cruz, Regina has been added as a Registrar."*
- **No automatic welcome email is sent.** The Admin communicates credentials to the new user through a secure offline channel (in person, school messaging system, etc.). This is intentional — email-delivered temporary passwords are a security risk.

---

#### Editing a User Account

**Admin clicks `[Edit]`. Dialog opens with current values pre-filled:**

```
┌────────────────────────────────────────────────────────────────┐
│  Edit User Account — Cruz, Regina                              │
│  ──────────────────────────────────────────────────────────── │
│                                                                │
│  Full Name *                                                   │
│  [ Cruz, Regina A.                                        ]    │
│                                                                │
│  Email Address *                                               │
│  [ registrar@school.edu.ph                                  ]    │
│                                                                │
│  Role *                                                        │
│  ●  Registrar                                                  │
│  ○  Teacher                                                    │
│                                                                │
│        [ Cancel ]                  [ Save Changes ]            │
└────────────────────────────────────────────────────────────────┘
```

**What can be edited:** Name, email, role (REGISTRAR ↔ TEACHER only).
**What cannot be edited through this form:** Password (use Reset Password), activation status (use Deactivate/Reactivate), role to/from SYSTEM_ADMIN.

**System on Edit:**
- `PUT /api/admin/users/:id` → `{ name, email, role }`
- `AuditLog`: `ADMIN_USER_UPDATED — "Admin [name] updated account: [user name] — fields changed: [name/email/role]"`
- If role changed: the affected user's next API call with their existing JWT will return `403` because their token still encodes the old role. They must log out and log back in to get a new token with the updated role. A note in the success toast reminds the Admin: *"Account Updated. The user must log out and log back in for role changes to take effect."*

---

#### Resetting a User's Password

**Admin clicks `[Reset PW]`. Dialog opens:**

```
┌────────────────────────────────────────────────────────────────┐
│  Reset Password — Cruz, Regina                                 │
│  ──────────────────────────────────────────────────────────── │
│                                                                │
│  New Password *                                                │
│  [ ••••••••••••                                           ]    │
│  [ Generate Strong Password ]                                  │
│                                                                │
│  ☑  Require password change on next login                      │
│                                                                │
│  ⚠  Share this password with the user through a secure         │
│     offline channel. It will not be emailed.                   │
│                                                                │
│        [ Cancel ]              [ Reset Password ]              │
└────────────────────────────────────────────────────────────────┘
```

**System on Reset:**
- `PATCH /api/admin/users/:id/reset-password` → `{ newPassword, mustChangePassword }`
- New password hashed with bcrypt (12 rounds) and stored
- All existing JWT tokens for this user are effectively invalidated on next verification because the stored `updatedAt` timestamp changes (the system checks `updatedAt > token.iat` — tokens issued before the password reset are rejected)
- `AuditLog`: `ADMIN_PASSWORD_RESET — "Admin [name] reset password for: [user name]"`
- Password is **never** stored or logged in plaintext
- Sileo `success` toast: *"Password Reset — Share the new password with Cruz, Regina securely."*

---

#### Deactivating a User Account

**Admin clicks `[⊘ Deactivate]`. Confirmation Dialog:**

```
┌────────────────────────────────────────────────────────────────┐
│  Deactivate Account — Cruz, Regina?                            │
│  ──────────────────────────────────────────────────────────── │
│                                                                │
│  Cruz, Regina will immediately lose access to the system.     │
│  Their existing data (approvals, enrollment records, audit    │
│  logs) is fully preserved.                                     │
│                                                                │
│  You can reactivate this account at any time.                  │
│                                                                │
│        [ Cancel ]           [ Yes, Deactivate ]               │
└────────────────────────────────────────────────────────────────┘
```

**System on Deactivate:**
- `PATCH /api/admin/users/:id/deactivate` → sets `isActive = false`
- The `authenticate` middleware is updated to check `user.isActive` after decoding the JWT — inactive users receive `HTTP 401` even with a valid token
- `AuditLog`: `ADMIN_USER_DEACTIVATED — "Admin [name] deactivated account: [user name] (REGISTRAR/TEACHER)"`
- Sileo `success` toast: *"Account Deactivated — Cruz, Regina can no longer log in."*
- **Data is never deleted.** All their audit log entries, enrollment approvals, and section assignments remain intact and attributed to their name.

**Reactivating:** Same flow in reverse. `PATCH /api/admin/users/:id/reactivate` → `isActive = true`. `AuditLog`: `ADMIN_USER_REACTIVATED`.

---

#### Force-logout (implicit on deactivation)

There is no explicit "force logout" button. However, because the `authenticate` middleware checks `isActive` on every request, a deactivated user's next API call will fail with `401 Unauthorized`. On the frontend, a `401` response triggers the Zustand auth store to clear the token and redirect to `/login` — so the deactivated user is effectively kicked out on their very next action.

---

### 5.8 Email Logs — `/admin/email-logs`

```
Icon  : Mail
Route : /admin/email-logs
Auth  : JWT — SYSTEM_ADMIN only
Page  : client/src/pages/admin/EmailLogs.tsx
API   : GET   /api/admin/email-logs?status=&trigger=&dateFrom=&dateTo=&page=
        PATCH /api/admin/email-logs/:id/resend
```

This page gives the Admin visibility into every email the system has attempted to send. It is the primary debugging tool when parents report not receiving their confirmation or rejection emails.

---

#### Email Logs — Main Table View

```
EMAIL LOGS

  Status: [ All ▾ ]   Trigger: [ All ▾ ]   Date: [ All ▾ ]      [ Export CSV ]

  ID  │ Recipient                      │ Subject                                  │ Trigger              │ Status   │ Attempted At              │ Actions
  ────┼────────────────────────────────┼──────────────────────────────────────────┼──────────────────────┼──────────┼───────────────────────────┼────────────
  055 │ delacruz.maria@gmail.com       │ Congratulations! Your Enrollment is...   │ APPLICATION_APPROVED │ ✅ SENT  │ Feb 3, 2026  9:15 AM      │ [View]
  054 │ santos.luz@gmail.com           │ Congratulations! Your Enrollment is...   │ APPLICATION_APPROVED │ ✅ SENT  │ Feb 3, 2026  8:56 AM      │ [View]
  053 │ fernandez.ana@yahoo.com        │ Update on Your Application — [School Name]        │ APPLICATION_REJECTED │ ❌ FAILED│ Feb 2, 2026  4:30 PM      │ [View] [Resend]
  052 │ reyes.pedro@gmail.com          │ Your Application Has Been Received...    │ APPLICATION_SUBMITTED│ ✅ SENT  │ Feb 2, 2026  7:23 AM      │ [View]
  051 │ torres.miguel@gmail.com        │ Your Application Has Been Received...    │ APPLICATION_SUBMITTED│ ⏳ PENDING│ Feb 2, 2026  7:10 AM     │ [View]
```

**Status values and their meaning:**

| Status | Icon | Meaning |
|---|---|---|
| `SENT` | ✅ green | Nodemailer successfully delivered to the SMTP relay (Resend). The email left the server. |
| `FAILED` | ❌ red | Nodemailer threw an error. The email was NOT sent. Admin can see the error and resend. |
| `PENDING` | ⏳ amber | The `setImmediate()` has been queued but the async operation has not completed yet. Should resolve within seconds; if stuck, indicates a system issue. |

**Filter toolbar:**
- Status: ALL / SENT / FAILED / PENDING
- Trigger: ALL / APPLICATION_SUBMITTED / APPLICATION_APPROVED / APPLICATION_REJECTED
- Date range picker

---

#### Email Detail View (`[View]`)

**Clicking `[View]` on any row opens a detail panel:**

```
EMAIL LOG DETAIL — #053

  Recipient   :  fernandez.ana@yahoo.com
  Subject     :  Update on Your Application — [School Name]
  Trigger     :  APPLICATION_REJECTED
  Status      :  ❌ FAILED
  Attempted   :  February 2, 2026 at 4:30 PM
  Sent At     :  —

  Linked Applicant:  FERNANDEZ, Clara B. (Application #039)

  Error Message:
  ┌─────────────────────────────────────────────────────────────────┐
  │  Error: Invalid login: 535 Authentication Credentials Invalid   │
  │  at SMTPConnection._formatError (...)                           │
  └─────────────────────────────────────────────────────────────────┘

  [ Resend Email ]
```

---

#### Resending a Failed Email

**Admin clicks `[Resend]` (table) or `[Resend Email]` (detail view). Confirmation Dialog:**

```
┌────────────────────────────────────────────────────────────────┐
│  Resend Email?                                                 │
│                                                                │
│  Recipient  :  fernandez.ana@yahoo.com                        │
│  Subject    :  Update on Your Application — [School Name]     │
│                                                                │
│  A new email will be dispatched immediately.                   │
│                                                                │
│        [ Cancel ]               [ Yes, Resend ]               │
└────────────────────────────────────────────────────────────────┘
```

**System on Resend:**
- `PATCH /api/admin/email-logs/:id/resend`
- Server retrieves the original `EmailLog` record, re-builds the email template, and dispatches it via Nodemailer
- A **new** `EmailLog` record is created (same `applicantId`, same `trigger`) — the original FAILED record is preserved for traceability
- `AuditLog`: `ADMIN_EMAIL_RESENT — "Admin [name] manually resent email #053 to fernandez.ana@yahoo.com"`
- Sileo `success` toast: *"Email Queued — Resend dispatched to fernandez.ana@yahoo.com."*

**Common FAILED email causes:**
- Resend API key expired or invalid → Admin must update `RESEND_API_KEY` in `.env` and restart the server
- Invalid recipient email address (typo in the applicant's form) → Admin must contact the applicant by phone and correct the email in their record, then resend
- Resend rate limit exceeded → retry later

---

### 5.9 System Health — `/admin/system`

```
Icon  : Monitor
Route : /admin/system
Auth  : JWT — SYSTEM_ADMIN only
Page  : client/src/pages/admin/SystemHealth.tsx
API   : GET /api/admin/system/health
```

This page provides the Admin with a high-level diagnostic view of the deployed system. It does not expose raw server logs or file system access — it is a curated, safe summary of key health indicators.

---

#### System Health — Main View

```
SYSTEM HEALTH                              Last refreshed: Feb 28, 2026  3:45 PM
                                           [ Refresh Now ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SYSTEM STATUS

  ┌─────────────────────────────┐  ┌──────────────────────────────────┐
  │  ✅  Database               │  │  ✅  Email Service (Resend SMTP)  │
  │  PostgreSQL 18              │  │  Last successful send:            │
  │  Connected                  │  │  Feb 28, 2026 3:40 PM            │
  │  Avg query: 12ms            │  │  Delivery rate: 98.2% (30d)      │
  └─────────────────────────────┘  └──────────────────────────────────┘

  ┌─────────────────────────────┐  ┌──────────────────────────────────┐
  │  ✅  Server                 │  │  ✅  File Storage                 │
  │  Node.js 22 LTS             │  │  server/uploads/                  │
  │  Uptime: 12 days, 4 hrs     │  │  Used: 18.4 MB / ~500 MB         │
  │  Memory: 142 MB / 512 MB    │  │  Logo files: 3                   │
  └─────────────────────────────┘  └──────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DATABASE RECORD COUNTS                         (Active Year: SY 2026–2027)

  Users              :  4  (1 Admin · 2 Registrars · 2 Teachers)
  Academic Years     :  3  (1 active · 2 archived)
  Grade Levels       :  6  (for active year)
  Strands/Clusters   :  8  (4 elective clusters · 4 old strands)
  Sections           :  28 (for active year)
  Applications       :  198 total  (14 pending · 179 enrolled · 5 rejected)
  Enrollments        :  179
  Email Logs         :  198 total  (195 sent · 3 failed · 0 pending)
  Audit Log Entries  :  2,341

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ENVIRONMENT INFO

  Runtime     :  Node.js v22.14.0
  Express     :  5.1.0
  Prisma ORM  :  6.x
  Database    :  PostgreSQL 18
  Build       :  Production
  Timezone    :  Asia/Manila (UTC+8)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ACTIVE USERS CURRENTLY LOGGED IN  (approximate — JWT-based)

  No real-time session tracking available. Last login timestamps
  available in User Management → Last Login column.
```

**Health check indicators — status values:**

| Status | Icon | Meaning |
|---|---|---|
| `OK` | ✅ green | Service is reachable and responding normally |
| `DEGRADED` | ⚠ amber | Service responds but with high latency or partial failure |
| `DOWN` | ❌ red | Service is unreachable — immediate admin action required |

**Health check implementation (backend):**
```ts
// server/src/routes/adminRoutes.ts
// GET /api/admin/system/health

export async function getSystemHealth(req, res) {
  const [dbPing, emailCheck, storageStat] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,                     // DB connectivity
    checkResendConnectivity(),                       // SMTP ping
    getUploadDirectoryStat(),                        // fs.stat on uploads/
  ]);

  res.json({
    database:    dbPing.status === 'fulfilled' ? 'OK' : 'DOWN',
    email:       emailCheck.status === 'fulfilled' ? 'OK' : 'DEGRADED',
    storage:     storageStat.status === 'fulfilled' ? 'OK' : 'DEGRADED',
    serverUptime: process.uptime(),
    memoryUsage:  process.memoryUsage(),
    nodeVersion:  process.version,
    timezone:    Intl.DateTimeFormat().resolvedOptions().timeZone,
    counts:      await getRecordCounts(),           // prisma count() calls
  });
}
```

**The `[ Refresh Now ]` button** re-fetches `GET /api/admin/system/health` and updates all panels. Auto-refresh is not implemented (no WebSocket) — manual refresh only, consistent with the PRD's no-real-time-push policy.

**What System Health does NOT show:**
- Raw server logs (security risk — not exposed through the UI)
- Database query logs
- Individual user sessions (no real-time session tracking — JWT is stateless)
- Disk I/O, CPU usage graphs (out of scope for this system)

---

## 6. Complete Role Access Matrix

| Route / Page | TEACHER | REGISTRAR | SYSTEM_ADMIN | Unauthenticated |
|---|---|---|---|---|
| `/dashboard` | ✅ Limited | ✅ Full | ✅ Full + System Panel | → `/login` |
| `/applications` | ❌ 403 | ✅ Full | ✅ Full | → `/login` |
| `/applications/:id` | ❌ 403 | ✅ Full | ✅ Full | → `/login` |
| `/students` | ❌ 403 | ✅ Full | ✅ Full | → `/login` |
| `/sections` | ❌ 403 | ✅ Full CRUD | ✅ Full CRUD | → `/login` |
| `/audit-logs` | ❌ 403 | ✅ Full (all users, no ADMIN_ types, no user filter, no export) | ✅ Full (all users, ADMIN_ types visible, user filter, CSV export) | → `/login` |
| `/settings` | ❌ 403 | ✅ Full (all 4 tabs) | ✅ Full (all 4 tabs) | → `/login` |
| `/my-sections` | ✅ Own sections only | ❌ Hidden | ❌ Hidden | → `/login` |
| `/admin/users` | ❌ 403 | ❌ 403 | ✅ Full CRUD | → `/login` |
| `/admin/email-logs` | ❌ 403 | ❌ 403 | ✅ Full + Resend | → `/login` |
| `/admin/system` | ❌ 403 | ❌ 403 | ✅ Read-only | → `/login` |
| `/apply` | N/A public | N/A public | N/A public | ✅ if gate OPEN → `/closed` if OFF |
| `/closed` | N/A public | N/A public | N/A public | ✅ always |
| `/track/:id` | N/A public | N/A public | N/A public | ✅ always |
| `/login` | → `/dashboard` | → `/dashboard` | → `/dashboard` | ✅ |

---

## 7. New API Endpoints

All admin endpoints are prefixed `/api/admin/`. All require `authenticate` + `authorize('SYSTEM_ADMIN')` middleware.

### User Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/users` | Paginated user list; filters: `role`, `isActive` |
| `POST` | `/admin/users` | Create new REGISTRAR or TEACHER account |
| `PUT` | `/admin/users/:id` | Update name, email, or role |
| `PATCH` | `/admin/users/:id/deactivate` | Soft-deactivate — sets `isActive = false` |
| `PATCH` | `/admin/users/:id/reactivate` | Re-enable — sets `isActive = true` |
| `PATCH` | `/admin/users/:id/reset-password` | Admin-initiated password reset `{ newPassword, mustChangePassword }` |

### Email Logs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/email-logs` | Paginated email log; filters: `status`, `trigger`, `dateFrom`, `dateTo` |
| `GET` | `/admin/email-logs/:id` | Single email log record with full error message |
| `PATCH` | `/admin/email-logs/:id/resend` | Re-dispatch the email; creates a new EmailLog record |
| `GET` | `/admin/email-logs/export` | Returns filtered results as CSV download |

### System Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/system/health` | Full health check — DB, email, storage, server info, record counts |

### Admin Dashboard Stats

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/dashboard/stats` | Returns active user count by role, email delivery rate (30d), system status summary |

### Audit Log (Extended for Admin)

| Method | Endpoint | Description | Change from existing |
|---|---|---|---|
| `GET` | `/audit-logs` | Paginated audit logs | Now accepts `?userId=` filter (ADMIN only); `?export=csv` (ADMIN only); returns `ADMIN_*` action types for ADMIN role only |

---

## 8. New Audit Log Action Types

The following `actionType` values are added to the existing 8. They are stored in `AuditLog.actionType` identically to the existing types.

| Action Type | Description Template | Who Triggers It |
|---|---|---|
| `ADMIN_USER_CREATED` | `"Admin {admin_name} created account: {user_name} ({role})"` | SYSTEM_ADMIN |
| `ADMIN_USER_UPDATED` | `"Admin {admin_name} updated account: {user_name} — changed: {fields}"` | SYSTEM_ADMIN |
| `ADMIN_USER_DEACTIVATED` | `"Admin {admin_name} deactivated account: {user_name} ({role})"` | SYSTEM_ADMIN |
| `ADMIN_USER_REACTIVATED` | `"Admin {admin_name} reactivated account: {user_name} ({role})"` | SYSTEM_ADMIN |
| `ADMIN_PASSWORD_RESET` | `"Admin {admin_name} reset password for: {user_name}"` | SYSTEM_ADMIN |
| `ADMIN_EMAIL_RESENT` | `"Admin {admin_name} manually resent email #{email_log_id} to {recipient}"` | SYSTEM_ADMIN |

**Visibility rule:**
- `ADMIN_*` action types are returned by `GET /api/audit-logs` **only** when the requester's role is `SYSTEM_ADMIN`
- The REGISTRAR receives all other action types but `ADMIN_*` types are filtered out of their response
- This prevents Registrars from seeing which other Registrars had their passwords reset or accounts modified

---

## 9. Frontend Routing Changes

```tsx
// client/src/router/index.tsx — UPDATED

export const router = createBrowserRouter([
  // ── Public (unchanged) ────────────────────────────────────
  { path: '/', loader: ... },
  { path: '/apply', element: ..., loader: ... },
  { path: '/closed', element: ... },
  { path: '/track/:trackingNumber', element: ... },
  { path: '/login', element: ... },

  // ── Protected — Registrar + Teacher (unchanged) ──────────
  {
    element: <ProtectedRoute allowedRoles={['REGISTRAR', 'TEACHER', 'SYSTEM_ADMIN']} />,
    children: [
      { path: '/dashboard',        element: <AppLayout><Dashboard /></AppLayout> },
      { path: '/applications',     element: <AppLayout><Applications /></AppLayout> },
      { path: '/applications/:id', element: <AppLayout><ApplicationDetail /></AppLayout> },
      { path: '/students',         element: <AppLayout><Students /></AppLayout> },
      { path: '/sections',         element: <AppLayout><Sections /></AppLayout> },
      { path: '/audit-logs',       element: <AppLayout><AuditLogs /></AppLayout> },
      { path: '/settings',         element: <AppLayout><Settings /></AppLayout> },
      { path: '/my-sections',      element: <AppLayout><MySections /></AppLayout> },
    ],
  },

  // ── Protected — System Admin only ─────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['SYSTEM_ADMIN']} />,  // ← NEW
    children: [
      { path: '/admin/users',       element: <AppLayout><AdminUsers /></AppLayout> },
      { path: '/admin/email-logs',  element: <AppLayout><AdminEmailLogs /></AppLayout> },
      { path: '/admin/system',      element: <AppLayout><AdminSystemHealth /></AppLayout> },
    ],
  },

  // ── Fallback ──────────────────────────────────────────────
  { path: '*', element: <NotFound /> },
]);
```

**New page components:**

```
client/src/pages/admin/
├── Users.tsx           — /admin/users
├── EmailLogs.tsx       — /admin/email-logs
└── SystemHealth.tsx    — /admin/system
```

---

## 10. Sidebar Component Changes

### Updated `SidebarContent.tsx`

The sidebar now renders three conditional sections based on role:

```tsx
// client/src/components/sidebar/SidebarContent.tsx

export function SidebarContent() {
  const { user } = useAuthStore();
  const isAdmin     = user?.role === 'SYSTEM_ADMIN';
  const isRegistrar = user?.role === 'REGISTRAR';

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {/* ── Always visible ──────────────────────────────── */}
      <NavItem to="/dashboard"    icon={LayoutDashboard} label="Dashboard" />

      {/* ── Enrollment section (Registrar + Admin) ──────── */}
      {(isRegistrar || isAdmin) && (
        <>
          <NavDivider label="Enrollment" />
          <NavItem to="/applications" icon={ClipboardList} label="Applications" />
          <NavItem to="/students"     icon={Users}         label="Students" />
          <NavItem to="/sections"     icon={School}        label="Sections" />
        </>
      )}

      {/* ── System section (Admin only) ──────────────────── */}
      {isAdmin && (
        <>
          <NavDivider label="System" />
          <NavItem to="/admin/users"       icon={UserCog}  label="User Management" />
          <NavItem to="/admin/email-logs"  icon={Mail}     label="Email Logs" />
          <NavItem to="/admin/system"      icon={Monitor}  label="System Health" />
        </>
      )}

      {/* ── Records section (Registrar + Admin) ─────────── */}
      {(isRegistrar || isAdmin) && (
        <>
          <NavDivider label="Records" />
          <NavItem to="/audit-logs" icon={ScrollText} label="Audit Logs" />
          <NavItem to="/settings"   icon={Settings}   label="Settings" />
        </>
      )}
    </nav>
  );
}
```

### New `NavDivider` Component

```tsx
// client/src/components/sidebar/NavDivider.tsx

export function NavDivider({ label }: { label: string }) {
  return (
    <div className="px-3 py-2 mt-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
```

### Role Badge Colors in Sidebar Footer

| Role | Badge Color | Label |
|---|---|---|
| `SYSTEM_ADMIN` | Purple / violet | `● System Admin` |
| `REGISTRAR` | Accent (school color) | `● Registrar` |
| `TEACHER` | Blue | `● Teacher` |

---

## 11. Security Considerations

### Privilege Escalation Prevention

The `POST /api/admin/users` and `PUT /api/admin/users/:id` endpoints enforce at the server level:

```ts
// server/src/controllers/adminUserController.ts

// Prevent assigning SYSTEM_ADMIN role through the API
if (req.body.role === 'SYSTEM_ADMIN') {
  return res.status(403).json({
    message: 'The SYSTEM_ADMIN role cannot be assigned through the API. Use the seed script.'
  });
}
```

This means **no Admin can create another Admin through the UI**. The only way to provision an Admin account is through the CLI seeder (see §13).

### Active Check on Every Authenticated Request

```ts
// server/src/middleware/authenticate.ts — UPDATED

export async function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);

    // ── NEW: Check isActive on every request ──
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Account is inactive. Contact your system administrator.' });
    }
    // ──────────────────────────────────────────

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
```

> **Performance note:** This adds one `SELECT` query per authenticated request. For a single-school system with < 10 concurrent users, this is negligible. If performance becomes a concern in future, cache the `isActive` check with a short TTL (e.g., 30 seconds in memory).

### Password Requirements

All passwords (creation and reset) must meet:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 number
- At least 1 special character (`!@#$%^&*` etc.)
- Enforced by a Zod schema on the backend validator

### Must-Change-Password on First Login

```ts
// server/src/controllers/authController.ts — UPDATED

const token = jwt.sign(
  {
    userId:             user.id,
    role:               user.role,
    mustChangePassword: user.mustChangePassword  // ← included in JWT
  },
  process.env.JWT_SECRET,
  { expiresIn: '8h' }
);
```

On the frontend, after login:

```ts
// client/src/stores/authStore.ts
if (auth.user.mustChangePassword) {
  navigate('/change-password');  // ← new protected route for forced PW change
}
```

The `/change-password` route is a simple full-page form asking for the new password (no sidebar, just the form). After a successful change, `mustChangePassword` is set to `false` in the DB and the user proceeds normally.

---

## 12. New Acceptance Criteria

| # | Acceptance Test |
|---|---|
| AC-33 | A user with role `SYSTEM_ADMIN` can log in and sees the full Admin sidebar including User Management, Email Logs, and System Health nav items. |
| AC-34 | A user with role `REGISTRAR` or `TEACHER` navigating to `/admin/users`, `/admin/email-logs`, or `/admin/system` receives `HTTP 403 Forbidden`. |
| AC-35 | The Admin can create a new REGISTRAR account. The new user can log in with the provided credentials. The creation is recorded in the Audit Log as `ADMIN_USER_CREATED`. |
| AC-36 | The Admin can create a new TEACHER account. The new user can log in and sees only the TEACHER sidebar (Dashboard + My Sections). |
| AC-37 | Creating a user account with `role: SYSTEM_ADMIN` via the API returns `HTTP 403`. The ADMIN role cannot be self-assigned or assigned to others through the UI. |
| AC-38 | The Admin can deactivate a Registrar account. The deactivated Registrar's next API request returns `HTTP 401`. The Registrar is redirected to `/login`. |
| AC-39 | Deactivating a user does NOT delete any of their audit log entries, enrollment approvals, or section assignments. All historical data remains attributed to their name. |
| AC-40 | The Admin can reset a user's password. The affected user cannot log in with the old password. They can log in with the new password. |
| AC-41 | After a password reset, all existing JWT tokens for that user become invalid on their next API call. |
| AC-42 | If `mustChangePassword = true`, the user is redirected to `/change-password` immediately after login and cannot access any other route until they change their password. |
| AC-43 | Every failed email delivery is recorded in the `EmailLog` table with `status = 'FAILED'` and the Nodemailer error message. |
| AC-44 | The Admin can resend a FAILED email from `/admin/email-logs`. A new `EmailLog` record is created for the resend attempt. The original FAILED record is preserved. |
| AC-45 | The System Health page shows `✅ OK` database status when PostgreSQL is reachable. It shows `❌ DOWN` if the database is unreachable. |
| AC-46 | The Audit Log page for a REGISTRAR does NOT show `ADMIN_*` action types. The same page for a SYSTEM_ADMIN shows all action types including `ADMIN_*`. |
| AC-47 | The Admin can filter the Audit Log by a specific user from the `User` dropdown filter. The Registrar does not have this filter. |
| AC-48 | The Admin can export the Audit Log as a CSV file from `/audit-logs`. The CSV includes all columns: Timestamp, User, Role, Action Type, Description, IP Address. |

---

## 13. First-Time Setup — How the First Admin Account is Created

Since the ADMIN role cannot be assigned through the UI, the first System Admin account is created using a **database seeder script** run via the CLI during initial system deployment.

### Seed Script

```ts
// server/prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email    = process.env.ADMIN_EMAIL    ?? 'admin@school.edu.ph';
  const password = process.env.ADMIN_PASSWORD ?? 'Admin@School2026!';
  const name     = process.env.ADMIN_NAME     ?? 'System Administrator';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin account already exists: ${email}`);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name,
      email,
      password:             hashed,
      role:                 'SYSTEM_ADMIN',
      isActive:             true,
      mustChangePassword:   true,  // ← force PW change on first login
    },
  });

  console.log(`✅ System Admin created: ${email}`);
  console.log(`   Temporary password:   ${password}`);
  console.log(`   ⚠  Change this password immediately after first login.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Running the Seed

```bash
# In the server/ package:
pnpm prisma db seed

# Or with custom credentials via environment:
ADMIN_EMAIL=maria.santos@school.edu.ph \
ADMIN_PASSWORD=SecureP@ss2026! \
ADMIN_NAME="Santos, Maria T." \
pnpm prisma db seed
```

### `package.json` seed config

```json
// server/package.json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

### First Login Flow

1. Admin navigates to the system URL → `/login`
2. Enters the seeded email and temporary password
3. System logs in but immediately redirects to `/change-password`
4. Admin sets a strong permanent password
5. `mustChangePassword = false` saved to DB
6. Admin is redirected to `/dashboard`
7. Admin sees the full Admin sidebar and begins creating Registrar and Teacher accounts

> ⚠ **Security notice for deployment:** The seed script logs the temporary password to the console. Ensure the deployment terminal output is not recorded in any publicly accessible log file. Change the Admin password immediately after the first login.

---

## Summary — What the System Admin Sees

```
ADMIN SIDEBAR (9 items across 4 groups)

  📊  Dashboard
      ├─ 4 enrollment stat cards (same as Registrar)
      └─ 3 admin system stat cards (Active Users, Email Rate, System Status)

  ── ENROLLMENT ──
  📋  Applications    (full approve/reject/assign — same as Registrar)
  👤  Students        (full search and view — same as Registrar)
  🏫  Sections        (full CRUD — same as Registrar)

  ── SYSTEM ──
  👥  User Management
      ├─ Create REGISTRAR and TEACHER accounts
      ├─ Edit name, email, role
      ├─ Reset passwords
      └─ Activate / Deactivate accounts
  📧  Email Logs
      ├─ View every email sent or failed
      ├─ See error messages for FAILED deliveries
      └─ Manually resend failed emails
  🖥️  System Health
      ├─ Database connectivity + avg query time
      ├─ Email service status + delivery rate
      ├─ Server uptime + memory usage
      └─ Record count summary across all models

  ── RECORDS ──
  📜  Audit Logs      (all users · ADMIN_ types visible · user filter · CSV export)
  ⚙️   Settings        (all 4 tabs — identical to Registrar)
```

---

*Document prepared by: System Design Team*
*Version: PRD v2.3.0 (addendum from v2.2.1)*
*Policy: DepEd Order No. 017, s. 2025 · DM 012, s. 2026 · RA 10173 (Data Privacy Act)*
*School: [School Name]*
*Stack: PERN (PostgreSQL · Express · React · Node.js) · Prisma 6 · JWT · shadcn/ui · Tailwind CSS v4*