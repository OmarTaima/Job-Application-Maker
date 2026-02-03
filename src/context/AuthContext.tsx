import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { authService, User, ApiError } from "../services/authService";
import { tokenStorage } from "../config/api";

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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // On mount, try to restore session from stored tokens.
  // If tokens exist, attempt to fetch current user; otherwise remain logged out.
  useEffect(() => {
    const loadUser = async () => {
      const token = tokenStorage.getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        // If fetching user fails (expired/invalid token), clear tokens and stay logged out
        tokenStorage.clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      await authService.login({ email, password });

      // After successful login, fetch the user profile
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      console.error("Login error:", err);
      const errorMessage =
        err instanceof ApiError
          ? err.message
          : "An error occurred during login";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  }) => {
    try {
      setError(null);
      setIsLoading(true);
      const response = await authService.register(userData);
      setUser(response.data.user);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError
          ? err.message
          : "An error occurred during registration";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setError(null);
  };

  const canAccessCompany = (companyId: string): boolean => {
    if (!user) return false;

    // Admin and Super Admin can access all companies
    const roleName = user.roleId?.name?.toLowerCase();
    if (roleName === "admin" || roleName === "super admin") return true;

    // Company users can only access assigned companies
    const userCompanyIds =
      user.companies?.map((c) =>
        typeof c.companyId === "string" ? c.companyId : c.companyId._id
      ) || [];

    return (
      userCompanyIds.includes(companyId) ||
      user.assignedCompanyIds?.includes(companyId) ||
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
