import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";
import { jobPositionsService } from "./jobPositionsService";

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

export type Interview = {
  _id?: string;
  issuedBy?: string;
  scheduledAt?: string;
  videoLink?: string;
  notes?: string;
  interviewers?: string[];
  type?: string;
  notifications?: {
    channels: {
      email: boolean;
      sms: boolean;
      whatsapp: boolean;
    };
    emailOption?: "company" | "user" | "custom";
    customEmail?: string;
    phoneOption?: "company" | "user" | "whatsapp" | "custom";
    customPhone?: string;
  };
};

export type Message = {
  _id?: string;
  type: "email" | "sms" | "internal" | "whatsapp";
  content: string;
  sentAt?: string;
  sentBy?: string;
  subject?: string;
};

export type Comment = {
  _id?: string;
  changedBy: string;
  changedAt: string;
  comment: string;
  text?: string;
  author?: string;
};

export type StatusHistory = {
  _id?: string;
  status: string;
  changedBy: string;
  changedAt: string;
  notes?: string;
  notifications?: {
    channels: {
      email: boolean;
      sms: boolean;
      whatsapp: boolean;
    };
    emailOption?: "company" | "user" | "custom";
    customEmail?: string;
    phoneOption?: "company" | "user" | "whatsapp" | "custom";
    customPhone?: string;
  };
};

export type Applicant = {
  _id: string;
  companyId: string;
  jobPositionId: string;
  departmentId: string;
  status:
    | "applied"
    | "under_review"
    | "pending"
    | "interview"
    | "interviewed"
    | "accepted"
    | "approved"
    | "rejected"
    | "trashed";
  submittedAt: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  address?: string;
  profilePhoto?: string;
  cvFilePath?: string;
  resume?: string;
  source?: string;
  customResponses?: Record<string, any>;
  interviews?: Interview[];
  messages?: Message[];
  comments?: Comment[];
  statusHistory?: StatusHistory[];
  createdAt?: string;
  updatedAt?: string;
};

export type CreateApplicantRequest = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender?: string;
  jobPositionId: string;
  companyId: string;
  departmentId: string;
  resume?: string;
  source?: string;
  address?: string;
  customResponses?: Record<string, any>;
};

export type UpdateApplicantRequest = {
  firstName?: string;
  lastName?: string;
  email?: string;
  gender?: string;
  phone?: string;
  address?: string;
  resume?: string;
  customResponses?: Record<string, any>;
};

export type UpdateStatusRequest = {
  status:
    | "applied"
    | "under_review"
    | "pending"
    | "interview"
    | "interviewed"
    | "accepted"
    | "approved"
    | "rejected"
    | "trashed";
  notes?: string;
};

export type ScheduleInterviewRequest = {
  scheduledAt?: string;
  videoLink?: string;
  notes?: string;
  interviewers?: string[];
  type?: string;
};

export type UpdateInterviewStatusRequest = {
  status: "scheduled" | "completed" | "cancelled";
  notes?: string;
};

export type AddCommentRequest = {
  comment?: string;
  text?: string;
  author?: string;
};

export type SendMessageRequest = {
  subject?: string;
  content?: string;
  comment?: string;
  type?: "email" | "sms" | "internal" | "whatsapp";
};

class ApplicantsService {
  /**
   * Get all applicants
   */
  async getAllApplicants(
    companyId?: string[],
    jobPositionId?: string | string[],
    status?: string | string[],
    fields?: string | string[]
  ): Promise<Applicant[]> {
    try {
      const paramsBase: any = {};
      if (companyId && companyId.length > 0) {
        if (companyId.length === 1) {
          paramsBase.companyId = companyId[0];
        } else {
          paramsBase.companyId = companyId.join(",");
        }
      }
      if (status) {
        if (Array.isArray(status)) {
          paramsBase.status = status.join(",");
        } else {
          paramsBase.status = status;
        }
      }
      if (fields) {
        if (Array.isArray(fields)) {
          paramsBase.fields = fields.join(",");
        } else {
          paramsBase.fields = fields;
        }
      }
      // Always filter out deleted applicants
      paramsBase.deleted = false;

      const collectFromOne = async (jpId?: string) => {
        const result: Applicant[] = [];
        let currentPage = 1;
        let totalPages = 1;

        do {
          const params = { ...paramsBase, page: currentPage, PageCount: 1000 } as any;
          if (jpId) params.jobPositionId = jpId;
          const response = await axios.get("/applicants", { params });
          const payload = response.data;

          // Extract applicants from current page
          let pageData: Applicant[] = [];
          if (Array.isArray(payload)) {
            pageData = payload;
          } else if (payload && Array.isArray(payload.data)) {
            pageData = payload.data;
          } else if (payload && payload.data && Array.isArray(payload.data.data)) {
            pageData = payload.data.data;
          } else if (payload && payload.data && Array.isArray(payload.data.docs)) {
            pageData = payload.data.docs;
          }

          result.push(...pageData);

          // Determine total pages
          if (payload && payload.TotalCount && payload.PageCount) {
            totalPages = Math.ceil(payload.TotalCount / payload.PageCount);
          } else if (payload && payload.page && typeof payload.page === 'string') {
            const match = payload.page.match(/\d+\s+of\s+(\d+)/);
            if (match) {
              totalPages = parseInt(match[1], 10);
            }
          }

          currentPage++;
        } while (currentPage <= totalPages);

        return result;
      };

      // Normalize jobPositionId param to array if comma-separated string provided
      let jobIds: string[] | undefined;
      if (Array.isArray(jobPositionId)) jobIds = jobPositionId;
      else if (typeof jobPositionId === 'string' && jobPositionId.includes(',')) {
        jobIds = jobPositionId.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (typeof jobPositionId === 'string' && jobPositionId.trim()) {
        jobIds = [jobPositionId.trim()];
      }

      let allApplicants: Applicant[] = [];
      if (jobIds && jobIds.length > 0) {
        // Fetch per job id and aggregate, deduplicating by applicant _id
        const sets = await Promise.all(jobIds.map((jid) => collectFromOne(jid)));
        const combined = sets.flat();
        const uniqueMap: Record<string, Applicant> = {};
        combined.forEach((a) => {
          if (a && a._id) uniqueMap[a._id] = a;
        });
        allApplicants = Object.values(uniqueMap);
      } else {
        // Single fetch (no job filter)
        allApplicants = await collectFromOne(undefined);
      }

      return allApplicants;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Get a single applicant by ID
   */
  async getApplicantById(applicantId: string): Promise<Applicant> {
    try {
      const response = await axios.get(`/applicants/${applicantId}`);
      // Normalize response shapes: { data: Applicant }, { applicant: Applicant }, or nested wrappers
      let maybe: any = response.data?.data ?? (response.data as any)?.applicant ?? response.data ?? null;

      if (!maybe || (typeof maybe === 'object' && !('_id' in maybe))) {
        const nested = Object.values(response.data || {}).find((v: any) => v && typeof v === 'object' && v._id);
        if (nested) maybe = nested;
      }

      if (!maybe) {
        console.warn('applicantsService.getApplicantById: unexpected response shape', response.data);
        throw new ApiError(getErrorMessage(response as any), response.status ?? undefined, response as any);
      }

      // Normalize any job-specs data so callers can rely on `jobSpecsWithDetails`
      try {
        if (maybe.jobPositionId && typeof maybe.jobPositionId === 'object') {
          jobPositionsService.normalizeJobPosition(maybe.jobPositionId);
        }
        // If applicant itself carries jobSpecsResponses or jobSpecs, normalize into jobSpecsWithDetails
        if (maybe.jobSpecsResponses || maybe.jobSpecs || maybe.jobSpecsWithDetails) {
          jobPositionsService.normalizeJobPosition(maybe as any);
        }
      } catch (e) {
        // ignore normalization errors
      }

      return maybe as Applicant;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Create a new applicant (internal use)
   */
  async createApplicant(data: CreateApplicantRequest): Promise<Applicant> {
    try {
      const response = await axios.post("/applicants", data);
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Update an applicant
   */
  async updateApplicant(
    applicantId: string,
    data: UpdateApplicantRequest
  ): Promise<Applicant> {
    try {
      const response = await axios.put(`/applicants/${applicantId}`, data);
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Update applicant status
   */
  async updateApplicantStatus(
    applicantId: string,
    data: UpdateStatusRequest
  ): Promise<Applicant> {
    try {
      const response = await axios.put(
        `/applicants/${applicantId}/status`,
        data
      );
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Schedule interview for an applicant
   */
  async scheduleInterview(
    applicantId: string,
    data: ScheduleInterviewRequest
  ): Promise<Applicant> {
    try {
      const response = await axios.post(
        `/applicants/${applicantId}/interviews`,
        data
      );
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Update interview status
   */
  async updateInterviewStatus(
    applicantId: string,
    interviewId: string,
    data: UpdateInterviewStatusRequest
  ): Promise<Applicant> {
    try {
      // Explicitly construct payload with only allowed fields
      const payload: any = {
        status: data.status,
      };
      if (data.notes) {
        payload.notes = data.notes;
      }

      const response = await axios.put(
        `/applicants/${applicantId}/interviews/${interviewId}`,
        payload
      );
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Add comment to an applicant
   */
  async addComment(
    applicantId: string,
    data: AddCommentRequest
  ): Promise<Applicant> {
    try {
      const response = await axios.post(
        `/applicants/${applicantId}/comments`,
        data
      );
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Send message to an applicant
   */
  async sendMessage(
    applicantId: string,
    data: SendMessageRequest
  ): Promise<Applicant> {
    try {
      const response = await axios.post(
        `/applicants/${applicantId}/messages`,
        data
      );
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Delete an applicant
   */
  async deleteApplicant(applicantId: string): Promise<void> {
    try {
      await axios.delete(`/applicants/${applicantId}`);
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async getApplicantStatuses(companyId?: string[],  status?: string | string[] | string[]): Promise<{ _id: string; status: Applicant['status']; submittedAt?: string; createdAt?: string }[]> {
    try {
      const params: any = {};
      if (companyId && companyId.length > 0) {
        // Always send company id(s) as a query parameter named `companyID`.
        // If multiple ids are provided, join with commas.
        params.companyID = companyId.length === 1 ? companyId[0] : companyId.join(",");
      }

      if (status) {
        params.status = status;
      }

      const response = await axios.get(`/applicants/status-insights`, { params });
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Mark an applicant as seen by the current authenticated user.
   * Backend uses $addToSet so the operation is idempotent.
   */
  async markAsSeen(applicantId: string): Promise<void> {
    try {
      await axios.patch(`/applicants/${applicantId}/seen`);
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }
}

export const applicantsService = new ApplicantsService();
