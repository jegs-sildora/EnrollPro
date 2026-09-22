import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/store/auth.slice";
import type { AuthRole } from "@/store/auth.slice";

interface ProtectedRouteProps {
  allowedRoles?: AuthRole[];
  allowedAncillaryRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles, allowedAncillaryRoles }: ProtectedRouteProps) {
  const staffAuth = useAuthStore();
  const user = staffAuth.user;
  const hasSession = Boolean(staffAuth.user);

  if (!hasSession || !user) {
    return (
      <Navigate
        to={"/personnel/login"}
        replace
      />
    );
  }

  if (user.mustChangePassword) {
    return <Navigate to={"/change-password"} replace />;
  }

  let isAllowed = false;
  
  if (!allowedRoles && !allowedAncillaryRoles) {
    isAllowed = true;
  } else {
    if (allowedRoles && user.roles?.some((r) => allowedRoles.includes(r))) {
      isAllowed = true;
    }
    if (allowedAncillaryRoles && user.ancillaryRoles?.some((userRole) => 
      allowedAncillaryRoles.some((allowedRole) => userRole.includes(allowedRole))
    )) {
      isAllowed = true;
    }
  }

  if (!isAllowed) {
    // Redirect to role-appropriate home rather than /login (avoids loops)
    const isRegistrar = user.roles?.includes("HEAD_REGISTRAR") || user.roles?.includes("SCHOOL_REGISTRAR");
    const isAdmin = user.roles?.includes("SYSTEM_ADMIN");
    const isClassAdviser = user.roles?.includes("CLASS_ADVISER");
    const isGradeCoordinator = user.ancillaryRoles?.some(r => r.includes("COORDINATOR"));
    
    const fallbackRoute = (isRegistrar || isAdmin || isClassAdviser || isGradeCoordinator)
      ? "/dashboard"
      : user.roles?.includes("TEACHER")
        ? "/learners"
        : user.roles?.includes("MRF")
          ? "/my-activity"
          : "/dashboard";

    return (
      <Navigate
        to={fallbackRoute}
        replace
      />
    );
  }

  return <Outlet />;
}
