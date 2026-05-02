export interface User {
  _id: string;
  fullName?: string;
  name?: string;
  email: string;
  roleId?: string | { _id: string; name: string };
  phone?: string;
  department?: string;
  isActive?: boolean;
  permissions?: Array<{ permission: string; access?: string[] }>;
  companies?: {
    companyId: string;
    departments?: string[];
    isPrimary?: boolean;
  }[];
  createdAt?: string;
  __v?: number;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  password: string;
  roleId: string;
  phone?: string;
  department?: string;
  companies?: Array<{
    companyId: string;
    departments?: string[];
    isPrimary?: boolean;
  }>;
  isActive?: boolean;
  permissions?: Array<{ permission: string; access?: string[] }>;
}

export interface UpdateUserRequest {
  name?: string;
  fullName?: string;
  email?: string;
  roleId?: string;
  permissions?: Array<{ permission: string; access?: string[] }>;
  isActive?: boolean;
  phone?: string;
  department?: string;
}