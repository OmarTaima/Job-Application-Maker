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
  // Get all companies, optionally filtered by companyIds (server expects either companyId or companyIds query)
  async getAllCompanies(companyIds?: string[]): Promise<Company[]> {
    try {
      const params: any = {};
      if (companyIds && companyIds.length > 0) {
        if (companyIds.length === 1) {
          params.companyId = companyIds[0];
        } else {
          params.companyIds = companyIds.join(",");
        }
      }

      // Always request only active companies (use string to ensure server-side parsing)
      params.isActive = "true";

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
      // Request the company only if it's active (use string to ensure server-side parsing)
      const response = await axios.get<CompanyResponse>(
        `/companies/${companyId}`,
        { params: { isActive: "true" } }
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

  // Create company
  async createCompany(companyData: CreateCompanyRequest): Promise<Company> {
    try {
      const response = await axios.post<CompanyResponse>(
        "/companies",
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
  async getCompaniesByIds(companyIds: string[]): Promise<Company[]> {
    try {
      // Let the server filter by IDs and active flag when possible
      const companies = await this.getAllCompanies(companyIds);
      // Fallback: if server ignored companyIds, still filter locally
      return companies.filter(company => companyIds.includes(company._id));
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },
};
