import { createBrowserRouter, Navigate } from 'react-router';

import AuthLayout from '@/layouts/AuthLayout';
import AppLayout from '@/layouts/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import ChangePassword from '@/pages/auth/ChangePassword';
import Dashboard from '@/pages/dashboard/Index';
import Applications from '@/pages/applications/Index';
import Students from '@/pages/students/Index';
import Sections from '@/pages/sections/Index';
import AuditLogs from '@/pages/audit-logs/Index';
import Settings from '@/pages/settings/Index';
import NotFound from '@/pages/NotFound';

// New Admin Pages
import AdminUsers from '@/pages/admin/Users';
import EmailLogs from '@/pages/admin/EmailLogs';
import SystemHealth from '@/pages/admin/SystemHealth';

// New Teacher Page
import MySections from '@/pages/my-sections/Index';

import Apply from '@/pages/apply/Index';

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/apply',
    element: <Apply />,
  },
  // Auth routes
  {
    path: '/login',
    element: (
      <AuthLayout>
        <Login />
      </AuthLayout>
    ),
  },
  {
    path: '/register',
    element: (
      <AuthLayout>
        <Register />
      </AuthLayout>
    ),
  },
  {
    path: '/change-password',
    element: <ChangePassword />,
  },

  // Protected routes for Registrar, Teacher, and System Admin
  {
    element: <ProtectedRoute allowedRoles={['REGISTRAR', 'TEACHER', 'SYSTEM_ADMIN']} />,
    children: [
      {
        path: '/dashboard',
        element: (
          <AppLayout>
            <Dashboard />
          </AppLayout>
        ),
      },
    ],
  },

  // Protected routes for Registrar and System Admin
  {
    element: <ProtectedRoute allowedRoles={['REGISTRAR', 'SYSTEM_ADMIN']} />,
    children: [
      {
        path: '/applications',
        element: (
          <AppLayout>
            <Applications />
          </AppLayout>
        ),
      },
      {
        path: '/students',
        element: (
          <AppLayout>
            <Students />
          </AppLayout>
        ),
      },
      {
        path: '/sections',
        element: (
          <AppLayout>
            <Sections />
          </AppLayout>
        ),
      },
    ],
  },

  // Protected routes for System Admin Only
  {
    element: <ProtectedRoute allowedRoles={['SYSTEM_ADMIN']} />,
    children: [
      {
        path: '/admin/users',
        element: (
          <AppLayout>
            <AdminUsers />
          </AppLayout>
        ),
      },
      {
        path: '/admin/email-logs',
        element: (
          <AppLayout>
            <EmailLogs />
          </AppLayout>
        ),
      },
      {
        path: '/admin/system',
        element: (
          <AppLayout>
            <SystemHealth />
          </AppLayout>
        ),
      },
      {
        path: '/audit-logs',
        element: (
          <AppLayout>
            <AuditLogs />
          </AppLayout>
        ),
      },
      {
        path: '/settings',
        element: (
          <AppLayout>
            <Settings />
          </AppLayout>
        ),
      },
    ],
  },

  // Protected routes for Teacher Only
  {
    element: <ProtectedRoute allowedRoles={['TEACHER']} />,
    children: [
      {
        path: '/my-sections',
        element: (
          <AppLayout>
            <MySections />
          </AppLayout>
        ),
      },
    ],
  },

  // Default redirect
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },

  // Fallback
  { path: '*', element: <NotFound /> },
]);
