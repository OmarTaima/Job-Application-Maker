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

export type Interview = {
  _id?: string;
  issuedBy: string;
  issuedAt: string;
  description: string;
  comment?: string;
  date?: string;
  time?: string;
  interviewers?: string[];
  location?: string;
  link?: string;
  type?: string;
};

export type Message = {
  _id?: string;
  status: string;
  text: string;
  sentAt: string;
  sentBy: string;
  comment?: string;
  subject?: string;
  body?: string;
  type?: string;
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
};

export type Applicant = {
  _id: string;
  companyId: string;
  jobPositionId: string;
  departmentId: string;
  status:
    | "pending"
    | "approved"
    | "interview"
    | "rejected"
    | "screening"
    | "offer";
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
    | "pending"
    | "approved"
    | "interview"
    | "rejected"
    | "screening"
    | "offer";
  notes?: string;
};

export type ScheduleInterviewRequest = {
  date: string;
  time?: string;
  description: string;
  comment?: string;
  interviewers?: string[];
  location?: string;
  link?: string;
  type?: string;
};

export type AddCommentRequest = {
  comment?: string;
  text?: string;
  author?: string;
};

export type SendMessageRequest = {
  subject?: string;
  text?: string;
  body?: string;
  comment?: string;
  type?: string;
};

class ApplicantsService {
  /**
   * Get all applicants
   */
  async getAllApplicants(): Promise<Applicant[]> {
    try {
      const response = await fetchWithAuth("/applicants");

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
   * Get a single applicant by ID
   */
  async getApplicantById(applicantId: string): Promise<Applicant> {
    try {
      const response = await fetchWithAuth(`/applicants/${applicantId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to fetch applicant",
          response.status,
          errorData.details
        );
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while fetching applicant");
    }
  }

  /**
   * Create a new applicant (internal use)
   */
  async createApplicant(data: CreateApplicantRequest): Promise<Applicant> {
    try {
      const response = await fetchWithAuth("/applicants", {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to create applicant",
          response.status,
          errorData.details
        );
      }

      const responseData = await response.json();
      return responseData.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while creating applicant");
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
      const response = await fetchWithAuth(`/applicants/${applicantId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to update applicant",
          response.status,
          errorData.details
        );
      }

      const responseData = await response.json();
      return responseData.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while updating applicant");
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
      const response = await fetchWithAuth(
        `/applicants/${applicantId}/status`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to update applicant status",
          response.status,
          errorData.details
        );
      }

      const responseData = await response.json();
      return responseData.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while updating applicant status");
    }
  }

  /**
   * Schedule interview for an applicant
   */
  async scheduleInterview(
    applicantId: string,
    data: ScheduleInterviewRequest
  ): Promise<Interview> {
    try {
      const response = await fetchWithAuth(
        `/applicants/${applicantId}/interviews`,
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to schedule interview",
          response.status,
          errorData.details
        );
      }

      const responseData = await response.json();
      return responseData.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while scheduling interview");
    }
  }

  /**
   * Add comment to an applicant
   */
  async addComment(
    applicantId: string,
    data: AddCommentRequest
  ): Promise<Comment> {
    try {
      const response = await fetchWithAuth(
        `/applicants/${applicantId}/comments`,
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to add comment",
          response.status,
          errorData.details
        );
      }

      const responseData = await response.json();
      return responseData.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while adding comment");
    }
  }

  /**
   * Send message to an applicant
   */
  async sendMessage(
    applicantId: string,
    data: SendMessageRequest
  ): Promise<Message> {
    try {
      const response = await fetchWithAuth(
        `/applicants/${applicantId}/messages`,
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to send message",
          response.status,
          errorData.details
        );
      }

      const responseData = await response.json();
      return responseData.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while sending message");
    }
  }
}

export const applicantsService = new ApplicantsService();
