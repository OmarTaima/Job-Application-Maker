// hooks/queries/useAuth.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authService, LoginRequest, RegisterRequest, User } from "../../services/authService";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setUser, clearAuth, setLoading, setError } from "../../store/slices/authSlice";
import { tokenStorage } from "../../config/api";

// Query keys
export const authKeys = {
  all: ["auth"] as const,
  user: () => [...authKeys.all, "user"] as const,
  currentUser: () => [...authKeys.user(), "current"] as const,
};

// Get current user - Syncs React Query with Redux
export function useCurrentUser(options?: { enabled?: boolean }) {
  const dispatch = useAppDispatch();
  const hasToken = !!tokenStorage.getAccessToken();

  return useQuery({
    queryKey: authKeys.currentUser(),
    queryFn: async (): Promise<User> => {
      dispatch(setLoading(true));
      try {
        const user = await authService.getCurrentUser();
        // Sync to Redux
        dispatch(setUser(user));
        return user;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch user";
        dispatch(setError(errorMessage));
        throw error;
      } finally {
        dispatch(setLoading(false));
      }
    },
    enabled: options?.enabled !== undefined ? options.enabled : hasToken,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
}

// Login mutation - Updates both React Query and Redux
export function useLoginMutation() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: async (credentials: LoginRequest): Promise<User> => {
      dispatch(setLoading(true));
      try {
        // Login
        await authService.login(credentials);
        // After login, fetch the full user data
        const user = await authService.getCurrentUser();
        return user;
      } finally {
        dispatch(setLoading(false));
      }
    },
    onSuccess: (user) => {
      // Update React Query cache
      queryClient.setQueryData(authKeys.currentUser(), user);
      // Update Redux
      dispatch(setUser(user));
      dispatch(setError(null));
    },
    onError: (error: any) => {
      console.error("Login failed:", error);
      // Clear both caches
      dispatch(clearAuth());
      queryClient.removeQueries({ queryKey: authKeys.currentUser() });
      dispatch(setError(error?.message || "Login failed"));
    },
  });
}

// Register mutation - Updates both React Query and Redux
export function useRegisterMutation() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: async (userData: RegisterRequest): Promise<User> => {
      dispatch(setLoading(true));
      try {
        // Register
        await authService.register(userData);
        // After registration, fetch the full user data
        const user = await authService.getCurrentUser();
        return user;
      } finally {
        dispatch(setLoading(false));
      }
    },
    onSuccess: (user) => {
      // Update React Query cache
      queryClient.setQueryData(authKeys.currentUser(), user);
      // Update Redux
      dispatch(setUser(user));
      dispatch(setError(null));
    },
    onError: (error: any) => {
      console.error("Registration failed:", error);
      dispatch(clearAuth());
      queryClient.removeQueries({ queryKey: authKeys.currentUser() });
      dispatch(setError(error?.message || "Registration failed"));
    },
  });
}

// Logout mutation - Clears both
export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      authService.logout();
    },
    onSuccess: () => {
      // Clear Redux
      dispatch(clearAuth());
      // Clear React Query cache
      queryClient.clear();
    },
  });
}

// Change password mutation
export function useChangePasswordMutation() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: async (passwords: { currentPassword: string; newPassword: string }) => {
      dispatch(setLoading(true));
      try {
        await authService.changePassword(passwords);
        return { success: true };
      } finally {
        dispatch(setLoading(false));
      }
    },
    onError: (error: any) => {
      dispatch(setError(error?.message || "Failed to change password"));
    },
  });
}

// Hook to get user from Redux (for components that already use Redux)
export function useReduxUser() {
  return useAppSelector((state) => state.auth.user);
}

// Hook to get auth state from Redux
export function useAuthState() {
  const user = useAppSelector((state) => state.auth.user);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const loading = useAppSelector((state) => state.auth.loading);
  const error = useAppSelector((state) => state.auth.error);
  
  return { user, isAuthenticated, loading, error };
}

// Hook to check if user has specific permission
export function useHasPermission(permissionName: string, accessLevel?: "read" | "write" | "create") {
  const user = useAppSelector((state) => state.auth.user);
  
  if (!user) return false;
  
  const roleName = (user.roleId as any)?.name?.toLowerCase();
  if (roleName === "admin" || roleName === "super admin") return true;
  
  const userPermissions = (user as any).permissions || [];
  const rolePermissions = (user.roleId as any)?.permissions || [];
  const allPermissions = [...userPermissions, ...rolePermissions];
  
  const permissionObj = allPermissions.find((p: any) => {
    if (typeof p === 'string') return p === permissionName;
    const permName = p.permission?.name || p.permission;
    return permName === permissionName;
  });
  
  if (!permissionObj) return false;
  if (!accessLevel) return true;
  if (typeof permissionObj === 'string') return true;
  
  const accessArray = permissionObj.access || [];
  return accessArray.includes(accessLevel);
}