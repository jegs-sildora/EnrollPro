import { Navigate } from "react-router";
import { useAuthStore } from "@/store/auth.slice";

export function SMARTRedirector() {
  const { user } = useAuthStore();
  if (!user) {
    return <Navigate to="/staff/login" replace />;
  }

  let smartRole = "TEACHER";
  if (user.roles.includes("SYSTEM_ADMIN")) {
    smartRole = "ADMIN";
  } else if (user.roles.includes("HEAD_REGISTRAR")) {
    smartRole = "REGISTRAR";
  } else if (user.roles.includes("TEACHER") || user.roles.includes("CLASS_ADVISER")) {
    smartRole = "TEACHER";
  }

  if (smartRole === "ADMIN") {
    return <Navigate to="/smart/admin" replace />;
  }
  if (smartRole === "REGISTRAR") {
    return <Navigate to="/smart/registrar" replace />;
  }
  return <Navigate to="/smart/teacher" replace />;
}
