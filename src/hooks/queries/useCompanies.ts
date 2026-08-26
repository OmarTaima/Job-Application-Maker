// hooks/queries/useCompanies.ts
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import {
  companiesService,
  emailTemplatesService,
  ApiError,
} from '../../services/companiesService';
import Swal from '../../utils/swal';
import { useLocale } from '../../context/LocaleContext';
import type {
  CreateCompanyRequest,
  UpdateCompanyRequest,
  Company,
  UpdateInterviewSettingsRequest,
  EmailTemplate,
  CompanyStatus,
  SectionTemplate,
} from '../../types/companies';
import type { Applicant } from '../../types/applicants';
import { useAuth } from '../../context/AuthContext';

// ===== Query Keys =====
export const cardsKeys = {
  all: ['subscription-cards'] as const,
  detail: (companyId: string) => [...cardsKeys.all, companyId] as const,
};

export const companiesKeys = {
  all: ['companies'] as const,
  lists: () => [...companiesKeys.all, 'list'] as const,
  list: (companyIds?: string[]) =>
    [...companiesKeys.lists(), { companyIds }] as const,
  detail: (id: string) => [...companiesKeys.all, 'detail', id] as const,
  settings: (companyId: string) =>
    [...companiesKeys.all, 'settings', companyId] as const,
  mailSettings: (companyId: string) =>
    [...companiesKeys.all, 'mailSettings', companyId] as const,
  interviewSettings: (companyId: string) =>
    [...companiesKeys.settings(companyId), 'interview'] as const,
  statuses: (companyId: string) =>
    [...companiesKeys.settings(companyId), 'statuses'] as const,
  rejectionReasons: (companyId: string) =>
    [...companiesKeys.settings(companyId), 'rejectionReasons'] as const,
  applicantPages: (settingsId: string) =>
    [...companiesKeys.all, 'applicantPages', settingsId] as const,
  offerSectionTemplates: (settingsId: string) =>
    [...companiesKeys.all, 'offerSections', settingsId] as const,
  contractSectionTemplates: (settingsId: string) =>
    [...companiesKeys.all, 'contractSections', settingsId] as const,
};

export const emailTemplatesKeys = {
  all: ['emailTemplates'] as const,
  list: (settingsId: string) =>
    [...emailTemplatesKeys.all, settingsId] as const,
};

export const subscriptionKeys = {
  all: ['subscription'] as const,
  detail: (companyId: string) => [...subscriptionKeys.all, companyId] as const,
};

// ===== Helpers =====
function getUserCompanyIds(user: any): string[] | undefined {
  const roleName = user?.roleId?.name?.toLowerCase?.();

  if (roleName === 'admin' || roleName === 'super admin') {
    return undefined;
  }

  const fromCompanies =
    user?.companies
      ?.map((c: any) =>
        typeof c?.companyId === 'string' ? c.companyId : c?.companyId?._id
      )
      .filter(Boolean) ?? [];

  const fromAssigned = user?.assignedcompanyId?.filter(Boolean) ?? [];

  const merged = [...new Set([...fromCompanies, ...fromAssigned])];
  return merged.length > 0 ? merged : undefined;
}

function getCompanyFromUser(user: any, companyId: string): any | undefined {
  return user?.companies?.find((c: any) => {
    const companyData = c.companyId;
    const cid =
      typeof companyData === 'string' ? companyData : companyData?._id;
    return cid === companyId;
  })?.companyId;
}

// ===== QUERIES =====

export function useCompanies(
  companyIds?: string[],
  options?: { enabled?: boolean }
) {
  const { user } = useAuth();
  const userCompanyIds = getUserCompanyIds(user);
  const explicitIds = companyIds?.length ? companyIds : undefined;
  const effectiveIds = explicitIds ?? userCompanyIds;
  const useListEndpoint = !effectiveIds?.length;

  return useQuery({
    // Always use the same canonical list key so useCompany's initialData/select can find it
    queryKey: companiesKeys.list(),
    queryFn: async () => {
      if (useListEndpoint) {
        // No known IDs (e.g., super admin) - use list endpoint (also has full address)
        const companies = await companiesService.getAllCompanies();
        return companies;
      }

      if (effectiveIds.length === 1) {
        // Single company case - use detail endpoint
        const company = await companiesService.getCompanyById(effectiveIds[0]);
        return company ? [company] : [];
      }

      // Multiple companies case - fetch all in parallel
      const companiesPromises = effectiveIds.map((id) =>
        companiesService.getCompanyById(id).catch((error) => {
          console.error(`Failed to fetch company ${id}:`, error);
          return null;
        })
      );

      const results = await Promise.all(companiesPromises);
      const validCompanies = results.filter((company) => company !== null);

      return validCompanies;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled: options?.enabled ?? true,
    // Add this to ensure the query doesn't get stuck in loading state
    retry: 1,
  });
}

export function useCompany(id: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: companiesKeys.detail(id),
    queryFn: () => companiesService.getCompanyById(id),
    enabled: options?.enabled ?? !!id,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialData: () => {
      const cached = queryClient.getQueryData<Company[]>(companiesKeys.list());
      return cached?.find((c) => c._id === id);
    },
    select: (company) => {
      if (!company) return company;
      const fromList = queryClient
        .getQueryData<Company[]>(companiesKeys.list())
        ?.find((c) => c._id === id);
      if (!fromList) return company;
      const merged: any = { ...company };
      const listCompany: any = fromList;
      if (
        (!merged.address ||
          (Array.isArray(merged.address) && merged.address.length === 0)) &&
        listCompany.address
      ) {
        merged.address = listCompany.address;
      }
      if (
        (!merged.addresses ||
          (Array.isArray(merged.addresses) && merged.addresses.length === 0)) &&
        listCompany.addresses
      ) {
        merged.addresses = listCompany.addresses;
      }
      if (!merged.settings && listCompany.settings) {
        merged.settings = listCompany.settings;
      }
      if (!merged.location && listCompany.location) {
        merged.location = listCompany.location;
      }
      if (
        (!merged.locations ||
          (Array.isArray(merged.locations) && merged.locations.length === 0)) &&
        listCompany.locations
      ) {
        merged.locations = listCompany.locations;
      }
      if (!merged.officeAddress && listCompany.officeAddress) {
        merged.officeAddress = listCompany.officeAddress;
      }
      return merged;
    },
  });
}

export function useCompanySettings(
  companyId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: companiesKeys.settings(companyId),
    queryFn: () => companiesService.getCompanySettings(companyId),
    enabled: options?.enabled ?? !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMailSettings(
  companyId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: companiesKeys.mailSettings(companyId),
    queryFn: () => companiesService.getMailSettings(companyId),
    enabled: options?.enabled ?? !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanyInterviewSettings(
  companyId: string | undefined,
  options?: { enabled?: boolean }
) {
  const { user } = useAuth();
  const companyFromUser = getCompanyFromUser(user, companyId || '');

  return useQuery({
    queryKey: companiesKeys.interviewSettings(companyId ?? ''),
    queryFn: async () => {
      if (!companyId) return null;

      // Try from user data first
      const fromUser =
        companyFromUser?.settings?.interviewSettings ??
        (companyFromUser as any)?.interviewSettings;

      if (fromUser?.groups?.length) {
        return fromUser;
      }

      // Fallback to API
      const company = await companiesService.getCompanyById(companyId);
      const interviewSettings =
        (company as any)?.settings?.interviewSettings ??
        (company as any)?.interviewSettings ??
        null;

      return interviewSettings;
    },
    enabled: options?.enabled ?? !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanyStatuses(
  companyId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: companiesKeys.statuses(companyId),
    queryFn: () => companiesService.getCompanyStatuses(companyId),
    enabled: options?.enabled ?? !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompaniesWithApplicants(
  applicants: Applicant[] | undefined
) {
  const companyIds = applicants?.length
    ? [
        ...new Set(
          applicants
            .map((a) =>
              typeof a.companyId === 'string'
                ? a.companyId
                : (a.companyId as any)?._id
            )
            .filter(Boolean)
        ),
      ]
    : [];

  return useQuery({
    queryKey: [...companiesKeys.lists(), 'withApplicants', companyIds],
    queryFn: () =>
      companyIds.length
        ? companiesService.getCompaniesByIds(companyIds as string[])
        : [],
    enabled: companyIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubscription(
  companyId: string,
  options?: { enabled?: boolean; refetchInterval?: number | false }
) {
  return useQuery({
    queryKey: subscriptionKeys.detail(companyId),
    queryFn: () => companiesService.getSubscription(companyId),
    enabled: options?.enabled ?? !!companyId,
    staleTime: 60 * 1000, // usage numbers are more time-sensitive than company profile data
    refetchInterval: options?.refetchInterval,
  });
}

export function useTopUpStatus(companyId: string, ref: string | null) {
  return useQuery({
    queryKey: ['topup-status', companyId, ref],
    queryFn: () => companiesService.getTopUpStatus(companyId, ref!),
    enabled: !!companyId && !!ref,
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' ? 3000 : false,
  });
}

export function useStartTopUp() {
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({
      companyId,
      packId,
    }: {
      companyId: string;
      packId: string;
    }) => companiesService.startTopUp(companyId, packId),
    onError: (error: ApiError) =>
      showErrorToast(error.message, t('subscriptionTopUpFailed', 'common'), t),
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => companiesService.getPlans(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useChangePlan() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({
      companyId,
      planId,
    }: {
      companyId: string;
      planId: string;
    }) => companiesService.changePlan(companyId, planId),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({
        queryKey: subscriptionKeys.detail(companyId),
      });
    },
    onError: (error: ApiError) =>
      showErrorToast(error.message, t('changePlanFailed', 'common'), t),
  });
}

export function useCancelPlanChange() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (companyId: string) =>
      companiesService.cancelPlanChange(companyId),
    onSuccess: (_, companyId) => {
      queryClient.invalidateQueries({
        queryKey: subscriptionKeys.detail(companyId),
      });
      showSuccessToast(t('planChangeCancelled', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(error.message, t('planChangeCancelFailed', 'common'), t),
  });
}

export function useCards(companyId: string) {
  return useQuery({
    queryKey: cardsKeys.detail(companyId),
    queryFn: () => companiesService.getCards(companyId),
    enabled: !!companyId,
  });
}

export function useStartAddCard() {
  const { t } = useLocale();

  return useMutation({
    mutationFn: (companyId: string) => companiesService.startAddCard(companyId),
    onError: (error: ApiError) =>
      showErrorToast(error.message, t('addCardFailed', 'common'), t),
  });
}

export function useDeleteCard() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({
      companyId,
      cardId,
    }: {
      companyId: string;
      cardId: number;
    }) => companiesService.deleteCard(companyId, cardId),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: cardsKeys.detail(companyId) });
      showSuccessToast(t('cardDeleted', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(error.message, t('cardDeleteFailed', 'common'), t),
  });
}

export function useChangePrimaryCard() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({
      companyId,
      cardId,
    }: {
      companyId: string;
      cardId: number;
    }) => companiesService.changePrimaryCard(companyId, cardId),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: cardsKeys.detail(companyId) });
      showSuccessToast(t('cardPrimaryChanged', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(error.message, t('cardPrimaryChangeFailed', 'common'), t),
  });
}

export function useTransactions(
  companyId: string,
  params: {
    page?: number;
    PageCount?: number;
    type?: 'downgrade' | 'renewal' | 'signup' | 'topup' | 'upgrade' | undefined;
    startDate?: string;
    endDate?: string;
  } = {}
) {
  return useQuery({
    queryKey: ['transactions', companyId, params],
    queryFn: () => companiesService.getTransactions(companyId, params),
    enabled: !!companyId,
    placeholderData: keepPreviousData,
  });
}
// ===== MUTATIONS =====

export function useCreateCompany() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (data: CreateCompanyRequest) =>
      companiesService.createCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
      showSuccessToast(t('companyCreated', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(error.message, t('companyCreateFailed', 'common'), t),
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCompanyRequest }) =>
      companiesService.updateCompany(id, data),
    onSuccess: (updated, { id }) => {
      queryClient.setQueryData(companiesKeys.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
      showSuccessToast(t('companyUpdated', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(error.message, t('companyUpdateFailed', 'common'), t),
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (id: string) => companiesService.deleteCompany(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Company[]>(
        companiesKeys.list(),
        (old) => old?.filter((c) => c._id !== id) ?? []
      );
      queryClient.removeQueries({ queryKey: companiesKeys.detail(id) });
      showSuccessToast(t('companyDeleted', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(error.message, t('companyDeleteFailed', 'common'), t),
  });
}

export function useUpdateMailSettings() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({
      companyId,
      data,
    }: {
      companyId: string;
      data: {
        availableMails?: string[];
        defaultMail?: string | null;
        companyDomain?: string | null;
      };
    }) => companiesService.updateMailSettings(companyId, data),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({
        queryKey: companiesKeys.mailSettings(companyId),
      });
      showSuccessToast(t('mailSettingsUpdated', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(error.message, t('mailSettingsUpdateFailed', 'common'), t),
  });
}

// ✅ FIXED: Changed from `interviewSetting` to `interviewSettings` (plural)
export function useUpdateCompanyInterviewSettings() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({
      settingsId,
      data,
    }: {
      settingsId: string;
      companyId?: string;
      data: UpdateInterviewSettingsRequest;
    }) => companiesService.updateCompanyInterviewSettings(settingsId, data),
    onMutate: async ({ settingsId, companyId, data }) => {
      await queryClient.cancelQueries({ queryKey: companiesKeys.interviewSettings(companyId || settingsId) });
      await queryClient.cancelQueries({ queryKey: companiesKeys.lists() });

      const previousInterviewSettings = queryClient.getQueryData(companiesKeys.interviewSettings(companyId || settingsId));
      const previousList = queryClient.getQueryData(companiesKeys.list());

      const interviewSettings = (data as any)?.interviewSettings ?? data;

      queryClient.setQueryData(companiesKeys.interviewSettings(companyId || settingsId), interviewSettings);
      queryClient.setQueryData(companiesKeys.list(), (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((c: any) => {
            if (!c) return c;
            if (c.settings?._id === settingsId) {
              return {
                ...c,
                interviewSettings,
                settings: { ...(c.settings ?? {}), interviewSettings },
              };
            }
            return c;
          });
        }
        return old;
      });

      return { previousInterviewSettings, previousList, settingsId, companyId };
    },
    onSuccess: (response, variables) => {
      const { settingsId, companyId } = variables;

      const raw = (response as any)?.interviewSettings ?? response;
      const groups = Array.isArray(raw?.groups)
        ? raw.groups
        : Array.isArray((raw as any)?.data?.groups)
          ? (raw as any).data.groups
          : null;
      const interviewSettings = groups ? { ...raw, groups } : null;

      if (settingsId && interviewSettings) {
        const keyId = companyId || settingsId;
        queryClient.setQueryData(
          companiesKeys.interviewSettings(keyId),
          interviewSettings
        );
        queryClient.setQueryData(companiesKeys.list(), (old: any) => {
          if (!old) return old;
          if (Array.isArray(old)) {
            return old.map((c: any) => {
              if (!c) return c;
              if (c.settings?._id === settingsId) {
                return {
                  ...c,
                  interviewSettings,
                  settings: { ...(c.settings ?? {}), interviewSettings },
                };
              }
              return c;
            });
          }
          return old;
        });
      }

      showSuccessToast(t('interviewSettingsUpdated', 'common'), t);
    },
    onError: (error: ApiError, _variables, context) => {
      if (context?.previousInterviewSettings) {
        queryClient.setQueryData(
          companiesKeys.interviewSettings(context.companyId || context.settingsId),
          context.previousInterviewSettings
        );
      }
      if (context?.previousList) {
        queryClient.setQueryData(companiesKeys.list(), context.previousList);
      }
      showErrorToast(
        error.message,
        t('interviewSettingsUpdateFailed', 'common'),
        t
      );
    },
  });
}

// ✅ FIXED: Removed unused 'result' parameter
export function useUpdateCompanyRejectionReasons() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({
      companyId,
      settingsId,
      rejectReasons,
    }: {
      companyId?: string;
      settingsId?: string;
      rejectReasons: string[];
    }) => {
      // Use settingsId if provided, otherwise use companyId
      const idToUse = settingsId || companyId;
      if (!idToUse) {
        throw new Error('Either companyId or settingsId is required');
      }
      return companiesService.updateCompanyRejectionReasons(
        idToUse,
        rejectReasons
      );
    },
    onSuccess: (_result, { companyId, settingsId, rejectReasons }) => {
      // Determine which ID was used for the cache key
      const idUsed = settingsId || companyId;
      if (!idUsed) return;

      // Update cache - use the ID that was actually used
      queryClient.setQueryData(companiesKeys.list(), (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((c: any) => {
            if (!c) return c;
            // Match by company ID or settings ID
            if (c._id === idUsed || c.settings?._id === idUsed) {
              return {
                ...c,
                settings: { ...(c.settings ?? {}), rejectReasons },
              };
            }
            return c;
          });
        }
        return old;
      });
      showSuccessToast(t('rejectionReasonsUpdated', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(
        error.message,
        t('rejectionReasonsUpdateFailed', 'common'),
        t
      );
    },
  });
}

export function useUpdateCompanyStatuses() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({
      settingsId,
      statuses,
    }: {
      settingsId: string; // ✅ Changed from companyId to settingsId
      statuses: CompanyStatus[];
    }) => companiesService.updateCompanyStatuses(settingsId, statuses),
    onSuccess: (_, { settingsId }) => {
      queryClient.invalidateQueries({
        queryKey: companiesKeys.statuses(settingsId),
      });
      showSuccessToast(t('statusesUpdated', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(error.message, t('statusesUpdateFailed', 'common'), t),
  });
}
export function useUpdateCompanyApplicantPages() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({
      settingsId,
      applicantPages,
    }: {
      settingsId: string; // ✅ Service expects settingsId
      applicantPages: any[]; // ✅ Service expects array directly
    }) => {
      // Service expects (settingsId, applicantPages) - applicantPages as second param
      return companiesService.updateCompanyApplicantPages(
        settingsId,
        applicantPages
      );
    },
    onSuccess: (_, { settingsId }) => {
      queryClient.invalidateQueries({
        queryKey: companiesKeys.applicantPages(settingsId),
      });
      queryClient.invalidateQueries({
        queryKey: companiesKeys.lists(),
      });
      showSuccessToast(t('applicantPagesUpdated', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(
        error.message,
        t('applicantPagesUpdateFailed', 'common'),
        t
      ),
  });
}

// ===== Email Templates Mutations =====

export function useCreateMailTemplate() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({
      settingsId,
      template,
      existingTemplates,
    }: {
      settingsId: string;
      template: Omit<EmailTemplate, '_id' | 'createdAt' | 'updatedAt'>;
      existingTemplates: EmailTemplate[];
    }) =>
      emailTemplatesService.createTemplate(
        settingsId,
        template,
        existingTemplates
      ),
    onSuccess: (_, { settingsId }) => {
      queryClient.invalidateQueries({
        queryKey: emailTemplatesKeys.list(settingsId),
      });
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
      showSuccessToast(t('emailTemplateCreated', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(
        error.message,
        t('emailTemplateCreateFailed', 'common'),
        t
      ),
  });
}

export function useUpdateMailTemplate() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({
      settingsId,
      templateId,
      template,
      existingTemplates,
    }: {
      settingsId: string;
      templateId: string;
      template: Partial<EmailTemplate>;
      existingTemplates: EmailTemplate[];
    }) =>
      emailTemplatesService.updateTemplate(
        settingsId,
        templateId,
        template,
        existingTemplates
      ),
    onSuccess: (_, { settingsId }) => {
      queryClient.invalidateQueries({
        queryKey: emailTemplatesKeys.list(settingsId),
      });
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
      showSuccessToast(t('emailTemplateUpdated', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(
        error.message,
        t('emailTemplateUpdateFailed', 'common'),
        t
      ),
  });
}

export function useDeleteMailTemplate() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({
      settingsId,
      templateId,
      existingTemplates,
    }: {
      settingsId: string;
      templateId: string;
      existingTemplates: EmailTemplate[];
    }) =>
      emailTemplatesService.deleteTemplate(
        settingsId,
        templateId,
        existingTemplates
      ),
    onSuccess: (_, { settingsId }) => {
      queryClient.invalidateQueries({
        queryKey: emailTemplatesKeys.list(settingsId),
      });
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
      showSuccessToast(t('emailTemplateDeleted', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(
        error.message,
        t('emailTemplateDeleteFailed', 'common'),
        t
      ),
  });
}

export function useDuplicateMailTemplate() {
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const { mutateAsync: createTemplate } = useCreateMailTemplate();

  return useMutation({
    mutationFn: async ({
      settingsId,
      template,
      existingTemplates,
    }: {
      settingsId: string;
      template: EmailTemplate;
      existingTemplates: EmailTemplate[];
    }) => {
      return createTemplate({
        settingsId,
        template: {
          name: `${template.name} (Copy)`,
          subject: template.subject,
          html: template.html,
          category: template.category,
        },
        existingTemplates,
      });
    },
    onSuccess: (_, { settingsId }) => {
      queryClient.invalidateQueries({
        queryKey: emailTemplatesKeys.list(settingsId),
      });
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
      showSuccessToast(t('emailTemplateDuplicated', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(
        error.message,
        t('emailTemplateDuplicateFailed', 'common'),
        t
      ),
  });
}

export function useUpdateOfferSectionTemplates() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({
      settingsId,
      templates,
    }: {
      settingsId: string;
      templates: SectionTemplate[];
    }) => companiesService.updateOfferSectionTemplates(settingsId, templates),
    onSuccess: (_, { settingsId }) => {
      queryClient.invalidateQueries({
        queryKey: companiesKeys.settings(settingsId),
      });
      // Also update company list cache so the panel re-reads updated templates
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
      showSuccessToast(t('offerSectionTemplatesSaved', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(
        error.message,
        t('offerSectionTemplatesSaveFailed', 'common'),
        t
      ),
  });
}

export function useUpdateContractSectionTemplates() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({
      settingsId,
      templates,
    }: {
      settingsId: string;
      templates: SectionTemplate[];
    }) =>
      companiesService.updateContractSectionTemplates(settingsId, templates),
    onSuccess: (_, { settingsId }) => {
      queryClient.invalidateQueries({
        queryKey: companiesKeys.settings(settingsId),
      });
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
      showSuccessToast(t('contractSectionTemplatesSaved', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(
        error.message,
        t('contractSectionTemplatesSaveFailed', 'common'),
        t
      ),
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (companyId: string) =>
      companiesService.cancelSubscription(companyId),
    onSuccess: (_, companyId) => {
      queryClient.invalidateQueries({
        queryKey: subscriptionKeys.detail(companyId),
      });
      showSuccessToast(t('subscriptionCancelScheduled', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(error.message, t('subscriptionCancelFailed', 'common'), t),
  });
}

export function useResumeSubscription() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (companyId: string) =>
      companiesService.resumeSubscription(companyId),
    onSuccess: (_, companyId) => {
      queryClient.invalidateQueries({
        queryKey: subscriptionKeys.detail(companyId),
      });
      showSuccessToast(t('subscriptionResumed', 'common'), t);
    },
    onError: (error: ApiError) =>
      showErrorToast(error.message, t('subscriptionResumeFailed', 'common'), t),
  });
}

export function useTopUpPacks() {
  return useQuery({
    queryKey: ['topup-packs'],
    queryFn: () => companiesService.getTopUpPacks(),
    staleTime: 10 * 60 * 1000,
  });
}

// ===== Preview Helper =====
export function previewEmailTemplate(
  template: EmailTemplate,
  candidateName = 'John Doe',
  jobTitle = 'Software Engineer'
): string {
  let html = template.html
    .replace(/\{\{\s*candidateName\s*\}\}/gi, candidateName)
    .replace(/\{\{\s*(?:position|jobTitle)\s*\}\}/gi, jobTitle);

  const escape = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escape(template.subject)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .subject { color: #666; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
        code { background: #e8e8e8; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="subject"><strong>Subject:</strong> ${escape(template.subject)}</div>
        ${html}
      </div>
    </body>
    </html>
  `;
}

// ===== Toast Helpers =====
function showSuccessToast(
  message: string,
  t: (key: string, ns?: string) => string
) {
  Swal.fire({
    title: t('success', 'common'),
    text: message,
    icon: 'success',
    timer: 1500,
    showConfirmButton: false,
  });
}

function showErrorToast(
  message: string,
  fallback: string,
  t: (key: string, ns?: string) => string
) {
  Swal.fire({
    title: t('error', 'common'),
    text: message || fallback,
    icon: 'error',
  });
}
