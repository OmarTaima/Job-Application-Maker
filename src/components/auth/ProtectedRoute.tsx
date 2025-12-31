import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();

  console.log("ProtectedRoute check:", { isAuthenticated, isLoading, user });

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

  if (!isAuthenticated) {
    console.log("Not authenticated, redirecting to signin");
    return <Navigate to="/signin" replace />;
  }

  console.log("Authenticated, rendering protected content");
  return <Outlet />;
}
