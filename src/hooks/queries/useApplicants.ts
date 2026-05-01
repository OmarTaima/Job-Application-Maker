import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicantsService } from "../../services/applicantsService";
import { useAppSelector } from "../../store/hooks";
import type {
  CreateApplicantRequest,
  UpdateApplicantRequest,
  UpdateStatusRequest,
  ScheduleInterviewRequest,
  UpdateInterviewStatusRequest,
  AddCommentRequest,
  SendMessageRequest,
} from "../../services/applicantsService";
import type { Applicant } from '../../services/applicantsService';


// Query keys
export const applicantsKeys = {
  all: ["applicants"] as const,
  lists: () => [...applicantsKeys.all, "list"] as const,
  list: (companyId?: string[], jobPositionId?: string, status?: string | string[], fields?: string | string[], departmentId?: string[]) =>
    [...applicantsKeys.lists(), { companyId, jobPositionId, status, fields, departmentId }] as const,
  details: () => [...applicantsKeys.all, "detail"] as const,
  detail: (id: string) => [...applicantsKeys.details(), id] as const,
};

// Get all applicants
export function useApplicants(
  companyId?: string[],
  jobPositionId?: string,
  departmentId?: string[],
  options?: { enabled?: boolean }
) {
  const reduxApplicants = useAppSelector((s) => s.applicants.applicants);
  const authUser = useAppSelector((s: any) => s.auth.user);

  const userCompanyIds = (() => {
    const roleName = authUser?.roleId?.name?.toLowerCase?.();
    if (roleName === "admin" || roleName === "super admin") return undefined;
    const fromCompanies = Array.isArray(authUser?.companies)
      ? authUser.companies
          .map((c: any) => (typeof c?.companyId === "string" ? c.companyId : c?.companyId?._id))
          .filter(Boolean)
      : [];
    const fromAssigned = Array.isArray(authUser?.assignedcompanyId)
      ? authUser.assignedcompanyId.filter(Boolean)
      : [];
    const merged = Array.from(new Set([...fromCompanies, ...fromAssigned]));
    return merged.length > 0 ? merged : undefined;
  })();

  // Prefer explicit caller filter, otherwise use all companies available to logged-in non-admin user.
  const effectiveCompanyId = companyId && companyId.length > 0 ? companyId : userCompanyIds;

   return useQuery<Applicant[]>({  // Add explicit type parameter
    queryKey: applicantsKeys.list(effectiveCompanyId, jobPositionId, undefined, undefined, departmentId),
    queryFn: () => applicantsService.getAllApplicants(effectiveCompanyId, jobPositionId as any, undefined, undefined, departmentId),
    staleTime: 2 * 60 * 1000,
    enabled: options?.enabled !== undefined ? options.enabled : true,
    initialData: reduxApplicants && reduxApplicants.length > 0 ? reduxApplicants : undefined,
  });
}

// Get applicant by ID
export function useApplicant(
  id: string,
  options?: {
    initialData?: any;
    enabled?: boolean;
    staleTime?: number;
    refetchOnMount?: boolean | 'always';
    refetchOnWindowFocus?: boolean;
    refetchOnReconnect?: boolean;
  }
) {
  return useQuery<import("../../services/applicantsService").Applicant>({
    queryKey: applicantsKeys.detail(id),
    queryFn: () => applicantsService.getApplicantById(id),
    enabled: !!id && (options?.enabled !== undefined ? options.enabled : true),
    staleTime: options?.staleTime ?? 30 * 1000, // 30s - keep relatively fresh
    // If caller supplied initialData (e.g. from list cache or navigation), avoid forcing a refetch on mount.
    // Otherwise preserve existing behavior of refreshing details on mount.
    refetchOnMount:
      options?.refetchOnMount !== undefined
        ? options.refetchOnMount
        : options?.initialData
        ? false
        : 'always',
    refetchOnWindowFocus:
      options?.refetchOnWindowFocus !== undefined ? options.refetchOnWindowFocus : true,
    refetchOnReconnect:
      options?.refetchOnReconnect !== undefined ? options.refetchOnReconnect : true,
    initialData: options?.initialData,
  });
}

type MinimalApplicant = {
  _id: string;
  status: Applicant['status'];
  submittedAt?: string;
  createdAt?: string;
};

export function getApplicantStatuses(
  companyId?: string[],
  jobPositionId?: string
) {
  const reduxApplicants = useAppSelector((s) => s.applicants.applicants);
  const authUser = useAppSelector((s: any) => s.auth.user);

  const userCompanyIds = (() => {
    const roleName = authUser?.roleId?.name?.toLowerCase?.();
    if (roleName === "admin" || roleName === "super admin") return undefined;
    const fromCompanies = Array.isArray(authUser?.companies)
      ? authUser.companies
          .map((c: any) => (typeof c?.companyId === "string" ? c.companyId : c?.companyId?._id))
          .filter(Boolean)
      : [];
    const fromAssigned = Array.isArray(authUser?.assignedcompanyId)
      ? authUser.assignedcompanyId.filter(Boolean)
      : [];
    const merged = Array.from(new Set([...fromCompanies, ...fromAssigned]));
    return merged.length > 0 ? merged : undefined;
  })();

  const effectiveCompanyId = companyId && companyId.length > 0 ? companyId : userCompanyIds;

  return useQuery<any>({
    queryKey: [...applicantsKeys.list(effectiveCompanyId, jobPositionId as any, 'statuses')],
    queryFn: async () => {
      const res = await applicantsService.getApplicantStatuses(effectiveCompanyId, jobPositionId as any);
      // Server may return either an array of minimal applicants OR an object with counts.
      if (Array.isArray(res)) {
        return res.map((a) => ({ _id: a._id, status: a.status, submittedAt: a.submittedAt, createdAt: a.createdAt } as MinimalApplicant));
      }
      return res;
    },
    staleTime: 2 * 60 * 1000,
    initialData: reduxApplicants && reduxApplicants.length > 0 ? reduxApplicants.map((a: any) => ({ _id: a._id, status: a.status, submittedAt: a.submittedAt, createdAt: a.createdAt })) : undefined,
  });
}

export const useBatchUpdateApplicantStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: Array<{ applicantId: string; status: string; notes?: string; reasons?: string[] }>) => {
      return await applicantsService.batchUpdateStatus(updates);
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
    },
  });
};

// Create applicant
export function useCreateApplicant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateApplicantRequest) =>
      applicantsService.createApplicant(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicantsKeys.lists() });
    },
  });
}

// Update applicant
export function useUpdateApplicant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateApplicantRequest }) =>
      applicantsService.updateApplicant(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.lists() });
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: applicantsKeys.lists() });
      const previousDetail = queryClient.getQueryData(applicantsKeys.detail(id));

      queryClient.setQueriesData({ queryKey: applicantsKeys.lists() }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) return old.map((applicant: any) => applicant._id === id ? { ...applicant, ...data } : applicant);
        if (old.data && Array.isArray(old.data)) return { ...old, data: old.data.map((applicant: any) => applicant._id === id ? { ...applicant, ...data } : applicant) };
        return old;
      });

      queryClient.setQueryData(applicantsKeys.detail(id), (old: any) => {
        if (!old) return old;
        return { ...old, ...data };
      });

      return { previousLists, previousDetail };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(applicantsKeys.detail(_variables.id), context.previousDetail);
      }
    },
    onSettled: async (_data, _error, variables) => {
      // Perform a background refresh of the applicant detail after an update.
      // We intentionally do NOT call react-query refetch APIs so we don't toggle
      // the `isFetching` flag (which the UI uses to show a loading state). Instead
      // fetch directly and update the cache with `setQueryData`.
      try {
        const id = (variables as any)?.id as string | undefined;
        if (!id) return;
        const refreshed = await applicantsService.getApplicantById(id);
        if (refreshed && typeof refreshed === 'object') {
          queryClient.setQueryData(applicantsKeys.detail(id), refreshed);
          // Also update list queries if present so lists stay consistent.
          queryClient.setQueriesData({ queryKey: applicantsKeys.lists() }, (old: any) => {
            if (!old) return old;
            if (Array.isArray(old)) return old.map((applicant: any) => (applicant && applicant._id === id ? { ...applicant, ...refreshed } : applicant));
            if (old.data && Array.isArray(old.data)) return { ...old, data: old.data.map((applicant: any) => (applicant && applicant._id === id ? { ...applicant, ...refreshed } : applicant)) };
            return old;
          });
        }
      } catch (e) {
        // Background refresh failure is non-fatal — ignore.
      }
    },
  });
}

// Mark applicant as seen
export function useMarkApplicantSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => applicantsService.markAsSeen(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(id) });
      const previous = queryClient.getQueryData(applicantsKeys.detail(id));
      // optimistic update is handled by caller since we don't have user id here
      return { previous };
    },
    onError: (_err, id, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(applicantsKeys.detail(id as string), context.previous);
      }
    },
    onSuccess: (_data) => {
      // No further refetch is required here because callers perform an
      // optimistic update to the detail query prior to calling this
      // mutation. Invalidating here causes an immediate GET refetch
      // which results in duplicate requests (observed as two back-to-
      // back GET /applicants/:id calls). To avoid that extra request
      // we skip invalidation — if a full refresh is needed callers
      // can explicitly invalidate queries themselves.
      return;
    },
  });
}

// Update applicant status
export function useUpdateApplicantStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStatusRequest }) =>
      applicantsService.updateApplicantStatus(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: applicantsKeys.lists() });
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(id) });

      // Snapshot the previous values
      const previousLists = queryClient.getQueriesData({ queryKey: applicantsKeys.lists() });
      const previousDetail = queryClient.getQueryData(applicantsKeys.detail(id));

      // Optimistically update all list queries
      queryClient.setQueriesData({ queryKey: applicantsKeys.lists() }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) return old.map((applicant: any) => applicant._id === id ? { ...applicant, status: data.status } : applicant);
        if (old.data && Array.isArray(old.data)) return { ...old, data: old.data.map((applicant: any) => applicant._id === id ? { ...applicant, status: data.status } : applicant) };
        return old;
      });

      // Optimistically update the detail query
      queryClient.setQueryData(applicantsKeys.detail(id), (old: any) => {
        if (!old) return old;
        const normalizedReasons = Array.isArray((data as any).reasons)
          ? (data as any).reasons
              .map((reason: any) => String(reason ?? '').trim())
              .filter(Boolean)
          : [];
        const tempHistory = {
          _id: `temp-${Date.now()}`,
          status: data.status,
          notes: (data as any).notes,
          ...(normalizedReasons.length ? { reasons: normalizedReasons } : {}),
          changedAt: new Date().toISOString(),
          // preserve any extra fields (e.g., notifications) if present
          ...(data as any).notifications ? { notifications: (data as any).notifications } : {},
        };
        return { ...old, status: data.status, statusHistory: [...(old.statusHistory || []), tempHistory] };
      });

      // Return context with the previous values
      return { previousLists, previousDetail };
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous values on error
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(applicantsKeys.detail(_variables.id), context.previousDetail);
      }
    },
    onSettled: () => {
      // No refetch - keep the optimistic update
    },
  });
}

// Delete applicant
export function useDeleteApplicant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => applicantsService.deleteApplicant(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.lists() });
      const previousLists = queryClient.getQueriesData({ queryKey: applicantsKeys.lists() });

      queryClient.setQueriesData({ queryKey: applicantsKeys.lists() }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) return old.filter((applicant: any) => applicant._id !== id);
        if (old.data && Array.isArray(old.data)) return { ...old, data: old.data.filter((applicant: any) => applicant._id !== id) };
        return old;
      });

      return { previousLists };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Schedule interview
export function useScheduleInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: ScheduleInterviewRequest & { _id?: string; companyId?: any; notifications?: any };
    }) => {
      // Sanitize payload for network: remove client-only fields
      const payload: any = { ...data };
      delete payload._id;
      delete payload.companyId;
      delete payload.notifications;
      return applicantsService.scheduleInterview(id, payload);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(id) });
      const previousDetail = queryClient.getQueryData(applicantsKeys.detail(id));

      queryClient.setQueryData(applicantsKeys.detail(id), (old: any) => {
        if (!old) return old;
        const tempId = (data as any)?._id ?? `temp-${Date.now()}`;
        const newInterview = {
          ...data,
          _id: tempId,
          issuedAt: new Date().toISOString(),
        };
        return {
          ...old,
          interviews: [...(old.interviews || []), newInterview],
        };
      });

      return { previousDetail };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(applicantsKeys.detail(_variables.id), context.previousDetail);
      }
    },
    onSuccess: (updatedApplicant, variables) => {
      const candidate = updatedApplicant as any;
      const candidateId = String(candidate?._id || candidate?.id || '');
      const expectedApplicantId = String(variables.id || '');
      const hasInterviewsArray = Array.isArray(candidate?.interviews);

      if (
        candidate &&
        typeof candidate === 'object' &&
        (hasInterviewsArray || (candidateId && candidateId === expectedApplicantId))
      ) {
        queryClient.setQueryData(applicantsKeys.detail(variables.id), updatedApplicant);
        return;
      }

      queryClient.invalidateQueries({ queryKey: applicantsKeys.detail(variables.id) });
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Schedule interviews in bulk
export function useScheduleBulkInterviews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { interviews: Array<any> } | Array<any>) =>
      applicantsService.scheduleBulkInterviews(payload as any),
    onSuccess: () => {
      // Keep table/detail data fresh after batch scheduling.
      queryClient.invalidateQueries({ queryKey: applicantsKeys.lists() });
    },
  });
}

// Update interview status
export function useUpdateInterviewStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicantId,
      interviewId,
      data,
    }: {
      applicantId: string;
      interviewId: string;
      data: UpdateInterviewStatusRequest;
    }) => applicantsService.updateInterviewStatus(applicantId, interviewId, data),
    onMutate: async ({ applicantId, interviewId, data }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(applicantId) });
      const previousDetail = queryClient.getQueryData(applicantsKeys.detail(applicantId));

      queryClient.setQueryData(applicantsKeys.detail(applicantId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          interviews: old.interviews?.map((interview: any) =>
            interview._id === interviewId
              ? { ...interview, ...data }
              : interview
          ),
        };
      });

      return { previousDetail };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(applicantsKeys.detail(_variables.applicantId), context.previousDetail);
      }
    },
    onSuccess: (updatedApplicant, variables) => {
      queryClient.setQueryData(applicantsKeys.detail(variables.applicantId), updatedApplicant);
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Add comment
export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AddCommentRequest }) =>
      applicantsService.addComment(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(id) });
      const previousDetail = queryClient.getQueryData(applicantsKeys.detail(id));

      queryClient.setQueryData(applicantsKeys.detail(id), (old: any) => {
        if (!old) return old;
        const newComment = {
          ...data,
          _id: `temp-${Date.now()}`,
          changedAt: new Date().toISOString(),
        };
        return {
          ...old,
          comments: [...(old.comments || []), newComment],
        };
      });

      return { previousDetail };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(applicantsKeys.detail(_variables.id), context.previousDetail);
      }
    },
    onSuccess: (updatedApplicant, variables) => {
      queryClient.setQueryData(applicantsKeys.detail(variables.id), updatedApplicant);
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Send message
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SendMessageRequest }) =>
      applicantsService.sendMessage(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel list and detail queries to avoid overwriting optimistic updates
      await queryClient.cancelQueries({ queryKey: applicantsKeys.lists() });
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: applicantsKeys.lists() });
      const previousDetail = queryClient.getQueryData(applicantsKeys.detail(id));

      // Prepare an optimistic message object
      const optimisticMessage = {
        ...data,
        _id: `temp-${Date.now()}`,
        sentAt: new Date().toISOString(),
        status: 'pending',
      };

      // Optimistically update the detail query
      queryClient.setQueryData(applicantsKeys.detail(id), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: [...(old.messages || []), optimisticMessage],
        };
      });

      // Optimistically update any list queries so the messages counter updates immediately
      queryClient.setQueriesData({ queryKey: applicantsKeys.lists() }, (old: any) => {
        if (!old) return old;
        const applyUpdateToApplicant = (applicant: any) => {
          if (!applicant) return applicant;
          if (String(applicant._id) !== String(id)) return applicant;

          const copy = { ...applicant };

          // If messages array exists, append optimistic message
          if (Array.isArray(copy.messages)) {
            copy.messages = [...copy.messages, optimisticMessage];
          }

          // If explicit messageCount or messages numeric field exists, increment it
          if (typeof copy.messageCount === 'number') {
            copy.messageCount = copy.messageCount + 1;
          } else if (typeof copy.messages === 'number') {
            copy.messages = copy.messages + 1;
          } else if (typeof copy.messagesCount === 'number') {
            copy.messagesCount = copy.messagesCount + 1;
          } else if (!Array.isArray(applicant.messages) && typeof copy.messageCount !== 'number') {
            // If no explicit counters exist, initialize messageCount to 1
            copy.messageCount = 1;
          }

          return copy;
        };

        if (Array.isArray(old)) return old.map((a: any) => applyUpdateToApplicant(a));
        if (old.data && Array.isArray(old.data)) return { ...old, data: old.data.map((a: any) => applyUpdateToApplicant(a)) };
        return old;
      });

      return { previousLists, previousDetail };
    },
    onError: (_err, _variables, context) => {
      // Rollback both lists and detail on error
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(applicantsKeys.detail(_variables.id), context.previousDetail);
      }
    },
    onSuccess: (updatedApplicant, variables) => {
      // Update detail with server response
      queryClient.setQueryData(applicantsKeys.detail(variables.id), updatedApplicant);

      // Also reconcile list queries with the server response when possible
      queryClient.setQueriesData({ queryKey: applicantsKeys.lists() }, (old: any) => {
        if (!old) return old;
        const applyServerUpdate = (applicant: any) => {
          if (!applicant) return applicant;
          if (String(applicant._id) !== String(variables.id)) return applicant;
          // Merge server-updated fields while preserving other list fields
          return { ...applicant, ...(updatedApplicant || {}) };
        };

        if (Array.isArray(old)) return old.map((a: any) => applyServerUpdate(a));
        if (old.data && Array.isArray(old.data)) return { ...old, data: old.data.map((a: any) => applyServerUpdate(a)) };
        return old;
      });
    },
    onSettled: () => {
      // No refetch
    },
  });
}
