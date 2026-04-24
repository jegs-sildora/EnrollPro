# Plan: Remove Email Notifications

## Objective
Remove all email notification features, logging, and related SMTP configurations from the system while preserving user `email` fields for authentication and contact purposes.

## Key Files & Context
- `server/prisma/schema.prisma`
- `server/package.json`
- `server/src/features/admission/services/early-registration-shared.service.ts`
- `server/src/features/admin/admin-email-log.controller.ts`
- `server/src/features/admin/admin-system.controller.ts`
- `server/prisma/wipe.ts`
- `shared/src/schemas/application.schema.ts`
- `shared/src/constants/index.ts`
- `client/src/features/admin/pages/EmailLogs.tsx`
- `client/src/router/index.tsx`
- `client/src/features/admin/pages/SystemHealth.tsx`
- `server/.env.example`
- `INSTALLATION.md`

## Implementation Steps

### 1. Database & Schema
- Edit `server/prisma/schema.prisma`:
  - Delete the `EmailLog` model.
  - Remove the `emailLogs` relation from `Applicant` or other related models.
- Run Prisma migration: `npx prisma migrate dev --name remove_email_logs` (or similar depending on local setup).
- Edit `shared/src/schemas/application.schema.ts`: Remove the `sendEmail: z.boolean().default(true)` field.
- Edit `shared/src/constants/index.ts`: Remove `EmailTriggerEnum` and `EmailStatusEnum`.

### 2. Server Cleanup
- Delete `server/src/features/admin/admin-email-log.controller.ts`.
- Edit `server/src/features/admin/admin-system.controller.ts`: Remove logic counting `emailLogs` for the health dashboard and remove it from the returned payload.
- Edit `server/src/features/admission/services/early-registration-shared.service.ts`: Delete the `queueEmail` function entirely.
- Update Admission/Registration Controllers (e.g., `early-reg.controller.ts`, `early-registration.*.controller.ts`): Remove all instances of calling `queueEmail()`.
- Update `server/prisma/wipe.ts`: Remove logic that deletes the `EmailLog` table.
- Uninstall `nodemailer`: Run `pnpm remove nodemailer @types/nodemailer` in the `server` directory.
- Verify that `server/src/app.ts` or routes no longer reference the deleted `admin-email-log.controller.ts`.

### 3. Client Cleanup
- Delete `client/src/features/admin/pages/EmailLogs.tsx`.
- Edit `client/src/router/index.tsx`: Remove the imported `EmailLogs` component and its route (`/admin/email-logs`).
- Search for and remove any sidebar navigation links pointing to the Email Logs page (e.g., in `client/src/shared/components/...` or similar).
- Edit `client/src/features/admin/pages/SystemHealth.tsx`: Remove the `emailLogs` metric from the UI and interface.
- Edit `client/src/features/admission/components/PipelineBatchView.tsx`: Remove `sendEmail` from request payloads.
- Edit `client/src/features/enrollment/hooks/useApplicationDetail.ts`: Remove `EmailLog` interface and any references.
- Edit `client/src/features/enrollment/components/StatusTimeline.tsx`: Remove comments/code referencing `emailLogs`.

### 4. Configuration & Documentation
- Edit `server/.env.example`: Remove all `SMTP_` variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
- Edit `INSTALLATION.md`: Remove the section describing SMTP setup and email capabilities.

## Verification & Testing
- **Type Checking:** Run `pnpm tsc` or `pnpm build` across `shared`, `server`, and `client` to ensure no broken references remain.
- **Unit Tests:** Run the test suite (`pnpm test`) to verify nothing depends on `queueEmail` or `EmailLog`. Update any test files that supplied `sendEmail: true` if they fail schema validation.
- **Manual Verification:** 
  - Ensure the Admin Dashboard (`/admin/system-health`) loads successfully.
  - Verify that the Email Logs page is gone.
  - Submit a mock application/registration to verify that no errors are thrown due to the missing `queueEmail` function.
