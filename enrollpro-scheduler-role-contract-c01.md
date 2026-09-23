# EnrollPro Handoff — Scheduler Role Contract C01

## Objective

Make the four designated personnel eligible for ATLAS's least-privilege
`scheduler` role by emitting the authoritative EnrollPro application role
`GRADE_LEVEL_COORDINATOR` together with `TEACHER`.

ATLAS source support is already integrated at
`68e373108996b64c5e4470a5479aea1c2c0772ce`. ATLAS deliberately fails closed
when the current EnrollPro assertion does not contain the exact coordinator
role. Ancillary-role text, personnel designations, names, and employee IDs are
not authorization signals.

## Accounts in scope

| Employee ID | Personnel | Existing ancillary responsibilities | Required application roles |
| --- | --- | --- | --- |
| `1234506` | Juan Miguel Santos | STE Head Teacher; Grade 7 Coordinator | `TEACHER`, `GRADE_LEVEL_COORDINATOR` |
| `1234507` | Maria Angela Reyes | SPA Head Teacher; Grade 8 Coordinator | `TEACHER`, `GRADE_LEVEL_COORDINATOR` |
| `1234508` | Jose Gabriel Cruz | SPS Head Teacher; Grade 9 Coordinator | `TEACHER`, `GRADE_LEVEL_COORDINATOR` |
| `1234509` | Anna Patricia Garcia | Grade 10 Coordinator | `TEACHER`, `GRADE_LEVEL_COORDINATOR` |

Do not add ATLAS administrator, system-administrator, registrar, or equivalent
broad roles to these accounts.

## Current defect

`server/prisma/seeds/task-01-users-seed.ts` currently creates these users with
only the `TEACHER` application role. Their grade-coordinator responsibilities
exist only as ancillary assignments. The user upsert has an empty update branch,
so rerunning the seed does not repair existing user-role rows.

Consequently, EnrollPro `/auth/verify` and companion SSO currently cannot prove
the exact role ATLAS requires.

## Required EnrollPro changes

1. Update the seed/source-of-truth so all four users receive both required
   application roles on initial creation.
2. Add an idempotent, reviewed upgrade path for already-created rows. It must
   add the coordinator application role without deleting legitimate existing
   roles or resetting account credentials.
3. Ensure the successful `/auth/verify` response exposes the current application
   roles and includes the exact string `GRADE_LEVEL_COORDINATOR`.
4. Ensure the EnrollPro-to-ATLAS companion SSO identity/callback assertion exposes
   the same current role set.
5. Ensure role removal is reflected immediately: after coordinator authority is
   revoked, subsequent verification and SSO assertions must omit the role.
6. Preserve the existing teacher profile, department, ancillary assignments,
   active status, and first-login password-change requirement.
7. Do not reset, log, document, or transmit any password as part of this change.

## Acceptance tests

- Each in-scope account resolves to a deduplicated role set containing exactly
  the required teacher and coordinator authority, plus only any independently
  authorized pre-existing roles.
- An existing in-scope database row is upgraded; acceptance must not rely only
  on creating a fresh row.
- `/auth/verify` returns `TEACHER` and `GRADE_LEVEL_COORDINATOR` for each in-scope
  account after successful authentication.
- Companion SSO returns the same two role claims for each in-scope account.
- A normal teacher without coordinator authority does not receive
  `GRADE_LEVEL_COORDINATOR`.
- Removing coordinator authority causes the next verification and SSO assertion
  to omit it; no stale claim remains.
- Existing password hash and first-login replacement state are preserved by the
  role upgrade.
- Existing personnel profiles, departments, and ancillary assignments are
  unchanged.

## Required developer handback

Return one concise handoff containing:

- base SHA and candidate SHA;
- exact changed paths;
- database/seed upgrade mechanism for existing accounts;
- focused tests and results for create, existing-row upgrade, negative teacher,
  role removal, `/auth/verify`, and companion SSO;
- confirmation that no credential was changed or exposed;
- whether any EnrollPro migration, seed execution, or deployment remains pending.

Do not edit ATLAS from the EnrollPro change. EnrollPro migration/seed execution
and deployment are separate operational actions and must follow EnrollPro's own
approval process.
