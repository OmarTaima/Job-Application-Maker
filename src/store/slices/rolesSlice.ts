import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { rolesService } from "../../services/rolesService";

export interface Permission {
  _id: string;
  name: string;
  description?: string;
  actions?: string[];
  createdAt?: string;
  __v?: number;
}

export interface Role {
  _id: string;
  name: string;
  description: string;
  permissions?: string[];
  permissionsCount?: number;
  usersCount?: number;
  createdAt?: string;
  __v?: number;
}

export interface CreateRoleRequest {
  name: string;
  description: string;
  permissions: {
    permission: string;
    access: string[];
  }[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: {
    permission: string;
    access: string[];
  }[];
}

interface RolesState {
  roles: Role[];
  permissions: Permission[];
  currentRole: Role | null;
  loading: boolean;
  error: string | null;
  isFetched: boolean;
}

const initialState: RolesState = {
  roles: [],
  permissions: [],
  currentRole: null,
  loading: false,
  error: null,
  isFetched: false,
};

// Async thunks
export const fetchRoles = createAsyncThunk(
  "roles/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      return await rolesService.getAllRoles();
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch roles");
    }
  }
);

export const fetchPermissions = createAsyncThunk(
  "roles/fetchPermissions",
  async (_, { rejectWithValue }) => {
    try {
      return await rolesService.getAllPermissions();
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch permissions");
    }
  }
);

export const createRole = createAsyncThunk(
  "roles/create",
  async (roleData: CreateRoleRequest, { rejectWithValue }) => {
    try {
      return await rolesService.createRole(roleData);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to create role");
    }
  }
);

export const updateRole = createAsyncThunk(
  "roles/update",
  async (
    { id, data }: { id: string; data: UpdateRoleRequest },
    { rejectWithValue }
  ) => {
    try {
      return await rolesService.updateRole(id, data);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to update role");
    }
  }
);

export const deleteRole = createAsyncThunk(
  "roles/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      await rolesService.deleteRole(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to delete role");
    }
  }
);

// Slice
const rolesSlice = createSlice({
  name: "roles",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentRole: (state) => {
      state.currentRole = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action: PayloadAction<Role[]>) => {
        state.loading = false;
        state.roles = action.payload;
        state.isFetched = true;
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(
        fetchPermissions.fulfilled,
        (state, action: PayloadAction<Permission[]>) => {
          state.permissions = action.payload;
        }
      )
      .addCase(createRole.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createRole.fulfilled, (state, action: PayloadAction<Role>) => {
        state.loading = false;
        state.roles.push(action.payload);
      })
      .addCase(createRole.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateRole.fulfilled, (state, action: PayloadAction<Role>) => {
        const index = state.roles.findIndex(
          (r) => r._id === action.payload._id
        );
        if (index !== -1) {
          state.roles[index] = action.payload;
        }
        if (state.currentRole?._id === action.payload._id) {
          state.currentRole = action.payload;
        }
      })
      .addCase(deleteRole.fulfilled, (state, action: PayloadAction<string>) => {
        state.roles = state.roles.filter((r) => r._id !== action.payload);
      });
  },
});

export const { clearError, clearCurrentRole } = rolesSlice.actions;
export default rolesSlice.reducer;
