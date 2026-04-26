// hooks/queries/useMailTemplate.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { emailTemplatesService, EmailTemplate } from "../../services/emailTemplatesService";
import { companiesService } from "../../services/companiesService";
import { companiesKeys } from "./useCompanies";
import Swal from "../../utils/swal";

// Query key for email templates
export const emailTemplatesKeys = {
  all: ['email-templates'] as const,
  lists: () => [...emailTemplatesKeys.all, 'list'] as const,
  list: (settingsId: string) => [...emailTemplatesKeys.lists(), settingsId] as const,
  details: () => [...emailTemplatesKeys.all, 'detail'] as const,
  detail: (id: string) => [...emailTemplatesKeys.details(), id] as const,
};

// Hook to fetch email templates
export function useEmailTemplates(settingsId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: emailTemplatesKeys.list(settingsId),
    queryFn: async () => {
      if (!settingsId) return [];
      try {
        const company = await companiesService.getCompanySettingsByCompany(settingsId);
        // Safe navigation with type assertion
        const templates = (company as any)?.settings?.mailSettings?.emailTemplates ?? 
                         (company as any)?.mailSettings?.emailTemplates ?? 
                         [];
        return templates as EmailTemplate[];
      } catch (error) {
        console.error('Error fetching email templates:', error);
        return [];
      }
    },
    enabled: !!settingsId && (options?.enabled ?? true),
  });
}

// Rest of the hooks remain the same...
export function useCreateMailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ settingsId, template, existingTemplates }: {
      settingsId: string;
      template: Omit<EmailTemplate, '_id' | 'createdAt' | 'updatedAt'>;
      existingTemplates: EmailTemplate[];
    }) => emailTemplatesService.createTemplate(settingsId, template, existingTemplates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
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

export function useUpdateMailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ settingsId, templateId, template, existingTemplates }: {
      settingsId: string;
      templateId: string;
      template: Partial<EmailTemplate>;
      existingTemplates: EmailTemplate[];
    }) => emailTemplatesService.updateTemplate(settingsId, templateId, template, existingTemplates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
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

export function useDeleteMailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ settingsId, templateId, existingTemplates }: {
      settingsId: string;
      templateId: string;
      existingTemplates: EmailTemplate[];
    }) => emailTemplatesService.deleteTemplate(settingsId, templateId, existingTemplates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
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

export function useDuplicateMailTemplate() {
  const queryClient = useQueryClient();
  const createMutation = useCreateMailTemplate();

  return useMutation({
    mutationFn: async ({ settingsId, template, existingTemplates }: {
      settingsId: string;
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
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
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
export function useMailTemplate(settingsId: string, options?: { enabled?: boolean }) {
  return useEmailTemplates(settingsId, options);
}