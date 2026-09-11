import { Navigate } from "react-router";

export default function SMARTLayout() {
  // Embedded SMART access is retired. Companion access uses the secure SSO sidebar.
  return <Navigate to="/dashboard" replace />;
}
