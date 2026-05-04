// services/applicantsService.ts
import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";
import { jobPositionsService } from "./jobPositionsService";
import type {
  Applicant,
  CreateApplicantRequest,
  UpdateApplicantRequest,
  UpdateStatusRequest,
  ScheduleInterviewRequest,
  BulkScheduleInterviewRequest,
  BulkScheduleInterviewItem,
  UpdateInterviewStatusRequest,
  AddCommentRequest,
  SendMessageRequest,
  InterviewAnswer,
  RejectionInsights,
} from '../types/applicants';
import { ApiError } from "./companiesService";

// Re-export types
export type {
  Applicant,
  CreateApplicantRequest,
  UpdateApplicantRequest,
  UpdateStatusRequest,
  ScheduleInterviewRequest,
  BulkScheduleInterviewRequest,
  BulkScheduleInterviewItem,
  UpdateInterviewStatusRequest,
  AddCommentRequest,
  SendMessageRequest,
  InterviewAnswer,
  RejectionInsights,
} from '../types/applicants';

// ===== Helper Functions =====
function normalizeInterviewQuestions(questions: any): InterviewAnswer[] {
  if (!Array.isArray(questions)) return [];

  return questions.map((q: any) => ({
    question: String(q?.question || '').trim(),
    score: Number(q?.score ?? 0),
    achievedScore: Math.max(0, Number.isFinite(Number(q?.achievedScore)) ? Number(q?.achievedScore) : 0),
    notes: q?.notes ?? '',
  }));
}

function extractApplicantFromPayload(payload: any, applicantId: string): any {
  const targetId = String(applicantId || '');
  const queue: any[] = [];

  const pushCandidate = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(pushCandidate);
      return;
    }
    if (typeof value === 'object') {
      queue.push(value);
    }
  };

  pushCandidate(payload);

  for (const candidate of queue) {
    const candidateId = String(candidate?._id || candidate?.id || '');
    if (candidateId && candidateId === targetId) {
      return candidate;
    }

    if (candidate?.applicant && typeof candidate.applicant === 'object') {
      const nestedApplicantId = String(candidate.applicant?._id || candidate.applicant?.id || '');
      if (nestedApplicantId && nestedApplicantId === targetId) {
        return candidate.applicant;
      }
    }
  }

  return queue.find((value: any) => Array.isArray(value?.interviews));
}

// ===== Applicants Service =====
class ApplicantsService {
  public async request<T>(
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    url: string,
    data?: any,
    params?: any
  ): Promise<T> {
    try {
      const config = { params };
      let response;
      
      if (method === 'get' || method === 'delete') {
        response = await axios[method](url, config);
      } else if (method === 'patch') {
        response = await axios.patch(url, data, config);
      } else {
        response = await axios[method](url, data, config);
      }
      
      return response.data?.data ?? response.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  private extractApplicants(payload: any): Applicant[] {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload?.data && Array.isArray(payload.data.data)) return payload.data.data;
    if (payload?.data && Array.isArray(payload.data.docs)) return payload.data.docs;
    return [];
  }

  private normalizeCompanyIds(companyId?: string[]): string[] {
    if (!companyId) return [];
    return [...new Set(companyId.map(id => String(id || "").trim()).filter(Boolean))];
  }

  private toScheduleInterviewItem(
    applicantId: any,
    data: ScheduleInterviewRequest
  ): BulkScheduleInterviewItem {
    const rawApplicantId = typeof applicantId === 'object'
      ? applicantId?._id || applicantId?.id || ''
      : applicantId;

    const item: any = { applicantId: String(rawApplicantId || '').trim() };

    const allowedKeys: Array<keyof ScheduleInterviewRequest> = [
      'scheduledAt', 'conductedBy', 'scheduledBy', 'description',
      'location', 'videoLink', 'address', 'type', 'notes', 'status'
    ];

    allowedKeys.forEach(key => {
      const value = (data as any)?.[key];
      if (value !== undefined) item[key] = value;
    });

    item.questions = normalizeInterviewQuestions((data as any)?.questions);
    return item as BulkScheduleInterviewItem;
  }

  // ===== Public Methods =====
  async getAllApplicants(params?: {
    companyId?: string[];
    jobPositionId?: string | string[];
    status?: string | string[];
    fields?: string | string[];
    departmentId?: string[];
  }): Promise<Applicant[]> {
    const companyIds = this.normalizeCompanyIds(params?.companyId);
    
    const buildQueryParams = (options?: { companyId?: string; jobPositionId?: string }) => {
      const queryParams: any = { deleted: false, PageCount: 'all' };
      
      if (params?.status) {
        queryParams.status = Array.isArray(params.status) ? params.status.join(",") : params.status;
      }
      if (params?.fields) {
        queryParams.fields = Array.isArray(params.fields) ? params.fields.join(",") : params.fields;
      }
      if (options?.companyId) queryParams.companyId = options.companyId;
      if (options?.jobPositionId) queryParams.jobPositionId = options.jobPositionId;
      if (params?.departmentId?.length) queryParams.departmentId = params.departmentId.join(",");
      
      return queryParams;
    };

    const fetchOne = async (options?: { companyId?: string; jobPositionId?: string }): Promise<Applicant[]> => {
      const response = await this.request<any>('get', "/applicants", undefined, buildQueryParams(options));
      return this.extractApplicants(response);
    };

    const jobIds = params?.jobPositionId
      ? Array.isArray(params.jobPositionId)
        ? params.jobPositionId
        : params.jobPositionId.includes(',')
          ? params.jobPositionId.split(',').map(s => s.trim()).filter(Boolean)
          : [params.jobPositionId.trim()]
      : [];

    let allApplicants: Applicant[] = [];

    if (companyIds.length > 0 && jobIds.length > 0) {
      const sets = await Promise.all(
        companyIds.flatMap(cid =>
          jobIds.map(jid => fetchOne({ companyId: cid, jobPositionId: jid }))
        )
      );
      const combined = sets.flat();
      const uniqueMap = new Map<string, Applicant>();
      combined.forEach(a => { if (a?._id) uniqueMap.set(a._id, a); });
      allApplicants = Array.from(uniqueMap.values());
    } else if (companyIds.length > 0) {
      const sets = await Promise.all(companyIds.map(cid => fetchOne({ companyId: cid })));
      const combined = sets.flat();
      const uniqueMap = new Map<string, Applicant>();
      combined.forEach(a => { if (a?._id) uniqueMap.set(a._id, a); });
      allApplicants = Array.from(uniqueMap.values());
    } else if (jobIds.length > 0) {
      const sets = await Promise.all(jobIds.map(jid => fetchOne({ jobPositionId: jid })));
      const combined = sets.flat();
      const uniqueMap = new Map<string, Applicant>();
      combined.forEach(a => { if (a?._id) uniqueMap.set(a._id, a); });
      allApplicants = Array.from(uniqueMap.values());
    } else {
      allApplicants = await fetchOne();
    }

    return allApplicants;
  }

  async getApplicantById(id: string): Promise<Applicant> {
    const response = await this.request<any>('get', `/applicants/${id}`);
    
    // Normalize job position data if present
    try {
      if (response.jobPositionId && typeof response.jobPositionId === 'object') {
        jobPositionsService.normalizeJobPosition(response.jobPositionId);
      }
      if (response.jobSpecsResponses || response.jobSpecs || response.jobSpecsWithDetails) {
        jobPositionsService.normalizeJobPosition(response);
      }
    } catch (e) {
      // Ignore normalization errors
    }
    
    return response as Applicant;
  }

  async createApplicant(data: CreateApplicantRequest): Promise<Applicant> {
    return this.request<Applicant>('post', "/applicants", data);
  }

  async updateApplicant(id: string, data: UpdateApplicantRequest): Promise<Applicant> {
    return this.request<Applicant>('put', `/applicants/${id}`, data);
  }

  async updateApplicantStatus(id: string, data: UpdateStatusRequest): Promise<Applicant> {
    return this.request<Applicant>('put', `/applicants/${id}/status`, data);
  }

  async scheduleInterview(applicantId: string, data: ScheduleInterviewRequest): Promise<Applicant> {
    const normalizedData = {
      ...data,
      questions: normalizeInterviewQuestions((data as any)?.questions),
    };

    const item = this.toScheduleInterviewItem(applicantId, normalizedData);
    let response: any;

    try {
      response = await this.request<any>('post', `/applicants/interviews`, [item]);
    } catch (error: any) {
      const status = Number(error?.response?.status || 0);
      if (![400, 404, 405, 422].includes(status)) throw error;
      response = await this.request<any>('post', `/applicants/${applicantId}/interviews`, normalizedData);
    }

    const extractedApplicant = extractApplicantFromPayload(response, applicantId);
    if (extractedApplicant && typeof extractedApplicant === 'object') return extractedApplicant as Applicant;
    if (Array.isArray(response) && response.length > 0) return response[0] as Applicant;
    if (response && typeof response === 'object') return response as Applicant;
    
    return { _id: applicantId } as Applicant;
  }

  async scheduleBulkInterviews(payload: BulkScheduleInterviewRequest | BulkScheduleInterviewItem[]): Promise<any> {
    const sourceItems: any[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.interviews)
        ? payload.interviews
        : [];

    const interviews = sourceItems
      .map(item => this.toScheduleInterviewItem(item?.applicantId, item || {}))
      .filter(item => item.applicantId);

    if (interviews.length === 0) {
      throw new ApiError('At least one interview payload is required.');
    }

    return this.request<any>('post', '/applicants/interviews', interviews);
  }

  async updateInterviewStatus(
    applicantId: string,
    interviewId: string,
    data: UpdateInterviewStatusRequest
  ): Promise<Applicant> {
    const payload: any = {};
    const allowedKeys: Array<keyof UpdateInterviewStatusRequest> = [
      'scheduledAt', 'scheduledBy', 'startedAt', 'endedAt', 'conductedBy',
      'description', 'location', 'videoLink', 'address', 'type', 'notes', 'status'
    ];

    allowedKeys.forEach(key => {
      const value = data?.[key];
      if (value !== undefined) payload[key] = value;
    });

    if (Array.isArray(data?.questions)) {
      payload.questions = normalizeInterviewQuestions(data.questions);
    }

    return this.request<Applicant>('put', `/applicants/${applicantId}/interviews/${interviewId}`, payload);
  }

  async batchUpdateStatus(
    updates: Array<{ applicantId: string; status: string; notes?: string; reasons?: string[] }>
  ): Promise<any> {
    return this.request<any>('put', '/applicants/batch-status', { items: updates });
  }

  async addComment(applicantId: string, data: AddCommentRequest): Promise<Applicant> {
    return this.request<Applicant>('post', `/applicants/${applicantId}/comments`, data);
  }

  async sendMessage(applicantId: string, data: SendMessageRequest): Promise<Applicant> {
    return this.request<Applicant>('post', `/applicants/${applicantId}/messages`, data);
  }

  async deleteApplicant(applicantId: string): Promise<void> {
    await this.request<void>('delete', `/applicants/${applicantId}`);
  }

  async getApplicantStatuses(params?: { companyId?: string[]; status?: string | string[] }): Promise<any> {
    const companyIds = this.normalizeCompanyIds(params?.companyId);
    
    const fetchOne = async (singleCompanyId?: string): Promise<any> => {
      const queryParams: any = {};
      if (singleCompanyId) queryParams.companyId = singleCompanyId;
      if (params?.status) queryParams.status = params.status;
      return this.request<any>('get', '/applicants/status-insights', undefined, queryParams);
    };

    if (companyIds.length <= 1) {
      return fetchOne(companyIds[0]);
    }

    const results = await Promise.all(companyIds.map(id => fetchOne(id)));

    if (results.every(r => Array.isArray(r))) {
      const unique = new Map<string, any>();
      results.flat().forEach(item => { if (item?._id) unique.set(item._id, item); });
      return Array.from(unique.values());
    }

    const aggregate: Record<string, number> = {};
    results.forEach(obj => {
      if (!obj || typeof obj !== "object") return;
      Object.entries(obj).forEach(([key, value]) => {
        if (typeof value === "number") aggregate[key] = (aggregate[key] || 0) + value;
      });
    });
    return aggregate;
  }

  async markAsSeen(applicantId: string): Promise<void> {
    await this.request<void>('patch', `/applicants/${applicantId}/seen`);
  }

  async getRejectionInsights(params?: { companyId?: string[] }): Promise<RejectionInsights> {
    const companyIds = this.normalizeCompanyIds(params?.companyId);

    const fetchOne = async (companyId?: string): Promise<RejectionInsights> => {
      const queryParams: any = {};
      if (companyId) queryParams.companyId = companyId;
      return this.request<RejectionInsights>('get', '/applicants/rejection-insights', undefined, queryParams);
    };

    if (companyIds.length <= 1) {
      return fetchOne(companyIds[0]);
    }

    const responses = await Promise.all(companyIds.map((companyId) => fetchOne(companyId)));
    const countsByReason = new Map<string, number>();

    responses.forEach((response) => {
      const items = Array.isArray(response) ? response : (response as any)?.data ?? [];

      items.forEach((item: any) => {
        const reason = String(item?.reason ?? '').trim() || 'Unknown';
        const count = Number(item?.count ?? 0);
        countsByReason.set(reason, (countsByReason.get(reason) ?? 0) + count);
      });
    });

    return Array.from(countsByReason.entries()).map(([reason, count]) => ({ reason, count }));
  }

  async getApplicantsByPhone(phone: string): Promise<Applicant[]> {
    if (!phone || !String(phone).trim()) return [];
    const queryParams = { phone: String(phone).trim(), PageCount: 'all' };
    const response = await this.request<any>('get', '/applicants', undefined, queryParams);
    return this.extractApplicants(response);
  }
}

export const applicantsService = new ApplicantsService();