# System Architecture

Last reviewed: 2026-07-24

## Runtime

EnrollPro is a pnpm workspace with three cooperating packages:

- `client` is a React 19 and Vite application written in TypeScript.
- `server` is an Express 5 API using Prisma ORM and PostgreSQL.
- `shared` contains Zod validation schemas, enums, constants, and types shared across both runtimes.

The SMART application under `SMART/CapstoneFinal` is a separate system. Its code, database, and release lifecycle are not part of the EnrollPro workspace.

## Frontend Structure

Feature code lives under `client/src/features`. Shared layouts, UI primitives, hooks, API helpers, motion rules, skeletons, and utilities live under `client/src/shared`. Route ownership is defined in `client/src/router/index.tsx`.

Primary EnrollPro route groups include:

- Public enrollment, application monitoring, and password change
- Staff authentication
- Dashboard, Learner Enrollment, Section Assignment
- Learner Directory, Personnel Directory, and Class Sections
- EOSY Updating and registrar EOSY workspace
- Settings, activity logs, and system health
- Teacher advisory roster workspace
- Learner authentication and learner portal

### Frontend Route Map

| Route | Workspace or behavior | Access |
| --- | --- | --- |
| `/staff/login` | Staff login | Public |
| `/enrollment` | Online learner enrollment | Public while enrollment is open |
| `/monitor` | Public application monitoring | Public |
| `/change-password` | Public password-change entry | Public |
| `/learner/login` | Learner login | Public |
| `/learner/setup-password` | Learner first-password setup | Learner token |
| `/learner/change-password` | Learner password change | Learner token |
| `/learner/portal` | Learner-owned portal | Learner |
| `/dashboard` | Master Dashboard | Authorized staff |
| `/continuing-learners` | Unified Learner Enrollment tabs | Registrar and system administrator |
| `/monitoring/enrollment` | Section Assignment | Registrar and system administrator |
| `/eosy` | EOSY Updating | Registrar and system administrator |
| `/students` | Learner Directory | Registrar and system administrator |
| `/students/:id` | Learner profile | Registrar and system administrator |
| `/sections` | Class Sections | Registrar and system administrator |
| `/sections/view-masterlist/:sectionId` | Section masterlist and SF1 actions | Registrar and system administrator |
| `/settings` | System Configuration | Registrar and system administrator |
| `/teachers` | Personnel Directory | Registrar or system administrator |
| `/admin/system` | System health | System administrator |
| `/audit-logs` | Activity logs | System administrator |
| `/my-activity` | Signed-in user's own activity log | Authorized staff |
| `/help` | Enrollment, SF1, SF7, and rollover guidance | Authorized staff |
| `/teacher/advisory` | Teacher advisory class | Teacher, adviser, registrar, or system administrator |

The root route `/` redirects authenticated staff to the Master Dashboard. Removed
workflow routes are not retained as aliases; current navigation points directly
to Learner Enrollment, Section Assignment, and System Configuration.

## Backend Structure

`server/src/app.ts` is the mounted-route source of truth. Domain routers and services live under `server/src/features`.

Mounted API domains are:

- authentication and learner authentication
- system health, settings, dashboard, and school years
- sections, sectioning, learners, personnel, and administrative users
- applications, BOSY, enrollment, registrar EOSY verification, remedial processing, and exports
- SF7, audit logs, Server-Sent Events, and integration feeds
- address and geography reference data

Legacy source folders that are not mounted are not supported APIs.

## Data Flow

The client calls relative `/api` routes. Shared Zod contracts validate business inputs. Controllers authorize the request and delegate transaction work to domain services. Prisma writes to PostgreSQL. Successful mutations write audit context where required and broadcast typed invalidation topics after commit.

## Realtime Updates

Protected staff and teacher pages use one authenticated Server-Sent Events connection per browser tab. The server emits topic-based invalidation events after successful database changes. React Query invalidates matching caches, while remaining local-state pages listen for the same browser event and refetch.

SSE is cache invalidation, not a second data store. Every page still reads authoritative data from the API.

## School-Year Context

Requests use the active school year unless a permitted historical context is supplied. The client sends `x-school-year-context-id` for staff historical views. Archived years are read-only. The atomic rollover changes the active year only after history, forms, sections, learner outcomes, and target-year conflict checks pass readiness.

## Integration Boundary

See [Microservice Architecture](../../ARCHITECTURE_MICROSERVICES.md). EnrollPro owns identity, enrollment, placement, personnel, and school-year context. SMART owns grades and attendance. ATLAS owns schedules and teaching loads. AIMS owns intervention data. MRF owns maintenance operations.

EnrollPro has no hardware or Internet of Things dependency.

Teachers and class advisers do not encode, submit, or finalize grades in
EnrollPro. SMART is the only source of grades, learning-area results, and
promotion outcomes. The teacher advisory route is a read-only roster view.
