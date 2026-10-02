import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/store/auth.slice";
import type { AuthRole } from "@/store/auth.slice";
import Forbidden from "./Forbidden";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  allowedRoles?: AuthRole[];
  allowedAncillaryRoles?: string[];
  children?: ReactNode;
}

export default function ProtectedRoute({ allowedRoles, allowedAncillaryRoles, children }: ProtectedRouteProps) {
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
    // Render the 403 page component directly rather than redirecting, 
    // obscuring the existence of protected routes to unauthorized users
    // while providing a clear access denied state.
    return <Forbidden />;
  }

  return children ? <>{children}</> : <Outlet />;
}
