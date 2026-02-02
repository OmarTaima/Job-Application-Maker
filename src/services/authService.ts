import { tokenStorage } from "../config/api";

// Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

export interface User {
  _id?: string;
  id?: string;
  email: string;
  fullName?: string;
  name?: string;
  roleId?: {
    _id: string;
    name: string;
    permissions?: Array<{
      permission: {
        _id: string;
        name: string;
      };
      access?: string[];
    }>;
  };
  role?: "admin" | "company_user";
  assignedCompanyIds?: string[];
  companies?: Array<{
    _id?: string;
    companyId: {
      _id: string;
      name: string;
    };
    departments?: Array<{
      _id: string;
      name: string;
    }>;
  }>;
  // Optional profile fields used across the app
  profilePhoto?: string;
  avatar?: string;
  location?: string;
  address?: string;
  phone?: string;
  bio?: string;
  country?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  taxId?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

export interface UserProfileResponse {
  success: boolean;
  data: User;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// API Error class
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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

   

    // Store tokens - handle different response structures
    const accessToken = response.data?.accessToken || response.accessToken;
    const refreshToken = response.data?.refreshToken || response.refreshToken;

    if (accessToken && refreshToken) {
      tokenStorage.setTokens(accessToken, refreshToken);
    } else {
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

    // Store tokens
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
    const response = await apiRequest<UserProfileResponse>("/auth/me?populate=roleId.permissions.permission", {
      method: "GET",
      headers: getAuthHeaders(),
    });

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

    // Update tokens
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
