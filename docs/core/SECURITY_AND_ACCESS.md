# Security And Access

Last reviewed: 2026-07-24

## Authentication

Staff authentication uses the protected authentication routes and an HTTP-only cookie or accepted bearer token. Learner portal authentication uses a learner-scoped JWT and separate learner routes.

Never store passwords, tokens, integration keys, or production connection strings in Markdown or committed `.env` files.

## Roles

- `SYSTEM_ADMIN` manages system configuration, accounts, health, logs, personnel administration, and protected exports.
- `HEAD_REGISTRAR` manages enrollment, learner records, sections, EOSY, school forms, and rollover actions permitted by the route.
- `CLASS_ADVISER` and `TEACHER` access assigned advisory and EOSY workspaces.
- `LEARNER` accesses only the learner-owned portal.
- `MRF` represents authorized maintenance-system users where an EnrollPro account is required.

Every backend mutation must enforce authorization. Hiding a button is not an access control.

## School-Year Access

Operational writes use the active school year. Authorized staff may inspect archived years through `x-school-year-context-id`, but archived views are read-only. Initialization and atomic rollover routes have stricter system-administrator controls.

## Integration Keys

Protected companion feeds use dedicated environment variables and `X-Integration-Key`. Each consumer receives only the feed needed for its purpose. Keys must be different from user JWT secrets and must be rotated outside source control.

Public compatibility feeds remain limited to documented data. Do not add sensitive learner or personnel fields to a public response.

## Data Privacy

Follow data minimization:

- SMART receives identity, grade, section, and school-year context required for grades and attendance.
- ATLAS receives personnel and class context required for schedules and teaching loads.
- AIMS receives learner and class context required for interventions.
- MRF receives minimized identity and role context only.

Birth records, health information, parent details, passwords, audit internals, and unrelated demographics must not be exposed to companion systems.

## Audit And Realtime Events

Sensitive mutations should record actor, action, affected record, school-year context, and timestamp. Realtime SSE events contain invalidation topics and identifiers, not full private records.

## Files And Exports

Validate MIME type, extension, size, and content before processing uploads. SF1 and SF7 preview operations must not write records. Official exports must enforce role and school-year permissions.

## Environment Setup

Start from `client/.env.example` and `server/.env.example`. Configure database, JWT, API base, email, and integration credentials locally. Do not commit `.env` files.

