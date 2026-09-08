# EnrollPro Student Authentication and API Catalog for MRF/SORTv2

Last reviewed: 2026-09-08

## Purpose

This document answers `ENROLLPRO_HANDOFF_STUDENT_AUTH.md` and defines the
current EnrollPro contracts available to MRF/SORTv2. It is based on the routes
mounted by `server/src/app.ts`, their controllers, shared validation schemas,
and Prisma-backed services.

This is a description of implemented behavior. Items marked **Not
implemented** must not be treated as available contracts.

## Executive Answer

The blocked learner logins are calling the wrong endpoint.

- `POST /api/auth/login` accepts an EnrollPro `User.accountName`, employee ID,
  or email. It is the staff-shaped login contract and does not accept a raw LRN
  as an LRN lookup.
- Learners authenticate with `POST /api/learner/auth` and the body
  `{ "lrn": "<12 digits>", "password": "<password>" }`.
- The Password Control value shown to an administrator is a password-reset
  target. It is not the learner's readable current password. EnrollPro stores
  only a bcrypt hash.
- Newly provisioned learner accounts currently use `DepEd2026!` and set
  `mustChangePassword=true`. An administrator can later reset a learner to the
  configured default or another supplied reset value.
- Neither `/api/auth/login` nor `/api/learner/auth` currently has an account or
  IP lockout/rate limiter. MRF must still throttle its own public login surface.
- EnrollPro has no refresh-token endpoint and no token-revocation endpoint.

## A1. Learner Authentication

### Endpoint

```text
POST /api/learner/auth
Authentication: public
Content-Type: application/json
```

Request body:

```json
{
  "lrn": "123456789012",
  "password": "<learner-password>"
}
```

Validation:

| Field | Type | Rule |
| --- | --- | --- |
| `lrn` | string | Exactly 12 numeric digits |
| `password` | string | At least one character |

Success, HTTP `200`:

```json
{
  "token": "<learner-jwt>",
  "requiresPasswordReset": false,
  "schoolName": "Example National High School",
  "schoolAcronym": "ENHS",
  "gradeLevelName": "Grade 8",
  "sectionName": "Rizal",
  "learner": {
    "id": 42,
    "lrn": "123456789012",
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "middleName": null
  }
}
```

Error map:

| Status | Code/body | Meaning |
| --- | --- | --- |
| `400` | `{ "message": "Validation failed", "errors": { ... } }` | Missing or malformed LRN/password |
| `401` | `INVALID_LRN` | No learner exists for the supplied LRN |
| `401` | `INVALID_PASSWORD` | Learner exists but the password is incorrect |
| `401` | `ACCOUNT_INACTIVE` | The linked learner portal user is inactive |
| `500` | `JWT_SECRET_MISSING` or `SERVER_ERROR` | Server authentication configuration/failure |

The public message for an unknown learner and a wrong password is deliberately
similar. MRF should not reveal whether an arbitrary LRN exists.

### Default-password first login

When a learner exists but has no linked `User`, the currently implemented
learner login can create the portal user only when the supplied password is the
fallback default `DepEd2026!`. The created account uses:

- internal account name `LRN-<12-digit-LRN>`;
- role `LEARNER`;
- active status;
- `mustChangePassword=true`.

The response then has `requiresPasswordReset=true`. MRF must not interpret that
response as authorization to enter the normal MRF workspace. Direct the learner
through EnrollPro's password-change flow first, or deny the MRF login with a
plain `Change your default EnrollPro password first` message.

### How MRF should consume this endpoint

If MRF continues delegated credential checking:

1. Collect LRN and password only on the MRF TLS-protected login page.
2. Send them from the MRF backend to `/api/learner/auth`.
3. Never log or store the password.
4. Validate the HTTP status and response shape.
5. Require `requiresPasswordReset=false` and an active learner in the current
   MRF identity mirror.
6. Create an MRF-owned session. Do not use the EnrollPro learner JWT as the MRF
   browser session.
7. Discard the EnrollPro JWT unless MRF immediately needs an explicitly
   learner-protected EnrollPro API. The MRF identity feed uses its integration
   key, not this JWT.

The preferred long-term browser navigation contract is the one-time-code SSO
flow documented in `MRF-ENROLLPRO-SSO.md`. It avoids collecting an EnrollPro
password on MRF. It becomes available only after MRF supplies its callback URL
and both deployments install the same dedicated SSO secret.

## A2. Password Control and Initial Password

The Password Control input is not the current password. Passwords are bcrypt
hashes and cannot be read back from EnrollPro.

The control is populated from `SchoolSetting.globalDefaultPassword`. Clicking
`Reset to Default Password` hashes the value currently in that input, replaces
the learner's stored password, and sets `mustChangePassword=true`.

Current creation behavior:

| Account path | Initial/reset value | Forced change |
| --- | --- | --- |
| Automatic learner account provisioning | `DepEd2026!` | Yes |
| First learner login with no linked user | `DepEd2026!` | Yes |
| Student profile password reset | Supplied reset value, or configured global default if omitted | Yes |

Therefore, seeing `DepEd2026!` in Password Control does not prove that a
particular learner currently has that password. It becomes that learner's
password only after account creation with that default or an explicit reset.

## A3. Authentication Error Semantics

### `POST /api/auth/login`

Request:

```json
{
  "accountName": "1234501",
  "password": "<password>"
}
```

The identifier is matched against `User.accountName`, `User.employeeId`, or
`User.email`. It is not interpreted as `Learner.lrn`.

| Status | Current behavior |
| --- | --- |
| `200` | Returns `{ token, user }` and sets the EnrollPro HTTP-only session cookie |
| `400` | Zod validation failure for missing/empty fields |
| `401` | User missing, password invalid, or account inactive; inactive has a distinct human message but no stable machine code |
| `500` | JWT or unexpected server failure |

`mustChangePassword=true` does not produce `403` on `/api/auth/login`. Login
succeeds and the response user and JWT carry the flag. The EnrollPro client then
opens its password-change interface.

### `POST /api/auth/verify`

This is the current staff/default-password companion verification contract. It
accepts `{ accountName, password, returnTo? }` and does not create an EnrollPro
session.

| Status | Current behavior |
| --- | --- |
| `200` | `{ "valid": true, "user": { ... } }` |
| `400` | Invalid body or unregistered `returnTo` origin |
| `401` | User missing, password wrong, or account inactive |
| `403` | Linked learner is a JHS completer |
| `428` | `PASSWORD_CHANGE_REQUIRED` with a five-minute EnrollPro password-change URL |
| `500` | Verification/configuration failure |

MRF must be present in `COMPANION_APP_URLS` before its exact `returnTo` origin
can be accepted by the external password-change handoff.

## A4. Lockout and Rate Limits

**Not implemented:** `/api/auth/login`, `/api/auth/verify`, and
`/api/learner/auth` currently have no route-specific rate limiter, failed-login
counter, temporary account lock, or lockout response code.

The SSO launch and exchange routes have separate request limits, but those do
not protect delegated password login.

Until EnrollPro adds a shared authentication limiter, MRF should:

- rate-limit by normalized account identifier and source IP;
- add increasing delays after repeated failures;
- avoid automatic retries after a `401`;
- return `429` from MRF when its own threshold is exceeded;
- never claim EnrollPro locked the account, because EnrollPro currently does
  not maintain that state.

## Token and Password Lifecycle

### Learner JWT

- Signed by EnrollPro with `JWT_SECRET`.
- Lifetime comes from `JWT_EXPIRES_IN`; default is `24h`.
- Claims include learner ID, LRN, role `learner`, and
  `requiresPasswordReset`.
- Sent as `Authorization: Bearer <learner-token>` to learner self-service
  routes.
- No refresh token exists.
- No explicit revocation endpoint or denylist exists.
- The learner middleware validates signature, expiry, and role. It does not
  re-query account-active status on every request.

### Learner password change

```text
POST /api/learner/setup-password
POST /api/learner/change-password
Authorization: Bearer <learner-token>
Content-Type: application/json
```

Both paths invoke the same operation.

```json
{
  "newPassword": "PrivatePassword1!"
}
```

Rules:

- minimum eight characters;
- cannot equal the current password;
- cannot equal the fallback or configured default password.

Success returns a replacement learner JWT with
`requiresPasswordReset=false`. Errors include `401 UNAUTHORIZED`,
`404 NOT_FOUND`, `400 SAME_PASSWORD`, and
`400 DEFAULT_PASSWORD_NOT_ALLOWED`.

### Administrative password operations

The protected registrar/admin route is:

```text
POST /api/students/:learnerId/reset-password
Authorization: Bearer <staff-jwt>
Roles: HEAD_REGISTRAR or SYSTEM_ADMIN
Body: { "password": "<reset-value>" }
```

If `password` is omitted, the configured global default is used. This operation
creates the linked portal account if necessary and always sets
`mustChangePassword=true`.

There is no integration-key password reset endpoint and no bulk password reset
endpoint. MRF must not call administrative password routes on behalf of users.

## API Base and Authentication Modes

Development base used by the request:

```text
https://dev-jegs.buru-degree.ts.net/api
```

Partner feed base:

```text
https://dev-jegs.buru-degree.ts.net/api/integration/v1
```

| Mode | Header | Purpose |
| --- | --- | --- |
| Public | None | Health and login endpoints |
| Learner JWT | `Authorization: Bearer <learner-jwt>` | Learner self-service only |
| Staff JWT | `Authorization: Bearer <staff-jwt>` | EnrollPro staff operations |
| MRF integration key | `X-Integration-Key: <MRF_INTEGRATION_API_KEY>` | Server-to-server identity and school context |
| MRF SSO secret | `Authorization: Bearer <MRF_SSO_CLIENT_SECRET>` | One-time SSO code exchange only |

The integration key and SSO secret are different credentials and must never be
reused. Neither belongs in browser JavaScript.

## Partner API Catalog

All paths below include the `/api` prefix. Unless noted otherwise, partner
routes require `X-Integration-Key` and accept:

| Query | Type | Default | Validation |
| --- | --- | --- | --- |
| `schoolYearId` | positive integer | Active year | Existing school year required |
| `page` | positive integer | `1` | Values below 1 are treated as absent |
| `limit` | positive integer | `50` | Maximum `200` |

The `x-school-year-context-id` header is not the integration-v1 selection
contract. Use the `schoolYearId` query parameter. When omitted, EnrollPro uses
the authoritative active school-year pointer and fails closed if active-year
state is missing or inconsistent.

### Route inventory

| Method and path | Additional parameters | Response purpose |
| --- | --- | --- |
| `GET /api/integration/v1/health` | Public; no scope | EnrollPro DB and companion reachability status |
| `GET /api/integration/v1/school-year` | `schoolYearId?` | School-year label and term dates |
| `GET /api/integration/v1/active-term` | `schoolYearId?` | `T1`-`T4`, display label, and term format |
| `GET /api/integration/v1/learners` | `schoolYearId?`, `page?`, `limit?`, `sectionId?`, `gradeLevelId?`, `search?` | Current or archived learner roster |
| `GET /api/integration/v1/students` | Same as `/learners` | Alias of learner roster |
| `GET /api/integration/v1/faculty` | `schoolYearId?`, `page?`, `limit?`, `includeInactive?` | Teacher and designation context |
| `GET /api/integration/v1/teachers` | Same as `/faculty` | Alias of faculty roster |
| `GET /api/integration/v1/staff` | `page?`, `limit?`, `includeInactive?` | Staff accounts; not school-year scoped |
| `GET /api/integration/v1/sections` | `schoolYearId?`, `gradeLevelId?`, `page?`, `limit?` | Section, capacity, grade, and adviser data |
| `GET /api/integration/v1/sections/:sectionId/learners` | `schoolYearId?`, `page?`, `limit?` | One current or archived section roster |
| `GET /api/integration/v1/default/faculty` | `schoolYearId?` | Unpaginated ATLAS-oriented faculty feed |
| `GET /api/integration/v1/default/smart/students` | `schoolYearId?`, `page?`, `limit?` | SMART-oriented grade roster |
| `GET /api/integration/v1/default/smart/transferees` | `schoolYearId?`, `page?`, `limit?` | SMART-oriented transferee roster |
| `GET /api/integration/v1/default/aims/context` | `schoolYearId?`, `page?`, `limit?` | AIMS-oriented learning context |
| `GET /api/integration/v1/default/mrf/identities` | `schoolYearId?`; MRF key specifically required | MRF-approved learner, teacher, and staff identity groups |

MRF should use `/default/mrf/identities`, `/school-year`, and optionally
`/active-term`. Although the generic key middleware currently accepts any
configured companion key on several generic feeds, that is not permission for
MRF to ingest SMART-, AIMS-, or ATLAS-specific datasets.

### School year

```http
GET /api/integration/v1/school-year
X-Integration-Key: <MRF_INTEGRATION_API_KEY>
```

```json
{
  "data": {
    "id": 8,
    "yearLabel": "2029-2030",
    "term1Start": "2029-06-08T00:00:00.000Z",
    "term1End": "2029-09-15T00:00:00.000Z",
    "term2Start": "2029-09-16T00:00:00.000Z",
    "term2End": "2029-12-18T00:00:00.000Z",
    "term3Start": "2030-01-04T00:00:00.000Z",
    "term3End": "2030-04-08T00:00:00.000Z",
    "term4Start": null,
    "term4End": null
  }
}
```

### Learner roster

```http
GET /api/integration/v1/learners?schoolYearId=8&page=1&limit=200
X-Integration-Key: <MRF_INTEGRATION_API_KEY>
```

Current-year records include only `OFFICIALLY_ENROLLED` applications with an
enrollment record. Ordering is grade level, then stable application ID.
Archived years read `EnrollmentHistory` and set
`meta.source="ENROLLMENT_HISTORY"`.

```json
{
  "data": [
    {
      "enrollmentApplicationId": 501,
      "status": "OFFICIALLY_ENROLLED",
      "learnerType": "CONTINUING",
      "applicantType": "REGULAR",
      "learner": {
        "id": 42,
        "externalId": "00000000-0000-4000-8000-000000000042",
        "lrn": "123456789012",
        "firstName": "Juan",
        "lastName": "Dela Cruz",
        "middleName": null,
        "extensionName": null,
        "birthdate": "2013-01-01T00:00:00.000Z",
        "sex": "MALE",
        "userId": 142,
        "isPendingLrnCreation": false,
        "learnerStatus": "ACTIVE",
        "portalAccount": {
          "accountName": "LRN-123456789012",
          "isActive": true,
          "mustChangePassword": false
        }
      },
      "schoolYear": { "id": 8, "yearLabel": "2029-2030" },
      "gradeLevel": { "id": 2, "name": "Grade 8", "displayOrder": 2 },
      "section": { "id": 20, "name": "Rizal", "programType": "REGULAR" },
      "enrolledAt": "2029-06-08T00:00:00.000Z"
    }
  ],
  "meta": {
    "schoolYearId": 8,
    "total": 1,
    "page": 1,
    "limit": 200,
    "totalPages": 1
  }
}
```

### Faculty and staff

`/faculty` returns paginated teacher profiles, active-year designation,
department, advisership, qualifications, contact fields, and pagination meta.
Default ordering is last name then first name. `includeInactive` defaults to
`false`.

`/staff` returns paginated staff identity/account fields, roles, designation,
contact fields, `createdAt`, and `updatedAt`. It is not school-year scoped and
excludes operational password flags. Default ordering is last name then first
name.

### Sections and section learners

`/sections` returns section ID, name, program type, capacity, enrolled count,
available slots, grade level, current adviser, and school year. Ordering is
grade display order then section name.

`/sections/:sectionId/learners` first verifies that the section belongs to the
selected year. Its `data` object contains the section and a `learners` array.
Current years read enrollment records; archived years read enrollment history.
Learners are ordered by record ID for current data and by surname/given name
for archived data.

### Preferred MRF identity feed

```http
GET /api/integration/v1/default/mrf/identities?schoolYearId=8
X-Integration-Key: <MRF_INTEGRATION_API_KEY>
```

This endpoint is intentionally unpaginated and returns three arrays:

```json
{
  "data": {
    "learners": [
      {
        "learnerId": 42,
        "externalId": "00000000-0000-4000-8000-000000000042",
        "lrn": "123456789012",
        "firstName": "Juan",
        "lastName": "Dela Cruz",
        "middleName": null,
        "extensionName": null,
        "accountName": "LRN-123456789012",
        "accountActive": true,
        "learnerStatus": "ACTIVE",
        "enrollmentStatus": "OFFICIALLY_ENROLLED",
        "gradeLevel": { "id": 2, "name": "Grade 8", "displayOrder": 2 },
        "section": { "id": 20, "name": "Rizal", "programType": "REGULAR" }
      }
    ],
    "teachers": [
      {
        "teacherId": 10,
        "employeeId": "1000003",
        "firstName": "Maria",
        "lastName": "Santos",
        "middleName": null,
        "suffix": null,
        "accountName": "1000003",
        "accountActive": true,
        "roles": ["TEACHER"],
        "serviceStatus": "ACTIVE"
      }
    ],
    "staff": [
      {
        "userId": 1,
        "employeeId": "1234501",
        "firstName": "Jose",
        "lastName": "Rizal",
        "middleName": null,
        "suffix": null,
        "accountName": "1234501",
        "roles": ["SYSTEM_ADMIN"],
        "designation": "System Administrator",
        "accountActive": true
      }
    ]
  },
  "meta": {
    "sourceSystem": "ENROLLPRO",
    "consumerSystem": "MRF",
    "generatedAt": "2029-06-08T00:00:00.000Z",
    "scopeSchoolYearId": 8,
    "scopeSchoolYearLabel": "2029-2030",
    "counts": { "learners": 1, "teachers": 1, "staff": 1 }
  }
}
```

Current-year learners are officially enrolled and sectioned. Archived-year
learners come from immutable enrollment history and have
`enrollmentStatus="ARCHIVED"`. Teacher and staff arrays contain currently
active personnel even when an archived learner year is requested; MRF must not
mislabel those personnel rows as historical snapshots.

## Integration Errors

| Status | Body/meaning |
| --- | --- |
| `400` | `VALIDATION_ERROR` for malformed positive-integer query/path values |
| `401` | `{ "error": { "code": "INVALID_INTEGRATION_KEY", ... } }` |
| `404` | Requested school year or section not found |
| `409` | Active school-year pointer missing or inconsistent |
| `500` | Unexpected server/database failure |

MRF should retry only transport failures and selected `5xx` responses with
bounded exponential backoff and jitter. Do not retry `400`, `401`, or `404`
without correcting the request/configuration.

## Synchronization Rules

1. Fetch `/school-year` and retain the returned ID as the synchronization scope.
2. Fetch `/default/mrf/identities?schoolYearId=<id>`.
3. Upsert by stable identifiers: learner `externalId`/LRN, teacher ID/employee
   ID, and user ID/employee ID. Do not match by name alone.
4. Mark missing or inactive identities unavailable for new MRF activity; do not
   erase historical waste or maintenance transactions.
5. Commit the complete mirror atomically, then record source year, generated
   time, row counts, and synchronization outcome.
6. Repeat safely. The feeds are read-only and repeated GETs are idempotent.
7. After school-year rollover, do not show old-year learners as current while
   reconciliation is pending.

## Discovery, Versioning, and Change Management

- **OpenAPI/Swagger:** not currently mounted or exported.
- **Route index endpoint:** not implemented; requesting
  `/api/integration/v1` returns `404` because only concrete child routes exist.
- **Version:** partner routes are namespaced under `/api/integration/v1`.
- **Formal compatibility/SLA policy:** not currently implemented or published.
- **Changelog/event feed:** not currently implemented.

Until formal API governance is added, this document and
`docs/features/integration/ENROLLPRO-API.md` are the maintained catalogs. MRF
and EnrollPro owners must coordinate before a breaking v1 change. New breaking
contracts should be introduced under a new version rather than silently
changing v1.

## Answers to Future Asks

| Ask | Current answer |
| --- | --- |
| Password lifecycle API | Individual learner self-change and protected registrar/admin reset exist. No integration-key or bulk reset API exists. |
| Webhooks/events | No MRF webhook exists. EnrollPro's SSE stream is a staff-JWT browser invalidation stream, not a signed partner event contract. |
| Incremental sync | No `updatedSince` learner filter exists. `/staff` exposes `updatedAt`; the learner and MRF feeds do not provide a complete incremental cursor. Use full reconciliation. |
| Sandbox accounts | No stable credentials are guaranteed. This document intentionally does not publish passwords. Test identities must be provisioned and communicated through an approved secure channel. |
| Integration-key rotation | Keys are server environment values. Rotation currently requires coordinated configuration replacement and service restart. There is no key-management API, key ID, expiry, overlap window, or self-service rotation. |
| Key scopes | `/default/mrf/identities` specifically requires the MRF key. Generic v1 routes accept any configured companion key, so technical scopes are broader than ideal. MRF must follow the approved route list above. |
| SLA and IP allowlist | No uptime SLA or application-level IP allowlist is published. Network/Tailscale access and HTTPS remain deployment responsibilities. MRF should fail closed for authentication and show a service-unavailable message. |
| Bulk operations | No partner bulk portal provisioning or password reset endpoint exists. Identity feeds are bulk reads only. |
| Retention/privacy | Mirror only stable IDs, LRN/employee ID, names, account-active state, role, school year, grade, and section needed for MRF. Do not mirror passwords, birthdates, family, address, health, grades, audit logs, or documents. Retain MRF operational history under MRF policy while disabling new activity for inactive identities. |
| Multi-school | Current deployment behavior assumes one authoritative `SchoolSetting`/active-year context. A supported multi-tenant contract is not implemented. Use separate configured deployment context and keys; never infer tenant from user input. |
| Dev/production parity | The route contract is intended to match, but only the dev base URL is supplied here. Production URL, credentials, rollout window, and smoke test must be coordinated. No automatic contract-parity guarantee exists. |

## Recommended MRF Login Decision Table

| EnrollPro result/state | MRF behavior |
| --- | --- |
| Learner auth `200`, reset false, mirrored account active | Create MRF session and open learner workspace |
| Learner auth `200`, reset true | Block normal entry and require EnrollPro password replacement |
| `400` validation | Show valid 12-digit LRN/password guidance |
| `401 INVALID_LRN` or `INVALID_PASSWORD` | Show generic invalid LRN or password |
| `401 ACCOUNT_INACTIVE` | Show account unavailable and school-contact guidance |
| EnrollPro timeout/unreachable | Fail closed; show authentication service unavailable; do not use cached password validation |
| Learner absent/inactive in latest MRF identity sync | Deny new MRF session and request reconciliation |

## Security Requirements

- Never store, mirror, print, or log EnrollPro passwords.
- Never expose integration keys or SSO secrets to browser code.
- Never put learner JWTs, SSO codes, or secrets in query strings or logs.
- Use HTTPS and server-to-server calls.
- Do not treat possession of an LRN as authentication.
- Do not use names as identity keys.
- Do not share EnrollPro cookies across domains.
- Keep MRF maintenance and waste data in MRF; do not write it into EnrollPro.
- Audit successful/failed synchronization and MRF session creation without
  recording credentials or excessive learner data.

## Implementation References

- `server/src/app.ts`
- `server/src/features/learner/learner.router.ts`
- `server/src/features/learner/learner.controller.ts`
- `server/src/features/auth/auth.router.ts`
- `server/src/features/auth/auth.controller.ts`
- `server/src/features/integration/integration.router.ts`
- `server/src/features/integration/integration.controller.ts`
- `server/src/features/integration/integration.default.controller.ts`
- `server/src/features/integration/integration-api-key.middleware.ts`
- `shared/src/schemas/auth.schema.ts`
- `shared/src/schemas/learner.schema.ts`
- `ARCHITECTURE_MICROSERVICES.md`

