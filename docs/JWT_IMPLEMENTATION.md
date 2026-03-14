# JWT Implementation Guide
## Hinigaran National High School — Admission & Enrollment Information Management System

**System:** PERN Stack (PostgreSQL · Express · React · Node.js)
**Auth Library:** `jsonwebtoken` (backend) · Zustand + Axios interceptors (frontend)
**PRD Reference:** v2.3.0
**Roles Covered:** `SYSTEM_ADMIN` · `REGISTRAR` · `TEACHER`

---

## Table of Contents

1. [What is JWT?](#1-what-is-jwt)
2. [How JWT Works in This System — Full Flow](#2-how-jwt-works-in-this-system--full-flow)
3. [Environment Setup — `.env` Configuration](#3-environment-setup--env-configuration)
4. [Step-by-Step Implementation — Backend](#4-step-by-step-implementation--backend)
   - 4.1 [Install Dependencies](#41-install-dependencies)
   - 4.2 [Type Definitions](#42-type-definitions)
   - 4.3 [Token Generation — Auth Controller](#43-token-generation--auth-controller)
   - 4.4 [Authentication Middleware](#44-authentication-middleware)
   - 4.5 [Authorization Middleware](#45-authorization-middleware)
   - 4.6 [Applying Middleware to Routes](#46-applying-middleware-to-routes)
5. [Step-by-Step Implementation — Frontend](#5-step-by-step-implementation--frontend)
   - 5.1 [Install Dependencies](#51-install-dependencies)
   - 5.2 [Zustand Auth Store](#52-zustand-auth-store)
   - 5.3 [Axios Instance with Interceptors](#53-axios-instance-with-interceptors)
   - 5.4 [Protected Route Component](#54-protected-route-component)
   - 5.5 [Login Page — Calling the Auth API](#55-login-page--calling-the-auth-api)
   - 5.6 [Forced Password Change on First Login](#56-forced-password-change-on-first-login)
6. [Role-Based Access Reference](#6-role-based-access-reference)
7. [Token Lifecycle & Invalidation](#7-token-lifecycle--invalidation)
8. [Security Checklist](#8-security-checklist)
9. [Common Errors & Fixes](#9-common-errors--fixes)

---

## 1. What is JWT?

**JSON Web Token (JWT)** is an open standard (RFC 7519) that defines a compact, self-contained way of securely transmitting information between parties as a signed JSON object.

### Structure

A JWT looks like this:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9   ← Header (Base64)
.eyJ1c2VySWQiOjEsInJvbGUiOiJSRUdJU1RSQVIifQ   ← Payload (Base64)
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c   ← Signature (HMAC-SHA256)
```

Three dot-separated parts:

| Part | Contains | Purpose |
|---|---|---|
| **Header** | Algorithm (`HS256`) + token type (`JWT`) | Tells the server how to verify the signature |
| **Payload** | `userId`, `role`, `mustChangePassword`, `iat`, `exp` | The actual claims — who the user is and what they can do |
| **Signature** | `HMAC_SHA256(base64(header) + "." + base64(payload), JWT_SECRET)` | Cryptographic proof the token was issued by this server and has not been tampered with |

> **Important:** The payload is Base64-encoded, NOT encrypted. Anyone can decode it. Never put passwords, PSA numbers, or sensitive PII in the payload.

### Why stateless?

This system uses **stateless authentication** — the server stores no session table, no Redis cache, no in-memory sessions. Every authenticated request carries a self-sufficient token. The server only needs `JWT_SECRET` to verify it. This works well for a single-school deployment with < 20 concurrent users.

---

## 2. How JWT Works in This System — Full Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       AUTHENTICATION FLOW                               │
└─────────────────────────────────────────────────────────────────────────┘

STEP 1 — LOGIN
  Browser                            Express Server                  PostgreSQL
  ──────                             ──────────────                  ──────────
  POST /api/auth/login ─────────────►  1. Find user by email
  { email, password }                  2. bcrypt.compare(password)  ◄── SELECT
                                       3. jwt.sign({ userId, role,
                                          mustChangePassword },
                                          JWT_SECRET, 8h)
  ◄──────────────────────────────────  4. return { token, user }

STEP 2 — STORING THE TOKEN
  Zustand authStore.setAuth(token, user)
  persist middleware → localStorage['auth-storage']

STEP 3 — AUTHENTICATED REQUEST
  Browser                            Express Server                  PostgreSQL
  ──────                             ──────────────                  ──────────
  GET /api/applications              authenticate middleware:
  Authorization: Bearer eyJhbG...──► 1. Extract token from header
                                      2. jwt.verify(token, JWT_SECRET)
                                      3. prisma.user.findUnique()   ──► SELECT
                                      4. check user.isActive
                                      authorize('REGISTRAR') ──────────────────
                                      controller logic ────────────► SELECT
  ◄────────────────────────────────── 5. return JSON response

STEP 4 — TOKEN EXPIRY OR DEACTIVATION
  Any API call ──────────────────────► authenticate returns 401
  Axios response interceptor:
    clearAuth() → localStorage cleared
    window.location.href = '/login'
```

---

## 3. Environment Setup — `.env` Configuration

### The current placeholder value (DO NOT use in production)

```dotenv
# server/.env  ← CURRENT VALUE — INSECURE, MUST BE CHANGED
JWT_SECRET="super-secret-jwt-key-change-in-production-min-32-chars"
```

This value is **a placeholder**. It is weak, public, and must be replaced before the system goes live. Anyone who knows this string can forge valid JWTs for any user in the system.

---

### How to generate a strong `JWT_SECRET`

A production JWT_SECRET must be:
- **At least 32 characters** (256-bit minimum for HS256)
- **Cryptographically random** — not a dictionary phrase, not a name
- **Different per environment** — dev, staging, and production must each have their own secret

**Method 1 — Node.js (recommended, works on any OS):**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Example output (generate your own — do not copy this):
```
a3f8c2d1e9b4f7a2c5e8d1b4f7a2c5e8d1b4f7a2c5e8d1b4f7a2c5e8d1b4f7a2
```

**Method 2 — OpenSSL (Linux/macOS/WSL):**

```bash
openssl rand -hex 64
```

**Method 3 — PowerShell (Windows):**

```powershell
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64))
```

---

### Complete `server/.env` reference

```dotenv
# ─────────────────────────────────────────────────────────────────
# server/.env
# NEVER commit this file. It is listed in .gitignore.
# Copy server/.env.example to server/.env and fill in real values.
# ─────────────────────────────────────────────────────────────────

# ── Database ────────────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/hnhs_enrollment"

# ── JWT ─────────────────────────────────────────────────────────
# REQUIRED: Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Minimum 32 characters. Must be kept secret. Different per environment.
JWT_SECRET="REPLACE_WITH_YOUR_GENERATED_SECRET_DO_NOT_USE_THIS_VALUE"

# ── Email (Resend SMTP) ──────────────────────────────────────────
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
EMAIL_FROM="noreply@hnhs.edu.ph"

# ── Server ──────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development

# ── CORS ────────────────────────────────────────────────────────
# In production: set to your actual frontend domain
ALLOWED_ORIGIN="http://localhost:5173"

# ── Admin Seed (used only during: pnpm prisma db seed) ──────────
ADMIN_EMAIL="admin@hnhs.edu.ph"
ADMIN_PASSWORD="Admin@HNHS2026!"
ADMIN_NAME="System Administrator"
```

### `server/.env.example` (commit this, not `.env`)

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="GENERATE_WITH: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
RESEND_API_KEY="re_your_resend_api_key"
EMAIL_FROM="noreply@yourdomain.edu.ph"
PORT=3000
NODE_ENV=development
ALLOWED_ORIGIN="http://localhost:5173"
ADMIN_EMAIL="admin@yourschool.edu.ph"
ADMIN_PASSWORD="ChangeThisOnFirstLogin!"
ADMIN_NAME="System Administrator"
```

> **Rule:** `.env` is in `.gitignore`. `.env.example` is committed. If `JWT_SECRET` is ever accidentally committed to version control, rotate it immediately — generate a new secret, update `.env`, and redeploy. All active tokens signed with the old secret become invalid.

---

## 4. Step-by-Step Implementation — Backend

### 4.1 Install Dependencies

```bash
# In the server/ package:
pnpm add jsonwebtoken bcryptjs
pnpm add -D @types/jsonwebtoken @types/bcryptjs
```

Verify `server/package.json` lists both as production dependencies (not dev-only).

---

### 4.2 Type Definitions

Create a shared type file so TypeScript knows what `req.user` contains throughout the app:

```ts
// server/src/types/auth.ts

export interface AuthPayload {
  userId:             number;
  role:               'SYSTEM_ADMIN' | 'REGISTRAR' | 'TEACHER';
  mustChangePassword: boolean;
  iat:                number;   // issued at — added automatically by jsonwebtoken
  exp:                number;   // expiry    — added automatically by jsonwebtoken
}
```

Augment Express's `Request` type so `req.user` is typed everywhere:

```ts
// server/src/types/express.d.ts

import { AuthPayload } from './auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
```

---

### 4.3 Token Generation — Auth Controller

```ts
// server/src/controllers/authController.ts

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { auditLog } from '../services/auditLogger.js';

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  // 1. Find the user by email
  const user = await prisma.user.findUnique({ where: { email } });

  // 2. Reject if user not found — use a generic message to prevent
  //    user enumeration attacks (don't reveal whether email exists)
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  // 3. Reject if account is deactivated — before checking the password,
  //    so deactivated users get a clear message, not a generic auth error
  if (!user.isActive) {
    return res.status(401).json({
      message: 'Your account has been deactivated. Contact the system administrator.',
    });
  }

  // 4. Verify password against bcrypt hash
  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  // 5. Sign the JWT — payload contains ONLY what the middleware needs
  //    Never include password, personal data, or secrets in the payload
  const token = jwt.sign(
    {
      userId:             user.id,
      role:               user.role,
      mustChangePassword: user.mustChangePassword,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  );

  // 6. Update lastLoginAt timestamp
  await prisma.user.update({
    where: { id: user.id },
    data:  { lastLoginAt: new Date() },
  });

  // 7. Write audit log (non-blocking)
  void auditLog({
    userId:      user.id,
    actionType:  'USER_LOGIN',
    description: `User ${user.email} logged in from ${req.ip}`,
    req,
  });

  // 8. Return the token and safe user object (no password hash)
  return res.json({
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

export async function me(req: Request, res: Response) {
  // req.user is populated by the authenticate middleware
  const user = await prisma.user.findUnique({
    where:  { id: req.user!.userId },
    select: { id: true, name: true, email: true, role: true, mustChangePassword: true },
  });
  return res.json(user);
}
```

---

### 4.4 Authentication Middleware

This middleware runs on every protected route. It does three things:
1. Extracts and verifies the JWT
2. Checks that the user account is still active in the database
3. Attaches the decoded payload to `req.user`

```ts
// server/src/middleware/authenticate.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { AuthPayload } from '../types/auth.js';

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 1. Check Authorization header format
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // 2. Verify the token signature and expiry
    //    jwt.verify throws if the token is tampered with or expired
    const token   = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;

    // 3. Look up the user in the database to check isActive
    //    This ensures deactivated users are blocked even if their token
    //    has not yet expired (tokens live up to 8h after deactivation)
    const user = await prisma.user.findUnique({
      where:  { id: decoded.userId },
      select: { isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: 'Account is inactive. Contact your system administrator.',
      });
    }

    // 4. Attach decoded payload to request — available in all controllers
    req.user = decoded;
    next();
  } catch {
    // jwt.verify throws JsonWebTokenError (invalid) or TokenExpiredError (expired)
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}
```

> **Note on the database check:** This adds one `SELECT` per authenticated request. For a school system with under 20 concurrent users this has no meaningful performance impact. The benefit — being able to immediately lock out a deactivated account — outweighs the overhead.

---

### 4.5 Authorization Middleware

Authorization runs **after** authentication and checks whether the authenticated user's role is permitted to access a specific route.

```ts
// server/src/middleware/authorize.ts

import { Request, Response, NextFunction } from 'express';
import { AuthPayload } from '../types/auth.js';

/**
 * Authorize one or more roles.
 * Usage: router.delete('/users/:id', authenticate, authorize('SYSTEM_ADMIN'), handler)
 */
export const authorize = (...allowedRoles: AuthPayload['role'][]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      // authenticate should have run first — this is a programming error
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }

    next();
  };
};
```

---

### 4.6 Applying Middleware to Routes

Apply `authenticate` to any route that requires a logged-in user. Chain `authorize(...)` immediately after for role restriction.

```ts
// server/src/routes/applicationRoutes.ts

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as ctrl from '../controllers/applicationController.js';

const router = Router();

// ── Public — no auth required ─────────────────────────────────────────────
router.post('/',                          ctrl.store);            // submit application
router.get('/track/:trackingNumber',      ctrl.track);            // track by tracking number

// ── REGISTRAR + SYSTEM_ADMIN — operational access ─────────────────────────
router.get('/',
  authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),
  ctrl.index
);
router.get('/:id',
  authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),
  ctrl.show
);
router.patch('/:id/approve',
  authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),
  ctrl.approve
);
router.patch('/:id/reject',
  authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'),
  ctrl.reject
);

export default router;
```

```ts
// server/src/routes/adminRoutes.ts

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as userCtrl  from '../controllers/adminUserController.js';
import * as emailCtrl from '../controllers/adminEmailLogController.js';
import * as sysCtrl   from '../controllers/adminSystemController.js';

const router = Router();

// All admin routes require SYSTEM_ADMIN role
router.use(authenticate, authorize('SYSTEM_ADMIN'));

router.get('/users',                  userCtrl.index);
router.post('/users',                 userCtrl.store);
router.put('/users/:id',              userCtrl.update);
router.patch('/users/:id/deactivate', userCtrl.deactivate);
router.patch('/users/:id/reactivate', userCtrl.reactivate);
router.patch('/users/:id/reset-password', userCtrl.resetPassword);

router.get('/email-logs',             emailCtrl.index);
router.get('/email-logs/export',      emailCtrl.exportCsv);
router.get('/email-logs/:id',         emailCtrl.show);
router.patch('/email-logs/:id/resend',emailCtrl.resend);

router.get('/system/health',          sysCtrl.health);
router.get('/dashboard/stats',        sysCtrl.dashboardStats);

export default router;
```

```ts
// server/src/routes/teacherRoutes.ts

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as ctrl from '../controllers/teacherController.js';

const router = Router();

router.get('/sections',
  authenticate, authorize('TEACHER', 'SYSTEM_ADMIN'),
  ctrl.mySections
);
router.get('/sections/:id',
  authenticate, authorize('TEACHER', 'SYSTEM_ADMIN'),
  ctrl.sectionDetail
);

export default router;
```

```ts
// server/src/app.ts — registering all route groups

import express from 'express';
import authRoutes        from './routes/authRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import sectionRoutes     from './routes/sectionRoutes.js';
import studentRoutes     from './routes/studentRoutes.js';
import settingsRoutes    from './routes/settingsRoutes.js';
import academicYearRoutes from './routes/academicYearRoutes.js';
import auditLogRoutes    from './routes/auditLogRoutes.js';
import teacherRoutes     from './routes/teacherRoutes.js';
import adminRoutes       from './routes/adminRoutes.js';

const app = express();
app.use(express.json());

app.use('/api/auth',           authRoutes);
app.use('/api/applications',   applicationRoutes);
app.use('/api/sections',       sectionRoutes);
app.use('/api/students',       studentRoutes);
app.use('/api/settings',       settingsRoutes);
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/audit-logs',     auditLogRoutes);
app.use('/api/teacher',        teacherRoutes);
app.use('/api/admin',          adminRoutes);   // ← all /api/admin/* routes

export default app;
```

---

## 5. Step-by-Step Implementation — Frontend

### 5.1 Install Dependencies

```bash
# In the client/ package:
pnpm add axios zustand
```

---

### 5.2 Zustand Auth Store

The auth store holds the JWT and the user object in memory and persists them to `localStorage` so the session survives page refreshes.

```ts
// client/src/stores/authStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Mirror the shape of what the login API returns
interface AuthUser {
  id:                 number;
  name:               string;
  email:              string;
  role:               'SYSTEM_ADMIN' | 'REGISTRAR' | 'TEACHER';
  mustChangePassword: boolean;
}

interface AuthState {
  token:    string | null;
  user:     AuthUser | null;
  setAuth:  (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:    null,
      user:     null,
      setAuth:  (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    {
      name: 'auth-storage',   // localStorage key
      // Only persist token and user — no need to persist actions
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
```

---

### 5.3 Axios Instance with Interceptors

The Axios instance automatically attaches the JWT to every outgoing request and handles `401` responses globally — no need to handle auth errors in individual API call functions.

```ts
// client/src/api/axiosInstance.ts

import axios from 'axios';
import { useAuthStore } from '../stores/authStore.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,  // e.g. "http://localhost:3000/api"
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor ─────────────────────────────────────────────────────
// Attach the Bearer token to every outgoing request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor ────────────────────────────────────────────────────
// Handle 401 (token expired, invalid, or account deactivated) globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear all auth state from memory and localStorage
      useAuthStore.getState().clearAuth();
      // Hard redirect to login — avoids stale React state
      window.location.href = '/login';
    }
    // For all other errors, reject so individual call sites can handle them
    return Promise.reject(error);
  }
);

export default api;
```

**Add `VITE_API_URL` to `client/.env`:**

```dotenv
# client/.env
VITE_API_URL="http://localhost:3000/api"
```

```dotenv
# client/.env.example
VITE_API_URL="http://localhost:3000/api"
```

---

### 5.4 Protected Route Component

The `ProtectedRoute` component wraps all authenticated routes in the React Router config. It reads the token and role from the Zustand store and redirects unauthenticated or unauthorized users before rendering any page content.

```tsx
// client/src/components/auth/ProtectedRoute.tsx

import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';

interface ProtectedRouteProps {
  allowedRoles: Array<'SYSTEM_ADMIN' | 'REGISTRAR' | 'TEACHER'>;
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { token, user } = useAuthStore();

  // 1. Not logged in at all → redirect to login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // 2. Logged in but wrong role → redirect to their own dashboard
  //    (avoids blank screen or confusing 403 page)
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // 3. Authorized — render child routes
  return <Outlet />;
}
```

**Usage in the router config:**

```tsx
// client/src/router/index.tsx

import { createBrowserRouter, redirect } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute.js';

export const router = createBrowserRouter([
  // ── Public routes ───────────────────────────────────────────────────────
  {
    path: '/',
    loader: async () => {
      const { enrollmentOpen } = await fetchPublicSettings();
      return redirect(enrollmentOpen ? '/apply' : '/closed');
    },
  },
  { path: '/apply',                  element: <GuestLayout><Apply /></GuestLayout>,   loader: applyLoader },
  { path: '/closed',                 element: <GuestLayout><EnrollmentClosed /></GuestLayout> },
  { path: '/track/:trackingNumber',  element: <GuestLayout><TrackApplication /></GuestLayout> },
  { path: '/login',                  element: <AuthLayout><Login /></AuthLayout> },

  // ── Protected: all three authenticated roles ─────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['REGISTRAR', 'TEACHER', 'SYSTEM_ADMIN']} />,
    children: [
      { path: '/dashboard',        element: <AppLayout><Dashboard /></AppLayout> },
      { path: '/applications',     element: <AppLayout><Applications /></AppLayout> },
      { path: '/applications/:id', element: <AppLayout><ApplicationDetail /></AppLayout> },
      { path: '/students',         element: <AppLayout><Students /></AppLayout> },
      { path: '/sections',         element: <AppLayout><Sections /></AppLayout> },
      { path: '/audit-logs',       element: <AppLayout><AuditLogs /></AppLayout> },
      { path: '/settings',         element: <AppLayout><Settings /></AppLayout> },
      { path: '/my-sections',      element: <AppLayout><MySections /></AppLayout> },
    ],
  },

  // ── Protected: System Admin only ─────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['SYSTEM_ADMIN']} />,
    children: [
      { path: '/admin/users',       element: <AppLayout><AdminUsers /></AppLayout> },
      { path: '/admin/email-logs',  element: <AppLayout><AdminEmailLogs /></AppLayout> },
      { path: '/admin/system',      element: <AppLayout><AdminSystemHealth /></AppLayout> },
    ],
  },

  // ── Force password change ─────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['REGISTRAR', 'TEACHER', 'SYSTEM_ADMIN']} />,
    children: [
      { path: '/change-password',   element: <AuthLayout><ChangePassword /></AuthLayout> },
    ],
  },

  // ── Fallback ──────────────────────────────────────────────────────────────
  { path: '*', element: <NotFound /> },
]);
```

---

### 5.5 Login Page — Calling the Auth API

```tsx
// client/src/pages/auth/Login.tsx

import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../../api/axiosInstance.js';
import { useAuthStore } from '../../stores/authStore.js';
import sileo from 'sileo';

const loginSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore((s) => s.setAuth);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    try {
      const res = await api.post('/auth/login', data);
      const { token, user } = res.data;

      // Save token and user to Zustand store (→ persisted to localStorage)
      setAuth(token, user);

      // If the Admin provisioned this account with mustChangePassword = true,
      // redirect to the forced change screen before anything else
      if (user.mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }

      // Otherwise go to the main dashboard
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const message = err.response?.data?.message ?? 'Login failed. Please try again.';
      sileo.error({ title: 'Login Failed', description: message });
    }
  };

  return (
    // ... render your login form JSX here using shadcn/ui components
    // register('email'), register('password'), handleSubmit(onSubmit), isSubmitting
  );
}
```

---

### 5.6 Forced Password Change on First Login

When a user account is created by the System Admin, `mustChangePassword` is set to `true`. The token carries this flag. Until the user changes their password, they are redirected to `/change-password` on every login and cannot access any other route.

```tsx
// client/src/pages/auth/ChangePassword.tsx

import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../../api/axiosInstance.js';
import { useAuthStore } from '../../stores/authStore.js';
import sileo from 'sileo';

const schema = z.object({
  newPassword: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/,  'Must contain at least one uppercase letter')
    .regex(/[0-9]/,  'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
});

type ChangePasswordForm = z.infer<typeof schema>;

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, setAuth, token } = useAuthStore();

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ChangePasswordForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: ChangePasswordForm) => {
    try {
      const res = await api.patch('/auth/change-password', {
        newPassword: data.newPassword,
      });

      // Server returns a fresh token with mustChangePassword = false
      setAuth(res.data.token, res.data.user);

      sileo.success({ title: 'Password Changed', description: 'You can now use the system.' });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      sileo.error({
        title: 'Error',
        description: err.response?.data?.message ?? 'Could not change password.',
      });
    }
  };

  return (
    // ... render the change-password form JSX here
  );
}
```

**Backend endpoint for password change:**

```ts
// server/src/routes/authRoutes.ts — add this route

router.patch('/change-password', authenticate, authController.changePassword);
```

```ts
// server/src/controllers/authController.ts — add this handler

export async function changePassword(req: Request, res: Response) {
  const { newPassword } = req.body;
  const userId = req.user!.userId;

  const hashed = await bcrypt.hash(newPassword, 12);

  const updated = await prisma.user.update({
    where: { id: userId },
    data:  { password: hashed, mustChangePassword: false, updatedAt: new Date() },
    select: { id: true, name: true, email: true, role: true, mustChangePassword: true },
  });

  // Issue a fresh token with mustChangePassword = false
  const token = jwt.sign(
    { userId: updated.id, role: updated.role, mustChangePassword: false },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  );

  return res.json({ token, user: updated });
}
```

---

## 6. Role-Based Access Reference

### What Each Role's JWT Payload Looks Like

**SYSTEM_ADMIN:**
```json
{
  "userId": 1,
  "role": "SYSTEM_ADMIN",
  "mustChangePassword": false,
  "iat": 1738368000,
  "exp": 1738396800
}
```

**REGISTRAR:**
```json
{
  "userId": 2,
  "role": "REGISTRAR",
  "mustChangePassword": false,
  "iat": 1738368000,
  "exp": 1738396800
}
```

**TEACHER:**
```json
{
  "userId": 5,
  "role": "TEACHER",
  "mustChangePassword": true,
  "iat": 1738368000,
  "exp": 1738396800
}
```

> `iat` = issued at (Unix timestamp). `exp` = expiry (Unix timestamp = `iat + 28800` seconds = 8 hours).

---

### Backend `authorize()` Usage by Route Group

| Route | Middleware Chain |
|---|---|
| `POST /api/auth/login` | *(none — public)* |
| `GET /api/settings/public` | *(none — public)* |
| `POST /api/applications` | *(none — public)* |
| `GET /api/applications` | `authenticate`, `authorize('REGISTRAR', 'SYSTEM_ADMIN')` |
| `PATCH /api/applications/:id/approve` | `authenticate`, `authorize('REGISTRAR', 'SYSTEM_ADMIN')` |
| `GET /api/sections` | `authenticate`, `authorize('REGISTRAR', 'SYSTEM_ADMIN')` |
| `GET /api/teacher/sections` | `authenticate`, `authorize('TEACHER', 'SYSTEM_ADMIN')` |
| `GET /api/audit-logs` | `authenticate`, `authorize('REGISTRAR', 'SYSTEM_ADMIN')` |
| `GET /api/admin/users` | `authenticate`, `authorize('SYSTEM_ADMIN')` |
| `GET /api/admin/email-logs` | `authenticate`, `authorize('SYSTEM_ADMIN')` |
| `GET /api/admin/system/health` | `authenticate`, `authorize('SYSTEM_ADMIN')` |

---

### Frontend Role Checks

For conditional UI rendering inside components (e.g., showing/hiding sidebar items, action buttons):

```tsx
// Pattern — read role from the auth store
import { useAuthStore } from '../stores/authStore.js';

export function SomeComponent() {
  const user = useAuthStore((s) => s.user);

  const isAdmin     = user?.role === 'SYSTEM_ADMIN';
  const isRegistrar = user?.role === 'REGISTRAR';
  const isTeacher   = user?.role === 'TEACHER';

  return (
    <>
      {/* Visible to Registrar and Admin only */}
      {(isRegistrar || isAdmin) && <button>Approve Application</button>}

      {/* Visible to Admin only */}
      {isAdmin && <button>Manage Users</button>}

      {/* Visible to Teacher only */}
      {isTeacher && <button>View My Sections</button>}
    </>
  );
}
```

> **Frontend role checks are for UX only — never for security.** A determined user can manipulate the frontend. All actual access control happens on the backend via `authorize()` middleware. The frontend check just hides irrelevant UI.

---

## 7. Token Lifecycle & Invalidation

### Normal lifecycle

```
User logs in → token issued (8h TTL)
     │
     ▼
User makes requests → authenticate middleware validates token on every call
     │
     ▼
8 hours pass → token expires → next request returns 401
     │
     ▼
Axios response interceptor catches 401 → clearAuth() → redirect to /login
     │
     ▼
User logs in again → new token issued
```

### Early invalidation scenarios

JWT is stateless — there is no token blacklist. Instead, the system uses the database `isActive` check to handle the two main early-invalidation cases:

| Scenario | What Happens |
|---|---|
| **Admin deactivates a user** | `isActive = false` saved to DB. On the user's very next API call, `authenticate` middleware's `prisma.user.findUnique` returns `isActive = false` → `401` returned → Axios interceptor clears auth → redirect to login. Effective within one request. |
| **Admin resets a user's password** | `updatedAt` changes in DB. The old token is technically still cryptographically valid for up to 8h, but because `authenticate` now performs the `isActive` DB lookup on every request, a full stateless blacklist is not needed for this use case. The user must log in again with the new password. |
| **Token expires naturally** | `jwt.verify()` throws `TokenExpiredError` → middleware returns `401` → Axios interceptor clears auth. |
| **Token tampered with** | `jwt.verify()` throws `JsonWebTokenError` → middleware returns `401`. |
| **JWT_SECRET rotated** | All existing tokens become invalid immediately (signature verification fails). All users are logged out on their next request. |

### Token expiry — `exp` claim

The `exp` field in the decoded payload is a Unix timestamp. You can check it on the frontend before making a request if you want to show a "session expiring soon" warning:

```ts
// Optional — check token expiry on the frontend
import { jwtDecode } from 'jwt-decode';
import { AuthPayload } from '../types/auth.js';

export function isTokenExpiringSoon(token: string, thresholdMinutes = 15): boolean {
  try {
    const { exp } = jwtDecode<AuthPayload>(token);
    const expiresInMs = exp * 1000 - Date.now();
    return expiresInMs < thresholdMinutes * 60 * 1000;
  } catch {
    return true; // treat invalid token as expired
  }
}
```

> Install: `pnpm add jwt-decode` in the client/ package.

---

## 8. Security Checklist

Work through this list before deploying to production:

| # | Check | How to Verify |
|---|---|---|
| ✅ | `JWT_SECRET` is at least 64 hex characters (not the placeholder) | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| ✅ | `.env` is listed in `.gitignore` and has never been committed | `git log --all -- server/.env` should return nothing |
| ✅ | `.env.example` is committed and has no real secrets | Review `server/.env.example` |
| ✅ | Passwords are hashed with bcrypt at 12 salt rounds | Check `authController.ts` — `bcrypt.hash(password, 12)` |
| ✅ | `JWT_SECRET` is different in development and production | Maintain two separate `.env` files |
| ✅ | Token expiry is set to 8 hours | `{ expiresIn: '8h' }` in `jwt.sign()` |
| ✅ | `authenticate` middleware checks `isActive` on every request | Review `authenticate.ts` — `prisma.user.findUnique` + `!user.isActive` check |
| ✅ | The `SYSTEM_ADMIN` role cannot be assigned through the API | `adminUserController.ts` rejects `role === 'SYSTEM_ADMIN'` with `403` |
| ✅ | Passwords are never logged — not in audit logs, not in `console.log` | Search codebase for any `console.log(password)` or `description: ... password ...` |
| ✅ | The JWT payload contains no PII beyond `userId` and `role` | Verify `jwt.sign()` payload in `authController.ts` |
| ✅ | HTTPS is enforced in production | Configure your reverse proxy (Nginx/Caddy) to redirect HTTP → HTTPS |
| ✅ | CORS origin allowlist is not `*` in production | `ALLOWED_ORIGIN` env var set to the actual frontend domain |
| ✅ | Login is rate-limited to 20 req/min | `express-rate-limit` applied to `POST /api/auth/login` |
| ✅ | `mustChangePassword` flow enforces password change before dashboard access | Test: create a user, log in, confirm redirect to `/change-password` |

---

## 9. Common Errors & Fixes

### `Error: secretOrPrivateKey must have a value`

**Cause:** `process.env.JWT_SECRET` is `undefined` — either the `.env` file is missing, not loaded, or the variable name is misspelled.

**Fix:**
1. Confirm `server/.env` exists and contains `JWT_SECRET="your-secret"`.
2. Confirm `dotenv` is loaded at the very top of `server/src/server.ts`:
   ```ts
   import 'dotenv/config';  // must be the first import
   ```
3. Confirm the spelling matches exactly: `JWT_SECRET` (uppercase, underscore).

---

### `JsonWebTokenError: invalid signature`

**Cause:** The token was signed with a different `JWT_SECRET` than the one currently in `.env`. This happens when the secret is rotated, or when running dev and production with different secrets.

**Fix:** Ensure the `JWT_SECRET` used to sign (login) and verify (middleware) are identical. If you rotated the secret, all existing tokens are invalid — users must log in again.

---

### `TokenExpiredError: jwt expired`

**Cause:** The token's `exp` timestamp has passed (8 hours after login).

**Fix on the frontend:** The Axios response interceptor catches the resulting `401` automatically and redirects to login. No manual handling required.

**Fix if testing:** Log in again to get a fresh token.

---

### `401 Unauthorized` — user was just logged in

**Cause:** Most likely the `isActive` check failed — the account was deactivated by an Admin between the login and this request.

**Fix:** The Admin must reactivate the account at `/admin/users` → `[✓ Reactivate]`.

---

### `403 Forbidden` — correct credentials, wrong route

**Cause:** The user's role does not match what `authorize()` requires for that route. Example: a TEACHER trying to access `/api/applications`.

**Fix on the frontend:** Hide the UI element that leads to this route for users who lack the required role. Check `SidebarContent.tsx` and any direct navigation links.

**Fix on the backend:** Verify the `authorize()` call on the route includes the correct roles.

---

### Token not attached to requests (`Authorization` header missing)

**Cause:** Either the token was never saved to the auth store, or `api` (the Axios instance) is not being used — some file is importing `axios` directly instead of the configured instance.

**Fix:**
1. Confirm the login call uses `api.post('/auth/login', ...)` and calls `setAuth(token, user)`.
2. Search the codebase for `import axios from 'axios'` — all API calls must use `import api from '../api/axiosInstance.js'` instead.

---

### `localStorage` not cleared after logout

**Cause:** `clearAuth()` was not called, or it was called but the Zustand `persist` middleware key does not match.

**Fix:** Verify `clearAuth` in `authStore.ts` calls `set({ token: null, user: null })` and the `persist` middleware key is `'auth-storage'`. After calling `clearAuth()`, inspect `localStorage` in DevTools — the `auth-storage` key should be gone or contain `{ "state": { "token": null, "user": null } }`.

---

*Document version: v2.3.0*
*System: Hinigaran National High School — Admission & Enrollment Information Management System*
*Stack: PERN (PostgreSQL 18 · Express.js 5.1 · React 19.x · Node.js 22 LTS)*
*Auth: jsonwebtoken · bcryptjs · Zustand persist · Axios interceptors*