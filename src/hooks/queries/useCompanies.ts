// hooks/queries/useCompanies.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesService, emailTemplatesService, ApiError } from '../../services/companiesService';
import Swal from '../../utils/swal';
import type {
  CreateCompanyRequest,
  UpdateCompanyRequest,
  Company,
  UpdateInterviewSettingsRequest,
  EmailTemplate,
  CompanyStatus,
} from '../../types/companies';
import type { Applicant } from '../../types/applicants';
import { useAuth } from '../../context/AuthContext';

// ===== Query Keys =====
export const companiesKeys = {
  all: ['companies'] as const,
  lists: () => [...companiesKeys.all, 'list'] as const,
  list: (companyIds?: string[]) => [...companiesKeys.lists(), { companyIds }] as const,
  detail: (id: string) => [...companiesKeys.all, 'detail', id] as const,
  settings: (companyId: string) => [...companiesKeys.all, 'settings', companyId] as const,
  mailSettings: (companyId: string) => [...companiesKeys.all, 'mailSettings', companyId] as const,
  interviewSettings: (companyId: string) => [...companiesKeys.settings(companyId), 'interview'] as const,
  statuses: (companyId: string) => [...companiesKeys.settings(companyId), 'statuses'] as const,
  rejectionReasons: (companyId: string) => [...companiesKeys.settings(companyId), 'rejectionReasons'] as const,
  applicantPages: (settingsId: string) => [...companiesKeys.all, 'applicantPages', settingsId] as const,
};

export const emailTemplatesKeys = {
  all: ['emailTemplates'] as const,
  list: (settingsId: string) => [...emailTemplatesKeys.all, settingsId] as const,
};

// ===== Helpers =====
function getUserCompanyIds(user: any): string[] | undefined {
  const roleName = user?.roleId?.name?.toLowerCase?.();
  
  if (roleName === 'admin' || roleName === 'super admin') {
    return undefined;
  }

  const fromCompanies = user?.companies?.map((c: any) => 
    typeof c?.companyId === 'string' ? c.companyId : c?.companyId?._id
  ).filter(Boolean) ?? [];

  const fromAssigned = user?.assignedcompanyId?.filter(Boolean) ?? [];

  const merged = [...new Set([...fromCompanies, ...fromAssigned])];
  return merged.length > 0 ? merged : undefined;
}

function getCompanyFromUser(user: any, companyId: string): any | undefined {
  return user?.companies?.find((c: any) => {
    const companyData = c.companyId;
    const cid = typeof companyData === 'string' ? companyData : companyData?._id;
    return cid === companyId;
  })?.companyId;
}

// ===== QUERIES =====

export function useCompanies(companyIds?: string[], options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const userCompanyIds = getUserCompanyIds(user);
  const effectiveIds = companyIds?.length ? companyIds : userCompanyIds;

  return useQuery({
    queryKey: companiesKeys.list(effectiveIds),
    queryFn: async () => {
      if (effectiveIds?.length === 1) {
        const company = await companiesService.getCompanyById(effectiveIds[0]);
        return [company];
      }
      return companiesService.getAllCompanies(effectiveIds);
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
}

export function useCompany(id: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: companiesKeys.detail(id),
    queryFn: () => companiesService.getCompanyById(id),
    enabled: options?.enabled ?? !!id,
    staleTime: 5 * 60 * 1000,
    initialData: () => {
      const cached = queryClient.getQueryData<Company[]>(companiesKeys.list());
      return cached?.find(c => c._id === id);
    },
  });
}

export function useCompanySettings(companyId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: companiesKeys.settings(companyId),
    queryFn: () => companiesService.getCompanySettings(companyId),
    enabled: options?.enabled ?? !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMailSettings(companyId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: companiesKeys.mailSettings(companyId),
    queryFn: () => companiesService.getMailSettings(companyId),
    enabled: options?.enabled ?? !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanyInterviewSettings(companyId: string | undefined, options?: { enabled?: boolean }) {
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

export function useCompanyStatuses(companyId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: companiesKeys.statuses(companyId),
    queryFn: () => companiesService.getCompanyStatuses(companyId),
    enabled: options?.enabled ?? !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompaniesWithApplicants(applicants: Applicant[] | undefined) {
  const companyIds = applicants?.length
    ? [...new Set(applicants.map(a => 
        typeof a.companyId === 'string' ? a.companyId : (a.companyId as any)?._id
      ).filter(Boolean))]
    : [];

  return useQuery({
    queryKey: [...companiesKeys.lists(), 'withApplicants', companyIds],
    queryFn: () => companyIds.length ? companiesService.getCompaniesByIds(companyIds as string[]) : [],
    enabled: companyIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// ===== MUTATIONS =====

export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCompanyRequest) => companiesService.createCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
      showSuccessToast('Company created successfully');
    },
    onError: (error: ApiError) => showErrorToast(error.message, 'Failed to create company'),
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCompanyRequest }) =>
      companiesService.updateCompany(id, data),
    onSuccess: (updated, { id }) => {
      queryClient.setQueryData(companiesKeys.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
      showSuccessToast('Company updated successfully');
    },
    onError: (error: ApiError) => showErrorToast(error.message, 'Failed to update company'),
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => companiesService.deleteCompany(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Company[]>(companiesKeys.list(), (old) => 
        old?.filter(c => c._id !== id) ?? []
      );
      queryClient.removeQueries({ queryKey: companiesKeys.detail(id) });
      showSuccessToast('Company deleted successfully');
    },
    onError: (error: ApiError) => showErrorToast(error.message, 'Failed to delete company'),
  });
}

export function useUpdateMailSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: { availableMails?: string[]; defaultMail?: string | null; companyDomain?: string | null } }) =>
      companiesService.updateMailSettings(companyId, data),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.mailSettings(companyId) });
      showSuccessToast('Mail settings updated successfully');
    },
    onError: (error: ApiError) => showErrorToast(error.message, 'Failed to update mail settings'),
  });
}

// ✅ FIXED: Changed from `interviewSetting` to `interviewSettings` (plural)
export function useUpdateCompanyInterviewSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ settingsId, data }: { 
      settingsId: string;
      data: UpdateInterviewSettingsRequest;
    }) => companiesService.updateCompanyInterviewSettings(settingsId, data),
    onSuccess: (interviewSettings, variables) => {
      const settingsId = variables.settingsId;
      
      if (settingsId) {
        // ✅ FIXED: Use 'interviewSettings' (plural) not 'interviewSetting'
        queryClient.setQueryData(companiesKeys.interviewSettings(settingsId), interviewSettings);
        queryClient.setQueryData(companiesKeys.list(), (old: any) => {
          if (!old) return old;
          if (Array.isArray(old)) {
            return old.map((c: any) => {
              if (!c) return c;
              if (c.settings?._id === settingsId) {
                return { 
                  ...c, 
                  interviewSettings, 
                  settings: { ...(c.settings ?? {}), interviewSettings } 
                };
              }
              return c;
            });
          }
          return old;
        });
      }

      showSuccessToast("Interview settings updated successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to update interview settings");
    },
  });
}

// ✅ FIXED: Removed unused 'result' parameter
export function useUpdateCompanyRejectionReasons() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, settingsId, rejectReasons }: { 
      companyId?: string;   
      settingsId?: string;     
      rejectReasons: string[];
    }) => {
      // Use settingsId if provided, otherwise use companyId
      const idToUse = settingsId || companyId;
      if (!idToUse) {
        throw new Error('Either companyId or settingsId is required');
      }
      return companiesService.updateCompanyRejectionReasons(idToUse, rejectReasons);
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
              return { ...c, settings: { ...(c.settings ?? {}), rejectReasons } };
            }
            return c;
          });
        }
        return old;
      });
      showSuccessToast("Rejection reasons updated successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to update rejection reasons");
    },
  });
}

export function useUpdateCompanyStatuses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ settingsId, statuses }: { 
      settingsId: string;        // ✅ Changed from companyId to settingsId
      statuses: CompanyStatus[];
    }) => companiesService.updateCompanyStatuses(settingsId, statuses),
    onSuccess: (_, { settingsId }) => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.statuses(settingsId) });
      showSuccessToast('Statuses updated successfully');
    },
    onError: (error: ApiError) => showErrorToast(error.message, 'Failed to update statuses'),
  });
}
export function useUpdateCompanyApplicantPages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ settingsId, applicantPages }: { 
      settingsId: string;           // ✅ Service expects settingsId
      applicantPages: any[];        // ✅ Service expects array directly
    }) => {
      // Service expects (settingsId, applicantPages) - applicantPages as second param
      return companiesService.updateCompanyApplicantPages(settingsId, applicantPages);
    },
    onSuccess: (_, { settingsId }) => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.applicantPages(settingsId) });
      showSuccessToast('Applicant pages updated successfully');
    },
    onError: (error: ApiError) => showErrorToast(error.message, 'Failed to update applicant pages'),
  });
}

// ===== Email Templates Mutations =====

export function useCreateMailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ settingsId, template, existingTemplates }: {
      settingsId: string;
      template: Omit<EmailTemplate, '_id' | 'createdAt' | 'updatedAt'>;
      existingTemplates: EmailTemplate[];
    }) => emailTemplatesService.createTemplate(settingsId, template, existingTemplates),
    onSuccess: (_, { settingsId }) => {
      queryClient.invalidateQueries({ queryKey: emailTemplatesKeys.list(settingsId) });
      showSuccessToast('Email template created successfully');
    },
    onError: (error: ApiError) => showErrorToast(error.message, 'Failed to create email template'),
  });
}

export function useUpdateMailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ settingsId, templateId, template, existingTemplates }: {
      settingsId: string;
      templateId: string;
      template: Partial<EmailTemplate>;
      existingTemplates: EmailTemplate[];
    }) => emailTemplatesService.updateTemplate(settingsId, templateId, template, existingTemplates),
    onSuccess: (_, { settingsId }) => {
      queryClient.invalidateQueries({ queryKey: emailTemplatesKeys.list(settingsId) });
      showSuccessToast('Email template updated successfully');
    },
    onError: (error: ApiError) => showErrorToast(error.message, 'Failed to update email template'),
  });
}

export function useDeleteMailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ settingsId, templateId, existingTemplates }: {
      settingsId: string;
      templateId: string;
      existingTemplates: EmailTemplate[];
    }) => emailTemplatesService.deleteTemplate(settingsId, templateId, existingTemplates),
    onSuccess: (_, { settingsId }) => {
      queryClient.invalidateQueries({ queryKey: emailTemplatesKeys.list(settingsId) });
      showSuccessToast('Email template deleted successfully');
    },
    onError: (error: ApiError) => showErrorToast(error.message, 'Failed to delete email template'),
  });
}

export function useDuplicateMailTemplate() {
  const queryClient = useQueryClient();
  const { mutateAsync: createTemplate } = useCreateMailTemplate();

  return useMutation({
    mutationFn: async ({ settingsId, template, existingTemplates }: {
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
        },
        existingTemplates,
      });
    },
    onSuccess: (_, { settingsId }) => {
      queryClient.invalidateQueries({ queryKey: emailTemplatesKeys.list(settingsId) });
      showSuccessToast('Email template duplicated successfully');
    },
    onError: (error: ApiError) => showErrorToast(error.message, 'Failed to duplicate email template'),
  });
}

// ===== Preview Helper =====
export function previewEmailTemplate(template: EmailTemplate, candidateName = 'John Doe', jobTitle = 'Software Engineer'): string {
  let html = template.html
    .replace(/\{\{\s*candidateName\s*\}\}/gi, candidateName)
    .replace(/\{\{\s*(?:position|jobTitle)\s*\}\}/gi, jobTitle);

  const escape = (str: string) => str
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
        .variables { font-size: 12px; color: #999; margin-top: 20px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
        code { background: #e8e8e8; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="subject"><strong>Subject:</strong> ${escape(template.subject)}</div>
        ${html}
        <div class="variables">
          <strong>Available Variables:</strong><br>
          <code>{{candidateName}}</code> - Candidate's full name<br>
          <code>{{jobTitle}}</code> or <code>{{position}}</code> - Job position title
        </div>
      </div>
    </body>
    </html>
  `;
}

// ===== Toast Helpers =====
function showSuccessToast(message: string) {
  Swal.fire({ title: 'Success', text: message, icon: 'success', timer: 1500, showConfirmButton: false });
}

function showErrorToast(message: string, fallback: string) {
  Swal.fire({ title: 'Error', text: message || fallback, icon: 'error' });
}