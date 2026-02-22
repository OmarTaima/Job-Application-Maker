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
  };
  // Some endpoints return the settings wrapped under `settings.mailSettings`
  settings?: {
    mailSettings?: {
      availableMails?: string[];
      defaultMail?: string | null;
      companyDomain?: string | null;
    };
  };
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
  };
}

export interface UpdateCompanySettingsRequest {
  mailSettings?: {
    availableMails?: string[];
    defaultMail?: string | null;
    companyDomain?: string | null;
  };
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

// Companies API service
export const companiesService = {
  // Get all companies, optionally filtered by companyId (server expects either companyId or companyId query)
  async getAllCompanies(companyId?: string[]): Promise<Company[]> {
    try {
      const params: any = {};
      if (companyId && companyId.length > 0) {
        if (companyId.length === 1) {
          params.companyId = companyId[0];
        } else {
          params.companyId = companyId.join(",");
        }
      }

      // Always request only non-deleted companies (use string to ensure server-side parsing)
      params.deleted = "false";

      const response = await axios.get<CompaniesResponse>("/companies", { params });
      return response.data.data;
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

  
  async updateCompanySettings(id: string, payload: UpdateCompanySettingsRequest): Promise<CompanySettings> {
    try {
      const body = payload?.mailSettings ? { mailSettings: payload.mailSettings } : {};
      const response = await axios.put<any>(`/companies/${id}/settings`, body);
      const data = response.data?.data ?? response.data ?? null;
      if (!data) return data as CompanySettings;
      if ((data as any).mailSettings) {
        return { _id: (data as any)._id, company: (data as any).company ?? (data as any)._id, mailSettings: (data as any).mailSettings } as CompanySettings;
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
