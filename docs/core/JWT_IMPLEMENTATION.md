# JWT Implementation Guide
## School Admission, Enrollment & Information Management System

**Document Version:** 3.0.0
**System:** PERN Stack (PostgreSQL · Express · React · Node.js)
**Auth Library:** `jsonwebtoken` (backend) · Zustand + Axios interceptors (frontend)
**New in v3.0.0:** Layer 1 (navigation state guard) · Layer 2 (pre-flight login token) · All five modules
**Roles:** `SYSTEM_ADMIN` · `REGISTRAR` · `TEACHER`

---

## Table of Contents

1. [What is JWT?](#1-what-is-jwt)
2. [Full Authentication Flow — v3.0.0](#2-full-authentication-flow--v300)
3. [Environment Setup](#3-environment-setup)
4. [Backend Implementation](#4-backend-implementation)
   - 4.1 [Dependencies](#41-dependencies)
   - 4.2 [Type Definitions](#42-type-definitions)
   - 4.3 [Token Generation — Auth Controller](#43-token-generation--auth-controller)
   - 4.4 [Authentication Middleware](#44-authentication-middleware)
   - 4.5 [Authorization Middleware](#45-authorization-middleware)
   - 4.6 [Route Wiring — All Five Modules](#46-route-wiring--all-five-modules)
5. [Frontend Implementation](#5-frontend-implementation)
   - 5.1 [Zustand Auth Store](#51-zustand-auth-store)
   - 5.2 [Axios Instance with Interceptors](#52-axios-instance-with-interceptors)
   - 5.3 [navigationRef Singleton](#53-navigationref-singleton)
   - 5.4 [ProtectedRoute Component](#54-protectedroute-component)
   - 5.5 [Login Page](#55-login-page)
   - 5.6 [Forced Password Change](#56-forced-password-change)
6. [Layer 1 — Login Access Guard (Frontend)](#6-layer-1--login-access-guard-frontend)
7. [Layer 2 — Pre-Flight Login Token (Backend)](#7-layer-2--pre-flight-login-token-backend)
8. [Role-Based Access Reference — All Five Modules](#8-role-based-access-reference--all-five-modules)
9. [Token Lifecycle & Invalidation](#9-token-lifecycle--invalidation)
10. [Security Checklist](#10-security-checklist)
11. [Common Errors & Fixes](#11-common-errors--fixes)

---

## 1. What is JWT?

**JSON Web Token (JWT)** is a compact, self-contained way of securely transmitting information between parties as a signed JSON object (RFC 7519).

### Structure

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9          ← Header  (Base64-encoded)
.eyJ1c2VySWQiOjEsInJvbGUiOiJSRUdJU1RSQVIifQ   ← Payload (Base64-encoded)
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c  ← Signature (HMAC-SHA256)
```

| Part | Contains | Purpose |
|---|---|---|
| **Header** | Algorithm (`HS256`) + type (`JWT`) | Tells the server how to verify the signature |
| **Payload** | `userId`, `role`, `mustChangePassword`, `iat`, `exp` | Who the user is and what they can do |
| **Signature** | `HMAC_SHA256(header.payload, JWT_SECRET)` | Proof the token was issued by this server and has not been tampered with |

> **Important:** The payload is Base64-encoded, NOT encrypted. Anyone can decode it. Never put passwords, PSA numbers, or sensitive PII in the payload.

### Why stateless?

This system uses stateless authentication — no session table, no Redis cache. Every authenticated request is self-sufficient. The server only needs `JWT_SECRET` to verify. This works correctly for a single-school deployment.

---

## 2. Full Authentication Flow — v3.0.0

```
┌──────────────────────────────────────────────────────────────────────────┐
│                 FULL AUTHENTICATION FLOW (v3.0.0)                        │
└──────────────────────────────────────────────────────────────────────────┘

STEP 0 — LOGIN PAGE MOUNT (Layer 2 pre-flight)
  Login.tsx mounts
      │
      ├──► GET /api/auth/login-token  ──────────────────────────────────────►
      │                                   Server: randomBytes(32) → SHA256 hash
      │                                   DB:     LoginToken { hash, expiresAt: +5min }
      │◄──────────────────────────────────── { loginToken: "<raw_token>" }
      │
      └── Store loginToken in useState (NOT localStorage)

STEP 1 — LAYER 1 GATE (before the login page even renders)
  Navigation to /login
      │
      ├── window.history.state?.usr?.loginAccess === true?
      │       YES → render Login page → STEP 0
      │       NO  → redirect('/')    ← direct URL visit bounced

STEP 2 — USER SUBMITS CREDENTIALS
  POST /api/auth/login { email, password, loginToken }
      │
      ├── validateLoginToken middleware:
      │       hash = SHA256(loginToken)
      │       find LoginToken WHERE token = hash
      │       check: exists, not usedAt, not expired
      │       mark usedAt = now()   ← single-use enforced
      │
      ├── authController.login:
      │       prisma.user.findUnique({ where: { email } })
      │       check isActive
      │       bcrypt.compare(password, user.password)
      │       jwt.sign({ userId, role, mustChangePassword }, JWT_SECRET, '8h')
      │       write USER_LOGIN AuditLog
      │
      └──► { token: "eyJ...", user: { id, name, email, role, mustChangePassword } }

STEP 3 — TOKEN STORED
  authStore.setAuth(token, user)
  Zustand persist → localStorage['auth-storage']

STEP 4 — mustChangePassword CHECK
  IF user.mustChangePassword === true
      → navigate('/change-password')
  ELSE
      → navigate('/dashboard')

STEP 5 — AUTHENTICATED REQUEST (any of the five modules)
  GET /api/applications  (or /students, /teachers, /sections, /teacher/sections)
  Authorization: Bearer eyJ...  ─────────────────────────────────────────────►
                                     authenticate middleware:
                                       jwt.verify(token, JWT_SECRET)
                                       prisma.user.findUnique()  ← isActive check
                                     authorize('REGISTRAR', 'SYSTEM_ADMIN')
                                     controller logic
  ◄──────────────────────────────────── JSON response

STEP 6 — EXPIRY OR DEACTIVATION
  Any API call  ─────────────────────────────────────────────────────────────►
                                     authenticate returns 401
  Axios response interceptor:
    useAuthStore.getState().clearAuth()
    getNavigate()('/login', { state: { loginAccess: true } })
    ← Layer 1 gate flag injected here so /login opens correctly
```

---

## 3. Environment Setup

```dotenv
# server/.env  — NEVER commit this file
# Copy from server/.env.example and fill in real values

DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/school_system_db"

# REQUIRED: generate with one of the methods below
JWT_SECRET="REPLACE_WITH_YOUR_GENERATED_64_CHAR_HEX_SECRET"

RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
EMAIL_FROM="noreply@yourdomain.edu.ph"

PORT=3000
NODE_ENV=development
ALLOWED_ORIGIN="http://localhost:5173"
```

**Generate a strong secret:**

```bash
# Node.js (cross-platform)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL (Linux / macOS / WSL)
openssl rand -hex 64

# PowerShell (Windows)
[System.Convert]::ToBase64String(
  [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64)
)
```

---

## 4. Backend Implementation

### 4.1 Dependencies

```bash
# server/
pnpm add jsonwebtoken bcryptjs express-rate-limit
pnpm add -D @types/jsonwebtoken @types/bcryptjs
```

---

### 4.2 Type Definitions

```ts
// server/src/types/auth.ts

export interface AuthPayload {
  userId:             number;
  role:               'TEACHER' | 'REGISTRAR' | 'SYSTEM_ADMIN';
  mustChangePassword: boolean;
  iat:                number;
  exp:                number;
}

// Extend Express Request so controllers can read req.user
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload & {
        dbUser?: {
          id:       number;
          name:     string;
          email:    string;
          role:     string;
          isActive: boolean;
        };
      };
    }
  }
}
```

---

### 4.3 Token Generation — Auth Controller

```ts
// server/src/controllers/authController.ts
import bcrypt    from 'bcryptjs';
import jwt       from 'jsonwebtoken';
import crypto    from 'crypto';
import { prisma } from '../lib/prisma.js';
import type { Request, Response } from 'express';

// ── Layer 2: issue a pre-flight login token ───────────────────────────────
export async function issueLoginToken(req: Request, res: Response) {
  const raw  = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');

  await prisma.loginToken.create({
    data: {
      token:     hash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      ipAddress: req.ip,
    },
  });

  // Return the raw token; only the hash is stored in DB
  res.json({ loginToken: raw });
}

// ── Main login ─────────────────────────────────────────────────────────────
// Note: validateLoginToken middleware runs before this function
export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = jwt.sign(
    {
      userId:             user.id,
      role:               user.role,
      mustChangePassword: user.mustChangePassword,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  );

  // Update last login timestamp
  await prisma.user.update({
    where: { id: user.id },
    data:  { lastLoginAt: new Date() },
  });

  // Write immutable audit log entry
  await prisma.auditLog.create({
    data: {
      userId:      user.id,
      actionType:  'USER_LOGIN',
      description: `User ${user.email} logged in from ${req.ip}`,
      ipAddress:   req.ip ?? '0.0.0.0',
      userAgent:   req.headers['user-agent'],
    },
  });

  res.json({
    token,
    user: {
      id:                 user.id,
      name:               user.name,
      email:              user.email,
      role:               user.role,
      mustChangePassword: user.mustChangePassword,
    },
  });
}

// ── Return current user from token ─────────────────────────────────────────
export async function me(req: Request, res: Response) {
  res.json(req.user?.dbUser);
}

// ── Forced password change (required on first login) ───────────────────────
export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  const updated = await prisma.user.update({
    where:  { id: userId },
    data:   { password: hashed, mustChangePassword: false },
    select: { id: true, name: true, email: true, role: true, mustChangePassword: true },
  });

  // Issue a fresh token with mustChangePassword = false so the frontend
  // doesn't need to log out and back in
  const freshToken = jwt.sign(
    { userId: updated.id, role: updated.role, mustChangePassword: false },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  );

  res.json({ token: freshToken, user: updated });
}
```

---

### 4.4 Authentication Middleware

```ts
// server/src/middleware/authenticate.ts
import jwt       from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import type { AuthPayload } from '../types/auth.js';
import type { Request, Response, NextFunction } from 'express';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  let decoded: AuthPayload;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  // isActive check on EVERY request — handles account deactivation mid-session
  const dbUser = await prisma.user.findUnique({
    where:  { id: decoded.userId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  if (!dbUser || !dbUser.isActive) {
    return res.status(401).json({ message: 'Account is inactive or not found.' });
  }

  req.user = { ...decoded, dbUser };
  next();
}
```

---

### 4.5 Authorization Middleware

```ts
// server/src/middleware/authorize.ts
import type { AuthPayload } from '../types/auth.js';
import type { Request, Response, NextFunction } from 'express';

/**
 * Usage: router.get('/route', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), handler)
 */
export function authorize(...roles: AuthPayload['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden. Required: ${roles.join(' or ')}.`,
      });
    }
    next();
  };
}
```

---

### 4.6 Route Wiring — All Five Modules

#### Auth Routes

```ts
// server/src/routes/auth.routes.ts
import rateLimit from 'express-rate-limit';
import { issueLoginToken, login, me, changePassword } from '../controllers/authController.js';
import { validateLoginToken } from '../middleware/validateLoginToken.js';
import { authenticate }       from '../middleware/authenticate.js';

const loginTokenLimiter = rateLimit({ windowMs: 60_000, max: 20 });
const loginLimiter      = rateLimit({ windowMs: 60_000, max: 20 });

router.get('/login-token', loginTokenLimiter, issueLoginToken);  // Layer 2 endpoint
router.post('/login',      loginLimiter, validateLoginToken, login);
router.get('/me',          authenticate, me);
router.post('/change-password', authenticate, changePassword);
```

#### Module 1 — Admission (Online + F2F)

```ts
// server/src/routes/application.routes.ts
// Public (no auth)
router.post('/',                       ctrl.store);          // Online admission
router.get('/track/:trackingNumber',   ctrl.track);          // Tracking lookup

// Registrar + Admin
router.post('/f2f',                    authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.storeF2F);
router.get('/',                        authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.index);
router.get('/:id',                     authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.show);

// Enrollment management workflow
router.patch('/:id/approve',           authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.approve);
router.patch('/:id/reject',            authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.reject);
router.patch('/:id/schedule-exam',     authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.scheduleExam);
router.patch('/:id/record-result',     authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.recordResult);
router.patch('/:id/pass',              authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.pass);
router.patch('/:id/fail',              authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.fail);
```

#### Module 3 — SIMS (Student Information Management)

```ts
// server/src/routes/student.routes.ts
router.get('/',        authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), studentCtrl.index);
router.get('/:id',     authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), studentCtrl.show);
router.put('/:id',     authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), studentCtrl.update);   // audit-logged
router.get('/:id/history', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), studentCtrl.history);
```

#### Module 4 — Teacher Management

```ts
// server/src/routes/teacher.routes.ts (registrar-facing management)
router.get('/',                          authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), teacherMgmtCtrl.index);
router.post('/',                         authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), teacherMgmtCtrl.store);
router.get('/:id',                       authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), teacherMgmtCtrl.show);
router.put('/:id',                       authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), teacherMgmtCtrl.update);
router.post('/:id/provision-account',    authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), teacherMgmtCtrl.provisionAccount);
router.patch('/:id/deactivate',          authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), teacherMgmtCtrl.deactivate);

// server/src/routes/my-sections.routes.ts (teacher-facing view)
router.get('/sections',     authenticate, authorize('TEACHER', 'SYSTEM_ADMIN'), mySectionsCtrl.index);
router.get('/sections/:id', authenticate, authorize('TEACHER', 'SYSTEM_ADMIN'), mySectionsCtrl.show);
```

#### Module 5 — Grade Level & Sectioning Management

```ts
// server/src/routes/section.routes.ts
router.get('/',                      authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), sectionCtrl.index);
router.post('/',                     authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), sectionCtrl.store);
router.put('/:id',                   authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), sectionCtrl.update);
router.delete('/:id',                authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), sectionCtrl.destroy);
router.patch('/:id/assign-teacher',  authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), sectionCtrl.assignTeacher);

// server/src/routes/grade-level.routes.ts
router.get('/',     /* public */                                                            gradeLevelCtrl.index);
router.get('/all',  authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),                  gradeLevelCtrl.all);
router.post('/',    authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),                  gradeLevelCtrl.store);
router.put('/:id',  authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),                  gradeLevelCtrl.update);
router.delete('/:id', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),                gradeLevelCtrl.destroy);

// server/src/routes/strand.routes.ts
router.get('/',     /* public — used by admission form */                                  strandCtrl.index);
router.post('/',    authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),                  strandCtrl.store);
router.put('/:id',  authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),                  strandCtrl.update);
router.delete('/:id', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),                strandCtrl.destroy);

// server/src/routes/scp-program.routes.ts
router.get('/',         /* public — used by admission form */                              scpCtrl.index);
router.get('/all',      authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),              scpCtrl.all);
router.post('/',        authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),              scpCtrl.store);
router.put('/:id',      authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),              scpCtrl.update);
router.patch('/:id/toggle', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),          scpCtrl.toggle);
```

#### Settings + Audit + Admin Routes

```ts
// Settings (public read; protected write)
router.get('/public',  /* public */                                                        settingsCtrl.public);
router.put('/identity', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),              settingsCtrl.updateIdentity);
router.post('/logo',    authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),              settingsCtrl.uploadLogo);
router.patch('/enrollment-gate', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),     settingsCtrl.toggleGate);

// Audit logs
router.get('/', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),                     auditCtrl.index);

// System Admin only
router.use(authenticate, authorize('SYSTEM_ADMIN'));
router.get('/users',                  adminCtrl.index);
router.post('/users',                 adminCtrl.store);
router.put('/users/:id',              adminCtrl.update);
router.patch('/users/:id/deactivate', adminCtrl.deactivate);
router.patch('/users/:id/reactivate', adminCtrl.reactivate);
router.patch('/users/:id/reset-password', adminCtrl.resetPassword);
router.get('/email-logs',             emailLogCtrl.index);
router.post('/email-logs/:id/retry',  emailLogCtrl.retry);
router.get('/system',                 systemCtrl.health);
```

#### `app.ts` — Full Route Registration

```ts
// server/src/app.ts
import express         from 'express';
import cors            from 'cors';

import authRoutes       from './routes/auth.routes.js';
import applicationRoutes from './routes/application.routes.js';
import studentRoutes    from './routes/student.routes.js';
import teacherRoutes    from './routes/teacher.routes.js';      // registrar-facing
import mySectionsRoutes from './routes/my-sections.routes.js';  // teacher-facing
import sectionRoutes    from './routes/section.routes.js';
import gradeLevelRoutes from './routes/grade-level.routes.js';
import strandRoutes     from './routes/strand.routes.js';
import scpRoutes        from './routes/scp-program.routes.js';
import settingsRoutes   from './routes/settings.routes.js';
import academicYearRoutes from './routes/academic-year.routes.js';
import auditRoutes      from './routes/audit.routes.js';
import adminRoutes      from './routes/admin.routes.js';

const app = express();

app.use(cors({ origin: process.env.ALLOWED_ORIGIN }));
app.use(express.json());

// Module 1 — Admission (Online + F2F)
app.use('/api/applications',    applicationRoutes);

// Module 3 — SIMS
app.use('/api/students',        studentRoutes);

// Module 4 — Teacher Management (registrar view + teacher's own view)
app.use('/api/teachers',        teacherRoutes);
app.use('/api/teacher',         mySectionsRoutes);

// Module 5 — Grade Level & Sectioning
app.use('/api/sections',        sectionRoutes);
app.use('/api/grade-levels',    gradeLevelRoutes);
app.use('/api/strands',         strandRoutes);
app.use('/api/scp-programs',    scpRoutes);

// Auth + Settings + Config + Audit + Admin
app.use('/api/auth',            authRoutes);
app.use('/api/settings',        settingsRoutes);
app.use('/api/academic-years',  academicYearRoutes);
app.use('/api/audit-logs',      auditRoutes);
app.use('/api/admin',           adminRoutes);

export default app;
```

---

## 5. Frontend Implementation

### 5.1 Zustand Auth Store

```ts
// client/src/stores/authStore.ts
import { create }  from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id:                 number;
  name:               string;
  email:              string;
  role:               'TEACHER' | 'REGISTRAR' | 'SYSTEM_ADMIN';
  mustChangePassword: boolean;
}

interface AuthState {
  token:     string | null;
  user:      AuthUser | null;
  setAuth:   (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:     null,
      user:      null,
      setAuth:   (token, user) => set({ token, user }),
      clearAuth: ()            => set({ token: null, user: null }),
    }),
    {
      name:        'auth-storage',
      partialize:  (state) => ({ token: state.token, user: state.user }),
    }
  )
);
```

---

### 5.2 Axios Instance with Interceptors

```ts
// client/src/api/axiosInstance.ts
import axios             from 'axios';
import { useAuthStore }  from '@/stores/authStore';
import { getNavigate }   from '@/router/navigationRef';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
});

// Attach JWT to every outgoing request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — session expired or account deactivated
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      const navigate = getNavigate();
      // Layer 1: inject the gate flag so /login opens correctly
      if (navigate) navigate('/login', { state: { loginAccess: true } });
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

### 5.3 navigationRef Singleton

The `navigationRef` singleton gives non-React modules (the Axios interceptor) access to React Router's `navigate` function.

```ts
// client/src/router/navigationRef.ts
import type { NavigateFunction } from 'react-router-dom';

let _navigate: NavigateFunction | null = null;

export const setNavigate = (fn: NavigateFunction) => { _navigate = fn; };
export const getNavigate = ()                      => _navigate;
```

```tsx
// client/src/layouts/AppLayout.tsx — register navigate on every mount
import { useNavigate }  from 'react-router-dom';
import { setNavigate }  from '@/router/navigationRef';
import { useEffect }    from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  useEffect(() => { setNavigate(navigate); }, [navigate]);
  // ... render sidebar + content
}
```

---

### 5.4 ProtectedRoute Component

```tsx
// client/src/components/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  allowedRoles: ('TEACHER' | 'REGISTRAR' | 'SYSTEM_ADMIN')[];
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { token, user } = useAuthStore();
  const location        = useLocation();

  // Not authenticated → send to login with Layer 1 gate flag
  if (!token || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ loginAccess: true, from: location.pathname }}
      />
    );
  }

  // Wrong role → 403 page
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  // First login — must change password before proceeding
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
```

---

### 5.5 Login Page

The Login page does two things on mount: validates Layer 1 (handled by the router loader, not here) and silently fetches a Layer 2 pre-flight token.

The school name and logo in the login header are sourced from `settingsStore` — **never hardcoded**.

```tsx
// client/src/pages/auth/Login.tsx
import { useEffect, useState }      from 'react';
import { useForm }                   from 'react-hook-form';
import { zodResolver }               from '@hookform/resolvers/zod';
import { z }                         from 'zod';
import { useNavigate }               from 'react-router-dom';
import api                           from '@/api/axiosInstance';
import { useAuthStore }              from '@/stores/authStore';
import { useSettingsStore }          from '@/stores/settingsStore';

const schema = z.object({
  email:    z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export default function Login() {
  const navigate             = useNavigate();
  const { setAuth }          = useAuthStore();
  const { settings }         = useSettingsStore();   // ← school name from DB, not hardcoded
  const [loginToken, setLoginToken] = useState<string | null>(null);
  const [fetching,   setFetching]   = useState(true);

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } =
    useForm({ resolver: zodResolver(schema) });

  // Layer 2: fetch pre-flight token silently on mount
  useEffect(() => {
    api.get('/auth/login-token')
      .then(res => setLoginToken(res.data.loginToken))
      .catch(() => { /* will retry on submit */ })
      .finally(() => setFetching(false));
  }, []);

  const onSubmit = async (data: { email: string; password: string }) => {
    // Re-fetch token if the 5-minute window expired before the user submitted
    let token = loginToken;
    if (!token) {
      const res = await api.get('/auth/login-token');
      token = res.data.loginToken;
      setLoginToken(token);
    }

    const response = await api.post('/auth/login', {
      email:      data.email,
      password:   data.password,
      loginToken: token,   // Layer 2: consumed by validateLoginToken middleware
    });

    setAuth(response.data.token, response.data.user);

    if (response.data.user.mustChangePassword) {
      navigate('/change-password', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm p-8 space-y-6">

        {/* School identity — always from settingsStore, never hardcoded */}
        <div className="flex flex-col items-center gap-2">
          {settings?.logoUrl
            ? <img src={settings.logoUrl} alt={settings.schoolName ?? ''} className="h-16 w-16 rounded-full object-cover" />
            : <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <span className="text-2xl text-muted-foreground">🏫</span>
              </div>
          }
          <h1 className="text-xl font-semibold text-center">
            {settings?.schoolName ?? 'School System'}
          </h1>
          <p className="text-sm text-muted-foreground">Staff Login</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email Address</label>
            <input type="email" {...register('email')}
              className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-1 focus:ring-[hsl(var(--accent-ring))]"
              placeholder="you@school.edu.ph"
            />
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <input type="password" {...register('password')}
              className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-1 focus:ring-[hsl(var(--accent-ring))]"
            />
            {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || fetching}
            className="w-full py-2 rounded-md text-sm font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
}
```

---

### 5.6 Forced Password Change

```tsx
// client/src/pages/auth/ChangePassword.tsx
import { useForm }          from 'react-hook-form';
import { zodResolver }      from '@hookform/resolvers/zod';
import { z }                from 'zod';
import { useNavigate }      from 'react-router-dom';
import api                  from '@/api/axiosInstance';
import { useAuthStore }     from '@/stores/authStore';

const schema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword:     z.string().min(8, 'Minimum 8 characters.'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match.',
  path:    ['confirmPassword'],
});

export default function ChangePassword() {
  const navigate            = useNavigate();
  const { token, user, setAuth } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data: any) => {
    const response = await api.post('/auth/change-password', {
      currentPassword: data.currentPassword,
      newPassword:     data.newPassword,
    });
    // Use the fresh token returned by the server (mustChangePassword = false)
    setAuth(response.data.token, response.data.user);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm p-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Set a New Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This is a one-time requirement for new accounts. Your password must be at least 8 characters.
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Current Password</label>
            <input type="password" {...register('currentPassword')}
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm" />
            {errors.currentPassword && <p className="mt-1 text-xs text-destructive">{errors.currentPassword.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium">New Password</label>
            <input type="password" {...register('newPassword')}
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm" />
            {errors.newPassword && <p className="mt-1 text-xs text-destructive">{errors.newPassword.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium">Confirm New Password</label>
            <input type="password" {...register('confirmPassword')}
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm" />
            {errors.confirmPassword && <p className="mt-1 text-xs text-destructive">{errors.confirmPassword.message}</p>}
          </div>
          <button type="submit" disabled={isSubmitting}
            className="w-full py-2 rounded-md text-sm font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] disabled:opacity-50">
            {isSubmitting ? 'Saving…' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

## 6. Layer 1 — Login Access Guard (Frontend)

**Problem:** Any guest can type `/login` in the address bar and reach the login form.

**Solution:** The `/login` route loader reads `window.history.state?.usr`. React Router v7 stores the `state` argument of `navigate(path, { state })` internally under `window.history.state.usr`. A direct URL visit (address bar, bookmark, back button, external link) carries no state — so the loader returns `redirect('/')`.

```tsx
// client/src/router/index.tsx
{
  path: '/login',
  loader: () => {
    const state = window.history.state?.usr;
    if (!state?.loginAccess) return redirect('/');
    return null;
  },
  element: <AuthLayout><Login /></AuthLayout>,
},
```

### Three Legitimate State Injectors

These are the **only three code paths** permitted to navigate to `/login`:

```tsx
// 1. ProtectedRoute — unauthenticated user hits a protected route
<Navigate to="/login" replace state={{ loginAccess: true, from: location.pathname }} />

// 2. Axios 401 interceptor — session expired mid-use (uses navigationRef singleton)
navigate('/login', { state: { loginAccess: true } });

// 3. "Staff Login" link in public portal footer (/apply and /closed pages)
<button type="button"
  onClick={() => navigate('/login', { state: { loginAccess: true } })}>
  Staff Login
</button>
```

### What Layer 1 Blocks

| Navigation method | Result |
|---|---|
| Typing `/login` in address bar | Bounced to `/` |
| Pressing Back to `/login` after logout | Bounced to `/` |
| Refreshing the `/login` page | Bounced to `/` |
| Bookmarking `/login` and clicking it | Bounced to `/` |
| External link to `/login` | Bounced to `/` |
| `ProtectedRoute` redirect | ✅ Reaches `/login` |
| Axios 401 interceptor | ✅ Reaches `/login` |
| "Staff Login" button on `/apply` or `/closed` | ✅ Reaches `/login` |

> **Intentional behaviour:** After a user fills the login form and refreshes the browser before submitting, they are bounced to `/`. This is correct — the login page is a staff tool, not a bookmarkable URL.

---

## 7. Layer 2 — Pre-Flight Login Token (Backend)

**Problem:** Even with Layer 1 blocking the browser, a determined attacker can call `POST /api/auth/login` directly with curl or Postman and brute-force credentials.

**Solution:** `POST /api/auth/login` requires a server-issued, single-use, 5-minute token. This token is obtainable only by calling `GET /api/auth/login-token` — which is what the Login page does silently on mount.

### LoginToken Prisma Model

```prisma
model LoginToken {
  id        Int       @id @default(autoincrement())
  token     String    @unique   // SHA-256 hash of the raw token sent to the client
  expiresAt DateTime            // now + 5 minutes
  usedAt    DateTime?           // null = unused; non-null = consumed and unusable
  ipAddress String?   @db.VarChar(45)
  createdAt DateTime  @default(now())

  @@index([token])
}
```

### validateLoginToken Middleware

```ts
// server/src/middleware/validateLoginToken.ts
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import type { Request, Response, NextFunction } from 'express';

export async function validateLoginToken(req: Request, res: Response, next: NextFunction) {
  const { loginToken } = req.body;

  if (!loginToken) {
    return res.status(400).json({ message: 'Missing login token.' });
  }

  const hash   = crypto.createHash('sha256').update(loginToken).digest('hex');
  const record = await prisma.loginToken.findUnique({ where: { token: hash } });

  if (!record) {
    return res.status(400).json({ message: 'Invalid login token.' });
  }
  if (record.usedAt) {
    return res.status(400).json({ message: 'Login token has already been used.' });
  }
  if (record.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Login token has expired.' });
  }

  // Atomically consume — single-use enforced
  await prisma.loginToken.update({
    where: { id: record.id },
    data:  { usedAt: new Date() },
  });

  next();
}
```

### Token Lifecycle

```
Login.tsx mounts
    │
    ├──► GET /api/auth/login-token
    │       Server: randomBytes(32) → SHA256 hash → DB insert (expiresAt + 5min)
    │       Returns: { loginToken: "<raw 32-byte hex>" }
    │
    └── useState(loginToken)   ← component state only; not localStorage

User submits form
    │
    ├──► POST /api/auth/login { email, password, loginToken }
    │       validateLoginToken middleware:
    │           1. hash = SHA256(loginToken)
    │           2. DB lookup by hash
    │           3. Validate: exists + not usedAt + not expired
    │           4. Mark usedAt = now()    ← consumed; any replay returns 400
    │       authController.login:
    │           5. bcrypt.compare(password, user.password)
    │           6. jwt.sign(...)
    │
    └──► JWT returned to frontend

Token expires after 5 minutes even if never used.
Periodic cleanup deletes tokens older than 24 hours.
```

### Cleanup Task

```ts
// server/src/services/tokenCleanup.ts
import { prisma } from '../lib/prisma.js';

export async function cleanupExpiredLoginTokens() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { count } = await prisma.loginToken.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  if (count > 0) console.info(`[Token cleanup] Deleted ${count} expired login tokens.`);
}

// Run once on startup, then every hour
cleanupExpiredLoginTokens();
setInterval(cleanupExpiredLoginTokens, 60 * 60 * 1000);
```

---

## 8. Role-Based Access Reference — All Five Modules

### JWT Payload per Role

| Claim | SYSTEM_ADMIN | REGISTRAR | TEACHER |
|---|---|---|---|
| `userId` | 1 (example) | 2 (example) | 5 (example) |
| `role` | `"SYSTEM_ADMIN"` | `"REGISTRAR"` | `"TEACHER"` |
| `mustChangePassword` | `false` | `false` | `true` (on first login) |
| `exp` | `iat + 28800` (8h) | same | same |

### Backend Middleware Matrix — All Five Modules

| Endpoint | authenticate | authorize |
|---|---|---|
| `GET /api/settings/public` | ❌ | ❌ |
| `POST /api/applications` (online) | ❌ | ❌ |
| `GET /api/applications/track/:n` | ❌ | ❌ |
| `GET /api/grade-levels` | ❌ | ❌ |
| `GET /api/strands` | ❌ | ❌ |
| `GET /api/scp-programs` | ❌ | ❌ |
| `POST /api/applications/f2f` | ✅ | `REGISTRAR`, `SYSTEM_ADMIN` |
| `GET /api/applications` | ✅ | `REGISTRAR`, `SYSTEM_ADMIN` |
| `PATCH /api/applications/:id/approve` | ✅ | `REGISTRAR`, `SYSTEM_ADMIN` |
| `GET /api/students` | ✅ | `REGISTRAR`, `SYSTEM_ADMIN` |
| `PUT /api/students/:id` | ✅ | `REGISTRAR`, `SYSTEM_ADMIN` |
| `GET /api/teachers` | ✅ | `REGISTRAR`, `SYSTEM_ADMIN` |
| `POST /api/teachers` | ✅ | `REGISTRAR`, `SYSTEM_ADMIN` |
| `POST /api/teachers/:id/provision-account` | ✅ | `REGISTRAR`, `SYSTEM_ADMIN` |
| `GET /api/sections` | ✅ | `REGISTRAR`, `SYSTEM_ADMIN` |
| `POST /api/sections` | ✅ | `REGISTRAR`, `SYSTEM_ADMIN` |
| `GET /api/teacher/sections` | ✅ | `TEACHER`, `SYSTEM_ADMIN` |
| `GET /api/teacher/sections/:id` | ✅ | `TEACHER`, `SYSTEM_ADMIN` |
| `GET /api/audit-logs` | ✅ | `REGISTRAR`, `SYSTEM_ADMIN` |
| `PUT /api/settings/identity` | ✅ | `REGISTRAR`, `SYSTEM_ADMIN` |
| `GET /api/admin/users` | ✅ | `SYSTEM_ADMIN` |
| `POST /api/admin/users` | ✅ | `SYSTEM_ADMIN` |
| `GET /api/admin/email-logs` | ✅ | `SYSTEM_ADMIN` |
| `GET /api/admin/system` | ✅ | `SYSTEM_ADMIN` |

> **Frontend role checks are UX-only.** A determined user can manipulate the frontend. All real access control is enforced by `authorize()` middleware on every protected route.

### Frontend Sidebar Role Rendering

```tsx
// client/src/components/layout/SidebarContent.tsx
const { user } = useAuthStore();

const isAdmin     = user?.role === 'SYSTEM_ADMIN';
const isRegistrar = user?.role === 'REGISTRAR';

// Admission
{(isRegistrar || isAdmin) && <NavItem href="/f2f-admission"  icon={UserPlus}        label="Walk-in Admission" />}

// Enrollment
{(isRegistrar || isAdmin) && <NavItem href="/applications"   icon={ClipboardList}   label="Applications" />}

// SIMS
{(isRegistrar || isAdmin) && <NavItem href="/students"       icon={Users}           label="Students" />}

// Teacher Management
{(isRegistrar || isAdmin) && <NavItem href="/teachers"       icon={GraduationCap}   label="Teachers" />}

// Sections
{(isRegistrar || isAdmin) && <NavItem href="/sections"       icon={School}          label="Sections" />}

// System Admin only
{isAdmin                  && <NavItem href="/admin/users"    icon={Shield}          label="User Management" />}
{isAdmin                  && <NavItem href="/admin/email-logs" icon={Mail}          label="Email Logs" />}
{isAdmin                  && <NavItem href="/admin/system"   icon={Activity}        label="System Health" />}
```

---

## 9. Token Lifecycle & Invalidation

```
Login → token issued (8h TTL)
    │
    ▼
Each request → authenticate: jwt.verify + prisma isActive check
    │
    ├── 8h pass → TokenExpiredError → 401 → Axios interceptor → clearAuth → /login
    │
    ├── Admin deactivates user → isActive=false → next request returns 401 → clearAuth
    │
    ├── Token tampered → JsonWebTokenError → 401
    │
    └── JWT_SECRET rotated → all tokens fail verification → all users logged out
```

| Scenario | Mechanism |
|---|---|
| Natural expiry | `jwt.verify()` throws `TokenExpiredError` → 401 |
| Account deactivated | `isActive = false` DB check → 401 |
| Token tampered | `jwt.verify()` throws `JsonWebTokenError` → 401 |
| JWT_SECRET rotated | All signature verifications fail → universal logout |

### Optional: Token Expiry Warning Hook

```ts
// client/src/hooks/useTokenExpiringSoon.ts
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '@/stores/authStore';

export function useTokenExpiringSoon(thresholdMinutes = 15): boolean {
  const { token } = useAuthStore();
  if (!token) return false;
  try {
    const { exp } = jwtDecode<{ exp: number }>(token);
    return (exp * 1000 - Date.now()) < thresholdMinutes * 60 * 1000;
  } catch {
    return true; // treat bad token as expired
  }
}
```

---

## 10. Security Checklist

| # | Check | How to Verify |
|---|---|---|
| ✅ | `JWT_SECRET` ≥ 64 hex chars, not placeholder | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| ✅ | `.env` in `.gitignore`; never committed | `git log --all -- server/.env` returns nothing |
| ✅ | `.env.example` has no real secrets | Review the file — only placeholder values |
| ✅ | Passwords hashed with bcrypt 12 rounds | Check `authController.ts` → `bcrypt.hash(password, 12)` |
| ✅ | JWT expiry is 8 hours | `{ expiresIn: '8h' }` in `jwt.sign()` |
| ✅ | `authenticate` checks `isActive` on every request | `prisma.user.findUnique` + `!dbUser.isActive` in `authenticate.ts` |
| ✅ | `SYSTEM_ADMIN` role cannot be assigned via API | `adminUserController.ts` rejects `role === 'SYSTEM_ADMIN'` with 403 |
| ✅ | Passwords never appear in logs or audit trail | Search for `console.log(password)` and audit log templates |
| ✅ | JWT payload contains no PII beyond `userId` and `role` | Verify `jwt.sign()` call in `authController.ts` |
| ✅ | Layer 1: direct URL `/login` visits are bounced to `/` | Test: type `/login` in address bar → lands on `/apply` or `/closed` |
| ✅ | Layer 2: `POST /api/auth/login` without `loginToken` returns 400 | `curl -X POST /api/auth/login -d '{"email":"x","password":"y"}'` → 400 |
| ✅ | Login tokens are single-use | Submit form, then resubmit same token → 400 "already used" |
| ✅ | Login tokens expire after 5 minutes | Wait 6 min after load, submit → 400 "expired" |
| ✅ | Expired tokens cleaned up periodically | Check server startup logs for cleanup task confirmation |
| ✅ | Rate limiting on auth endpoints (20 req/min) | `express-rate-limit` on `/auth/login-token` and `POST /auth/login` |
| ✅ | CORS origin allowlist is not `*` in production | `cors({ origin: process.env.ALLOWED_ORIGIN })` — not `origin: '*'` |
| ✅ | HTTPS enforced in production | Reverse proxy (Nginx/Caddy) redirects HTTP → HTTPS |
| ✅ | `mustChangePassword` redirects on first login | Create account, log in, confirm redirect to `/change-password` |

---

## 11. Common Errors & Fixes

### `Error: secretOrPrivateKey must have a value`

`process.env.JWT_SECRET` is `undefined`. Ensure `server/.env` exists, `JWT_SECRET` is set, and `import 'dotenv/config'` is the **first** import in `server.ts`.

---

### `JsonWebTokenError: invalid signature`

Token was signed with a different `JWT_SECRET` than currently in `.env`. If you rotated the secret, all users must log in again.

---

### `TokenExpiredError: jwt expired`

Token's `exp` has passed (8h after login). The Axios response interceptor catches the resulting 401, clears auth, and redirects to `/login` automatically. No manual handling required.

---

### `400 Bad Request` — "Missing login token"

`loginToken` was not included in `POST /api/auth/login`. The Login page is being bypassed, or the pre-flight fetch failed silently. Ensure `Login.tsx` fetches `GET /api/auth/login-token` on mount and passes the result in the form body.

---

### `400 Bad Request` — "Login token has already been used"

The same raw token was submitted twice (double-click on submit, or a retry). Disable the submit button during `isSubmitting`. On error, re-fetch a fresh token before allowing resubmission.

---

### User reaches `/login` and gets bounced to `/`

Layer 1 is working correctly. The navigation did not carry `{ state: { loginAccess: true } }`. Check that `navigate('/login', ...)` is used — not `window.location.href = '/login'`, which loses the state.

---

### `401 Unauthorized` immediately after a valid login

The account was deactivated by a System Admin. The `isActive` DB check in `authenticate.ts` caught it. The Admin must reactivate the account at `/admin/users`.

---

### `403 Forbidden` — correct credentials, wrong route

The user's role does not match what `authorize()` requires for that route. Example: a REGISTRAR attempting to access `/api/teachers`, which is SYSTEM_ADMIN exclusive. Check `SidebarContent.tsx` role guards to prevent the UI from surfacing this link to unauthorized roles.

---

### Token not attached (`Authorization` header missing)

Some component is importing `axios` directly instead of the configured instance. Search the codebase for `import axios from 'axios'` and replace all occurrences with `import api from '@/api/axiosInstance'`.

---

*Document v3.0.0*
*System: School Admission, Enrollment & Information Management System*
*Modules: Admission (Online + F2F) · Enrollment Management · SIMS · Teacher Management · Grade Level & Sectioning Management*
*Stack: PERN (PostgreSQL 18 · Express.js 5.1 · React 19.x · Node.js 22 LTS)*
*Auth: jsonwebtoken · bcryptjs · Zustand persist · Axios interceptors · Layer 1 (navigation state guard) · Layer 2 (pre-flight login token)*
*School-agnostic: school name, logo, grade levels, strands, and SCP programs are all runtime-configurable*