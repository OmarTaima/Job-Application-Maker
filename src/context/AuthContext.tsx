import {
  createContext,
  useContext,
  ReactNode,
} from "react";
import { User, ApiError } from "../services/authService";
import { useAppSelector } from "../store/hooks";
import {
  useCurrentUser,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
} from "../hooks/queries/useAuth";

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  }) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  canAccessCompany: (companyId: string) => boolean;
  hasPermission: (permissionName: string, accessLevel?: "read" | "write" | "create") => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Get user from Redux store (synced via React Query hooks)
  const user = useAppSelector((state) => state.auth.user);

  // React Query hooks for auth operations
  const { isLoading: isLoadingUser } = useCurrentUser();
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const logoutMutation = useLogoutMutation();

  // Combine loading states
  const isLoading = isLoadingUser || loginMutation.isPending || registerMutation.isPending;

  // Get error from mutations
  const error = loginMutation.error instanceof ApiError 
    ? loginMutation.error.message 
    : registerMutation.error instanceof ApiError
    ? registerMutation.error.message
    : null;

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const register = async (userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  }) => {
    await registerMutation.mutateAsync(userData);
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  const canAccessCompany = (companyId: string): boolean => {
    if (!user) return false;

    // Admin and Super Admin can access all companies
    const roleName = user.roleId?.name?.toLowerCase();
    if (roleName === "admin" || roleName === "super admin") return true;

    // Company users can only access assigned companies
    const usercompanyId =
      user.companies?.map((c) =>
        typeof c.companyId === "string" ? c.companyId : c.companyId._id
      ) || [];

    return (
      usercompanyId.includes(companyId) ||
      user.assignedcompanyId?.includes(companyId) ||
      false
    );
  };

  const hasPermission = (permissionName: string, accessLevel?: "read" | "write" | "create"): boolean => {
    if (!user) return false;

    // Admin and Super Admin roles have all permissions
    const roleName = user.roleId?.name?.toLowerCase();
    if (roleName === "admin" || roleName === "super admin") {
      return true;
    }

    // Check both user-level permissions (custom) and role-level permissions
    // User-level permissions take precedence over role permissions
    const userPermissions = (user as any).permissions || [];
    const rolePermissions = user.roleId?.permissions || [];
    const allPermissions = [...userPermissions, ...rolePermissions];
    
    // Find the permission object
    const permissionObj = allPermissions.find((p) => {
      if (typeof p === 'string') {
        return p === permissionName;
      }
      // Handle both p.permission.name (populated) and p.permission (string ID)
      const permName = p.permission?.name || p.permission;
      return permName === permissionName;
    });

    // If no permission found, deny access
    if (!permissionObj) {
      return false;
    }

    // If no access level specified, just check if permission exists
    if (!accessLevel) {
      return true;
    }

    // If permission is a string (old format), grant all access
    if (typeof permissionObj === 'string') {
      return true;
    }

    // Check if the user has the required access level
    const accessArray = permissionObj.access || [];
    return accessArray.includes(accessLevel);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        isLoading,
        error,
        canAccessCompany,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
