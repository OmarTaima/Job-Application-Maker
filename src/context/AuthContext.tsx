// context/AuthContext.tsx
import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
} from "react";
import type { User } from "../types/auth";
import {
  useCurrentUser,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
} from "../hooks/queries/useAuth";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  
  // ✅ Get user from React Query (no Redux)
  const { data: user, isLoading: isLoadingUser, error: userError, refetch } = useCurrentUser();
  
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const logoutMutation = useLogoutMutation();

  const isLoading = isLoadingUser || loginMutation.isPending || registerMutation.isPending || logoutMutation.isPending;

  const error = 
    (loginMutation.error instanceof Error ? loginMutation.error.message : null) ||
    (registerMutation.error instanceof Error ? registerMutation.error.message : null) ||
    (userError instanceof Error ? userError.message : null) ||
    null;

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
    // ✅ Force refetch after login to ensure fresh data
    await refetch();
  };

  const register = async (userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  }) => {
    await registerMutation.mutateAsync(userData);
    // ✅ Force refetch after register to ensure fresh data
    await refetch();
  };

  const logout = useCallback(() => {
    // ✅ Use mutateAsync to ensure it completes
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        // ✅ Hard reload to clear all memory
        setTimeout(() => {
          window.location.href = '/login';
        }, 100);
      },
    });
  }, [logoutMutation]);

  // ✅ Watch for token changes and clear cache if needed
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken' && !e.newValue) {
        // Token was removed from storage
        queryClient.clear();
        window.location.href = '/login';
      }
    };
    
    const checkTokenInterval = setInterval(() => {
      const hasToken = !!tokenStorage.getAccessToken();
      if (!hasToken && user) {
        // No token but we have user data - clear cache
        queryClient.clear();
        window.location.href = '/login';
      }
    }, 5000); // Check every 5 seconds
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkTokenInterval);
    };
  }, [user, queryClient]);

  const canAccessCompany = (companyId: string): boolean => {
    if (!user) return false;

    const roleName = (user.roleId as any)?.name?.toLowerCase();
    if (roleName === "admin" || roleName === "super admin") return true;

    const userCompanyIds =
      user.companies?.map((c: any) =>
        typeof c.companyId === "string" ? c.companyId : (c.companyId as any)?._id
      ) || [];

    return (
      userCompanyIds.includes(companyId) ||
      !!user.assignedcompanyId?.includes(companyId) ||
      false
    );
  };

  const hasPermission = (permissionName: string, accessLevel?: "read" | "write" | "create"): boolean => {
    if (!user) return false;

    const roleName = (user.roleId as any)?.name?.toLowerCase();
    if (roleName === "admin" || roleName === "super admin") {
      return true;
    }

    const userPermissions = (user as any).permissions || [];
    const rolePermissions = (user.roleId as any)?.permissions || [];
    const allPermissions = [...userPermissions, ...rolePermissions];
    
    const permissionObj = allPermissions.find((p: any) => {
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
        user: user || null,
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