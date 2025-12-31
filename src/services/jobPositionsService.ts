import { API_CONFIG, tokenStorage } from "../config/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Helper function to make authenticated requests
async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = tokenStorage.getAccessToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  return response;
}

export type JobPosition = {
  _id: string;
  title: string;
  description: string;
  departmentId: string;
  companyId: string;
  jobCode?: string;
  requirements?: string[];
  termsAndConditions?: string[];
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  salaryVisible?: boolean;
  location?: string;
  employmentType?: string;
  status: "open" | "closed" | "archived";
  openPositions?: number;
  registrationStart?: string;
  registrationEnd?: string;
  jobSpecs?: Array<{
    spec: string;
    weight: number;
  }>;
  customFields?: Array<{
    fieldId: string;
    label: string;
    inputType: string;
    isRequired: boolean;
    minValue?: number;
    maxValue?: number;
    choices?: string[];
    subFields?: any[];
    displayOrder: number;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateJobPositionRequest = {
  title: string;
  description: string;
  departmentId: string;
  companyId: string;
  jobCode?: string;
  requirements?: string[];
  termsAndConditions?: string[];
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  salaryVisible?: boolean;
  location?: string;
  employmentType?: string;
  status?: "open" | "closed" | "archived";
  openPositions?: number;
  registrationStart?: string;
  registrationEnd?: string;
  jobSpecs?: Array<{
    spec: string;
    weight: number;
  }>;
  customFields?: Array<{
    fieldId: string;
    label: string;
    inputType: string;
    isRequired: boolean;
    minValue?: number;
    maxValue?: number;
    choices?: string[];
    subFields?: any[];
    displayOrder: number;
  }>;
};

export type UpdateJobPositionRequest = Partial<CreateJobPositionRequest>;

export type Applicant = {
  _id: string;
  jobPositionId: string;
  userId?: string;
  name: string;
  email: string;
  phone?: string;
  resume?: string;
  coverLetter?: string;
  customFieldResponses?: Record<string, any>;
  status: "pending" | "reviewed" | "shortlisted" | "rejected" | "hired";
  appliedAt: string;
  reviewedAt?: string;
};

class JobPositionsService {
  /**
   * Get all job positions
   */
  async getAllJobPositions(): Promise<JobPosition[]> {
    try {
      const response = await fetchWithAuth("/job-positions");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to fetch job positions",
          response.status,
          errorData.details
        );
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while fetching job positions");
    }
  }

  /**
   * Get a single job position by ID
   */
  async getJobPositionById(jobPositionId: string): Promise<JobPosition> {
    try {
      const response = await fetchWithAuth(`/job-positions/${jobPositionId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to fetch job position",
          response.status,
          errorData.details
        );
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while fetching job position");
    }
  }

  /**
   * Create a new job position
   */
  async createJobPosition(
    data: CreateJobPositionRequest
  ): Promise<JobPosition> {
    try {
      // Build payload with only non-empty fields
      const payload: any = {
        title: data.title,
        description: data.description,
        departmentId: data.departmentId,
        companyId: data.companyId,
      };

      if (data.jobCode) payload.jobCode = data.jobCode;
      if (data.requirements && data.requirements.length > 0)
        payload.requirements = data.requirements;
      if (data.termsAndConditions && data.termsAndConditions.length > 0)
        payload.termsAndConditions = data.termsAndConditions;
      if (data.salary) payload.salary = data.salary;
      if (data.salaryVisible !== undefined)
        payload.salaryVisible = data.salaryVisible;
      if (data.location) payload.location = data.location;
      if (data.employmentType) payload.employmentType = data.employmentType;
      if (data.status) payload.status = data.status;
      if (data.openPositions) payload.openPositions = data.openPositions;
      if (data.registrationStart)
        payload.registrationStart = data.registrationStart;
      if (data.registrationEnd) payload.registrationEnd = data.registrationEnd;
      if (data.jobSpecs && data.jobSpecs.length > 0)
        payload.jobSpecs = data.jobSpecs;
      if (data.customFields && data.customFields.length > 0)
        payload.customFields = data.customFields;

      const response = await fetchWithAuth("/job-positions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to create job position",
          response.status,
          errorData.details
        );
      }

      const responseData = await response.json();
      return responseData.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while creating job position");
    }
  }

  /**
   * Update a job position
   */
  async updateJobPosition(
    jobPositionId: string,
    data: UpdateJobPositionRequest
  ): Promise<JobPosition> {
    try {
      // Build payload with only provided fields
      const payload: any = {};

      if (data.title) payload.title = data.title;
      if (data.description) payload.description = data.description;
      if (data.departmentId) payload.departmentId = data.departmentId;
      if (data.companyId) payload.companyId = data.companyId;
      if (data.jobCode) payload.jobCode = data.jobCode;
      if (data.requirements) payload.requirements = data.requirements;
      if (data.termsAndConditions)
        payload.termsAndConditions = data.termsAndConditions;
      if (data.salary) payload.salary = data.salary;
      if (data.salaryVisible !== undefined)
        payload.salaryVisible = data.salaryVisible;
      if (data.location) payload.location = data.location;
      if (data.employmentType) payload.employmentType = data.employmentType;
      if (data.status) payload.status = data.status;
      if (data.openPositions) payload.openPositions = data.openPositions;
      if (data.registrationStart)
        payload.registrationStart = data.registrationStart;
      if (data.registrationEnd) payload.registrationEnd = data.registrationEnd;
      if (data.jobSpecs) payload.jobSpecs = data.jobSpecs;
      if (data.customFields) payload.customFields = data.customFields;

      const response = await fetchWithAuth(`/job-positions/${jobPositionId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to update job position",
          response.status,
          errorData.details
        );
      }

      const responseData = await response.json();
      return responseData.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while updating job position");
    }
  }

  /**
   * Delete a job position
   */
  async deleteJobPosition(jobPositionId: string): Promise<void> {
    try {
      const response = await fetchWithAuth(`/job-positions/${jobPositionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to delete job position",
          response.status,
          errorData.details
        );
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while deleting job position");
    }
  }

  /**
   * Get applicants for a job position
   */
  async getApplicantsForPosition(jobPositionId: string): Promise<Applicant[]> {
    try {
      const response = await fetchWithAuth(
        `/job-positions/${jobPositionId}/applicants`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to fetch applicants",
          response.status,
          errorData.details
        );
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while fetching applicants");
    }
  }

  /**
   * Clone a job position
   */
  async cloneJobPosition(jobPositionId: string): Promise<JobPosition> {
    try {
      const response = await fetchWithAuth(
        `/job-positions/${jobPositionId}/clone`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to clone job position",
          response.status,
          errorData.details
        );
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while cloning job position");
    }
  }
}

export const jobPositionsService = new JobPositionsService();
