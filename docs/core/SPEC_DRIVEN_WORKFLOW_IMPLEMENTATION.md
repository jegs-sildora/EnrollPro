# Spec-Driven Workflow Implementation

Last updated: 2026-04-14

## 1. Pipeline

Requirement -> Schema -> API -> UI -> Validation -> Testing

This is the mandatory order for all new changes in Modules 1-5.

## 2. Stage details

## 2.1 Requirement

Output:

- user story
- acceptance criteria
- edge cases
- role matrix impact

Store in docs/features/<module>/ module spec files.

## 2.2 Schema

Output:

- Prisma model/enum change or no-change decision
- shared constants and zod schema updates

Source files:

- server/prisma/schema.prisma
- shared/src/constants/index.ts
- shared/src/schemas/\*.schema.ts

## 2.3 API

Output:

- route additions/changes
- request/response shape
- error code mapping
- audit event mapping

Source files:

- server/src/features/_/_.router.ts
- server/src/features/_/_.controller.ts

## 2.4 UI

Output:

- page/component updates
- loading/empty/error states
- online vs F2F differences where applicable

Source files:

- client/src/features/\*_/_

## 2.5 Validation

Output:

- zod constraints and state-transition checks
- guardrail handling for invalid states

## 2.6 Verification

Output:

- successful client and server builds
- direct API smoke checks for affected endpoints
- key UI smoke checks for primary paths

## 3. Tooling recommendations

Current stack compatible tools:

1. Prisma for schema and migration control.
2. Zod for contract-first validation.
3. OpenAPI-ready contract docs (planned next layer).
4. Direct API smoke checks against routes mounted in server/src/app.ts.

## 4. Done criteria template

A change is done only if:

1. module spec updated,
2. schema/contracts updated,
3. API and UI implemented,
4. errors and audits mapped,
5. verification checklist passed,
6. docs updated to implemented reality.

## 5. Example mini-flow: add new enrollment blocker rule

1. Requirement: define blocker and role visibility.
2. Schema: extend checklist or derived rule logic.
3. API: enforce in enroll action and return INVALID_STATE with detail.
4. UI: show blocker reason list in enrollment panel.
5. Validation: add zod and service-level checks.
6. Testing: add script coverage for pass/fail cases.
