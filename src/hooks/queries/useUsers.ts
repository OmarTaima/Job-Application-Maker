// hooks/queries/useUsers.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { usersService, savedFieldsService, savedQuestionGroupsService } from "../../services/usersService";
import { companiesService } from "../../services/companiesService";
import { useAuth } from "../../context/AuthContext";
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UpdateProfileRequest,
  UpdateDepartmentsRequest,
  CreateSavedFieldRequest,
  UpdateSavedFieldRequest,
  SavedQuestionGroup,
} from "../../services/usersService";
import { ApiError } from "../../services/companiesService";
import Swal from "../../utils/swal";
import { useLocale } from "../../context/LocaleContext";

// ===== Types =====
interface UseMyInterviewsParams {
  direction?: 'future' | 'past';
  status?: string;
  company?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

interface UseCompanyInterviewsParams {
  direction?: 'future' | 'past';
  scheduledBy?: string;
  conductedBy?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
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

export const companyInterviewsKeys = {
  all: ['company-interviews'] as const,
  list: (companyId: string, params: UseCompanyInterviewsParams) =>
    [...companyInterviewsKeys.all, companyId, params] as const,
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
  PageCount?: string | number; // Add this
}

export function useUsers(params: UseUsersParams = {}): UseQueryResult<any[], Error> {
  const { user } = useAuth();
  const userCompanyIds = getUserCompanyIds(user);
  const companies = params?.companies ?? userCompanyIds;

  return useQuery({
    queryKey: usersKeys.list(companies),
    queryFn: async () => {
      const response = await usersService.getAllUsers({ companies, PageCount: 'all' } as any);
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



const getDetailedErrorMessage = (error: any): string => {
  if (!error) return "An unknown error occurred";
  
  // Extract from response data
  const responseData = error.response?.data;
  
  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData;
  }
  
  if (typeof responseData?.message === 'string' && responseData.message.trim()) {
    return responseData.message;
  }
  
  if (Array.isArray(responseData?.errors) && responseData.errors.length > 0) {
    const firstError = responseData.errors[0];
    if (typeof firstError === 'string' && firstError.trim()) return firstError;
    if (typeof firstError?.message === 'string' && firstError.message.trim()) return firstError.message;
    if (typeof firstError?.msg === 'string' && firstError.msg.trim()) return firstError.msg;
  }
  
  if (typeof responseData?.error?.message === 'string' && responseData.error.message.trim()) {
    return responseData.error.message;
  }
  
  // Fallback to error.message
  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  
  return "Failed to create user";
};



export function useCreateUser() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (data: CreateUserRequest) => usersService.createUser(data),
    onSuccess: (newUser) => {
      queryClient.setQueriesData<any[]>({ queryKey: usersKeys.lists() }, (old) => {
        if (!old) return [newUser];
        return [...old, newUser];
      });
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      showSuccessToast(t('userCreated', 'common'), t);
    },
    onError: (error: ApiError) => {
      const detailedMessage = getDetailedErrorMessage(error);
      showErrorToast(detailedMessage, t('userCreateFailed', 'common'), t);
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      usersService.updateUser(id, data),
    onSuccess: (updatedUser, { id }) => {
      queryClient.setQueryData(usersKeys.detail(id), updatedUser);
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      showSuccessToast(t('userUpdated', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(getDetailedErrorMessage(error), t('userUpdateFailed', 'common'), t);
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (data: UpdateProfileRequest) =>
      usersService.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
      showSuccessToast(t('userUpdated', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(getDetailedErrorMessage(error), t('userUpdateFailed', 'common'), t);
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (id: string) => usersService.deleteUser(id),
    onSuccess: (_, id) => {
      queryClient.setQueriesData<any[]>({ queryKey: usersKeys.lists() }, (old) => {
        if (!old) return [];
        return old.filter(user => user._id !== id);
      });
      queryClient.removeQueries({ queryKey: usersKeys.detail(id) });
      showSuccessToast(t('userDeleted', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(getDetailedErrorMessage(error), t('userDeleteFailed', 'common'), t);
    },
  });
}

export function useUpdateUserCompanies() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ userId, companyId, data }: { userId: string; companyId: string; data: UpdateDepartmentsRequest }) =>
      usersService.updateCompanyDepartments(userId, companyId, data),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) });
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('companyDepartmentsUpdateFailed', 'common'), t);
    },
  });
}

export function useAddUserCompany() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ userId, companyId, departments }: { userId: string; companyId: string; departments?: string[] }) =>
      usersService.addCompanyAccess(userId, { companyId, departments: departments ?? [] }),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) });
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      showSuccessToast(t('companyAccessAdded', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('companyAccessAddFailed', 'common'), t);
    },
  });
}

export function useRemoveUserCompany() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ userId, companyId }: { userId: string; companyId: string }) =>
      usersService.removeCompanyAccess(userId, companyId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) });
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      showSuccessToast(t('companyAccessRemoved', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('companyAccessRemoveFailed', 'common'), t);
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
  const { t } = useLocale();

  return useMutation({
    mutationFn: (data: CreateSavedFieldRequest) => savedFieldsService.createSavedField(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedFieldsKeys.list() });
      showSuccessToast(t('savedFieldCreated', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('savedFieldCreateFailed', 'common'), t);
    },
  });
}

export function useUpdateSavedField() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ fieldId, data }: { fieldId: string; data: UpdateSavedFieldRequest }) =>
      savedFieldsService.updateSavedField(fieldId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedFieldsKeys.list() });
      showSuccessToast(t('savedFieldUpdated', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('savedFieldUpdateFailed', 'common'), t);
    },
  });
}

export function useDeleteSavedField() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (fieldId: string) => savedFieldsService.deleteSavedField(fieldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedFieldsKeys.list() });
      showSuccessToast(t('savedFieldDeleted', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('savedFieldDeleteFailed', 'common'), t);
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
  const { t } = useLocale();

  return useMutation({
    mutationFn: (groups: SavedQuestionGroup[]) =>
      savedQuestionGroupsService.updateSavedQuestionGroups(groups),
    onMutate: async (groups) => {
      await queryClient.cancelQueries({ queryKey: savedQuestionGroupsKeys.list() });
      const previousGroups = queryClient.getQueryData<SavedQuestionGroup[]>(savedQuestionGroupsKeys.list());
      queryClient.setQueryData(savedQuestionGroupsKeys.list(), groups);
      return { previousGroups };
    },
    onSuccess: (groups) => {
      queryClient.setQueryData(savedQuestionGroupsKeys.list(), groups);
      showSuccessToast(t('questionGroupsUpdated', 'common'), t);
    },
    onError: (_error: ApiError, _variables, context) => {
      if (context?.previousGroups) {
        queryClient.setQueryData(savedQuestionGroupsKeys.list(), context.previousGroups);
      }
      showErrorToast(_error.message, t('questionGroupsUpdateFailed', 'common'), t);
    },
  });
}

export function useDeleteSavedQuestionGroup() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (groupId: string) => savedQuestionGroupsService.deleteSavedQuestionGroup(groupId),
    onMutate: async (groupId) => {
      await queryClient.cancelQueries({ queryKey: savedQuestionGroupsKeys.list() });
      const previousGroups = queryClient.getQueryData<SavedQuestionGroup[]>(savedQuestionGroupsKeys.list());
      queryClient.setQueryData<SavedQuestionGroup[]>(savedQuestionGroupsKeys.list(), (old) => {
        if (!old) return [];
        return old.filter(group => group._id !== groupId);
      });
      return { previousGroups };
    },
    onSuccess: (_, groupId) => {
      showSuccessToast(t('questionGroupDeleted', 'common'), t);
    },
    onError: (error: ApiError, _groupId, context) => {
      if (context?.previousGroups) {
        queryClient.setQueryData(savedQuestionGroupsKeys.list(), context.previousGroups);
      }
      showErrorToast(error.message, t('questionGroupDeleteFailed', 'common'), t);
    },
  });
}

// ===== My Interviews =====
export function useMyInterviews(params: UseMyInterviewsParams = {}) {
  const { direction = 'future', status, company, page = 1, limit = 20, enabled = true } = params;

  return useQuery({
    queryKey: myInterviewsKeys.list({ direction, status, company, page, limit }),
    queryFn: () => usersService.getMyInterviews({ direction, status, company, page, limit }),
    staleTime: 2 * 60 * 1000,
    enabled,
  });
}

// ===== Company Interviews =====
export function useCompanyInterviews(
  companyId: string | null | undefined,
  params: UseCompanyInterviewsParams = {}
) {
  const { direction = 'future', scheduledBy, conductedBy, status, from, to, page = 1, limit = 20, enabled = true } = params;

  return useQuery({
    queryKey: companyInterviewsKeys.list(companyId ?? '', {
      direction,
      scheduledBy,
      conductedBy,
      status,
      from,
      to,
      page,
      limit,
    }),
    queryFn: () =>
      companiesService.getCompanyInterviews(companyId!, {
        direction,
        scheduledBy,
        conductedBy,
        status,
        from,
        to,
        page,
        limit,
      }),
    enabled: !!companyId && enabled,
    staleTime: 2 * 60 * 1000,
  });
}

// ===== Toast Helpers =====
function showSuccessToast(message: string, t: (key: string, ns?: string) => string) {
  Swal.fire({
    title: t('success', 'common'),
    text: message,
    icon: "success",
    timer: 1500,
    showConfirmButton: false,
  });
}

function showErrorToast(message: string, fallback: string, t: (key: string, ns?: string) => string) {
  Swal.fire({
    title: t('error', 'common'),
    text: message || fallback,
    icon: "error",
  });
}