import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authService, LoginRequest, RegisterRequest } from "../../services/authService";
import { useAppDispatch } from "../../store/hooks";
import { setUser, clearAuth } from "../../store/slices/authSlice";
import { tokenStorage } from "../../config/api";

// Query keys
export const authKeys = {
  all: ["auth"] as const,
  user: () => [...authKeys.all, "user"] as const,
  currentUser: () => [...authKeys.user(), "current"] as const,
};

// Get current user - with React Query caching
export function useCurrentUser(options?: { enabled?: boolean }) {
  const dispatch = useAppDispatch();
  const hasToken = !!tokenStorage.getAccessToken();

  return useQuery({
    queryKey: authKeys.currentUser(),
    queryFn: async () => {
      const user = await authService.getCurrentUser();
      dispatch(setUser(user));
      return user;
    },
    enabled: options?.enabled !== undefined ? options.enabled : hasToken,
    staleTime: 10 * 60 * 1000, // 10 minutes - user data doesn't change frequently
    gcTime: 30 * 60 * 1000, // 30 minutes in cache
    retry: false, // Don't retry if user fetch fails (likely invalid token)
  });
}

// Login mutation
export function useLoginMutation() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      await authService.login(credentials);
      // After login, fetch the user
      const user = await authService.getCurrentUser();
      return user;
    },
    onSuccess: (user) => {
      // Update Redux state immediately
      dispatch(setUser(user));
      // Set the user in React Query cache
      queryClient.setQueryData(authKeys.currentUser(), user);
    },
    onError: (error) => {
      console.error("Login failed:", error);
      // Clear any stale data
      dispatch(clearAuth());
      queryClient.removeQueries({ queryKey: authKeys.currentUser() });
    },
  });
}

// Register mutation
export function useRegisterMutation() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: async (userData: RegisterRequest) => {
      const response = await authService.register(userData);
      return response.data.user;
    },
    onSuccess: (user) => {
      // Update Redux state
      dispatch(setUser(user));
      // Set the user in React Query cache
      queryClient.setQueryData(authKeys.currentUser(), user);
    },
    onError: (error) => {
      console.error("Registration failed:", error);
      dispatch(clearAuth());
      queryClient.removeQueries({ queryKey: authKeys.currentUser() });
    },
  });
}

// Logout mutation
export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: async () => {
      authService.logout();
    },
    onSuccess: () => {
      // Clear Redux state
      dispatch(clearAuth());
      // Clear all React Query cache
      queryClient.clear();
    },
  });
}

// Note: Update user profile mutation can be added when updateProfile is implemented in authService
// export function useUpdateProfileMutation() {
//   const queryClient = useQueryClient();
//   const dispatch = useAppDispatch();
//
//   return useMutation({
//     mutationFn: authService.updateProfile,
//     onSuccess: (response) => {
//       const updatedUser = response.data;
//       // Update Redux state
//       dispatch(setUser(updatedUser));
//       // Update React Query cache
//       queryClient.setQueryData(authKeys.currentUser(), updatedUser);
//     },
//   });
// }

// Change password mutation
export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: authService.changePassword,
  });
}
