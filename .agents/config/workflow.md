# Workflow: Spec-Driven Development (SDD)

This project strictly adheres to **Spec-Driven Development**. No feature code is to be written before a technical specification is finalized and approved.

## The SDD Logic Gate
Every new feature or significant refactor MUST follow this sequential flow:

```mermaid
graph TD
    A[Requirement] --> B[Technical Spec (.md)]
    B --> C[Shared Schemas (Zod)]
    C --> D[Backend Implementation]
    D --> E[Frontend Integration]
    E --> F[Verification & Tests]
```

### Phase 1: The Technical Spec
- **Location**: `.agents/specs/{feature-name}.md`
- **Mandatory Content**:
    - **Goal**: Clear problem statement and desired outcome.
    - **Data Model**: Prisma schema changes or additions.
    - **API Contract**: Route definitions, request/reponse shapes.
    - **Frontend Logic**: Zustand store updates, new hooks, UI components.
    - **Zod Schema**: The source of truth for validation.

### Phase 2: Shared Types & Schemas
- **Location**: `shared/src/schemas/` and `shared/src/types/`
- **Action**: Implement the Zod schema and derive TypeScript types using `z.infer`.
- **Reasoning**: This ensures parity between frontend and backend.

### Phase 3: Backend Implementation
- **Location**: `server/src/features/{domain}/`
- **Action**: Implement the router, controller, and (if needed) service layer.
- **Rule**: Always use the `validate()` middleware with the shared Zod schema.

### Phase 4: Frontend Integration
- **Location**: `client/src/features/{domain}/`
- **Action**: Create the API service calls, React hooks, and finally the UI components/pages.
- **Rule**: Use shadcn/ui primitives and follow React 19 patterns.

### Phase 5: Verification
- **Action**: Run the development servers, perform manual testing, and add automated tests where applicable.
- **Rule**: Code is not "done" until verified against the original Spec.

## Enforcement Rules
1. **No "Vibe Coding"**: Never start coding based on a vague request. Always ask for or generate a Spec first.
2. **Context First**: Before starting any phase, read the relevant context files in `.agents/context/`.
3. **Atomic Commits**: If requested to commit, group changes by Phase (e.g., "feat: add shared schemas for {feature}").
4. **Self-Correction**: If you find yourself deviating from the Spec, stop and realign or update the Spec if the requirements have changed.
