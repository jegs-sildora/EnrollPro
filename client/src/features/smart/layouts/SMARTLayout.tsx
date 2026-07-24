import { Suspense } from "react";
import { Outlet, Navigate } from "react-router";
import { useAuthStore } from "@/store/auth.slice";
import { ThemeProvider } from "../contexts/ThemeContext";

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );
}

export default function SMARTLayout() {
  const { user: enrollProUser } = useAuthStore();

  if (!enrollProUser) {
    return <Navigate to="/staff/login" replace />;
  }

  // SSO sync: Map EnrollPro role(s) to SMART role
  let smartRole = "TEACHER";
  if (enrollProUser.roles.includes("SYSTEM_ADMIN")) {
    smartRole = "ADMIN";
  } else if (enrollProUser.roles.includes("HEAD_REGISTRAR")) {
    smartRole = "REGISTRAR";
  } else if (enrollProUser.roles.includes("TEACHER") || enrollProUser.roles.includes("CLASS_ADVISER")) {
    smartRole = "TEACHER";
  }

  const ssoUser = {
    id: String(enrollProUser.id),
    username: enrollProUser.accountName || enrollProUser.email || "sso_user",
    role: smartRole,
    firstName: enrollProUser.firstName || "SSO",
    lastName: enrollProUser.lastName || "User"
  };
  
  sessionStorage.setItem("token", "sso-bypass-token");
  sessionStorage.setItem("user", JSON.stringify(ssoUser));

  return (
    <ThemeProvider>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </ThemeProvider>
  );
}
