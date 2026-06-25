# Frontend Architecture

## Purpose

Maps the React client structure, routing, state, UI patterns, and front-end risks.

## Summary

The frontend is a React 19 Vite app using React Router, Zustand, TanStack Query, shared UI primitives, Tailwind CSS v4, and feature-oriented pages.

## Detailed Analysis

Key files:

- `client/src/main.tsx`: app bootstrap.
- `client/src/App.tsx`: app shell entry.
- `client/src/router/index.tsx`: route tree and role gates.
- `client/src/store/auth.slice.ts`: persisted auth user state.
- `client/src/store/settings.slice.ts`: school settings and historical-correction state.
- `client/src/shared/layouts`: staff, public, auth, learner, and teacher layouts.
- `client/src/shared/ui`: local UI primitives.

Feature folders include `admin`, `admission`, `audit-logs`, `auth`, `bosy`, `dashboard`, `enrollment`, `intake`, `integration`, `learner`, `reading-assessment`, `sections`, `settings`, `students`, and `teachers`.

## Dependencies

- `@enrollpro/shared`
- `@tanstack/react-query`
- `zustand`
- `react-router`
- Radix UI, lucide-react, Tailwind CSS v4

## Risks

- `AuthRole` intentionally admits arbitrary strings, which weakens role-based UI guarantees.
- Some screens may duplicate domain logic that should be owned by shared schemas or backend responses.
- Accessibility requires continuous checks for dense registrar/admin workflows.

## Recommendations

- Prefer shared schemas and typed API response interfaces for feature modules.
- Keep role and navigation rules derived from a canonical matrix.
- Use [[Accessibility Review]] before shipping major workflow screens.

## Related Notes

- [[Components]]
- [[Routes]]
- [[Design Findings]]
- [[User Roles]]

