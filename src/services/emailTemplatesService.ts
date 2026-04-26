// services/emailTemplatesService.ts
import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";

export interface MailSettings {
  availableMails?: string[];
  defaultMail?: string | null;
  companyDomain?: string | null;
  resendApiKey?: string | null;
  sendApplicantDataMail?: boolean;
  webhookSecret?: string | null;
  applicantEmailTemplate?: {
    subject?: string;
    html?: string;
  };
  emailTemplates?: EmailTemplate[]; // Add this line
}

export interface EmailTemplate {
  _id?: string;
  name: string;
  subject: string;
  html: string;
  createdAt?: string;
  updatedAt?: string;
}

class EmailTemplatesService {
  async updateTemplates(
    settingsId: string,
    templates: EmailTemplate[]
  ): Promise<EmailTemplate[]> {
    try {
      const cleanedTemplates = templates.map(({ createdAt, updatedAt, ...rest }) => rest);
      const response = await axios.put(
        `/companies/${settingsId}/settings/email-templates`,
        { 
          mailSettings: {
            emailTemplates: cleanedTemplates
          }
        }
      );
      const data = response.data;
      return data?.mailSettings?.emailTemplates ?? templates;
    } catch (error: any) {
      throw new Error(getErrorMessage(error));
    }
  }

  async createTemplate(
    settingsId: string,
    template: Omit<EmailTemplate, '_id' | 'createdAt' | 'updatedAt'>,
    existingTemplates: EmailTemplate[] = []
  ): Promise<EmailTemplate> {
    const updatedTemplates = [...existingTemplates, template];
    const saved = await this.updateTemplates(settingsId, updatedTemplates);
    const created = saved.find(t => t.name === template.name);
    if (!created) throw new Error("Failed to retrieve created template");
    return created;
  }

  async updateTemplate(
    settingsId: string,
    templateId: string,
    template: Partial<EmailTemplate>,
    existingTemplates: EmailTemplate[] = []
  ): Promise<EmailTemplate> {
    const updatedTemplates = existingTemplates.map(t =>
      t._id === templateId ? { ...t, ...template } : t
    );
    await this.updateTemplates(settingsId, updatedTemplates);
    const updated = updatedTemplates.find(t => t._id === templateId);
    if (!updated) throw new Error("Template not found after update");
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

export const emailTemplatesService = new EmailTemplatesService();