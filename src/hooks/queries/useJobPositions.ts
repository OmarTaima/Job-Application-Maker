import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobPositionsService } from "../../services/jobPositionsService";
import type {
  CreateJobPositionRequest,
  UpdateJobPositionRequest,
} from "../../services/jobPositionsService";

// Query keys
export const jobPositionsKeys = {
  all: ["jobPositions"] as const,
  lists: () => [...jobPositionsKeys.all, "list"] as const,
  list: (companyIds?: string[]) =>
    [...jobPositionsKeys.lists(), { companyIds }] as const,
  details: () => [...jobPositionsKeys.all, "detail"] as const,
  detail: (id: string) => [...jobPositionsKeys.details(), id] as const,
  applicants: (id: string) =>
    [...jobPositionsKeys.detail(id), "applicants"] as const,
};

// Get all job positions
export function useJobPositions(companyIds?: string[]) {
  return useQuery({
    queryKey: jobPositionsKeys.list(companyIds),
    queryFn: () => jobPositionsService.getAllJobPositions(companyIds),
    staleTime: 5 * 60 * 1000,
  });
}

// Get job position by ID
export function useJobPosition(id: string) {
  return useQuery({
    queryKey: jobPositionsKeys.detail(id),
    queryFn: () => jobPositionsService.getJobPositionById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// Get applicants for job position
export function useJobPositionApplicants(id: string) {
  return useQuery({
    queryKey: jobPositionsKeys.applicants(id),
    queryFn: () => jobPositionsService.getApplicantsForPosition(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes - fresher data for applicants
  });
}

// Create job position
export function useCreateJobPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateJobPositionRequest) =>
      jobPositionsService.createJobPosition(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobPositionsKeys.lists() });
    },
  });
}

// Update job position
export function useUpdateJobPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateJobPositionRequest;
    }) => jobPositionsService.updateJobPosition(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: jobPositionsKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: jobPositionsKeys.detail(variables.id),
      });
    },
  });
}

// Delete job position
export function useDeleteJobPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => jobPositionsService.deleteJobPosition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobPositionsKeys.lists() });
    },
  });
}

// Clone job position
export function useCloneJobPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => jobPositionsService.cloneJobPosition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobPositionsKeys.lists() });
    },
  });
}
