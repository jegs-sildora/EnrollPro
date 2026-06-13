import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/store/auth.slice";
import type { AuthRole } from "@/store/auth.slice";

interface ProtectedRouteProps {
  allowedRoles?: AuthRole[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const staffAuth = useAuthStore();
  const user = staffAuth.user;
  const hasSession = Boolean(staffAuth.user);

  if (!hasSession || !user) {
    return (
      <Navigate
        to={"/staff/login"}
        replace
      />
    );
  }

  if (user.mustChangePassword) {
    return <Navigate to={"/change-password"} replace />;
  }

  if (allowedRoles && !user.roles?.some((r) => allowedRoles.includes(r))) {
    // Redirect to role-appropriate home rather than /login (avoids loops)
    return (
      <Navigate
        to={"/dashboard"}
        replace
      />
    );
  }

  return <Outlet />;
}
