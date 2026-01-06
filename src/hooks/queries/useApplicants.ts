import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicantsService } from "../../services/applicantsService";
import type {
  CreateApplicantRequest,
  UpdateApplicantRequest,
  UpdateStatusRequest,
  ScheduleInterviewRequest,
  AddCommentRequest,
  SendMessageRequest,
} from "../../services/applicantsService";

// Query keys
export const applicantsKeys = {
  all: ["applicants"] as const,
  lists: () => [...applicantsKeys.all, "list"] as const,
  list: (companyId?: string) =>
    [...applicantsKeys.lists(), { companyId }] as const,
  details: () => [...applicantsKeys.all, "detail"] as const,
  detail: (id: string) => [...applicantsKeys.details(), id] as const,
};

// Get all applicants
export function useApplicants(companyId?: string) {
  return useQuery({
    queryKey: applicantsKeys.list(companyId),
    queryFn: () => applicantsService.getAllApplicants(companyId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get applicant by ID
export function useApplicant(id: string) {
  return useQuery({
    queryKey: applicantsKeys.detail(id),
    queryFn: () => applicantsService.getApplicantById(id),
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 minute - fresher data
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: applicantsKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: applicantsKeys.detail(variables.id),
      });
    },
  });
}

// Update applicant status
export function useUpdateApplicantStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStatusRequest }) =>
      applicantsService.updateApplicantStatus(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: applicantsKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: applicantsKeys.detail(variables.id),
      });
    },
  });
}

// Delete applicant
export function useDeleteApplicant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => applicantsService.deleteApplicant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicantsKeys.lists() });
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: applicantsKeys.detail(variables.id),
      });
    },
  });
}

// Add comment
export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AddCommentRequest }) =>
      applicantsService.addComment(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: applicantsKeys.detail(variables.id),
      });
    },
  });
}

// Send message
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SendMessageRequest }) =>
      applicantsService.sendMessage(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: applicantsKeys.detail(variables.id),
      });
    },
  });
}
