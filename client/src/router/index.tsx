/* eslint-disable react-refresh/only-export-components */
// router/index.tsx
import { createBrowserRouter, Navigate } from "react-router";

import AuthLayout from "@/shared/layouts/AuthLayout";
import AppLayout from "@/shared/layouts/AppLayout";
import PublicLayout from "@/shared/layouts/PublicLayout";
import RootLayout from "@/shared/layouts/RootLayout";
import ProtectedRoute from "@/shared/components/ProtectedRoute";

import Login from "@/features/auth/pages/Login";
import Dashboard from "@/features/dashboard/pages/Index";
import EarlyRegistrationWorkspace from "@/features/admission/pages/early-registration/EarlyRegistrationWorkspace";
import EarlyRegistrationDetail from "@/features/admission/pages/early-registration/EarlyRegistrationDetail";
import Enrollment from "@/features/enrollment/pages/Index";
import EosyUpdating from "@/features/enrollment/pages/EosyIndex";
import RegistrarEOSYWorkspace from "@/features/enrollment/pages/RegistrarEOSYWorkspace";
import WalkInEncoder from "@/features/enrollment/pages/WalkInEncoder";
import Students from "@/features/students/pages/Index";
import Profile from "@/features/students/pages/Profile";
import LearnerPortal from "@/features/learner/pages/LearnerPortal";
import { LookupForm as LearnerLogin } from "@/features/learner/pages/LearnerLogin";
import OnboardingConfirm from "@/features/learner/pages/OnboardingConfirm";
import OnboardingGuard from "@/features/learner/components/OnboardingGuard";
import ChangePassword from "@/features/auth/components/ChangePasswordModal";
import Sections from "@/features/sections/pages/Index"
import Homerooms from "@/features/sections/pages/Homerooms"
import SectioningWorkspace from "@/features/sections/pages/SectioningWorkspace";
import SectioningHub from "@/features/sections/pages/SectioningHub";
import AuditLogs from "@/features/audit-logs/pages/Index";
import Settings from "@/features/settings/pages/Index";
import NotFound from "@/shared/components/NotFound";

// Admin Pages
import AdminUsers from "@/features/admin/pages/Users";
import SystemHealth from "@/features/admin/pages/SystemHealth";
import Teachers from "@/features/teachers/pages/Index";
import IntakeDashboard from "@/features/intake/pages/IntakeDashboard";

// F2F Basic Education Early Registration Form Page
import F2FEarlyRegistration from "@/features/admission/pages/f2f/Index";

import Apply from "@/features/admission/pages/online-enrollment/Index";
import Monitor from "@/features/admission/pages/online-enrollment/Monitor";
import SampleIntegrationPage from "@/features/sample-integration/pages/Index";

// DO 017 s.2025 — Standalone Early Registration Module (Grades 7–10)
import EarlyRegistrationApply from "@/features/early-registration/pages/apply/Index";
import BOSYPage from "@/features/bosy/pages/BOSYPage";

import { lazy } from "react";

const IntegrationHub = lazy(
  () => import("@/features/integration/pages/IntegrationHub"),
);


export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // 1. All Learner Routes (Isolated by Prefix)
      {
        path: "/learner",
        children: [
          {
            path: "login",
            element: <LearnerLogin />,
          },
          {
            // Onboarding Tunnel & Dashboard Guard
            element: <OnboardingGuard />,
            children: [
              {
                path: "onboarding",
                children: [
                  {
                    path: "confirm",
                    element: <OnboardingConfirm />,
                  },
                ],
              },
              {
                element: <ProtectedRoute allowedRoles={["LEARNER"]} />,
                children: [
                  {
                    element: <PublicLayout />,
                    children: [
                      {
                        index: true,
                        element: <LearnerPortal />,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },

      // 2. Public routes (other than learner portal)
      {
        element: <PublicLayout />,
        children: [
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
                path: "/monitoring/f2f-early-registration",
                element: <F2FEarlyRegistration />,
              },
              {
                path: "/applications",
                element: (
                  <Navigate
                    to="/monitoring/early-registration"
                    replace
                  />
                ),
              },
              {
                path: "/applications/early-registration",
                element: (
                  <Navigate
                    to="/monitoring/early-registration"
                    replace
                  />
                ),
              },
              {
                path: "/applications/enrollment",
                element: (
                  <Navigate
                    to="/monitoring/enrollment"
                    replace
                  />
                ),
              },
              {
                path: "/applications/admission/:id",
                element: (
                  <Navigate
                    to="/monitoring/early-registration"
                    replace
                  />
                ),
              },
              {
                path: "/monitoring/early-registration",
                element: <EarlyRegistrationWorkspace />,
              },
              {
                path: "/monitoring/early-registration/pipelines",
                element: (
                  <Navigate
                    to="/monitoring/early-registration?view=batch"
                    replace
                  />
                ),
              },
              {
                path: "/monitoring/early-registration/:id",
                element: <EarlyRegistrationDetail />,
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
                path: "/sections/workspace",
                element: <SectioningWorkspace />,
              },
              {
                path: "/sectioning",
                element: <SectioningHub />,
              },
              {
                path: "/sectioning/home-room",
                element: <SectioningWorkspace />,
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

      // 5. Shared routes for Admin + Teacher (Intake Dashboard)
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
            element: <AppLayout />,
            children: [
              {
                path: "/intake",
                element: <IntakeDashboard />,
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
