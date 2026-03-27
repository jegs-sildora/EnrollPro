---
name: backend
description: Specialized in backend development using Node.js (Express 5), Prisma v6, TypeScript v5.9, and PostgreSQL. Trigger this skill whenever the user asks to:
  - Create or modify REST API endpoints (controllers, routes).
  - Define or update database models (Prisma schema).
  - Implement server-side logic (services, validation with Zod).
  - Manage backend authentication, file uploads (Sharp, Multer), or email (Nodemailer).
  - Configure or refactor the backend project structure (tsconfig, package.json).
---

# Backend Development Skill

Expert in the EnrollPro backend stack. Follow these patterns for consistency and quality:

## Core Tech Stack
- **Framework**: Express 5 (Express.js)
- **ORM**: Prisma v6 (PostgreSQL)
- **Validation**: Zod (all API inputs must be validated)
- **Typing**: TypeScript v5.9+ with strong typing (Interfaces/Types for models and payloads)
- **Runtime**: Node.js (ESM with `.js` extensions in imports)

## Naming Conventions
- **Database**: Use `@map` and `@@map` in Prisma schema to map camelCase fields/models to snake_case in PostgreSQL.
- **Code**: Use camelCase for variables, functions, and file names (except for `.controller.ts` vs `.routes.ts` - follow existing patterns).

## Implementation Guidelines

### Controllers
- Controllers should be `async` and return `Promise<void>`.
- Use `Request` and `Response` types from `express`.
- Access `req.user` for authenticated routes (populated by `authenticate` middleware).
- Perform database operations through the `prisma` client instance from `../lib/prisma.js`.

**Example Controller:**
```typescript
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { auditLog } from '../services/auditLogger.js';

export async function createItem(req: Request, res: Response): Promise<void> {
  const { name, value } = req.body;
  const item = await prisma.item.create({ data: { name, value } });
  
  await auditLog({
    userId: req.user!.userId,
    actionType: 'ITEM_CREATED',
    description: `Created item ${item.id}`,
    req,
  });
  
  res.status(201).json(item);
}
```

### Services
- Use services for shared, complex, or reusable business logic.
- Avoid putting large amounts of logic directly in controllers (refactor to services if the controller grows too large).

### Routes & Validation
- Define routes in `server/src/routes/*.routes.ts`.
- Define Zod schemas in `server/src/validators/*.validator.ts`.
- Always use the `validate` middleware with a Zod schema for input-heavy routes (POST/PUT/PATCH).

**Example Route:**
```typescript
import { Router } from 'express';
import { createItem } from '../controllers/itemController.js';
import { validate } from '../middleware/validate.js';
import { itemSchema } from '../validators/item.validator.js';

const router = Router();
router.post('/', validate(itemSchema), createItem);
export default router;
```

### Prisma
- When modifying `schema.prisma`, ensure you use `@map` for all fields to maintain PostgreSQL naming conventions (`snake_case`).
- Use `@default(now())` and `@updatedAt` for timestamps.
- Ensure all models have `@@map` to use lowercase pluralized table names in snake_case (e.g., `@@map("users")`).
- Run `npx prisma migrate dev` or `npx prisma generate` after schema changes.

## Best Practices
- **Security**: Always use `authenticate` middleware for protected routes.
- **Audit Logging**: Use `auditLog` for any operation that changes data (create, update, delete) or login/logout.
- **Error Handling**: Allow the `errorHandler` middleware to catch thrown errors (or return early with structured error responses).
- **ESM**: Use `.js` extension in all relative imports (e.g., `import { x } from './y.js'`).
- **Performance**: Use pagination for lists and `select` to only fetch necessary fields from the database.
- **Validation**: Don't trust any user input. Use Zod schemas even for small fields.
