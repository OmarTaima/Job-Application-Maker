import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersService } from "../../services/usersService";
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UpdateDepartmentsRequest,
} from "../../services/usersService";

// Query keys
export const usersKeys = {
  all: ["users"] as const,
  lists: () => [...usersKeys.all, "list"] as const,
  list: (companyIds?: string[]) =>
    [...usersKeys.lists(), { companyIds }] as const,
  details: () => [...usersKeys.all, "detail"] as const,
  detail: (id: string) => [...usersKeys.details(), id] as const,
};

// Get all users
export function useUsers(companyIds?: string[]) {
  return useQuery({
    queryKey: usersKeys.list(companyIds),
    queryFn: () => usersService.getAllUsers(companyIds),
    staleTime: 5 * 60 * 1000,
  });
}

// Get user by ID
export function useUser(id: string) {
  return useQuery({
    queryKey: usersKeys.detail(id),
    queryFn: () => usersService.getUserById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// Create user
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserRequest) => usersService.createUser(data),
    onMutate: async (newUser) => {
      await queryClient.cancelQueries({ queryKey: usersKeys.lists() });
      const previousUsers = queryClient.getQueriesData({ queryKey: usersKeys.lists() });

      queryClient.setQueriesData({ queryKey: usersKeys.lists() }, (old: any) => {
        if (!old) return old;
        const tempUser = {
          ...newUser,
          _id: `temp-${Date.now()}`,
          createdAt: new Date().toISOString(),
          isActive: true,
        };
        return [...old, tempUser];
      });

      return { previousUsers };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousUsers) {
        context.previousUsers.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (newUser) => {
      queryClient.setQueriesData({ queryKey: usersKeys.lists() }, (old: any) => {
        if (!old) return [newUser];
        return old.map((user: any) => 
          user._id.startsWith('temp-') ? newUser : user
        ).filter((user: any, index: number, self: any[]) => 
          self.findIndex((u: any) => u._id === user._id) === index
        );
      });
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Update user
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      usersService.updateUser(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: usersKeys.lists() });
      await queryClient.cancelQueries({ queryKey: usersKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: usersKeys.lists() });
      const previousDetail = queryClient.getQueryData(usersKeys.detail(id));

      queryClient.setQueriesData({ queryKey: usersKeys.lists() }, (old: any) => {
        if (!old) return old;
        return old.map((user: any) =>
          user._id === id ? { ...user, ...data } : user
        );
      });

      queryClient.setQueryData(usersKeys.detail(id), (old: any) => {
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
        queryClient.setQueryData(usersKeys.detail(_variables.id), context.previousDetail);
      }
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Delete user
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.deleteUser(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: usersKeys.lists() });
      const previousUsers = queryClient.getQueriesData({ queryKey: usersKeys.lists() });

      queryClient.setQueriesData({ queryKey: usersKeys.lists() }, (old: any) => {
        if (!old) return old;
        return old.filter((user: any) => user._id !== id);
      });

      return { previousUsers };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousUsers) {
        context.previousUsers.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Update user companies/departments
export function useUpdateUserCompanies() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      companyId,
      data,
    }: {
      userId: string;
      companyId: string;
      data: UpdateDepartmentsRequest;
    }) => usersService.updateCompanyDepartments(userId, companyId, data),
    onMutate: async ({ userId, companyId, data }) => {
      await queryClient.cancelQueries({ queryKey: usersKeys.lists() });
      await queryClient.cancelQueries({ queryKey: usersKeys.detail(userId) });

      const previousLists = queryClient.getQueriesData({ queryKey: usersKeys.lists() });
      const previousDetail = queryClient.getQueryData(usersKeys.detail(userId));

      queryClient.setQueriesData({ queryKey: usersKeys.lists() }, (old: any) => {
        if (!old) return old;
        return old.map((user: any) => {
          if (user._id === userId) {
            const updatedCompanies = user.companies?.map((c: any) => {
              const cId = typeof c.companyId === 'string' ? c.companyId : c.companyId._id;
              if (cId === companyId) {
                return { ...c, departments: data.departments };
              }
              return c;
            }) || [];
            return { ...user, companies: updatedCompanies };
          }
          return user;
        });
      });

      queryClient.setQueryData(usersKeys.detail(userId), (old: any) => {
        if (!old) return old;
        const updatedCompanies = old.companies?.map((c: any) => {
          const cId = typeof c.companyId === 'string' ? c.companyId : c.companyId._id;
          if (cId === companyId) {
            return { ...c, departments: data.departments };
          }
          return c;
        }) || [];
        return { ...old, companies: updatedCompanies };
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
        queryClient.setQueryData(usersKeys.detail(_variables.userId), context.previousDetail);
      }
    },
    onSettled: () => {
      // No refetch
    },
  });
}
