# EnrollPro Documentation Index (Code-First Baseline)

Last updated: 2026-04-14

This documentation set is aligned to the current implementation in the EnrollPro monorepo.

## Source of truth order

1. Prisma models and enums in [server/prisma/schema.prisma](../server/prisma/schema.prisma)
2. Shared contracts in [shared/src/constants/index.ts](../shared/src/constants/index.ts) and [shared/src/schemas](../shared/src/schemas)
3. Mounted backend routes in [server/src/app.ts](../server/src/app.ts)
4. Frontend route and state behavior in [client/src/router/index.tsx](../client/src/router/index.tsx), [client/src/store/auth.slice.ts](../client/src/store/auth.slice.ts), and [client/src/store/settings.slice.ts](../client/src/store/settings.slice.ts)

## Implementation pack (new)

- Architecture and debt audit: [core/CODEBASE_AUDIT_IMPLEMENTATION_BASELINE.md](core/CODEBASE_AUDIT_IMPLEMENTATION_BASELINE.md)
- Module coverage map: [core/MODULE_COVERAGE_MATRIX.md](core/MODULE_COVERAGE_MATRIX.md)
- Reality alignment notes (docs vs code): [core/REALITY_ALIGNMENT_NOTES.md](core/REALITY_ALIGNMENT_NOTES.md)
- Legacy docs supersession map: [core/LEGACY_DOCS_SUPERSESSION_MAP.md](core/LEGACY_DOCS_SUPERSESSION_MAP.md)
- Architecture refactor blueprint: [core/ARCHITECTURE_REFACTOR_BLUEPRINT.md](core/ARCHITECTURE_REFACTOR_BLUEPRINT.md)
- Domain model refinement plan: [core/DOMAIN_MODEL_REFINEMENT_PLAN.md](core/DOMAIN_MODEL_REFINEMENT_PLAN.md)
- REST API normalization spec: [core/API_NORMALIZATION_REST.md](core/API_NORMALIZATION_REST.md)
- Security and audit baseline: [core/SECURITY_AUDIT_TRAIL_BASELINE.md](core/SECURITY_AUDIT_TRAIL_BASELINE.md)
- Spec-driven delivery workflow: [core/SPEC_DRIVEN_WORKFLOW_IMPLEMENTATION.md](core/SPEC_DRIVEN_WORKFLOW_IMPLEMENTATION.md)
- Copilot Chat prompt playbook: [core/COPILOT_CHAT_PROMPT_PLAYBOOK.md](core/COPILOT_CHAT_PROMPT_PLAYBOOK.md)

## Module implementation specs (Modules 1-5)

- Module 1: Early Registration (Grade 7-10): [features/admission/MODULE_1_EARLY_REGISTRATION_IMPLEMENTATION_SPEC.md](features/admission/MODULE_1_EARLY_REGISTRATION_IMPLEMENTATION_SPEC.md)
- Module 2: Enrollment Management: [features/enrollment/MODULE_2_ENROLLMENT_IMPLEMENTATION_SPEC.md](features/enrollment/MODULE_2_ENROLLMENT_IMPLEMENTATION_SPEC.md)
- Module 3: SIMS: [features/sims/MODULE_3_SIMS_IMPLEMENTATION_SPEC.md](features/sims/MODULE_3_SIMS_IMPLEMENTATION_SPEC.md)
- Module 4: Teacher Management: [features/teachers/MODULE_4_TEACHER_MANAGEMENT_IMPLEMENTATION_SPEC.md](features/teachers/MODULE_4_TEACHER_MANAGEMENT_IMPLEMENTATION_SPEC.md)
- Module 5: Grade Level and Sectioning: [features/academic-year/MODULE_5_GRADE_SECTIONING_IMPLEMENTATION_SPEC.md](features/academic-year/MODULE_5_GRADE_SECTIONING_IMPLEMENTATION_SPEC.md)

## Ecosystem integration

- Complete EnrollPro API reference: [features/integration/ENROLLPRO-API.md](features/integration/ENROLLPRO-API.md)
- BOSY to EOSY school-year lifecycle: [features/integration/ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md](features/integration/ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md)
- External integration v1 contract: [features/integration/INTEGRATION_API_V1.md](features/integration/INTEGRATION_API_V1.md)

## Note on older docs

Several existing documents under docs/core and docs/features describe target-state behavior that is not fully implemented yet. Keep using them for long-term direction, but use the implementation pack above for current engineering decisions and acceptance testing.
