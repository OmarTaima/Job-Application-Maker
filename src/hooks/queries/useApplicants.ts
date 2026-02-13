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

// Query keys
export const applicantsKeys = {
  all: ["applicants"] as const,
  lists: () => [...applicantsKeys.all, "list"] as const,
  list: (companyId?: string[],  jobPositionId?: string) =>
    [...applicantsKeys.lists(), { companyId, jobPositionId }] as const,
  details: () => [...applicantsKeys.all, "detail"] as const,
  detail: (id: string) => [...applicantsKeys.details(), id] as const,
};

// Get all applicants
export function useApplicants(
  companyId?: string[],
  jobPositionId?: string
) {
  const reduxApplicants = useAppSelector((s) => s.applicants.applicants);

  return useQuery<import("../../services/applicantsService").Applicant[]>({
    queryKey: applicantsKeys.list(companyId,  jobPositionId),
    // cast second arg to any to satisfy service signature when types differ
    queryFn: () => applicantsService.getAllApplicants(companyId, jobPositionId as any),
    staleTime: 2 * 60 * 1000, // 2 minutes
    initialData: reduxApplicants && reduxApplicants.length > 0 ? reduxApplicants : undefined,
  });
}

// Get applicant by ID
export function useApplicant(id: string, options?: { initialData?: any }) {
  return useQuery<import("../../services/applicantsService").Applicant>({
    queryKey: applicantsKeys.detail(id),
    queryFn: () => applicantsService.getApplicantById(id),
    enabled: !!id,
    staleTime: 30 * 1000, // 30s - keep relatively fresh
    // Always refetch on mount to ensure interviews are up-to-date on page load
    refetchOnMount: 'always',
    initialData: options?.initialData,
  });
}

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
    onSettled: () => {
      // No refetch
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
        return { ...old, status: data.status };
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
      data: ScheduleInterviewRequest;
    }) => applicantsService.scheduleInterview(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(id) });
      const previousDetail = queryClient.getQueryData(applicantsKeys.detail(id));

      queryClient.setQueryData(applicantsKeys.detail(id), (old: any) => {
        if (!old) return old;
        const newInterview = {
          ...data,
          _id: `temp-${Date.now()}`,
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
    },
    onSettled: () => {
      // No refetch
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
              ? { ...interview, status: data.status, notes: data.notes }
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
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(id) });
      const previousDetail = queryClient.getQueryData(applicantsKeys.detail(id));

      queryClient.setQueryData(applicantsKeys.detail(id), (old: any) => {
        if (!old) return old;
        const newMessage = {
          ...data,
          _id: `temp-${Date.now()}`,
          sentAt: new Date().toISOString(),
          status: 'pending',
        };
        return {
          ...old,
          messages: [...(old.messages || []), newMessage],
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
