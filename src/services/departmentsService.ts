// services/departmentsService.ts
import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";
import type {
  Department,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
} from '../types/departments';
import { ApiError } from "./companiesService"; // Reuse ApiError

// Re-export types
export type {
  Department,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
} from '../types/departments';

// Departments API service
class DepartmentsService {
  private extractDepartments(payload: any): Department[] {
    if (Array.isArray(payload)) return payload;
    if (payload?.data && Array.isArray(payload.data)) return payload.data;
    if (payload?.data?.data && Array.isArray(payload.data.data)) return payload.data.data;
    return [];
  }

  private normalizeCompanyIds(companyId?: string | string[]): string[] {
    if (!companyId) return [];
    const ids = Array.isArray(companyId) ? companyId : [companyId];
    return [...new Set(ids.map(id => String(id || "").trim()).filter(Boolean))];
  }

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
        error.response?.data?.details
      );
    }
  }

  async getAllDepartments(companyId?: string | string[]): Promise<Department[]> {
    const normalizedIds = this.normalizeCompanyIds(companyId);
    
    const fetchOne = async (singleCompanyId?: string): Promise<Department[]> => {
      const params: any = { deleted: "false" };
      if (singleCompanyId) params.companyId = singleCompanyId;
      const response = await this.request<any>('get', "/departments", undefined, params);
      return this.extractDepartments(response);
    };

    if (normalizedIds.length <= 1) {
      return fetchOne(normalizedIds[0]);
    }

    const departmentLists = await Promise.all(normalizedIds.map(id => fetchOne(id)));
    const unique = new Map<string, Department>();
    departmentLists.flat().forEach(department => {
      if (department?._id) unique.set(department._id, department);
    });
    return Array.from(unique.values());
  }

  async getDepartmentById(departmentId: string): Promise<Department> {
    return this.request<Department>('get', `/departments/${departmentId}`);
  }

  async createDepartment(departmentData: CreateDepartmentRequest): Promise<Department> {
    // Map legacy `deleted` to `isActive` before sending
    const payload: any = { ...departmentData };
    if (typeof payload.deleted === 'boolean') {
      payload.isActive = !payload.deleted;
      delete payload.deleted;
    }
    return this.request<Department>('post', "/departments", payload);
  }

  async updateDepartment(
    departmentId: string,
    departmentData: UpdateDepartmentRequest
  ): Promise<Department> {
    // Map legacy `deleted` to `isActive` before sending
    const payload: any = { ...departmentData };
    if (typeof payload.deleted === 'boolean') {
      payload.isActive = !payload.deleted;
      delete payload.deleted;
    }
    return this.request<Department>('put', `/departments/${departmentId}`, payload);
  }

  async deleteDepartment(departmentId: string): Promise<void> {
    await this.request<void>('delete', `/departments/${departmentId}`);
  }
}

export const departmentsService = new DepartmentsService();