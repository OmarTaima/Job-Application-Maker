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
    onMutate: async (newRole) => {
      await queryClient.cancelQueries({ queryKey: rolesKeys.lists() });
      const previousRoles = queryClient.getQueryData(rolesKeys.list());

      // Optimistically add the new role
      queryClient.setQueryData(rolesKeys.list(), (old: any) => {
        if (!old) return old;
        const tempRole = {
          ...newRole,
          _id: `temp-${Date.now()}`,
          createdAt: new Date().toISOString(),
          permissionsCount: newRole.permissions?.length || 0,
          usersCount: 0,
        };
        return [...old, tempRole];
      });

      return { previousRoles };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousRoles) {
        queryClient.setQueryData(rolesKeys.list(), context.previousRoles);
      }
    },
    onSuccess: (newRole) => {
      // Replace temp role with actual role from server
      queryClient.setQueryData(rolesKeys.list(), (old: any) => {
        if (!old) return [newRole];
        return old.map((role: any) => 
          role._id.startsWith('temp-') ? newRole : role
        ).filter((role: any, index: number, self: any[]) => 
          self.findIndex((r: any) => r._id === role._id) === index
        );
      });
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Update role
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoleRequest }) =>
      rolesService.updateRole(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: rolesKeys.lists() });
      const previousRoles = queryClient.getQueryData(rolesKeys.list());

      queryClient.setQueryData(rolesKeys.list(), (old: any) => {
        if (!old) return old;
        return old.map((role: any) =>
          role._id === id ? { ...role, ...data } : role
        );
      });

      return { previousRoles };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousRoles) {
        queryClient.setQueryData(rolesKeys.list(), context.previousRoles);
      }
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Delete role
export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => rolesService.deleteRole(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: rolesKeys.lists() });
      const previousRoles = queryClient.getQueryData(rolesKeys.list());

      queryClient.setQueryData(rolesKeys.list(), (old: any) => {
        if (!old) return old;
        return old.filter((role: any) => role._id !== id);
      });

      return { previousRoles };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousRoles) {
        queryClient.setQueryData(rolesKeys.list(), context.previousRoles);
      }
    },
    onSettled: () => {
      // No refetch
    },
  });
}
