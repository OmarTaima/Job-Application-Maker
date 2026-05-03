// types/companies.ts

import type { Applicant } from './applicants';

export type CompanyStatus = {
  name: string;
  color: string;
  textColor?: string;
  description?: string;
  isDefault?: boolean;
  statusKey?: string;
};

export type CompanySet = {
  leadModal: {
    visibleFields: { field: Applicant; defaultValue: any }[];
    requiredFields: Applicant[];
  };
  leadTable?: {
    visibleColumns: string[];
  };
  statuses?: CompanyStatus[];
  _id?: string;
  company: string;
};

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
  settings?: CompanySet;
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
  emailTemplates?: EmailTemplate[];
}

export interface EmailTemplate {
  _id?: string;
  name: string;
  subject: string;
  html: string;
  createdAt?: string;
  updatedAt?: string;
}

// Interview Settings Types
export type InterviewAnswerType = 'text' | 'number' | 'radio' | 'checkbox' | 'dropdown' | 'tags';

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

// Company Settings Types
export interface UpdateCompanySettingsRequest {
  mailSettings?: Partial<MailSettings>;
  interviewSettings?: InterviewSettings;
  defaultColorGradient?: string[];
  rejectReasons?: string[];
  applicantStatus?: any[];
  statuses?: any[];
  applicantPages?: any[];
}

export type UpdateInterviewSettingsRequest = {
  interviewSettings: {
    groups: InterviewGroup[];
  };
};

export interface UpdateRejectionReasonsRequest {
  rejectReasons: string[];
}

export interface UpdateApplicantPagesRequest {
  applicantPages: any[];
}

// Company Response Types
export interface CompanyResponse {
  success?: boolean;
  data?: Company;
  company?: Company;
}

export interface CompaniesResponse {
  success: boolean;
  data: Company[];
}
