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