// services/jobPositionsService.ts
import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";
import type {
  JobPosition,
  CreateJobPositionRequest,
  UpdateJobPositionRequest,
  ReorderJobPositionsRequestItem,
  JobFieldConfig,
  JobFieldConfigRule,
} from '../types/jobPositions';
import type { Applicant } from '../types/applicants';
import { ApiError } from "./companiesService";

// Re-export types
export type {
  JobPosition,
  CreateJobPositionRequest,
  UpdateJobPositionRequest,
  ReorderJobPositionsRequestItem,
  JobFieldConfig,
  JobFieldConfigRule,
} from '../types/jobPositions';
export type { Applicant } from '../types/applicants';

// ===== Constants =====
const DEFAULT_FIELD_CONFIG: JobFieldConfig = {
  fullName: { visible: true, required: true },
  email: { visible: true, required: true },
  phone: { visible: true, required: true },
  gender: { visible: true, required: true },
  birthDate: { visible: true, required: true },
  address: { visible: true, required: true },
  profilePhoto: { visible: true, required: true },
  cvFilePath: { visible: true, required: false },
  expectedSalary: { visible: false, required: false },
};

// ===== Helper Functions =====
function normalizeFieldConfigRule(
  incoming: any,
  fallback: JobFieldConfigRule
): JobFieldConfigRule {
  const visible = typeof incoming?.visible === "boolean" ? incoming.visible : fallback.visible;
  const required = typeof incoming?.required === "boolean" ? incoming.required : fallback.required;
  return { visible, required: visible ? required : false };
}

function normalizeJobFieldConfig(value: any, legacySalaryFieldVisible?: boolean): JobFieldConfig {
  const raw = value && typeof value === "object" ? value : {};
  
  const withFallbackExpectedSalary = {
    ...raw,
    expectedSalary: raw.expectedSalary && typeof raw.expectedSalary === "object"
      ? raw.expectedSalary
      : typeof legacySalaryFieldVisible === "boolean"
        ? { visible: legacySalaryFieldVisible, required: false }
        : raw.expectedSalary,
  };

  return {
    fullName: normalizeFieldConfigRule(withFallbackExpectedSalary.fullName, DEFAULT_FIELD_CONFIG.fullName),
    email: normalizeFieldConfigRule(withFallbackExpectedSalary.email, DEFAULT_FIELD_CONFIG.email),
    phone: normalizeFieldConfigRule(withFallbackExpectedSalary.phone, DEFAULT_FIELD_CONFIG.phone),
    gender: normalizeFieldConfigRule(withFallbackExpectedSalary.gender, DEFAULT_FIELD_CONFIG.gender),
    birthDate: normalizeFieldConfigRule(withFallbackExpectedSalary.birthDate, DEFAULT_FIELD_CONFIG.birthDate),
    address: normalizeFieldConfigRule(withFallbackExpectedSalary.address, DEFAULT_FIELD_CONFIG.address),
    profilePhoto: normalizeFieldConfigRule(withFallbackExpectedSalary.profilePhoto, DEFAULT_FIELD_CONFIG.profilePhoto),
    cvFilePath: normalizeFieldConfigRule(withFallbackExpectedSalary.cvFilePath, DEFAULT_FIELD_CONFIG.cvFilePath),
    expectedSalary: normalizeFieldConfigRule(withFallbackExpectedSalary.expectedSalary, DEFAULT_FIELD_CONFIG.expectedSalary),
  };
}

// ===== Job Positions Service =====
class JobPositionsService {
  private async request<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: any,
    params?: any
  ): Promise<T> {
    try {
      const config = { params };
      const response = method === 'get' || method === 'delete'
        ? await axios[method](url, config)
        : await axios[method](url, data, config);
      
      return response.data?.data ?? response.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  private extractJobPositions(payload: any): JobPosition[] {
    const data = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.data?.data)
          ? payload.data.data
          : [];
    return data.map((d: any) => this.normalizeJobPosition(d));
  }

  public normalizeJobPosition(maybe: any): JobPosition {
    if (!maybe || typeof maybe !== 'object') return maybe;

    // Normalize field config
    maybe.fieldConfig = normalizeJobFieldConfig(
      maybe.fieldConfig,
      typeof maybe.salaryFieldVisible === "boolean" ? maybe.salaryFieldVisible : undefined
    );

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

    // Build jobSpecsWithDetails from raw specs and responses
    const rawSpecs: any[] = Array.isArray(maybe.jobSpecs) ? [...maybe.jobSpecs] : [];
    const responses: any[] = Array.isArray(maybe.jobSpecsResponses) ? [...maybe.jobSpecsResponses] : [];

    // Handle alternative response shapes
    if (Array.isArray(maybe.job_specs_with_details)) rawSpecs.push(...maybe.job_specs_with_details);
    if (Array.isArray(maybe.jobSpecsWithDetail)) rawSpecs.push(...maybe.jobSpecsWithDetail);

    // Normalize specs
    const specs = rawSpecs.map((s: any, idx: number) => ({
      jobSpecId: s.jobSpecId ?? s._id ?? s.id ?? s.specId ?? `spec_${idx}`,
      spec: s.spec ?? (s.spec && typeof s.spec === 'object' ? (s.spec.en ?? '') : s.spec) ?? '',
      weight: typeof s.weight === 'number' ? s.weight : (s.weight ? Number(s.weight) : 0),
    }));

    // Create response map
    const respMap = new Map<string, boolean>();
    responses.forEach((r: any) => {
      const id = r.jobSpecId ?? r._id ?? r.id ?? r.specId;
      if (id) respMap.set(id, typeof r.answer === 'boolean' ? r.answer : Boolean(r.answer));
    });

    // Build final details
    let details = specs.map(s => ({
      jobSpecId: s.jobSpecId,
      spec: s.spec,
      weight: s.weight,
      answer: respMap.get(s.jobSpecId) ?? false,
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

  private buildJobPositionPayload(data: Partial<CreateJobPositionRequest | UpdateJobPositionRequest>): any {
    const payload: any = {};

    const fields = [
      'title', 'description', 'departmentId', 'companyId', 'jobCode',
      'requirements', 'termsAndConditions', 'employmentType', 'workArrangement',
      'status', 'bilingual', 'isActive', 'createdBy'
    ];
    
    fields.forEach(field => {
      if ((data as any)[field] !== undefined) payload[field] = (data as any)[field];
    });

    if (data.salary !== undefined) payload.salary = data.salary;
    if (data.salaryVisible !== undefined) payload.salaryVisible = data.salaryVisible;
    if (data.openPositions !== undefined) payload.openPositions = data.openPositions;
    if (data.order !== undefined) payload.order = data.order;
    if (data.registrationStart) payload.registrationStart = data.registrationStart;
    if (data.registrationEnd) payload.registrationEnd = data.registrationEnd;
    if (data.jobSpecs?.length) payload.jobSpecs = data.jobSpecs;
    if (data.customFields?.length) payload.customFields = data.customFields;
    if (data.fieldConfig) payload.fieldConfig = normalizeJobFieldConfig(data.fieldConfig);

    return payload;
  }

  // ===== Public Methods =====
  async getAllJobPositions(params?: {
    companyId?: string | string[];
    deleted?: boolean;
    departmentId?: string | string[];
  }): Promise<JobPosition[]> {
    const companyIds = params?.companyId
      ? Array.isArray(params.companyId)
        ? params.companyId
        : String(params.companyId).split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const deleted = params?.deleted ?? false;
    const departments = params?.departmentId
      ? Array.isArray(params.departmentId)
        ? params.departmentId
        : String(params.departmentId).split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    const fetchOne = async (singleCompanyId?: string): Promise<JobPosition[]> => {
      const queryParams: any = {
        deleted: deleted ? "true" : "false",
        PageCount: "all",
      };
      if (singleCompanyId) queryParams.companyId = singleCompanyId;
      if (departments?.length) queryParams.departmentId = departments.join(",");
      
      const response = await this.request<any>('get', "/job-positions", undefined, queryParams);
      return this.extractJobPositions(response);
    };

    if (companyIds.length <= 1) {
      return fetchOne(companyIds[0]);
    }

    const positionLists = await Promise.all(companyIds.map(id => fetchOne(id)));
    const unique = new Map<string, JobPosition>();
    positionLists.flat().forEach(position => {
      if (position?._id) unique.set(position._id, position);
    });
    return Array.from(unique.values());
  }

  async getJobPositionById(id: string): Promise<JobPosition> {
    const response = await this.request<any>('get', `/job-positions/${id}`);
    return this.normalizeJobPosition(response);
  }

  async createJobPosition(data: CreateJobPositionRequest): Promise<JobPosition> {
    const payload = this.buildJobPositionPayload(data);
    if (data.companyId) payload.companyId = data.companyId;
    
    const response = await this.request<any>('post', "/job-positions", payload);
    return this.normalizeJobPosition(response);
  }

  async updateJobPosition(id: string, data: UpdateJobPositionRequest): Promise<JobPosition> {
    const payload = this.buildJobPositionPayload(data);
    const response = await this.request<any>('put', `/job-positions/${id}`, payload);
    return this.normalizeJobPosition(response);
  }

  async deleteJobPosition(id: string): Promise<void> {
    await this.request<void>('delete', `/job-positions/${id}`);
  }

  async reorderJobPositions(
    items: ReorderJobPositionsRequestItem[],
    basePayloadById?: Record<string, UpdateJobPositionRequest>
  ): Promise<void> {
    const normalizedItems = items
      .map(item => ({
        id: String(item?.id || "").trim(),
        order: Number(item?.order),
      }))
      .filter(item => item.id && Number.isFinite(item.order));

    if (normalizedItems.length === 0) return;

    await Promise.all(
      normalizedItems.map(item => {
        const basePayload = basePayloadById?.[item.id] || {};
        return this.updateJobPosition(item.id, { ...basePayload, order: item.order });
      })
    );
  }

  async getApplicantsForPosition(jobPositionId: string): Promise<Applicant[]> {
    return this.request<Applicant[]>('get', `/job-positions/${jobPositionId}/applicants`);
  }

  async cloneJobPosition(jobPositionId: string): Promise<JobPosition> {
    const response = await this.request<any>('post', `/job-positions/${jobPositionId}/clone`);
    return this.normalizeJobPosition(response);
  }
}

export const jobPositionsService = new JobPositionsService();