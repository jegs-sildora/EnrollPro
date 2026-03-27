# Tech Stack & Database Schema

This document provides a comprehensive overview of the technologies, architectural patterns, and database structure used in **EnrollPro**.

## 1. Tech Stack Overview (PERN Stack)

The system is built on the **PERN** stack (PostgreSQL, Express, React, Node.js) with modern tooling for performance, type safety, and developer experience.

### Frontend
- **Framework:** React 19 (TypeScript)
- **Build Tool:** Vite 7
- **Routing:** React Router 7
- **Styling:** Tailwind CSS 4 (Vanilla CSS preference)
- **UI Components:** Shadcn/UI (Radix UI primitives)
- **State Management:** Zustand
- **Icons:** Lucide React
- **Animations:** Motion (Framer Motion)
- **Form Handling:** React Hook Form + Zod
- **Notifications:** Sileo (Custom Toast System)
- **Charts:** Recharts

### Backend
- **Runtime:** Node.js
- **Framework:** Express 5
- **ORM:** Prisma 6
- **Validation:** Zod
- **Security:** 
  - JWT (JSON Web Tokens) for authentication
  - Bcryptjs for password hashing
  - Helmet for security headers
  - Express Rate Limit for API protection
- **File Handling:** Multer + Sharp (image processing)
- **Email:** Nodemailer

### Database
- **Engine:** PostgreSQL
- **Architecture:** Relational schema managed via Prisma migrations.

---

## 2. Naming Conventions

Consistency across the codebase is maintained using the following standards:

### Frontend (Client)
- **Components:** `PascalCase` (e.g., `AppLayout.tsx`, `AdmissionForm.tsx`).
- **Hooks:** `camelCase` with `use` prefix (e.g., `useAuthStore.ts`).
- **Utilities/Functions:** `camelCase`.
- **Folders:** `kebab-case` or `lowercase` (e.g., `audit-logs`, `ui`).
- **CSS Variables:** `kebab-case` (following Tailwind/Shadcn standards).

### Backend (Server)
- **Routes/Controllers:** `camelCase` (e.g., `authController.ts`, `application.routes.ts`).
- **Services:** `camelCase` (e.g., `auditLogger.ts`).
- **Validators:** `camelCase`.

### Database (Prisma/SQL)
- **Models/Tables:** `PascalCase` (e.g., `User`, `AcademicYear`, `Applicant`).
- **Fields/Columns:** `camelCase` (e.g., `firstName`, `trackingNumber`).
- **Enums:** `PascalCase` for the enum name, `UPPER_SNAKE_CASE` for values (e.g., `ApplicationStatus.UNDER_REVIEW`).

---

## 3. Database Schema

The database is structured to support a multi-phase enrollment process (Early Registration and Regular Enrollment) and Special Curricular Programs (SCP).

### Core Enums
| Enum | Values |
| :--- | :--- |
| **Role** | `REGISTRAR`, `SYSTEM_ADMIN` |
| **ApplicationStatus** | `SUBMITTED`, `UNDER_REVIEW`, `FOR_REVISION`, `ELIGIBLE`, `ASSESSMENT_SCHEDULED`, `ASSESSMENT_TAKEN`, `PRE_REGISTERED`, `NOT_QUALIFIED`, `ENROLLED`, `REJECTED`, `WITHDRAWN` |
| **AcademicYearStatus** | `DRAFT`, `UPCOMING`, `ACTIVE`, `ARCHIVED` |
| **ApplicantType** | `REGULAR`, `STE`, `SPA`, `SPS`, `SPJ`, `SPFL`, `SPTVE`, `STEM_GRADE11` |

### Key Models

#### `User`
Manages system access for staff.
- `role`: Distinguishes between Registrar and Admin permissions.
- `isActive`: Boolean flag for account status.

#### `AcademicYear`
The central heartbeat of the system.
- Stores key DepEd calendar dates.
- Manages Phases 1 (Early Reg) and 2 (Regular Enrollment) independently.

#### `Applicant`
The most comprehensive model, storing student data.
- **LRN:** Learner Reference Number (unique identifier).
- **Tracking Number:** Generated for public tracking of applications.
- **JSON Fields:** Used for `currentAddress`, `permanentAddress`, and parent/guardian info to allow flexible data structures.
- **Assessment Fields:** Stores exam scores, results, and interview notes for SCP.

#### `Enrollment`
Links a successful applicant to a specific `Section` and `AcademicYear`.
- Acts as the "Phase 2" finalization record.

#### `Section` & `Teacher`
- `Section` belongs to a `GradeLevel`.
- `Teacher` records exist for advising and subject tracking but do not have system login credentials (unless they also have a `User` account).

#### `AuditLog`
Tracks all sensitive actions (status changes, user creation, etc.) for accountability.

#### `ScpConfig`
Allows admins to configure specific requirements (cutoff scores, exam dates) for Special Curricular Programs per Academic Year.

---

## 4. Architectural Patterns

- **Controller-Service Pattern:** Controllers handle HTTP logic/validation, while Services contain business logic (e.g., `enrollmentGateService`).
- **Middleware-Based Security:** Authentication and Role-Based Access Control (RBAC) are enforced via `authenticate` and `authorize` middlewares.
- **Audit Logging:** Systematic tracking of mutations using a centralized `auditLogger` service.
- **Surgical Updates:** Backend updates use Prisma's fluent API to ensure only specific fields are modified during state transitions (e.g., moving from `ELIGIBLE` to `ASSESSMENT_SCHEDULED`).
