# EnrollPro Project Instructions

## Scope

EnrollPro is a pnpm workspace for Department of Education Junior High School enrollment, learner records, personnel, sectioning, school forms, and school-year operations.

The separate `SMART/CapstoneFinal` application is outside EnrollPro changes unless a task explicitly includes it.

## Source Of Truth

Use this order:

1. `server/prisma/schema.prisma`
2. `shared/src/constants/index.ts` and `shared/src/schemas`
3. Mounted routes in `server/src/app.ts`
4. `client/src/router/index.tsx` and client stores
5. `docs/README.md`

## Engineering Rules

- Use TypeScript and ES modules.
- Do not use `any`; narrow `unknown` or define a specific type.
- Preserve feature boundaries and shared contracts.
- Validate backend inputs with shared Zod schemas where practical.
- Keep EnrollPro and SMART ownership boundaries aligned with `ARCHITECTURE_MICROSERVICES.md`.
- Do not add Early Registration, reading assessment, enrollment listing, hardware, or Internet of Things workflows to EnrollPro.

## Commands

```powershell
pnpm install
pnpm dev
pnpm docs:check
pnpm --filter client lint
pnpm --filter client build
pnpm --filter server build
pnpm --filter server db:migrate
pnpm --filter server db:generate
```

## Documentation

Use `docs/README.md` as the canonical index. Update the affected operational or integration document when behavior, routes, contracts, statuses, or ownership boundaries change.

Do not restore removed planning notes or duplicate API dumps. Verify documentation with `pnpm docs:check`.
