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

export type LocalizedString = { en: string; ar: string };

export type JobPosition = {
  _id: string;
  companyId: string;
  departmentId: string;
  jobCode: string;
  title: LocalizedString;
  description?: LocalizedString;
  bilingual?: boolean;
  isActive?: boolean;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'internship';
  workArrangement: 'on-site' | 'remote' | 'hybrid';
  salary?: number;
  salaryVisible?: boolean;
  openPositions?: number;
  registrationStart?: string;
  registrationEnd?: string;
  status: "open" | "closed" | "archived";
  termsAndConditions?: LocalizedString[];
  jobSpecs?: Array<{
    spec: LocalizedString;
    weight: number;
  }>;
  customFields?: Array<{
    fieldId: string;
    label: LocalizedString;
    inputType: string;
    isRequired: boolean;
    defaultValue?: string;
    minValue?: number;
    maxValue?: number;
    choices?: Array<LocalizedString>;
    groupFields?: Array<{
      fieldId: string;
      label: LocalizedString;
      inputType: string;
      isRequired: boolean;
      choices?: Array<LocalizedString>;
      displayOrder?: number;
      defaultValue?: string;
      minValue?: number;
      maxValue?: number;
    }>;
    displayOrder: number;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateJobPositionRequest = {
  companyId: string;
  departmentId: string;
  jobCode: string;
  title: LocalizedString;
  description?: LocalizedString;
  bilingual?: boolean;
  isActive?: boolean;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'internship';
  workArrangement: 'on-site' | 'remote' | 'hybrid';
  salary?: number;
  salaryVisible?: boolean;
  openPositions?: number;
  registrationStart: string;
  registrationEnd: string;
  termsAndConditions?: LocalizedString[];
  // who created the job (backend requires this)
  createdBy?: string;
  // optional legacy/extra fields
  requirements?: string[];
  status?: string;
  jobSpecs?: Array<{
    spec: LocalizedString;
    weight: number;
  }>;
  customFields?: Array<{
    fieldId: string;
    label: LocalizedString;
    inputType: string;
    isRequired: boolean;
    defaultValue?: string;
    minValue?: number;
    maxValue?: number;
    choices?: Array<LocalizedString>;
    groupFields?: Array<{
      fieldId: string;
      label: LocalizedString;
      inputType: string;
      isRequired: boolean;
      choices?: Array<LocalizedString>;
      displayOrder?: number;
      defaultValue?: string;
      minValue?: number;
      maxValue?: number;
    }>;
    displayOrder: number;
  }>;
};

export type UpdateJobPositionRequest = {
  departmentId?: string;
  title?: LocalizedString;
  description?: LocalizedString;
  bilingual?: boolean;
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'internship';
  workArrangement?: 'on-site' | 'remote' | 'hybrid';
  isActive?: boolean;
  salary?: number;
  salaryVisible?: boolean;
  openPositions?: number;
  registrationStart?: string;
  registrationEnd?: string;
  termsAndConditions?: LocalizedString[];
  // allow updating these optional fields as well
  companyId?: string;
  jobCode?: string;
  requirements?: string[];
  status?: string;
  jobSpecs?: Array<{
    spec: LocalizedString;
    weight: number;
  }>;
  customFields?: Array<{
    fieldId: string;
    label: LocalizedString;
    inputType: string;
    isRequired: boolean;
    defaultValue?: string;
    minValue?: number;
    maxValue?: number;
    choices?: Array<LocalizedString>;
    groupFields?: Array<{
      fieldId: string;
      label: LocalizedString;
      inputType: string;
      isRequired: boolean;
      choices?: Array<LocalizedString>;
      displayOrder?: number;
      defaultValue?: string;
      minValue?: number;
      maxValue?: number;
    }>;
    displayOrder: number;
  }>;
};

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
  async getAllJobPositions(companyId?: string[]): Promise<JobPosition[]> {
    try {
      const params: any = {};
      if (companyId && companyId.length > 0) {
        // Normalize incoming companyId to an array of ids (guard against a comma-joined string)
        const ids = Array.isArray(companyId)
          ? companyId
          : String(companyId).split(",").map((s) => s.trim()).filter(Boolean);

        if (ids.length === 1) {
          params.companyId = ids[0];
        } else if (ids.length > 1) {
          // Send as companyIds array so the backend receives multiple ids correctly
          params.companyIds = ids;
        }
      }
      // Always request only non-deleted job positions
      params.deleted = "false";
      const response = await axios.get("/job-positions", { params });
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
   * Get a single job position by ID
   */
  async getJobPositionById(jobPositionId: string): Promise<JobPosition> {
    try {
      const response = await axios.get(`/job-positions/${jobPositionId}`);
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
   * Create a new job position
   */
  async createJobPosition(
    data: CreateJobPositionRequest
  ): Promise<JobPosition> {
    try {
      // Build payload with only non-empty fields
      const payload: any = {
        title: data.title,
        description: data.description ?? { en: "", ar: "" },
        departmentId: data.departmentId || "",
      };

      // Include companyId for create operation
      if (data.companyId) payload.companyId = data.companyId;

      if (data.jobCode) payload.jobCode = data.jobCode;
      if (data.requirements && data.requirements.length > 0)
        payload.requirements = data.requirements;
      if (data.termsAndConditions && data.termsAndConditions.length > 0)
        payload.termsAndConditions = data.termsAndConditions;
      if (data.salary !== undefined) payload.salary = data.salary;
      if (data.salaryVisible !== undefined)
        payload.salaryVisible = data.salaryVisible;
      if (data.bilingual !== undefined) payload.bilingual = data.bilingual;
      if (data.isActive !== undefined) payload.isActive = data.isActive;
      if (data.employmentType) payload.employmentType = data.employmentType;
      if (data.workArrangement) payload.workArrangement = data.workArrangement;
      if ((data as any).createdBy) payload.createdBy = (data as any).createdBy;
      if (data.status) payload.status = data.status;
      if (data.openPositions) payload.openPositions = data.openPositions;
      if (data.registrationStart)
        payload.registrationStart = data.registrationStart;
      if (data.registrationEnd) payload.registrationEnd = data.registrationEnd;
      if (data.jobSpecs && data.jobSpecs.length > 0)
        payload.jobSpecs = data.jobSpecs;
      if (data.customFields && data.customFields.length > 0)
        payload.customFields = data.customFields;

      const response = await axios.post("/job-positions", payload);
      // Normalize possible response shapes: { data: Job }, { job: Job }, or nested wrappers
      let maybe: any = response.data?.data ?? (response.data as any)?.job ?? response.data ?? null;

      if (!maybe || (typeof maybe === 'object' && !('_id' in maybe))) {
        const nested = Object.values(response.data || {}).find((v: any) => v && typeof v === 'object' && v._id);
        if (nested) maybe = nested;
      }

      if (!maybe) {
        console.warn('jobPositionsService.createJobPosition: unexpected response shape', response.data);
        throw new ApiError(getErrorMessage(response as any), response.status ?? undefined, response as any);
      }

      return maybe as any;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
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
      if (data.bilingual !== undefined) payload.bilingual = data.bilingual;
      if (data.isActive !== undefined) payload.isActive = data.isActive;
      if (data.employmentType) payload.employmentType = data.employmentType;
      if (data.workArrangement) payload.workArrangement = data.workArrangement;
      if (data.status) payload.status = data.status;
      if (data.openPositions) payload.openPositions = data.openPositions;
      if (data.registrationStart)
        payload.registrationStart = data.registrationStart;
      if (data.registrationEnd) payload.registrationEnd = data.registrationEnd;
      if (data.jobSpecs) payload.jobSpecs = data.jobSpecs;
      if (data.customFields) payload.customFields = data.customFields;

      const response = await axios.put(
        `/job-positions/${jobPositionId}`,
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
   * Delete a job position
   */
  async deleteJobPosition(jobPositionId: string): Promise<void> {
    try {
      await axios.delete(`/job-positions/${jobPositionId}`);
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Get applicants for a job position
   */
  async getApplicantsForPosition(jobPositionId: string): Promise<Applicant[]> {
    try {
      const response = await axios.get(
        `/job-positions/${jobPositionId}/applicants`
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
   * Clone a job position
   */
  async cloneJobPosition(jobPositionId: string): Promise<JobPosition> {
    try {
      const response = await axios.post(
        `/job-positions/${jobPositionId}/clone`
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
}

export const jobPositionsService = new JobPositionsService();
