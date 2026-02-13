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
  list: (companyId?: string[]) =>
    [...jobPositionsKeys.lists(), { companyId }] as const,
  details: () => [...jobPositionsKeys.all, "detail"] as const,
  detail: (id: string) => [...jobPositionsKeys.details(), id] as const,
  applicants: (id: string) =>
    [...jobPositionsKeys.detail(id), "applicants"] as const,
};

// Get all job positions
export function useJobPositions(companyId?: string[], deleted: boolean = false) {
  return useQuery<import("../../services/jobPositionsService").JobPosition[]>({
    queryKey: jobPositionsKeys.list(companyId),
    queryFn: () => {
      // Special sentinel to indicate "no companies assigned" -> return empty list
      if (companyId && companyId.length === 1 && companyId[0] === '__NO_COMPANY__') {
        return Promise.resolve([] as any);
      }
      // service now accepts a single options object
      // cast to any to satisfy current service typing (may expect a string[] overload)
      return jobPositionsService.getAllJobPositions({ companyId, deleted } as any);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Get job position by ID
export function useJobPosition(id: string, options?: { enabled?: boolean }) {
  return useQuery<import("../../services/jobPositionsService").JobPosition>({
    queryKey: jobPositionsKeys.detail(id),
    queryFn: () => jobPositionsService.getJobPositionById(id),
    enabled: options?.enabled !== undefined ? options.enabled : !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// Get applicants for job position
export function useJobPositionApplicants(id: string) {
  return useQuery<import("../../services/jobPositionsService").Applicant[]>({
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
    onMutate: async (newJobPosition) => {
      await queryClient.cancelQueries({ queryKey: jobPositionsKeys.lists() });
      const previousJobPositions = queryClient.getQueriesData({ queryKey: jobPositionsKeys.lists() });

      queryClient.setQueriesData({ queryKey: jobPositionsKeys.lists() }, (old: any) => {
        if (!old) return old;
        const tempJobPosition = {
          ...newJobPosition,
          _id: `temp-${Date.now()}`,
          createdAt: new Date().toISOString(),
          status: 'active',
        };
        return [...old, tempJobPosition];
      });

      return { previousJobPositions };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousJobPositions) {
        context.previousJobPositions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (newJobPosition) => {
      if (!newJobPosition || !(newJobPosition as any)._id) {
        queryClient.invalidateQueries({ queryKey: jobPositionsKeys.lists() });
        return;
      }

      queryClient.setQueriesData({ queryKey: jobPositionsKeys.lists() }, (old: any) => {
        if (!old) return [newJobPosition];
        return old
          .map((job: any) => (job._id && String(job._id).startsWith('temp-') ? newJobPosition : job))
          .filter((job: any, index: number, self: any[]) => self.findIndex((j: any) => j._id === job._id) === index);
      });
    },
    onSettled: () => {
      // No refetch
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
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: jobPositionsKeys.lists() });
      await queryClient.cancelQueries({ queryKey: jobPositionsKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: jobPositionsKeys.lists() });
      const previousDetail = queryClient.getQueryData(jobPositionsKeys.detail(id));

      queryClient.setQueriesData({ queryKey: jobPositionsKeys.lists() }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) return old.map((job: any) => job._id === id ? { ...job, ...data } : job);
        if (old && old.data && Array.isArray(old.data)) return { ...old, data: old.data.map((job: any) => job._id === id ? { ...job, ...data } : job) };
        return old;
      });

      queryClient.setQueryData(jobPositionsKeys.detail(id), (old: any) => {
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
        queryClient.setQueryData(jobPositionsKeys.detail(_variables.id), context.previousDetail);
      }
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Delete job position
export function useDeleteJobPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => jobPositionsService.deleteJobPosition(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: jobPositionsKeys.lists() });
      const previousJobPositions = queryClient.getQueriesData({ queryKey: jobPositionsKeys.lists() });

      queryClient.setQueriesData({ queryKey: jobPositionsKeys.lists() }, (old: any) => {
        if (!old) return old;
        return old.filter((job: any) => job._id !== id);
      });

      return { previousJobPositions };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousJobPositions) {
        context.previousJobPositions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Clone job position
export function useCloneJobPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => jobPositionsService.cloneJobPosition(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: jobPositionsKeys.lists() });
      const previousJobPositions = queryClient.getQueriesData({ queryKey: jobPositionsKeys.lists() });
      const originalJob = queryClient.getQueryData(jobPositionsKeys.detail(id));

      if (originalJob) {
        queryClient.setQueriesData({ queryKey: jobPositionsKeys.lists() }, (old: any) => {
          if (!old) return old;
          const clonedJob = {
            ...(originalJob as any),
            _id: `temp-${Date.now()}`,
            title: `${(originalJob as any).title} (Copy)`,
            createdAt: new Date().toISOString(),
          };
          return [...old, clonedJob];
        });
      }

      return { previousJobPositions };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousJobPositions) {
        context.previousJobPositions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (clonedJob) => {
      queryClient.setQueriesData({ queryKey: jobPositionsKeys.lists() }, (old: any) => {
        if (!old) return { data: [clonedJob] };
        if (Array.isArray(old)) {
          const updated = old.map((job: any) => job._id.startsWith('temp-') ? clonedJob : job).filter((job: any, index: number, self: any[]) => self.findIndex((j: any) => j._id === job._id) === index);
          return updated;
        }
        if (old && old.data && Array.isArray(old.data)) {
          const updated = old.data.map((job: any) => job._id.startsWith('temp-') ? clonedJob : job).filter((job: any, index: number, self: any[]) => self.findIndex((j: any) => j._id === job._id) === index);
          return { ...old, data: updated };
        }
        return old;
      });
    },
    onSettled: () => {
      // No refetch
    },
  });
}
