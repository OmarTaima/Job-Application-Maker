import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesService } from "../../services/companiesService";
import type {
  CreateCompanyRequest,
  UpdateCompanyRequest,
  Company,
} from "../../services/companiesService";
import type { Applicant } from "../../store/slices/applicantsSlice";

// Query keys
export const companiesKeys = {
  all: ["companies"] as const,
  lists: () => [...companiesKeys.all, "list"] as const,
  list: (companyId?: string[]) => [...companiesKeys.lists(), { companyId }] as const,
  details: () => [...companiesKeys.all, "detail"] as const,
  detail: (id: string) => [...companiesKeys.details(), id] as const,
  settings: () => [...companiesKeys.all, "settings"] as const,
  setting: (companyId: string) => [...companiesKeys.settings(), companyId] as const,
};

// Get all companies (optionally filtered by company IDs)
export function useCompanies(companyId?: string[]) {
  return useQuery<Company[]>({
    queryKey: companiesKeys.list(companyId),
    queryFn: async () => {
      // If caller passed a single companyId, prefer the single-company endpoint
      if (companyId && companyId.length === 1) {
        const comp = await companiesService.getCompanyById(companyId[0]);
        return [comp];
      }
      return companiesService.getAllCompanies(companyId);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get company by ID
export function useCompany(id: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  return useQuery<Company>({
    queryKey: companiesKeys.detail(id),
    queryFn: async () => {
      const list = queryClient.getQueryData(companiesKeys.list()) as any[] | undefined;

      if (list && list.length > 0) {
        for (const c of list) {
          // handle possible wrapper shapes
          if (!c) continue;
          if (c._id === id) return c;
          if (c.company && c.company._id === id) return c.company;
          if (c.data && c.data._id === id) return c.data;
          // sometimes nested under other keys
          const nested = Object.values(c).find((v: any) => v && typeof v === 'object' && v._id === id);
          if (nested) return nested as any;
        }
      }

      return companiesService.getCompanyById(id);
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// Company settings: fetch by company id
export function useCompanySettings(companyId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery<any>({
    queryKey: companiesKeys.setting(companyId ?? ""),
    queryFn: async () => {
      if (!companyId) return null;
      return companiesService.getCompanySettingsByCompany(companyId);
    },
    enabled: options?.enabled !== undefined ? options.enabled && !!companyId : !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => companiesService.createCompanySettings(data),
    onSuccess: (data: any) => {
      if (data && data.company) {
        queryClient.setQueryData(companiesKeys.setting(data.company), data);
      }
    },
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => companiesService.updateCompanySettings(id, data),
    onSuccess: (data: any) => {
      if (data && data.company) {
        queryClient.setQueryData(companiesKeys.setting(data.company), data);
      }
    },
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

      queryClient.setQueryData<any>(companiesKeys.list(), (old: any) => {
        const anyOld = old as any;
        if (!anyOld) return anyOld;
        const tempCompany = {
          ...newCompany,
          _id: `temp-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        if (Array.isArray(anyOld)) return [...anyOld, tempCompany];
        if (anyOld.data && Array.isArray(anyOld.data)) return { ...anyOld, data: [...anyOld.data, tempCompany] };
        return anyOld;
      });

      return { previousCompanies };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousCompanies) {
        queryClient.setQueryData<any>(companiesKeys.list(), context.previousCompanies);
      }
    },
    onSuccess: (newCompany) => {
      queryClient.setQueryData<any>(companiesKeys.list(), (old: any) => {
        const anyOld = old as any;
        if (!anyOld) return { data: [newCompany] };
        if (Array.isArray(anyOld)) {
          const updated = anyOld.map((company: any) => company._id.startsWith('temp-') ? newCompany : company).filter((company: any, index: number, self: any[]) => self.findIndex((c: any) => c._id === company._id) === index);
          return updated;
        }
        if (anyOld && anyOld.data && Array.isArray(anyOld.data)) {
          const updated = anyOld.data.map((company: any) => company._id.startsWith('temp-') ? newCompany : company).filter((company: any, index: number, self: any[]) => self.findIndex((c: any) => c._id === company._id) === index);
          return { ...anyOld, data: updated };
        }
        return anyOld;
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

      queryClient.setQueryData<any>(companiesKeys.list(), (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) return old.map((company: any) => company._id === id ? { ...company, ...data } : company);
        if (old && old.data && Array.isArray(old.data)) return { ...old, data: old.data.map((company: any) => company._id === id ? { ...company, ...data } : company) };
        return old;
        if (old.data && Array.isArray(old.data)) return { ...old, data: old.data.map((company: any) => company._id === id ? { ...company, ...data } : company) };
        return old;
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

      queryClient.setQueryData<any>(companiesKeys.list(), (old: any) => {
        const anyOld = old as any;
        if (!anyOld) return anyOld;
        if (Array.isArray(anyOld)) return anyOld.filter((company: any) => company._id !== id);
        if (anyOld.data && Array.isArray(anyOld.data)) return { ...anyOld, data: anyOld.data.filter((company: any) => company._id !== id) };
        return anyOld;
      });

      return { previousCompanies };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousCompanies) {
        queryClient.setQueryData<any>(companiesKeys.list(), context.previousCompanies);
      }
    },
    onSettled: () => {
      // No refetch
    },
  });
}

// Get companies that have applicants
export function useCompaniesWithApplicants(applicants: Applicant[] | undefined) {
  // Compute unique company IDs from applicants so we can key the query per-company
  const companyIds = applicants && applicants.length > 0
    ? Array.from(
        new Set(
          applicants
            .map((applicant) => {
              if (typeof applicant.companyId === "string") return applicant.companyId;
              return (applicant.companyId as any)?._id;
            })
            .filter(Boolean)
        )
      ) as string[]
    : [];

  const keySuffix = companyIds.length > 0 ? companyIds.join(",") : "none";

  return useQuery({
    queryKey: [...companiesKeys.lists(), "withApplicants", keySuffix],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      return companiesService.getCompaniesByIds(companyIds);
    },
    enabled: companyIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

