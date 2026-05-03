// hooks/queries/useUsers.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { usersService, savedFieldsService, savedQuestionGroupsService } from "../../services/usersService";
import { useAuth } from "../../context/AuthContext";
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UpdateDepartmentsRequest,
  CreateSavedFieldRequest,
  UpdateSavedFieldRequest,
  SavedQuestionGroup,
} from "../../services/usersService";
import { ApiError } from "../../services/companiesService";
import Swal from "../../utils/swal";

// ===== Types =====
interface UseMyInterviewsParams {
  direction?: 'future' | 'past';
  status?: string;
  page?: number;
  limit?: number;
}

// ===== Query Keys =====
export const usersKeys = {
  all: ["users"] as const,
  lists: () => [...usersKeys.all, "list"] as const,
  list: (companyId?: string[]) => [...usersKeys.lists(), { companyId }] as const,
  detail: (id: string) => [...usersKeys.all, "detail", id] as const,
};

export const savedFieldsKeys = {
  all: ["savedFields"] as const,
  list: () => [...savedFieldsKeys.all, "list"] as const,
};

export const savedQuestionGroupsKeys = {
  all: ["savedQuestionGroups"] as const,
  list: () => [...savedQuestionGroupsKeys.all, "list"] as const,
};

export const myInterviewsKeys = {
  all: ['my-interviews'] as const,
  list: (params: UseMyInterviewsParams) => [...myInterviewsKeys.all, params] as const,
};

// ===== Helper Functions =====
function getUserCompanyIds(user: any): string[] | undefined {
  const roleName = user?.roleId?.name?.toLowerCase?.();
  if (roleName === 'admin' || roleName === 'super admin') return undefined;

  const fromCompanies = user?.companies?.map((c: any) =>
    typeof c?.companyId === 'string' ? c.companyId : c?.companyId?._id
  ).filter((id: any) => typeof id === 'string') ?? [];

  const fromAssigned = user?.assignedcompanyId?.filter((id: any) => typeof id === 'string') ?? [];
  const merged = [...new Set([...fromCompanies, ...fromAssigned])];
  return merged.length > 0 ? merged : undefined;
}

// ===== User Queries =====
interface UseUsersParams {
  companies?: string[];
  enabled?: boolean;
}

export function useUsers(params: UseUsersParams = {}): UseQueryResult<any[], Error> {
  const { user } = useAuth();
  const userCompanyIds = getUserCompanyIds(user);
  const companies = params?.companies ?? userCompanyIds;

  return useQuery({
    queryKey: usersKeys.list(companies),
    queryFn: async () => {
      const response = await usersService.getAllUsers({ companies });
      // Always return an array
      if (Array.isArray(response)) return response;
      if (response && typeof response === 'object' && 'data' in response && Array.isArray((response as any).data)) {
        return (response as any).data;
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: params?.enabled ?? true,
  }) as UseQueryResult<any[], Error>;
}

export function useUser(id: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: usersKeys.detail(id),
    queryFn: () => usersService.getUserById(id),
    enabled: options?.enabled ?? !!id,
    staleTime: 5 * 60 * 1000,
    initialData: () => {
      const cached = queryClient.getQueryData<any[]>(usersKeys.list());
      return cached?.find(user => user._id === id);
    },
  });
}

// ===== User Mutations =====
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserRequest) => usersService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      showSuccessToast("User created successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to create user");
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      usersService.updateUser(id, data),
    onSuccess: (updatedUser, { id }) => {
      queryClient.setQueryData(usersKeys.detail(id), updatedUser);
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      showSuccessToast("User updated successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to update user");
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.deleteUser(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<any[]>(usersKeys.list(), (old) => {
        if (!old) return [];
        return old.filter(user => user._id !== id);
      });
      queryClient.removeQueries({ queryKey: usersKeys.detail(id) });
      showSuccessToast("User deleted successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to delete user");
    },
  });
}

export function useUpdateUserCompanies() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, companyId, data }: { userId: string; companyId: string; data: UpdateDepartmentsRequest }) =>
      usersService.updateCompanyDepartments(userId, companyId, data),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) });
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      showSuccessToast("Company departments updated successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to update company departments");
    },
  });
}

export function useAddUserCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, companyId, departments }: { userId: string; companyId: string; departments?: string[] }) =>
      usersService.addCompanyAccess(userId, { companyId, departments: departments ?? [] }),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) });
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      showSuccessToast("Company access added successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to add company access");
    },
  });
}

export function useRemoveUserCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, companyId }: { userId: string; companyId: string }) =>
      usersService.removeCompanyAccess(userId, companyId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) });
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      showSuccessToast("Company access removed successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to remove company access");
    },
  });
}

// ===== Saved Fields (Custom Fields) =====
export function useSavedFields() {
  return useQuery({
    queryKey: savedFieldsKeys.list(),
    queryFn: () => savedFieldsService.getAllSavedFields(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSavedField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSavedFieldRequest) => savedFieldsService.createSavedField(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedFieldsKeys.list() });
      showSuccessToast("Saved field created successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to create saved field");
    },
  });
}

export function useUpdateSavedField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fieldId, data }: { fieldId: string; data: UpdateSavedFieldRequest }) =>
      savedFieldsService.updateSavedField(fieldId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedFieldsKeys.list() });
      showSuccessToast("Saved field updated successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to update saved field");
    },
  });
}

export function useDeleteSavedField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fieldId: string) => savedFieldsService.deleteSavedField(fieldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedFieldsKeys.list() });
      showSuccessToast("Saved field deleted successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to delete saved field");
    },
  });
}

// ===== Saved Question Groups =====
export function useSavedQuestionGroups() {
  return useQuery({
    queryKey: savedQuestionGroupsKeys.list(),
    queryFn: () => savedQuestionGroupsService.getAllSavedQuestionGroups(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSavedQuestionGroups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groups: SavedQuestionGroup[]) =>
      savedQuestionGroupsService.updateSavedQuestionGroups(groups),
    onSuccess: (groups) => {
      queryClient.setQueryData(savedQuestionGroupsKeys.list(), groups);
      showSuccessToast("Question groups updated successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to update question groups");
    },
  });
}

export function useDeleteSavedQuestionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: string) => savedQuestionGroupsService.deleteSavedQuestionGroup(groupId),
    onSuccess: (_, groupId) => {
      queryClient.setQueryData<SavedQuestionGroup[]>(savedQuestionGroupsKeys.list(), (old) => {
        if (!old) return [];
        return old.filter(group => group._id !== groupId);
      });
      showSuccessToast("Question group deleted successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to delete question group");
    },
  });
}

// ===== My Interviews =====
export function useMyInterviews(params: UseMyInterviewsParams = {}) {
  const { direction = 'future', status, page = 1, limit = 20 } = params;

  return useQuery({
    queryKey: myInterviewsKeys.list({ direction, status, page, limit }),
    queryFn: () => usersService.getMyInterviews({ direction, status, page, limit }),
    staleTime: 2 * 60 * 1000,
  });
}

// ===== Toast Helpers =====
function showSuccessToast(message: string) {
  Swal.fire({
    title: "Success",
    text: message,
    icon: "success",
    timer: 1500,
    showConfirmButton: false,
  });
}

function showErrorToast(message: string, fallback: string) {
  Swal.fire({
    title: "Error",
    text: message || fallback,
    icon: "error",
  });
}