import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/store/auth.slice";
import type { AuthRole } from "@/store/auth.slice";

interface ProtectedRouteProps {
  allowedRoles?: AuthRole[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { token, user } = useAuthStore();

  if (!token || !user) {
    const loginPath =
      allowedRoles?.length === 1 && allowedRoles[0] === "LEARNER"
        ? "/learner/login"
        : "/login";
    return (
      <Navigate
        to={loginPath}
        replace
      />
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to role-appropriate home rather than /login (avoids loops)
    return (
      <Navigate
        to={user.role === "LEARNER" ? "/learner" : "/dashboard"}
        replace
      />
    );
  }

  return <Outlet />;
}
