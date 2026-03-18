# Plan: Phase 1 - Core Infrastructure & Security

**Goal:** Establish the project foundation, secure the application, and implement the dynamic branding system.

## Wave 1: Database & Security Foundation
### 1.1 Setup Prisma 6 and RBAC with Stateless Invalidation
- **Task 1.1.1:** Update `server/prisma/schema.prisma` for Prisma 6, including the `User` model with `isActive`, `mustChangePassword`, and `updatedAt` fields.
- **Task 1.1.2:** Implement the `authenticate` middleware in `server/src/middleware/authenticate.ts` with stateless session invalidation (`iat` vs. `updatedAt` check).
- **Task 1.1.3:** Create the `authorize` middleware in `server/src/middleware/authorize.ts` for role-based access control.
- **Verification:** Run `npx prisma generate` and verify the middleware returns `401` for tokens issued before a profile update.

### 1.2 Two-Layer Login Guard (Backend & Frontend)
- **Task 1.2.1:** Implement `GET /api/auth/login-token` for issuing single-use, 5-minute pre-flight tokens (Layer 2) in `server/src/controllers/authController.ts`.
- **Task 1.2.2:** Update `POST /api/auth/login` to validate the pre-flight token before checking credentials.
- **Task 1.2.3:** Implement the frontend navigation state guard (Layer 1) in `client/src/router/index.tsx` using React Router v7 loaders.
- **Verification:** Confirm that direct URL visits to `/login` are redirected and that `POST /login` fails without a valid pre-flight token.

## Wave 2: Dynamic Branding & Layout
### 1.3 Dynamic Branding Implementation
- **Task 1.3.1:** Implement the server-side branding service in `server/src/services/branding.ts` using `sharp` and `color-thief-node` for color extraction.
- **Task 1.3.2:** Create the `GET /api/settings/public` endpoint to serve the school name, logo, and extracted accent color.
- **Task 1.3.3:** Implement a branding store in `client/src/stores/brandingStore.ts` to manage and inject CSS variables (`--accent`, `--accent-foreground`) into the document root.
- **Verification:** Upload a logo and verify that the UI accent color updates automatically without a page refresh (using Tailwind v4 variables).

### 1.4 AppLayout & Conditional Sidebar
- **Task 1.4.1:** Build the `AppLayout` in `client/src/layouts/AppLayout.tsx` with a responsive, collapsible sidebar.
- **Task 1.4.2:** Implement the conditional sidebar content based on the user's role (System Admin, Registrar, Teacher).
- **Verification:** Log in with different roles and verify that the sidebar items update correctly according to the role hierarchy.
