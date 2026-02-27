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
  salaryFieldVisible?: boolean;
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
  salaryFieldVisible?: boolean;
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
  salaryFieldVisible?: boolean;
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
  // Normalize job position shapes so callers always get `jobSpecsWithDetails`
  normalizeJobPosition(maybe: any): any {
    if (!maybe || typeof maybe !== 'object') return maybe;

    // If already has jobSpecsWithDetails, ensure answers are boolean
    if (Array.isArray(maybe.jobSpecsWithDetails)) {
      maybe.jobSpecsWithDetails = maybe.jobSpecsWithDetails.map((d: any, idx: number) => ({
        jobSpecId: d.jobSpecId ?? d._id ?? d.id ?? `spec_${idx}`,
        spec: d.spec ?? d.spec?.en ?? d.spec?.value ?? '',
        weight: typeof d.weight === 'number' ? d.weight : (d.weight ? Number(d.weight) : 0),
        answer: typeof d.answer === 'boolean' ? d.answer : Boolean(d.answer),
      }));
      return maybe;
    }

    // Collect raw specs and responses from various possible properties
    const rawSpecs: any[] = Array.isArray(maybe.jobSpecs) ? maybe.jobSpecs.slice() : [];
    const responses: any[] = Array.isArray(maybe.jobSpecsResponses) ? maybe.jobSpecsResponses.slice() : [];

    // If server returned something like jobSpecsWithDetails under another key, try common variants
    if (Array.isArray(maybe.job_specs_with_details)) rawSpecs.push(...maybe.job_specs_with_details);
    if (Array.isArray(maybe.jobSpecsWithDetail)) rawSpecs.push(...maybe.jobSpecsWithDetail);

    // Normalize specs into canonical entries
    const specs = rawSpecs.map((s: any, idx: number) => {
      if (!s) return { jobSpecId: `spec_${idx}`, spec: '', weight: 0 };
      if (typeof s === 'string') return { jobSpecId: s, spec: s, weight: 0 };
      const jobSpecId = s.jobSpecId ?? s._id ?? s.id ?? s.specId ?? `spec_${idx}`;
      const specVal = s.spec ?? (s.spec && typeof s.spec === 'object' ? (s.spec.en ?? '') : s.spec) ?? '';
      const weight = typeof s.weight === 'number' ? s.weight : (s.weight ? Number(s.weight) : 0);
      return { jobSpecId, spec: specVal, weight };
    });

    // Map responses by id
    const respMap = new Map<string, boolean>();
    responses.forEach((r: any) => {
      if (!r) return;
      const id = r.jobSpecId ?? r._id ?? r.id ?? r.specId;
      if (!id) return;
      respMap.set(id, typeof r.answer === 'boolean' ? r.answer : Boolean(r.answer));
    });

    // Build final details merging specs and responses
    let details = specs.map((s: any) => ({
      jobSpecId: s.jobSpecId,
      spec: s.spec,
      weight: s.weight,
      answer: respMap.has(s.jobSpecId) ? respMap.get(s.jobSpecId) : false,
    }));

    // If no specs but responses exist, construct from responses
    if (details.length === 0 && responses.length > 0) {
      details = responses.map((r: any, idx: number) => ({
        jobSpecId: r.jobSpecId ?? r._id ?? r.id ?? `rsp_${idx}`,
        spec: r.spec ?? r.label ?? '',
        weight: typeof r.weight === 'number' ? r.weight : 0,
        answer: typeof r.answer === 'boolean' ? r.answer : Boolean(r.answer),
      }));
    }

    maybe.jobSpecsWithDetails = details;
    return maybe;
  }
  /**
   * Get all job positions
   */
  async getAllJobPositions(
    companyIdOrOptions?:
      | string[]
      | string
      | { companyId?: string[] | string; deleted?: boolean }
  ): Promise<JobPosition[]> {
    try {
      const params: any = {};

      // Determine shape: either an array/string of ids, or an options object
      let ids: string[] | undefined;
      let deleted = false;

      if (Array.isArray(companyIdOrOptions)) {
        ids = companyIdOrOptions as string[];
      } else if (
        companyIdOrOptions &&
        typeof companyIdOrOptions === "object"
      ) {
        const opts: any = companyIdOrOptions;
        if (opts.companyId) {
          ids = Array.isArray(opts.companyId)
            ? opts.companyId
            : String(opts.companyId)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
        }
        if (opts.deleted !== undefined) deleted = !!opts.deleted;
      } else if (companyIdOrOptions !== undefined) {
        // single string id or comma separated
        ids = String(companyIdOrOptions)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      if (ids && ids.length > 0) {
        if (ids.length === 1) params.companyId = ids[0];
        else params.companyIds = ids;
      }

      params.deleted = deleted ? "true" : "false";

      const response = await axios.get("/job-positions", { params });
      const data = response.data.data;
      if (Array.isArray(data)) return data.map((d: any) => this.normalizeJobPosition(d));
      return data;
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
      const data = response.data.data;
      return this.normalizeJobPosition(data);
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
      if (data.salaryFieldVisible !== undefined)
        payload.salaryFieldVisible = data.salaryFieldVisible;
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

      return this.normalizeJobPosition(maybe) as any;
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
      if (data.salaryFieldVisible !== undefined)
        payload.salaryFieldVisible = data.salaryFieldVisible;
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
      const jobPositionData = response.data.data;
      return this.normalizeJobPosition(jobPositionData);
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
