# Development Workflow

Last reviewed: 2026-07-24

## Implementation Order

1. Read `AGENTS.md` and the relevant canonical document.
2. Inspect Prisma models, shared schemas, mounted routers, and current frontend routes.
3. Write a scoped implementation plan for material cross-module work.
4. Change shared contracts before dependent client and server code.
5. Add a Prisma migration when the persisted shape changes.
6. Update affected operational and integration documents in the same change.
7. Verify builds and focused workflows.

## TypeScript

Do not use `any`. Define interfaces, generics, discriminated unions, or narrow `unknown` data with guards. Keep runtime request validation in shared Zod schemas where practical.

## Database Changes

For schema work:

```powershell
pnpm --filter server db:migrate
pnpm --filter server db:generate
```

Review generated SQL before applying it to school data. Never use destructive reset or seed commands against a non-disposable database.

## API Changes

Express routers must be mounted in `server/src/app.ts`. Express 5 catch-all routes must use supported patterns. Document method, path, authentication, role, school-year scope, request, and response in the API reference.

## Frontend Changes

Use existing feature boundaries and shared UI primitives. Preserve the EnrollPro logo-derived theme and top application shell. Use React Query for server state, typed SSE invalidation for cross-page freshness, and the shared unsaved-change guard for database-impacting drafts.

## Verification

Required baseline:

```powershell
pnpm docs:check
pnpm --filter client build
pnpm --filter server build
```

Run `pnpm --filter client lint` for frontend work when practical. Use focused manual and direct API smoke checks for affected workflows. The repository does not maintain a broad integration test suite.

## Documentation

Canonical documents are indexed in `docs/README.md`. Remove obsolete product documents rather than adding supersession maps. Do not publish target-state endpoints as implemented.

