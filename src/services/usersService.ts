// services/usersService.ts
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
  SavedQuestionGroup,
} from '../types/users';
import { ApiError } from "./companiesService";

// Re-export all types
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

// ==================== HELPERS ====================
function normalizeQuestionGroup(group: SavedQuestionGroup): SavedQuestionGroup {
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

function extractSavedQuestionGroups(payload: any): SavedQuestionGroup[] {
  const data = payload?.data?.groups || payload?.data || payload?.result?.groups || payload?.result || payload?.groups || payload;
  return Array.isArray(data) ? data : (data && typeof data === "object" ? [data] : []);
}

// ==================== BASE SERVICE ====================
class BaseService {
  protected async request<T>(
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
}

// ==================== SAVED FIELDS SERVICE ====================
class SavedFieldsService extends BaseService {
  private basePath = "/users/me/saved-fields";

  async getAllSavedFields(): Promise<SavedField[]> {
    const response = await this.request<SavedField[]>('get', this.basePath);
    return Array.isArray(response) ? response : [];
  }

  async createSavedField(data: CreateSavedFieldRequest): Promise<SavedField> {
    return this.request<SavedField>('post', this.basePath, data);
  }

  async updateSavedField(fieldId: string, data: UpdateSavedFieldRequest): Promise<SavedField> {
    const encoded = encodeURIComponent(fieldId);
    return this.request<SavedField>('put', `${this.basePath}/${encoded}`, data);
  }

  async deleteSavedField(fieldId: string): Promise<void> {
    const encoded = encodeURIComponent(fieldId);
    await this.request<void>('delete', `${this.basePath}/${encoded}`);
  }
}

// ==================== SAVED QUESTION GROUPS SERVICE ====================
class SavedQuestionGroupsService extends BaseService {
  private basePath = "/users/me/saved-question-groups";

  async getAllSavedQuestionGroups(): Promise<SavedQuestionGroup[]> {
    const response = await this.request<any>('get', this.basePath);
    return extractSavedQuestionGroups(response);
  }

  async createSavedQuestionGroup(group: SavedQuestionGroup): Promise<SavedQuestionGroup> {
    const normalized = normalizeQuestionGroup(group);
    const response = await this.request<any>('post', this.basePath, {
      name: normalized.name,
      questions: normalized.questions,
    });
    return extractSavedQuestionGroups(response)[0] || normalized;
  }

  async updateSavedQuestionGroup(groupId: string, group: SavedQuestionGroup): Promise<SavedQuestionGroup> {
    const encodedId = encodeURIComponent(groupId);
    const normalized = normalizeQuestionGroup(group);
    
    try {
      const response = await this.request<any>('put', `${this.basePath}/${encodedId}`, {
        name: normalized.name,
        questions: normalized.questions,
      });
      return extractSavedQuestionGroups(response)[0] || { ...normalized, _id: groupId };
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 405) {
        return this.createSavedQuestionGroup(group);
      }
      throw error;
    }
  }

  async deleteSavedQuestionGroup(groupId: string): Promise<void> {
    const encodedId = encodeURIComponent(groupId);
    try {
      await this.request<void>('delete', `${this.basePath}/${encodedId}`);
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 405) return;
      throw error;
    }
  }

  async updateSavedQuestionGroups(groups: SavedQuestionGroup[]): Promise<SavedQuestionGroup[]> {
    const normalizedGroups = groups.map(g => normalizeQuestionGroup(g));
    const results = await Promise.all(
      normalizedGroups.map(group => 
        group._id 
          ? this.updateSavedQuestionGroup(group._id, group)
          : this.createSavedQuestionGroup(group)
      )
    );
    return results;
  }
}

// ==================== USERS SERVICE ====================
class UsersService extends BaseService {
  async getAllUsers(params?: { companies?: string[] | string }): Promise<any[]> {
  const response = await this.request<any>('get', '/users', undefined, params);
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
    return response.data;
  }
  return [];
}

  async getUserById(userId: string): Promise<User> {
    return this.request<User>('get', `/users/${userId}`);
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    return this.request<User>('post', '/users', userData);
  }

  async updateUser(userId: string, userData: UpdateUserRequest): Promise<User> {
    return this.request<User>('put', `/users/${userId}`, userData);
  }

  async deleteUser(userId: string): Promise<void> {
    await this.request<void>('delete', `/users/${userId}`);
  }

  async addCompanyAccess(userId: string, companyData: AddCompanyAccessRequest): Promise<User> {
    return this.request<User>('post', `/users/${userId}/companies`, companyData);
  }

  async updateCompanyDepartments(
    userId: string,
    companyId: string,
    departmentsData: UpdateDepartmentsRequest
  ): Promise<User> {
    return this.request<User>('put', `/users/${userId}/companies/${companyId}/departments`, departmentsData);
  }

  async removeCompanyAccess(userId: string, companyId: string): Promise<void> {
    await this.request<void>('delete', `/users/${userId}/companies/${companyId}`);
  }

  async getMyInterviews(params?: {
    direction?: 'future' | 'past';
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    return this.request<any>('get', '/users/me/interviews', undefined, params);
  }
}

// ==================== EXPORTS ====================
export const savedFieldsService = new SavedFieldsService();
export const savedQuestionGroupsService = new SavedQuestionGroupsService();
export const usersService = new UsersService();