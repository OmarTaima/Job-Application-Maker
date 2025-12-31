import { API_CONFIG, tokenStorage } from "../config/api";

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

// Helper function for authenticated requests
async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = tokenStorage.getAccessToken();
  if (!token) {
    throw new ApiError("No authentication token found", 401);
  }

  const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      // If error response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new ApiError(errorMessage, response.status);
  }

  // Handle 204 No Content responses
  if (response.status === 204) {
    return null;
  }

  return response;
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
  label: string;
  type: FieldType;
  required: boolean;
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
      const response = await fetchWithAuth(
        "/system-settings/recommended-fields"
      );
      if (!response) return [];
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError("Failed to fetch recommended fields");
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
      const response = await fetchWithAuth(
        "/system-settings/recommended-fields",
        {
          method: "POST",
          body: JSON.stringify(fieldData),
        }
      );
      if (!response) throw new ApiError("No response from server");
      const data = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError("Failed to create recommended field");
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
      const response = await fetchWithAuth(
        `/system-settings/recommended-fields/${encodedFieldName}`,
        {
          method: "PUT",
          body: JSON.stringify(fieldData),
        }
      );

      // Handle 204 No Content
      if (response === null) {
        return { name: fieldName, ...fieldData } as RecommendedField;
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError("Failed to update recommended field");
    }
  }

  /**
   * Delete a recommended field
   * DELETE /system-settings/recommended-fields/{fieldName}
   */
  async deleteRecommendedField(fieldName: string): Promise<void> {
    try {
      const encodedFieldName = encodeURIComponent(fieldName);
      await fetchWithAuth(
        `/system-settings/recommended-fields/${encodedFieldName}`,
        {
          method: "DELETE",
        }
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError("Failed to delete recommended field");
    }
  }
}

export const recommendedFieldsService = new RecommendedFieldsService();
