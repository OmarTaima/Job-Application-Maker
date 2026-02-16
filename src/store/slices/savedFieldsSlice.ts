import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  savedFieldsService,
  SavedField,
  CreateSavedFieldRequest,
  UpdateSavedFieldRequest,
} from "../../services/savedFieldsService";

export type { SavedField, CreateSavedFieldRequest, UpdateSavedFieldRequest };

interface SavedFieldsState {
  fields: SavedField[];
  currentField: SavedField | null;
  loading: boolean;
  error: string | null;
  isFetched: boolean;
}

const initialState: SavedFieldsState = {
  fields: [],
  currentField: null,
  loading: false,
  error: null,
  isFetched: false,
};

export const fetchSavedFields = createAsyncThunk(
  "savedFields/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      return await savedFieldsService.getAllSavedFields();
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch saved fields");
    }
  }
);

export const createSavedField = createAsyncThunk(
  "savedFields/create",
  async (data: CreateSavedFieldRequest, { rejectWithValue }) => {
    try {
      return await savedFieldsService.createSavedField(data);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to create saved field");
    }
  }
);

export const updateSavedField = createAsyncThunk(
  "savedFields/update",
  async (
    { fieldId, data }: { fieldId: string; data: UpdateSavedFieldRequest },
    { rejectWithValue }
  ) => {
    try {
      return await savedFieldsService.updateSavedField(fieldId, data);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to update saved field");
    }
  }
);

export const deleteSavedField = createAsyncThunk(
  "savedFields/delete",
  async (fieldId: string, { rejectWithValue }) => {
    try {
      await savedFieldsService.deleteSavedField(fieldId);
      return fieldId;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to delete saved field");
    }
  }
);

const savedFieldsSlice = createSlice({
  name: "savedFields",
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
      .addCase(fetchSavedFields.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchSavedFields.fulfilled,
        (state, action: PayloadAction<SavedField[]>) => {
          state.loading = false;
          state.fields = action.payload;
          state.isFetched = true;
        }
      )
      .addCase(fetchSavedFields.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createSavedField.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        createSavedField.fulfilled,
        (state, action: PayloadAction<SavedField>) => {
          state.loading = false;
          state.fields.push(action.payload);
        }
      )
      .addCase(createSavedField.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(
        updateSavedField.fulfilled,
        (state, action: PayloadAction<SavedField>) => {
          const idx = state.fields.findIndex(
            (f) => f.fieldId === action.payload.fieldId
          );
          if (idx !== -1) state.fields[idx] = action.payload;
          if (state.currentField?.fieldId === action.payload.fieldId) {
            state.currentField = action.payload;
          }
        }
      )
      .addCase(
        deleteSavedField.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.fields = state.fields.filter((f) => f.fieldId !== action.payload);
        }
      );
  },
});

export const { clearError, clearCurrentField } = savedFieldsSlice.actions;
export default savedFieldsSlice.reducer;
