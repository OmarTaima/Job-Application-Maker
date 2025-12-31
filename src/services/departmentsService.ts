import { API_CONFIG, tokenStorage } from "../config/api";

// Types
export interface Department {
  _id: string;
  name: string;
  description?: string;
  companyId: string | { _id: string; name: string };
  managerId?: string | { _id: string; fullName: string };
  location?: string;
  createdAt?: string;
  __v?: number;
}

export interface CreateDepartmentRequest {
  name: string;
  description?: string;
  companyId: string;
  managerId?: string;
  location?: string;
}

export interface UpdateDepartmentRequest {
  name?: string;
  description?: string;
  managerId?: string;
  location?: string;
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

// Helper function to make authenticated requests
async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = tokenStorage.getAccessToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  return response;
}

// Departments API service
export const departmentsService = {
  // Get all departments (optionally filtered by companyId)
  async getAllDepartments(companyId?: string): Promise<Department[]> {
    try {
      const queryParam = companyId ? `?companyId=${companyId}` : "";
      const response = await fetchWithAuth(`/departments${queryParam}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to fetch departments",
          response.status,
          errorData.details
        );
      }

      const data: DepartmentsResponse = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while fetching departments");
    }
  },

  // Get department by ID
  async getDepartmentById(departmentId: string): Promise<Department> {
    try {
      const response = await fetchWithAuth(`/departments/${departmentId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to fetch department",
          response.status,
          errorData.details
        );
      }

      const data: DepartmentResponse = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while fetching department");
    }
  },

  // Create department
  async createDepartment(
    departmentData: CreateDepartmentRequest
  ): Promise<Department> {
    try {
      const response = await fetchWithAuth("/departments", {
        method: "POST",
        body: JSON.stringify(departmentData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to create department",
          response.status,
          errorData.details
        );
      }

      const data: DepartmentResponse = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while creating department");
    }
  },

  // Update department
  async updateDepartment(
    departmentId: string,
    departmentData: UpdateDepartmentRequest
  ): Promise<Department> {
    try {
      const response = await fetchWithAuth(`/departments/${departmentId}`, {
        method: "PUT",
        body: JSON.stringify(departmentData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to update department",
          response.status,
          errorData.details
        );
      }

      const data: DepartmentResponse = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while updating department");
    }
  },

  // Delete department
  async deleteDepartment(departmentId: string): Promise<void> {
    try {
      const response = await fetchWithAuth(`/departments/${departmentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to delete department",
          response.status,
          errorData.details
        );
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while deleting department");
    }
  },
};
