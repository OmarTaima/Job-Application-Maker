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
  list: (companyId?: string[]) =>
    [...usersKeys.lists(), { companyId }] as const,
  details: () => [...usersKeys.all, "detail"] as const,
  detail: (id: string) => [...usersKeys.details(), id] as const,
};

// Get all users
export function useUsers(params: any = {}) {
  // Ensure page is a number
  const pageParam = typeof params.page === "string" ? parseInt(params.page, 10) : params.page;
  return useQuery({
    queryKey: [...usersKeys.list(params.companyId), { page: pageParam }],
    queryFn: () => usersService.getAllUsers({ ...params, page: pageParam }),
    staleTime: 5 * 60 * 1000,
    // Keep previous page data while fetching next page to avoid empty loading states
    keepPreviousData: true,
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
          deleted: false,
        };
        if (Array.isArray(old)) {
          return [...old, tempUser];
        } else if (old.data && Array.isArray(old.data)) {
          return { ...old, data: [...old.data, tempUser] };
        }
        return old;
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
        let arr: any[] = [];
        if (Array.isArray(old)) arr = old;
        else if (old && Array.isArray(old.data)) arr = old.data;
        else if (!old) return { data: [newUser] };
        else return old;
        const updated = arr.map((user: any) =>
          user._id.startsWith('temp-') ? newUser : user
        ).filter((user: any, index: number, self: any[]) =>
          self.findIndex((u: any) => u._id === user._id) === index
        );
        if (Array.isArray(old)) return updated;
        else return { ...old, data: updated };
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
        let arr: any[] = [];
        if (Array.isArray(old)) arr = old;
        else if (old && Array.isArray(old.data)) arr = old.data;
        else if (!old) return old;
        else return old;
        const updated = arr.map((user: any) =>
          user._id === id ? { ...user, ...data } : user
        );
        if (Array.isArray(old)) return updated;
        else return { ...old, data: updated };
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
        let arr: any[] = [];
        if (Array.isArray(old)) arr = old;
        else if (old && Array.isArray(old.data)) arr = old.data;
        else if (!old) return old;
        else return old;
        const updated = arr.filter((user: any) => user._id !== id);
        if (Array.isArray(old)) return updated;
        else return { ...old, data: updated };
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
        // handle both array and paginated envelope shapes
        if (Array.isArray(old)) {
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
        }
        if (old.data && Array.isArray(old.data)) {
          return { ...old, data: old.data.map((user: any) => {
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
          }) };
        }
        return old;
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

// Add company access to user
export function useAddUserCompany() {
  return useMutation({
    mutationFn: ({
      userId,
      companyId,
      departments,
    }: {
      userId: string;
      companyId: string;
      departments?: string[];
    }) => usersService.addCompanyAccess(userId, { companyId, departments: departments ?? [] }),
    onSettled: () => {
      // No refetch
    },
  });
}

// Remove company access from user
export function useRemoveUserCompany() {
  return useMutation({
    mutationFn: ({
      userId,
      companyId,
    }: {
      userId: string;
      companyId: string;
    }) => usersService.removeCompanyAccess(userId, companyId),
    onSettled: () => {
      // No refetch
    },
  });
}
