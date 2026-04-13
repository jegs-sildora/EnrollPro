import { createBrowserRouter, Navigate } from "react-router";

import AuthLayout from "@/shared/layouts/AuthLayout";
import AppLayout from "@/shared/layouts/AppLayout";
import RootLayout from "@/shared/layouts/RootLayout";
import ProtectedRoute from "@/shared/components/ProtectedRoute";

import Login from "@/features/auth/pages/Login";
import ChangePassword from "@/features/auth/pages/ChangePassword";
import Dashboard from "@/features/dashboard/pages/Index";
import EarlyRegistration from "@/features/admission/pages/early-registration/EarlyRegistrationList";
import EarlyRegistrationDetail from "@/features/admission/pages/early-registration/EarlyRegistrationDetail";
import RegistrationPipelines from "@/features/admission/pages/pipelines/RegistrationPipelines";
import Enrollment from "@/features/enrollment/pages/Index";
import Students from "@/features/students/pages/Index";
import Profile from "@/features/students/pages/Profile";
import LearnerPortal from "@/features/learner/pages/LearnerPortal";
import Sections from "@/features/sections/pages/Index";
import AuditLogs from "@/features/audit-logs/pages/Index";
import Settings from "@/features/settings/pages/Index";
import DocumentaryRequirements from "@/features/enrollment/pages/DocumentaryRequirements";
import NotFound from "@/shared/components/NotFound";

// Admin Pages
import AdminUsers from "@/features/admin/pages/Users";
import EmailLogs from "@/features/admin/pages/EmailLogs";
import SystemHealth from "@/features/admin/pages/SystemHealth";
import Teachers from "@/features/teachers/pages/Index";

// F2F BASIC EDUCATION EARLY REGISTRATION FORM Page
import F2FEarlyRegistration from "@/features/admission/pages/f2f/Index";

import Apply from "@/features/admission/pages/apply/Index";
import Monitor from "@/features/admission/pages/apply/Monitor";

// DO 017 s.2025 — Standalone Early Registration Module (Grades 7–10)
import EarlyRegistrationApply from "@/features/early-registration/pages/apply/Index";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // Public routes
      {
        path: "/enrollment",
        element: <Apply />,
      },
      {
        path: "/early-registration",
        element: <EarlyRegistrationApply />,
      },
      {
        path: "/monitor",
        element: <Monitor />,
      },
      {
        path: "/learner",
        element: <LearnerPortal />,
      },
      // Auth routes
      {
        path: "/login",
        element: (
          <AuthLayout>
            <Login />
          </AuthLayout>
        ),
      },
      {
        path: "/change-password",
        element: <ChangePassword />,
      },

      // Protected routes for Registrar and System Admin
      {
        element: (
          <ProtectedRoute allowedRoles={["REGISTRAR", "SYSTEM_ADMIN"]} />
        ),
        children: [
          {
            path: "/dashboard",
            element: (
              <AppLayout>
                <Dashboard />
              </AppLayout>
            ),
          },
          {
            path: "/monitoring/f2f-early-registration",
            element: (
              <AppLayout>
                <F2FEarlyRegistration />
              </AppLayout>
            ),
          },
          {
            path: "/applications",
            element: <Navigate to="/monitoring/early-registration" replace />,
          },
          {
            path: "/applications/early-registration",
            element: <Navigate to="/monitoring/early-registration" replace />,
          },
          {
            path: "/applications/enrollment",
            element: <Navigate to="/monitoring/enrollment" replace />,
          },
          {
            path: "/applications/admission/:id",
            element: <Navigate to="/monitoring/early-registration" replace />,
          },
          {
            path: "/monitoring/early-registration",
            element: (
              <AppLayout>
                <EarlyRegistration />
              </AppLayout>
            ),
          },
          {
            path: "/monitoring/early-registration/pipelines",
            element: (
              <AppLayout>
                <RegistrationPipelines />
              </AppLayout>
            ),
          },
          {
            path: "/monitoring/early-registration/:id",
            element: (
              <AppLayout>
                <EarlyRegistrationDetail />
              </AppLayout>
            ),
          },
          {
            path: "/monitoring/enrollment",
            element: (
              <AppLayout>
                <Enrollment />
              </AppLayout>
            ),
          },
          {
            path: "/students",
            element: (
              <AppLayout>
                <Students />
              </AppLayout>
            ),
          },
          {
            path: "/students/:id",
            element: (
              <AppLayout>
                <Profile />
              </AppLayout>
            ),
          },
          {
            path: "/sections",
            element: (
              <AppLayout>
                <Sections />
              </AppLayout>
            ),
          },
          {
            path: "/monitoring/enrollment/requirements",
            element: (
              <AppLayout>
                <DocumentaryRequirements />
              </AppLayout>
            ),
          },
          {
            path: "/audit-logs",
            element: (
              <AppLayout>
                <AuditLogs />
              </AppLayout>
            ),
          },
          {
            path: "/settings",
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
        element: <ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]} />,
        children: [
          {
            path: "/teachers",
            element: (
              <AppLayout>
                <Teachers />
              </AppLayout>
            ),
          },
          {
            path: "/admin/users",
            element: (
              <AppLayout>
                <AdminUsers />
              </AppLayout>
            ),
          },
          {
            path: "/admin/email-logs",
            element: (
              <AppLayout>
                <EmailLogs />
              </AppLayout>
            ),
          },
          {
            path: "/admin/system",
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
        path: "/",
        element: <Navigate to="/dashboard" replace />,
      },

      // Fallback
      { path: "*", element: <NotFound /> },
    ],
  },
]);
