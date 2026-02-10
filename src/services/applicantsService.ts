import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";

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
    jobPositionId?: string
  ): Promise<Applicant[]> {
    try {
      const params: any = {};
      if (companyId && companyId.length > 0) {
        if (companyId.length === 1) {
          params.companyId = companyId[0];
        } else {
          params.companyId = companyId.join(",");
        }
      }
     
      if (jobPositionId) {
        params.jobPositionId = jobPositionId;
      }
      const response = await axios.get("/applicants", { params });
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
   * Get a single applicant by ID
   */
  async getApplicantById(applicantId: string): Promise<Applicant> {
    try {
      const response = await axios.get(`/applicants/${applicantId}`);
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
}

export const applicantsService = new ApplicantsService();
