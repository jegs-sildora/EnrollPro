# Repository Guidelines

## Project Structure & Module Organization

EnrollPro is a pnpm workspace with three packages:

- `client/`: React 19 + Vite frontend. Code lives in `client/src`, with features in `features/`, routes in `router/`, shared UI/helpers in `shared/`, state in `store/`, and static assets in `assets/`.
- `server/`: Express + Prisma backend. Entry points are `server/src/app.ts` and `server/src/server.ts`; domain code is under `features/`, utilities under `lib/` and `middleware/`, and tests under `server/src/tests`.
- `shared/`: workspace package for cross-app schemas, types, and constants exported from `shared/src`.

Generated output and local artifacts such as `dist/`, `node_modules/`, `server/uploads/`, screenshots, and stress reports are not source.

## Build, Test, and Development Commands

- `pnpm install`: install workspace dependencies. Use Node `>=22.13.0 <23`.
- `pnpm dev`: run client and server dev processes together.
- `pnpm dev:client`: start the Vite frontend with host binding.
- `pnpm dev:server`: start the API with `tsx watch`.
- `pnpm --filter client build`: type-check and build the frontend.
- `pnpm --filter server build`: compile the backend TypeScript.
- `pnpm --filter client lint`: run ESLint on frontend TypeScript and React files.
- `pnpm --filter server test:integration`: run backend integration tests.
- `pnpm --filter server db:migrate` and `pnpm --filter server db:generate`: apply Prisma migrations and regenerate Prisma client.

## Coding Style & Naming Conventions

Use TypeScript and ES modules throughout. Follow the existing two-space indentation and semicolon-free style. React components use `PascalCase`, hooks use `useCamelCase`, and functions, variables, and route handlers use `camelCase`. Keep feature code inside the relevant `features/` module and move only reusable contracts into `shared/src`.

## Testing Guidelines

Backend tests are TypeScript files named `*.test.ts` under `server/src/tests`; root-level `server/test_*.ts` scripts are ad hoc checks. Add coverage near changed domain behavior, especially enrollment lifecycle, rollover, integration, and Prisma workflows. Run targeted tests with `tsx src/tests/<name>.test.ts` from `server/` or use `pnpm --filter server test:integration`.

## Commit & Pull Request Guidelines

Recent history uses short imperative subjects, often Conventional Commit style such as `feat: ...` or `feat(api): ...`. Prefer that format and keep subjects specific. Pull requests should describe the change, list verification commands, call out database or environment changes, link issues, and include screenshots or recordings for UI changes.

## Security & Configuration Tips

Do not commit `.env` files. Start from `client/.env.example` and `server/.env.example`, and document any new required variables in those examples. Treat wipe and seed scripts in `server/package.json` as destructive unless working against a disposable local database.
