export interface Department {
  _id: string;
  name: {
    en: string;
    ar: string;
  };
  description?: {
    en: string;
    ar: string;
  };
  companyId: string | { _id: string; name: string };
  managerId?: string | { _id: string; fullName: string };
  isActive?: boolean;
  createdAt?: string;
  __v?: number;
}

export interface CreateDepartmentRequest {
  companyId: string;
  name: {
    en: string;
    ar: string;
  };
  description?: {
    en: string;
    ar: string;
  };
  managerId?: string;
  // legacy callers may still send `deleted`; accept it and map to `isActive`
  deleted?: boolean;
}

export interface UpdateDepartmentRequest {
  name: {
    en: string;
    ar: string;
  };
  description?: {
    en: string;
    ar: string;
  };
  managerId?: string;
  isActive?: boolean;
  // accept legacy `deleted` flag and map it when sending to server
  deleted?: boolean;
}

export interface DepartmentsResponse {
  success: boolean;
  data: Department[];
}

export interface DepartmentResponse {
  success: boolean;
  data: Department;
}