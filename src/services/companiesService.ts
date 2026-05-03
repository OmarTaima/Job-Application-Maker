// services/companiesService.ts
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
  InterviewSettings,
} from '../types/companies';

// Re-export types
export type {
  Company,
  CreateCompanyRequest,
  UpdateCompanyRequest,
  MailSettings,
  EmailTemplate,
  CompanySet,
  CompanyStatus,
  InterviewAnswerType,
  InterviewGroup,
  InterviewQuestion,
} from '../types/companies';

// ===== Custom Error =====
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ===== Response Helpers =====
type ApiResponse<T> = { data?: T } | T;

function extractData<T>(response: ApiResponse<T>, fallback?: T): T {
  const result = (response as any)?.data ?? response;
  if (!result && fallback !== undefined) return fallback;
  if (!result) throw new ApiError('Invalid response format');
  return result as T;
}

function extractCompany(response: any): Company {
  const company = response?.data ?? response?.company ?? response;
  if (!company?._id) {
    console.warn('Unexpected company response shape:', response);
    throw new ApiError('Company not found or invalid response format');
  }
  return company;
}

// ===== Companies Service (clean, focused) =====
class CompaniesService {
  private async request<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: any,
    params?: any
  ): Promise<T> {
    try {
      const config = { params };
      const response = method === 'get' || method === 'delete'
        ? await axios[method](url, config)
        : await axios[method](url, data, config);
      
      return extractData<T>(response.data);
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  // ===== Company CRUD =====
  async getCompanyById(companyId: string): Promise<Company> {
    const response = await this.request<any>('get', `/companies/${companyId}`, undefined, { deleted: 'false' });
    return extractCompany(response);
  }

  async getAllCompanies(companyIds?: string[]): Promise<Company[]> {
    if (!companyIds?.length) {
      const response = await this.request<Company[]>('get', '/companies', undefined, { deleted: 'false' });
      return Array.isArray(response) ? response : [];
    }

    const uniqueIds = [...new Set(companyIds.filter(Boolean))];
    if (uniqueIds.length === 1) {
      const response = await this.request<Company[]>('get', '/companies', undefined, { deleted: 'false', companyId: uniqueIds[0] });
      return Array.isArray(response) ? response : [];
    }

    const companiesLists = await Promise.all(
      uniqueIds.map(id => this.request<Company[]>('get', '/companies', undefined, { deleted: 'false', companyId: id }))
    );
    
    const uniqueCompanies = new Map<string, Company>();
    companiesLists.flat().forEach(company => {
      if (company?._id) uniqueCompanies.set(company._id, company);
    });
    return Array.from(uniqueCompanies.values());
  }

  async getCompaniesByIds(companyIds: string[]): Promise<Company[]> {
    const companies = await this.getAllCompanies(companyIds);
    return companies.filter(company => companyIds.includes(company._id));
  }

  async createCompany(companyData: CreateCompanyRequest): Promise<Company> {
    const response = await this.request<any>('post', '/companies', companyData);
    return extractCompany(response);
  }

  async updateCompany(companyId: string, companyData: UpdateCompanyRequest): Promise<Company> {
    const response = await this.request<any>('put', `/companies/${companyId}`, companyData);
    return extractCompany(response);
  }

  async deleteCompany(companyId: string): Promise<void> {
    await this.request<void>('delete', `/companies/${companyId}`);
  }

  // ===== Settings =====
  async getCompanySettings(companyId: string): Promise<CompanySet | null> {
    try {
      return await this.request<CompanySet>('get', `/companies/${companyId}/settings`);
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  async updateCompanySettings(companyId: string, settings: Partial<CompanySet>): Promise<CompanySet> {
    return this.request<CompanySet>('put', `/companies/${companyId}/settings`, settings);
  }

  // ===== Mail Settings =====
  async getMailSettings(companyId: string): Promise<MailSettings | null> {
    try {
      return await this.request<MailSettings>('get', `/companies/${companyId}/settings/mail`);
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  async updateMailSettings(companyId: string, mailSettings: Partial<MailSettings>): Promise<MailSettings> {
    return this.request<MailSettings>('put', `/companies/${companyId}/settings/mail`, mailSettings);
  }

  // ===== Statuses =====
  async getCompanyStatuses(companyId: string): Promise<CompanyStatus[]> {
    const response = await this.request<CompanyStatus[]>('get', `/companies/${companyId}/statuses`);
    return Array.isArray(response) ? response : [];
  }

  // services/companiesService.ts - Update updateCompanyStatuses

// Change from companyId to settingsId
async updateCompanyStatuses(settingsId: string, statuses: CompanyStatus[]): Promise<CompanyStatus[]> {
  const response = await this.request<CompanyStatus[]>('put', `/companies/${settingsId}/settings`, { statuses });
  return Array.isArray(response) ? response : [];
}

  // ===== Interview Settings =====
  async updateCompanyInterviewSettings(settingsId: string, data: { interviewSettings: InterviewSettings }): Promise<any> {
  return this.request<any>('put', `/companies/${settingsId}/settings/interview`, data);
}

  // ===== Rejection Reasons =====
async updateCompanyRejectionReasons(settingsId: string, rejectReasons: string[]): Promise<unknown> {
  return this.request<unknown>('put', `/companies/${settingsId}/settings/rejection-reasons`, { rejectReasons });
}

  // ===== Applicant Pages =====
  async updateCompanyApplicantPages(settingsId: string, applicantPages: unknown[]): Promise<unknown> {
    return this.request<unknown>('put', `/companies/${settingsId}/settings/applicant-pages`, { applicantPages });
  }
}

// ===== Email Templates Service =====
class EmailTemplatesService {
  private async updateTemplates(settingsId: string, templates: EmailTemplate[]): Promise<EmailTemplate[]> {
    const cleanedTemplates = templates.map(({ createdAt, updatedAt, ...rest }) => rest);
    const response = await axios.put<{ mailSettings: { emailTemplates: EmailTemplate[] } }>(
      `/companies/${settingsId}/settings/email-templates`,
      { mailSettings: { emailTemplates: cleanedTemplates } }
    );
    return response.data?.mailSettings?.emailTemplates ?? templates;
  }

  async createTemplate(
    settingsId: string,
    template: Omit<EmailTemplate, '_id' | 'createdAt' | 'updatedAt'>,
    existingTemplates: EmailTemplate[] = []
  ): Promise<EmailTemplate> {
    const newTemplate = { ...template } as EmailTemplate;
    const updatedTemplates = [...existingTemplates, newTemplate];
    const saved = await this.updateTemplates(settingsId, updatedTemplates);
    const created = saved.find(t => t.name === template.name);
    if (!created) throw new ApiError('Failed to retrieve created template');
    return created;
  }

  async updateTemplate(
    settingsId: string,
    templateId: string,
    updates: Partial<EmailTemplate>,
    existingTemplates: EmailTemplate[] = []
  ): Promise<EmailTemplate> {
    const updatedTemplates = existingTemplates.map(t =>
      t._id === templateId ? { ...t, ...updates } : t
    );
    await this.updateTemplates(settingsId, updatedTemplates);
    const updated = updatedTemplates.find(t => t._id === templateId);
    if (!updated) throw new ApiError('Template not found after update');
    return updated;
  }

  async deleteTemplate(
    settingsId: string,
    templateId: string,
    existingTemplates: EmailTemplate[] = []
  ): Promise<void> {
    const updatedTemplates = existingTemplates.filter(t => t._id !== templateId);
    await this.updateTemplates(settingsId, updatedTemplates);
  }
}

// ===== Singleton Exports =====
export const companiesService = new CompaniesService();
export const emailTemplatesService = new EmailTemplatesService();