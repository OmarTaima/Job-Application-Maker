import axios from "../config/axios";

// Types
export interface User {
  _id: string;
  fullName?: string;
  name?: string;
  email: string;
  roleId?: string | { _id: string; name: string };
  phone?: string;
  department?: string;
  isActive?: boolean;
  permissions?: Array<{ _id: string; name: string; access?: string[] }>;
  companies?: {
    companyId: string;
    role?: string;
    accessLevel?: string;
    departments?: string[];
  }[];
  createdAt?: string;
  __v?: number;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  password: string;
  roleId: string;
  phone?: string;
  department?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
  phone?: string;
  department?: string;
}

export interface AddCompanyAccessRequest {
  companyId: string;
  role?: string;
  accessLevel?: string;
}

export interface UpdateDepartmentsRequest {
  departments: string[];
  accessLevel?: string;
}

export interface UsersResponse {
  success: boolean;
  data: User[];
}

export interface UserResponse {
  success: boolean;
  data: User;
}

export interface MessageResponse {
  success: boolean;
  message: string;
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

// Users API service
export const usersService = {
  // Get all users
  async getAllUsers(companyIds?: string[]): Promise<User[]> {
    try {
      const params =
        companyIds && companyIds.length > 0
          ? { companyIds: companyIds.join(",") }
          : {};
      const response = await axios.get<UsersResponse>("/users", { params });
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        error.response?.data?.message || "Failed to fetch users",
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Get user by ID
  async getUserById(userId: string): Promise<User> {
    try {
      const response = await axios.get<UserResponse>(`/users/${userId}`);
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        error.response?.data?.message || "Failed to fetch user",
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Create user
  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      const response = await axios.post<UserResponse>("/users", userData);
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        error.response?.data?.message || "Failed to create user",
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Update user
  async updateUser(userId: string, userData: UpdateUserRequest): Promise<User> {
    try {
      const response = await axios.put<UserResponse>(
        `/users/${userId}`,
        userData
      );
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        error.response?.data?.message || "Failed to update user",
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Delete user
  async deleteUser(userId: string): Promise<void> {
    try {
      await axios.delete(`/users/${userId}`);
    } catch (error: any) {
      throw new ApiError(
        error.response?.data?.message || "Failed to delete user",
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Add company access to user
  async addCompanyAccess(
    userId: string,
    companyData: AddCompanyAccessRequest
  ): Promise<User> {
    try {
      const response = await axios.post<UserResponse>(
        `/users/${userId}/companies`,
        companyData
      );
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        error.response?.data?.message || "Failed to add company access",
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Update user company departments
  async updateCompanyDepartments(
    userId: string,
    companyId: string,
    departmentsData: UpdateDepartmentsRequest
  ): Promise<User> {
    try {
      const response = await axios.put<UserResponse>(
        `/users/${userId}/companies/${companyId}/departments`,
        departmentsData
      );
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        error.response?.data?.message || "Failed to update departments",
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Remove company access
  async removeCompanyAccess(userId: string, companyId: string): Promise<void> {
    try {
      await axios.delete(`/users/${userId}/companies/${companyId}`);
    } catch (error: any) {
      throw new ApiError(
        error.response?.data?.message || "Failed to remove company access",
        error.response?.status,
        error.response?.data?.details
      );
    }
  },
};
