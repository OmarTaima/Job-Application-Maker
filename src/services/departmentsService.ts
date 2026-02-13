import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";

// Types
export interface Department {
  _id: string;
  name: {
    en: string;
    ar: string;
  };
  description?: {
    en: string;
    ar: string;
  };
  companyId: string | { _id: string; name: string };
  managerId?: string | { _id: string; fullName: string };
  isActive?: boolean;
  createdAt?: string;
  __v?: number;
}

export interface CreateDepartmentRequest {
  companyId: string;
  name: {
    en: string;
    ar: string;
  };
  description?: {
    en: string;
    ar: string;
  };
  managerId?: string;
  // legacy callers may still send `deleted`; accept it and map to `isActive`
  deleted?: boolean;
}

export interface UpdateDepartmentRequest {
  name: {
    en: string;
    ar: string;
  };
  description?: {
    en: string;
    ar: string;
  };
  managerId?: string;
  isActive?: boolean;
  // accept legacy `deleted` flag and map it when sending to server
  deleted?: boolean;
}

export interface DepartmentsResponse {
  success: boolean;
  data: Department[];
}

export interface DepartmentResponse {
  success: boolean;
  data: Department;
}

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
  async getAllDepartments(companyId?: string): Promise<Department[]> {
    try {
      const params: any = companyId ? { companyId } : {};
      // Request only non-deleted departments by default
      // Always request only non-deleted departments
      params.deleted = "false";
      const response = await axios.get<DepartmentsResponse>("/departments", {
        params,
      });
      return response.data.data;
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
