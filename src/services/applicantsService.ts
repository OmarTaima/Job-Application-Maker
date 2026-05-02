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
} from '../types/applicants';
import { ApiError } from '../types/applicants';

// Re-export types for convenience
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
  Interview,
  InterviewAnswer,
} from '../types/applicants';

// Re-export ApiError
export { ApiError } from '../types/applicants';

class ApplicantsService {
  private normalizeInterviewQuestions(questions: any): InterviewAnswer[] {
    if (!Array.isArray(questions)) return [];

    return questions.map((q: any) => ({
      question: String(q?.question || '').trim(),
      score: Number(q?.score ?? 0),
      achievedScore: Math.max(
        0,
        Number.isFinite(Number(q?.achievedScore))
          ? Number(q?.achievedScore)
          : 0
      ),
      notes: q?.notes ?? '',
      answerType: q?.answerType || 'text',
      choices: Array.isArray(q?.choices) ? q.choices : [],
    }));
  }

  private toScheduleInterviewItem(
    applicantId: any,
    data: ScheduleInterviewRequest
  ): BulkScheduleInterviewItem {
    const rawApplicantId =
      typeof applicantId === 'object'
        ? applicantId?._id || applicantId?.id || ''
        : applicantId;

    const item: any = {
      applicantId: String(rawApplicantId || '').trim(),
    };

    const allowedKeys: Array<
      | 'scheduledAt'
      | 'conductedBy'
      | 'scheduledBy'
      | 'description'
      | 'location'
      | 'videoLink'
      | 'address'
      | 'type'
      | 'notes'
      | 'status'
    > = [
      'scheduledAt',
      'conductedBy',
      'scheduledBy',
      'description',
      'location',
      'videoLink',
      'address',
      'type',
      'notes',
      'status',
    ];

    allowedKeys.forEach((key) => {
      const value = (data as any)?.[key];
      if (value !== undefined) {
        item[key] = value;
      }
    });

    item.questions = this.normalizeInterviewQuestions((data as any)?.questions);

    return item as BulkScheduleInterviewItem;
  }

  private extractApplicantFromSchedulePayload(
    payload: any,
    applicantId: string
  ): any {
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
        const nestedApplicantId = String(
          candidate.applicant?._id || candidate.applicant?.id || ''
        );
        if (nestedApplicantId && nestedApplicantId === targetId) {
          return candidate.applicant;
        }
      }
    }

    return queue.find((value: any) => Array.isArray(value?.interviews));
  }

  /**
   * Get all applicants
   */
  async getAllApplicants(
    companyId?: string[],
    jobPositionId?: string | string[],
    status?: string | string[],
    fields?: string | string[],
    departmentId?: string[]
  ): Promise<Applicant[]> {
    try {
      const normalizedCompanyIds = Array.isArray(companyId)
        ? Array.from(new Set(companyId.map((id) => String(id || "").trim()).filter(Boolean)))
        : [];

      const paramsBase: any = {};
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
      paramsBase.deleted = false;

      const collectFromOne = async (opts?: { companyId?: string; jobPositionId?: string }) => {
        const result: Applicant[] = [];
        let currentPage = 1;
        let totalPages = 1;

        do {
          const params = { ...paramsBase, page: currentPage, PageCount: 'all' } as any;
          if (opts?.companyId) params.companyId = opts.companyId;
          if (opts?.jobPositionId) params.jobPositionId = opts.jobPositionId;
          if (departmentId && departmentId.length > 0) params.departmentId = departmentId.join(",");
          const response = await axios.get("/applicants", { params });
          const payload = response.data;

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

          if (params.PageCount === 'all') {
            totalPages = 1;
          } else {
            if (payload && payload.TotalCount && payload.PageCount) {
              totalPages = Math.ceil(payload.TotalCount / payload.PageCount);
            } else if (payload && payload.page && typeof payload.page === 'string') {
              const match = payload.page.match(/\d+\s+of\s+(\d+)/);
              if (match) {
                totalPages = parseInt(match[1], 10);
              }
            }
          }

          currentPage++;
        } while (currentPage <= totalPages);

        return result;
      };

      let jobIds: string[] | undefined;
      if (Array.isArray(jobPositionId)) jobIds = jobPositionId;
      else if (typeof jobPositionId === 'string' && jobPositionId.includes(',')) {
        jobIds = jobPositionId.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (typeof jobPositionId === 'string' && jobPositionId.trim()) {
        jobIds = [jobPositionId.trim()];
      }

      let allApplicants: Applicant[] = [];
      if (normalizedCompanyIds.length > 0 && jobIds && jobIds.length > 0) {
        const sets = await Promise.all(
          normalizedCompanyIds.flatMap((cid) =>
            jobIds.map((jid) => collectFromOne({ companyId: cid, jobPositionId: jid }))
          )
        );
        const combined = sets.flat();
        const uniqueMap: Record<string, Applicant> = {};
        combined.forEach((a) => {
          if (a && a._id) uniqueMap[a._id] = a;
        });
        allApplicants = Object.values(uniqueMap);
      } else if (normalizedCompanyIds.length > 0) {
        const sets = await Promise.all(normalizedCompanyIds.map((cid) => collectFromOne({ companyId: cid })));
        const combined = sets.flat();
        const uniqueMap: Record<string, Applicant> = {};
        combined.forEach((a) => {
          if (a && a._id) uniqueMap[a._id] = a;
        });
        allApplicants = Object.values(uniqueMap);
      } else if (jobIds && jobIds.length > 0) {
        const sets = await Promise.all(jobIds.map((jid) => collectFromOne({ jobPositionId: jid })));
        const combined = sets.flat();
        const uniqueMap: Record<string, Applicant> = {};
        combined.forEach((a) => {
          if (a && a._id) uniqueMap[a._id] = a;
        });
        allApplicants = Object.values(uniqueMap);
      } else {
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
      let maybe: any = response.data?.data ?? (response.data as any)?.applicant ?? response.data ?? null;

      if (!maybe || (typeof maybe === 'object' && !('_id' in maybe))) {
        const nested = Object.values(response.data || {}).find((v: any) => v && typeof v === 'object' && v._id);
        if (nested) maybe = nested;
      }

      if (!maybe) {
        console.warn('applicantsService.getApplicantById: unexpected response shape', response.data);
        throw new ApiError(getErrorMessage(response as any), response.status ?? undefined, response as any);
      }

      try {
        if (maybe.jobPositionId && typeof maybe.jobPositionId === 'object') {
          jobPositionsService.normalizeJobPosition(maybe.jobPositionId);
        }
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
   * Create a new applicant
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
      const normalizedData: ScheduleInterviewRequest = {
        ...data,
        questions: this.normalizeInterviewQuestions((data as any)?.questions),
      };

      const item = this.toScheduleInterviewItem(applicantId, normalizedData);
      let response: any;

      try {
        response = await axios.post(`/applicants/interviews`, [item]);
      } catch (error: any) {
        const status = Number(error?.response?.status || 0);
        if (![400, 404, 405, 422].includes(status)) {
          throw error;
        }

        response = await axios.post(`/applicants/${applicantId}/interviews`, normalizedData);
      }

      const payload = response.data?.data ?? response.data;
      const extractedApplicant = this.extractApplicantFromSchedulePayload(
        payload,
        applicantId
      );

      if (extractedApplicant && typeof extractedApplicant === 'object') {
        return extractedApplicant as Applicant;
      }

      if (Array.isArray(payload) && payload.length > 0) {
        return payload[0] as Applicant;
      }

      if (payload && typeof payload === 'object') {
        return payload as Applicant;
      }

      return { _id: applicantId } as Applicant;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Schedule interviews for multiple applicants
   */
  async scheduleBulkInterviews(
    payload: BulkScheduleInterviewRequest | BulkScheduleInterviewItem[]
  ): Promise<any> {
    try {
      const sourceItems: any[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.interviews)
        ? payload.interviews
        : [];

      const interviews = sourceItems
        .map((item: any) =>
          this.toScheduleInterviewItem(item?.applicantId, item || {})
        )
        .filter((item: any) => item.applicantId);

      if (interviews.length === 0) {
        throw new ApiError('At least one interview payload is required.');
      }

      const response = await axios.post('/applicants/interviews', interviews);
      return response.data?.data ?? response.data;
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
      const payload: any = {};
      const allowedKeys: Array<keyof UpdateInterviewStatusRequest> = [
        'scheduledAt',
        'scheduledBy',
        'startedAt',
        'endedAt',
        'conductedBy',
        'description',
        'location',
        'videoLink',
        'address',
        'type',
        'notes',
        'status',
      ];

      allowedKeys.forEach((key) => {
        const value = data?.[key];
        if (value !== undefined) {
          payload[key] = value;
        }
      });

      if (Array.isArray(data?.questions)) {
        payload.questions = this.normalizeInterviewQuestions(data.questions);
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
   * Batch update status for multiple applicants
   */
  async batchUpdateStatus(
    updates: Array<{ applicantId: string; status: string; notes?: string; reasons?: string[] }>
  ): Promise<any> {
    try {
      const payload = {
        items: updates
      };
      const response = await axios.put('/applicants/batch-status', payload);
      return response.data;
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

  /**
   * Get applicant status insights
   */
  async getApplicantStatuses(companyId?: string[], status?: string | string[]): Promise<any> {
    try {
      const normalizedCompanyIds = Array.isArray(companyId)
        ? Array.from(new Set(companyId.map((id) => String(id || "").trim()).filter(Boolean)))
        : [];

      const fetchOne = async (singleCompanyId?: string): Promise<any> => {
        const params: any = {};
        if (singleCompanyId) params.companyId = singleCompanyId;
        if (status) params.status = status;
        const response = await axios.get(`/applicants/status-insights`, { params });
        return response.data?.data ?? response.data;
      };

      if (normalizedCompanyIds.length <= 1) {
        return fetchOne(normalizedCompanyIds[0]);
      }

      const results = await Promise.all(normalizedCompanyIds.map((id) => fetchOne(id)));

      if (results.every((r) => Array.isArray(r))) {
        const unique = new Map<string, any>();
        results.flat().forEach((item: any) => {
          if (item && item._id) unique.set(item._id, item);
        });
        return Array.from(unique.values());
      }

      const aggregate: Record<string, number> = {};
      results.forEach((obj: any) => {
        if (!obj || typeof obj !== "object") return;
        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === "number") {
            aggregate[key] = (aggregate[key] || 0) + value;
          }
        });
      });
      return aggregate;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  /**
   * Mark an applicant as seen
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