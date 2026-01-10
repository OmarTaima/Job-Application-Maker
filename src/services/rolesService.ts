import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";

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
  permissions?: Array<string | { permission: string; access?: string[] }>;
  isSystemRole?: boolean;
  singleCompany?: boolean;
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
  isSystemRole?: boolean;
  singleCompany?: boolean;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: {
    permission: string;
    access: string[];
  }[];
  isSystemRole?: boolean;
  singleCompany?: boolean;
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

// Roles & Permissions Service
export const rolesService = {
  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<Permission[]> {
    try {
      const response = await axios.get<PermissionsResponse>("/permissions");
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data
      );
    }
  },

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<Role[]> {
    try {
      const response = await axios.get<RolesResponse>("/roles");
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data
      );
    }
  },

  /**
   * Create a new role
   */
  async createRole(roleData: CreateRoleRequest): Promise<Role> {
    try {
      const response = await axios.post<CreateRoleResponse>("/roles", roleData);
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data
      );
    }
  },

  /**
   * Update an existing role
   */
  async updateRole(id: string, roleData: UpdateRoleRequest): Promise<Role> {
    try {
      const response = await axios.put<CreateRoleResponse>(
        `/roles/${id}`,
        roleData
      );
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data
      );
    }
  },

  /**
   * Delete a role
   */
  async deleteRole(id: string): Promise<void> {
    try {
      await axios.delete(`/roles/${id}`);
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data
      );
    }
  },
};
