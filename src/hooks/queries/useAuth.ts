// hooks/queries/useAuth.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "../../services/authService";
import type { 
  LoginRequest, 
  RegisterRequest, 
  ChangePasswordRequest,
  User,
  ApiError 
} from "../../types/auth";
import { tokenStorage } from "../../config/api";
import Swal from "../../utils/swal";

// ===== Query Keys =====
export const authKeys = {
  all: ["auth"] as const,
  user: () => [...authKeys.all, "user"] as const,
  currentUser: () => [...authKeys.user(), "current"] as const,
};

// ===== QUERIES =====

export function useCurrentUser(options?: { enabled?: boolean }) {
  const hasToken = !!tokenStorage.getAccessToken();

  return useQuery({
    queryKey: authKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
    enabled: options?.enabled ?? hasToken,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: false,
    // ✅ Add refetch on mount to ensure fresh data
    refetchOnMount: true,
    // ✅ Don't use cached data if token exists but user might be different
    refetchOnWindowFocus: true,
  });
}

// ===== MUTATIONS =====

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginRequest) => authService.login(credentials),
    onSuccess: async (user: User) => {
      // ✅ Set the user data
      queryClient.setQueryData(authKeys.currentUser(), user);
      
      // ✅ Invalidate all auth queries to ensure consistency
      await queryClient.invalidateQueries({ queryKey: authKeys.all });
      
      showSuccessToast("Login successful");
    },
    onError: (error: ApiError) => {
      queryClient.removeQueries({ queryKey: authKeys.currentUser() });
      showErrorToast(error.message, "Login failed");
    },
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userData: RegisterRequest) => authService.register(userData),
    onSuccess: async (user: User) => {
      queryClient.setQueryData(authKeys.currentUser(), user);
      await queryClient.invalidateQueries({ queryKey: authKeys.all });
      showSuccessToast("Registration successful");
    },
    onError: (error: ApiError) => {
      queryClient.removeQueries({ queryKey: authKeys.currentUser() });
      showErrorToast(error.message, "Registration failed");
    },
  });
}

// hooks/queries/useAuth.ts - Update the logout mutation
export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Clear tokens first
      tokenStorage.clearTokens();
      // Call logout (if it makes API call)
      authService.logout();
      
      // ✅ Also clear localStorage session if exists
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      sessionStorage.clear();
    },
    onSuccess: () => {
      // ✅ Method 1: Reset all queries (resets to initial state)
      queryClient.resetQueries();
      
      // ✅ Method 2: Clear all cached data
      queryClient.clear();
      
      // ✅ Method 3: Specifically remove auth queries
      queryClient.removeQueries({ queryKey: authKeys.all });
      
      // ✅ Method 4: Cancel all ongoing queries
      queryClient.cancelQueries();
      
      showSuccessToast("Logged out successfully");
      
      // ✅ Don't navigate here - let the AuthProvider handle it
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Logout failed");
      // Still try to clear on error
      tokenStorage.clearTokens();
      queryClient.clear();
    },
  });
}
export function useChangePasswordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (passwords: ChangePasswordRequest) => authService.changePassword(passwords),
    onSuccess: () => {
      // ✅ After password change, invalidate user data to refresh
      queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
      showSuccessToast("Password changed successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to change password");
    },
  });
}

export function useRefreshTokenMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.refreshToken(),
    onSuccess: () => {
      // ✅ After token refresh, refresh user data
      queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
    },
    onError: (error: ApiError) => {
      console.error("Token refresh failed:", error.message);
      // ✅ If refresh fails, log the user out
      tokenStorage.clearTokens();
      queryClient.clear();
    },
  });
}

// ===== Toast Helpers =====
function showSuccessToast(message: string) {
  Swal.fire({
    title: "Success",
    text: message,
    icon: "success",
    timer: 1500,
    showConfirmButton: false,
  });
}

function showErrorToast(message: string, fallback: string) {
  Swal.fire({
    title: "Error",
    text: message || fallback,
    icon: "error",
  });
}