# Validation: Phase 1 - Core Infrastructure & Security

**Goal:** Ensure the security and infrastructure foundation is robust, compliant, and performs according to specifications.

## 1. Automated Testing Strategy
- **Unit Tests:** Verify the `authenticate` and `authorize` middleware logic (iat vs. updatedAt check).
- **Integration Tests:** Confirm the two-layer login guard flow (pre-flight token issue and consumption).
- **E2E Tests:** Validate the dynamic branding application (logo upload -> color extraction -> CSS variable injection).

## 2. Security Verification
- [ ] **Token Invalidation:** Changing a user's password must immediately invalidate all existing JWTs.
- [ ] **Login Guard:** Direct navigation to `/login` must redirect to `/`.
- [ ] **Pre-flight Token:** `POST /api/auth/login` must fail if the `loginToken` is missing, expired, or already used.
- [ ] **RBAC:** A `TEACHER` role must receive a `403` when accessing `SYSTEM_ADMIN` routes.

## 3. Branding & UI Verification
- [ ] **Color Extraction:** Dominant color from a logo must be correctly extracted and converted to HSL.
- [ ] **CSS Injection:** The `--accent` variable must be applied to the `:root` element.
- [ ] **FOUC Prevention:** The branding variables must be injected before the main app content renders.

## 4. Database Verification
- [ ] **Prisma 6:** Verify `npx prisma -v` is 6.x and the `User` model matches the schema.
- [ ] **Audit Trail:** Initial admin user creation must be recorded in the audit log (via seed).
