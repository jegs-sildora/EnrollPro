# EnrollPro → ATLAS handoff: per-personnel ATLAS access toggles (C01)

For the EnrollPro developer or agent. Written by ATLAS Lane C on 2026-10-04. Requested by the ATLAS operator (NJ).

EnrollPro pin: upstream `jegs-sildora/EnrollPro` `0a6b507c2d6a22d83ee9b68dd8976920c5bd231c` (fork `njgrm/EnrollPro` fast-forwarded
to the same commit; the fork had no commits of its own). Every path:line below is at this pin.

## Why

Schools split the work differently, and ATLAS has to follow whatever the school decided:

- School A: **Master Teachers** do both teaching-load assignment and scheduling.
- School B: **Master Teachers** assign teaching load; **Grade Level Coordinators** do scheduling.

So ATLAS access cannot be hard-wired to one designation. The operator's rule: EnrollPro already owns the personnel list and
designations, so ATLAS must **not** duplicate that list or keep a second copy of the config. The switches that decide who may do what in
ATLAS belong in EnrollPro's personnel admin. EnrollPro exposes them in the contract, and ATLAS enforces them at login and on every route.

## What EnrollPro exposes today (verified at the pin)

| Fact | Evidence |
|---|---|
| Application roles include `PRINCIPAL`, `SCHOOL_REGISTRAR`, `STE/SPA/SPS_COORDINATOR`, `GRADE_LEVEL_COORDINATOR` | `server/prisma/schema.prisma:786-801` (`enum Role`) |
| Companion SSO to ATLAS admits only `SYSTEM_ADMIN`, `HEAD_REGISTRAR`, `TEACHER`, `CLASS_ADVISER`, `GRADE_LEVEL_COORDINATOR` | `server/src/features/auth/companion-sso.service.ts:30-36` |
| The SSO exchange identity carries `userId`, `employeeId`, names, and `roles` only; no ancillary roles, position or access flags | `shared/src/schemas/companion-sso.schema.ts:43-61` |
| Faculty feed (`GET /api/integration/v1/faculty`, `/default/faculty`; machine key) carries `plantillaPosition` (e.g. `MASTER TEACHER I`) and merged `ancillaryRoles` (e.g. `GRADE 7 COORDINATOR`) | `server/src/features/integration/integration.controller.ts:661-666` |
| Grade-coordinator scope is derived from the ancillary strings `GRADE 7..10 COORDINATOR` | `server/src/features/sections/grade-level-scope.service.ts:4-9` |
| "Master Teacher" is a plantilla position string only. It is not a role and has no flag. | the `plantillaPosition` free text; `export.controller.ts` matches it by substring |

**Gap:** there is no field anywhere that says "this person may assign teaching load in ATLAS" or "this person may schedule in ATLAS". ATLAS
currently infers scheduling from the four `GRADE N COORDINATOR` ancillary strings (ATLAS
`docs/handoffs/enrollpro-scheduler-role-contract-c01.md`). That fits School B's coordinators but cannot express School A, and it cannot
express a teacher who assigns loads but does not schedule.

## Requested EnrollPro change

### 1. Two toggles per personnel, per school year

In the personnel admin (the Teacher detail panel, beside Ancillary Roles), add an **"ATLAS access"** group with two independent switches:

| Switch | Meaning in ATLAS |
|---|---|
| `Assign teaching load` | may create and change teaching-load assignments |
| `Build schedules` | may edit, generate and review the timetable, and request publication |

- Store them school-year scoped, like `TeacherDesignation.ancillaryRoles`, so they roll over deliberately and can differ by year. Audit
  every change (who, when, old → new) with the existing audit log.
- Only `SYSTEM_ADMIN` / `HEAD_REGISTRAR` (or `PRINCIPAL`, if you prefer) may change them.
- Optional convenience, not a rule: a bulk action such as "turn on for all Master Teachers" or "all Grade Level Coordinators". The stored
  per-person switch stays the authority. ATLAS never reads designations to grant access.
- Defaults for a new school year: copy the previous year's switches (not off), so a rollover never silently locks schedulers out. Show the copy in
  the rollover receipt.

### 2. Expose the switches in both contracts

Use this shape in both places:

```jsonc
"companionAccess": {
  "atlas": {
    "schoolYearId": 12,                 // the year these switches belong to
    "assignTeachingLoad": true,
    "buildSchedules": false,
    "gradeLevelIds": [7]                // optional scope; [] or null = all grades
  }
}
```

- **Companion SSO exchange** (`companionSsoExchangeResponseSchema.identity`): add `companionAccess.atlas` for the active school year when
  `companion === "ATLAS"`, so ATLAS can decide at login without a second call.
- **Faculty feed** (`/api/integration/v1/faculty` and `/default/faculty` rows): add the same `companionAccess.atlas`, plus `userId` (nullable)
  so ATLAS can join a feed row to an SSO identity exactly, rather than by name.
- Treat `companionSsoExchangeResponseSchema` as versioned. Add the field as optional first, so ATLAS can deploy before or after you.

### 3. Admit the roles ATLAS needs at SSO

Add `PRINCIPAL` and `SCHOOL_REGISTRAR` to `ALLOWED_ROLES.ATLAS` (`companion-sso.service.ts:30-36`). ATLAS maps them to an administrator view.
They do not get load or schedule rights unless their switches say so.

## What ATLAS will do with it (not your work; listed so the contract is unambiguous)

- `assignTeachingLoad` → ATLAS capability `teaching-load:manage`. `buildSchedules` → `timetable:edit`, `timetable:generate`, `timetable:review`,
  `timetable:request-publication`, `scheduling-policy:manage`. Both → both. Neither → faculty self-service only.
- ATLAS enforces these on the server routes (Teaching Load and timetable routers) and builds the sidebar from them, so a person sees only the
  pages they can use.
- The ATLAS admin page "People & access" lists personnel with their ATLAS access **read-only, from your feed**, with an "Edit in EnrollPro" link.
  It keeps no second copy.
- Fail closed: a missing field, school-year mismatch, inactive personnel or duplicate match means no load or schedule rights. Until your field
  ships, ATLAS keeps today's coordinator rule.

## Acceptance tests (EnrollPro side)

1. A teacher with only `Assign teaching load` on: the SSO exchange for ATLAS returns `assignTeachingLoad: true, buildSchedules: false`, and the
   faculty feed row matches.
2. Turn both off. The next exchange and feed return both `false`. The audit log has one row per switch.
3. Roll over to a new school year. The switches are copied, and the exchange's `schoolYearId` equals the new active year.
4. A non-admin user cannot change the switches (403).
5. `companionAccess` is absent for `companion !== "ATLAS"`.
6. Existing consumers (AIMS, SMART, MRF) pass unchanged.

## Contact and contract change

Reply with the commit SHA and the final field names in `docs/features/integration/ATLAS-ENROLLPRO-SSO.md`. ATLAS pins your SHA and builds its
side against it.
