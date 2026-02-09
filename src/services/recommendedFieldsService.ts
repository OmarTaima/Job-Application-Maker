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
  | "repeatable_group";

export type BilingualString = {
  en: string;
  ar: string;
};

export type BilingualChoice = {
  en: string;
  ar: string;
};

export type FieldValidation = {
  min?: number | null;
  max?: number | null;
  minLength?: number | null;
  maxLength?: number | null;
  pattern?: string | null;
};

export type RecommendedField = {
  fieldId: string;
  label: BilingualString;
  inputType: FieldType;
  isRequired: boolean;
  choices?: BilingualChoice[];
  minValue?: number;
  maxValue?: number;
  defaultValue?: string;
  displayOrder?: number;
  description?: BilingualString;
  // Support grouped sub-fields (API may return groupFields or subFields)
  groupFields?: Array<{
    fieldId?: string;
    label: BilingualString;
    inputType: FieldType;
    isRequired?: boolean;
    choices?: BilingualChoice[];
    displayOrder?: number;
    defaultValue?: string;
    minValue?: number;
    maxValue?: number;
  }>;
  // Some responses might use `subFields` instead of `groupFields`
  subFields?: Array<{
    fieldId?: string;
    label: BilingualString;
    inputType: FieldType;
    isRequired?: boolean;
    choices?: BilingualChoice[];
    displayOrder?: number;
    defaultValue?: string;
    minValue?: number;
    maxValue?: number;
  }>;
};

export type CreateRecommendedFieldRequest = {
  fieldId: string;
  label: BilingualString;
  inputType: FieldType;
  isRequired: boolean;
  displayOrder?: number;
  choices?: BilingualChoice[];
  minValue?: number;
  maxValue?: number;
  defaultValue?: string;
};

export type UpdateRecommendedFieldRequest = {
  label?: BilingualString;
  inputType?: FieldType;
  isRequired?: boolean;
  choices?: BilingualChoice[];
  minValue?: number;
  maxValue?: number;
  defaultValue?: string;
  displayOrder?: number;
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
