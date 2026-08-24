// hooks/queries/useApplicants.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicantsService } from "../../services/applicantsService";
import { useAuth } from "../../context/AuthContext";
import type {
  CreateApplicantRequest,
  UpdateApplicantRequest,
  UpdateStatusRequest,
  ScheduleInterviewRequest,
  UpdateInterviewStatusRequest,
  AddCommentRequest,
  SendMessageRequest,
  Applicant,
} from "../../types/applicants";
import { ApiError } from "../../services/companiesService";
import Swal from "../../utils/swal";
import { useLocale } from "../../context/LocaleContext";

// Query keys
export const applicantsKeys = {
  all: ["applicants"] as const,
  lists: () => [...applicantsKeys.all, "list"] as const,
  list: (params?: {
    companyId?: string[];
    jobPositionId?: string | string[];
    search?: string;
    status?: string | string[];
    fields?: string | string[];
    departmentId?: string[];
    skipPopulation?: boolean;
  }) => [...applicantsKeys.lists(), params] as const,
  detail: (id: string) => [...applicantsKeys.all, "detail", id] as const,
  rejectionInsights: (companyId?: string[]) => [...applicantsKeys.all, "rejection-insights", companyId] as const,
  byPhone: (phone: string) => [...applicantsKeys.all, "by-phone", phone] as const,
};

// Helper to get user's company IDs from AuthContext
function getUserCompanyIds(user: any): string[] | undefined {
  const roleName = user?.roleId?.name?.toLowerCase?.();
  if (roleName === "admin" || roleName === "super admin") return undefined;

  const fromCompanies = user?.companies?.map((c: any) =>
    typeof c?.companyId === "string" ? c.companyId : c?.companyId?._id
  ).filter(Boolean) ?? [];

  const fromAssigned = user?.assignedcompanyId?.filter(Boolean) ?? [];
  const merged = [...new Set([...fromCompanies, ...fromAssigned])];
  return merged.length > 0 ? merged : undefined;
}

/**
 * Safely merge a mutation response into the cached applicant.
 *
 * Many of our endpoints (schedule interview, add comment, send message)
 * return a STRIPPED applicant — or only the newly-created sub-document
 * (an interview / comment object) instead of the full applicant. Blindly
 * overwriting the cache with that response would wipe `phone`, `email`,
 * `customResponses`, `fullName`, etc.
 *
 * This helper:
 *  - Reads the previously-cached applicant.
 *  - If the response looks like a full applicant (matching `_id` and at
 *    least one identifying field), shallow-merges only the response keys
 *    that have a real value on top of the previous applicant. Non-empty
 *    previous arrays are NOT overwritten by empty response arrays.
 *  - If the response is just a new sub-document (interview, comment),
 *    appends it to the appropriate array on the previous applicant.
 *  - If there is no previous cache, falls back to writing the response.
 */
function mergeApplicantResponseIntoCache(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  response: unknown,
  options: { appendKey?: 'interviews' | 'comments' | 'activities' } = {},
): void {
  const previous = queryClient.getQueryData<Applicant | undefined>(
    applicantsKeys.detail(id),
  );

  if (!response || typeof response !== 'object') {
    if (!previous) {
      return;
    }
    return;
  }

  const resp = response as Record<string, unknown>;
  const respId = String((resp._id as string | undefined) || (resp.id as string | undefined) || '');

  const looksLikeFullApplicant =
    respId === id &&
    (resp.fullName !== undefined ||
      resp.firstName !== undefined ||
      resp.email !== undefined ||
      resp.phone !== undefined ||
      resp.status !== undefined ||
      Array.isArray(resp.customResponses) ||
      Array.isArray(resp.interviews));

  if (!previous) {
    queryClient.setQueryData(applicantsKeys.detail(id), response);
    return;
  }

  if (looksLikeFullApplicant) {
    const merged: Record<string, unknown> = { ...(previous as unknown as Record<string, unknown>) };
    for (const key of Object.keys(resp)) {
      const value = resp[key];
      if (value === undefined) continue;
      const prevValue = (previous as unknown as Record<string, unknown>)[key];
      if (
        Array.isArray(value) &&
        value.length === 0 &&
        Array.isArray(prevValue) &&
        (prevValue as unknown[]).length > 0
      ) {
        continue;
      }
      merged[key] = value;
    }
    queryClient.setQueryData(applicantsKeys.detail(id), merged as Applicant);
    return;
  }

  // Response is not a full applicant. If the caller told us which array to
  // append into, do that; otherwise fall back to merging an `interviews`
  // array if the response carries one.
  const appendKey = options.appendKey;
  const respHasInterviewsArray = Array.isArray(resp.interviews);

  if (appendKey) {
    const existing = Array.isArray((previous as unknown as Record<string, unknown>)[appendKey])
      ? ((previous as unknown as Record<string, unknown>)[appendKey] as unknown[])
      : [];
    queryClient.setQueryData(applicantsKeys.detail(id), {
      ...(previous as object),
      [appendKey]: [...existing, response],
    } as unknown as Applicant);
    return;
  }

  if (respHasInterviewsArray) {
    const existingInterviews = Array.isArray((previous as Applicant).interviews)
      ? (previous as Applicant).interviews
      : [];
    const byId = new Map<string, unknown>();
    (existingInterviews || []).forEach((iv) => {
      const k = String((iv as { _id?: string; id?: string })?._id || (iv as { _id?: string; id?: string })?.id || '');
      if (k) byId.set(k, iv);
    });
    (resp.interviews as unknown[]).forEach((iv) => {
      const k = String((iv as { _id?: string; id?: string })?._id || (iv as { _id?: string; id?: string })?.id || '');
      if (k) byId.set(k, { ...(byId.get(k) as object | undefined), ...(iv as object) });
    });
    queryClient.setQueryData(applicantsKeys.detail(id), {
      ...(previous as object),
      interviews: Array.from(byId.values()),
    } as Applicant);
    return;
  }

  // Last resort: don't touch the cache (avoid wiping good data with a
  // shape we don't understand).
}

// Get all applicants
export function useApplicants(params?: {
  companyId?: string[];
  jobPositionId?: string | string[];
  departmentId?: string[];
  status?: string | string[];
  fields?: string | string[];
  enabled?: boolean;
  search?: string;
  skipPopulation?: boolean; // new param to skip population of related fields
}) {
  const { user } = useAuth();
  const userCompanyIds = getUserCompanyIds(user);
  const effectiveCompanyId = params?.companyId?.length ? params.companyId : userCompanyIds;

  const isSearch = !!params?.search;

  return useQuery({
    queryKey: applicantsKeys.list({
      companyId: effectiveCompanyId,
      jobPositionId: params?.jobPositionId,
      departmentId: params?.departmentId,
      status: params?.status,
      search: params?.search,
      fields: params?.fields,
      skipPopulation: params?.skipPopulation,
    }),
    queryFn: () => {
      if (isSearch) {
        const companyIds = effectiveCompanyId?.length ? effectiveCompanyId : undefined;
        return applicantsService.searchApplicants({
          q: params!.search!,
          companyId: companyIds,
          page: 1,
          limit: 9999,
        });
      }
      return applicantsService.getAllApplicants({
        companyId: effectiveCompanyId,
        jobPositionId: params?.jobPositionId,
        departmentId: params?.departmentId,
        status: params?.status,
        search: params?.search,
        fields: params?.fields,
        skipPopulation: params?.skipPopulation,
      });
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    enabled: params?.enabled ?? true,
  });
}

// Get applicant by ID
export function useApplicant(id: string, options?: {
  initialData?: Applicant;
  enabled?: boolean;
  staleTime?: number;
  fields?: string;
}) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [...applicantsKeys.detail(id), { fields: options?.fields }],
    queryFn: () => applicantsService.getApplicantById(id, options?.fields),
    enabled: !!id && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    placeholderData: options?.initialData ?? (() => {
      const queryCache = queryClient.getQueryCache();
      const listQueries = queryCache.findAll({ queryKey: applicantsKeys.lists() });
      for (const query of listQueries) {
        const data = query.state.data;
        if (Array.isArray(data)) {
          const found = (data as Applicant[]).find(a => a._id === id);
          if (found) return found;
        }
      }
      return undefined;
    }),
  });
}

// Get applicant status insights
export function useApplicantStatuses(params?: {
  companyId?: string[];
  jobPositionId?: string;
  enabled?: boolean;
}) {
  const { user } = useAuth();
  const userCompanyIds = getUserCompanyIds(user);
  const effectiveCompanyId = params?.companyId?.length ? params.companyId : userCompanyIds;

  return useQuery({
    queryKey: [...applicantsKeys.list({ companyId: effectiveCompanyId, jobPositionId: params?.jobPositionId }), 'statuses'],
    queryFn: () => applicantsService.getApplicantStatuses({
      companyId: effectiveCompanyId,
      status: params?.jobPositionId,
    }),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    enabled: params?.enabled ?? true,
  });
}

// Batch update applicant status
export function useBatchUpdateApplicantStatus() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (updates: Array<{ applicantId: string; status: string; notes?: string; reasons?: string[] }>) =>
      applicantsService.batchUpdateStatus(updates),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.lists() });

      const previousLists: Record<string, any[] | undefined> = {};
      const queryCache = queryClient.getQueryCache();
      const listQueries = queryCache.findAll({ queryKey: applicantsKeys.lists(), type: 'active' });
      listQueries.forEach((query) => {
        previousLists[JSON.stringify(query.queryKey)] = query.state.data as any[] | undefined;
        queryClient.setQueryData(query.queryKey, (old: any[] | undefined) => {
          if (!old) return old;
          const updateMap = new Map(updates.map((u) => [u.applicantId, u.status]));
          return old.map((a) => {
            if (updateMap.has(a._id)) {
              return { ...a, status: updateMap.get(a._id) };
            }
            return a;
          });
        });
      });

      return { previousLists };
    },
    onSuccess: (result, _updates) => {
      if (result && typeof result === 'object') {
        const data = (result as any).data ?? result;
        if (Array.isArray(data)) {
          data.forEach((item: any) => {
            if (item?._id) {
              queryClient.setQueryData(applicantsKeys.detail(item._id), item);
            }
          });
        }
      }
      showSuccessToast(t('statusesUpdated', 'common'), t);
    },
    onError: (error: ApiError, _updates, context) => {
      if (context?.previousLists) {
        Object.entries(context.previousLists).forEach(([key, data]) => {
          if (data !== undefined) {
            queryClient.setQueryData(JSON.parse(key), data);
          }
        });
      }
      showErrorToast(error.message, t('statusesUpdateFailed', 'common'), t);
    },
  });
}

// Create applicant
export function useCreateApplicant() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (data: CreateApplicantRequest) => applicantsService.createApplicant(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicantsKeys.lists() });
      showSuccessToast(t('applicantCreated', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('applicantCreateFailed', 'common'), t);
    },
  });
}

// Update applicant
export function useUpdateApplicant() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateApplicantRequest }) =>
      applicantsService.updateApplicant(id, data),
    onSuccess: (updatedApplicant, { id }) => {
      // If the response is a full applicant object, update the cache directly.
      // Otherwise, invalidate the cache so the latest data is fetched.
      const looksLikeApplicant =
        updatedApplicant &&
        typeof updatedApplicant === 'object' &&
        (updatedApplicant as Partial<Applicant>)._id &&
        ((updatedApplicant as Partial<Applicant>).fullName !== undefined ||
          (updatedApplicant as Partial<Applicant>).firstName !== undefined ||
          (updatedApplicant as Partial<Applicant>).email !== undefined ||
          (updatedApplicant as Partial<Applicant>).phone !== undefined ||
          (updatedApplicant as Partial<Applicant>).status !== undefined);

      if (looksLikeApplicant) {
        queryClient.setQueryData(applicantsKeys.detail(id), updatedApplicant);
        queryClient.setQueryData<Applicant[]>(applicantsKeys.list(), (old) => {
          if (!old) return [updatedApplicant as Applicant];
          return old.map((applicant) =>
            applicant._id === id ? (updatedApplicant as Applicant) : applicant
          );
        });
      } else {
        queryClient.invalidateQueries({ queryKey: applicantsKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: applicantsKeys.lists() });
      }

      showSuccessToast(t('applicantUpdated', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('applicantUpdateFailed', 'common'), t);
    },
  });
}

// Mark applicant as seen
export function useMarkApplicantSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => applicantsService.markAsSeen(id),
    onSuccess: (_, id) => {
      // Silently update - no toast needed
      queryClient.invalidateQueries({ queryKey: applicantsKeys.detail(id) });
    },
    onError: (error: ApiError) => {
      console.error("Failed to mark as seen:", error.message);
    },
  });
}

// Update applicant status
type UpdateStatusVariables = { id: string; data: UpdateStatusRequest; silent?: boolean };
type UpdateStatusContext = { previousLists: Record<string, Applicant[] | undefined>; previousDetailData: Record<string, any> };

export function useUpdateApplicantStatus() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation<Applicant, ApiError, UpdateStatusVariables, UpdateStatusContext>({
    mutationFn: ({ id, data }: UpdateStatusVariables) =>
      applicantsService.updateApplicantStatus(id, data),
    onMutate: async ({ id, data, silent }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.all });

      const previousLists: Record<string, Applicant[] | undefined> = {};
      const queryCache = queryClient.getQueryCache();
      const listQueries = queryCache.findAll({ queryKey: applicantsKeys.lists(), type: 'active' });
      listQueries.forEach((query) => {
        previousLists[JSON.stringify(query.queryKey)] = query.state.data as Applicant[] | undefined;
        queryClient.setQueryData(query.queryKey, (old: Applicant[] | undefined) => {
          if (!old) return old;
          return old.map((a) => a._id === id ? { ...a, status: data.status } : a);
        });
      });

      const previousDetailData: Record<string, any> = {};
      queryClient.setQueriesData({ queryKey: applicantsKeys.detail(id) }, (old: any) => {
        if (!old) return old;
        previousDetailData[JSON.stringify(queryClient.getQueryCache().find({ queryKey: applicantsKeys.detail(id) })?.queryKey)] = old;
        return { ...old, status: data.status };
      });

      if (!silent) showSuccessToast(t('statusUpdated', 'common'), t);

      return { previousLists, previousDetailData };
    },
    onSuccess: (updatedApplicant, { id }) => {
      const looksLikeApplicant =
        updatedApplicant &&
        typeof updatedApplicant === 'object' &&
        (updatedApplicant as Partial<Applicant>)._id &&
        ((updatedApplicant as Partial<Applicant>).fullName !== undefined ||
          (updatedApplicant as Partial<Applicant>).firstName !== undefined ||
          (updatedApplicant as Partial<Applicant>).email !== undefined ||
          (updatedApplicant as Partial<Applicant>).phone !== undefined ||
          (updatedApplicant as Partial<Applicant>).status !== undefined);

      if (looksLikeApplicant) {
        queryClient.setQueriesData({ queryKey: applicantsKeys.detail(id) }, updatedApplicant);
      }
    },
    onError: (error: ApiError, _variables, context) => {
      if (context?.previousDetailData) {
        Object.entries(context.previousDetailData).forEach(([key, data]) => {
          if (data !== undefined) {
            queryClient.setQueryData(JSON.parse(key), data);
          }
        });
      }
      if (context?.previousLists) {
        Object.entries(context.previousLists).forEach(([key, data]) => {
          if (data !== undefined) {
            queryClient.setQueryData(JSON.parse(key), data);
          }
        });
      }
      showErrorToast(error.message, t('statusUpdateFailed', 'common'), t);
    },
  });
}

// Delete applicant
export function useDeleteApplicant() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (id: string) => applicantsService.deleteApplicant(id),
    onSuccess: (_, id) => {
      // Remove from list cache
      queryClient.setQueryData<Applicant[]>(applicantsKeys.list(), (old) => {
        if (!old) return [];
        return old.filter(applicant => applicant._id !== id);
      });
      
      // Remove detail cache
      queryClient.removeQueries({ queryKey: applicantsKeys.detail(id) });
      
      showSuccessToast(t('applicantDeleted', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('applicantDeleteFailed', 'common'), t);
    },
  });
}

// Schedule interview
export function useScheduleInterview() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ScheduleInterviewRequest }) =>
      applicantsService.scheduleInterview(id, data),
    onSuccess: (response, { id }) => {
      const res = response as Record<string, unknown>;
      const succeeded = res.succeeded as Array<Record<string, unknown>> | undefined;
      const unwrapped = succeeded?.[0] ?? res;
      mergeApplicantResponseIntoCache(queryClient, id, unwrapped);
      showSuccessToast(t('interviewScheduled', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('interviewScheduleFailed', 'common'), t);
    },
  });
}

// Schedule bulk interviews
export function useScheduleBulkInterviews() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (payload: { interviews: Array<any> } | Array<any>) =>
      applicantsService.scheduleBulkInterviews(payload),
    onSuccess: (_, payload) => {
      const items = Array.isArray(payload) ? payload : (payload as any).interviews ?? [];
      items.forEach((item: any) => {
        if (item?.applicantId) {
          queryClient.invalidateQueries({ queryKey: applicantsKeys.detail(item.applicantId) });
        }
      });
      showSuccessToast(t('interviewsScheduled', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('interviewsScheduleFailed', 'common'), t);
    },
  });
}

// Update interview status
export function useUpdateInterviewStatus() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ applicantId, interviewId, data }: {
      applicantId: string;
      interviewId: string;
      data: UpdateInterviewStatusRequest;
    }) => applicantsService.updateInterviewStatus(applicantId, interviewId, data),
    onMutate: async ({ applicantId, interviewId, data }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(applicantId) });
      const previousApplicant = queryClient.getQueryData<Applicant | undefined>(
        applicantsKeys.detail(applicantId),
      );
      if (previousApplicant && Array.isArray(previousApplicant.interviews)) {
        const nextInterviews = previousApplicant.interviews.map((iv) => {
          if ((iv?._id || iv?.id) !== interviewId) return iv;
          return { ...iv, ...data };
        });
        queryClient.setQueryData(applicantsKeys.detail(applicantId), {
          ...previousApplicant,
          interviews: nextInterviews,
        });
      }
      return { previousApplicant };
    },
    onSuccess: (_updatedApplicant, _variables) => {
      // The optimistic update from onMutate is the source of truth.
      // Do NOT overwrite the cache with the server response — it strips
      // questions/groupKey/groupName/groupSource on round-trips, which
      // would wipe out the user's in-progress answers and re-trigger the
      // question picker view.
    },
    onError: (error: ApiError, _variables, context) => {
      if ((context as { previousApplicant?: unknown } | undefined)?.previousApplicant) {
        const previous = (context as { previousApplicant: unknown }).previousApplicant;
        const { applicantId } = _variables;
        queryClient.setQueryData(applicantsKeys.detail(applicantId), previous);
      }
      showErrorToast(error.message, t('interviewUpdateFailed', 'common'), t);
    },
  });
}

// Delete interview
export function useDeleteInterview() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ applicantId, interviewId }: {
      applicantId: string;
      interviewId: string;
    }) => applicantsService.deleteInterview(applicantId, interviewId),
    onSuccess: (updatedApplicant, { applicantId }) => {
      queryClient.setQueryData(applicantsKeys.detail(applicantId), updatedApplicant);
      queryClient.invalidateQueries({ queryKey: applicantsKeys.detail(applicantId) });
      showSuccessToast(t('interviewDeleted', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('interviewDeleteFailed', 'common'), t);
    },
  });
}

// Add comment
export function useAddComment() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AddCommentRequest }) =>
      applicantsService.addComment(id, data),
    onSuccess: (response, { id }) => {
      mergeApplicantResponseIntoCache(queryClient, id, response, {
        appendKey: 'comments',
      });
      showSuccessToast(t('commentAdded', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('commentAddFailed', 'common'), t);
    },
  });
}

// Send message
export function useSendMessage() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SendMessageRequest }) =>
      applicantsService.sendMessage(id, data),
    onSuccess: (response, { id }) => {
      mergeApplicantResponseIntoCache(queryClient, id, response);
      showSuccessToast(t('messageSent', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('messageSendFailed', 'common'), t);
    },
  });
}

export function useRejectionInsights(params?: { companyId?: string[]; enabled?: boolean }) {
  const { user } = useAuth();
  const userCompanyIds = getUserCompanyIds(user);
  const effectiveCompanyId = params?.companyId?.length ? params.companyId : userCompanyIds;

  return useQuery({
    queryKey: applicantsKeys.rejectionInsights(effectiveCompanyId),
    queryFn: () => applicantsService.getRejectionInsights({ companyId: effectiveCompanyId }),
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: params?.enabled ?? true,
    retry: false,
  });
}

// Get applicants by phone number
export function useApplicantsByPhone(phone?: string, options?: { enabled?: boolean; companyId?: string }) {
  return useQuery({
    queryKey: applicantsKeys.byPhone(phone || ''),
    queryFn: () => applicantsService.getApplicantsByPhone(phone || '', options?.companyId),
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !!phone && (options?.enabled ?? true),
    retry: false,
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