// context/AuthContext.tsx
import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { User } from "../services/authService";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import {
  useCurrentUser,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
} from "../hooks/queries/useAuth";
import { setUser } from "../store/slices/authSlice";

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
  const dispatch = useAppDispatch();
  
  // Get user from Redux
  const user = useAppSelector((state) => state.auth.user);
  const reduxLoading = useAppSelector((state) => state.auth.loading);
  
  // React Query hooks for auth operations
  const { data: queryUser, isLoading: isLoadingUser } = useCurrentUser();
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const logoutMutation = useLogoutMutation();

  // Sync React Query user to Redux if needed
  useEffect(() => {
    if (queryUser && !user) {
      dispatch(setUser(queryUser));
    }
  }, [queryUser, user, dispatch]);

  // Combine loading states
  const isLoading = reduxLoading || isLoadingUser || loginMutation.isPending || registerMutation.isPending;

  // Get error from Redux
  const error = useAppSelector((state) => state.auth.error);

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

    const roleName = user.roleId?.name?.toLowerCase();
    if (roleName === "admin" || roleName === "super admin") return true;

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

    const roleName = user.roleId?.name?.toLowerCase();
    if (roleName === "admin" || roleName === "super admin") {
      return true;
    }

    const userPermissions = (user as any).permissions || [];
    const rolePermissions = user.roleId?.permissions || [];
    const allPermissions = [...userPermissions, ...rolePermissions];
    
    const permissionObj = allPermissions.find((p) => {
      if (typeof p === 'string') {
        return p === permissionName;
      }
      const permName = p.permission?.name || p.permission;
      return permName === permissionName;
    });

    if (!permissionObj) return false;
    if (!accessLevel) return true;
    if (typeof permissionObj === 'string') return true;

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