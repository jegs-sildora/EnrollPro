# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm install` - Install dependencies
- `pnpm dev` - Run both client and server in development mode
- `pnpm dev:client` - Run only the client
- `pnpm dev:server` - Run only the server

### Database
- `pnpm --filter server db:migrate` - Apply pending migrations
- `pnpm --filter server db:generate` - Generate Prisma client after schema changes
- `pnpm --filter server db:seed` - Seed database with initial data

### Build & Lint
- `pnpm --filter client build` - Build client for production
- `pnpm --filter server build` - Build server for production
- `pnpm --filter client lint` - Lint client code
- `pnpm docs:check` - Validate documentation

### Testing
- Individual test commands are not configured in this repository; use focused manual and direct API smoke checks for affected workflows

## Architecture

### System Overview
EnrollPro is a Department of Education Junior High School records system for Grades 7 to 10 that manages learner identity, enrollment, class placement, personnel records, school-year context, and official school-form workflows. It serves as the source of truth for enrollment and identity data in a microservices ecosystem.

### Package Structure
- `client` - React 19, TypeScript, Vite, Tailwind CSS frontend application
- `server` - Express 5, TypeScript, Prisma ORM, PostgreSQL backend API
- `shared` - Zod schemas, constants, and types shared between client and server
- `SMART/CapstoneFinal` - Separate SMART application (do not modify as part of EnrollPro work)

### Data Flow & Source of Truth
When implementation and documentation disagree, use this order:
1. `server/prisma/schema.prisma` - Database schema
2. `shared/src/constants/index.ts` and `shared/src/schemas` - Shared types and validation
3. Mounted routers in `server/src/app.ts` - API endpoints
4. `client/src/router/index.tsx` and client stores - Frontend routing and state
5. Documentation index in `docs/README.md` - Reference documentation

### Key Architectural Patterns
- Microservice architecture where EnrollPro owns learner/personnel identity, enrollment, section placement, school-year context, and school-form workflows
- Integration feeds share context with companion systems (SMART, ATLAS, AIMS, MRF) without transferring ownership
- Atomic rollover transactions for school-year transitions
- Prisma ORM for database access with PostgreSQL
- React Query for server state management in frontend
- TypeScript throughout with strict typing (no `any` usage)
- Zod for runtime request validation
- Tailwind CSS for styling with shadcn/ui components

### Development Workflow
1. Read `AGENTS.md` and relevant canonical documents
2. Inspect Prisma models, shared schemas, mounted routers, and current frontend routes
3. Write a scoped implementation plan for material cross-module work
4. Change shared contracts before dependent client and server code
5. Add a Prisma migration when the persisted shape changes
6. Update affected operational and integration documents in the same change
7. Verify builds and focused workflows

### Environment Requirements
- Node.js `>=22.13.0 <23.0.0`
- pnpm `11.5.2`
- PostgreSQL database

### Documentation
Canonical documents are indexed in `docs/README.md` and include:
- Microservice Architecture (`ARCHITECTURE_MICROSERVICES.md`)
- System Architecture (`docs/core/SYSTEM_ARCHITECTURE.md`)
- Data Model and Status Guide (`docs/core/DATA_MODEL_AND_STATUS.md`)
- Security and Access (`docs/core/SECURITY_AND_ACCESS.md`)
- Development Workflow (`docs/core/DEVELOPMENT_WORKFLOW.md`)
- EnrollPro API Reference (`docs/features/integration/ENROLLPRO-API.md`)
- School Year Lifecycle (`docs/features/integration/ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md`)