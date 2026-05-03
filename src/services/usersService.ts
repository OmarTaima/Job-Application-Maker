import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";
import type {
  SavedField,
  CreateSavedFieldRequest,
  UpdateSavedFieldRequest,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  AddCompanyAccessRequest,
  UpdateDepartmentsRequest,
  UsersResponse,
  UserResponse,
  SavedQuestionGroup,
} from '../types/users';

// Re-export all types for convenience
export type {
  SavedField,
  CreateSavedFieldRequest,
  UpdateSavedFieldRequest,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  AddCompanyAccessRequest,
  UpdateDepartmentsRequest,
  UsersResponse,
  UserResponse,
  SavedQuestionGroup,
  SavedQuestion,
  SavedQuestionAnswerType,
} from '../types/users';

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

// ==================== SAVED FIELDS SERVICE ====================
class SavedFieldsService {
  private basePath = "/users/me/saved-fields";

  async getAllSavedFields(): Promise<SavedField[]> {
    try {
      const res = await axios.get(this.basePath);
      return res.data.data || [];
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async createSavedField(data: CreateSavedFieldRequest): Promise<SavedField> {
    try {
      const res = await axios.post(this.basePath, data);
      return res.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async updateSavedField(fieldId: string, data: UpdateSavedFieldRequest): Promise<SavedField> {
    try {
      const encoded = encodeURIComponent(fieldId);
      const res = await axios.put(`${this.basePath}/${encoded}`, data);
      return res.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async deleteSavedField(fieldId: string): Promise<void> {
    try {
      const encoded = encodeURIComponent(fieldId);
      await axios.delete(`${this.basePath}/${encoded}`);
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }
}

// ==================== SAVED QUESTION GROUPS SERVICE ====================
class SavedQuestionGroupsService {
  private basePath = "/users/me/saved-question-groups";

  private normalizeGroup(group: SavedQuestionGroup): SavedQuestionGroup {
    return {
      _id: group?._id,
      name: String(group?.name ?? "").trim(),
      questions: Array.isArray(group?.questions)
        ? group.questions.map((q) => ({
            question: String(q?.question ?? "").trim(),
            score: Number.isFinite(Number(q?.score)) ? Number(q?.score) : 0,
            answerType: q?.answerType ?? "text",
            choices: Array.isArray(q?.choices) 
              ? q.choices.map((c: any) => String(c ?? "").trim()).filter(Boolean)
              : [],
          }))
        : [],
    };
  }

  private extractFromResponse(payload: any): SavedQuestionGroup[] {
    const data = payload?.data?.groups || payload?.data || payload?.result?.groups || payload?.result || payload?.groups || payload;
    return Array.isArray(data) ? data : (data && typeof data === "object" ? [data] : []);
  }

  async getAllSavedQuestionGroups(): Promise<SavedQuestionGroup[]> {
    try {
      const response = await axios.get(this.basePath);
      return this.extractFromResponse(response.data);
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async createSavedQuestionGroup(group: SavedQuestionGroup): Promise<SavedQuestionGroup> {
    try {
      const payload = this.normalizeGroup(group);
      const response = await axios.post(this.basePath, {
        name: payload.name,
        questions: payload.questions,
      });
      return this.extractFromResponse(response.data)[0] || payload;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async updateSavedQuestionGroup(groupId: string, group: SavedQuestionGroup): Promise<SavedQuestionGroup> {
    try {
      const encodedId = encodeURIComponent(groupId);
      const payload = this.normalizeGroup(group);
      const response = await axios.put(`${this.basePath}/${encodedId}`, {
        name: payload.name,
        questions: payload.questions,
      });
      return this.extractFromResponse(response.data)[0] || { ...payload, _id: groupId };
    } catch (error: any) {
      // If not found, create it instead
      if (error?.response?.status === 404 || error?.response?.status === 405) {
        return this.createSavedQuestionGroup(group);
      }
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async deleteSavedQuestionGroup(groupId: string): Promise<void> {
    try {
      const encodedId = encodeURIComponent(groupId);
      await axios.delete(`${this.basePath}/${encodedId}`);
    } catch (error: any) {
      if (error?.response?.status === 404 || error?.response?.status === 405) return;
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async updateSavedQuestionGroups(groups: SavedQuestionGroup[]): Promise<SavedQuestionGroup[]> {
    try {
      const normalizedGroups = groups.map(g => this.normalizeGroup(g));
      const results = await Promise.all(
        normalizedGroups.map(group => 
          group._id 
            ? this.updateSavedQuestionGroup(group._id, group)
            : this.createSavedQuestionGroup(group)
        )
      );
      return results;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }
}

// ==================== USERS SERVICE ====================
class UsersService {
  async getAllUsers(params?: { companies?: string[] | string }): Promise<UsersResponse> {
    try {
      const response = await axios.get<UsersResponse>('/users', { params });
      return response.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

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
  }

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
  }

  async updateUser(userId: string, userData: UpdateUserRequest): Promise<User> {
    try {
      const response = await axios.put<UserResponse>(`/users/${userId}`, userData);
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

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
  }

  async addCompanyAccess(userId: string, companyData: AddCompanyAccessRequest): Promise<User> {
    try {
      const response = await axios.post<UserResponse>(`/users/${userId}/companies`, companyData);
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

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
  }

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
  }

  async getMyInterviews(params?: {
    direction?: 'future' | 'past';
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    try {
      const response = await axios.get('/users/me/interviews', { params });
      return response.data?.data ?? response.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }
}


// ==================== EXPORTS ====================
export const savedFieldsService = new SavedFieldsService();
export const savedQuestionGroupsService = new SavedQuestionGroupsService();
export const usersService = new UsersService();