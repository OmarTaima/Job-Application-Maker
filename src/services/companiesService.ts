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
};
