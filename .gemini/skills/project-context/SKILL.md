# EnrollPro Project Context Skill

This skill provides the foundational architecture, tech stack, and engineering standards for the **EnrollPro** project. Use this context to ensure all code generation and analysis align with the existing system's design.

## 🏗️ Architecture & Tech Stack

### Core Technologies
- **Monorepo:** `pnpm` workspace management.
- **Frontend (Client):** React 19, Vite, React Router 7, Zustand (state), Tailwind CSS v4, Radix UI/Shadcn UI.
- **Backend (Server):** Node.js, Express 5, Prisma 6 ORM, PostgreSQL.
- **Language:** TypeScript (Strict mode).
- **Validation:** Zod (both frontend and backend).

### Architectural Patterns
- **Frontend:** Component-based with Shadcn UI components in `client/src/components/ui`. Modular routes in `client/src/router`. API calls centralized in `client/src/api/axiosInstance.ts`.
- **Backend:** Layered architecture (Routes -> Controllers -> Services/ORM). Global error handling via `server/src/middleware/errorHandler.ts`. Validation middleware using Zod in `server/src/middleware/validate.ts`.

## 🛠️ Engineering Standards & "Definition of Done"

### 1. Code Consistency & Typing
- **TypeScript First:** All new code MUST be written in TypeScript.
- **Strict Typing:** Avoid `any` at all costs. Use explicit interfaces or types for all data structures (props, state, API responses).
- **Zod Validation:** Define Zod schemas for all forms (frontend) and API request bodies (backend). Use `z.infer` to derive types from schemas.

### 2. Styling & UI
- **Tailwind CSS v4:** Use Tailwind utility classes for all styling. Follow the existing color palette and spacing conventions.
- **Shadcn UI:** Reuse or extend existing UI components in `client/src/components/ui`. Maintain consistency with the established "EnrollPro" design language.

### 3. API & State
- **Backend Controllers:** Keep controllers lean; delegate complex logic to services where possible. Use the `errorHandler` middleware for all exceptions.
- **Frontend API:** Use `client/src/api/axiosInstance.ts` for all requests. Handle loading and error states consistently (e.g., using `useApiToast.ts`).
- **State Management:** Use Zustand for global application state (e.g., `authStore`, `settingsStore`). Prefer `useState` for component-local state.

### 4. Database & Prisma
- **Schema Updates:** When modifying `server/prisma/schema.prisma`, ensure you also run `pnpm run db:generate` and provide migrations via `pnpm run db:migrate`.
- **Naming Conventions:** Follow existing Prisma model naming (CamelCase for models, camelCase for fields).

### 5. Testing & Verification
- **New Features:** Include basic unit or integration tests in `server/src/tests` for critical backend logic.
- **Validation:** Always verify changes by running `pnpm run lint` and ensuring the build succeeds (`pnpm run build`).

### 6. Security
- **Auth:** Use the `authenticate` and `authorize` middlewares for protected routes.
- **Data Protection:** Never log sensitive information (passwords, tokens). Ensure all user-provided data is validated via Zod.

## 📁 Workspace Conventions
- **Client Root:** `client/`
- **Server Root:** `server/`
- **Uploads:** `server/uploads/`
- **API Prefix:** `/api/`
