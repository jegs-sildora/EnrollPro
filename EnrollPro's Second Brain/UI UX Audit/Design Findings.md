# Design Findings

## Purpose

Captures UI/UX observations and design risks.

## Summary

The app is operational rather than marketing-oriented, which fits registrar/admin workflows. The design system should prioritize density, scanability, clear status language, and low-friction bulk actions.

## Detailed Analysis

Strengths:

- Feature-specific workspaces match school operations.
- Shared UI primitives provide consistency.
- Layouts separate public, learner, staff, and teacher contexts.
- Status badges and workflow tabs help users orient themselves.

Risks:

- Too many statuses can confuse non-technical school staff.
- Similar enrollment states across admission, BOSY, EOSY, and sectioning need consistent copy.
- Batch actions need strong confirmation and rollback communication.

## Dependencies

- [[Components]]
- [[Enrollment Workflow]]
- [[User Roles]]

## Risks

- Inconsistent labels can reduce registrar trust and increase training load.
- Dense tables can be difficult on small screens.

## Recommendations

- Create a canonical status language guide.
- Use role-specific empty states that explain operational next steps.
- Keep destructive or irreversible actions visibly distinct and auditable.

## Related Notes

- [[Accessibility Review]]
- [[DepEd Compliance]]

