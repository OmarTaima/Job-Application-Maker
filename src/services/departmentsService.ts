import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";

// Types
export interface Department {
  _id: string;
  name: string;
  description?: string;
  companyId: string | { _id: string; name: string };
  managerId?: string | { _id: string; fullName: string };
  isActive?: boolean;
  createdAt?: string;
  __v?: number;
}

export interface CreateDepartmentRequest {
  name: string;
  description?: string;
  companyId: string;
  managerId?: string;
}

export interface UpdateDepartmentRequest {
  name?: string;
  description?: string;
  managerId?: string;
  isActive?: boolean;
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
      const params = companyId ? { companyId } : {};
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
      const response = await axios.post<DepartmentResponse>(
        "/departments",
        departmentData
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

  // Update department
  async updateDepartment(
    departmentId: string,
    departmentData: UpdateDepartmentRequest
  ): Promise<Department> {
    try {
      const response = await axios.put<DepartmentResponse>(
        `/departments/${departmentId}`,
        departmentData
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
