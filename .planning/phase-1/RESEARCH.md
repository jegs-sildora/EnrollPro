# Phase 1: Core Infrastructure & Security - Research

**Researched:** 2026-03-18
**Domain:** Security, Database Infrastructure, Dynamic Branding
**Confidence:** HIGH

## Summary
Phase 1 establishes the security and infrastructure foundation for EnrollPro. The research confirms that the project's "Two-Layer Login Guard" and "Dynamic Branding" are well-supported by the chosen stack (Prisma 6, Express, Tailwind v4). Key implementation details involve leveraging Prisma 6's new join strategies for performance and implementing a stateless session invalidation mechanism using JWT `iat` vs. a user `updatedAt` (or `passwordChangedAt`) timestamp.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 6.0.0+ | ORM | Industry standard for Type-safe DB access; v6 introduces `relationLoadStrategy` for optimized joins. |
| jsonwebtoken | 9.0.0+ | Authentication | Standard for stateless JWT-based auth. |
| color-thief-node | 1.0.4 | Color Extraction | Reliable extraction of dominant colors from images for branding. |
| sharp | 0.34.0+ | Image Processing | High-performance image resizing and normalization before color extraction. |
| Tailwind CSS | 4.0.0+ | Styling | v4 supports native CSS variables for dynamic skinning without JIT recompilation. |

## Architecture Patterns

### Pattern 1: Two-Layer Login Guard
**What:** A hybrid security gate.
- **Layer 1 (Frontend):** Route loader check for `window.history.state.usr.loginAccess`. Prevents direct URL entry to `/login`.
- **Layer 2 (Backend):** Pre-flight `LoginToken` (single-use, 5-min TTL) required for the `POST /login` endpoint. Prevents programmatic brute-force.

### Pattern 2: Stateless Session Invalidation (iat vs. updatedAt)
**What:** To invalidate tokens (e.g., after password change or deactivation) without a session DB.
- **Logic:** In the `authenticate` middleware, compare the JWT `iat` (issued at) claim with the User's `updatedAt` (or a dedicated `tokenInvalidBefore` field). If `updatedAt > iat`, the token is considered stale and rejected (401).

### Pattern 3: Dynamic Branding (Tailwind v4 Variables)
**What:** Extracting logo colors and injecting them as CSS variables.
- **Workflow:** `sharp` resizes logo -> `color-thief-node` extracts palette -> Server calculates WCAG-compliant foreground (black/white) -> Frontend `RootLayout` applies via `document.documentElement.style.setProperty('--accent', ...)`.

## Prisma 6 Specifics
- **Relation Load Strategy:** Use `relationLoadStrategy: 'join'` in find queries to reduce N+1 problems, especially for complex structures like `Applicant` -> `GradeLevel`/`Strand`.
- **TypedSQL:** If complex Philippine-specific reports are needed, Prisma 6's TypedSQL allows safe raw SQL.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password Hashing | Custom salt/hash | `bcryptjs` | Handles work factor and standard algorithms securely. |
| Color Contrast | Manual RGB math | WCAG 2.1 Formula | Ensuring readability (4.5:1 ratio) is complex; use the relative luminance formula. |
| Rate Limiting | Custom IP tracking | `express-rate-limit` | Mature solution for protecting auth endpoints. |

## Common Pitfalls
- **JWT Secret Rotation:** Rotating the secret logs everyone out. This should be a planned maintenance event.
- **Color Extraction Noise:** Using the raw logo can extract "muddy" colors. Always use `sharp` to flatten/normalize the logo first.
- **Client-Side Hydration:** Applying CSS variables too late causes a "Flash of Unbranded Content" (FOBC). Use `useLayoutEffect` or a blocking script in `index.html`.

## Code Examples

### Prisma 6 Join Strategy
```typescript
const student = await prisma.applicant.findUnique({
  where: { id: 1 },
  include: { gradeLevel: true, strand: true },
  relationLoadStrategy: 'join', // Prisma 6 feature
});
```

### iat vs updatedAt Check
```typescript
const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

if (user.updatedAt.getTime() / 1000 > decoded.iat) {
  throw new Error('Token invalidated due to account update');
}
```

## Validation Architecture
- **Framework:** Vitest (Client) / Jest or Vitest (Server).
- **Key Test:** RBAC middleware must return 403 for `TEACHER` role hitting `SYSTEM_ADMIN` routes.
- **Key Test:** `POST /login` must fail if `loginToken` is missing or already used.
