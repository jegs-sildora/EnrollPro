# Copilot instructions for EnrollPro

## Build, lint, and test commands

Run commands from the repository root (`EnrollPro`) with Node 20 (`.node-version`, `engine-strict=true`).

- Install workspace dependencies: `pnpm install`
- Run client + server in parallel: `pnpm run dev`
- Run server only: `pnpm run dev:server`
- Run client only: `pnpm run dev:client`
- Build server: `pnpm --filter server run build`
- Build client: `pnpm --filter client run build`
- Lint client: `pnpm --filter client run lint`

Server database/setup commands:

- Generate Prisma client: `pnpm --filter server run db:generate`
- Apply migrations: `pnpm --filter server run db:migrate`
- Seed baseline data: `pnpm --filter server run db:seed`
- Seed sample students: `pnpm --filter server run db:seed-students`
- Wipe/reset seeded data: `pnpm --filter server run db:wipe`

Testing:

- There is no unified `pnpm test` script at root or package level.
- Run a single existing test file: `pnpm --filter server exec tsx src/tests/schoolYear.test.ts`

## High-level architecture

- This is a pnpm workspace monorepo with three packages: `client` (React/Vite), `server` (Express/Prisma), and `shared` (cross-package schemas/types/constants).
- `shared` is the contract layer (`@enrollpro/shared`): Zod schemas, enums, and inferred types are exported here and consumed across both frontend and backend.
- The server is feature-modular under `server/src/features/*`; route mounting happens in `server/src/app.ts`. Prisma schema is in `server/prisma/schema.prisma`, and generated Prisma client lives in `server/src/generated/prisma`.
- `SchoolSetting.activeSchoolYearId` is a central pivot: dashboard stats, admissions behavior, and public settings all derive active school-year context from it.
- The client route tree is centralized in `client/src/router/index.tsx` and guarded by `ProtectedRoute`. Shared app state is in Zustand stores (`auth.slice.ts`, `settings.slice.ts`).
- API calls go through `client/src/shared/api/axiosInstance.ts`, which injects bearer tokens and handles `TOKEN_EXPIRED` responses by clearing auth state and redirecting to `/login`.
- Admissions/enrollment workflow is centralized in `server/src/features/admission/early-registration.controller.ts`, with explicit status-transition enforcement and enrollment finalization rules.

## Key codebase conventions

- **Schema-first request validation**: Add/modify API request shapes in `shared/src/schemas/*`, then wire them into routers using `validate(schema)` middleware.
- **Date handling is Manila-specific**: Persist and compare date-only fields via `normalizeDateToUtcNoon(...)` and Manila timezone logic (`Asia/Manila`), not naive local-time operations.
- **Audit logging on mutations**: Mutating controllers typically call `auditLog(...)` with `actionType`, `description`, subject metadata, and request IP/user-agent context.
- **School-year scoping pattern**:
  - Backend defaults many flows to active school year from `SchoolSetting`.
  - Frontend uses `viewingSchoolYearId ?? activeSchoolYearId` when calling year-scoped endpoints.
  - Year scope is passed as route param in curriculum/sections endpoints (`/:ayId/...`) and as query param in student search (`schoolYearId`).
- **Admission input normalization**: Admission payloads are uppercased/trimmed recursively (`toUpperCaseRecursive`) while preserving case-sensitive fields (e.g., email, password, base64 image).
- **Role middleware ordering**: Protected routes follow `authenticate` then `authorize(...)`; `TEACHER` is intentionally read-only on selected resources (e.g., dashboard stats, school-year list, student reads).
- **SCP pipeline source of truth**: SCP defaults and assessment step definitions come from shared constants (`SCP_DEFAULT_PIPELINES`, `getSteSteps`) and are materialized into Prisma `ScpProgramConfig/Step/Option` records.
- **Uploads are first-class server assets**: `/uploads` is served statically, with file metadata persisted in Prisma; some upload/delete actions are restricted by admission status unless `SYSTEM_ADMIN`.
