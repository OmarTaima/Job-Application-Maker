import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesService } from "../../services/companiesService";
import type {
  CreateCompanyRequest,
  UpdateCompanyRequest,
} from "../../services/companiesService";
import type { Applicant } from "../../store/slices/applicantsSlice";

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
export function useCompany(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: companiesKeys.detail(id),
    queryFn: () => companiesService.getCompanyById(id),
    enabled: options?.enabled !== undefined ? options.enabled : !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// Create company
export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCompanyRequest) =>
      companiesService.createCompany(data),
    onMutate: async (newCompany) => {
      await queryClient.cancelQueries({ queryKey: companiesKeys.lists() });
      const previousCompanies = queryClient.getQueryData(companiesKeys.list());

      queryClient.setQueryData(companiesKeys.list(), (old: any) => {
        if (!old) return old;
        const tempCompany = {
          ...newCompany,
          _id: `temp-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        return [...old, tempCompany];
      });

      return { previousCompanies };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousCompanies) {
        queryClient.setQueryData(companiesKeys.list(), context.previousCompanies);
      }
    },
    onSuccess: (newCompany) => {
      queryClient.setQueryData(companiesKeys.list(), (old: any) => {
        if (!old) return [newCompany];
        return old.map((company: any) => 
          company._id.startsWith('temp-') ? newCompany : company
        ).filter((company: any, index: number, self: any[]) => 
          self.findIndex((c: any) => c._id === company._id) === index
        );
      });
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Update company
export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCompanyRequest }) =>
      companiesService.updateCompany(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: companiesKeys.lists() });
      await queryClient.cancelQueries({ queryKey: companiesKeys.detail(id) });

      const previousList = queryClient.getQueryData(companiesKeys.list());
      const previousDetail = queryClient.getQueryData(companiesKeys.detail(id));

      queryClient.setQueryData(companiesKeys.list(), (old: any) => {
        if (!old) return old;
        return old.map((company: any) =>
          company._id === id ? { ...company, ...data } : company
        );
      });

      queryClient.setQueryData(companiesKeys.detail(id), (old: any) => {
        if (!old) return old;
        return { ...old, ...data };
      });

      return { previousList, previousDetail };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(companiesKeys.list(), context.previousList);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(companiesKeys.detail(_variables.id), context.previousDetail);
      }
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Delete company
export function useDeleteCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => companiesService.deleteCompany(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: companiesKeys.lists() });
      const previousCompanies = queryClient.getQueryData(companiesKeys.list());

      queryClient.setQueryData(companiesKeys.list(), (old: any) => {
        if (!old) return old;
        return old.filter((company: any) => company._id !== id);
      });

      return { previousCompanies };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousCompanies) {
        queryClient.setQueryData(companiesKeys.list(), context.previousCompanies);
      }
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Get companies that have applicants
export function useCompaniesWithApplicants(applicants: Applicant[] | undefined) {
  return useQuery({
    queryKey: [...companiesKeys.lists(), "withApplicants", applicants?.length || 0],
    queryFn: async () => {
      if (!applicants || applicants.length === 0) {
        return [];
      }
      
      // Extract unique company IDs from applicants
      const companyIds = Array.from(
        new Set(
          applicants.map((applicant) => {
            if (typeof applicant.companyId === "string") {
              return applicant.companyId;
            }
            return (applicant.companyId as any)?._id;
          }).filter(Boolean)
        )
      ) as string[];

      if (companyIds.length === 0) {
        return [];
      }

      // Fetch only companies with applicants
      return companiesService.getCompaniesByIds(companyIds);
    },
    enabled: !!applicants && applicants.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
