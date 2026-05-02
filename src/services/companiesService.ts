import axios from '../config/axios';
import { getErrorMessage } from '../utils/errorHandler';
import type {
  Company,
  CreateCompanyRequest,
  UpdateCompanyRequest,
  MailSettings,
  EmailTemplate,
  CompanySet,
  CompanyStatus,
} from '../types/companies';

// Re-export types for convenience
export type {
  Company,
  CreateCompanyRequest,
  UpdateCompanyRequest,
  MailSettings,
  EmailTemplate,
  CompanySet,
  CompanyStatus,
} from '../types/companies';

// API Error class
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Response type for company endpoints
interface CompanyResponse {
  success?: boolean;
  data?: Company;
  company?: Company;
}

// Email Templates Service
class EmailTemplatesService {
  private async updateTemplates(
    companyId: string,
    templates: EmailTemplate[]
  ): Promise<EmailTemplate[]> {
    try {
      const cleanedTemplates = templates.map(({ createdAt, updatedAt, ...rest }) => rest);
      const response = await axios.put<{ mailSettings: { emailTemplates: EmailTemplate[] } }>(
        `/companies/${companyId}/settings/email-templates`,
        { 
          mailSettings: {
            emailTemplates: cleanedTemplates
          }
        }
      );
      const data = response.data;
      return data?.mailSettings?.emailTemplates ?? templates;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async createTemplate(
    companyId: string,
    template: Omit<EmailTemplate, '_id' | 'createdAt' | 'updatedAt'>,
    existingTemplates: EmailTemplate[] = []
  ): Promise<EmailTemplate> {
    const updatedTemplates = [...existingTemplates, template as EmailTemplate];
    const saved = await this.updateTemplates(companyId, updatedTemplates);
    const created = saved.find(t => t.name === template.name);
    if (!created) throw new ApiError("Failed to retrieve created template");
    return created;
  }

  async updateTemplate(
    companyId: string,
    templateId: string,
    template: Partial<EmailTemplate>,
    existingTemplates: EmailTemplate[] = []
  ): Promise<EmailTemplate> {
    const updatedTemplates = existingTemplates.map(t =>
      t._id === templateId ? { ...t, ...template } : t
    );
    await this.updateTemplates(companyId, updatedTemplates);
    const updated = updatedTemplates.find(t => t._id === templateId);
    if (!updated) throw new ApiError("Template not found after update");
    return updated;
  }

  async deleteTemplate(
    companyId: string,
    templateId: string,
    existingTemplates: EmailTemplate[] = []
  ): Promise<void> {
    const updatedTemplates = existingTemplates.filter(t => t._id !== templateId);
    await this.updateTemplates(companyId, updatedTemplates);
  }
}

// Companies Service
class CompaniesService {
  private extractCompanies(payload: any): Company[] {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && payload.data && Array.isArray(payload.data.data)) return payload.data.data;
    return [];
  }

  private normalizeCompanyIds(companyId?: string[]): string[] {
    if (!Array.isArray(companyId)) return [];
    return Array.from(new Set(companyId.map(id => String(id || '').trim()).filter(Boolean)));
  }

  private async fetchCompaniesPage(companyId?: string): Promise<Company[]> {
    const params: any = { deleted: 'false' };
    if (companyId) params.companyId = companyId;
    const response = await axios.get<{ data: Company[] }>('/companies', { params });
    return this.extractCompanies(response.data);
  }

  async getAllCompanies(companyId?: string[]): Promise<Company[]> {
    try {
      const normalizedIds = this.normalizeCompanyIds(companyId);
      
      if (normalizedIds.length <= 1) {
        return this.fetchCompaniesPage(normalizedIds[0]);
      }

      const companiesLists = await Promise.all(normalizedIds.map(id => this.fetchCompaniesPage(id)));
      const unique = new Map<string, Company>();
      companiesLists.flat().forEach(company => {
        if (company && company._id) unique.set(company._id, company);
      });
      return Array.from(unique.values());
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async getCompanyById(companyId: string): Promise<Company> {
    try {
      const response = await axios.get<CompanyResponse>(`/companies/${companyId}`, {
        params: { deleted: 'false' }
      });
      
      let maybe: Company | null = null;
      
      // Check for data in different response shapes
      if (response.data?.data && response.data.data._id) {
        maybe = response.data.data;
      } else if ((response.data as any)?.company && (response.data as any).company._id) {
        maybe = (response.data as any).company;
      } else if (response.data && (response.data as any)._id) {
        maybe = response.data as Company;
      } else {
        // Try to find any object with _id in the response
        const nested = Object.values(response.data || {}).find(
          (v: any) => v && typeof v === 'object' && v._id
        );
        if (nested) maybe = nested as Company;
      }

      if (!maybe || !maybe._id) {
        console.warn('getCompanyById: unexpected response shape', response.data);
        throw new ApiError('Company not found or invalid response format');
      }

      return maybe;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async createCompany(companyData: CreateCompanyRequest): Promise<Company> {
    try {
      const response = await axios.post<CompanyResponse>('/companies', companyData);
      
      let created: Company | null = null;
      
      // Extract company from different response shapes
      if (response.data?.data && response.data.data._id) {
        created = response.data.data;
      } else if ((response.data as any)?.company && (response.data as any).company._id) {
        created = (response.data as any).company;
      } else if (response.data && (response.data as any)._id) {
        created = response.data as Company;
      }

      if (!created || !created._id) {
        console.warn('createCompany: unexpected response shape', response.data);
        throw new ApiError('Failed to create company: Invalid response format');
      }

      return created;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async updateCompany(companyId: string, companyData: UpdateCompanyRequest): Promise<Company> {
    try {
      const response = await axios.put<CompanyResponse>(`/companies/${companyId}`, companyData);
      
      let updated: Company | null = null;
      
      if (response.data?.data && response.data.data._id) {
        updated = response.data.data;
      } else if ((response.data as any)?.company && (response.data as any).company._id) {
        updated = (response.data as any).company;
      } else if (response.data && (response.data as any)._id) {
        updated = response.data as Company;
      }
      
      if (!updated || !updated._id) {
        throw new ApiError('Failed to update company: Invalid response format');
      }
      
      return updated;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

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
  }

  async getCompaniesByIds(companyIds: string[]): Promise<Company[]> {
    try {
      const companies = await this.getAllCompanies(companyIds);
      return companies.filter(company => companyIds.includes(company._id));
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async getCompanySettings(companyId: string): Promise<CompanySet | null> {
    try {
      if (!companyId) return null;
      
      const response = await axios.get<{ data: CompanySet }>(`/companies/${companyId}/settings`);
      return response.data?.data ?? response.data ?? null;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async updateCompanySettings(companyId: string, settings: Partial<CompanySet>): Promise<CompanySet> {
    try {
      const response = await axios.put<{ data: CompanySet }>(`/companies/${companyId}/settings`, settings);
      const result = response.data?.data ?? response.data;
      
      if (!result) {
        throw new ApiError('Failed to update company settings');
      }
      
      return result;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async getCompanySettingsByCompany(companyId: string): Promise<any> {
    try {
      if (!companyId) return null;
      
      const response = await axios.get(`/companies/${companyId}/settings`);
      return response.data?.data ?? response.data ?? null;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async getMailSettings(companyId: string): Promise<MailSettings | null> {
    try {
      const response = await axios.get<{ data: MailSettings }>(`/companies/${companyId}/settings/mail`);
      return response.data?.data ?? response.data ?? null;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async updateMailSettings(companyId: string, mailSettings: Partial<MailSettings>): Promise<MailSettings> {
    try {
      const response = await axios.put<{ data: MailSettings }>(`/companies/${companyId}/settings/mail`, mailSettings);
      const result = response.data?.data ?? response.data;
      
      if (!result) {
        throw new ApiError('Failed to update mail settings');
      }
      
      return result;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async getCompanyStatuses(companyId: string): Promise<CompanyStatus[]> {
    try {
      const response = await axios.get<{ data: CompanyStatus[] }>(`/companies/${companyId}/statuses`);
      return response.data?.data ?? response.data ?? [];
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async updateCompanyStatuses(companyId: string, statuses: CompanyStatus[]): Promise<CompanyStatus[]> {
    try {
      const response = await axios.put<{ data: CompanyStatus[] }>(`/companies/${companyId}/statuses`, { statuses });
      const result = response.data?.data ?? response.data;
      
      if (!result) {
        throw new ApiError('Failed to update company statuses');
      }
      
      return result;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async updateCompanyInterviewSettings(companyId: string, data: any): Promise<any> {
    try {
      const response = await axios.put(`/companies/${companyId}/settings/interview`, data);
      return response.data?.data ?? response.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async updateCompanyRejectionReasons(companyId: string, data: { rejectReasons: string[] }): Promise<any> {
    try {
      const response = await axios.put(`/companies/${companyId}/settings/rejection-reasons`, data);
      return response.data?.data ?? response.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async updateCompanyApplicantPages(companyId: string, data: { applicantPages: any[] }): Promise<any> {
    try {
      const response = await axios.put(`/companies/${companyId}/settings/applicant-pages`, data);
      return response.data?.data ?? response.data;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }
}

// Export singleton instances
export const companiesService = new CompaniesService();
export const emailTemplatesService = new EmailTemplatesService();