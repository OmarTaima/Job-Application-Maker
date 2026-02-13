import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { departmentsService } from "../../services/departmentsService";
import type {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  Department,
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
export function useDepartments(companyId?: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  return useQuery<Department[]>({
    queryKey: departmentsKeys.list(companyId),
    queryFn: async () => {
      const cachedAll = queryClient.getQueryData(departmentsKeys.list()) as any[] | undefined;
      if (cachedAll && cachedAll.length > 0) {
        if (companyId) {
          return cachedAll.filter((d: any) => {
            const deptCompanyId = typeof d.companyId === "string" ? d.companyId : d.companyId?._id;
            return deptCompanyId === companyId;
          });
        }
        return cachedAll;
      }
      return departmentsService.getAllDepartments(companyId);
    },
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 5 * 60 * 1000,
  });
}

// Get department by ID
export function useDepartment(id: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: departmentsKeys.detail(id),
    queryFn: async () => {
      const lists = queryClient.getQueriesData({ queryKey: departmentsKeys.lists() }) as Array<[any, any]> | undefined;
      if (lists && lists.length > 0) {
        for (const [, data] of lists) {
          if (Array.isArray(data)) {
            const found = data.find((d: any) => d._id === id);
            if (found) return found;
          }
        }
      }
      return departmentsService.getDepartmentById(id);
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!id,
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
        if (!old) return { data: [newDepartment] };
        if (Array.isArray(old)) {
          if (Array.isArray(old)) {
            const updated = old.map((dept: any) => dept._id.startsWith('temp-') ? newDepartment : dept).filter((dept: any, index: number, self: any[]) => self.findIndex((d: any) => d._id === dept._id) === index);
            return updated;
          }
          if (old && old.data && Array.isArray(old.data)) {
            const updated = old.data.map((dept: any) => dept._id.startsWith('temp-') ? newDepartment : dept).filter((dept: any, index: number, self: any[]) => self.findIndex((d: any) => d._id === dept._id) === index);
            return { ...old, data: updated };
          }
          return old;
        }
        if (old.data && Array.isArray(old.data)) {
          const updated = old.data.map((dept: any) => dept._id.startsWith('temp-') ? newDepartment : dept).filter((dept: any, index: number, self: any[]) => self.findIndex((d: any) => d._id === dept._id) === index);
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
        if (Array.isArray(old)) return old.map((dept: any) => dept._id === id ? { ...dept, ...data } : dept);
        if (old && old.data && Array.isArray(old.data)) return { ...old, data: old.data.map((dept: any) => dept._id === id ? { ...dept, ...data } : dept) };
        return old;
        if (old.data && Array.isArray(old.data)) return { ...old, data: old.data.map((dept: any) => dept._id === id ? { ...dept, ...data } : dept) };
        return old;
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
        if (Array.isArray(old)) return old.filter((dept: any) => dept._id !== id);
        if (old.data && Array.isArray(old.data)) return { ...old, data: old.data.filter((dept: any) => dept._id !== id) };
        return old;
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
