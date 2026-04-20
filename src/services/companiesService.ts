import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";

// Types
export interface Company {
  _id: string;
  name: string | { en: string; ar: string };
  address?: string | Array<{ en: string; ar: string; location: string }>;
  industry?: string;
  contactEmail?: string;
  phone?: string;
  website?: string;
  logoPath?: string;
  isActive?: boolean;
  description?: string | { en: string; ar: string };
  createdAt?: string;
  __v?: number;
}

export interface CreateCompanyRequest {
  name: { en: string; ar: string };
  description?: { en: string; ar: string };
  contactEmail: string;
  phone?: string;
  address?: Array<{ en: string; ar: string; location: string }>;
  website?: string;
  logoPath?: string;
}

export interface UpdateCompanyRequest {
  name?: { en: string; ar: string };
  description?: { en: string; ar: string };
  contactEmail?: string;
  phone?: string;
  address?: Array<{ en: string; ar: string; location: string }>;
  website?: string;
  logoPath?: string;
  isActive?: boolean;
}

export interface CompaniesResponse {
  success: boolean;
  data: Company[];
}

export interface CompanyResponse {
  success: boolean;
  data: Company;
}

export type InterviewAnswerType =
  | "text"
  | "number"
  | "radio"
  | "checkbox"
  | "dropdown"
  | "tags";

export interface InterviewQuestion {
  question: string;
  score: number;
  answerType: InterviewAnswerType;
  choices?: string[];
}

export interface InterviewGroup {
  name: string;
  questions: InterviewQuestion[];
}

export interface InterviewSettings {
  groups: InterviewGroup[];
}

export interface CompanySettings {
  _id: string;
  company: string;
  // Server may return either a dedicated settings object or a full company
  // object with nested settings. Include common possible fields to make
  // type-checking in callers more ergonomic.
  mailSettings?: {
    availableMails?: string[];
    // aliases and variants that backend might use
    available_senders?: string[];
    availableSenders?: string[];
    defaultMail?: string | null;
    companyDomain?: string | null;
    resendApiKey?: string | null;
    sendApplicantDataMail?: boolean;
    webhookSecret?: string | null;
    applicantEmailTemplate?: {
      subject?: string;
      body?: string | null;
    };
  };
  // Some endpoints return the settings wrapped under `settings.mailSettings`
  settings?: {
    mailSettings?: {
      availableMails?: string[];
      defaultMail?: string | null;
      companyDomain?: string | null;
      resendApiKey?: string | null;
      sendApplicantDataMail?: boolean;
      webhookSecret?: string | null;
      applicantEmailTemplate?: {
        subject?: string;
        body?: string | null;
      };
    };
    interviewSettings?: InterviewSettings;
  };
  defaultColorGradient?: string[];
  rejectReasons?: string[];
  interviewSettings?: InterviewSettings;
  // Company-like fields that may be present when the API returns a full company
  // object from the settings query.
  name?: string | { en: string; ar?: string };
  contactEmail?: string;
  email?: string;
  availableMails?: string[];
  available_senders?: string[];
  availableSenders?: string[];
  defaultMail?: string | null;
  companyDomain?: string | null;
  createdAt?: string;
}

export interface CreateCompanySettingsRequest {
  company: string;
  mailSettings?: {
    availableMails?: string[];
    defaultMail?: string | null;
    companyDomain?: string | null;
    resendApiKey?: string | null;
    sendApplicantDataMail?: boolean;
    webhookSecret?: string | null;
    applicantEmailTemplate?: {
      subject?: string;
      body?: string | null;
    };
  };
  interviewSettings?: InterviewSettings;
  defaultColorGradient?: string[];
  rejectReasons?: string[];
}

export interface UpdateCompanySettingsRequest {
  mailSettings?: {
    availableMails?: string[];
    defaultMail?: string | null;
    companyDomain?: string | null;
    resendApiKey?: string | null;
    sendApplicantDataMail?: boolean;
    webhookSecret?: string | null;
    applicantEmailTemplate?: {
      subject?: string;
      body?: string | null;
    };
  };
  interviewSettings?: InterviewSettings;
  defaultColorGradient?: string[];
  rejectReasons?: string[];
}

export interface UpdateInterviewSettingsRequest {
  groups: InterviewGroup[];
}

export interface UpdateRejectionReasonsRequest {
  rejectReasons: string[];
}

// API Error class
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

const normalizeInterviewSettings = (payload: any): InterviewSettings | null => {
  const root = payload?.result ?? payload?.data ?? payload;
  const candidate =
    root?.interviewSettings ??
    root?.settings?.interviewSettings ??
    (Array.isArray(root?.groups) ? root : null);

  const normalizeQuestion = (q: any): InterviewQuestion => {
    const score = Number(q?.score);
    const answerType =
      q?.answerType && ["text", "number", "radio", "checkbox", "dropdown", "tags"].includes(q.answerType)
        ? q.answerType
        : "text";

    return {
      question: String(q?.question ?? ""),
      score: Number.isFinite(score) ? score : 0,
      answerType,
      choices: Array.isArray(q?.choices)
        ? (q.choices as any[]).map((c) => String(c ?? "").trim()).filter(Boolean)
        : [],
    };
  };

  const normalizeGroup = (g: any): InterviewGroup => ({
    name: String(g?.name ?? ""),
    questions: Array.isArray(g?.questions) ? g.questions.map(normalizeQuestion) : [],
  });

  if (candidate && Array.isArray(candidate.groups)) {
    return { groups: candidate.groups.map(normalizeGroup) };
  }

  if (Array.isArray(candidate)) {
    return { groups: candidate.map(normalizeGroup) };
  }

  return null;
};

// Companies API service
export const companiesService = {
  // Get all companies, optionally filtered by companyId (server expects either companyId or companyId query)
  async getAllCompanies(companyId?: string[]): Promise<Company[]> {
    try {
      const normalizedCompanyIds = Array.isArray(companyId)
        ? Array.from(new Set(companyId.map((id) => String(id || "").trim()).filter(Boolean)))
        : [];

      const extractCompanies = (payload: any): Company[] => {
        if (Array.isArray(payload)) return payload as Company[];
        if (payload && Array.isArray(payload.data)) return payload.data as Company[];
        if (payload && payload.data && Array.isArray(payload.data.data)) return payload.data.data as Company[];
        return [];
      };

      const fetchOne = async (singleCompanyId?: string): Promise<Company[]> => {
        const params: any = { deleted: "false" };
        if (singleCompanyId) params.companyId = singleCompanyId;
        const response = await axios.get<CompaniesResponse>("/companies", { params });
        return extractCompanies(response.data);
      };

      if (normalizedCompanyIds.length <= 1) {
        return fetchOne(normalizedCompanyIds[0]);
      }

      const companyLists = await Promise.all(normalizedCompanyIds.map((id) => fetchOne(id)));
      const unique = new Map<string, Company>();
      companyLists.flat().forEach((company) => {
        if (company && company._id) unique.set(company._id, company);
      });
      return Array.from(unique.values());
    } catch (error: any) {
      // If server returns 404 for settings, treat as "no settings yet" and return null

      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Get company by ID
  async getCompanyById(companyId: string): Promise<Company> {
    try {
      // Request the company only if it's not deleted (use string to ensure server-side parsing)
      const response = await axios.get<CompanyResponse>(
        `/companies/${companyId}`,
        { params: { deleted: "false" } }
      );
      // Normalize possible response shapes:
      // - { data: Company }
      // - { company: Company }
      // - { data: { data: Company } }
      // - directly the Company object
      let maybe: any = response.data?.data ?? (response.data as any)?.company ?? response.data ?? null;

      if (maybe && maybe.data && typeof maybe.data === 'object' && maybe.data._id) {
        maybe = maybe.data;
      }

      if (maybe && maybe.company && typeof maybe.company === 'object') {
        maybe = maybe.company;
      }

      if (!maybe) {
        // As a last resort, try to find a nested object with _id
        const nested = Object.values(response.data || {}).find((v: any) => v && typeof v === 'object' && v._id);
        if (nested) maybe = nested;
      }

      if (!maybe) {
        console.warn("companiesService.getCompanyById: unexpected response shape", response.data);
        // Throw to let callers handle the error uniformly
        throw new ApiError(getErrorMessage(response as any), response.status ?? undefined, response as any);
      }

      return maybe as Company;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Create company
  async createCompany(companyData: CreateCompanyRequest): Promise<Company> {
    try {
      const response = await axios.post<CompanyResponse>("/companies", companyData);

      // Backend may return the created resource in different shapes:
      // { data: Company }, { company: Company }, or directly the Company
      // response.data can come in different shapes; cast to any when checking non-standard fields
      let created: any = response.data?.data ?? (response.data as any)?.company ?? response.data ?? null;

      if (!created) {
        console.warn("companiesService.createCompany: unexpected response shape", response.data);
        return response.data as any;
      }

      // If response was { message: "..", company: { ... } }, our created will be that inner company.
      // Ensure we return the actual Company object (not a wrapper) to callers.
      if (created.company && typeof created.company === "object") {
        created = created.company;
      }

      if (!created._id) {
        console.warn("companiesService.createCompany: created company missing _id", created);
      }

      return created as Company;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Update company
  async updateCompany(
    companyId: string,
    companyData: UpdateCompanyRequest
  ): Promise<Company> {
    try {
      const response = await axios.put<CompanyResponse>(
        `/companies/${companyId}`,
        companyData
      );
      return response.data.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Delete company
  async deleteCompany(companyId: string): Promise<void> {
    try {
      await axios.delete(`/companies/${companyId}`);
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Get multiple companies by IDs
  async getCompaniesByIds(companyId: string[]): Promise<Company[]> {
    try {
      // Let the server filter by IDs and active flag when possible
      const companies = await this.getAllCompanies(companyId);
      // Fallback: if server ignored companyId, still filter locally
      return companies.filter(company => companyId.includes(company._id));
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  // Company settings endpoints
  async getCompanySettingsByCompany(companyId: string): Promise<CompanySettings | null> {
    try {
      if (!companyId) return null;

      // Prefer fetching the authoritative company object by ID instead of
      // querying `/companies?company=...` which is unreliable / unnecessary.
      try {
        const company = await this.getCompanyById(companyId);
        return company as any;
      } catch (err: any) {
        // If company not found, return null; otherwise rethrow
        if (err instanceof ApiError && err.statusCode === 404) return null;
        throw err;
      }
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },



 

  async updateCompanyInterviewSettings(
    companyId: string,
    payload: UpdateInterviewSettingsRequest
  ): Promise<InterviewSettings> {
    try {
      const groups = Array.isArray(payload?.groups) ? payload.groups : [];
      let response: any;
      const hasValidationDetail = (error: any, fieldName: string): boolean => {
        const details = error?.response?.data?.details;
        if (!Array.isArray(details)) return false;
        return details.some((detail: any) => {
          const path = Array.isArray(detail?.path) ? detail.path : [];
          return path.includes(fieldName);
        });
      };

      try {
        response = await axios.put<any>(
          `/companies/${encodeURIComponent(companyId)}/settings/interview`,
          { interviewSettings: { groups } }
        );
      } catch (error: any) {
        const status = error?.response?.status;
        const isValidation = status === 400 || status === 422;

        if (isValidation && hasValidationDetail(error, "interviewSettings")) {
          // Some deployments validate this route against a direct interview payload.
          response = await axios.put<any>(
            `/companies/${encodeURIComponent(companyId)}/settings/interview`,
            { groups }
          );
        } else if (status === 404) {
          try {
            response = await axios.put<any>(
              "/settings/interview",
              { interviewSettings: { groups } },
              { params: { companyId } }
            );
          } catch (fallbackError: any) {
            const fallbackStatus = fallbackError?.response?.status;
            const fallbackValidation = fallbackStatus === 400 || fallbackStatus === 422;

            if (fallbackValidation && hasValidationDetail(fallbackError, "interviewSettings")) {
              response = await axios.put<any>(
                "/settings/interview",
                { groups },
                { params: { companyId } }
              );
            } else {
              throw fallbackError;
            }
          }
        } else {
          throw error;
        }
      }

      const normalized = normalizeInterviewSettings(response.data);
      if (normalized) return normalized;
      return { groups };
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  async updateCompanyRejectionReasons(
    companyId: string,
    payload: UpdateRejectionReasonsRequest
  ): Promise<CompanySettings> {
    try {
      const rejectReasons = Array.isArray(payload?.rejectReasons)
        ? payload.rejectReasons.map((reason) => String(reason ?? "").trim()).filter(Boolean)
        : [];

      let response: any;
      try {
        response = await axios.put<any>(
          `/companies/${encodeURIComponent(companyId)}/settings/rejection-reasons`,
          { rejectReasons }
        );
      } catch (error: any) {
        // Keep backward compatibility for deployments that still accept only the generic settings endpoint.
        if (error?.response?.status === 404) {
          response = await axios.put<any>(
            `/companies/${encodeURIComponent(companyId)}/settings`,
            { rejectReasons }
          );
        } else {
          throw error;
        }
      }

      const data = response.data?.result ?? response.data?.data ?? response.data ?? {};
      const normalizedReasons = Array.isArray((data as any)?.rejectReasons)
        ? (data as any).rejectReasons
            .map((reason: any) => String(reason ?? "").trim())
            .filter(Boolean)
        : rejectReasons;

      return {
        _id: (data as any)?._id ?? companyId,
        company:
          (data as any)?.company ??
          (data as any)?.companyId ??
          companyId,
        rejectReasons: normalizedReasons,
        mailSettings: (data as any)?.mailSettings,
        interviewSettings: (data as any)?.interviewSettings,
        defaultColorGradient: (data as any)?.defaultColorGradient,
      } as CompanySettings;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

  async updateCompanySettings(id: string, payload: UpdateCompanySettingsRequest): Promise<CompanySettings> {
    try {
      const body: any = {};
      if (payload?.mailSettings) body.mailSettings = payload.mailSettings;
      if (payload?.interviewSettings) body.interviewSettings = payload.interviewSettings;
      if (payload?.defaultColorGradient) body.defaultColorGradient = payload.defaultColorGradient;
      if (payload?.rejectReasons) body.rejectReasons = payload.rejectReasons;

      const response = await axios.put<any>(`/companies/${id}/settings`, body);
      const data = response.data?.data ?? response.data ?? null;
      if (!data) return data as CompanySettings;

      if ((data as any).mailSettings || (data as any).interviewSettings) {
        return {
          _id: (data as any)._id,
          company: (data as any).company ?? (data as any)._id,
          mailSettings: (data as any).mailSettings,
          interviewSettings: (data as any).interviewSettings,
          defaultColorGradient: (data as any).defaultColorGradient,
          rejectReasons: (data as any).rejectReasons,
        } as CompanySettings;
      }

      return data as CompanySettings;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },

 
};
