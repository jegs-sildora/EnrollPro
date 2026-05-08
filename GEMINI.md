# EnrollPro Project Instructions

EnrollPro is a comprehensive enrollment management system designed for public schools in the Philippines, aligned with Department of Education (DepEd) processes. It is a monorepo utilizing a modern TypeScript stack.

## Project Overview

- **Architecture:** Monorepo with three main packages: `client`, `server`, and `shared`.
- **Backend:** Node.js Express server with Prisma ORM and PostgreSQL.
- **Frontend:** React application built with Vite, Tailwind CSS (v4), and Radix UI.
- **Shared:** Common Zod schemas, TypeScript types, and constants shared between client and server.
- **Workflow:** Spec-driven development with heavy emphasis on DepEd-aligned modules (Early Registration, Enrollment, Sectioning, etc.).

## Key Tech Stack

- **Monorepo Manager:** `pnpm` (workspaces)
- **Database:** PostgreSQL + Prisma ORM
- **Server:** Express.js, TypeScript, JWT (Auth), Multer (Uploads)
- **Client:** React (v19), TanStack Table, React Hook Form, Zustand (State), Motion (Animation)
- **Styling:** Tailwind CSS (v4), Shadcn UI
- **Shared Logic:** Zod for validation and type inference.

## Project Structure

- `/client`: Frontend React application.
- `/server`: Backend Express application and Prisma models.
- `/shared`: Shared TypeScript code (schemas, types, constants).
- `/docs`: Comprehensive documentation (PRD, implementation specs, API guides).
  - `/docs/core`: Architecture and system-wide documentation.
  - `/docs/features`: Module-specific implementation specs.

## Building and Running

### Prerequisites
- Node.js >= 22.13.0 < 23.0.0
- pnpm >= 8.x
- PostgreSQL >= 14

### Setup
1. `pnpm install` (at root)
2. `cd server && cp .env.example .env` (configure DATABASE_URL)
3. `pnpm run db:migrate && pnpm run db:generate` (inside /server)
4. `pnpm run db:seed` (inside /server)
5. `cd ../client && cp .env.example .env.local`

### Commands (from root)
- `pnpm run dev`: Starts both client and server in parallel.
- `pnpm run dev:server`: Starts only the server.
- `pnpm run dev:client`: Starts only the client.

## Development Conventions

### Source of Truth Order
1. **Database:** `server/prisma/schema.prisma`
2. **Contracts:** `shared/src/constants/index.ts` and `shared/src/schemas`
3. **API Routes:** `server/src/app.ts`
4. **Frontend State:** `client/src/router/index.tsx` and Zustand slices in `client/src/store/`.

### Coding Standards
- **Strict Typing:** All new code must be fully typed. Avoid `any`.
- **Validation:** Use shared Zod schemas for request validation on both client and server.
- **API Design:** Follow REST conventions. Routes are modularized under `server/src/features/`.
- **Frontend:** Use the `@/` alias for imports. Components should be atomic and utilize Shadcn UI where applicable.
- **Prisma:** Generated client is located at `server/src/generated/prisma`.
- **Express 5 Routing:** Wildcards like `*` are no longer supported in path strings. Use regular expressions (e.g., `app.get(/^(?!\/api).+/, ...)` for SPA catch-alls) or named parameters.
- **Relative Routing:** In the production monolith setup, always use `VITE_API_URL="/api"` in the frontend `.env` to ensure connectivity across different domains and secure funnels.

## Module Index (Implementation Specs)

- **Module 1 (Early Registration):** `docs/features/admission/MODULE_1_EARLY_REGISTRATION_IMPLEMENTATION_SPEC.md`
- **Module 2 (Enrollment):** `docs/features/enrollment/MODULE_2_ENROLLMENT_IMPLEMENTATION_SPEC.md`
- **Module 3 (SIMS):** `docs/features/sims/MODULE_3_SIMS_IMPLEMENTATION_SPEC.md`
- **Module 4 (Teachers):** `docs/features/teachers/MODULE_4_TEACHER_MANAGEMENT_IMPLEMENTATION_SPEC.md`
- **Module 5 (Sectioning):** `docs/features/academic-year/MODULE_5_GRADE_SECTIONING_IMPLEMENTATION_SPEC.md`

Refer to `docs/README.md` for the full documentation index and source-of-truth hierarchy.

Act as a Senior PERN Stack Developer (PostgreSQL, Express, React TSX, Node.js) with deep expertise in TypeScript, Tailwind CSS v4, and Prisma ORM, and as a Senior Database Administrator, and as a Senior UI/UX Engineer. Act as a Senior TypeScript Developer. Strictly avoid the use of the any type. If a type is unknown or complex, use unknown, generics, or define a specific interface/type. If you cannot determine the type, ask me for clarification rather than defaulting to any.

You are also an EdTech domain expert specializing in Department of Education (DepEd) Junior High School systems (Grades 7–10) in public schools.