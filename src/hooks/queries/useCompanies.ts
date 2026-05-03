// hooks/queries/useCompanies.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesService, emailTemplatesService } from '../../services/companiesService';
import { useAppSelector } from '../../store/hooks';
import Swal from '../../utils/swal';
import type {
  CreateCompanyRequest,
  UpdateCompanyRequest,
  Company,
  InterviewSettings,
  UpdateRejectionReasonsRequest,
  UpdateApplicantPagesRequest,
  UpdateInterviewSettingsRequest,
  EmailTemplate,
  CompanyStatus,
} from '../../types/companies';
import type { Applicant } from '../../types/applicants';
import { useAuth } from '../../context/AuthContext';

// Query keys
export const companiesKeys = {
  all: ['companies'] as const,
  lists: () => [...companiesKeys.all, 'list'] as const,
  list: (companyId?: string[]) =>
    [...companiesKeys.lists(), { companyId }] as const,
  details: () => [...companiesKeys.all, 'detail'] as const,
  detail: (id: string) => [...companiesKeys.details(), id] as const,
  settings: () => [...companiesKeys.all, 'settings'] as const,
  setting: (companyId: string) =>
    [...companiesKeys.settings(), companyId] as const,
  mailSettings: () => [...companiesKeys.all, 'mailSettings'] as const,  // Add this
  mailSetting: (companyId: string) => [...companiesKeys.mailSettings(), companyId] as const,  // Add this
  interviewSettings: () => [...companiesKeys.settings(), 'interview'] as const,
  interviewSetting: (companyId: string) =>
    [...companiesKeys.interviewSettings(), companyId] as const,
};

// Query key for email templates
export const emailTemplatesKeys = {
  all: ['email-templates'] as const,
  lists: () => [...emailTemplatesKeys.all, 'list'] as const,
  list: (settingsId: string) => [...emailTemplatesKeys.lists(), settingsId] as const,
  details: () => [...emailTemplatesKeys.all, 'detail'] as const,
  detail: (id: string) => [...emailTemplatesKeys.details(), id] as const,
};

// Helper to get company data from user (from /auth/me)
function useCompanyFromUser(companyId: string): any | undefined {
  const { user } = useAuth();
  const company = user?.companies?.find((c: any) => {
    const companyData = c.companyId;
    const cid = typeof companyData === 'string' ? companyData : companyData?._id;
    return cid === companyId;
  });
  return company?.companyId;
}

// Get all companies (optionally filtered by company IDs)
export function useCompanies(companyId?: string[], options?: { enabled?: boolean }) {
  const authUser = useAppSelector((s: any) => s.auth.user);

  const userCompanyIds = (() => {
    const roleName = authUser?.roleId?.name?.toLowerCase?.();
    if (roleName === 'admin' || roleName === 'super admin') return undefined;
    const fromCompanies = Array.isArray(authUser?.companies)
      ? authUser.companies
          .map((c: any) =>
            typeof c?.companyId === 'string' ? c.companyId : c?.companyId?._id
          )
          .filter(Boolean)
      : [];
    const fromAssigned = Array.isArray(authUser?.assignedcompanyId)
      ? authUser.assignedcompanyId.filter(Boolean)
      : [];
    const merged = Array.from(new Set([...fromCompanies, ...fromAssigned]));
    return merged.length > 0 ? merged : undefined;
  })();

  const effectiveCompanyId =
    companyId && companyId.length > 0 ? companyId : userCompanyIds;

  return useQuery<Company[]>({
    queryKey: companiesKeys.list(effectiveCompanyId),
    queryFn: async () => {
      if (effectiveCompanyId && effectiveCompanyId.length === 1) {
        const comp = await companiesService.getCompanyById(effectiveCompanyId[0]);
        return [comp];
      }
      return companiesService.getAllCompanies(effectiveCompanyId);
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled: options?.enabled !== undefined ? options.enabled : true,
  });
}
export function useUpdateMailSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: { availableMails?: string[]; defaultMail?: string | null; companyDomain?: string | null } }) =>
      companiesService.updateMailSettings(companyId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.mailSetting(variables.companyId) });
      Swal.fire({
        title: "Success",
        text: "Mail settings updated successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to update mail settings",
        icon: "error",
      });
    },
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
          if (!c) continue;
          if (c._id === id) return c;
          if (c.company && c.company._id === id) return c.company;
          if (c.data && c.data._id === id) return c.data;
          const nested = Object.values(c).find(
            (v: any) => v && typeof v === 'object' && v._id === id
          );
          if (nested) return nested as any;
        }
      }

      return companiesService.getCompanyById(id);
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// ==================== GETTER HOOKS (from user data first, then API) ====================

// Company interview settings - First try from user's company data, then fallback
export function useCompanyInterviewSettings(
  companyId: string | undefined,
  options?: { enabled?: boolean }
) {
  const queryClient = useQueryClient();
  const companyFromUser = useCompanyFromUser(companyId || '');

  return useQuery<InterviewSettings | null>({
    queryKey: companiesKeys.interviewSetting(companyId ?? ''),
    queryFn: async () => {
      if (!companyId) return null;

      // Strategy 1: Get from user's company data (from /auth/me)
      if (companyFromUser) {
        const interviewSettings = 
          companyFromUser?.settings?.interviewSettings ??
          companyFromUser?.interviewSettings ??
          null;
        if (interviewSettings && interviewSettings.groups?.length > 0) {
          return interviewSettings;
        }
      }

      // Strategy 2: Try from cached companies list
      const list = queryClient.getQueryData(companiesKeys.list()) as any[] | undefined;
      if (list && list.length > 0) {
        for (const c of list) {
          if (!c) continue;
          let companyObj: any = c;
          if (companyObj.company && typeof companyObj.company === 'object')
            companyObj = companyObj.company;
          if (companyObj.data && typeof companyObj.data === 'object')
            companyObj = companyObj.data;
          const cid = companyObj._id ?? companyObj.company?._id;
          if (!cid) continue;
          if (String(cid) === String(companyId)) {
            const interview = companyObj.settings?.interviewSettings ??
              companyObj.interviewSettings ?? null;
            if (interview && interview.groups?.length > 0) {
              return interview;
            }
          }
        }
      }

      // Strategy 3: Fallback to API call
      try {
        const company = await companiesService.getCompanyById(companyId);
        const interviewSettings = 
          (company as any)?.settings?.interviewSettings ??
          (company as any)?.interviewSettings ?? null;
        if (interviewSettings && interviewSettings.groups?.length > 0) {
          queryClient.setQueryData(companiesKeys.detail(companyId), company);
          return interviewSettings;
        }
      } catch (companyError) {
        console.warn('Failed to fetch company data:', companyError);
      }

      return null;
    },
    enabled: options?.enabled !== undefined ? options.enabled && !!companyId : !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

// ==================== MUTATION HOOKS (CORRECT ENDPOINTS) ====================

// Update company interview settings

// Update company interview settings mutation
export function useUpdateCompanyInterviewSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data, settingsId }: { 
      companyId?: string; 
      data: UpdateInterviewSettingsRequest;
      settingsId?: string;
    }) => {
      // Use settingsId if provided, otherwise fallback to companyId
      const idToUse = settingsId || companyId;
      if (!idToUse) {
        throw new Error('No ID provided for interview settings update');
      }
      return companiesService.updateCompanyInterviewSettings(idToUse, data);
    },
    onSuccess: (interviewSettings, variables) => {
      const companyId = variables.companyId;
      
      if (companyId) {
        // Update cache
        queryClient.setQueryData(companiesKeys.interviewSetting(companyId), interviewSettings);
        queryClient.setQueryData(companiesKeys.list(), (old: any) => {
          if (!old) return old;
          if (Array.isArray(old)) {
            return old.map((c: any) => {
              if (!c) return c;
              if (c._id === companyId || c.id === companyId) {
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

      Swal.fire({
        title: "Success",
        text: "Interview settings updated successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to update interview settings",
        icon: "error",
      });
    },
  });
}

// Update company rejection reasons
// hooks/queries/useCompanies.ts - Update useUpdateCompanyRejectionReasons

// Update company rejection reasons mutation
export function useUpdateCompanyRejectionReasons() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data, settingsId }: { 
      companyId?: string; 
      data: UpdateRejectionReasonsRequest;
      settingsId?: string;  // Add settingsId parameter
    }) => {
      // Use settingsId if provided, otherwise fallback to companyId
      const idToUse = settingsId || companyId;
      if (!idToUse) {
        throw new Error('No ID provided for rejection reasons update');
      }
      return companiesService.updateCompanyRejectionReasons(idToUse, data);
    },
    onSuccess: (result, variables) => {
      const idUsed = variables.settingsId || variables.companyId;
      void idUsed; // To satisfy TypeScript that we have an ID to work with
      const companyId = variables.companyId;
      
      const rejectReasons = result?.rejectReasons ?? variables.data?.rejectReasons ?? [];
      
      // Update cache with the company ID (since that's what we use for list queries)
      if (companyId) {
        queryClient.setQueryData(companiesKeys.list(), (old: any) => {
          if (!old) return old;
          if (Array.isArray(old)) {
            return old.map((c: any) => {
              if (!c) return c;
              if (c._id === companyId || c.id === companyId) {
                return { ...c, rejectReasons, settings: { ...(c.settings ?? {}), rejectReasons } };
              }
              return c;
            });
          }
          return old;
        });
      }

      Swal.fire({
        title: "Success",
        text: "Rejection reasons updated successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to update rejection reasons",
        icon: "error",
      });
    },
  });
}

// Update company applicant pages
// hooks/queries/useCompanies.ts - Update useUpdateCompanyApplicantPages

// Update company applicant pages mutation

export function useUpdateCompanyApplicantPages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ settingsId, data }: { 
      settingsId: string;  // Use settingsId, not companyId
      data: UpdateApplicantPagesRequest;
    }) => companiesService.updateCompanyApplicantPages(settingsId, data),
    onSuccess: (variables) => {
      const settingsId = variables.settingsId;
      void settingsId; 
      
      // Update cache - you may need to find which company this settingsId belongs to
      // or invalidate the companies list to refetch
      queryClient.invalidateQueries({ queryKey: companiesKeys.list() });

      Swal.fire({
        title: "Success",
        text: "Applicant pages updated successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to update applicant pages",
        icon: "error",
      });
    },
  });
}
// Update company statuses mutation
// hooks/queries/useCompanies.ts - Update useUpdateCompanyStatuses

// Update company statuses mutation
export function useUpdateCompanyStatuses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data, settingsId }: { 
      companyId?: string; 
      data: CompanyStatus[];
      settingsId?: string;
    }) => {
      // Use settingsId if provided, otherwise fallback to companyId
      const idToUse = settingsId || companyId;
      if (!idToUse) {
        throw new Error('No ID provided for statuses update');
      }
      return companiesService.updateCompanyStatuses(idToUse, data);
    },
    onSuccess: (statuses, variables) => {
      const companyId = variables.companyId;
      
      // Update cache with the company ID (since that's what we use for list queries)
      if (companyId) {
        queryClient.setQueryData(companiesKeys.list(), (old: any) => {
          if (!old) return old;
          if (Array.isArray(old)) {
            return old.map((c: any) => {
              if (!c) return c;
              if (c._id === companyId || c.id === companyId) {
                return { 
                  ...c, 
                  settings: { 
                    ...(c.settings ?? {}), 
                    statuses 
                  } 
                };
              }
              return c;
            });
          }
          return old;
        });
      }

      Swal.fire({
        title: "Success",
        text: "Statuses updated successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to update statuses",
        icon: "error",
      });
    },
  });
}
// ==================== EMAIL TEMPLATE MUTATIONS ====================

// Create email template
export function useCreateMailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ settingsId, template, existingTemplates }: {
      settingsId: string;  // Change from companyId to settingsId
      template: Omit<EmailTemplate, '_id' | 'createdAt' | 'updatedAt'>;
      existingTemplates: EmailTemplate[];
    }) => emailTemplatesService.createTemplate(settingsId, template, existingTemplates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: emailTemplatesKeys.list(variables.settingsId) });
      Swal.fire({
        title: "Success",
        text: "Email template created successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to create email template",
        icon: "error",
      });
    },
  });
}


// Update email template
export function useUpdateMailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ settingsId, templateId, template, existingTemplates }: {
      settingsId: string;  // Change from companyId to settingsId
      templateId: string;
      template: Partial<EmailTemplate>;
      existingTemplates: EmailTemplate[];
    }) => emailTemplatesService.updateTemplate(settingsId, templateId, template, existingTemplates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: emailTemplatesKeys.list(variables.settingsId) });
      Swal.fire({
        title: "Success",
        text: "Email template updated successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to update email template",
        icon: "error",
      });
    },
  });
}

// Hook to preview mail template
export function usePreviewMailTemplate() {
  const previewTemplate = (template: EmailTemplate, candidateName: string = "John Doe", jobTitle: string = "Software Engineer") => {
    let previewHtml = template.html;
    previewHtml = previewHtml.replace(/\{\{\s*candidateName\s*\}\}/gi, candidateName);
    previewHtml = previewHtml.replace(/\{\{\s*(?:position|jobTitle)\s*\}\}/gi, jobTitle);

    const escapeHtml = (str: string) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const safeSubject = escapeHtml(template.subject);
    const safePreviewHtml = previewHtml;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${safeSubject}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; margin: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .subject { color: #666; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
          .variables { font-size: 12px; color: #999; margin-top: 20px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
          code { background: #e8e8e8; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="subject">
            <strong>Subject:</strong> ${safeSubject}
          </div>
          ${safePreviewHtml}
          <div class="variables">
            <strong>Available Variables:</strong><br>
            <code>{{candidateName}}</code> - Candidate's full name<br>
            <code>{{jobTitle}}</code> or <code>{{position}}</code> - Job position title
          </div>
        </div>
      </body>
      </html>
    `;
  };

  return { previewTemplate };
}

// ==================== CRUD MUTATIONS ====================

// Create company mutation
export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCompanyRequest) => companiesService.createCompany(data),
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
        if (anyOld.data && Array.isArray(anyOld.data))
          return { ...anyOld, data: [...anyOld.data, tempCompany] };
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
          const updated = anyOld
            .map((company: any) => (company._id?.startsWith('temp-') ? newCompany : company))
            .filter((company: any, index: number, self: any[]) =>
              self.findIndex((c: any) => c._id === company._id) === index
            );
          return updated;
        }
        return anyOld;
      });
    },
    onSettled: () => {},
  });
}

// Update company mutation
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
        if (Array.isArray(old))
          return old.map((company: any) =>
            company._id === id ? { ...company, ...data } : company
          );
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
    onSettled: () => {},
  });
}

// Delete company mutation
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
        if (Array.isArray(anyOld))
          return anyOld.filter((company: any) => company._id !== id);
        return anyOld;
      });

      return { previousCompanies };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousCompanies) {
        queryClient.setQueryData<any>(companiesKeys.list(), context.previousCompanies);
      }
    },
    onSettled: () => {},
  });
}

// Get companies that have applicants
export function useCompaniesWithApplicants(applicants: Applicant[] | undefined) {
  const companyIds = applicants && applicants.length > 0
    ? Array.from(new Set(
        applicants
          .map((applicant) => {
            if (typeof applicant.companyId === 'string') return applicant.companyId;
            return (applicant.companyId as any)?._id;
          })
          .filter(Boolean)
      )) as string[]
    : [];

  const keySuffix = companyIds.length > 0 ? companyIds.join(',') : 'none';

  return useQuery({
    queryKey: [...companiesKeys.lists(), 'withApplicants', keySuffix],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      return companiesService.getCompaniesByIds(companyIds);
    },
    enabled: companyIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}


export function useDeleteMailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ settingsId, templateId, existingTemplates }: {
      settingsId: string;  // Change from companyId to settingsId
      templateId: string;
      existingTemplates: EmailTemplate[];
    }) => emailTemplatesService.deleteTemplate(settingsId, templateId, existingTemplates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: emailTemplatesKeys.list(variables.settingsId) });
      Swal.fire({
        title: "Deleted",
        text: "Email template deleted successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to delete email template",
        icon: "error",
      });
    },
  });
}
// Duplicate mail template mutation
export function useDuplicateMailTemplate() {
  const queryClient = useQueryClient();
  const createMutation = useCreateMailTemplate();

  return useMutation({
    mutationFn: async ({ settingsId, template, existingTemplates }: {
      settingsId: string;  // Change from companyId to settingsId
      template: EmailTemplate;
      existingTemplates: EmailTemplate[];
    }) => {
      const duplicatedTemplate = {
        name: `${template.name} (Copy)`,
        subject: template.subject,
        html: template.html,
      };
      return await createMutation.mutateAsync({ 
        settingsId, 
        template: duplicatedTemplate, 
        existingTemplates 
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: emailTemplatesKeys.list(variables.settingsId) });
      Swal.fire({
        title: "Success",
        text: "Email template duplicated successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to duplicate email template",
        icon: "error",
      });
    },
  });
}