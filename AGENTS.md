# Repository Guidelines

## Project Structure & Module Organization

EnrollPro is a pnpm workspace with three primary packages:

- `client/`: React 19 + Vite frontend. Code lives in `client/src`, with feature modules in `features/`, routes in `router/`, shared UI/helpers in `shared/`, state in `store/`, and static assets in `assets/`.
- `server/`: Express 5 + Prisma backend. Entry points are `server/src/app.ts` and `server/src/server.ts`; domain code is under `features/`, utilities under `lib/` and `middleware/`, and Prisma files under `prisma/`.
- `shared/`: workspace package for cross-app schemas, types, and constants exported from `shared/src`.

The nested `SMART/CapstoneFinal/` project is a separate app with its own package files. Do not mix EnrollPro workspace changes with SMART changes unless the task explicitly asks for it.

Generated output and local artifacts such as `dist/`, `node_modules/`, `server/uploads/`, screenshots, stress reports, and TypeScript build info are not source.

## Build, Test, and Development Commands

- `pnpm install`: install workspace dependencies. Use Node `>=22.13.0 <23.0.0`; the repo pins `pnpm@11.5.2`.
- `pnpm dev`: run client and server dev processes together.
- `pnpm dev:client`: start the Vite frontend with host binding.
- `pnpm dev:server`: start the API with `tsx watch`.
- `pnpm --filter client build`: type-check and build the frontend.
- `pnpm --filter server build`: compile the backend TypeScript.
- `pnpm --filter client lint`: run ESLint on frontend TypeScript and React files.
- `pnpm --filter server db:migrate`: apply Prisma migrations in development.
- `pnpm --filter server db:generate`: regenerate Prisma client.
- `pnpm --filter server db:seed`: seed the configured database.

## Source of Truth

Use this order when behavior and documentation disagree:

1. Prisma models and enums in `server/prisma/schema.prisma`.
2. Shared contracts in `shared/src/constants/index.ts` and `shared/src/schemas`.
3. Mounted backend routes in `server/src/app.ts`.
4. Frontend routes and state behavior in `client/src/router/index.tsx` and `client/src/store/`.
5. Current documentation index in `docs/README.md`.

Older docs may describe target-state behavior that is not implemented yet. Prefer the implementation pack linked from `docs/README.md` for current engineering decisions.

## Coding Style & Naming Conventions

Use TypeScript and ES modules throughout. Follow the existing two-space indentation and semicolon-free style. React components use `PascalCase`, hooks use `useCamelCase`, and functions, variables, and route handlers use `camelCase`.

Avoid `any`. Use specific interfaces, generics, or `unknown` when a type is not yet known. Keep feature code inside the relevant `features/` module and move only reusable contracts into `shared/src`.

On the frontend, prefer the existing shared UI components and `@/` imports. On the backend, keep routers/controllers/services in the local feature folder and validate request payloads with shared Zod schemas when available.

## Express, API, and Runtime Notes

The server uses Express 5. Avoid legacy wildcard path strings such as `*`; use regular expressions or named parameters for catch-all routes.

The frontend should use relative API routing for the production monolith setup, typically `VITE_API_URL="/api"`, so the app works across local, Tailscale, and hosted domains.

## Verification Guidelines

The repository does not maintain an integration test suite. Verify changes with the client and server builds, focused manual workflow checks, and direct API smoke checks where appropriate. Preserve the ownership boundaries in `ARCHITECTURE_MICROSERVICES.md` when validating EnrollPro interactions with SMART, AIMS, ATLAS, and MRF.

For frontend changes, run `pnpm --filter client lint` and `pnpm --filter client build` when practical. For backend changes, run `pnpm --filter server build` and validate affected routes against the mounted routers in `server/src/app.ts`.

## Commit & Pull Request Guidelines

Recent history uses short imperative subjects, often Conventional Commit style such as `feat: ...` or `feat(api): ...`. Prefer that format and keep subjects specific.

Pull requests should describe the change, list verification commands, call out database or environment changes, link issues, and include screenshots or recordings for UI changes.

## Security & Configuration Tips

Do not commit `.env` files. Start from `client/.env.example` and `server/.env.example`, and document any new required variables in those examples.

Treat wipe, reset, and seed scripts in `server/package.json` as destructive unless working against a disposable local database. Be careful with uploaded files, logos, generated documents, learner records, and other school data.
