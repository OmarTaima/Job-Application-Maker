import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesService } from "../../services/companiesService";
import type {
  CreateCompanyRequest,
  UpdateCompanyRequest,
} from "../../services/companiesService";

// Query keys
export const companiesKeys = {
  all: ["companies"] as const,
  lists: () => [...companiesKeys.all, "list"] as const,
  list: () => [...companiesKeys.lists()] as const,
  details: () => [...companiesKeys.all, "detail"] as const,
  detail: (id: string) => [...companiesKeys.details(), id] as const,
};

// Get all companies
export function useCompanies() {
  return useQuery({
    queryKey: companiesKeys.list(),
    queryFn: () => companiesService.getAllCompanies(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get company by ID
export function useCompany(id: string) {
  return useQuery({
    queryKey: companiesKeys.detail(id),
    queryFn: () => companiesService.getCompanyById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// Create company
export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCompanyRequest) =>
      companiesService.createCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
    },
  });
}

// Update company
export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCompanyRequest }) =>
      companiesService.updateCompany(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: companiesKeys.detail(variables.id),
      });
    },
  });
}

// Delete company
export function useDeleteCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => companiesService.deleteCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
    },
  });
}
