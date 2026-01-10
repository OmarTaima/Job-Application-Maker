import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { departmentsService } from "../../services/departmentsService";
import type {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
} from "../../services/departmentsService";

// Query keys
export const departmentsKeys = {
  all: ["departments"] as const,
  lists: () => [...departmentsKeys.all, "list"] as const,
  list: (companyId?: string) =>
    [...departmentsKeys.lists(), { companyId }] as const,
  details: () => [...departmentsKeys.all, "detail"] as const,
  detail: (id: string) => [...departmentsKeys.details(), id] as const,
};

// Get all departments
export function useDepartments(companyId?: string) {
  return useQuery({
    queryKey: departmentsKeys.list(companyId),
    queryFn: () => departmentsService.getAllDepartments(companyId),
    staleTime: 5 * 60 * 1000,
  });
}

// Get department by ID
export function useDepartment(id: string) {
  return useQuery({
    queryKey: departmentsKeys.detail(id),
    queryFn: () => departmentsService.getDepartmentById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// Create department
export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDepartmentRequest) =>
      departmentsService.createDepartment(data),
    onMutate: async (newDepartment) => {
      await queryClient.cancelQueries({ queryKey: departmentsKeys.lists() });
      const previousDepartments = queryClient.getQueriesData({ queryKey: departmentsKeys.lists() });

      queryClient.setQueriesData({ queryKey: departmentsKeys.lists() }, (old: any) => {
        if (!old) return old;
        const tempDepartment = {
          ...newDepartment,
          _id: `temp-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        return [...old, tempDepartment];
      });

      return { previousDepartments };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousDepartments) {
        context.previousDepartments.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (newDepartment) => {
      queryClient.setQueriesData({ queryKey: departmentsKeys.lists() }, (old: any) => {
        if (!old) return [newDepartment];
        return old.map((dept: any) => 
          dept._id.startsWith('temp-') ? newDepartment : dept
        ).filter((dept: any, index: number, self: any[]) => 
          self.findIndex((d: any) => d._id === dept._id) === index
        );
      });
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Update department
export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDepartmentRequest }) =>
      departmentsService.updateDepartment(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: departmentsKeys.lists() });
      await queryClient.cancelQueries({ queryKey: departmentsKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: departmentsKeys.lists() });
      const previousDetail = queryClient.getQueryData(departmentsKeys.detail(id));

      queryClient.setQueriesData({ queryKey: departmentsKeys.lists() }, (old: any) => {
        if (!old) return old;
        return old.map((dept: any) =>
          dept._id === id ? { ...dept, ...data } : dept
        );
      });

      queryClient.setQueryData(departmentsKeys.detail(id), (old: any) => {
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
        queryClient.setQueryData(departmentsKeys.detail(_variables.id), context.previousDetail);
      }
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Delete department
export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => departmentsService.deleteDepartment(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: departmentsKeys.lists() });
      const previousDepartments = queryClient.getQueriesData({ queryKey: departmentsKeys.lists() });

      queryClient.setQueriesData({ queryKey: departmentsKeys.lists() }, (old: any) => {
        if (!old) return old;
        return old.filter((dept: any) => dept._id !== id);
      });

      return { previousDepartments };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousDepartments) {
        context.previousDepartments.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // No refetch
    },
  });
}
