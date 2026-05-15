import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/store/auth.slice";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
import type { AuthRole } from "@/store/auth.slice";

interface ProtectedRouteProps {
  allowedRoles?: AuthRole[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const isLearnerRoute =
    allowedRoles?.length === 1 && allowedRoles[0] === "LEARNER";

  const staffAuth = useAuthStore();
  const learnerAuth = useLearnerAuthStore();

  const auth = isLearnerRoute ? learnerAuth : staffAuth;
  const { token, user } = auth;

  // Crucial: If we are on a learner route but only have a staff token (or vice versa),
  // we must treat it as unauthorized for this specific guard.
  const hasCorrectRoleType = user
    ? isLearnerRoute
      ? user.role === "LEARNER"
      : user.role !== "LEARNER"
    : false;

  if (!token || !user || !hasCorrectRoleType) {
    const loginPath = isLearnerRoute ? "/learner/login" : "/login";
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
