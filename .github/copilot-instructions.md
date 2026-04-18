# Copilot Instructions for EnrollPro

## Runtime and workspace baseline

- Monorepo uses pnpm workspaces with three packages: `server`, `client`, `shared`.
- Runtime baseline is Node 22 LTS, pinned to `22.22.2` in `.node-version` and `.nvmrc`.
- Engine enforcement is enabled (`engine-strict=true` in `.npmrc` and root package policy).
- Run commands from repository root unless explicitly stated.

## Build, run, lint, and data commands

### Workspace commands

- Install dependencies: `pnpm install`
- Run server + client in parallel: `pnpm run dev`
- Run server only: `pnpm run dev:server`
- Run client only: `pnpm run dev:client`
- Build server: `pnpm --filter server run build`
- Build client: `pnpm --filter client run build`
- Lint client: `pnpm --filter client run lint`

### Server data and setup commands

- Apply Prisma migrations (dev): `pnpm --filter server run db:migrate`
- Regenerate Prisma client: `pnpm --filter server run db:generate`
- Seed baseline data: `pnpm --filter server run db:seed`
- Seed SCP configuration defaults: `pnpm --filter server run db:seed-scp`
- Seed sample students: `pnpm --filter server run db:seed-students`
- Wipe/reset seeded data: `pnpm --filter server run db:wipe`

### Testing status

- There is no unified `pnpm test` script at root or package level.
- Currently runnable script-style test entrypoints include:
  - `pnpm --filter server exec tsx src/tests/schoolYear.test.ts`
  - `pnpm --filter server exec tsx src/tests/academicYear.test.ts`
  - `pnpm --filter server exec tsx src/tests/sims.test.ts`
- `server/src/tests/curriculum.test.ts` is framework-style (Vitest/Supertest shape) and is not wired into an existing package test script.

## Environment and runtime behavior

### Server environment

- Primary required values are defined in `server/.env.example`.
- Key variables include `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CLIENT_URL`, `CLIENT_URLS`, and optional SMTP values for email resend flows.
- Server timezone is explicitly set to `Asia/Manila` at process startup.

### Client environment

- Client API source of truth is `VITE_API_URL` (see `client/.env.example`).
- If `VITE_API_URL` is absent, client falls back to `/api` and relies on Vite proxy.
- Vite proxy backend override uses `VITE_PROXY_TARGET` (default `http://127.0.0.1:5000`).

## High-level architecture

- Route mounting is centralized in `server/src/app.ts`.
- Mounted API groups:
  - `/api/auth`
  - `/api/settings`
  - `/api/dashboard`
  - `/api/school-years`
  - `/api/curriculum`
  - `/api/sections`
  - `/api/students`
  - `/api/applications`
  - `/api/admin`
  - `/api/audit-logs`
  - `/api/teachers`
  - `/api/learner`
  - `/api/early-registrations`
- Uploads are served statically from `/uploads`.
- Prisma schema is in `server/prisma/schema.prisma`; generated client is in `server/src/generated/prisma`.

### Client architecture

- Frontend route tree is centralized in `client/src/router/index.tsx`.
- Role-guarding is handled by `client/src/shared/components/ProtectedRoute.tsx`.
- Shared app/session state is in Zustand stores:
  - `client/src/store/auth.slice.ts`
  - `client/src/store/settings.slice.ts`
- API calls go through `client/src/shared/api/axiosInstance.ts`.

### Domain structure highlights

- `@enrollpro/shared` is the contract layer (schemas, constants, inferred types).
- `SchoolSetting.activeSchoolYearId` is the key pivot for active school-year behavior.
- Admission lifecycle uses two active API surfaces:
  - `/api/applications` (legacy/unified intake + enrollment operations)
  - `/api/early-registrations` (DO 017 early registration lane)
- ATLAS sync retry worker starts at server boot (`startAtlasSyncRetryWorker`).

## Source-of-truth files for engineering decisions

- Data model and enums: `server/prisma/schema.prisma`
- Shared contracts: `shared/src/constants/index.ts`, `shared/src/schemas/*`
- Mounted backend routes: `server/src/app.ts`
- Auth and middleware contracts:
  - `server/src/middleware/authenticate.ts`
  - `server/src/middleware/authorize.ts`
  - `server/src/middleware/validate.ts`
- Admission transition map and shared helpers:
  - `server/src/features/admission/services/early-registration-shared.service.ts`
- Frontend route and state behavior:
  - `client/src/router/index.tsx`
  - `client/src/store/auth.slice.ts`
  - `client/src/store/settings.slice.ts`

## Codebase conventions (implementation-accurate)

### 1) Schema-first request validation

- Define/modify payload contracts in `shared/src/schemas/*`.
- Wire schemas into routers using `validate(schema)` middleware.
- Keep server and client aligned by consuming shared exports from `@enrollpro/shared`.

### 2) Auth and authorization chain

- Protected routes should apply `authenticate` before `authorize(...)`.
- Client bearer token injection and session handling are centralized in `axiosInstance`.
- `TOKEN_EXPIRED` responses clear auth and redirect to `/login`.

### 3) Date handling is Manila-specific

- Use `normalizeDateToUtcNoon(...)` for date-only persistence and comparisons.
- Enrollment phase checks are Manila-time aware (`Asia/Manila`) in enrollment gate service.
- Avoid naive local-time date comparisons for school-year windows and assessment scheduling.

### 4) School-year scoping pattern

- Frontend year context defaults to `viewingSchoolYearId ?? activeSchoolYearId`.
- Backend commonly expects:
  - Route param scoping for curriculum/sections (`/:ayId/...`)
  - Query param scoping for students (`schoolYearId`)
- Public settings endpoint returns both active school-year id and label.

### 5) Admission lifecycle and transitions

- Transition rules are centralized in `VALID_TRANSITIONS`.
- Use shared helper methods (`assertTransition`, `updateApplicationStatus`, etc.) instead of ad-hoc status edits.
- Batch status operations must respect transition validity and special restrictions (for example, no batch direct `ENROLLED`).

### 6) LRN and no-LRN flow

- `hasNoLrn` is allowed only for incoming Grade 7 new enrollees and transferees.
- Learners submitted without LRN are tracked via `Learner.isPendingLrnCreation`.
- Enrollment finalization enforces LRN requirements for pending-LRN learners.

### 7) Input normalization

- Admission flows normalize strings using recursive uppercase/trim helpers.
- Preserve case-sensitive fields (for example: email, password, contact number, base64 image payloads).

### 8) Audit logging for mutations

- Mutating actions should call `auditLog(...)` with clear `actionType`, description, subject metadata, and request context.

### 9) SCP pipeline source of truth

- Pipeline defaults and step definitions come from shared constants (`SCP_DEFAULT_PIPELINES`, `getSteSteps`).
- Materialized records live in Prisma models:
  - `ScpProgramConfig`
  - `ScpProgramStep`
  - `ScpProgramOption`

### 10) Upload and file handling

- `/uploads` is a first-class server asset path.
- Use Multer-based flows for document/logo uploads and `fileUploader` helpers for base64 image persistence.
- Respect existing admission/status restrictions when allowing upload/delete mutations.

### 11) Role usage

- Current role enum includes `REGISTRAR`, `SYSTEM_ADMIN`, and `TEACHER`.
- `TEACHER` access is intentionally limited to selected read/list paths.

## Current reality and caveats (important)

- There is no mounted dedicated `/api/enrollment` backend module at present.
  - Enrollment operations are primarily handled under admission controllers (`/api/applications`) plus enrollment requirement service logic.
- Student write/health/pin-reset endpoints in `students.controller.ts` currently return unavailable responses (legacy stack removed guard).
- School-year utility logic exists in both `school-year.service.ts` and `academic-year.service.ts`.
  - Prefer `school-year.service.ts` for new work to reduce duplication drift.
- Two parallel intake surfaces are active (`/api/applications` and `/api/early-registrations`).
  - Preserve contract boundaries and avoid mixing payload assumptions between these flows.
- Test strategy is mixed (script-style and framework-style), with no unified automated test pipeline yet.

## Practical guardrails for AI-assisted changes

- Keep newly generated code under 600 lines per file whenever feasible.
- If a change is likely to exceed 600 lines, split it into focused modules before finalizing (for example: service/helper split on backend, or component/hook/type split on frontend).
- After editing `server/prisma/schema.prisma`, run `pnpm --filter server run db:generate` before server build or type checks.
- Keep API/env assumptions aligned with actual sources:
  - `VITE_API_URL` for client API base
  - `CLIENT_URL` and `CLIENT_URLS` for server CORS configuration
- Verify file paths and route names against mounted routers before documenting or implementing features.
