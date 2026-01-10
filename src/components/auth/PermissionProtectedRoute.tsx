import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../context/AuthContext";

interface PermissionProtectedRouteProps {
  requiredPermissions: string[];
  requireAll?: boolean; // If true, requires all permissions. If false, requires at least one
  accessLevel?: "read" | "write" | "create"; // Required access level (read, write, or create)
}

export default function PermissionProtectedRoute({
  requiredPermissions,
  requireAll = false,
  accessLevel = "read", // Default to read access
}: PermissionProtectedRouteProps) {
  const { hasPermission, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-brand-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
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
