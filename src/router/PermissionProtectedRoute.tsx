import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';

interface PermissionProtectedRouteProps {
  requiredPermissions: string[];
  requireAll?: boolean; // If true, requires all permissions. If false, requires at least one
  accessLevel?: 'read' | 'write' | 'create'; // Required access level (read, write, or create)
}

export default function PermissionProtectedRoute({
  requiredPermissions,
  requireAll = false,
  accessLevel = 'read', // Default to read access
}: PermissionProtectedRouteProps) {
  const { hasPermission, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  const hasAccess = requireAll
    ? requiredPermissions.every((perm) => hasPermission(perm, accessLevel))
    : requiredPermissions.some((perm) => hasPermission(perm, accessLevel));

  if (!hasAccess) {
    // Redirect to home page or show unauthorized page
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
