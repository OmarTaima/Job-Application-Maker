// store/slices/companiesSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { companiesService } from "../../services/companiesService";
import type {
  InterviewSettings,
  MailSettings,
  CompanyStatus,
} from "../../types/companies";
import type {
  Company,
  CreateCompanyRequest,
  UpdateCompanyRequest,
} from '../../types/companies';

interface CompaniesState {
  companies: Company[];
  currentCompany: Company | null;
  interviewSettings: InterviewSettings | null;
  mailSettings: MailSettings | null;
  companyStatuses: CompanyStatus[];
  loading: boolean;
  error: string | null;
  isFetched: boolean;
}

const initialState: CompaniesState = {
  companies: [],
  currentCompany: null,
  interviewSettings: null,
  mailSettings: null,
  companyStatuses: [],
  loading: false,
  error: null,
  isFetched: false,
};

// Async thunks for companies
export const fetchCompanies = createAsyncThunk(
  "companies/fetchAll",
  async (companyId?: string[]) => {
    return await companiesService.getAllCompanies(companyId);
  }
);

export const fetchCompanyById = createAsyncThunk(
  "companies/fetchById",
  async (id: string) => {
    return await companiesService.getCompanyById(id);
  }
);

export const createCompany = createAsyncThunk(
  "companies/create",
  async (companyData: CreateCompanyRequest) => {
    return await companiesService.createCompany(companyData);
  }
);

export const updateCompany = createAsyncThunk(
  "companies/update",
  async ({ id, data }: { id: string; data: UpdateCompanyRequest }) => {
    return await companiesService.updateCompany(id, data);
  }
);

export const deleteCompany = createAsyncThunk(
  "companies/delete",
  async (id: string) => {
    await companiesService.deleteCompany(id);
    return id;
  }
);

// Interview settings thunks
export const fetchInterviewSettings = createAsyncThunk(
  "companies/fetchInterviewSettings",
  async (companyId: string) => {
    const company = await companiesService.getCompanyById(companyId);
    // Navigate through the correct path: company.settings.interviewSettings
    return (company as any)?.settings?.interviewSettings ?? null;
  }
);

export const updateInterviewSettings = createAsyncThunk(
  "companies/updateInterviewSettings",
  async ({ companyId, data }: { companyId: string; data: { interviewSettings: { groups: any[] } } }) => {
    return await companiesService.updateCompanyInterviewSettings(companyId, data);
  }
);

// Mail settings thunks
export const fetchMailSettings = createAsyncThunk(
  "companies/fetchMailSettings",
  async (companyId: string) => {
    return await companiesService.getMailSettings(companyId);
  }
);

export const updateMailSettings = createAsyncThunk(
  "companies/updateMailSettings",
  async ({ companyId, data }: { companyId: string; data: Partial<MailSettings> }) => {
    return await companiesService.updateMailSettings(companyId, data);
  }
);

// Company statuses thunks
export const fetchCompanyStatuses = createAsyncThunk(
  "companies/fetchStatuses",
  async (companyId: string) => {
    return await companiesService.getCompanyStatuses(companyId);
  }
);

export const updateCompanyStatuses = createAsyncThunk(
  "companies/updateStatuses",
  async ({ companyId, data }: { companyId: string; data: CompanyStatus[] }) => {
    return await companiesService.updateCompanyStatuses(companyId, data);
  }
);

// Rejection reasons thunks
export const updateRejectionReasons = createAsyncThunk(
  "companies/updateRejectionReasons",
  async ({ companyId, data }: { companyId: string; data: { rejectReasons: string[] } }) => {
    return await companiesService.updateCompanyRejectionReasons(companyId, data);
  }
);

// Applicant pages thunks
export const updateApplicantPages = createAsyncThunk(
  "companies/updateApplicantPages",
  async ({ settingsId, data }: { settingsId: string; data: { applicantPages: any[] } }) => {
    return await companiesService.updateCompanyApplicantPages(settingsId, data);
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
    clearCompanies: (state) => {
      state.companies = [];
      state.isFetched = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Companies
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
        state.error = action.error.message || "Failed to fetch companies";
      })
      // Fetch Company By ID
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
        state.error = action.error.message || "Failed to fetch company";
      })
      // Create Company
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
        state.error = action.error.message || "Failed to create company";
      })
      // Update Company
      .addCase(updateCompany.fulfilled, (state, action: PayloadAction<Company>) => {
        const index = state.companies.findIndex(
          (c) => c._id === action.payload._id
        );
        if (index !== -1) {
          state.companies[index] = action.payload;
        }
        if (state.currentCompany?._id === action.payload._id) {
          state.currentCompany = action.payload;
        }
        state.loading = false;
      })
      .addCase(updateCompany.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to update company";
      })
      // Delete Company
      .addCase(deleteCompany.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false;
        state.companies = state.companies.filter(
          (c) => c._id !== action.payload
        );
      })
      .addCase(deleteCompany.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to delete company";
      })
      // Interview Settings
      .addCase(fetchInterviewSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchInterviewSettings.fulfilled,
        (state, action: PayloadAction<InterviewSettings | null>) => {
          state.loading = false;
          state.interviewSettings = action.payload;
        }
      )
      .addCase(fetchInterviewSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch interview settings";
      })
      .addCase(updateInterviewSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        updateInterviewSettings.fulfilled,
        (state, action: PayloadAction<InterviewSettings>) => {
          state.loading = false;
          state.interviewSettings = action.payload;
        }
      )
      .addCase(updateInterviewSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to update interview settings";
      })
      // Mail Settings
      .addCase(fetchMailSettings.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMailSettings.fulfilled, (state, action: PayloadAction<MailSettings | null>) => {
        state.loading = false;
        state.mailSettings = action.payload;
      })
      .addCase(updateMailSettings.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateMailSettings.fulfilled, (state, action: PayloadAction<MailSettings>) => {
        state.loading = false;
        state.mailSettings = action.payload;
      })
      // Company Statuses
      .addCase(fetchCompanyStatuses.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCompanyStatuses.fulfilled, (state, action: PayloadAction<CompanyStatus[]>) => {
        state.loading = false;
        state.companyStatuses = action.payload;
      })
      .addCase(updateCompanyStatuses.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateCompanyStatuses.fulfilled, (state, action: PayloadAction<CompanyStatus[]>) => {
        state.loading = false;
        state.companyStatuses = action.payload;
      });
  },
});

export const { 
  clearError, 
  clearCurrentCompany, 
  clearCompanies,
  setLoading,
  setError 
} = companiesSlice.actions;

export default companiesSlice.reducer;