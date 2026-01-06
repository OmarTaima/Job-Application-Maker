import axios from "../config/axios";

// Types
export interface Company {
  _id: string;
  name: string;
  address?: string;
  industry?: string;
  contactEmail?: string;
  phone?: string;
  website?: string;
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
  description?: string;
}

export interface UpdateCompanyRequest {
  name?: string;
  address?: string;
  industry?: string;
  contactEmail?: string;
  phone?: string;
  website?: string;
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
        error.response?.data?.message || "Failed to fetch companies",
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
        error.response?.data?.message || "Failed to fetch company",
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
        error.response?.data?.message || "Failed to create company",
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
        error.response?.data?.message || "Failed to update company",
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
        error.response?.data?.message || "Failed to delete company",
        error.response?.status,
        error.response?.data?.details
      );
    }
  },
};
