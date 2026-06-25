# Decision Log

## Purpose

Append-only record of audit conclusions, rationale, and recommended action.

## Summary

Initial audit decisions were made from local repository inspection on 2026-06-25.

## Detailed Analysis

Date: 2026-06-25  
Finding: The repository root should be treated as the Obsidian vault.  
Evidence: `prompts/task-01.md` explicitly states that the project root directory itself is the Obsidian Vault. Existing `EnrollPro's Second Brain/` only contains `.obsidian` config files.  
Impact: Notes are created at root-level folders such as `AI-Memory`, `Architecture`, and `Reports`.  
Recommendation: Keep root-level notes as the canonical project memory; migrate Obsidian app config later if desired.

Date: 2026-06-25  
Finding: `server/prisma/schema.prisma` is the primary source of truth for domain structure.  
Evidence: `docs/README.md` and `AGENTS.md` both identify Prisma schema first in source-of-truth order, and code uses Prisma models throughout backend controllers.  
Impact: Database notes should be regenerated or checked whenever schema changes.  
Recommendation: Link every domain process to relevant Prisma models.

Date: 2026-06-25  
Finding: API documentation needs reconciliation with mounted routes.  
Evidence: `docs/features/integration/ENROLLPRO-API.md` documents some route groups not mounted in `server/src/app.ts`, including curriculum and early-registration paths.  
Impact: External consumers or agents may call unavailable endpoints.  
Recommendation: Add a route-audit task to reconcile docs with routers.

Date: 2026-06-25  
Finding: Role taxonomy is inconsistent.  
Evidence: Prisma enum includes `SYSTEM_ADMIN`, `HEAD_REGISTRAR`, `CLASS_ADVISER`, `TEACHER`, `LEARNER`, `MRF`; frontend `AuthRole` also admits `REGISTRAR`.  
Impact: UI and backend access checks can diverge.  
Recommendation: Define a canonical role matrix and migrate compatibility role names.

## Dependencies

- [[Current Findings]]
- [[Risk Register]]
- [[Refactoring Recommendations]]

## Risks

- Decision log entries can become stale if not updated after implementation changes.

## Recommendations

- Append entries rather than rewriting history.
- Include code evidence and impact for each decision.

## Related Notes

- [[Open Questions]]
- [[Technical Debt]]

