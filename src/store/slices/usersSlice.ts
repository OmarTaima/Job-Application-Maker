import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { usersService } from "../../services/usersService";

export interface User {
  _id: string;
  fullName?: string;
  name?: string;
  email: string;
  roleId?: string | { _id: string; name: string };
  phone?: string;
  department?: string;
  isActive?: boolean;
  permissions?: Array<{ _id: string; name: string; access?: string[] }>;
  companies?: {
    companyId: string;
    role?: string;
    accessLevel?: string;
    departments?: string[];
  }[];
  createdAt?: string;
  __v?: number;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  password: string;
  roleId: string;
  phone?: string;
  companies?: Array<{
    companyId: string;
    departments: string[];
    isPrimary: boolean;
  }>;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
  phone?: string;
  department?: string;
}

interface UsersState {
  users: User[];
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  isFetched: boolean;
}

const initialState: UsersState = {
  users: [],
  currentUser: null,
  loading: false,
  error: null,
  isFetched: false,
};

// Async thunks
export const fetchUsers = createAsyncThunk(
  "users/fetchAll",
  async (companyIds: string[] | undefined, { rejectWithValue }) => {
    try {
      return await usersService.getAllUsers(companyIds);
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

// Slice
const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentUser: (state) => {
      state.currentUser = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action: PayloadAction<User[]>) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchUserById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchUserById.fulfilled,
        (state, action: PayloadAction<User>) => {
          state.loading = false;
          state.currentUser = action.payload;
          state.isFetched = true;
        }
      )
      .addCase(fetchUserById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.users.push(action.payload);
      })
      .addCase(createUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateUser.fulfilled, (state, action: PayloadAction<User>) => {
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
      .addCase(deleteUser.fulfilled, (state, action: PayloadAction<string>) => {
        state.users = state.users.filter((u) => u._id !== action.payload);
      })
      .addCase(
        updateUserCompanies.fulfilled,
        (state, action: PayloadAction<User>) => {
          const index = state.users.findIndex(
            (u) => u._id === action.payload._id
          );
          if (index !== -1) {
            state.users[index] = action.payload;
          }
          if (state.currentUser?._id === action.payload._id) {
            state.currentUser = action.payload;
          }
        }
      );
  },
});

export const { clearError, clearCurrentUser } = usersSlice.actions;
export default usersSlice.reducer;
