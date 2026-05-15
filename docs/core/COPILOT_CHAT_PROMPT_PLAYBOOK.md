# Copilot Chat Prompt Playbook (EnrollPro)

Last updated: 2026-04-14

Use these prompts with Copilot Chat to speed up implementation while preserving repo conventions.

## 1. Refactor existing code

Prompt:

"Refactor [target file] to extract [specific concern] into a service without changing API behavior. Keep existing status transitions and audit logging intact. Use current coding style and keep all new docs under docs/."

Example target:

- server/src/features/admission/early-registration.controller.ts

## 2. Generate Prisma-safe schema updates

Prompt:

"Propose a Prisma migration for [new field/model], including backward-compatible nullable rollout, data backfill strategy, and updates needed in shared/src/constants and shared/src/schemas. Show migration sequencing and regression risks."

## 3. Build endpoint with Zod validation

Prompt:

"Implement REST endpoint [method/path] in existing feature module using validate middleware and shared Zod schema. Include consistent error codes (VALIDATION_ERROR, INVALID_STATE, CONFLICT) and auditLog call with subjectType and recordId."

## 4. Build TSX page from existing patterns

Prompt:

"Create [page/component] under [feature path] using existing UI primitives, axiosInstance, and settings school-year scope pattern (viewingSchoolYearId fallback). Include loading, empty, and error states matching current style."

## 5. Add module spec documentation

Prompt:

"Update docs/features/[module]/[file].md to reflect actual code behavior only. Mark each item as Implemented, Partial, or Planned. Add user stories, acceptance criteria, edge cases, API endpoints, and best UX/UI approach for low-infrastructure registrar workflows."

## 6. Contract-first API normalization

Prompt:

"Normalize endpoint docs for [feature] with request/response examples and error taxonomy. Keep REST style and preserve backward compatibility with existing routes."

## 7. Audit coverage review

Prompt:

"Review [feature controllers] and list mutation endpoints missing auditLog calls. Propose minimal patch set to add structured actionType, description, subjectType, recordId, and request context."

## 8. Frontend duplication reduction

Prompt:

"Find duplicated logic between [file A] and [file B]. Extract reusable hooks/components while preserving behavior. Prioritize stepper state, draft persistence, and status rendering consistency."

## 9. Safe implementation checklist prompt

Prompt:

"Before editing, list affected routes, schemas, stores, and docs. After editing, run build/lint checks and summarize regression risks and fallback plan."

## 10. Anti-drift prompt for docs

Prompt:

"Compare docs statements in [docs file] against code in [source files]. Rewrite mismatched sections to code-first truth and move aspirational behavior into a clearly labeled roadmap section."

## 11. Type-safe Prisma seed prompt

Prompt:

"Implement or fix [seed/file] using the repo's actual Prisma schema and generated client. Do not guess field names, enum values, or relation shapes. Strictly avoid `any`. Do not use `as const` or readonly arrays when the value will be passed into mutable Prisma inputs such as `in`, `createMany`, or seed helper arrays. If a type is unclear, inspect the source of truth first; if it is still unclear, ask for clarification instead of inventing a shape. Preserve deterministic seeding and validate the touched file before finishing."

Short version:

"Fix [seed/file] against the real Prisma schema. No `any`. No invented fields. No readonly arrays where Prisma needs mutable `string[]` inputs. Inspect the source of truth first, then validate the file after editing."
