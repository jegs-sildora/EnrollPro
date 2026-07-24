# EnrollPro

EnrollPro is a Department of Education Junior High School records system for Grades 7 to 10. It manages learner identity, enrollment, class placement, personnel records, school-year context, and official school-form workflows.

EnrollPro is the source of truth for enrollment and identity data. SMART owns grades and attendance, ATLAS owns schedules and teaching loads, AIMS owns intervention data, and MRF owns maintenance operations.

## Workspace

- `client` - React 19, TypeScript, Vite, Tailwind CSS, and shared UI components
- `server` - Express 5, TypeScript, Prisma ORM, PostgreSQL, exports, and integration feeds
- `shared` - Zod schemas, constants, and types shared by the client and server
- `SMART/CapstoneFinal` - separate SMART application; do not modify it as part of EnrollPro work

## Requirements

- Node.js `>=22.13.0 <23.0.0`
- pnpm `11.5.2`
- PostgreSQL

## Development

```powershell
pnpm install
pnpm dev
```

Useful commands:

```powershell
pnpm dev:client
pnpm dev:server
pnpm docs:check
pnpm --filter client lint
pnpm --filter client build
pnpm --filter server build
pnpm --filter server db:migrate
pnpm --filter server db:generate
pnpm --filter server db:seed
```

## Source Of Truth

When implementation and documentation disagree, use this order:

1. `server/prisma/schema.prisma`
2. `shared/src/constants/index.ts` and `shared/src/schemas`
3. Mounted routers in `server/src/app.ts`
4. `client/src/router/index.tsx` and client stores
5. The documentation index in `docs/README.md`

## Documentation

- [Documentation Index](docs/README.md)
- [Microservice Architecture](ARCHITECTURE_MICROSERVICES.md)
- [System Architecture](docs/core/SYSTEM_ARCHITECTURE.md)
- [Data Model and Status Guide](docs/core/DATA_MODEL_AND_STATUS.md)
- [Security and Access](docs/core/SECURITY_AND_ACCESS.md)
- [Development Workflow](docs/core/DEVELOPMENT_WORKFLOW.md)
- [EnrollPro API Reference](docs/features/integration/ENROLLPRO-API.md)
- [School Year Lifecycle](docs/features/integration/ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md)

## Product Boundaries

EnrollPro does not handle Early Registration, reading assessment, enrollment listings, hardware devices, or Internet of Things workflows. Incoming Grade 7, transferee, continuing learner, and authorized walk-in processing starts in Learner Enrollment.
