// services/rolesService.ts
import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";
import type {
  Permission,
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
} from '../types/roles';
import { ApiError } from "./companiesService";

// Re-export types
export type {
  Permission,
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
} from '../types/roles';

// Roles & Permissions Service
class RolesService {
  private readonly PERMISSIONS_BASE = "/permissions";
  private readonly ROLES_BASE = "/roles";

  private async request<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: any,
    params?: any
  ): Promise<T> {
    try {
      const config = { params };
      const response = method === 'get' || method === 'delete'
        ? await axios[method](url, config)
        : await axios[method](url, data, config);
      
      return response.data?.data ?? response.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data
      );
    }
  }

  private extractRoleFromResponse(responseData: any): Role {
    const role = responseData?.data ?? responseData?.role ?? responseData ?? null;

    if (role && typeof role === 'object' && '_id' in role) {
      return role as Role;
    }

    const nestedWithId = Object.values(responseData || {}).find(
      (v: any) => v && typeof v === 'object' && v._id
    );

    if (nestedWithId) {
      return nestedWithId as Role;
    }

    console.warn('RolesService: Unable to extract role from response', responseData);
    throw new ApiError('Invalid response format from server');
  }

  async getAllPermissions(): Promise<Permission[]> {
    const response = await this.request<Permission[]>('get', this.PERMISSIONS_BASE, undefined, { PageCount: 1000 });
    return Array.isArray(response) ? response : [];
  }

  async getAllRoles(): Promise<Role[]> {
    const response = await this.request<Role[]>('get', this.ROLES_BASE, undefined, { deleted: "false" });
    return Array.isArray(response) ? response : [];
  }

  async getRoleById(roleId: string): Promise<Role> {
    return this.request<Role>('get', `${this.ROLES_BASE}/${roleId}`);
  }

  async createRole(roleData: CreateRoleRequest): Promise<Role> {
    const response = await this.request<any>('post', this.ROLES_BASE, roleData);
    return this.extractRoleFromResponse(response);
  }

  async updateRole(roleId: string, roleData: UpdateRoleRequest): Promise<Role> {
    return this.request<Role>('put', `${this.ROLES_BASE}/${roleId}`, roleData);
  }

  async deleteRole(roleId: string): Promise<void> {
    await this.request<void>('delete', `${this.ROLES_BASE}/${roleId}`);
  }

  async getPermissionsByRole(roleId: string): Promise<Permission[]> {
    const response = await this.request<Permission[]>('get', `${this.ROLES_BASE}/${roleId}/permissions`);
    return Array.isArray(response) ? response : [];
  }

  async assignPermissionsToRole(roleId: string, permissions: string[]): Promise<Role> {
    const response = await this.request<any>('post', `${this.ROLES_BASE}/${roleId}/permissions`, { permissions });
    return this.extractRoleFromResponse(response);
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await this.request<void>('delete', `${this.ROLES_BASE}/${roleId}/permissions/${permissionId}`);
  }
}

export const rolesService = new RolesService();