import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rolesService } from "../../services/rolesService";
import type {
  CreateRoleRequest,
  UpdateRoleRequest,
} from "../../services/rolesService";

// Query keys
export const rolesKeys = {
  all: ["roles"] as const,
  lists: () => [...rolesKeys.all, "list"] as const,
  list: () => [...rolesKeys.lists()] as const,
  permissions: () => [...rolesKeys.all, "permissions"] as const,
};

// Get all roles
export function useRoles() {
  return useQuery({
    queryKey: rolesKeys.list(),
    queryFn: () => rolesService.getAllRoles(),
    staleTime: 10 * 60 * 1000, // 10 minutes - roles don't change often
  });
}

// Get all permissions
export function usePermissions() {
  return useQuery({
    queryKey: rolesKeys.permissions(),
    queryFn: () => rolesService.getAllPermissions(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Create role
export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoleRequest) => rolesService.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.lists() });
    },
  });
}

// Update role
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoleRequest }) =>
      rolesService.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.lists() });
    },
  });
}

// Delete role
export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => rolesService.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.lists() });
    },
  });
}
