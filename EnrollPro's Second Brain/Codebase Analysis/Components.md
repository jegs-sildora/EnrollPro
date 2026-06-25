# Components

## Purpose

Documents frontend component organization and UI surface areas.

## Summary

Frontend components are split between feature-specific components and reusable shared primitives. The UI is dense, registrar-focused, and uses local shadcn/Radix-style primitives.

## Detailed Analysis

Reusable areas:

- `client/src/shared/ui`: buttons, cards, forms, dialogs, tables, sidebars, tabs, inputs, selects, tooltips, and other primitives.
- `client/src/shared/components`: protected routes, page transitions, address selectors, historical banners, privacy notices, pagination, image enlargement, and domain-specific shared pieces.
- `client/src/shared/layouts`: app, auth, learner, public, root, guest, and teacher intake layouts.

Feature components:

- Admission application wizard and tracking.
- Enrollment workflow panels, modals, document management, sectioning workspace.
- BOSY queue and confirmation components.
- Teacher directory/detail/advisory components.
- Student profile tabs and health dialogs.
- Settings/curriculum configuration components.

## Dependencies

- `client/src/index.css`
- `client/src/shared/lib/utils.ts`
- `client/src/shared/hooks`
- [[Frontend Architecture]]

## Risks

- Dense workflows can become inaccessible if keyboard/focus states are not tested.
- Feature-level components may duplicate backend status logic.

## Recommendations

- Prefer shared status display components for enrollment/application states.
- Keep modals focused and include loading/error/empty states.
- Run accessibility checks for multi-step workflows.

## Related Notes

- [[Accessibility Review]]
- [[Design Findings]]
- [[Enrollment Workflow]]

