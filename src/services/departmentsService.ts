import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";
import type {
  Department,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  DepartmentsResponse,
  DepartmentResponse,
} from '../types/departments';

// Re-export types for backward compatibility
export type {
  Department,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  DepartmentsResponse,
  DepartmentResponse,
} from '../types/departments';

// API Error class
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Departments API service
export const departmentsService = {
  // Get all departments (optionally filtered by companyId)
  async getAllDepartments(companyId?: string | string[]): Promise<Department[]> {
    try {
      const normalizedCompanyIds = Array.isArray(companyId)
        ? Array.from(new Set(companyId.map((id) => String(id || "").trim()).filter(Boolean)))
        : companyId
          ? [String(companyId).trim()]
          : [];

      const extractDepartments = (payload: any): Department[] => {
        if (Array.isArray(payload)) return payload as Department[];
        if (payload && Array.isArray(payload.data)) return payload.data as Department[];
        if (payload && payload.data && Array.isArray(payload.data.data)) return payload.data.data as Department[];
        return [];
      };

      const fetchOne = async (singleCompanyId?: string): Promise<Department[]> => {
        const params: any = { deleted: "false" };
        if (singleCompanyId) params.companyId = singleCompanyId;
        const response = await axios.get<DepartmentsResponse>("/departments", { params });
        return extractDepartments(response.data);
      };

      if (normalizedCompanyIds.length <= 1) {
        return fetchOne(normalizedCompanyIds[0]);
      }

      const departmentLists = await Promise.all(normalizedCompanyIds.map((id) => fetchOne(id)));
      const unique = new Map<string, Department>();
      departmentLists.flat().forEach((department) => {
        if (department && department._id) unique.set(department._id, department);
      });
      return Array.from(unique.values());
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Get department by ID
  async getDepartmentById(departmentId: string): Promise<Department> {
    try {
      const response = await axios.get<DepartmentResponse>(
        `/departments/${departmentId}`
      );
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Create department
  async createDepartment(
    departmentData: CreateDepartmentRequest
  ): Promise<Department> {
    try {
      // Allow callers to pass `deleted` (legacy); map to `isActive` before sending
      const payloadToSend: any = { ...departmentData };
      if (typeof (payloadToSend as any).deleted === 'boolean') {
        payloadToSend.isActive = !(payloadToSend as any).deleted;
        delete payloadToSend.deleted;
      }

      const response = await axios.post<DepartmentResponse>(
        "/departments",
        payloadToSend
      );
      // Normalize possible response shapes:
      // { message: 'Success', department: { ... } }
      // { data: { ... } } or { data: { data: { ... } } }
      const payload: any = response.data;
      let created: any = null;
      if (payload) {
        if (payload.department) created = payload.department;
        else if (payload.data && payload.data.department) created = payload.data.department;
        else if (payload.data && payload.data.data) created = payload.data.data;
        else if (payload.data) created = payload.data;
        else created = payload;
      }

      if (!created) {
        console.warn("departmentsService.createDepartment: unexpected response shape", response.data);
        throw new ApiError("Invalid response from server", response.status, (response.data as any)?.details);
      }

      // Normalize possible legacy `deleted` flag in response to `isActive`
      if (typeof (created as any).deleted === 'boolean') {
        (created as any).isActive = !(created as any).deleted;
      }

      return created as Department;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Update department
  async updateDepartment(
    departmentId: string,
    departmentData: UpdateDepartmentRequest
  ): Promise<Department> {
    try {
      // Map legacy `deleted` to `isActive` before sending
      const payloadToSend: any = { ...(departmentData as any) };
      if (typeof payloadToSend.deleted === 'boolean') {
        payloadToSend.isActive = !payloadToSend.deleted;
        delete payloadToSend.deleted;
      }

      const response = await axios.put<DepartmentResponse>(
        `/departments/${departmentId}`,
        payloadToSend
      );
      const payload: any = response.data;
      // Normalize similar to create
      let updated: any = null;
      if (payload) {
        if (payload.department) updated = payload.department;
        else if (payload.data && payload.data.department) updated = payload.data.department;
        else if (payload.data && payload.data.data) updated = payload.data.data;
        else if (payload.data) updated = payload.data;
        else updated = payload;
      }
      if (!updated) {
        console.warn("departmentsService.updateDepartment: unexpected response shape", response.data);
        throw new ApiError("Invalid response from server", response.status, (response.data as any)?.details);
      }

      // Normalize possible legacy `deleted` flag in response to `isActive`
      if (typeof (updated as any).deleted === 'boolean') {
        (updated as any).isActive = !(updated as any).deleted;
      }
      return updated as Department;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Delete department
  async deleteDepartment(departmentId: string): Promise<void> {
    try {
      await axios.delete(`/departments/${departmentId}`);
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },
};
