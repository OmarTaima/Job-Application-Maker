// services/systemSettingsService.ts
import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";
import type {
  RecommendedField,
  CreateRecommendedFieldRequest,
  UpdateRecommendedFieldRequest,
} from '../types/SystemSettings';
import { TableLayout } from '../types/auth';
import { ApiError } from "./companiesService";

// Re-export types
export type {
  RecommendedField,
  CreateRecommendedFieldRequest,
  UpdateRecommendedFieldRequest,
} from '../types/SystemSettings';

// ===== Base Service =====
class SystemSettingsService {
  private async request<T>(
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    url: string,
    data?: any,
    params?: any
  ): Promise<T> {
    try {
      const config = { params };
      let response;
      
      if (method === 'get' || method === 'delete') {
        response = await axios[method](url, config);
      } else {
        response = await axios[method](url, data, config);
      }
      
      return response.data?.data ?? response.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  // ===== Recommended Fields =====
  async getAllRecommendedFields(): Promise<RecommendedField[]> {
    const response = await this.request<RecommendedField[]>('get', '/system-settings/recommended-fields');
    return Array.isArray(response) ? response : [];
  }

  async getRecommendedFieldById(fieldId: string): Promise<RecommendedField> {
    const encodedId = encodeURIComponent(fieldId);
    return this.request<RecommendedField>('get', `/system-settings/recommended-fields/${encodedId}`);
  }

  async createRecommendedField(fieldData: CreateRecommendedFieldRequest): Promise<RecommendedField> {
    return this.request<RecommendedField>('post', '/system-settings/recommended-fields', fieldData);
  }

  async updateRecommendedField(fieldId: string, fieldData: UpdateRecommendedFieldRequest): Promise<RecommendedField> {
    const encodedId = encodeURIComponent(fieldId);
    return this.request<RecommendedField>('put', `/system-settings/recommended-fields/${encodedId}`, fieldData);
  }

  async deleteRecommendedField(fieldId: string): Promise<void> {
    const encodedId = encodeURIComponent(fieldId);
    await this.request<void>('delete', `/system-settings/recommended-fields/${encodedId}`);
  }

  // ===== Table Layout Preferences =====
  async getTableLayout(tableKey: string): Promise<TableLayout> {
    try {
      const response = await this.request<any>('get', `/users/preferences/${tableKey}`);
      return response ?? { columnVisibility: {}, columnSizing: {}, columnOrder: [] };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return { columnVisibility: {}, columnSizing: {}, columnOrder: [] };
      }
      throw error;
    }
  }

  async saveTableLayout(tableKey: string, layout: TableLayout): Promise<void> {
    await this.request<void>('patch', `/users/preferences/${tableKey}`, layout);
  }
}

export const systemSettingsService = new SystemSettingsService();