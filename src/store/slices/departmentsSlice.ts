import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { departmentsService } from "../../services/departmentsService";

export interface Department {
  _id: string;
  name: string;
  companyId: string | { _id: string; name: string };
  description?: string;
  createdAt?: string;
  __v?: number;
}

export interface CreateDepartmentRequest {
  name: string;
  companyId: string;
  description?: string;
}

export interface UpdateDepartmentRequest {
  name?: string;
  companyId?: string;
  description?: string;
}

interface DepartmentsState {
  departments: Department[];
  currentDepartment: Department | null;
  loading: boolean;
  error: string | null;
  isFetched: boolean;
}

const initialState: DepartmentsState = {
  departments: [],
  currentDepartment: null,
  loading: false,
  error: null,
  isFetched: false,
};

// Async thunks
export const fetchDepartments = createAsyncThunk(
  "departments/fetchAll",
  async (companyIds: string[] | undefined, { rejectWithValue }) => {
    try {
      const companyId =
        companyIds && companyIds.length > 0 ? companyIds[0] : undefined;
      return await departmentsService.getAllDepartments(companyId);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch departments");
    }
  }
);

export const fetchDepartmentById = createAsyncThunk(
  "departments/fetchById",
  async (id: string, { rejectWithValue }) => {
    try {
      return await departmentsService.getDepartmentById(id);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch department");
    }
  }
);

export const createDepartment = createAsyncThunk(
  "departments/create",
  async (departmentData: CreateDepartmentRequest, { rejectWithValue }) => {
    try {
      return await departmentsService.createDepartment(departmentData);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to create department");
    }
  }
);

export const updateDepartment = createAsyncThunk(
  "departments/update",
  async (
    { id, data }: { id: string; data: UpdateDepartmentRequest },
    { rejectWithValue }
  ) => {
    try {
      return await departmentsService.updateDepartment(id, data);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to update department");
    }
  }
);

export const deleteDepartment = createAsyncThunk(
  "departments/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      await departmentsService.deleteDepartment(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to delete department");
    }
  }
);

// Slice
const departmentsSlice = createSlice({
  name: "departments",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentDepartment: (state) => {
      state.currentDepartment = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDepartments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchDepartments.fulfilled,
        (state, action: PayloadAction<Department[]>) => {
          state.loading = false;
          state.departments = action.payload;
          state.isFetched = true;
        }
      )
      .addCase(fetchDepartments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchDepartmentById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchDepartmentById.fulfilled,
        (state, action: PayloadAction<Department>) => {
          state.loading = false;
          state.currentDepartment = action.payload;
        }
      )
      .addCase(fetchDepartmentById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createDepartment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        createDepartment.fulfilled,
        (state, action: PayloadAction<Department>) => {
          state.loading = false;
          state.departments.push(action.payload);
        }
      )
      .addCase(createDepartment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(
        updateDepartment.fulfilled,
        (state, action: PayloadAction<Department>) => {
          const index = state.departments.findIndex(
            (d) => d._id === action.payload._id
          );
          if (index !== -1) {
            state.departments[index] = action.payload;
          }
          if (state.currentDepartment?._id === action.payload._id) {
            state.currentDepartment = action.payload;
          }
        }
      )
      .addCase(
        deleteDepartment.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.departments = state.departments.filter(
            (d) => d._id !== action.payload
          );
        }
      );
  },
});

export const { clearError, clearCurrentDepartment } = departmentsSlice.actions;
export default departmentsSlice.reducer;
