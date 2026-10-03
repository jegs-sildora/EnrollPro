/* eslint-disable react-refresh/only-export-components */
// router/index.tsx
import { createBrowserRouter } from "react-router";
import { useLocation } from "react-router";
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { PageLoadingSkeleton, type SkeletonPageVariant } from "@/shared/components/PageLoadingSkeleton";

import AuthLayout from "@/shared/layouts/AuthLayout";
import AppLayout from "@/shared/layouts/AppLayout";
import PublicLayout from "@/shared/layouts/PublicLayout";
import RootLayout from "@/shared/layouts/RootLayout";
import LearnerAuthLayout from "@/shared/layouts/LearnerAuthLayout";
import MinimalLayout from "@/shared/layouts/MinimalLayout";
import ProtectedRoute from "@/shared/components/ProtectedRoute";
import NotFound from "@/shared/components/NotFound";

const Login = lazy(() => import("@/features/auth/pages/Login"));
const Dashboard = lazy(() => import("@/features/dashboard/pages/Index"));
const ViewProgramRoster = lazy(() => import("@/features/dashboard/pages/ViewProgramRoster"));
import LearnerLogin from "@/features/learner/pages/Login";
import LearnerDashboard from "@/features/learner/pages/Dashboard";
const Enrollment = lazy(() => import("@/features/enrollment/pages/Index"));
const EosyUpdating = lazy(() => import("@/features/enrollment/pages/EosyIndex"));
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
const ScpApply = lazy(() => import("@/features/admission/pages/scp-admission/Index"));
const LearnerAdmissionIndex = lazy(() => import("@/features/admission/pages/learner-admission/LearnerAdmissionIndex"));
const BOSYPage = lazy(() => import("@/features/bosy/pages/BOSYPage"));
const AdvisoryClass = lazy(() => import("@/features/teachers/pages/AdvisoryClass"));
const TrackApplicationPage = lazy(() => import("@/features/admission/pages/scp-admission/Track"));
const EarlyRegistration = lazy(() => import("@/features/admission/pages/early-registration/Index"));
const EarlyRegistrationMasterlist = lazy(() => import("@/features/admission/pages/early-registration-masterlist/EarlyRegistrationMasterlist"));

function getFallbackVariant(pathname: string): SkeletonPageVariant {
  if (pathname === "/dashboard") return "dashboard";
  if (
    pathname === "/learners" ||
    pathname === "/personnel" ||
    pathname === "/audit-logs" ||
    pathname.includes("masterlist") ||
    pathname.includes("eosy")
  ) {
    return "registry";
  }
  if (pathname === "/enrollment") {
    return "enrollmentForm";
  }
  if (
    pathname === "/learner-enrollment" ||
    pathname === "/section-assignment" ||
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
      // 1. Learner Portal routes (public - no staff auth required)
      {
        element: <LearnerAuthLayout />,
        children: [
          {
            path: "/learner/login",
            element: <LearnerLogin />,
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
            element: <LearnerDashboard />,
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
            path: "/scp-admission",
            element: renderLazyPage(ScpApply),
          },

          {
            path: "/monitor",
            element: renderLazyPage(Monitor),
          },
          {
            path: "/change-password",
            element: renderLazyPage(ChangePassword),
          },
          {
            path: "/track-application",
            element: renderLazyPage(TrackApplicationPage),
          },
          {
            path: "/early-registration",
            element: renderLazyPage(EarlyRegistration),
          },
        ],
      },

      // 3. Auth routes (Staff login)
      {
        element: <AuthLayout />,
        children: [
          {
            path: "/personnel/login",
            element: renderLazyPage(Login),
          },
        ],
      },

      // 4. Protected App Routes
      {
        element: <AppLayout />,
        children: [
          // Dashboard
          {
            element: <ProtectedRoute allowedRoles={["SYSTEM_ADMIN", "PRINCIPAL", "HEAD_REGISTRAR", "SCHOOL_REGISTRAR", "GRADE_LEVEL_COORDINATOR", "STE_COORDINATOR", "SPA_COORDINATOR", "SPS_COORDINATOR"]} allowedAncillaryRoles={["GRADE 7 COORDINATOR", "GRADE 8 COORDINATOR", "GRADE 9 COORDINATOR", "GRADE 10 COORDINATOR", "STE HEAD TEACHER", "SPA HEAD TEACHER", "SPS HEAD TEACHER"]} />,
            children: [
              { path: "/dashboard", element: renderLazyPage(Dashboard) },
              { path: "/dashboard/program-roster/:programType", element: renderLazyPage(ViewProgramRoster) },
            ],
          },
          // Common Misc Routes
          {
            element: <ProtectedRoute allowedRoles={["SYSTEM_ADMIN", "PRINCIPAL", "HEAD_REGISTRAR", "SCHOOL_REGISTRAR", "TEACHER", "CLASS_ADVISER", "GRADE_LEVEL_COORDINATOR", "STE_COORDINATOR", "SPA_COORDINATOR", "SPS_COORDINATOR", "MRF"]} />,
            children: [
              { path: "/my-activity", element: renderLazyPage(MyActivity) },
              { path: "/help", element: renderLazyPage(HelpDocumentation) },
            ],
          },
          // Learner Directory & Class Sections
          {
            element: <ProtectedRoute 
              allowedRoles={["SYSTEM_ADMIN", "PRINCIPAL", "HEAD_REGISTRAR", "SCHOOL_REGISTRAR", "GRADE_LEVEL_COORDINATOR", "STE_COORDINATOR", "SPA_COORDINATOR", "SPS_COORDINATOR"]}
              allowedAncillaryRoles={["GRADE 7 COORDINATOR", "GRADE 8 COORDINATOR", "GRADE 9 COORDINATOR", "GRADE 10 COORDINATOR", "STE HEAD TEACHER", "SPA HEAD TEACHER", "SPS HEAD TEACHER"]} 
            />,
            children: [
              { path: "/learners", element: renderLazyPage(Students) },
              { path: "/learner/:id", element: renderLazyPage(Profile) },
              { path: "/sections", element: renderLazyPage(Homerooms) },
              { path: "/sections/view-masterlist/:sectionId", element: renderLazyPage(ViewMasterlist) },
            ],
          },
          // Registration & Sectioning
          {
            element: <ProtectedRoute allowedRoles={["SYSTEM_ADMIN", "HEAD_REGISTRAR", "SCHOOL_REGISTRAR", "GRADE_LEVEL_COORDINATOR"]} allowedAncillaryRoles={["GRADE 7 COORDINATOR", "GRADE 8 COORDINATOR", "GRADE 9 COORDINATOR", "GRADE 10 COORDINATOR"]} />,
            children: [
              { path: "/early-registration-masterlist", element: renderLazyPage(EarlyRegistrationMasterlist) },
              { path: "/section-assignment", element: renderLazyPage(Enrollment) },
              { path: "/eosy", element: renderLazyPage(EosyUpdating) },
            ],
          },
          // Learner Enrollment
          {
            element: <ProtectedRoute allowedRoles={["SYSTEM_ADMIN", "HEAD_REGISTRAR", "SCHOOL_REGISTRAR", "GRADE_LEVEL_COORDINATOR", "CLASS_ADVISER"]} allowedAncillaryRoles={["GRADE 7 COORDINATOR", "GRADE 8 COORDINATOR", "GRADE 9 COORDINATOR", "GRADE 10 COORDINATOR"]} />,
            children: [
              { path: "/learner-enrollment", element: renderLazyPage(BOSYPage) },
            ],
          },
          // SCP Admission
          {
            element: <ProtectedRoute allowedRoles={["SYSTEM_ADMIN", "HEAD_REGISTRAR", "SCHOOL_REGISTRAR", "STE_COORDINATOR", "SPA_COORDINATOR", "SPS_COORDINATOR"]} allowedAncillaryRoles={["STE HEAD TEACHER", "SPA HEAD TEACHER", "SPS HEAD TEACHER"]} />,
            children: [
              { path: "/learner-admission", element: renderLazyPage(LearnerAdmissionIndex) },
            ],
          },
          // Class Adviser Only
          {
            element: <ProtectedRoute allowedRoles={["CLASS_ADVISER"]} />,
            children: [
              { path: "/teacher/advisory", element: renderLazyPage(AdvisoryClass) },
            ],
          },
          // System Configuration
          {
            element: <ProtectedRoute allowedRoles={["SYSTEM_ADMIN", "PRINCIPAL"]} />,
            children: [
              { path: "/settings", element: renderLazyPage(Settings) },
            ],
          },
          // Personnel Directory
          {
            element: <ProtectedRoute allowedRoles={["SYSTEM_ADMIN", "PRINCIPAL", "HEAD_REGISTRAR"]} />,
            children: [
              { path: "/personnel", element: renderLazyPage(Teachers) },
            ],
          },
          // System Admin Only
          {
            element: <ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]} />,
            children: [
              { path: "/admin/system", element: renderLazyPage(SystemHealth) },
              { path: "/audit-logs", element: renderLazyPage(AuditLogs) },
            ],
          },
        ],
      },

      // 5. Default redirects & Fallback (Out-of-app errors)
      {
        element: <MinimalLayout />,
        children: [
          {
            path: "/",
            element: <NotFound />,
          },
          { path: "*", element: <NotFound /> },
        ]
      },
    ],
  },
]);
