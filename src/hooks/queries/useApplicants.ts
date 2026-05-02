// hooks/queries/useApplicants.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicantsService } from "../../services/applicantsService";
import type {
  CreateApplicantRequest,
  UpdateApplicantRequest,
  UpdateStatusRequest,
  ScheduleInterviewRequest,
  UpdateInterviewStatusRequest,
  AddCommentRequest,
  SendMessageRequest,
  Applicant,
  BulkScheduleInterviewRequest,
  BulkScheduleInterviewItem,
} from "../../types/applicants";

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
  return useQuery<Applicant[]>({
    queryKey: applicantsKeys.list(companyId, jobPositionId, undefined, undefined, departmentId),
    queryFn: () => applicantsService.getAllApplicants(
      companyId, 
      jobPositionId as any, 
      undefined, 
      undefined, 
      departmentId
    ),
    staleTime: 2 * 60 * 1000,
    enabled: options?.enabled !== undefined ? options.enabled : true,
  });
}

// Get applicant by ID
export function useApplicant(
  id: string,
  options?: {
    initialData?: Applicant;
    enabled?: boolean;
    staleTime?: number;
    refetchOnMount?: boolean | 'always';
    refetchOnWindowFocus?: boolean;
    refetchOnReconnect?: boolean;
  }
) {
  return useQuery<Applicant>({
    queryKey: applicantsKeys.detail(id),
    queryFn: () => applicantsService.getApplicantById(id),
    enabled: !!id && (options?.enabled !== undefined ? options.enabled : true),
    staleTime: options?.staleTime ?? 30 * 1000,
    refetchOnMount: options?.refetchOnMount !== undefined
      ? options.refetchOnMount
      : options?.initialData
      ? false
      : 'always',
    refetchOnWindowFocus: options?.refetchOnWindowFocus !== undefined ? options.refetchOnWindowFocus : true,
    refetchOnReconnect: options?.refetchOnReconnect !== undefined ? options.refetchOnReconnect : true,
    initialData: options?.initialData,
  });
}

// Get applicant statuses
export function useApplicantStatuses(
  companyId?: string[],
  jobPositionId?: string
) {
  return useQuery<Applicant[] | Record<string, number>>({
    queryKey: [...applicantsKeys.list(companyId, jobPositionId as any, 'statuses')],
    queryFn: () => applicantsService.getApplicantStatuses(companyId, jobPositionId as any),
    staleTime: 2 * 60 * 1000,
  });
}

// Batch update applicant status
export const useBatchUpdateApplicantStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Array<{ applicantId: string; status: string; notes?: string; reasons?: string[] }>) => {
      return applicantsService.batchUpdateStatus(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicantsKeys.lists() });
    },
  });
};

// Create applicant
export function useCreateApplicant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateApplicantRequest) => applicantsService.createApplicant(data),
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
        if (Array.isArray(old)) {
          return old.map((applicant: Applicant) => 
            applicant._id === id ? { ...applicant, ...data } : applicant
          );
        }
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
      return { previous };
    },
    onError: (_err, id, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(applicantsKeys.detail(id as string), context.previous);
      }
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
      await queryClient.cancelQueries({ queryKey: applicantsKeys.lists() });
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: applicantsKeys.lists() });
      const previousDetail = queryClient.getQueryData(applicantsKeys.detail(id));

      queryClient.setQueriesData({ queryKey: applicantsKeys.lists() }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((applicant: Applicant) => 
            applicant._id === id ? { ...applicant, status: data.status } : applicant
          );
        }
        return old;
      });

      queryClient.setQueryData(applicantsKeys.detail(id), (old: any) => {
        if (!old) return old;
        return { ...old, status: data.status };
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
        if (Array.isArray(old)) {
          return old.filter((applicant: Applicant) => applicant._id !== id);
        }
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
  });
}

// Schedule interview
export function useScheduleInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ScheduleInterviewRequest }) =>
      applicantsService.scheduleInterview(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(id) });
      const previousDetail = queryClient.getQueryData(applicantsKeys.detail(id));

      queryClient.setQueryData(applicantsKeys.detail(id), (old: any) => {
        if (!old) return old;
        const tempId = `temp-${Date.now()}`;
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
      queryClient.setQueryData(applicantsKeys.detail(variables.id), updatedApplicant);
      queryClient.invalidateQueries({ queryKey: applicantsKeys.lists() });
    },
  });
}

// Schedule interviews in bulk
export function useScheduleBulkInterviews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BulkScheduleInterviewRequest | BulkScheduleInterviewItem[]) =>
      applicantsService.scheduleBulkInterviews(payload as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicantsKeys.lists() });
    },
  });
}

// Update interview status
export function useUpdateInterviewStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ applicantId, interviewId, data }: { applicantId: string; interviewId: string; data: UpdateInterviewStatusRequest }) =>
      applicantsService.updateInterviewStatus(applicantId, interviewId, data),
    onMutate: async ({ applicantId, interviewId, data }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(applicantId) });
      const previousDetail = queryClient.getQueryData(applicantsKeys.detail(applicantId));

      queryClient.setQueryData(applicantsKeys.detail(applicantId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          interviews: old.interviews?.map((interview: any) =>
            interview._id === interviewId ? { ...interview, ...data } : interview
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
  });
}

// Send message
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SendMessageRequest }) =>
      applicantsService.sendMessage(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.lists() });
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: applicantsKeys.lists() });
      const previousDetail = queryClient.getQueryData(applicantsKeys.detail(id));

      const optimisticMessage = {
        ...data,
        _id: `temp-${Date.now()}`,
        sentAt: new Date().toISOString(),
        status: 'pending',
      };

      queryClient.setQueryData(applicantsKeys.detail(id), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: [...(old.messages || []), optimisticMessage],
        };
      });

      queryClient.setQueriesData({ queryKey: applicantsKeys.lists() }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((applicant: Applicant) => {
            if (applicant._id !== id) return applicant;
            return {
              ...applicant,
              messages: [...(applicant.messages || []), optimisticMessage],
            };
          });
        }
        return old;
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
    onSuccess: (updatedApplicant, variables) => {
      queryClient.setQueryData(applicantsKeys.detail(variables.id), updatedApplicant);
      queryClient.invalidateQueries({ queryKey: applicantsKeys.lists() });
    },
  });
}