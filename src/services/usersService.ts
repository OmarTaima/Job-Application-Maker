import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";

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
  permissions?: Array<{ permission: string; access?: string[] }>;
  companies?: {
    companyId: string;
    departments?: string[];
    isPrimary?: boolean;
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
  companies?: Array<{
    companyId: string;
    departments?: string[];
    isPrimary?: boolean;
  }>;
  isActive?: boolean;
  permissions?: Array<{ permission: string; access?: string[] }>;
}


export interface UpdateUserRequest {
  name?: string;
  fullName?: string;
  email?: string;
  roleId?: string;
  permissions?: Array<{ permission: string; access?: string[] }>;
  isActive?: boolean;
  phone?: string;
  department?: string;
}

export interface AddCompanyAccessRequest {
  companyId: string;
  role?: string;
  accessLevel?: string;
  departments?: string[];
}

export interface UpdateDepartmentsRequest {
  departments: string[];
  accessLevel?: string;
}

export interface UsersResponse {
  success: boolean;
  data: User[];
  // Optional pagination fields returned by the API
  page?: number | string;
  pageCount?: number | string;
  totalCount?: number | string;
  message?: string;
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
  // Get all users (with pagination)
  async getAllUsers(params: any = {}): Promise<UsersResponse> {
    try {
      const normalizedCompanyIds: string[] = Array.isArray(params.companyId)
        ? (Array.from(
            new Set(
              params.companyId
                .map((id: any) => String(id || '').trim())
                .filter(Boolean)
            )
          ) as string[])
        : typeof params.companyId === 'string' && params.companyId.includes(',')
          ? (Array.from(
              new Set(
                params.companyId
                  .split(',')
                  .map((id: string) => id.trim())
                  .filter(Boolean)
              )
            ) as string[])
          : params.companyId
            ? [String(params.companyId).trim()]
            : [];

      const extractUsers = (payload: any): User[] => {
        if (Array.isArray(payload)) return payload as User[];
        if (payload && Array.isArray(payload.data))
          return payload.data as User[];
        if (payload && payload.data && Array.isArray(payload.data.data))
          return payload.data.data as User[];
        return [];
      };

      const fetchOne = async (
        singleCompanyId?: string,
        overridePage?: number,
        overridePageCount?: string | number
      ) => {
        const requestParams: any = { ...params };
        requestParams.deleted = 'false';
        requestParams.page = overridePage ?? requestParams.page ?? 1;
        requestParams.PageCount =
          overridePageCount ?? requestParams.PageCount ?? 100;
        if (singleCompanyId) requestParams.companyId = singleCompanyId;
        const response = await axios.get<UsersResponse>('/users', {
          params: requestParams,
        });
        return response.data;
      };

      if (normalizedCompanyIds.length <= 1) {
        return fetchOne(normalizedCompanyIds[0]);
      }

      // For multi-company users, fetch each company separately and paginate locally.
      const requestedPage = Number(params.page || 1);
      const requestedPageCount = Number(params.PageCount || 100);
      const responses = await Promise.all(
        normalizedCompanyIds.map((id) => fetchOne(id, 1, 'all'))
      );

      const unique = new Map<string, User>();
      responses.forEach((res) => {
        extractUsers(res).forEach((user) => {
          if (user && user._id) unique.set(user._id, user);
        });
      });

      const allUsers = Array.from(unique.values());
      const totalCount = allUsers.length;
      const start = Math.max(0, (requestedPage - 1) * requestedPageCount);
      const end = start + requestedPageCount;
      const pagedUsers = allUsers.slice(start, end);

      return {
        success: true,
        data: pagedUsers,
        page: requestedPage,
        pageCount: requestedPageCount,
        totalCount,
      };
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
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
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Create user
  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      const response = await axios.post<UserResponse>('/users', userData);
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
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
        getErrorMessage(error),
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
        getErrorMessage(error),
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
        getErrorMessage(error),
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
        getErrorMessage(error),
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
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },
  async getMyInterviews(
    params: {
      direction?: 'future' | 'past';
      status?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<any> {
    try {
      const searchParams: any = {};
      if (params.direction) searchParams.direction = params.direction;
      if (params.status) searchParams.status = params.status;
      if (params.page) searchParams.page = params.page;
      if (params.limit) searchParams.limit = params.limit;

      const response = await axios.get('/users/me/interviews', {
        params: searchParams,
      });
      return response.data?.data ?? response.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },
};
