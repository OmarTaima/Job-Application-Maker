import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";

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

// Types
export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "date"
  | "radio"
  | "dropdown"
  | "checkbox"
  | "url"
  | "tags"
  | "boolean";

export type FieldValidation = {
  min?: number | null;
  max?: number | null;
  minLength?: number | null;
  maxLength?: number | null;
  pattern?: string | null;
};

export type RecommendedField = {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  validation?: FieldValidation;
  description?: string;
  defaultValue?: string;
  displayOrder?: number;
};

export type CreateRecommendedFieldRequest = {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  validation?: FieldValidation;
  description?: string;
};

export type UpdateRecommendedFieldRequest = {
  label?: string;
  type?: FieldType;
  required?: boolean;
  options?: string[];
  validation?: FieldValidation;
  description?: string;
};

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
   * PUT /system-settings/recommended-fields/{fieldName}
   */
  async updateRecommendedField(
    fieldName: string,
    fieldData: UpdateRecommendedFieldRequest
  ): Promise<RecommendedField> {
    try {
      const encodedFieldName = encodeURIComponent(fieldName);
      const response = await axios.put(
        `/system-settings/recommended-fields/${encodedFieldName}`,
        fieldData
      );
      return (
        response.data.data ||
        ({ name: fieldName, ...fieldData } as RecommendedField)
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
   * DELETE /system-settings/recommended-fields/{fieldName}
   */
  async deleteRecommendedField(fieldName: string): Promise<void> {
    try {
      const encodedFieldName = encodeURIComponent(fieldName);
      await axios.delete(
        `/system-settings/recommended-fields/${encodedFieldName}`
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
