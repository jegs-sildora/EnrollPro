# Risk Register

## Purpose

Risk-focused record for security, compliance, operational, and maintainability concerns.

## Summary

Primary risks involve data privacy, authorization drift, school-year lifecycle correctness, destructive scripts, and integration contract accuracy.

## Detailed Analysis

| Risk | Evidence | Impact | Priority |
| --- | --- | --- | --- |
| Public integration feeds expose learner/faculty data | `/api/integration/v1` routes are documented as public read-only | DPA compliance concern if network boundary fails | High |
| Role taxonomy drift | Prisma `Role` differs from frontend compatibility `REGISTRAR` | Wrong UI access or API 403 behavior | High |
| Query-token auth fallback | `authenticate.ts` accepts `req.query.token` | Tokens can leak through logs/history | Medium |
| School-year transitions are complex | `SchoolYear`, BOSY, EOSY, histories, active setting pointer | Incorrect learner status or sectioning data | High |
| Destructive scripts exist | `server/package.json` includes wipe scripts | Data loss if run against production DB | High |
| API docs drift | API doc routes do not all match `server/src/app.ts` | Integration failures | Medium |

## Dependencies

- [[Security Architecture]]
- [[School Operations]]
- [[API Architecture]]
- [[Technical Debt]]

## Risks

This note is itself a risk register; stale risks should be closed explicitly in [[Decision Log]].

## Recommendations

- Add data privacy threat modeling for public endpoints.
- Require confirmation and environment guards for destructive scripts.
- Create an automated route inventory check.

## Related Notes

- [[Executive Summary]]
- [[Security Findings]]
- [[Refactoring Recommendations]]

