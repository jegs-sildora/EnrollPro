# Sidebar Navigation — TEACHER Role
## School Admission, Enrollment & Information Management System

**Document Version:** 3.0.0
**Role:** `TEACHER`
**Derived From:** PRD v3.0.0 · Sidebar Navigation Spec v3.0.0
**Stack:** React 19 · React Router v7 · shadcn/ui · Tailwind CSS v4 · Lucide React Icons

---

## Overview

The TEACHER role is the most restricted authenticated role in the system. A teacher's access is **read-only and scoped exclusively to their own assigned sections**. They have no visibility into admissions, enrollment decisions, student records outside their sections, or any system configuration.

The sidebar reflects this: it contains exactly **two navigation items**.

---

## How a Teacher Gets an Account

A teacher account is provisioned by the Registrar (or System Admin) from `/teachers/:id` → Tab 3: System Account. The teacher does not self-register. On provisioning:

- A `User` record is created with `role: TEACHER` and `mustChangePassword: true`
- A system-generated temporary password is issued
- A welcome email is sent to the teacher's email address using `SchoolSettings.schoolName` in the subject
- On first login, the teacher is forced to `/change-password` before seeing any content

---

## How to Reach the Login Page (Layer 1 Gate)

The `/login` route is **not directly accessible by URL**. The teacher must click **"Staff Login"** in the footer of `/apply` or `/closed`. Typing `/login` in the address bar redirects to `/`.

After clicking Staff Login:
1. `/login` opens (Layer 1 gate passed via navigation state `{ loginAccess: true }`)
2. The page silently fetches a one-time pre-flight login token — Layer 2
3. Teacher enters email + temporary password
4. System detects `mustChangePassword: true` → redirects to `/change-password`
5. Teacher sets a new password → lands on `/dashboard`

---

## Sidebar Anatomy

```
┌──────────────────────────────────────┐
│  [School Logo]                       │  ← settingsStore.logoUrl
│  [School Name]                       │  ← settingsStore.schoolName (never hardcoded)
│  SY 2026–2027  ● ACTIVE              │  ← settingsStore.activeYear.yearLabel
├──────────────────────────────────────┤
│                                      │
│  ── DASHBOARD ──                     │
│  📊  Dashboard                       │
│                                      │
│  ── MY CLASSES ──                    │
│  📖  My Sections                     │
│                                      │
├──────────────────────────────────────┤
│  Santos, Caridad M.                  │  ← user.name
│  ● Teacher                           │  ← blue badge
│  [Log Out]                           │
└──────────────────────────────────────┘
```

**Sidebar header rules:**
- School logo: from `settingsStore.logoUrl`. If null: `<School className="w-8 h-8 text-muted-foreground" />`
- School name: from `settingsStore.schoolName`. Never a string literal. Shows `<Skeleton>` while loading.
- Active year label: from `settingsStore.activeYear.yearLabel`. Shows `"No Active Year"` + amber warning icon if none set.
- Role badge color: **blue** for `TEACHER`

**Active nav item styling:**
```css
border-l-2 border-[hsl(var(--accent))]
bg-[hsl(var(--accent-muted))]
text-[hsl(var(--accent))]
font-medium
```
The accent color is extracted from the school's uploaded logo — consistent across all roles.

**Inactive nav item styling:**
```css
text-muted-foreground
hover:bg-muted hover:text-foreground
```

---

## Complete Navigation Items

### Item 1 — Dashboard

```
Icon   : LayoutDashboard
Label  : Dashboard
Route  : /dashboard
Auth   : JWT required — role: TEACHER
Page   : client/src/pages/dashboard/Index.tsx
API    : GET /api/dashboard/stats
```

#### What the Teacher Sees

The Dashboard renders a **limited, read-only view** scoped entirely to the teacher's own assigned sections. There is no system-wide data visible.

```
╔══════════════════════════════════════════════════════════════════╗
║  [School Name]                     SY 2026–2027  ACTIVE         ║
╠══════════════════════════════════════════════════════════════════╣
║  MY SECTIONS — SY 2026–2027                                      ║
║                                                                  ║
║  Grade 7 – Rizal          43 / 45 enrolled                       ║
║  Grade 8 – Bonifacio      38 / 45 enrolled                       ║
╚══════════════════════════════════════════════════════════════════╝
```

**What is shown:**
- School name and active year in the header (from `settingsStore`)
- A list of sections assigned to this teacher with enrolled count and max capacity
- No actions — this view is read-only

**What is NOT shown (hidden from TEACHER):**
- Stat cards (Total Pending, Total Enrolled, Approved Awaiting, Sections at Capacity)
- Enrollment by Grade Level bar chart
- Application Status Distribution donut chart
- Online vs F2F Admission breakdown chart
- SCP Pipeline Panel
- Recent Activity Feed (audit log entries)
- Any action buttons

**API behavior:** `GET /api/dashboard/stats` returns a reduced payload when the JWT role is `TEACHER` — only section-level enrollment counts for sections where `advisingTeacherId` matches the logged-in teacher's `Teacher.id`. No system-wide counts are included in the response.

---

### Item 2 — My Sections

```
Icon   : BookOpen
Label  : My Sections
Route  : /my-sections
Auth   : JWT required — role: TEACHER
Page   : client/src/pages/sections/MySections.tsx
API    : GET /api/teacher/sections
```

This is the teacher's **primary workspace**. Shows only sections where `Section.advisingTeacherId` matches the logged-in teacher's `Teacher.id`. A teacher who advises no sections sees an empty state with a message: *"No sections have been assigned to you yet. Contact your Registrar."*

#### Section List View (`/my-sections`)

```
MY SECTIONS                                          SY 2026–2027

  Section           │  Grade    │  Enrolled  │  Actions
  ──────────────────┼───────────┼────────────┼──────────────────────
  Grade 7 – Rizal   │  Grade 7  │  43 / 45   │  [View Class List]
  Grade 8 – Bonifacio│  Grade 8  │  38 / 45   │  [View Class List]
```

- Grade Level name comes from the database — never hardcoded
- Enrolled count reflects confirmed `Enrollment` records for the active academic year
- Max capacity shown as context — teacher cannot change it

**API:** `GET /api/teacher/sections`
- Server filters sections server-side using `req.user.userId` → resolves to `Teacher.id`
- Returns only sections where `advisingTeacherId` matches
- Never returns sections belonging to other teachers

---

### Section Roster (`/my-sections/:id`)

```
Icon   : (sub-page, no icon in sidebar)
Route  : /my-sections/:id
Auth   : JWT required — role: TEACHER
Page   : client/src/pages/sections/SectionRoster.tsx
API    : GET /api/teacher/sections/:id
```

Navigated to by clicking **[View Class List]** from the section list.

#### What the Teacher Sees

```
GRADE 7 – RIZAL                           Back to My Sections ←

  43 students enrolled

  #    │  LRN             │  Full Name                │  Status
  ─────┼──────────────────┼───────────────────────────┼──────────────
  1    │  123456789012    │  DELA CRUZ, Juan Reyes     │  ✓ ENROLLED
  2    │  234567890123    │  GARCIA, Ana Maria         │  ✓ ENROLLED
  3    │  345678901234    │  REYES, Pedro Manuel       │  ✓ ENROLLED
  ...  │  ...             │  ...                       │  ...
  43   │  987654321098    │  TORRES, Carlo Miguel      │  ✓ ENROLLED
```

**What is shown per student:**
- Row number
- LRN (12-digit Learner Reference Number)
- Full Name (Last, First Middle)
- Enrollment status

**What is NOT shown (hidden from TEACHER even though it exists on the `Applicant` record):**
- IP (Indigenous Peoples) status
- 4Ps beneficiary status and Household ID
- PWD (Person with Disability) status and disability type
- Admission channel (Online vs F2F)
- Application tracking number
- SCP assessment records (exam scores, results)
- Guardian contact details
- Home address
- Application history / status timeline
- Any edit actions

**API behavior:** `GET /api/teacher/sections/:id` validates that the requested section's `advisingTeacherId` matches the logged-in teacher's ID. If a teacher attempts to access a section they do not advise, the server returns `403 Forbidden` — even if they know the section ID.

---

## What the Teacher Cannot Access

Any navigation attempt (via URL bar, link, or API call) to the following returns **HTTP 403 Forbidden**:

| Route | Description | Why Blocked |
|---|---|---|
| `/f2f-admission` | Walk-in admission form | Admission is Registrar-only |
| `/applications` | Application inbox | Enrollment management is Registrar-only |
| `/applications/:id` | Application detail | Same |
| `/students` | Full SIMS directory | System-wide student records are Registrar-only |
| `/students/:id` | Student profile | Same |
| `/teachers` | Teacher directory | Management is Registrar-only |
| `/teachers/:id` | Teacher profile | Same |
| `/sections` | Section management | Section CRUD is Registrar-only |
| `/audit-logs` | Activity log | Audit access is Registrar-only |
| `/settings` | System settings | Configuration is Registrar-only |
| `/admin/users` | User management | System Admin only |
| `/admin/email-logs` | Email delivery log | System Admin only |
| `/admin/system` | System health | System Admin only |

The sidebar hides all of these items (UX-level protection). The backend `authorize()` middleware independently enforces them at the API level regardless of what the frontend renders.

---

## Responsive Behavior

| Viewport | Sidebar Behavior |
|---|---|
| `< 1024px` (mobile/tablet) | Hidden by default; hamburger `<MenuIcon>` in top header opens a `Sheet` drawer from the left |
| `≥ 1024px` (desktop) | Fixed left panel, always visible, `w-64` |
| Desktop collapsed | Toggle button collapses to `w-16` (icon only). Tooltip on hover shows label. |

State managed by `useSidebarStore` (Zustand, not persisted to localStorage — resets on page load).

---

## Log Out Behavior

The Log Out button at the bottom of the sidebar calls:
1. `authStore.clearAuth()` — sets `{ token: null, user: null }` in Zustand
2. Zustand `persist` removes `auth-storage` from `localStorage`
3. React Router navigates to `/` — **not** directly to `/login`
4. The `/` route redirects to `/apply` or `/closed` depending on `enrollmentOpen`

The teacher is not sent directly to `/login` because the login page requires the Layer 1 navigation state gate (`{ loginAccess: true }`). Logging out takes the user back to the public portal, which contains the "Staff Login" link for re-entry.

---

## SidebarContent.tsx — Rendering Logic for TEACHER

```tsx
// client/src/components/layout/SidebarContent.tsx
const { user } = useAuthStore();

const isTeacher = user?.role === 'TEACHER';

// TEACHER sees ONLY these two items:
{isTeacher && (
  <>
    <SidebarSection label="Dashboard">
      <NavItem
        href="/dashboard"
        icon={LayoutDashboard}
        label="Dashboard"
      />
    </SidebarSection>

    <SidebarSection label="My Classes">
      <NavItem
        href="/my-sections"
        icon={BookOpen}
        label="My Sections"
      />
    </SidebarSection>
  </>
)}

// Everything else (Walk-in Admission, Applications, Students, Teachers,
// Sections, Audit Logs, Settings, Admin routes) is NOT rendered for TEACHER.
```

---

## Complete Route Table for TEACHER

| Route | Accessible? | Page Component | API Endpoint |
|---|---|---|---|
| `/dashboard` | ✅ | `Dashboard.tsx` | `GET /api/dashboard/stats` |
| `/my-sections` | ✅ | `MySections.tsx` | `GET /api/teacher/sections` |
| `/my-sections/:id` | ✅ | `SectionRoster.tsx` | `GET /api/teacher/sections/:id` |
| `/change-password` | ✅ (forced on first login) | `ChangePassword.tsx` | `POST /api/auth/change-password` |
| `/f2f-admission` | ❌ 403 | — | — |
| `/applications` | ❌ 403 | — | — |
| `/students` | ❌ 403 | — | — |
| `/teachers` | ❌ 403 | — | — |
| `/sections` | ❌ 403 | — | — |
| `/audit-logs` | ❌ 403 | — | — |
| `/settings` | ❌ 403 | — | — |
| `/admin/*` | ❌ 403 | — | — |

---

*Document v3.0.0 — TEACHER Role Sidebar*
*System: School Admission, Enrollment & Information Management System*
*Derived from: PRD v3.0.0 §4 · §6.6 · §7 · §8*
