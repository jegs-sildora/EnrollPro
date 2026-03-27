---
# Feature Spec Contract Template
# Copy this file to .agents/specs/{feature-name}.md and fill in all sections.
# Delete any sections that don't apply, but justify the omission in a comment.
---

# {Feature Name} — Spec Contract

> One-sentence summary of what this feature does.

## Metadata

| Field      | Value                                                 |
| ---------- | ----------------------------------------------------- |
| Feature    | `{feature-name}`                                      |
| Domain     | `{server-feature-dir}` / `{client-feature-dir}`       |
| Status     | `draft` \| `in-review` \| `approved` \| `implemented` |
| Author     | —                                                     |
| Date       | YYYY-MM-DD                                            |
| Depends On | List any specs this feature depends on                |

---

## Prisma Models

> Copy the relevant models from `schema.prisma`. Include only the models this feature reads or writes.

```prisma
model Example {
  // paste from schema.prisma
}
```

---

## API Contract

> Define every endpoint this feature touches. Use exact paths.

### `POST /api/{resource}`

**Auth**: `authenticate` → `authorize('REGISTRAR')`
**Validation**: `validate(exampleSchema)`

**Request Body**:

```ts
{
  field: string;
  optionalField?: number;
}
```

**Response** `201`:

```ts
{
  id: number;
  field: string;
  createdAt: string;
}
```

**Errors**:
| Code | Condition |
|------|-----------|
| 400 | Validation failed |
| 401 | Not authenticated |
| 403 | Insufficient role |
| 404 | Resource not found |
| 409 | Duplicate / conflict |

---

## Zod Schemas

> Define schemas in `@enrollpro/shared`. Reference existing schemas when possible.

```ts
// shared/src/schemas/{domain}.schema.ts
import { z } from "zod";

export const exampleSchema = z.object({
  field: z.string().min(1),
  optionalField: z.number().optional(),
});
```

**Derived Types** (auto-generated in `shared/src/types/index.ts`):

```ts
export type ExampleInput = z.infer<typeof exampleSchema>;
```

---

## Server Implementation

> Describe the controller logic, service layer, and any business rules.

### Controller: `{domain}.controller.ts`

```ts
// Pseudocode for reviewer
async function create(req, res) {
  // 1. Extract validated body (already parsed by validate middleware)
  // 2. Call service method
  // 3. Log to AuditLog
  // 4. Return response
}
```

### Service: `{domain}.service.ts` (if needed)

- Business rule 1: ...
- Business rule 2: ...

---

## Client Integration

### API Call

```ts
// client/src/features/{domain}/api.ts or inline in component
const response = await api.post("/api/{resource}", data);
```

### Form Binding

```ts
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { exampleSchema } from "@enrollpro/shared/schemas";
import type { ExampleInput } from "@enrollpro/shared/types";

const form = useForm<ExampleInput>({
  resolver: zodResolver(exampleSchema),
});
```

### Page / Component

> Describe the UI structure. Reference shadcn/ui components by name.

- Page: `features/{domain}/pages/ExamplePage.tsx`
- Dialog: `features/{domain}/components/ExampleDialog.tsx`
- Uses: `Card`, `Form`, `Button`, `Dialog`, `DataTable`

---

## UI States

| State   | Condition         | What the user sees       |
| ------- | ----------------- | ------------------------ |
| Loading | Data fetching     | Skeleton / spinner       |
| Empty   | No results        | Empty state with CTA     |
| Error   | API failure       | Toast with error message |
| Success | Mutation complete | Toast + UI update        |

---

## Test Criteria

### Acceptance Criteria

- [ ] User can ... (happy path)
- [ ] Validation errors display inline (field-level)
- [ ] Unauthorized access returns 403
- [ ] Audit log entry created on mutation

### Edge Cases

- [ ] Concurrent edits handled gracefully
- [ ] Large payloads rejected (express.json 10mb limit)
- [ ] Empty/null optional fields preserved correctly

---

## Checklist

Before marking as `implemented`:

- [ ] Zod schema added to `@enrollpro/shared`
- [ ] Type exported in `shared/src/types/index.ts`
- [ ] Server route uses `validate(schema)` middleware
- [ ] Client form uses `zodResolver(schema)`
- [ ] AuditLog entry written for mutations
- [ ] Error states handled in UI
- [ ] Tested manually end-to-end
