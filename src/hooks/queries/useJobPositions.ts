// hooks/queries/useJobPositions.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobPositionsService } from "../../services/jobPositionsService";
import { useAuth } from "../../context/AuthContext";
import type {
  CreateJobPositionRequest,
  UpdateJobPositionRequest,
  JobPosition,
} from "../../types/jobPositions";
import { ApiError } from "../../services/companiesService";
import Swal from "../../utils/swal";

// Query keys
export const jobPositionsKeys = {
  all: ["jobPositions"] as const,
  lists: () => [...jobPositionsKeys.all, "list"] as const,
  list: (companyId?: string[], departmentId?: string[]) =>
    [...jobPositionsKeys.lists(), { companyId, departmentId }] as const,
  detail: (id: string) => [...jobPositionsKeys.all, "detail", id] as const,
  applicants: (id: string) => [...jobPositionsKeys.detail(id), "applicants"] as const,
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

// Get all job positions
export function useJobPositions(
  companyId?: string[], 
  deleted: boolean = false, 
  departmentId?: string[], 
  options?: { enabled?: boolean }
) {
  const { user } = useAuth();
  const userCompanyIds = getUserCompanyIds(user);
  const effectiveCompanyId = companyId?.length ? companyId : userCompanyIds;

  // Special case: no companies assigned
  if (effectiveCompanyId?.length === 1 && effectiveCompanyId[0] === '__NO_COMPANY__') {
    return useQuery({
      queryKey: jobPositionsKeys.list(effectiveCompanyId, departmentId),
      queryFn: () => Promise.resolve([] as JobPosition[]),
      enabled: false,
    });
  }

  return useQuery({
    queryKey: jobPositionsKeys.list(effectiveCompanyId, departmentId),
    queryFn: () => jobPositionsService.getAllJobPositions({ 
      companyId: effectiveCompanyId, 
      deleted, 
      departmentId 
    }),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

// Get job position by ID
export function useJobPosition(id: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: jobPositionsKeys.detail(id),
    queryFn: () => jobPositionsService.getJobPositionById(id),
    enabled: options?.enabled ?? !!id,
    staleTime: 5 * 60 * 1000,
    initialData: () => {
      // Try to find from cached list
      const cached = queryClient.getQueryData<JobPosition[]>(jobPositionsKeys.list());
      return cached?.find(job => job._id === id);
    },
  });
}

// Get applicants for job position
export function useJobPositionApplicants(id: string) {
  return useQuery({
    queryKey: jobPositionsKeys.applicants(id),
    queryFn: () => jobPositionsService.getApplicantsForPosition(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

// Create job position
export function useCreateJobPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateJobPositionRequest) =>
      jobPositionsService.createJobPosition(data),
    onSuccess: (newJobPosition) => {
      // Update list cache
      queryClient.setQueryData<JobPosition[]>(jobPositionsKeys.list(), (old) => {
        if (!old) return [newJobPosition];
        return [...old.filter(job => !job._id?.startsWith('temp-')), newJobPosition];
      });
      
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: jobPositionsKeys.lists() });
      
      showSuccessToast("Job position created successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to create job position");
    },
  });
}

// Update job position
export function useUpdateJobPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateJobPositionRequest }) =>
      jobPositionsService.updateJobPosition(id, data),
    onSuccess: (updatedJob, { id }) => {
      // Update detail cache
      queryClient.setQueryData(jobPositionsKeys.detail(id), updatedJob);
      
      // Update list cache
      queryClient.setQueryData<JobPosition[]>(jobPositionsKeys.list(), (old) => {
        if (!old) return [updatedJob];
        return old.map(job => job._id === id ? updatedJob : job);
      });
      
      showSuccessToast("Job position updated successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to update job position");
    },
  });
}

// Delete job position
export function useDeleteJobPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => jobPositionsService.deleteJobPosition(id),
    onSuccess: (_, id) => {
      // Remove from list cache
      queryClient.setQueryData<JobPosition[]>(jobPositionsKeys.list(), (old) => {
        if (!old) return [];
        return old.filter(job => job._id !== id);
      });
      
      // Remove detail cache
      queryClient.removeQueries({ queryKey: jobPositionsKeys.detail(id) });
      
      showSuccessToast("Job position deleted successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to delete job position");
    },
  });
}

// Clone job position
export function useCloneJobPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => jobPositionsService.cloneJobPosition(id),
    onSuccess: (clonedJob) => {
      // Update list cache
      queryClient.setQueryData<JobPosition[]>(jobPositionsKeys.list(), (old) => {
        if (!old) return [clonedJob];
        return [...old, clonedJob];
      });
      
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: jobPositionsKeys.lists() });
      
      showSuccessToast("Job position cloned successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to clone job position");
    },
  });
}

// Reorder job positions
export function useReorderJobPositions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      items, 
      basePayloadById 
    }: { 
      items: Array<{ id: string; order: number }>;
      basePayloadById?: Record<string, UpdateJobPositionRequest>;
    }) => jobPositionsService.reorderJobPositions(items, basePayloadById),
    onSuccess: () => {
      // Invalidate lists to refresh order
      queryClient.invalidateQueries({ queryKey: jobPositionsKeys.lists() });
      showSuccessToast("Job positions reordered successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to reorder job positions");
    },
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