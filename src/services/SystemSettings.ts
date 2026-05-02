import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";

import type {
  RecommendedField,
  CreateRecommendedFieldRequest,
  UpdateRecommendedFieldRequest,
} from '../types/SystemSettings';

// Re-export types for backward compatibility
export type {
  FieldType,
  BilingualString,
  BilingualChoice,
  FieldValidation,
  RecommendedField,
  CreateRecommendedFieldRequest,
  UpdateRecommendedFieldRequest,
} from '../types/SystemSettings';

// API Error Class
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

// Service Class
class RecommendedFieldsService {
  /**
   * Get all recommended fields
   * GET /system-settings/recommended-fields
   */
  async getAllRecommendedFields(): Promise<RecommendedField[]> {
    try {
      const response = await axios.get("/system-settings/recommended-fields");
      return response.data.data || [];
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Create a new recommended field
   * POST /system-settings/recommended-fields
   */
  async createRecommendedField(
    fieldData: CreateRecommendedFieldRequest
  ): Promise<RecommendedField> {
    try {
      const response = await axios.post(
        "/system-settings/recommended-fields",
        fieldData
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

  /**
   * Update an existing recommended field
   * PUT /system-settings/recommended-fields/{fieldId}
   */
  async updateRecommendedField(
    fieldId: string,
    fieldData: UpdateRecommendedFieldRequest
  ): Promise<RecommendedField> {
    try {
      const encodedFieldId = encodeURIComponent(fieldId);
      const response = await axios.put(
        `/system-settings/recommended-fields/${encodedFieldId}`,
        fieldData
      );
      return (
        response.data.data ||
        ({ fieldId: fieldId, ...fieldData } as RecommendedField)
      );
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Delete a recommended field
   * DELETE /system-settings/recommended-fields/{fieldId}
   */
  async deleteRecommendedField(fieldId: string): Promise<void> {
    try {
      const encodedFieldId = encodeURIComponent(fieldId);
      await axios.delete(
        `/system-settings/recommended-fields/${encodedFieldId}`
      );
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }
}

export const recommendedFieldsService = new RecommendedFieldsService();
