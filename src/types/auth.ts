// types/auth.ts

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

export interface TableLayout {
  columnVisibility: Record<string, boolean>;
  columnSizing: Record<string, number>;
  columnOrder: string[];
}

export interface User {
  _id?: string;
  id?: string;
  email: string;
  fullName?: string;
  name?: string;
  roleId?: {
    _id: string;
    name: string;
    permissions?: Array<{
      permission: {
        _id: string;
        name: string;
      };
      access?: string[];
    }>;
  };
  role?: 'admin' | 'company_user';
  assignedcompanyId?: string[];
  companies?: Array<{
    _id?: string;
    companyId: {
      _id: string;
      name: string;
    };
    departments?: Array<{
      _id: string;
      name: string;
    }>;
  }>;
  profilePhoto?: string;
  avatar?: string;
  location?: string;
  address?: string;
  phone?: string;
  bio?: string;
  country?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  taxId?: string;
  tablePreferences: Record<string, TableLayout>;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    accessToken?: string;
    refreshToken?: string;
  };
}

export interface UserProfileResponse {
  success: boolean;
  data: User;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// API Error class
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}