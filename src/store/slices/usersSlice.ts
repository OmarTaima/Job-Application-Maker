// store/slices/usersSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { usersService, savedFieldsService } from "../../services/usersService";
import type { UsersResponse } from "../../services/usersService";
import type { CreateUserRequest, UpdateUserRequest, User } from '../../types/users';
import type {
  CreateSavedFieldRequest,
  SavedField,
  UpdateSavedFieldRequest,
} from '../../types/users';

// Users State Interface
interface UsersState {
  users: User[];
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  isFetched: boolean;
}

// Saved Fields State Interface
interface SavedFieldsState {
  fields: SavedField[];
  currentField: SavedField | null;
  loading: boolean;
  error: string | null;
  isFetched: boolean;
}

// Initial States
const initialUsersState: UsersState = {
  users: [],
  currentUser: null,
  loading: false,
  error: null,
  isFetched: false,
};

const initialSavedFieldsState: SavedFieldsState = {
  fields: [],
  currentField: null,
  loading: false,
  error: null,
  isFetched: false,
};

// ==================== USERS THUNKS ====================
export const fetchUsers = createAsyncThunk(
  "users/fetchAll",
  async (companyIds: string[] | undefined, { rejectWithValue }) => {
    try {
      // Pass companyIds as an object with companies property
      const response = await usersService.getAllUsers({ companies: companyIds });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch users");
    }
  }
);

export const fetchUserById = createAsyncThunk(
  "users/fetchById",
  async (id: string, { rejectWithValue }) => {
    try {
      return await usersService.getUserById(id);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch user");
    }
  }
);

export const createUser = createAsyncThunk(
  "users/create",
  async (userData: CreateUserRequest, { rejectWithValue }) => {
    try {
      return await usersService.createUser(userData);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to create user");
    }
  }
);

export const updateUser = createAsyncThunk(
  "users/update",
  async (
    { id, data }: { id: string; data: UpdateUserRequest },
    { rejectWithValue }
  ) => {
    try {
      return await usersService.updateUser(id, data);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to update user");
    }
  }
);

export const deleteUser = createAsyncThunk(
  "users/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      await usersService.deleteUser(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to delete user");
    }
  }
);

export const updateUserCompanies = createAsyncThunk(
  "users/updateCompanies",
  async (
    {
      userId,
      companyId,
      departments,
    }: { userId: string; companyId: string; departments: string[] },
    { rejectWithValue }
  ) => {
    try {
      return await usersService.updateCompanyDepartments(userId, companyId, {
        departments,
      });
    } catch (error: any) {
      return rejectWithValue(
        error.message || "Failed to update user companies"
      );
    }
  }
);

// ==================== SAVED FIELDS THUNKS ====================
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

// ==================== USERS SLICE ====================
const usersSlice = createSlice({
  name: "users",
  initialState: initialUsersState,
  reducers: {
    clearUsersError: (state) => {
      state.error = null;
    },
    clearCurrentUser: (state) => {
      state.currentUser = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Users
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        if (Array.isArray(payload)) {
          state.users = payload;
        } else if (payload && Array.isArray((payload as UsersResponse).data)) {
          state.users = (payload as UsersResponse).data;
        } else {
          state.users = [];
        }
        state.isFetched = true;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch User By ID
      .addCase(fetchUserById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload;
        state.isFetched = true;
      })
      .addCase(fetchUserById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create User
      .addCase(createUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users.push(action.payload);
      })
      .addCase(createUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update User
      .addCase(updateUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.users.findIndex(
          (u) => u._id === action.payload._id
        );
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.currentUser?._id === action.payload._id) {
          state.currentUser = action.payload;
        }
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Delete User
      .addCase(deleteUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users = state.users.filter((u) => u._id !== action.payload);
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update User Companies
      .addCase(updateUserCompanies.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUserCompanies.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.users.findIndex(
          (u) => u._id === action.payload._id
        );
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.currentUser?._id === action.payload._id) {
          state.currentUser = action.payload;
        }
      })
      .addCase(updateUserCompanies.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// ==================== SAVED FIELDS SLICE ====================
const savedFieldsSlice = createSlice({
  name: "savedFields",
  initialState: initialSavedFieldsState,
  reducers: {
    clearSavedFieldsError: (state) => {
      state.error = null;
    },
    clearCurrentField: (state) => {
      state.currentField = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Saved Fields
      .addCase(fetchSavedFields.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSavedFields.fulfilled, (state, action: PayloadAction<SavedField[]>) => {
        state.loading = false;
        state.fields = action.payload;
        state.isFetched = true;
      })
      .addCase(fetchSavedFields.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create Saved Field
      .addCase(createSavedField.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createSavedField.fulfilled, (state, action: PayloadAction<SavedField>) => {
        state.loading = false;
        state.fields.push(action.payload);
      })
      .addCase(createSavedField.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update Saved Field
      .addCase(updateSavedField.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateSavedField.fulfilled, (state, action: PayloadAction<SavedField>) => {
        state.loading = false;
        const idx = state.fields.findIndex(
          (f: SavedField) => f.fieldId === action.payload.fieldId
        );
        if (idx !== -1) {
          state.fields[idx] = action.payload;
        }
        if (state.currentField?.fieldId === action.payload.fieldId) {
          state.currentField = action.payload;
        }
      })
      .addCase(updateSavedField.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Delete Saved Field
      .addCase(deleteSavedField.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteSavedField.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false;
        state.fields = state.fields.filter((f: SavedField) => f.fieldId !== action.payload);
      })
      .addCase(deleteSavedField.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// ==================== EXPORTS ====================
// Users Exports
export const { clearUsersError, clearCurrentUser } = usersSlice.actions;
export const usersReducer = usersSlice.reducer;
export default usersSlice.reducer;

// Saved Fields Exports
export const { clearSavedFieldsError, clearCurrentField } = savedFieldsSlice.actions;
export const savedFieldsReducer = savedFieldsSlice.reducer;

// Combined export for convenience
export const combinedReducers = {
  users: usersReducer,
  savedFields: savedFieldsReducer,
};