import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { applicantsService } from "../../services/applicantsService";
import type {
  Applicant,
  Comment,
  CreateApplicantRequest,
  Interview,
  Message,
  UpdateApplicantRequest,
  UpdateStatusRequest,
} from '../../types/applicants';

interface ApplicantsState {
  applicants: Applicant[];
  currentApplicant: Applicant | null;
  loading: boolean;
  error: string | null;
  isFetched: boolean;
  lastFetchedcompanyId?: string[] | undefined;
}

const initialState: ApplicantsState = {
  applicants: [],
  currentApplicant: null,
  loading: false,
  error: null,
  isFetched: false,
  lastFetchedcompanyId: undefined,
};

// Async thunks
export const fetchApplicants = createAsyncThunk(
  "applicants/fetchAll",
  async (companyId: string[] | undefined, { rejectWithValue }) => {
    try {
      return await applicantsService.getAllApplicants(companyId);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch applicants");
    }
  }
);

export const fetchApplicantById = createAsyncThunk(
  "applicants/fetchById",
  async (id: string, { rejectWithValue }) => {
    try {
      return await applicantsService.getApplicantById(id);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch applicant");
    }
  }
);

export const createApplicant = createAsyncThunk(
  "applicants/create",
  async (applicantData: CreateApplicantRequest, { rejectWithValue }) => {
    try {
      return await applicantsService.createApplicant(applicantData);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to create applicant");
    }
  }
);

export const updateApplicant = createAsyncThunk(
  "applicants/update",
  async (
    { id, data }: { id: string; data: UpdateApplicantRequest },
    { rejectWithValue }
  ) => {
    try {
      return await applicantsService.updateApplicant(id, data);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to update applicant");
    }
  }
);

export const updateApplicantStatus = createAsyncThunk(
  "applicants/updateStatus",
  async (
    { id, data }: { id: string; data: UpdateStatusRequest },
    { rejectWithValue }
  ) => {
    try {
      return await applicantsService.updateApplicantStatus(id, data);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to update status");
    }
  }
);

export const deleteApplicant = createAsyncThunk(
  "applicants/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      await applicantsService.deleteApplicant(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to delete applicant");
    }
  }
);

export const addInterview = createAsyncThunk(
  "applicants/addInterview",
  async (
    { id, interview }: { id: string; interview: Omit<Interview, "_id"> },
    { rejectWithValue }
  ) => {
    try {
      return await applicantsService.scheduleInterview(id, interview);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to add interview");
    }
  }
);

export const addMessage = createAsyncThunk(
  "applicants/addMessage",
  async (
    { id, message }: { id: string; message: Omit<Message, "_id"> },
    { rejectWithValue }
  ) => {
    try {
      return await applicantsService.sendMessage(id, message);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to send message");
    }
  }
);

export const addComment = createAsyncThunk(
  "applicants/addComment",
  async (
    { id, comment }: { id: string; comment: Omit<Comment, "_id"> },
    { rejectWithValue }
  ) => {
    try {
      return await applicantsService.addComment(id, comment);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to add comment");
    }
  }
);

// Slice
const applicantsSlice = createSlice({
  name: "applicants",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentApplicant: (state) => {
      state.currentApplicant = null;
    },
    // Optimistic updates
    optimisticUpdateStatus: (
      state,
      action: PayloadAction<{ id: string; status: Applicant["status"] }>
    ) => {
      const index = state.applicants.findIndex(
        (a) => a._id === action.payload.id
      );
      if (index !== -1) {
        state.applicants[index].status = action.payload.status;
      }
      if (state.currentApplicant?._id === action.payload.id) {
        state.currentApplicant.status = action.payload.status;
      }
    },
    optimisticUpdateApplicant: (state, action: PayloadAction<Applicant>) => {
      const index = state.applicants.findIndex(
        (a) => a._id === action.payload._id
      );
      if (index !== -1) {
        state.applicants[index] = action.payload;
      }
      if (state.currentApplicant?._id === action.payload._id) {
        state.currentApplicant = action.payload;
      }
    },
    optimisticAddInterview: (
      state,
      action: PayloadAction<{ id: string; interview: Interview }>
    ) => {
      const index = state.applicants.findIndex(
        (a) => a._id === action.payload.id
      );
      if (index !== -1) {
        if (!state.applicants[index].interviews) {
          state.applicants[index].interviews = [];
        }
        state.applicants[index].interviews!.push(action.payload.interview);
      }
      if (state.currentApplicant?._id === action.payload.id) {
        if (!state.currentApplicant.interviews) {
          state.currentApplicant.interviews = [];
        }
        state.currentApplicant.interviews.push(action.payload.interview);
      }
    },
    optimisticAddMessage: (
      state,
      action: PayloadAction<{ id: string; message: Message }>
    ) => {
      const index = state.applicants.findIndex(
        (a) => a._id === action.payload.id
      );
      if (index !== -1) {
        if (!state.applicants[index].messages) {
          state.applicants[index].messages = [];
        }
        state.applicants[index].messages!.push(action.payload.message);
      }
      if (state.currentApplicant?._id === action.payload.id) {
        if (!state.currentApplicant.messages) {
          state.currentApplicant.messages = [];
        }
        state.currentApplicant.messages.push(action.payload.message);
      }
    },
    optimisticAddComment: (
      state,
      action: PayloadAction<{ id: string; comment: Comment }>
    ) => {
      const index = state.applicants.findIndex(
        (a) => a._id === action.payload.id
      );
      if (index !== -1) {
        if (!state.applicants[index].comments) {
          state.applicants[index].comments = [];
        }
        state.applicants[index].comments!.push(action.payload.comment);
      }
      if (state.currentApplicant?._id === action.payload.id) {
        if (!state.currentApplicant.comments) {
          state.currentApplicant.comments = [];
        }
        state.currentApplicant.comments.push(action.payload.comment);
      }
    },
    optimisticDeleteApplicant: (state, action: PayloadAction<string>) => {
      state.applicants = state.applicants.filter(
        (a) => a._id !== action.payload
      );
      if (state.currentApplicant?._id === action.payload) {
        state.currentApplicant = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all applicants
      .addCase(fetchApplicants.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchApplicants.fulfilled,
        (state, action: PayloadAction<Applicant[]>) => {
          state.loading = false;
          state.applicants = action.payload;
          state.isFetched = true;
          // Store the companyId used for this fetch (available on meta.arg)
          // action.meta.arg can be undefined or string[]
          // @ts-ignore - meta typing for createAsyncThunk arg
          state.lastFetchedcompanyId = action.meta?.arg as string[] | undefined;
        }
      )
      .addCase(fetchApplicants.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch applicant by ID
      .addCase(fetchApplicantById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchApplicantById.fulfilled,
        (state, action: PayloadAction<Applicant>) => {
          state.loading = false;
          state.currentApplicant = action.payload;
        }
      )
      .addCase(fetchApplicantById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create applicant
      .addCase(createApplicant.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        createApplicant.fulfilled,
        (state, action: PayloadAction<Applicant>) => {
          state.loading = false;
          state.applicants.push(action.payload);
        }
      )
      .addCase(createApplicant.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update applicant
      .addCase(
        updateApplicant.fulfilled,
        (state, action: PayloadAction<Applicant>) => {
          const index = state.applicants.findIndex(
            (a) => a._id === action.payload._id
          );
          if (index !== -1) {
            state.applicants[index] = action.payload;
          }
          if (state.currentApplicant?._id === action.payload._id) {
            state.currentApplicant = action.payload;
          }
        }
      )
      // Update status
      .addCase(
        updateApplicantStatus.fulfilled,
        (state, action: PayloadAction<Applicant>) => {
          const index = state.applicants.findIndex(
            (a) => a._id === action.payload._id
          );
          if (index !== -1) {
            state.applicants[index] = action.payload;
          }
          if (state.currentApplicant?._id === action.payload._id) {
            state.currentApplicant = action.payload;
          }
        }
      )
      // Delete applicant
      .addCase(
        deleteApplicant.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.applicants = state.applicants.filter(
            (a) => a._id !== action.payload
          );
        }
      )
      // Add interview
      .addCase(
        addInterview.fulfilled,
        (state, action: PayloadAction<Applicant>) => {
          const index = state.applicants.findIndex(
            (a) => a._id === action.payload._id
          );
          if (index !== -1) {
            state.applicants[index] = action.payload;
          }
          if (state.currentApplicant?._id === action.payload._id) {
            state.currentApplicant = action.payload;
          }
        }
      )
      // Add message
      .addCase(
        addMessage.fulfilled,
        (state, action: PayloadAction<Applicant>) => {
          const index = state.applicants.findIndex(
            (a) => a._id === action.payload._id
          );
          if (index !== -1) {
            state.applicants[index] = action.payload;
          }
          if (state.currentApplicant?._id === action.payload._id) {
            state.currentApplicant = action.payload;
          }
        }
      )
      // Add comment
      .addCase(
        addComment.fulfilled,
        (state, action: PayloadAction<Applicant>) => {
          const index = state.applicants.findIndex(
            (a) => a._id === action.payload._id
          );
          if (index !== -1) {
            state.applicants[index] = action.payload;
          }
          if (state.currentApplicant?._id === action.payload._id) {
            state.currentApplicant = action.payload;
          }
        }
      );
  },
});

export const {
  clearError,
  clearCurrentApplicant,
  optimisticUpdateStatus,
  optimisticUpdateApplicant,
  optimisticAddInterview,
  optimisticAddMessage,
  optimisticAddComment,
  optimisticDeleteApplicant,
} = applicantsSlice.actions;
export default applicantsSlice.reducer;
