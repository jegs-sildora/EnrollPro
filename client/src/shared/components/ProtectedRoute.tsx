import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/store/auth.slice';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { token, user } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // Force password change if required
  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If authenticated but role not allowed, don't go to /login (causes loop)
    // Go to dashboard or a safe place.
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
