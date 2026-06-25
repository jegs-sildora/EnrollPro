# Dependencies

## Purpose

Documents major runtime and development dependencies.

## Summary

The main workspace uses pnpm, Node 22, TypeScript, Vite, React, Express, Prisma, PostgreSQL, Zod, Zustand, TanStack Query/Table, Radix UI, and Tailwind CSS v4.

## Detailed Analysis

Root:

- `pnpm@11.5.2`
- Node `>=22.13.0 <23.0.0`
- Workspace packages: `server`, `client`, `shared`

Server:

- Express 5, Prisma 6, pg, Zod, JWT, bcryptjs, cors, helmet, multer, sharp, exceljs.

Client:

- React 19, Vite 8, Tailwind CSS 4, Radix UI, TanStack Query/Table/Virtual, Zustand, React Hook Form, Zod, Motion, Recharts, lucide-react.

Shared:

- Zod and TypeScript contracts.

## Dependencies

- `package.json`
- `pnpm-workspace.yaml`
- `client/package.json`
- `server/package.json`
- `shared/package.json`

## Risks

- Vite and React versions are very current; plugin or ecosystem drift is possible.
- Prisma migrations require careful DB environment selection.

## Recommendations

- Keep lockfile committed and dependency updates deliberate.
- Run both client and server builds after cross-stack changes.
- Document new env vars in `.env.example` files.

## Related Notes

- [[System Overview]]
- [[Technical Debt]]

