import { API_CONFIG, tokenStorage } from "../config/api";

// Types
export interface Permission {
  _id: string;
  name: string;
  description?: string;
  actions?: string[];
  createdAt?: string;
  __v?: number;
}

export interface Role {
  _id: string;
  name: string;
  description: string;
  permissions?: string[];
  permissionsCount?: number;
  usersCount?: number;
  createdAt?: string;
  __v?: number;
}

export interface CreateRoleRequest {
  name: string;
  description: string;
  permissions: {
    permission: string;
    access: string[];
  }[];
}

export interface PermissionsResponse {
  success: boolean;
  data: Permission[];
}

export interface RolesResponse {
  success: boolean;
  data: Role[];
}

export interface CreateRoleResponse {
  success: boolean;
  message: string;
  data: Role;
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
  const url = `${API_CONFIG.baseUrl}${endpoint}`;

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

// Roles & Permissions Service
export const rolesService = {
  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<Permission[]> {
    const response = await apiRequest<PermissionsResponse>("/permissions", {
      method: "GET",
      headers: getAuthHeaders(),
    });

    return response.data;
  },

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<Role[]> {
    const response = await apiRequest<RolesResponse>("/roles", {
      method: "GET",
      headers: getAuthHeaders(),
    });

    return response.data;
  },

  /**
   * Create a new role
   */
  async createRole(roleData: CreateRoleRequest): Promise<Role> {
    const response = await apiRequest<CreateRoleResponse>("/roles", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(roleData),
    });

    return response.data;
  },
};
