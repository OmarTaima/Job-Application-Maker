import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { jobPositionsService, JobPosition, CreateJobPositionRequest, UpdateJobPositionRequest } from "../../services/jobPositionsService";

export type { JobPosition, CreateJobPositionRequest, UpdateJobPositionRequest };

interface JobPositionsState {
  jobPositions: JobPosition[];
  currentJobPosition: JobPosition | null;
  loading: boolean;
  error: string | null;
  isFetched: boolean;
}

const initialState: JobPositionsState = {
  jobPositions: [],
  currentJobPosition: null,
  loading: false,
  error: null,
  isFetched: false,
};

// Async thunks
export const fetchJobPositions = createAsyncThunk(
  "jobPositions/fetchAll",
  async (companyIds: string[] | undefined, { rejectWithValue }) => {
    try {
      return await jobPositionsService.getAllJobPositions(companyIds);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch job positions");
    }
  }
);

export const fetchJobPositionById = createAsyncThunk(
  "jobPositions/fetchById",
  async (id: string, { rejectWithValue }) => {
    try {
      return await jobPositionsService.getJobPositionById(id);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch job position");
    }
  }
);

export const createJobPosition = createAsyncThunk(
  "jobPositions/create",
  async (jobData: CreateJobPositionRequest, { rejectWithValue }) => {
    try {
      return await jobPositionsService.createJobPosition(jobData);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to create job position");
    }
  }
);

export const updateJobPosition = createAsyncThunk(
  "jobPositions/update",
  async (
    { id, data }: { id: string; data: UpdateJobPositionRequest },
    { rejectWithValue }
  ) => {
    try {
      return await jobPositionsService.updateJobPosition(id, data);
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to update job position");
    }
  }
);

export const deleteJobPosition = createAsyncThunk(
  "jobPositions/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      await jobPositionsService.deleteJobPosition(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to delete job position");
    }
  }
);

// Slice
const jobPositionsSlice = createSlice({
  name: "jobPositions",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentJobPosition: (state) => {
      state.currentJobPosition = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchJobPositions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchJobPositions.fulfilled,
        (state, action: PayloadAction<JobPosition[]>) => {
          state.loading = false;
          state.jobPositions = action.payload;
          state.isFetched = true;
        }
      )
      .addCase(fetchJobPositions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchJobPositionById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchJobPositionById.fulfilled,
        (state, action: PayloadAction<JobPosition>) => {
          state.loading = false;
          state.currentJobPosition = action.payload;
        }
      )
      .addCase(fetchJobPositionById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createJobPosition.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        createJobPosition.fulfilled,
        (state, action: PayloadAction<JobPosition>) => {
          state.loading = false;
          state.jobPositions.push(action.payload);
        }
      )
      .addCase(createJobPosition.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(
        updateJobPosition.fulfilled,
        (state, action: PayloadAction<JobPosition>) => {
          const index = state.jobPositions.findIndex(
            (j) => j._id === action.payload._id
          );
          if (index !== -1) {
            state.jobPositions[index] = action.payload;
          }
          if (state.currentJobPosition?._id === action.payload._id) {
            state.currentJobPosition = action.payload;
          }
        }
      )
      .addCase(
        deleteJobPosition.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.jobPositions = state.jobPositions.filter(
            (j) => j._id !== action.payload
          );
        }
      );
  },
});

export const { clearError, clearCurrentJobPosition } =
  jobPositionsSlice.actions;
export default jobPositionsSlice.reducer;
