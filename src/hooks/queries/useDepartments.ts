// hooks/queries/useDepartments.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { departmentsService } from "../../services/departmentsService";
import { useAuth } from "../../context/AuthContext";
import type {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  Department,
} from "../../types/departments";
import { ApiError } from "../../services/companiesService";
import Swal from "../../utils/swal";

// Query keys
export const departmentsKeys = {
  all: ["departments"] as const,
  lists: () => [...departmentsKeys.all, "list"] as const,
  list: (companyId?: string | string[]) =>
    [...departmentsKeys.lists(), { companyId }] as const,
  detail: (id: string) => [...departmentsKeys.all, "detail", id] as const,
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

// Get all departments
export function useDepartments(companyId?: string | string[], options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const userCompanyIds = getUserCompanyIds(user);
  const effectiveCompanyId = companyId ?? userCompanyIds;

  return useQuery({
    queryKey: departmentsKeys.list(effectiveCompanyId),
    queryFn: () => departmentsService.getAllDepartments(effectiveCompanyId as any),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

// Get department by ID
export function useDepartment(id: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: departmentsKeys.detail(id),
    queryFn: () => departmentsService.getDepartmentById(id),
    enabled: options?.enabled ?? !!id,
    staleTime: 5 * 60 * 1000,
    initialData: () => {
      // Try to find from cached list
      const cached = queryClient.getQueryData<Department[]>(departmentsKeys.list());
      return cached?.find(d => d._id === id);
    },
  });
}

// Create department
export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDepartmentRequest) =>
      departmentsService.createDepartment(data),
    onSuccess: (newDepartment) => {
      // Update the list cache
      queryClient.setQueryData<Department[]>(departmentsKeys.list(), (old) => {
        if (!old) return [newDepartment];
        return [...old.filter(d => !d._id?.startsWith('temp-')), newDepartment];
      });
      
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() });
      
      showSuccessToast("Department created successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to create department");
    },
  });
}

// Update department
export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDepartmentRequest }) =>
      departmentsService.updateDepartment(id, data),
    onSuccess: (updatedDepartment, { id }) => {
      // Update the detail cache
      queryClient.setQueryData(departmentsKeys.detail(id), updatedDepartment);
      
      // Update the list cache
      queryClient.setQueryData<Department[]>(departmentsKeys.list(), (old) => {
        if (!old) return [updatedDepartment];
        return old.map(d => d._id === id ? updatedDepartment : d);
      });
      
      showSuccessToast("Department updated successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to update department");
    },
  });
}

// Delete department
export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => departmentsService.deleteDepartment(id),
    onSuccess: (_, id) => {
      // Remove from list cache
      queryClient.setQueryData<Department[]>(departmentsKeys.list(), (old) => {
        if (!old) return [];
        return old.filter(d => d._id !== id);
      });
      
      // Remove detail cache
      queryClient.removeQueries({ queryKey: departmentsKeys.detail(id) });
      
      showSuccessToast("Department deleted successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to delete department");
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