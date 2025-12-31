import { API_CONFIG, tokenStorage } from "../config/api";

// Types
export interface Company {
  _id: string;
  name: string;
  address?: string;
  industry?: string;
  contactEmail?: string;
  phone?: string;
  createdAt?: string;
  __v?: number;
}

export interface CreateCompanyRequest {
  name: string;
  address?: string;
  industry?: string;
  contactEmail?: string;
  phone?: string;
}

export interface UpdateCompanyRequest {
  name?: string;
  address?: string;
  industry?: string;
  contactEmail?: string;
  phone?: string;
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

// Helper function to make authenticated requests
async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = tokenStorage.getAccessToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  return response;
}

// Companies API service
export const companiesService = {
  // Get all companies
  async getAllCompanies(): Promise<Company[]> {
    try {
      const response = await fetchWithAuth("/companies");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to fetch companies",
          response.status,
          errorData.details
        );
      }

      const data: CompaniesResponse = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while fetching companies");
    }
  },

  // Get company by ID
  async getCompanyById(companyId: string): Promise<Company> {
    try {
      const response = await fetchWithAuth(`/companies/${companyId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to fetch company",
          response.status,
          errorData.details
        );
      }

      const data: CompanyResponse = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while fetching company");
    }
  },

  // Create company
  async createCompany(companyData: CreateCompanyRequest): Promise<Company> {
    try {
      const response = await fetchWithAuth("/companies", {
        method: "POST",
        body: JSON.stringify(companyData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to create company",
          response.status,
          errorData.details
        );
      }

      const data: CompanyResponse = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while creating company");
    }
  },

  // Update company
  async updateCompany(
    companyId: string,
    companyData: UpdateCompanyRequest
  ): Promise<Company> {
    try {
      const response = await fetchWithAuth(`/companies/${companyId}`, {
        method: "PUT",
        body: JSON.stringify(companyData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to update company",
          response.status,
          errorData.details
        );
      }

      const data: CompanyResponse = await response.json();
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while updating company");
    }
  },

  // Delete company
  async deleteCompany(companyId: string): Promise<void> {
    try {
      const response = await fetchWithAuth(`/companies/${companyId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || "Failed to delete company",
          response.status,
          errorData.details
        );
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error while deleting company");
    }
  },
};
