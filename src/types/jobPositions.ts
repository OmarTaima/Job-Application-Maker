export type LocalizedString = { en: string; ar: string };

export type JobFieldConfigRule = {
  visible: boolean;
  required: boolean;
};

export type JobFieldConfig = {
  fullName: JobFieldConfigRule;
  email: JobFieldConfigRule;
  phone: JobFieldConfigRule;
  gender: JobFieldConfigRule;
  birthDate: JobFieldConfigRule;
  address: JobFieldConfigRule;
  profilePhoto: JobFieldConfigRule;
  cvFilePath: JobFieldConfigRule;
  expectedSalary: JobFieldConfigRule;
};

export type JobPosition = {
  _id: string;
  companyId: string;
  departmentId: string;
  jobCode: string;
  order?: number;
  title: LocalizedString;
  description?: LocalizedString;
  bilingual?: boolean;
  isActive?: boolean;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'internship';
  workArrangement: 'on-site' | 'remote' | 'hybrid';
  salary?: number;
  salaryVisible?: boolean;
  fieldConfig?: JobFieldConfig;
  openPositions?: number;
  registrationStart?: string;
  registrationEnd?: string;
  status: "open" | "closed" | "archived";
  termsAndConditions?: LocalizedString[];
  jobSpecs?: Array<{
    spec: LocalizedString;
    weight: number;
  }>;
  jobSpecsWithDetails?: Array<{
    jobSpecId: string;
    spec: string;
    weight: number;
    answer: boolean;
  }>;
  customFields?: Array<{
    fieldId: string;
    label: LocalizedString;
    inputType: string;
    isRequired: boolean;
    defaultValue?: string;
    minValue?: number;
    maxValue?: number;
    choices?: Array<LocalizedString>;
    groupFields?: Array<{
      fieldId: string;
      label: LocalizedString;
      inputType: string;
      isRequired: boolean;
      choices?: Array<LocalizedString>;
      order?: number;
      defaultValue?: string;
      minValue?: number;
      maxValue?: number;
    }>;
    order: number;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateJobPositionRequest = {
  companyId: string;
  departmentId: string;
  jobCode: string;
  order?: number;
  title: LocalizedString;
  description?: LocalizedString;
  bilingual?: boolean;
  isActive?: boolean;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'internship';
  workArrangement: 'on-site' | 'remote' | 'hybrid';
  salary?: number;
  salaryVisible?: boolean;
  openPositions?: number;
  registrationStart: string;
  registrationEnd: string;
  termsAndConditions?: LocalizedString[];
  fieldConfig?: JobFieldConfig;
  createdBy?: string;
  // optional legacy/extra fields
  requirements?: string[];
  status?: string;
  jobSpecs?: Array<{
    spec: LocalizedString;
    weight: number;
  }>;
  customFields?: Array<{
    fieldId: string;
    label: LocalizedString;
    inputType: string;
    isRequired: boolean;
    defaultValue?: string;
    minValue?: number;
    maxValue?: number;
    choices?: Array<LocalizedString>;
    groupFields?: Array<{
      fieldId: string;
      label: LocalizedString;
      inputType: string;
      isRequired: boolean;
      choices?: Array<LocalizedString>;
      order?: number;
      defaultValue?: string;
      minValue?: number;
      maxValue?: number;
    }>;
    order: number;
  }>;
};

export type UpdateJobPositionRequest = {
  departmentId?: string;
  title?: LocalizedString;
  description?: LocalizedString;
  bilingual?: boolean;
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'internship';
  workArrangement?: 'on-site' | 'remote' | 'hybrid';
  isActive?: boolean;
  salary?: number;
  salaryVisible?: boolean;
  openPositions?: number;
  registrationStart?: string;
  registrationEnd?: string;
  termsAndConditions?: LocalizedString[];
  fieldConfig?: JobFieldConfig;
  // allow updating these optional fields as well
  companyId?: string;
  jobCode?: string;
  requirements?: string[];
  status?: string;
  order?: number;
  jobSpecs?: Array<{
    spec: LocalizedString;
    weight: number;
  }>;
  customFields?: Array<{
    fieldId: string;
    label: LocalizedString;
    inputType: string;
    isRequired: boolean;
    defaultValue?: string;
    minValue?: number;
    maxValue?: number;
    choices?: Array<LocalizedString>;
    groupFields?: Array<{
      fieldId: string;
      label: LocalizedString;
      inputType: string;
      isRequired: boolean;
      choices?: Array<LocalizedString>;
      order?: number;
      defaultValue?: string;
      minValue?: number;
      maxValue?: number;
    }>;
    order: number;
  }>;
};

export type ReorderJobPositionsRequestItem = {
  id: string;
  order: number;
};