// types/roles.ts

export interface Permission {
  _id: string;
  name: string;
  description?: string;
  actions?: string[];
  createdAt?: string;
  __v?: number;
}

export interface Role {
  _id: string;
  name: string;
  description: string;
  permissions?: Array<string | { permission: string; access?: string[] }>;
  isSystemRole?: boolean;
  singleCompany?: boolean;
  permissionsCount?: number;
  usersCount?: number;
  createdAt?: string;
  __v?: number;
}

export interface CreateRoleRequest {
  name: string;
  description: string;
  permissions: {
    permission: string;
    access: string[];
  }[];
  isSystemRole?: boolean;
  singleCompany?: boolean;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: {
    permission: string;
    access: string[];
  }[];
  isSystemRole?: boolean;
  singleCompany?: boolean;
}

export interface PermissionsResponse {
  success: boolean;
  data: Permission[];
}

export interface RolesResponse {
  success: boolean;
  data: Role[];
}

export interface CreateRoleResponse {
  success: boolean;
  message: string;
  data: Role;
}