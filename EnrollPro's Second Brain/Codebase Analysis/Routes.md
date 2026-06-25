# Routes

## Purpose

Route inventory for backend API and frontend pages.

## Summary

Backend routes are feature routers mounted in `server/src/app.ts`. Frontend routes are declared in `client/src/router/index.tsx` and guarded by role-aware `ProtectedRoute` components.

## Detailed Analysis

Backend route groups:

- Health/debug: `/api/health`, `/api/ping`, `/api/debug-server`
- Auth: `/api/auth`
- Admin/system: `/api/admin`, `/api/system`, `/api/audit-logs`
- Settings/year: `/api/settings`, `/api/school-years`, `/api/school-year`
- Learners/enrollment: `/api/applications`, `/api/enrollment`, `/api/enrollment-listings`, `/api/students`, `/api/learner`
- School operations: `/api/sections`, `/api/sectioning`, `/api/bosy`, `/api/eosy`, `/api/teacher-eosy`, `/api/remedial`, `/api/reading-assessment`
- Exports/integration/reference: `/api/export`, `/api/integration`, `/api/integration/v1`, `/api/address`, `/api/geography`

Frontend route groups:

- Public learner/applicant: `/enrollment`, `/monitor`, `/learner/login`, `/learner/portal`
- Staff auth: `/staff/login`
- Registrar/admin: `/dashboard`, `/monitoring/enrollment`, `/eosy`, `/continuing-learners`, `/students`, `/sections`, `/settings`, `/intake`
- System admin: `/teachers`, `/admin/users`, `/admin/system`, `/admin/integration`, `/audit-logs`
- Teacher/adviser: `/teacher/eosy`, `/teacher/advisory`

## Dependencies

- `server/src/app.ts`
- `server/src/features/*/*.router.ts`
- `client/src/router/index.tsx`

## Risks

- API docs need reconciliation against live route groups.
- Frontend route guards are not a substitute for backend authorization.

## Recommendations

- Generate route tables from router files in future audits.
- Keep route-level role matrix in [[User Roles]].

## Related Notes

- [[API Architecture]]
- [[Security Architecture]]

