/* eslint-disable react-refresh/only-export-components */
// router/index.tsx
import { createBrowserRouter, Navigate } from "react-router";
import { useLocation } from "react-router";
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { PageLoadingSkeleton, type SkeletonPageVariant } from "@/shared/components/PageLoadingSkeleton";

import AuthLayout from "@/shared/layouts/AuthLayout";
import AppLayout from "@/shared/layouts/AppLayout";
import PublicLayout from "@/shared/layouts/PublicLayout";
import RootLayout from "@/shared/layouts/RootLayout";
import LearnerAuthLayout from "@/shared/layouts/LearnerAuthLayout";
import ProtectedRoute from "@/shared/components/ProtectedRoute";
import NotFound from "@/shared/components/NotFound";

const SMARTLayout = lazy(() => import("@/features/smart/layouts/SMARTLayout"));
const Login = lazy(() => import("@/features/auth/pages/Login"));
const Dashboard = lazy(() => import("@/features/dashboard/pages/Index"));
const LearnerLogin = lazy(() => import("@/features/learner/pages/Login"));
const LearnerDashboard = lazy(() => import("@/features/learner/pages/Dashboard"));
const Enrollment = lazy(() => import("@/features/enrollment/pages/Index"));
const EosyUpdating = lazy(() => import("@/features/enrollment/pages/EosyIndex"));
const RegistrarEOSYWorkspace = lazy(
  () => import("@/features/enrollment/pages/RegistrarEOSYWorkspace"),
);
const Students = lazy(() => import("@/features/students/pages/Index"));
const Profile = lazy(() => import("@/features/students/pages/Profile"));
const ChangePassword = lazy(
  () => import("@/features/auth/components/ChangePasswordModal"),
);
const AuditLogs = lazy(() => import("@/features/audit-logs/pages/Index"));
const MyActivity = lazy(
  () => import("@/features/audit-logs/pages/MyActivity"),
);
const HelpDocumentation = lazy(() => import("@/features/help/pages/Index"));
const Settings = lazy(() => import("@/features/settings/pages/Index"));
const Homerooms = lazy(() => import("@/features/sections/pages/Homerooms"));
const ViewMasterlist = lazy(
  () => import("@/features/sections/pages/ViewMasterlist"),
);
const SystemHealth = lazy(() => import("@/features/admin/pages/SystemHealth"));
const Teachers = lazy(() => import("@/features/teachers/pages/Index"));
const Monitor = lazy(() => import("@/features/admission/pages/online-enrollment/Monitor"));
const Apply = lazy(() => import("@/features/admission/pages/online-enrollment/Index"));
const BOSYPage = lazy(() => import("@/features/bosy/pages/BOSYPage"));
const TeacherEosyDashboard = lazy(
  () => import("@/features/teachers/pages/EosyDashboard"),
);
const AdvisoryClass = lazy(() => import("@/features/teachers/pages/AdvisoryClass"));
import { smartRoutes } from "@/features/smart/routes";

function getFallbackVariant(pathname: string): SkeletonPageVariant {
  if (pathname === "/dashboard") return "dashboard";
  if (
    pathname === "/students" ||
    pathname === "/teachers" ||
    pathname === "/audit-logs" ||
    pathname.includes("masterlist") ||
    pathname.includes("eosy")
  ) {
    return "registry";
  }
  if (
    pathname === "/continuing-learners" ||
    pathname === "/monitoring/enrollment" ||
    pathname.includes("sectioning")
  ) {
    return "twoPanel";
  }
  if (pathname === "/sections" || pathname === "/integration") return "cardGrid";
  if (pathname === "/settings" || pathname.includes("profile")) return "settings";
  return "generic";
}

function PageFallback() {
  const location = useLocation();
  return <PageLoadingSkeleton withDelay={true} variant={getFallbackVariant(location.pathname)} />;
}

function renderLazyPage(
  Component: LazyExoticComponent<ComponentType>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <div className="flex-1 flex flex-col min-h-0 min-w-0 h-full w-full">
        <Component />
      </div>
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/smart",
        element: renderLazyPage(SMARTLayout),
        children: smartRoutes,
      },

      // 1. Learner Portal routes (public - no staff auth required)
      {
        element: <LearnerAuthLayout />,
        children: [
          {
            path: "/learner/login",
            element: renderLazyPage(LearnerLogin),
          },
          {
            path: "/learner/change-password",
            element: renderLazyPage(ChangePassword),
          },
          {
            path: "/learner/setup-password",
            element: renderLazyPage(ChangePassword),
          },
          {
            path: "/learner/portal",
            element: renderLazyPage(LearnerDashboard),
          },
        ],
      },

      // 2. Public routes (other than learner portal)
      {
        element: <PublicLayout />,
        children: [
          {
            path: "/enrollment",
            element: renderLazyPage(Apply),
          },

          {
            path: "/monitor",
            element: renderLazyPage(Monitor),
          },
          {
            path: "/change-password",
            element: renderLazyPage(ChangePassword),
          },
        ],
      },

      // 3. Auth routes (Staff login)
      {
        element: <AuthLayout />,
        children: [
          {
            path: "/staff/login",
            element: renderLazyPage(Login),
          },
        ],
      },

      // 4. Protected routes for Head Registrar and System Admin
      {
        element: (
          <ProtectedRoute
            allowedRoles={["HEAD_REGISTRAR", "SYSTEM_ADMIN"]}
          />
        ),
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                path: "/dashboard",
                element: renderLazyPage(Dashboard),
              },
              {
                path: "/monitoring/enrollment",
                element: renderLazyPage(Enrollment),
              },
              {
                path: "/eosy",
                element: renderLazyPage(EosyUpdating),
              },
              {
                path: "/eosy/workspace",
                element: renderLazyPage(RegistrarEOSYWorkspace),
              },
              {
                path: "/continuing-learners",
                element: renderLazyPage(BOSYPage),
              },
              {
                path: "/students",
                element: renderLazyPage(Students),
              },
              {
                path: "/students/:id",
                element: renderLazyPage(Profile),
              },
              {
                path: "/sections",
                element: renderLazyPage(Homerooms),
              },
              {
                path: "/sections/view-masterlist/:sectionId",
                element: renderLazyPage(ViewMasterlist),
              },
              {
                path: "/settings",
                element: renderLazyPage(Settings),
              },
              {
                path: "/teachers",
                element: renderLazyPage(Teachers),
              },
              {
                path: "/my-activity",
                element: renderLazyPage(MyActivity),
              },
              {
                path: "/help",
                element: renderLazyPage(HelpDocumentation),
              },
              // Protected routes for System Admin Only
              {
                element: <ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]} />,
                children: [
                  {
                    path: "/admin/system",
                    element: renderLazyPage(SystemHealth),
                  },
                  {
                    path: "/audit-logs",
                    element: renderLazyPage(AuditLogs),
                  },
                ],
              },
            ],
          },
        ],
      },

      // 5. Teacher Routes
      {
        element: (
          <ProtectedRoute
            allowedRoles={[
              "HEAD_REGISTRAR",
              "SYSTEM_ADMIN",
              "TEACHER",
              "CLASS_ADVISER",
            ]}
          />
        ),
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                path: "/teacher/eosy",
                element: renderLazyPage(TeacherEosyDashboard),
              },
              {
                path: "/teacher/advisory",
                element: renderLazyPage(AdvisoryClass),
              },
              {
                path: "/my-activity",
                element: renderLazyPage(MyActivity),
              },
              {
                path: "/help",
                element: renderLazyPage(HelpDocumentation),
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
