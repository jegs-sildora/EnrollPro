import { createBrowserRouter, Navigate } from 'react-router';

import AuthLayout from '@/layouts/AuthLayout';
import AppLayout from '@/layouts/AppLayout';
import RootLayout from '@/layouts/RootLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

import Login from '@/pages/auth/Login';
import ChangePassword from '@/pages/auth/ChangePassword';
import Dashboard from '@/pages/dashboard/Index';
import EarlyRegistration from '@/pages/applications/early-registration/EarlyRegistrationList';
import EarlyRegistrationDetail from '@/pages/applications/early-registration/EarlyRegistrationDetail';
import Enrollment from '@/pages/applications/enrollment/Index';
import Students from '@/pages/students/Index';
import Sections from '@/pages/sections/Index';
import AuditLogs from '@/pages/audit-logs/Index';
import Settings from '@/pages/settings/Index';
import NotFound from '@/pages/NotFound';

// Admin Pages
import AdminUsers from '@/pages/admin/Users';
import EmailLogs from '@/pages/admin/EmailLogs';
import SystemHealth from '@/pages/admin/SystemHealth';
import Teachers from '@/pages/teachers/Index';

// F2F EARLY REGISTRATION Page
import F2FEarlyRegistration from '@/pages/f2f-early-registration/Index';

import Apply from '@/pages/apply/Index';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
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
        path: '/change-password',
        element: <ChangePassword />,
      },

      // Protected routes for Registrar and System Admin
      {
        element: <ProtectedRoute allowedRoles={['REGISTRAR', 'SYSTEM_ADMIN']} />,
        children: [
          {
            path: '/dashboard',
            element: (
              <AppLayout>
                <Dashboard />
              </AppLayout>
            ),
          },
          {
            path: '/f2f-early-registration',
            element: (
              <AppLayout>
                <F2FEarlyRegistration />
              </AppLayout>
            ),
          },
          {
            path: '/applications',
            element: <Navigate to="/applications/early-registration" replace />,
          },
          {
            path: '/applications/early-registration',
            element: (
              <AppLayout>
                <EarlyRegistration />
              </AppLayout>
            ),
          },
          {
            path: '/applications/admission/:id',
            element: (
              <AppLayout>
                <EarlyRegistrationDetail />
              </AppLayout>
            ),
          },
          {
            path: '/applications/enrollment',
            element: (
              <AppLayout>
                <Enrollment />
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

      // Protected routes for System Admin Only
      {
        element: <ProtectedRoute allowedRoles={['SYSTEM_ADMIN']} />,
        children: [
          {
            path: '/teachers',
            element: (
              <AppLayout>
                <Teachers />
              </AppLayout>
            ),
          },
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
        ],
      },

      // Default redirect
      {
        path: '/',
        element: <Navigate to="/dashboard" replace />,
      },

      // Fallback
      { path: '*', element: <NotFound /> },
    ],
  },
]);
