import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";
import type {
  Permission,
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
  PermissionsResponse,
  RolesResponse,
  CreateRoleResponse,
} from '../types/roles';

// Re-export types for convenience
export type {
  Permission,
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
  PermissionsResponse,
  RolesResponse,
  CreateRoleResponse,
} from '../types/roles';

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
class RolesService {
  private readonly PERMISSIONS_BASE = "/permissions";
  private readonly ROLES_BASE = "/roles";

  /**
   * Extract role from response with fallback for different response shapes
   */
  private extractRoleFromResponse(responseData: any): Role {
    // Try common response shapes
    const role = 
      responseData?.data ??           // Standard shape: { data: Role }
      responseData?.role ??           // Alternative shape: { role: Role }
      responseData ??                 // Direct role object
      null;

    // Check if we have a valid role with _id
    if (role && typeof role === 'object' && '_id' in role) {
      return role as Role;
    }

    // Try to find nested object with _id
    const nestedWithId = Object.values(responseData || {}).find(
      (v: any) => v && typeof v === 'object' && v._id
    );

    if (nestedWithId) {
      return nestedWithId as Role;
    }

    // Log warning if we couldn't extract the role
    console.warn('RolesService: Unable to extract role from response', responseData);
    throw new ApiError('Invalid response format from server');
  }

  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<Permission[]> {
    try {
      const response = await axios.get<PermissionsResponse>(
        `${this.PERMISSIONS_BASE}?PageCount=1000`
      );
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data
      );
    }
  }

  /**
   * Get all roles (non-deleted by default)
   */
  async getAllRoles(): Promise<Role[]> {
    try {
      const response = await axios.get<RolesResponse>(this.ROLES_BASE, {
        params: { deleted: "false" }
      });
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data
      );
    }
  }

  /**
   * Get role by ID
   */
  async getRoleById(roleId: string): Promise<Role> {
    try {
      const response = await axios.get<{ data: Role }>(`${this.ROLES_BASE}/${roleId}`);
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data
      );
    }
  }

  /**
   * Create a new role
   */
  async createRole(roleData: CreateRoleRequest): Promise<Role> {
    try {
      const response = await axios.post<CreateRoleResponse>(
        this.ROLES_BASE,
        roleData
      );
      return this.extractRoleFromResponse(response.data);
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data
      );
    }
  }

  /**
   * Update an existing role
   */
  async updateRole(roleId: string, roleData: UpdateRoleRequest): Promise<Role> {
    try {
      const response = await axios.put<CreateRoleResponse>(
        `${this.ROLES_BASE}/${roleId}`,
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
  }

  /**
   * Delete a role (soft delete)
   */
  async deleteRole(roleId: string): Promise<void> {
    try {
      await axios.delete(`${this.ROLES_BASE}/${roleId}`);
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data
      );
    }
  }

  /**
   * Get permissions by role ID
   */
  async getPermissionsByRole(roleId: string): Promise<Permission[]> {
    try {
      const response = await axios.get<{ data: Permission[] }>(
        `${this.ROLES_BASE}/${roleId}/permissions`
      );
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data
      );
    }
  }

  /**
   * Assign permissions to role
   */
  async assignPermissionsToRole(roleId: string, permissions: string[]): Promise<Role> {
    try {
      const response = await axios.post<CreateRoleResponse>(
        `${this.ROLES_BASE}/${roleId}/permissions`,
        { permissions }
      );
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data
      );
    }
  }

  /**
   * Remove permission from role
   */
  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    try {
      await axios.delete(`${this.ROLES_BASE}/${roleId}/permissions/${permissionId}`);
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data
      );
    }
  }
}

// Export singleton instance
export const rolesService = new RolesService();