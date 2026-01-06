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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() });
    },
  });
}

// Update department
export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDepartmentRequest }) =>
      departmentsService.updateDepartment(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: departmentsKeys.detail(variables.id),
      });
    },
  });
}

// Delete department
export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => departmentsService.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() });
    },
  });
}
