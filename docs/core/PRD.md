# Product Requirements Document (PRD)

**Project Name:** Web-Based School Admission, Enrollment & Information Management System
**Document Version:** 3.0.0
**Status:** Ready for Implementation
**Target Actor:** Claude Code (AI Full-Stack Developer)
**Stack:** PERN (PostgreSQL · Express · React · Node.js)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack & Architecture](#2-technology-stack--architecture)
3. [Design System & Visual Identity](#3-design-system--visual-identity)
4. [User Roles & Permissions](#4-user-roles--permissions)
5. [Database Schema — Prisma](#5-database-schema--prisma)
6. [Core Modules](#6-core-modules)
   - 6.1 [Online Admission Portal](#61-online-admission-portal)
   - 6.2 [Face-to-Face (F2F) Admission](#62-face-to-face-f2f-admission)
   - 6.3 [Registrar Administration Dashboard](#63-registrar-administration-dashboard)
   - 6.4 [Enrollment Management](#64-enrollment-management)
   - 6.5 [Student Information Management System (SIMS)](#65-student-information-management-system-sims)
   - 6.6 [Teacher Management](#66-teacher-management)
   - 6.7 [Grade Level & Sectioning Management](#67-grade-level--sectioning-management)
   - 6.8 [Academic Year Configuration](#68-academic-year-configuration)
   - 6.9 [System Audit Trail & Activity Logging](#69-system-audit-trail--activity-logging)
   - 6.10 [Automated Email Notification System](#610-automated-email-notification-system)
7. [REST API Contracts](#7-rest-api-contracts)
8. [Frontend Routing Structure](#8-frontend-routing-structure)
9. [Security Requirements](#9-security-requirements)
   - 9.1 [Login Access Guard — Layer 1 (Frontend)](#91-login-access-guard--layer-1-frontend)
   - 9.2 [Pre-Flight Login Token — Layer 2 (Backend)](#92-pre-flight-login-token--layer-2-backend)
10. [Dynamic School Configuration](#10-dynamic-school-configuration)
11. [Out-of-Scope Limitations](#11-out-of-scope-limitations)
12. [Acceptance Criteria](#12-acceptance-criteria)

---

## 1. Project Overview

This system is a **school-agnostic**, multi-module platform that replaces paper-based admission, enrollment, and student records workflows for any Philippine public secondary school. It is designed to be fully configurable — the school name, logo, grade levels, SCP programs, strand offerings, and admission rules are all runtime settings, not hardcoded values.

**Five primary modules:**

| Module | Primary Actor | Description |
|---|---|---|
| Admission (Online + F2F) | Public (online) · Registrar (F2F) | Accept and process applications from both channels |
| Enrollment Management | Registrar | Review, approve, assign sections, manage capacity |
| Student Information Management System (SIMS) | Registrar · System Admin | Complete, searchable student records and academic history |
| Teacher Management | Registrar · System Admin | Teacher profiles, section assignments, account provisioning |
| Grade Level & Sectioning Management | Registrar · System Admin | Configure grade levels, strands, sections, and capacity |

**Core design principles:**
- Zero hardcoded school data — every school-specific value flows from `SchoolSettings` and admin-configured records in the database
- All admission and enrollment processes adapt dynamically to the school's configured grade levels, SCP offerings, and strand structure
- The `/login` route is inaccessible to the public by direct URL — protected by a two-layer gate (§9.1, §9.2)

---

## 2. Technology Stack & Architecture

> **Instruction for Claude Code:** All technology choices below are non-negotiable. Do not substitute or introduce alternative frameworks. This is a PERN stack project.

### Stack Overview

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Package Manager | pnpm | 10.x | Monorepo via `pnpm-workspace.yaml` |
| Runtime | Node.js | 22 LTS | ES modules (`"type": "module"`) |
| Backend Framework | Express.js | 5.1 | RESTful API only — renders no HTML |
| ORM | Prisma | 6.x | All DB access through Prisma Client |
| Database | PostgreSQL | 18 | Local or managed (Supabase, Railway) |
| Frontend Framework | React | 19.x | Functional components only |
| Frontend Routing | React Router | v7 | `createBrowserRouter` API |
| UI Components | shadcn/ui | Latest | Radix UI + Tailwind CSS v4 |
| Styling | Tailwind CSS | v4.x | `@tailwindcss/vite`; config in CSS via `@theme` |
| Authentication | JWT | — | `jsonwebtoken` (BE) + Axios interceptors (FE) |
| Form Validation (FE) | React Hook Form + Zod | Latest | All forms use this combination |
| Input Validation (BE) | Zod | Latest | Middleware validation before every controller |
| HTTP Client (FE) | Axios | Latest | Centralized instance with JWT interceptor |
| Toast Notifications | Sileo | Latest | Spring-physics toasts; no `alert()` anywhere |
| Email | Nodemailer + Resend SMTP | Latest | Async via `setImmediate()`; never blocks HTTP |
| Build Tool (FE) | Vite | 7.x | Requires Node.js 22.12+ |
| File Upload | Multer | Latest | Logo/document uploads |
| Color Extraction | color-thief-node | Latest | Server-side accent extraction from logos |
| State Management (FE) | Zustand | Latest | Auth store, settings store, sidebar store |

### Repository Structure

```
/
├── pnpm-workspace.yaml
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/        # auth, loginToken, validation, error, audit
│   │   ├── routes/
│   │   ├── services/
│   │   ├── validators/
│   │   └── app.ts
│   └── server.ts
│
└── client/
    ├── src/
    │   ├── api/               # Axios instance + API call functions
    │   ├── components/        # Shared UI components (.tsx)
    │   ├── hooks/
    │   ├── layouts/           # AppLayout.tsx, GuestLayout.tsx, AuthLayout.tsx
    │   ├── pages/
    │   │   ├── admission/     # Apply.tsx, F2FAdmission.tsx, TrackApplication.tsx
    │   │   ├── dashboard/
    │   │   ├── applications/
    │   │   ├── students/      # SIMS: Index.tsx, Profile.tsx
    │   │   ├── teachers/      # Teacher Mgmt: Index.tsx, Profile.tsx
    │   │   ├── sections/
    │   │   ├── audit/
    │   │   └── settings/
    │   ├── router/            # index.tsx + navigationRef.ts
    │   └── stores/
    ├── vite.config.ts
    └── index.html
```

---

## 3. Design System & Visual Identity

### 3.1 Typography

**Font:** `Instrument Sans` — loaded from Bunny Fonts exclusively.

```html
<!-- client/index.html -->
<link rel="preconnect" href="https://fonts.bunny.net" />
<link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600,700&display=swap" rel="stylesheet"/>
```

```css
/* client/src/index.css */
@import "tailwindcss";
@theme {
  --font-sans: 'Instrument Sans', ui-sans-serif, system-ui;
}
```

Apply `font-sans` as a base class on `<body>` globally.

### 3.2 Dynamic Color Scheme System

**Two-layer model:**

| Layer | Role | Behavior |
|---|---|---|
| Main (White) | Page backgrounds, surfaces, cards | Permanent — never changes |
| Accent (Blue → Logo-derived) | Buttons, active states, focus rings, sidebar highlights | Default blue; replaced by dominant color from the uploaded school logo |

#### Default CSS Tokens

```css
:root {
  /* ─── PERMANENT MAIN LAYER — never overridden ─── */
  --background:         0 0% 100%;
  --foreground:         222 47% 11%;
  --muted:              220 14% 96%;
  --muted-foreground:   215 16% 47%;
  --border:             220 13% 91%;
  --card:               0 0% 100%;
  --card-foreground:    222 47% 11%;
  --popover:            0 0% 100%;
  --popover-foreground: 222 47% 11%;

  /* ─── DEFAULT ACCENT LAYER — blue; overridden on logo upload ─── */
  --accent:             221 83% 53%;
  --accent-foreground:  0 0% 100%;
  --accent-muted:       213 97% 94%;
  --accent-ring:        221 83% 53%;

  /* shadcn/ui semantic aliases — point to accent tokens */
  --primary:            var(--accent);
  --primary-foreground: var(--accent-foreground);
  --ring:               var(--accent-ring);
}
```

> **Rule:** `--primary` and `--ring` are intentional aliases for `--accent`. All shadcn/ui components auto-reflect the school's brand color without any component-level changes.

### 3.3 Visual Design Principles

| Principle | Requirement |
|---|---|
| Minimal Chrome | No decorative gradients; `shadow-sm` on cards/modals only |
| High Contrast | All text passes WCAG AA (4.5:1 ratio minimum) |
| Consistent Spacing | Tailwind spacing scale exclusively |
| Fully Responsive | Every page functional at ≥320px |
| shadcn/ui Only | Use `Card`, `Table`, `Dialog`, `Badge`, `Select`, `Input`, `Button`, `Switch`, `Tabs`; do not build custom primitives |
| Sidebar Navigation | Dashboard uses collapsible left sidebar; hamburger `Sheet` on mobile |
| Status Badges | PENDING → yellow · APPROVED → green · REJECTED → red — use `Badge` variant `"outline"` |
| Empty States | Every table must have icon + message + optional CTA |
| Loading States | Skeleton from shadcn/ui during all API fetches |
| Toast Notifications | Sileo exclusively; never `alert()` or inline banners |

### 3.4 Responsive Design

| Breakpoint | Prefix | Min Width | Devices |
|---|---|---|---|
| Mobile | (default) | 320px | Phones |
| Tablet | `md:` | 768px | Tablets |
| Desktop | `lg:` | 1024px | Laptops |
| Wide | `xl:` | 1280px | Large monitors |

**Sidebar:** `< lg` → hamburger Sheet drawer · `≥ lg` → fixed left panel (`w-64`), collapsible to icon-only (`w-16`).

---

## 4. User Roles & Permissions

```
SYSTEM_ADMIN
  └─ Inherits all REGISTRAR capabilities
     + User management
     + Email delivery logs
     + System health diagnostics
     + Full cross-user audit log access

REGISTRAR
  └─ Full enrollment operations
     Online/F2F Admission · Enrollment Management
     SIMS · Teacher Management
     Sections · Settings · Audit Logs
```

| Capability | REGISTRAR | SYSTEM_ADMIN |
|---|---|---|
| Submit online admission (public portal) | N/A | N/A |
| Enter F2F (walk-in) admission | ✅ | ✅ |
| View & process applications | ✅ | ✅ |
| Approve / Reject applications | ✅ | ✅ |
| Manage enrollments | ✅ | ✅ |
| View full SIMS student profiles | ✅ | ✅ |
| Edit student information | ✅ | ✅ |
| Manage grade levels & strands | ✅ | ✅ |
| Manage SCP program configurations | ✅ | ✅ |
| Manage sections (CRUD) | ✅ | ✅ |
| Manage teacher records | ✅ | ✅ |
| Manage system settings | ✅ | ✅ |
| View audit logs | ✅ (partial) | ✅ (full) |
| Create / deactivate user accounts | ❌ | ✅ |
| Reset user passwords | ❌ | ✅ |
| View email delivery logs | ❌ | ✅ |
| View system health | ❌ | ✅ |
| Assign SYSTEM_ADMIN role | ❌ | ❌ (CLI/seed only) |
| Delete audit logs | ❌ | ❌ (no one can) |
| Delete enrollment records | ❌ | ❌ (no one can) |

---

## 5. Database Schema — Prisma

```prisma
// server/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ────────────────────────────────────────────────────────────

enum Role {
  REGISTRAR
  SYSTEM_ADMIN
}

enum Sex {
  MALE
  FEMALE
}

enum ApplicationStatus {
  PENDING
  EXAM_SCHEDULED
  EXAM_TAKEN
  PASSED
  FAILED
  APPROVED
  REJECTED
  ENROLLED
}

enum AdmissionChannel {
  ONLINE      // submitted via the public /apply portal
  F2F         // entered by registrar on behalf of a walk-in applicant
}

enum LearnerType {
  NEW_ENROLLEE
  TRANSFEREE
  RETURNING    // Balik-Aral
  CONTINUING   // existing student moving up a grade
}

// ─── Auth & Pre-flight Token ──────────────────────────────────────────

model User {
  id                 Int        @id @default(autoincrement())
  name               String
  email              String     @unique
  password           String     // bcrypt hash, 12 rounds
  role               Role
  isActive           Boolean    @default(true)
  mustChangePassword Boolean    @default(true)
  lastLoginAt        DateTime?
  createdById        Int?
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt

  enrollments        Enrollment[]
  auditLogs          AuditLog[]
  createdBy          User?      @relation("UserCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  createdUsers       User[]     @relation("UserCreatedBy")
}

// One-time pre-flight token; consumed on every POST /auth/login call (Layer 2)
model LoginToken {
  id        Int       @id @default(autoincrement())
  token     String    @unique   // SHA-256 hash of the raw token sent to client
  expiresAt DateTime
  usedAt    DateTime?
  ipAddress String?   @db.VarChar(45)
  createdAt DateTime  @default(now())

  @@index([token])
}

// ─── School Configuration ─────────────────────────────────────────────

model SchoolSettings {
  id                   Int           @id @default(autoincrement())
  schoolName           String
  schoolId             String?       // DepEd School ID (configurable per school)
  division             String?       // e.g. "Schools Division of Negros Occidental"
  region               String?       // e.g. "Region VI - Western Visayas"
  logoPath             String?
  logoUrl              String?
  colorScheme          Json?         // { accent_hsl: "221 83% 53%", extracted_at: "..." }
  enrollmentOpen       Boolean       @default(false)
  activeAcademicYearId Int?
  admissionChannels    String[]      @default(["ONLINE", "F2F"])

  activeAcademicYear   AcademicYear? @relation(fields: [activeAcademicYearId], references: [id])
}

// ─── Academic Structure ───────────────────────────────────────────────

model AcademicYear {
  id           Int              @id @default(autoincrement())
  yearLabel    String           @unique  // e.g. "2025-2026"
  isActive     Boolean          @default(false)
  classStart   DateTime?
  classEnd     DateTime?
  phase1Start  DateTime?        // Early Registration start
  phase1End    DateTime?        // Early Registration end
  phase2Start  DateTime?        // Regular Enrollment start
  phase2End    DateTime?        // Regular Enrollment end
  createdAt    DateTime         @default(now())

  gradeLevels    GradeLevel[]
  strands        Strand[]
  scpPrograms    ScpProgram[]
  applicants     Applicant[]
  enrollments    Enrollment[]
  SchoolSettings SchoolSettings[]
}

model GradeLevel {
  id              Int          @id @default(autoincrement())
  name            String       // e.g. "Grade 7", "Grade 11" — school-configurable
  displayOrder    Int
  requiresEarlyReg Boolean     @default(false)  // Grade 7, 11, transferees per DepEd policy
  academicYearId  Int
  createdAt       DateTime     @default(now())

  academicYear    AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  sections        Section[]
  applicants      Applicant[]
}

model Strand {
  id                      Int          @id @default(autoincrement())
  name                    String       // e.g. "STEM", "ABM", "HUMSS", "GAS"
  track                   String?      // e.g. "Academic", "TechPro" — school-configurable
  applicableGradeLevelIds Int[]
  academicYearId          Int
  createdAt               DateTime     @default(now())

  academicYear            AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  applicants              Applicant[]
}

// SCP programs are fully configurable — schools add only the ones they offer
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

// ─── Teacher ──────────────────────────────────────────────────────────

model Teacher {
  id              Int       @id @default(autoincrement())
  employeeId      String?   @unique  // DepEd Employee ID (optional but recommended)
  firstName       String
  lastName        String
  middleName      String?
  contactNumber   String?
  specialization  String?   // e.g. "Mathematics", "Science"
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  sections        Section[]
}

// ─── Sections ────────────────────────────────────────────────────────

model Section {
  id                Int       @id @default(autoincrement())
  name              String    // e.g. "Rizal", "Bonifacio" — school-configurable
  maxCapacity       Int       @default(40)
  gradeLevelId      Int
  advisingTeacherId Int?      // links to Teacher.id
  scpCode           String?   // if this section is a designated SCP section (e.g. "STE")
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  gradeLevel        GradeLevel  @relation(fields: [gradeLevelId], references: [id], onDelete: Cascade)
  advisingTeacher   Teacher?    @relation(fields: [advisingTeacherId], references: [id], onDelete: SetNull)
  enrollments       Enrollment[]
}

// ─── Applicants ──────────────────────────────────────────────────────

model Applicant {
  id Int @id @default(autoincrement())

  // Identity
  lrn          String   @unique @db.VarChar(12)
  lastName     String
  firstName    String
  middleName   String?
  suffix       String?
  birthDate    DateTime
  sex          Sex
  birthPlace   String?
  nationality  String?  @default("Filipino")
  religion     String?
  motherTongue String?

  // Classifications
  learnerType            LearnerType @default(NEW_ENROLLEE)
  isIndigenousPeople     Boolean     @default(false)
  ipCommunity            String?
  is4PsBeneficiary       Boolean     @default(false)
  householdId            String?
  isPersonWithDisability Boolean     @default(false)
  disabilityType         String?

  // Address
  address      String
  barangay     String?
  municipality String?
  province     String?

  // Family / Contact
  fatherName         String?
  fatherOccupation   String?
  motherName         String?
  motherOccupation   String?
  guardianName       String
  guardianRelationship String?
  guardianContact    String
  emailAddress       String

  // Previous School
  lastSchoolAttended  String?
  lastSchoolYear      String?
  lastGradeCompleted  String?
  generalAverage      Float?

  // Admission metadata
  admissionChannel    AdmissionChannel @default(ONLINE)
  applicantType       String           @default("REGULAR")  // REGULAR | STE | SPA | SPS | SPJ | SPFL | SPTVE | STEM_GRADE11
  scpProgramCode      String?          // mirrors ScpProgram.code
  trackingNumber      String           @unique
  status              ApplicationStatus @default(PENDING)
  rejectionReason     String?
  encodedById         Int?             // for F2F: User.id of the registrar who entered it
  privacyConsentGiven Boolean          @default(false)

  // SCP Assessment
  examDate        DateTime?
  assessmentType  String?
  examScore       Float?
  examResult      String?   // "PASSED" | "FAILED"
  examNotes       String?
  auditionResult  String?   // "CLEARED" | "NOT_CLEARED"
  interviewDate   DateTime?
  interviewResult String?   // "CLEARED" | "NOT_CLEARED"
  natScore        Float?
  grade10ScienceGrade Float?
  grade10MathGrade    Float?

  // SCP-specific detail fields (school-configurable via settings)
  artField         String?   // for SPA
  sport            String?   // for SPS
  foreignLanguage  String?   // for SPFL

  gradeLevelId   Int
  strandId       Int?
  academicYearId Int
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  gradeLevel   GradeLevel   @relation(fields: [gradeLevelId], references: [id])
  strand       Strand?      @relation(fields: [strandId], references: [id])
  academicYear AcademicYear @relation(fields: [academicYearId], references: [id])
  enrollment   Enrollment?

  @@index([status, academicYearId])
  @@index([lrn])
  @@index([applicantType, status])
  @@index([admissionChannel])
}

// ─── Enrollment ──────────────────────────────────────────────────────

model Enrollment {
  id             Int      @id @default(autoincrement())
  applicantId    Int      @unique   // one enrollment per applicant
  sectionId      Int
  academicYearId Int
  enrolledAt     DateTime @default(now())
  enrolledById   Int

  applicant    Applicant    @relation(fields: [applicantId], references: [id], onDelete: Cascade)
  section      Section      @relation(fields: [sectionId], references: [id], onDelete: Restrict)
  academicYear AcademicYear @relation(fields: [academicYearId], references: [id])
  enrolledBy   User         @relation(fields: [enrolledById], references: [id])
}

// ─── Audit Log ────────────────────────────────────────────────────────

model AuditLog {
  id          Int      @id @default(autoincrement())
  userId      Int?
  actionType  String
  description String
  subjectType String?
  subjectId   Int?
  ipAddress   String   @db.VarChar(45)
  userAgent   String?
  createdAt   DateTime @default(now())

  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([actionType])
  @@index([createdAt])
}
```

---

## 6. Core Modules

---

### 6.1 Online Admission Portal

**Route:** `/apply` — public, unauthenticated
**Page:** `client/src/pages/admission/Apply.tsx`
**Gate:** React Router loader redirects to `/closed` if `settings.enrollmentOpen = false`

#### Multi-Step Wizard (7 steps)

| Step | Title | Key Content |
|---|---|---|
| 0 | Privacy Notice & Consent | RA 10173 notice; checkbox + confirm before form unlocks |
| 1 | Personal Information | Name, LRN, birthdate, sex, birthplace, religion, mother tongue |
| 2 | Family & Contact | Father/mother/guardian info, contact number, email |
| 3 | Background & Classification | Learner type, 4Ps, IP status, PWD status |
| 4 | Previous School | Last school attended, last grade, general average |
| 5 | Enrollment Preferences | Grade level, SCP selection (dynamic), strand (if SHS) |
| 6 | Review & Submit | Summary of all entries, submit button |

**SCP options in Step 5 load dynamically** from `GET /api/scp-programs?gradeLevelId=X` for the active academic year. A school that does not offer SPA simply will not have it in the list. There is no hardcoded SCP enum in the frontend.

On success: form replaced by a **Success Panel** showing the tracking number in a copyable display. Email sent asynchronously.

---

### 6.2 Face-to-Face (F2F) Admission

**Route:** `/f2f-admission` — requires JWT, role: REGISTRAR or SYSTEM_ADMIN
**Page:** `client/src/pages/admission/F2FAdmission.tsx`

The F2F admission form is the **registrar-facing equivalent** of the public portal, used when a student or parent walks in to apply in person. The registrar fills all fields on the applicant's behalf.

**Key differences from online admission:**

| Aspect | Online | F2F |
|---|---|---|
| Enrollment gate | Redirects to `/closed` when OFF | Always accessible (registrar override) |
| `admissionChannel` stored | `ONLINE` | `F2F` |
| `encodedById` | null | Registrar's `User.id` |
| Privacy consent | Applicant checks on screen | Registrar confirms physical signature checkbox |
| Email delivery | Always attempted | Attempted if `emailAddress` provided |
| Fast-track option | Not available | Registrar may set initial status to `APPROVED` if documents are complete at submission |
| Tracking number delivery | On-screen + email | On-screen (registrar prints or writes down) + email if address provided |

All the same validation rules, SCP conditional fields, and strand selection logic apply identically.

**Sidebar:** "Walk-in Admission" (`UserPlus` icon) appears in the Admission section for REGISTRAR and SYSTEM_ADMIN.

---

### 6.3 Registrar Administration Dashboard

**Route:** `/dashboard` — requires JWT, role: REGISTRAR or SYSTEM_ADMIN
**Page:** `client/src/pages/dashboard/Index.tsx`
**API:** `GET /api/dashboard/stats`

#### Stat Cards

| Card | Icon | Data Source |
|---|---|---|
| Total Pending | `Clock` | COUNT applicants WHERE status = PENDING AND activeAY |
| Total Enrolled | `UserCheck` | COUNT enrollments for activeAY |
| Approved Awaiting | `Hourglass` | COUNT applicants WHERE status = APPROVED AND activeAY |
| Sections at Capacity | `AlertCircle` | COUNT sections WHERE enrolled_count >= maxCapacity |

#### Charts (Recharts)

- Enrollment by Grade Level — `BarChart` (horizontal)
- Application Status Distribution — `PieChart` (donut)
- Admission Channel Breakdown — `PieChart` (Online vs F2F)

#### SCP Pipeline Panel

Shown only when the school has configured and activated SCP programs. Displays PENDING / EXAM_SCHEDULED / EXAM_TAKEN / PASSED / FAILED counts per SCP program code for the active year. Collapses gracefully if no SCP programs are configured.

#### Recent Activity Feed

Last 10 `AuditLog` entries in a timeline-style `Card` (reverse chronological).

---

### 6.4 Enrollment Management

**Routes:**
- `/applications` — paginated application inbox
- `/applications/:id` — application detail and workflow

**Pages:** `client/src/pages/applications/Index.tsx` · `[id].tsx`

#### Application Inbox

**Filters:** Academic year · Grade level · Applicant type (all configured SCP codes + REGULAR) · Status (all values including SCP-specific) · Admission channel (Online / F2F)

**Search:** LRN (exact 12 digits) or name (300ms debounce, no full reload)

**Pagination:** 15 per page

**Columns:** # · Applicant Name · LRN · Grade · Type/Track · Status · Channel · Date · Actions

#### Two-Path Approval Workflow

**Path A — Regular Admission:**
```
PENDING → [Verify Docs → Approve & Assign Section] → APPROVED → ENROLLED
```

**Path B — SCP Admission** (adapts to the program's configured `assessmentType`):
```
PENDING → EXAM_SCHEDULED → EXAM_TAKEN → PASSED/FAILED
  PASSED  → [Assign Section] → APPROVED → ENROLLED
  FAILED  → [Offer Regular Section (optional)] → APPROVED → ENROLLED
          OR → REJECTED
```

Action buttons displayed per applicant are **conditional on `applicantType` and current `status`** — the registrar never sees inapplicable buttons.

#### Section Assignment Dialog

When approving, a dialog lists available sections for the applicant's grade level. Each section shows `enrolled / maxCapacity`. Full sections are disabled. The system uses a `FOR UPDATE` row lock (raw SQL within a Prisma transaction) to prevent race conditions on the last available slot.

---

### 6.5 Student Information Management System (SIMS)

**Routes:**
- `/students` — paginated, searchable student directory
- `/students/:id` — full tabbed student profile

**Pages:** `client/src/pages/students/Index.tsx` · `Profile.tsx`

The SIMS is the **permanent records module** — every student who has ever applied or enrolled in this school system has a record here, across all academic years.

#### Student Directory (`/students`)

**Search:** LRN (300ms debounce) or name
**Filters:** Grade level · Section · Academic year · Enrollment status · Admission channel

**Columns:** LRN · Full Name · Grade · Section · Admission Channel · Status · Actions (View · Edit)

#### Student Profile (`/students/:id`) — 4 tabs

**Tab 1 — Personal Information**
All demographic fields from the `Applicant` model. Editable by REGISTRAR and SYSTEM_ADMIN. Edit mode shows a form with Save/Cancel buttons. All changes write an `AuditLog` entry with `actionType: STUDENT_RECORD_UPDATED` listing changed field names.

LRN is immutable after record creation (displayed as read-only).

**Tab 2 — Academic History**
Chronological list of all enrollments across academic years:
- Academic Year · Grade Level · Section · Date Enrolled · Enrolled By
- General average carried from previous school (if any)
- Transfer records (if applicable)

**Tab 3 — Application Record**
- Original application details: channel, tracking number, submission date
- SCP assessment records (if applicable): dates, scores, results, notes
- Status timeline (derived from AuditLog entries for this applicant's ID)

**Tab 4 — Classifications & Special Programs**
- Learner type badge (New Enrollee / Transferee / Returning / Continuing)
- IP community status
- 4Ps beneficiary status + household ID
- PWD status + disability type
- Current SCP designation (if enrolled in an SCP section)

**Editing rules:**
- Status changes must go through the proper workflow (no direct override to ENROLLED without a section)
- Sensitive classification fields (4Ps, IP, PWD) trigger an additional confirmation dialog before saving
- All edits are reversible via audit log review but not automatically undone

---

### 6.6 Teacher Management

**Routes:**
- `/teachers` — teacher directory
- `/teachers/:id` — teacher profile

**Pages:** `client/src/pages/teachers/Index.tsx` · `Profile.tsx`

#### Teacher Directory (`/teachers`)

**Columns:** Employee ID · Full Name · Specialization · Assigned Sections (count) · Actions (View · Edit)

**Create Teacher:** Opens a modal/sheet with fields: Last Name, First Name, Middle Name, Employee ID (optional), Contact Number, Specialization.

#### Teacher Profile (`/teachers/:id`) — 2 tabs

**Tab 1 — Profile**
Fields: Full name, Employee ID, Contact Number, Specialization. Editable by REGISTRAR and SYSTEM_ADMIN.

**Tab 2 — Assigned Sections**
All sections currently assigned to this teacher for the active academic year:
- Grade Level · Section Name · Enrolled Count / Max · Academic Year

"Unassign" removes the teacher from that section (confirmation dialog; audit logged as `SECTION_UPDATED`).

---

### 6.7 Grade Level & Sectioning Management

**Route:** `/sections` — requires JWT, role: REGISTRAR or SYSTEM_ADMIN
**Page:** `client/src/pages/sections/Index.tsx`

#### Section List View

Grouped by grade level. Each section displayed as a card with:
- Section name · Enrolled count / Max capacity · Advising teacher (or "Unassigned")
- Capacity bar: green < 80% · amber 80–99% · red 100%
- SCP designation badge (if applicable)
- Actions: Edit · Delete

**Create Section dialog:**
- Name (free text)
- Grade Level (dynamic dropdown — loaded from active AY's grade levels)
- Max Capacity (numeric, default 40, minimum 1)
- Advising Teacher (searchable dropdown from Teacher directory — shows Employee ID + Name)
- SCP Code (optional dropdown — loaded from active AY's SCP programs)

**Edit Section:** Same fields. Cannot reduce `maxCapacity` below current enrolled count (returns `422`).

**Delete Section:** Blocked if any `Enrollment` records reference this section. The UI shows a blocking message listing how many enrolled students must be reassigned first.

#### Teacher Assignment to Sections

Advising teacher assignment is driven by the Teacher model, not the User model directly. This ensures only teachers with complete profiles can be assigned. One teacher can advise multiple sections across grade levels.

---

### 6.8 Academic Year Configuration

**Route:** `/settings` — requires JWT, role: REGISTRAR or SYSTEM_ADMIN
**Page:** `client/src/pages/settings/Index.tsx`

#### Tab 1 — School Profile

Fields: School Name · School ID (DepEd) · Division · Region · Logo Upload.

Logo upload triggers server-side accent color extraction. Extracted HSL is stored in `SchoolSettings.colorScheme` and returned via `GET /api/settings/public`. All instances of the school name across the UI and emails source from this record.

#### Tab 2 — Academic Year

Create, activate, and archive academic years.

**Smart Auto-Fill:** When the registrar types a year label (e.g., "2026-2027"), the system auto-calculates:
- Class opening (first Monday of June)
- Class end (March 31)
- Phase 1 Early Registration dates (last Saturday of January → last Friday of February)
- Phase 2 Regular Enrollment dates (~1 week before class opening)

Registrar confirms or adjusts the auto-filled dates before saving.

Only one academic year can be `isActive = true` at a time. Activating a new year deactivates the previous one.

#### Tab 3 — Grade Levels, Strands & SCP Programs

Three sub-tabs:

**Grade Levels:** CRUD within the active AY. Each grade level has a `requiresEarlyReg` toggle. Display order determines how they appear in dropdowns and tables. Schools with non-standard grade level names (e.g., "Kindergarten Preparatory") can configure them here.

**Strands & Tracks:** CRUD. Each strand links to one or more grade levels and a track label. Schools that offer only JHS (no SHS) simply have no strands configured.

**SCP Programs:** CRUD. Each program entry has:
- Code (short identifier used in filters and badges)
- Full name (displayed in the admission form)
- Applicable grade levels
- Assessment type (drives the SCP workflow)
- Requires interview toggle
- Active / Inactive toggle

**A school that offers only Regular admission leaves this sub-tab empty.** The admission form will show no SCP options. The F2F form behaves identically.

#### Tab 4 — Enrollment Gate

Large, clearly labeled toggle for `enrollmentOpen`. When OFF, the public `/apply` portal redirects all visitors to `/closed`. The F2F route (`/f2f-admission`) is unaffected by this gate. Displays current state and the last time it was toggled.

---

### 6.9 System Audit Trail & Activity Logging

**Route:** `/audit-logs`
**Page:** `client/src/pages/audit/Index.tsx`

All significant actions write an immutable `AuditLog` record. No delete endpoint exists. Logs cannot be cleared or purged through the UI.

**REGISTRAR** sees own actions and system-level events.
**SYSTEM_ADMIN** sees all users' actions with a user filter dropdown.

**Filterable by:** action type · date range · user (admin only) · subject type

#### Complete Action Type Reference

| actionType | Template |
|---|---|
| `USER_LOGIN` | User [email] logged in from [IP] |
| `USER_LOGOUT` | User [email] logged out |
| `APPLICATION_SUBMITTED` | Online application submitted — Tracking #[n], Applicant: [name] |
| `F2F_APPLICATION_ENTERED` | F2F application entered by [user] for [name], Tracking #[n] |
| `APPLICATION_APPROVED` | [user] approved [name] → Section [section] |
| `APPLICATION_REJECTED` | [user] rejected [name] — Reason: [text] |
| `EXAM_SCHEDULED` | [user] scheduled [assessmentType] for [name] on [date] |
| `EXAM_RESULT_RECORDED` | [user] recorded result for [name]: [result] (Score: [score]) |
| `APPLICATION_PASSED` | [user] marked [name] as PASSED |
| `APPLICATION_FAILED` | [user] marked [name] as FAILED. Notes: [notes] |
| `STUDENT_RECORD_UPDATED` | [user] updated record for LRN [lrn] — Changed: [fieldList] |
| `ENROLLMENT_GATE_TOGGLED` | [user] toggled enrollment gate to [OPEN/CLOSED] |
| `SECTION_CREATED` | [user] created section [name] for [grade] (cap: [n]) |
| `SECTION_UPDATED` | [user] updated section [name] |
| `SECTION_DELETED` | [user] deleted section [name] |
| `TEACHER_CREATED` | [user] added teacher [name] (EmpID: [id]) |
| `TEACHER_UPDATED` | [user] updated teacher [name] |
| `TEACHER_ACCOUNT_PROVISIONED` | [user] provisioned login account for teacher [name] |
| `ACADEMIC_YEAR_CREATED` | [user] created AY [label] |
| `ACADEMIC_YEAR_ACTIVATED` | [user] activated AY [label] |
| `SCHOOL_SETTINGS_UPDATED` | [user] updated school profile — Changed: [fields] |
| `ADMIN_USER_CREATED` | Admin [name] created account for [email] (role: [role]) |
| `ADMIN_USER_DEACTIVATED` | Admin [name] deactivated account [email] |
| `ADMIN_PASSWORD_RESET` | Admin [name] reset password for [email] |

---

### 6.10 Automated Email Notification System

All emails dispatched asynchronously via `setImmediate()`. The HTTP response is always sent before the email fires.

**Email templates use `SchoolSettings.schoolName` at send time — never a hardcoded school name.**

| Trigger | Subject Template |
|---|---|
| Online application submitted | `Your Application Has Been Received — #[tracking] · [schoolName]` |
| F2F application entered | `Your Walk-in Application Has Been Recorded — #[tracking] · [schoolName]` |
| Exam/Assessment scheduled | `Your [programName] Assessment Date — [schoolName]` |
| Assessment passed | `Congratulations! You Passed the Assessment — [schoolName]` |
| Assessment failed | `Update on Your [programName] Application — [schoolName]` |
| Enrollment confirmed | `Your Enrollment is Confirmed — [schoolName], SY [yearLabel]` |
| Application rejected | `Update on Your Application to [schoolName]` |
| Teacher account provisioned | `Welcome to [schoolName] — Your System Account Details` |

```ts
// server/src/controllers/applicationController.ts
export async function store(req, res) {
  const applicant = await applicationService.create(req.body);
  res.status(201).json({ trackingNumber: applicant.trackingNumber });
  setImmediate(async () => {
    try {
      await mailer.sendApplicationReceived(applicant);
    } catch (err) {
      console.error('[Email Error]', err.message);
    }
  });
}
```

---

## 7. REST API Contracts

All endpoints prefixed with `/api`. All responses `Content-Type: application/json`.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/login-token` | None | Issues 5-min pre-flight token (rate-limited) |
| `POST` | `/auth/login` | loginToken in body | Returns JWT + user object |
| `GET` | `/auth/me` | JWT | Current authenticated user |
| `POST` | `/auth/change-password` | JWT | Change password (required on first login) |

### Public (No Auth Required)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/settings/public` | School name, logo, colorScheme, enrollmentOpen, activeAY |
| `GET` | `/grade-levels` | Grade levels for active AY |
| `GET` | `/strands?gradeLevelId=` | Strands for a grade level |
| `GET` | `/scp-programs?gradeLevelId=` | Active, configured SCP programs (dynamic) |
| `POST` | `/applications` | Submit online admission |
| `GET` | `/applications/track/:trackingNumber` | Status lookup by tracking number |

### Registrar + System Admin (JWT required)

**Dashboard:**
`GET /dashboard/stats` — stat card data, chart data, SCP pipeline counts

**Applications / Enrollment:**
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/applications` | Paginated + filterable list |
| `GET` | `/applications/:id` | Single application detail |
| `POST` | `/applications/f2f` | Enter F2F walk-in application |
| `PATCH` | `/applications/:id/approve` | Approve + assign section |
| `PATCH` | `/applications/:id/reject` | Reject with optional reason |
| `PATCH` | `/applications/:id/schedule-exam` | SCP: schedule assessment |
| `PATCH` | `/applications/:id/record-result` | SCP: record result |
| `PATCH` | `/applications/:id/pass` | SCP: mark PASSED |
| `PATCH` | `/applications/:id/fail` | SCP: mark FAILED |

**SIMS:**
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/students` | Paginated, searchable list |
| `GET` | `/students/:id` | Full student profile |
| `PUT` | `/students/:id` | Update student record (audit logged) |
| `GET` | `/students/:id/history` | All enrollment records across AYs |

**Teacher Management:**
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/teachers` | Paginated teacher directory |
| `POST` | `/teachers` | Create teacher profile |
| `GET` | `/teachers/:id` | Profile + sections |
| `PUT` | `/teachers/:id` | Update teacher profile |

**Sections:**
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/sections` | All sections with enrolled count |
| `POST` | `/sections` | Create section |
| `PUT` | `/sections/:id` | Update section |
| `DELETE` | `/sections/:id` | Delete (blocked if enrollments exist) |
| `PATCH` | `/sections/:id/assign-teacher` | Assign advising teacher |

**Academic Year / Grade Levels / Strands / SCP:**
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/academic-years` | All academic years |
| `POST` | `/academic-years` | Create AY (auto-calculates dates) |
| `PUT` | `/academic-years/:id` | Update AY |
| `PATCH` | `/academic-years/:id/activate` | Set as active |
| `GET/POST/PUT/DELETE` | `/grade-levels/*` | Grade level CRUD |
| `GET/POST/PUT/DELETE` | `/strands/*` | Strand CRUD |
| `GET` | `/scp-programs/all` | All SCP programs for active AY |
| `POST` | `/scp-programs` | Create SCP program config |
| `PUT` | `/scp-programs/:id` | Update SCP program |
| `PATCH` | `/scp-programs/:id/toggle` | Activate / deactivate |

**Settings:**
| Method | Endpoint | Description |
|---|---|---|
| `PUT` | `/settings/identity` | School name, ID, division, region |
| `POST` | `/settings/logo` | Upload logo + trigger color extraction |
| `PATCH` | `/settings/enrollment-gate` | Toggle open/closed |

**Audit:**
`GET /audit-logs` — paginated, filterable

### System Admin Only (JWT + role: SYSTEM_ADMIN)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/users` | All system accounts |
| `POST` | `/admin/users` | Create REGISTRAR account |
| `PUT` | `/admin/users/:id` | Update user details |
| `PATCH` | `/admin/users/:id/deactivate` | Deactivate account |
| `PATCH` | `/admin/users/:id/reset-password` | Admin password reset |
| `GET` | `/admin/email-logs` | Email delivery log |
| `GET` | `/admin/system` | System health diagnostics |

### Standard Error Response

```json
{
  "message": "Human-readable error description",
  "errors": {
    "fieldName": ["Validation message"]
  }
}
```

HTTP codes: `200` · `201` · `400` · `401` · `403` · `404` · `422` · `500`

---

## 8. Frontend Routing Structure

```tsx
// client/src/router/index.tsx

export const router = createBrowserRouter([

  // ── Public routes ───────────────────────────────────────────────────
  {
    path: '/',
    loader: async () => {
      const { enrollmentOpen } = await fetchPublicSettings();
      return redirect(enrollmentOpen ? '/apply' : '/closed');
    },
  },
  {
    path: '/apply',
    element: <GuestLayout><Apply /></GuestLayout>,
    loader: async () => {
      const settings = await fetchPublicSettings();
      if (!settings.enrollmentOpen) return redirect('/closed');
      return settings;
    },
  },
  { path: '/closed',                element: <GuestLayout><EnrollmentClosed /></GuestLayout> },
  { path: '/track/:trackingNumber', element: <GuestLayout><TrackApplication /></GuestLayout> },

  // ── Login — TWO-LAYER GATE ──────────────────────────────────────────
  // Layer 1: loader inspects history state; direct URL visits bounce to /
  {
    path: '/login',
    loader: () => {
      const state = window.history.state?.usr;  // RR v7 writes navigate() state under .usr
      if (!state?.loginAccess) return redirect('/');
      return null;
    },
    element: <AuthLayout><Login /></AuthLayout>,
  },

  // Forced password change (accessible after first login)
  { path: '/change-password', element: <AuthLayout><ChangePassword /></AuthLayout> },

  // ── Protected — Registrar + System Admin ────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['REGISTRAR', 'SYSTEM_ADMIN']} />,
    children: [
      { path: '/dashboard',          element: <AppLayout><Dashboard /></AppLayout> },
      { path: '/f2f-admission',      element: <AppLayout><F2FAdmission /></AppLayout> },
      { path: '/applications',       element: <AppLayout><Applications /></AppLayout> },
      { path: '/applications/:id',   element: <AppLayout><ApplicationDetail /></AppLayout> },
      { path: '/students',           element: <AppLayout><Students /></AppLayout> },
      { path: '/students/:id',       element: <AppLayout><StudentProfile /></AppLayout> },
      { path: '/teachers',           element: <AppLayout><Teachers /></AppLayout> },
      { path: '/teachers/:id',       element: <AppLayout><TeacherProfile /></AppLayout> },
      { path: '/sections',           element: <AppLayout><Sections /></AppLayout> },
      { path: '/audit-logs',         element: <AppLayout><AuditLogs /></AppLayout> },
      { path: '/settings',           element: <AppLayout><Settings /></AppLayout> },
    ],
  },

  // ── System Admin only ────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['SYSTEM_ADMIN']} />,
    children: [
      { path: '/admin/users',        element: <AppLayout><UserManagement /></AppLayout> },
      { path: '/admin/email-logs',   element: <AppLayout><EmailLogs /></AppLayout> },
      { path: '/admin/system',       element: <AppLayout><SystemHealth /></AppLayout> },
    ],
  },

  // ── Fallback ──────────────────────────────────────────────────────────
  { path: '*', element: <NotFound /> },
]);
```

### navigationRef Singleton (required for Axios 401 interceptor redirect)

```ts
// client/src/router/navigationRef.ts
import { NavigateFunction } from 'react-router-dom';

let _navigate: NavigateFunction | null = null;
export const setNavigate = (fn: NavigateFunction) => { _navigate = fn; };
export const getNavigate = () => _navigate!;
```

```tsx
// client/src/layouts/AppLayout.tsx
import { useNavigate } from 'react-router-dom';
import { setNavigate } from '@/router/navigationRef';
import { useEffect } from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  useEffect(() => { setNavigate(navigate); }, [navigate]);
  // ... rest of layout
}
```

```ts
// client/src/api/axiosInstance.ts
import { getNavigate } from '@/router/navigationRef';
import { useAuthStore } from '@/stores/authStore';

axiosInstance.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      const navigate = getNavigate();
      if (navigate) navigate('/login', { state: { loginAccess: true } });
    }
    return Promise.reject(error);
  }
);
```

---

## 9. Security Requirements

| Requirement | Implementation |
|---|---|
| SQL Injection | Prisma parameterized queries; no string-interpolated raw SQL |
| XSS | React JSX escaping by default; no `dangerouslySetInnerHTML` |
| CORS | `cors` with explicit `origin` allowlist; no wildcard in production |
| Rate Limiting | `express-rate-limit`: 10/min on `POST /api/applications`; 20/min on `/auth/login-token` and `POST /auth/login` |
| File Upload | Multer validates MIME type + max 2MB |
| JWT Secret | Stored in `.env` as `JWT_SECRET`; minimum 32 chars; never committed |
| Password Hashing | `bcryptjs`, 12 salt rounds |
| Input Validation | Zod schema on every route before controller |
| Mass Assignment | All Prisma calls use explicitly destructured fields — never spread `req.body` |
| PII | LRN never logged in plaintext in audit log descriptions beyond initial submission |

---

### 9.1 Login Access Guard — Layer 1 (Frontend)

**Problem:** Any guest can navigate directly to `/login` by typing it in the address bar, defeating the intent to have a staff-only login.

**Solution:** The `/login` route loader reads `window.history.state?.usr` — the internal state object React Router v7 writes when `navigate()` is called. Direct URL visits carry no state, so the loader returns `redirect('/')`. Only navigation calls that explicitly pass `{ state: { loginAccess: true } }` are permitted.

**Three legitimate state injectors:**

```tsx
// 1. ProtectedRoute — unauthenticated user tries to reach a protected route
<Navigate to="/login" replace state={{ loginAccess: true, from: location.pathname }} />

// 2. Staff login link in the public portal footer (/apply and /closed pages)
const navigate = useNavigate();
<button
  type="button"
  onClick={() => navigate('/login', { state: { loginAccess: true } })}
  className="text-xs text-muted-foreground hover:underline underline-offset-4"
>
  Staff Login
</button>

// 3. Axios 401 interceptor — session expired mid-use
// (uses the navigationRef singleton — see §8 above)
navigate('/login', { state: { loginAccess: true } });
```

**Result:** Typing `/login` in the address bar bounces to `/`. The only path to the login form is through the system's own navigation.

---

### 9.2 Pre-Flight Login Token — Layer 2 (Backend)

**Problem:** Even with Layer 1 blocking the UI, a determined attacker with a tool like Postman can still call `POST /api/auth/login` directly to attempt credential stuffing.

**Solution:** `POST /api/auth/login` requires a server-issued, single-use, short-lived token in the request body. This token is only obtainable by calling `GET /api/auth/login-token`, which is what the Login page does silently on mount.

**Flow:**
1. `Login.tsx` mounts → immediately calls `GET /api/auth/login-token` (no user action required)
2. Server generates 32 random bytes, stores the SHA-256 hash in `LoginToken`, sets 5-minute expiry → returns `{ loginToken: <raw> }`
3. Login form stores `loginToken` in component state (not localStorage)
4. User types email + password → form submits `{ email, password, loginToken }`
5. `validateLoginToken` middleware: verifies hash, checks not expired, checks not already used → marks `usedAt = now()` → calls `next()`
6. `authController.login` runs only after the token is consumed
7. Any direct `POST /api/auth/login` without a valid `loginToken` returns `400 Bad Request` immediately — no password check attempted

```ts
// server/src/controllers/authController.ts
import crypto from 'crypto';

export async function issueLoginToken(req: Request, res: Response) {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  await prisma.loginToken.create({
    data: {
      token: hash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      ipAddress: req.ip,
    },
  });
  res.json({ loginToken: raw }); // send raw; store only hash
}
```

```ts
// server/src/middleware/validateLoginToken.ts
import crypto from 'crypto';

export async function validateLoginToken(req: Request, res: Response, next: NextFunction) {
  const { loginToken } = req.body;
  if (!loginToken) {
    return res.status(400).json({ message: 'Missing login token.' });
  }

  const hash = crypto.createHash('sha256').update(loginToken).digest('hex');
  const record = await prisma.loginToken.findUnique({ where: { token: hash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Invalid or expired login token.' });
  }

  // Consume immediately — single use only
  await prisma.loginToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  next();
}
```

```ts
// server/src/routes/auth.routes.ts
router.get('/login-token', loginTokenRateLimiter, issueLoginToken);   // 20/min
router.post('/login',      loginRateLimiter, validateLoginToken, authController.login);
```

**Periodic cleanup:** A cron job or startup task deletes expired, used tokens older than 24 hours to keep the `LoginToken` table lean.

---

## 10. Dynamic School Configuration

This system must deploy at any Philippine public secondary school with **zero code changes**. Every school-identifying value is a runtime configuration stored in the database.

| What varies by school | Where it is configured |
|---|---|
| School name | `SchoolSettings.schoolName` — Settings Tab 1 |
| DepEd School ID | `SchoolSettings.schoolId` — Settings Tab 1 |
| Division & Region | `SchoolSettings.division / region` — Settings Tab 1 |
| Logo & accent color | Logo upload in Settings Tab 1; color auto-extracted |
| Grade levels offered | Configured per AY in Settings Tab 3 |
| Tracks & strands offered | Configured per AY in Settings Tab 3 |
| SCP programs offered | Configured per AY in Settings Tab 3 (SCP sub-tab) |
| Active admission channels | `SchoolSettings.admissionChannels` |
| Section names & capacity | Per grade level configuration |
| Enrollment phase dates | Auto-calculated per DepEd rules; editable per AY |

**Hardcoding rules — enforced at code review:**
- `schoolName` never appears as a string literal in any component. Always `settings.schoolName`.
- SCP options in the admission form load from `GET /api/scp-programs`, never from a hardcoded array.
- Grade level names are never hardcoded — they always come from the database for the active AY.
- Email subjects and bodies use `${settings.schoolName}` token substitution at send time.
- Division and region labels in the privacy notice come from `SchoolSettings`, not hardcoded text.

---

## 11. Out-of-Scope Limitations

| Feature | Reason Excluded |
|---|---|
| Grading System | Does not compute or store academic grades |
| Class Scheduling / Timetables | No subject or teacher period scheduling |
| DepEd Official Form Generation (SF1, SF4) | No automated printing of DepEd forms |
| Cashiering / School Fees | No financial or billing module |
| SMS Notifications | Email only; no SMS gateway |
| Student / Parent Portal Login | Applicants interact via public form only |
| Multi-School / Multi-Branch Support | Single-school installation |
| WebSocket / Real-time Push | Standard API polling/refetch is acceptable |

---

## 12. Acceptance Criteria

| # | Test |
|---|---|
| AC-01 | A guest submits an online admission form and receives a tracking number on screen and via email. |
| AC-02 | `/apply` redirects to `/closed` when the enrollment gate is OFF. |
| AC-03 | A registrar enters a F2F walk-in application via `/f2f-admission` regardless of the enrollment gate state. |
| AC-04 | F2F applications are stored with `admissionChannel: F2F` and `encodedById` set to the registrar's user ID. |
| AC-05 | Typing `/login` directly in the address bar redirects to `/`. |
| AC-06 | Clicking "Staff Login" in the public portal footer navigates to `/login` successfully. |
| AC-07 | `POST /api/auth/login` without a valid `loginToken` returns `400 Bad Request`. |
| AC-08 | A `loginToken` that has already been used cannot be reused — returns `400`. |
| AC-09 | A `loginToken` older than 5 minutes is rejected — returns `400`. |
| AC-10 | A registrar logs in and receives a valid JWT. Redirected to `/dashboard`. |
| AC-11 | A request to any protected route without a JWT returns `401`. |
| AC-13 | A new user with `mustChangePassword: true` is redirected to `/change-password` after first login. |
| AC-14 | The registrar views a full student profile at `/students/:id` with all tabs populated. |
| AC-15 | Editing a student record creates an `AuditLog` entry with `STUDENT_RECORD_UPDATED` listing changed fields. |
| AC-16 | The LRN field is displayed as read-only in the student profile edit form. |
| AC-21 | SCP options shown in the online and F2F admission form match only active SCP programs in the database. |
| AC-22 | A school with no SCP programs configured sees no SCP fields in the admission form. |
| AC-23 | Section creation allows selecting an advising teacher from the Teacher directory. |
| AC-24 | Deleting a section with active enrollments returns an error describing how many students are affected. |
| AC-25 | Concurrent enrollment into the last section slot does not over-enroll (FOR UPDATE lock). |
| AC-26 | A section at `maxCapacity` is disabled in the section assignment dialog. |
| AC-27 | All school-identifying text (name, division, region) in UI and emails comes from `SchoolSettings`. |
| AC-28 | Uploading a logo changes only accent CSS tokens; main layer tokens remain unchanged. |
| AC-29 | Every critical action appears in the audit log with the correct user, IP, and timestamp. |
| AC-30 | Email notifications are sent asynchronously — API `201` returns before email dispatches. |
| AC-31 | The admission portal is fully usable at 375px with no horizontal overflow. |
| AC-32 | The dashboard sidebar collapses to a hamburger drawer on viewports below 1024px. |
| AC-33 | No `alert()`, `confirm()`, or inline dismissible banners appear anywhere in the system. |

---

*PRD v3.0.0*
*Scope: Admission (Online + F2F) · Enrollment Management · SIMS · Teacher Management · Grade Level & Sectioning Management*
*Stack: PERN (PostgreSQL 18 · Express.js 5.1 · React 19.x · Node.js 22 LTS)*
*Auth: JWT + Layer 1 (navigation state guard) + Layer 2 (pre-flight login token)*
*Design: fully school-agnostic — zero hardcoded school data*