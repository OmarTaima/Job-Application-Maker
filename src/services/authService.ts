// services/authService.ts
import { tokenStorage } from "../config/api";
import {
  ApiError, // Import as value (not type)
  type LoginRequest,
  type RegisterRequest,
  type AuthResponse,
  type UserProfileResponse,
  type User,
  type ChangePasswordRequest,
} from "../types/auth";

// Re-export types for convenience
export type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  UserProfileResponse,
  User,
  ChangePasswordRequest,
} from "../types/auth";
export { ApiError } from "../types/auth"; // Re-export the class

// Helper function to make API requests
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${import.meta.env.VITE_API_BASE_URL}${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.message || "An error occurred",
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : "Network error occurred"
    );
  }
}

// Helper to add auth header
function getAuthHeaders(): HeadersInit {
  const token = tokenStorage.getAccessToken();
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }
  return {};
}

// Auth Service
export const authService = {
  /**
   * Login with email and password
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await apiRequest<any>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    const accessToken = response.data?.accessToken || response.accessToken;
    const refreshToken = response.data?.refreshToken || response.refreshToken;

    if (accessToken && refreshToken) {
      tokenStorage.setTokens(accessToken, refreshToken);
    }

    return response;
  },

  /**
   * Register a new user
   */
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });

    if (response.data.accessToken && response.data.refreshToken) {
      tokenStorage.setTokens(
        response.data.accessToken,
        response.data.refreshToken
      );
    }

    return response;
  },

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiRequest<UserProfileResponse>(
      "/auth/me?populate=roleId.permissions.permission",
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return response.data;
  },

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<AuthResponse> {
    const refreshToken = tokenStorage.getRefreshToken();

    if (!refreshToken) {
      throw new ApiError("No refresh token available");
    }

    const response = await apiRequest<AuthResponse>("/auth/refresh-token", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });

    if (response.data.accessToken && response.data.refreshToken) {
      tokenStorage.setTokens(
        response.data.accessToken,
        response.data.refreshToken
      );
    }

    return response;
  },

  /**
   * Change password
   */
  async changePassword(passwords: ChangePasswordRequest): Promise<void> {
    await apiRequest<{ success: boolean; message: string }>(
      "/auth/change-password",
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(passwords),
      }
    );
  },

  /**
   * Logout (client-side)
   */
  logout(): void {
    tokenStorage.clearTokens();
  },
};