# Security And Access

Last reviewed: 2026-09-01

## Authentication

Staff authentication uses the protected authentication routes and an HTTP-only cookie or accepted bearer token. Learner portal authentication uses a learner-scoped JWT and separate learner routes.

Never store passwords, tokens, integration keys, or production connection strings in Markdown or committed `.env` files.

SMART, AIMS, and ATLAS credential verification must honor
`mustChangePassword`. EnrollPro blocks companion-system login while a default
password is active and provides a five-minute, single-purpose handoff to the
existing password-change form. The handoff does not issue a normal EnrollPro
staff session. Companion return destinations are allowlisted through
`COMPANION_APP_URLS` and bound into the signed handoff ticket. Configure
`ENROLLPRO_PUBLIC_URL` with the browser-facing EnrollPro address.

Authenticated EnrollPro staff may also launch a configured companion from the
sidebar through one-time SSO. EnrollPro creates a random authorization code,
stores only its SHA-256 hash, and expires it after 60 seconds. The companion
backend exchanges the code once using its dedicated Bearer secret, validates
the minimized EnrollPro identity and active school year, then creates its own
session. EnrollPro cookies, JWTs, and passwords are never shared across domains.

ATLAS, AIMS, and SMART allow `SYSTEM_ADMIN`, `HEAD_REGISTRAR`, `TEACHER`, and
`CLASS_ADVISER`. MRF allows `SYSTEM_ADMIN` and `MRF`. Inactive users,
JHS completers, unsupported roles, identities without an employee ID or LRN,
and accounts using a default password are denied.

## Roles

- `SYSTEM_ADMIN` manages system configuration, accounts, health, logs, personnel administration, and protected exports.
- `HEAD_REGISTRAR` manages enrollment, learner records, sections, EOSY, school forms, and rollover actions permitted by the route.
- `CLASS_ADVISER` and `TEACHER` access their assigned advisory roster. They do not encode, submit, override, or finalize grades in EnrollPro.
- `LEARNER` accesses only the learner-owned portal.
- `MRF` represents authorized maintenance-system users where an EnrollPro account is required.

Every backend mutation must enforce authorization. Hiding a button is not an access control.

## School-Year Access

Operational writes use the active school year. Authorized staff may inspect archived years through `x-school-year-context-id`, but archived views are read-only. Initialization and atomic rollover routes have stricter system-administrator controls.

## Integration Keys

Protected companion feeds use dedicated environment variables and `X-Integration-Key`. Each consumer receives only the feed needed for its purpose. Keys must be different from user JWT secrets and must be rotated outside source control.

Companion SSO uses separate `*_SSO_CLIENT_SECRET` values. These secrets must be
unique per companion and must not reuse feed, grade, schedule, JWT, or password
handoff keys. Only the destination backend may hold its SSO secret.

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

SSO audit entries record launch, exchange, denial, and replay outcomes without
recording the plaintext authorization code, callback query, client secret, or
companion session token.

## Files And Exports

Validate MIME type, extension, size, and content before processing uploads. SF1 and SF7 preview operations must not write records. Official exports must enforce role and school-year permissions.

## Environment Setup

Start from `client/.env.example` and `server/.env.example`. Configure database, JWT, API base, email, and integration credentials locally. Do not commit `.env` files.
