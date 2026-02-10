import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { companiesService } from "../../services/companiesService";

export interface Company {
  _id: string;
  name: string | { en: string; ar: string };
  address?: string | Array<{ en: string; ar: string; location: string }>;
  industry?: string;
  contactEmail?: string;
  phone?: string;
  website?: string;
  logoPath?: string;
  isActive?: boolean;
  description?: string | { en: string; ar: string };
  createdAt?: string;
  __v?: number;
}

export interface CreateCompanyRequest {
  name: { en: string; ar: string };
  description?: { en: string; ar: string };
  contactEmail: string;
  phone?: string;
  address?: Array<{ en: string; ar: string; location: string }>;
  website?: string;
  logoPath?: string;
}

export interface UpdateCompanyRequest {
  name?: { en: string; ar: string };
  description?: { en: string; ar: string };
  contactEmail?: string;
  phone?: string;
  address?: Array<{ en: string; ar: string; location: string }>;
  website?: string;
  logoPath?: string;
  isActive?: boolean;
}

interface CompaniesState {
  companies: Company[];
  currentCompany: Company | null;
  loading: boolean;
  error: string | null;
  isFetched: boolean;
}

const initialState: CompaniesState = {
  companies: [],
  currentCompany: null,
  loading: false,
  error: null,
  isFetched: false,
};

// Async thunks
export const fetchCompanies = createAsyncThunk(
  "companies/fetchAll",
  async (_companyIds: string[] | undefined, { rejectWithValue }) => {
    try {
      return await companiesService.getAllCompanies();
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch companies");
    }
  }
);

export const fetchCompanyById = createAsyncThunk(
  "companies/fetchById",
  async (id: string, { rejectWithValue }) => {
    try {
      return await companiesService.getCompanyById(id);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch company");
    }
  }
);

export const createCompany = createAsyncThunk(
  "companies/create",
  async (companyData: CreateCompanyRequest, { rejectWithValue }) => {
    try {
      return await companiesService.createCompany(companyData);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to create company");
    }
  }
);

export const updateCompany = createAsyncThunk(
  "companies/update",
  async (
    { id, data }: { id: string; data: UpdateCompanyRequest },
    { rejectWithValue }
  ) => {
    try {
      return await companiesService.updateCompany(id, data);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to update company");
    }
  }
);

export const deleteCompany = createAsyncThunk(
  "companies/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      await companiesService.deleteCompany(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to delete company");
    }
  }
);

// Slice
const companiesSlice = createSlice({
  name: "companies",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentCompany: (state) => {
      state.currentCompany = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanies.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchCompanies.fulfilled,
        (state, action: PayloadAction<Company[]>) => {
          state.loading = false;
          state.companies = action.payload;
          state.isFetched = true;
        }
      )
      .addCase(fetchCompanies.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchCompanyById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchCompanyById.fulfilled,
        (state, action: PayloadAction<Company>) => {
          state.loading = false;
          state.currentCompany = action.payload;
        }
      )
      .addCase(fetchCompanyById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createCompany.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        createCompany.fulfilled,
        (state, action: PayloadAction<Company>) => {
          state.loading = false;
          state.companies.push(action.payload);
        }
      )
      .addCase(createCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(
        updateCompany.fulfilled,
        (state, action: PayloadAction<Company>) => {
          const index = state.companies.findIndex(
            (c) => c._id === action.payload._id
          );
          if (index !== -1) {
            state.companies[index] = action.payload;
          }
          if (state.currentCompany?._id === action.payload._id) {
            state.currentCompany = action.payload;
          }
        }
      )
      .addCase(
        deleteCompany.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.companies = state.companies.filter(
            (c) => c._id !== action.payload
          );
        }
      );
  },
});

export const { clearError, clearCurrentCompany } = companiesSlice.actions;
export default companiesSlice.reducer;
