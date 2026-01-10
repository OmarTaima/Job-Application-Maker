import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";

// Types
export interface Company {
  _id: string;
  name: string;
  address?: string;
  industry?: string;
  contactEmail?: string;
  phone?: string;
  website?: string;
  logoPath?: string;
  isActive?: boolean;
  description?: string;
  createdAt?: string;
  __v?: number;
}

export interface CreateCompanyRequest {
  name: string;
  address?: string;
  industry?: string;
  contactEmail?: string;
  phone?: string;
  website?: string;
  logoPath?: string;
  isActive?: boolean;
  description?: string;
}

export interface UpdateCompanyRequest {
  name?: string;
  address?: string;
  industry?: string;
  contactEmail?: string;
  phone?: string;
  website?: string;
  logoPath?: string;
  isActive?: boolean;
  description?: string;
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
  // Get all companies
  async getAllCompanies(): Promise<Company[]> {
    try {
      const response = await axios.get<CompaniesResponse>("/companies");
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
      const response = await axios.get<CompanyResponse>(
        `/companies/${companyId}`
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
      // Fetch companies individually and filter
      const allCompanies = await this.getAllCompanies();
      return allCompanies.filter(company => companyIds.includes(company._id));
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  },
};
