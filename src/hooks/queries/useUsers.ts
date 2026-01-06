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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    },
  });
}

// Update user
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      usersService.updateUser(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: usersKeys.detail(variables.id),
      });
    },
  });
}

// Delete user
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: usersKeys.detail(variables.userId),
      });
    },
  });
}
