/* eslint-disable react-refresh/only-export-components */
// router/index.tsx
import { createBrowserRouter, Navigate } from "react-router";

import AuthLayout from "@/shared/layouts/AuthLayout";
import AppLayout from "@/shared/layouts/AppLayout";
import TeacherIntakeLayout from "@/shared/layouts/TeacherIntakeLayout";
import PublicLayout from "@/shared/layouts/PublicLayout";
import RootLayout from "@/shared/layouts/RootLayout";
import ProtectedRoute from "@/shared/components/ProtectedRoute";

import Login from "@/features/auth/pages/Login";
import Dashboard from "@/features/dashboard/pages/Index";

import Enrollment from "@/features/enrollment/pages/Index";
import EosyUpdating from "@/features/enrollment/pages/EosyIndex";
import RegistrarEOSYWorkspace from "@/features/enrollment/pages/RegistrarEOSYWorkspace";
import WalkInEncoder from "@/features/enrollment/pages/WalkInEncoder";
import Students from "@/features/students/pages/Index";
import Profile from "@/features/students/pages/Profile";

import ChangePassword from "@/features/auth/components/ChangePasswordModal";
import Sections from "@/features/sections/pages/Index"
import Homerooms from "@/features/sections/pages/Homerooms"
import AuditLogs from "@/features/audit-logs/pages/Index";
import Settings from "@/features/settings/pages/Index";
import NotFound from "@/shared/components/NotFound";

// Admin Pages
import AdminUsers from "@/features/admin/pages/Users";
import SystemHealth from "@/features/admin/pages/SystemHealth";
import Teachers from "@/features/teachers/pages/Index";
import IntakeDashboard from "@/features/intake/pages/IntakeDashboard";



import Apply from "@/features/admission/pages/online-enrollment/Index";
import Monitor from "@/features/admission/pages/online-enrollment/Monitor";
import SampleIntegrationPage from "@/features/sample-integration/pages/Index";


import BOSYPage from "@/features/bosy/pages/BOSYPage";
import ReadingAssessmentPage from "@/features/reading-assessment/pages/ReadingAssessmentPage";

import { lazy } from "react";

const IntegrationHub = lazy(
  () => import("@/features/integration/pages/IntegrationHub"),
);


export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [


      // 2. Public routes (other than learner portal)
      {
        element: <PublicLayout />,
        children: [
          {
            path: "/enrollment",
            element: <Apply />,
          },

          {
            path: "/monitor",
            element: <Monitor />,
          },
          {
            path: "/sample-integration",
            element: <SampleIntegrationPage />,
          },
          {
            path: "/change-password",
            element: <ChangePassword />,
          },
        ],
      },

      // 3. Auth routes (Staff login)
      {
        element: <AuthLayout />,
        children: [
          {
            path: "/staff/login",
            element: <Login />,
          },
        ],
      },

      // 4. Protected routes for Head Registrar and System Admin
      {
        element: (
          <ProtectedRoute
            allowedRoles={["HEAD_REGISTRAR", "REGISTRAR", "SYSTEM_ADMIN"]}
          />
        ),
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                path: "/dashboard",
                element: <Dashboard />,
              },
              {
                path: "/applications",
                element: (
                  <Navigate
                    to="/monitoring/enrollment"
                    replace
                  />
                ),
              },
              {
                path: "/monitoring/enrollment",
                element: <Enrollment />,
              },
              {
                path: "/monitoring/enrollment/walk-in",
                element: <WalkInEncoder />,
              },
              {
                path: "/monitoring/enrollment/eosy",
                element: <EosyUpdating />,
              },
              {
                path: "/monitoring/enrollment/eosy/workspace",
                element: <RegistrarEOSYWorkspace />,
              },
              {
                path: "/bosy",
                element: <BOSYPage />,
              },
              {
                path: "/students",
                element: <Students />,
              },
              {
                path: "/students/:id",
                element: <Profile />,
              },
              {
                path: "/sections",
                element: <Sections />,
              },
              {
                path: "/sections/homerooms",
                element: <Homerooms />,
              },
              {
                path: "/monitoring/enrollment/requirements",
                element: (
                  <Navigate
                    to="/settings"
                    replace
                  />
                ),
              },
              {
                path: "/enrollment/requirements",
                element: (
                  <Navigate
                    to="/settings"
                    replace
                  />
                ),
              },
              {
                path: "/settings",
                element: <Settings />,
              },
              {
                path: "/intake",
                element: <IntakeDashboard />,
              },
              // Protected routes for System Admin Only
              {
                element: <ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]} />,
                children: [
                  {
                    path: "/teachers",
                    element: <Teachers />,
                  },
                  {
                    path: "/admin/users",
                    element: <AdminUsers />,
                  },
                  {
                    path: "/admin/system",
                    element: <SystemHealth />,
                  },
                  {
                    path: "/admin/integration",
                    element: <IntegrationHub />,
                  },
                  {
                    path: "/audit-logs",
                    element: <AuditLogs />,
                  },
                ],
              },
            ],
          },
        ],
      },

      // 5. Reading Assessment (Teacher + Admin access)
      {
        element: (
          <ProtectedRoute
            allowedRoles={[
              "HEAD_REGISTRAR",
              "REGISTRAR",
              "SYSTEM_ADMIN",
              "TEACHER",
              "MRF",
            ]}
          />
        ),
        children: [
          {
            element: <TeacherIntakeLayout />,
            children: [
              {
                path: "/reading-assessment",
                element: <ReadingAssessmentPage />,
              },
            ],
          },
        ],
      },

      // 6. Default redirects & Fallback
      {
        path: "/",
        element: (
          <Navigate
            to="/dashboard"
            replace
          />
        ),
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
