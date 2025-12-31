import { API_CONFIG, tokenStorage } from "../config/api";

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

// Users API service
export const usersService = {
  // Get all users
  async getAllUsers(): Promise<User[]> {
    try {
      const response = await fetchWithAuth("/users");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to fetch users",
          response.status,
          errorData.details
        );
      }

      const data: UsersResponse = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while fetching users");
    }
  },

  // Get user by ID
  async getUserById(userId: string): Promise<User> {
    try {
      const response = await fetchWithAuth(`/users/${userId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to fetch user",
          response.status,
          errorData.details
        );
      }

      const data: UserResponse = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while fetching user");
    }
  },

  // Create user
  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      const response = await fetchWithAuth("/users", {
        method: "POST",
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to create user",
          response.status,
          errorData.details
        );
      }

      const data: UserResponse = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while creating user");
    }
  },

  // Update user
  async updateUser(userId: string, userData: UpdateUserRequest): Promise<User> {
    try {
      const response = await fetchWithAuth(`/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to update user",
          response.status,
          errorData.details
        );
      }

      const data: UserResponse = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while updating user");
    }
  },

  // Delete user
  async deleteUser(userId: string): Promise<void> {
    try {
      const response = await fetchWithAuth(`/users/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to delete user",
          response.status,
          errorData.details
        );
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while deleting user");
    }
  },

  // Add company access to user
  async addCompanyAccess(
    userId: string,
    companyData: AddCompanyAccessRequest
  ): Promise<User> {
    try {
      const response = await fetchWithAuth(`/users/${userId}/companies`, {
        method: "POST",
        body: JSON.stringify(companyData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to add company access",
          response.status,
          errorData.details
        );
      }

      const data: UserResponse = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while adding company access");
    }
  },

  // Update user company departments
  async updateCompanyDepartments(
    userId: string,
    companyId: string,
    departmentsData: UpdateDepartmentsRequest
  ): Promise<User> {
    try {
      const response = await fetchWithAuth(
        `/users/${userId}/companies/${companyId}/departments`,
        {
          method: "PUT",
          body: JSON.stringify(departmentsData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to update departments",
          response.status,
          errorData.details
        );
      }

      const data: UserResponse = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while updating departments");
    }
  },

  // Remove company access
  async removeCompanyAccess(userId: string, companyId: string): Promise<void> {
    try {
      const response = await fetchWithAuth(
        `/users/${userId}/companies/${companyId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to remove company access",
          response.status,
          errorData.details
        );
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while removing company access");
    }
  },
};
