# School Operations

## Purpose

Maps EnrollPro features to school administrative operations.

## Summary

EnrollPro supports school identity/settings, academic-year setup, admissions, enrollment, section management, learner records, teacher/adviser management, BOSY confirmation, EOSY promotion/finalization, remediation, reports, and audit monitoring.

## Detailed Analysis

Operational modules:

- Settings and school profile: `server/src/features/settings`, `client/src/features/settings`
- Academic year lifecycle: `server/src/features/school-year`
- Enrollment monitoring: `server/src/features/admission`, `server/src/features/enrollment`
- Sectioning: `server/src/features/sections`
- Learner masterlist: `server/src/features/students`
- Teacher management: `server/src/features/teachers`
- BOSY: `server/src/features/bosy`
- EOSY: `server/src/features/enrollment/eosy*`
- Reporting/export: `server/src/features/export`
- Audit logs: `server/src/features/audit-logs`

## Dependencies

- [[Enrollment Workflow]]
- [[DepEd Compliance]]
- [[Database Architecture]]

## Risks

- Academic-year pointer changes can affect all active data views.
- BOSY and EOSY workflows need irreversible-step safeguards.
- Staff operations must retain auditability for learner record changes.

## Recommendations

- Add confirmation checkpoints for irreversible school-year transitions.
- Keep school-form exports aligned to current DepEd templates.
- Add operational runbooks for BOSY and EOSY.

## Related Notes

- [[Risk Register]]
- [[Refactoring Recommendations]]
- [[Executive Summary]]

