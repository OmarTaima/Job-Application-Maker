import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";

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

export type BilingualString = { en: string; ar?: string };

export type BilingualChoice = { en: string; ar?: string };

export type SavedField = {
  fieldId: string;
  label: BilingualString | string;
  inputType: FieldType;
  defaultValue?: string;
  minValue?: number;
  maxValue?: number;
  isRequired?: boolean;
  choices?: BilingualChoice[] | string[];
  groupFields?: SavedField[];
};

export type CreateSavedFieldRequest = {
  fieldId: string;
  label: BilingualString | string;
  inputType: FieldType;
  defaultValue?: string;
  minValue?: number;
  maxValue?: number;
  isRequired?: boolean;
  choices?: BilingualChoice[] | string[];
  groupFields?: any[];
};

export type UpdateSavedFieldRequest = Partial<CreateSavedFieldRequest>;

class SavedFieldsService {
  async getAllSavedFields(): Promise<SavedField[]> {
    try {
      const res = await axios.get("/users/me/saved-fields");
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
      const res = await axios.post("/users/me/saved-fields", data);
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
      const res = await axios.put(`/users/me/saved-fields/${encoded}`, data);
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
      await axios.delete(`/users/me/saved-fields/${encoded}`);
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }
}

export const savedFieldsService = new SavedFieldsService();
