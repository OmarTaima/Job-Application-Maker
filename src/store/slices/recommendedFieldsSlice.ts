import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { recommendedFieldsService } from "../../services/recommendedFieldsService";

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
  _id?: string;
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

interface RecommendedFieldsState {
  fields: RecommendedField[];
  currentField: RecommendedField | null;
  loading: boolean;
  error: string | null;
  isFetched: boolean;
}

const initialState: RecommendedFieldsState = {
  fields: [],
  currentField: null,
  loading: false,
  error: null,
  isFetched: false,
};

// Async thunks
export const fetchRecommendedFields = createAsyncThunk(
  "recommendedFields/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      return await recommendedFieldsService.getAllRecommendedFields();
    } catch (error: any) {
      return rejectWithValue(
        error.message || "Failed to fetch recommended fields"
      );
    }
  }
);

export const createRecommendedField = createAsyncThunk(
  "recommendedFields/create",
  async (fieldData: CreateRecommendedFieldRequest, { rejectWithValue }) => {
    try {
      return await recommendedFieldsService.createRecommendedField(fieldData);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to create field");
    }
  }
);

export const updateRecommendedField = createAsyncThunk(
  "recommendedFields/update",
  async (
    { name, data }: { name: string; data: UpdateRecommendedFieldRequest },
    { rejectWithValue }
  ) => {
    try {
      return await recommendedFieldsService.updateRecommendedField(name, data);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to update field");
    }
  }
);

export const deleteRecommendedField = createAsyncThunk(
  "recommendedFields/delete",
  async (name: string, { rejectWithValue }) => {
    try {
      await recommendedFieldsService.deleteRecommendedField(name);
      return name;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to delete field");
    }
  }
);

// Slice
const recommendedFieldsSlice = createSlice({
  name: "recommendedFields",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentField: (state) => {
      state.currentField = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecommendedFields.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchRecommendedFields.fulfilled,
        (state, action: PayloadAction<RecommendedField[]>) => {
          state.loading = false;
          state.fields = action.payload;
          state.isFetched = true;
        }
      )
      .addCase(fetchRecommendedFields.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createRecommendedField.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        createRecommendedField.fulfilled,
        (state, action: PayloadAction<RecommendedField>) => {
          state.loading = false;
          state.fields.push(action.payload);
        }
      )
      .addCase(createRecommendedField.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(
        updateRecommendedField.fulfilled,
        (state, action: PayloadAction<RecommendedField>) => {
          const index = state.fields.findIndex(
            (f) => f.name === action.payload.name
          );
          if (index !== -1) {
            state.fields[index] = action.payload;
          }
          if (state.currentField?.name === action.payload.name) {
            state.currentField = action.payload;
          }
        }
      )
      .addCase(
        deleteRecommendedField.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.fields = state.fields.filter((f) => f.name !== action.payload);
        }
      );
  },
});

export const { clearError, clearCurrentField } = recommendedFieldsSlice.actions;
export default recommendedFieldsSlice.reducer;
