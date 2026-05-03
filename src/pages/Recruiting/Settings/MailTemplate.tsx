// pages/Settings/EmailTemplates.tsx
import React, { useState, useEffect} from "react";
import {
  PlusCircle, Save, Trash2, Edit, Copy, Mail, Eye, X
} from "lucide-react";
import Swal from "../../../utils/swal";
import { useAuth } from "../../../context/AuthContext";
import { useCompanies } from "../../../hooks/queries/useCompanies";
import {
  useCreateMailTemplate,
  useUpdateMailTemplate,
  useDeleteMailTemplate,
  useDuplicateMailTemplate,
  previewEmailTemplate // ✅ Changed from usePreviewMailTemplate to previewEmailTemplate
} from "../../../hooks/queries/useCompanies";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";

function QuillEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const quillRef = React.useRef<any>(null);
  const onChangeRef = React.useRef(onChange);

  React.useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  React.useEffect(() => {
    let mounted = true;
    if (!containerRef.current) return;
    (async () => {
      const QuillModule = await import('quill');
      const Quill = (QuillModule as any).default ?? QuillModule;
      if (!mounted || !containerRef.current) return;
      quillRef.current = new Quill(containerRef.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline', 'strike'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link', 'clean'],
          ],
        },
      });
      quillRef.current.root.innerHTML = value || '';
      const handleChange = () => onChangeRef.current(quillRef.current.root.innerHTML);
      quillRef.current.on('text-change', handleChange);
    })();
    return () => {
      mounted = false;
      if (quillRef.current) {
        try { quillRef.current.off && quillRef.current.off('text-change'); } catch (e) {}
        quillRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (quillRef.current && quillRef.current.root && quillRef.current.root.innerHTML !== value) {
      quillRef.current.root.innerHTML = value || '';
    }
  }, [value]);

  return <div className="border rounded bg-white dark:bg-gray-800" style={{ minHeight: 200 }} ref={containerRef} />;
}

function TemplateFormModal({
  isOpen, onClose, template, settingsId, existingTemplates,
}: {
  isOpen: boolean;
  onClose: () => void;
  template?: any | null;
  settingsId: string;
  existingTemplates: any[];
}) {
  const [formData, setFormData] = useState({ name: "", subject: "", html: "" });
  const createMutation = useCreateMailTemplate();
  const updateMutation = useUpdateMailTemplate();
  // ✅ No more usePreviewMailTemplate - using direct function import

  useEffect(() => {
    if (template) {
      setFormData({ name: template.name, subject: template.subject, html: template.html });
    } else {
      setFormData({
        name: "",
        subject: "",
        html: `<p>Hello {{candidateName}},</p>\n<p>We're excited to invite you for an interview for the position of {{jobTitle}}.</p>\n<p>Best regards,<br>HR Team</p>`,
      });
    }
  }, [template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.subject || !formData.html) {
      Swal.fire("Error", "Please fill in all fields", "error");
      return;
    }
    
    if (!settingsId) {
      Swal.fire("Error", "Settings ID not found", "error");
      return;
    }
    
    try {
      if (template?._id) {
        await updateMutation.mutateAsync({
          settingsId,
          templateId: template._id,
          template: formData,
          existingTemplates,
        });
      } else {
        await createMutation.mutateAsync({
          settingsId,
          template: formData,
          existingTemplates,
        });
      }
      onClose();
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to save template", "error");
    }
  };

  const handlePreview = () => {
    // ✅ Use previewEmailTemplate function directly
    const previewHtml = previewEmailTemplate(
      { ...template, ...formData } as any,
      "John Doe", 
      "Software Engineer"
    );
    const previewWindow = window.open();
    if (previewWindow) {
      previewWindow.document.write(previewHtml);
      previewWindow.document.close();
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">{template ? "Edit Template" : "Create New Template"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <Label htmlFor="name">Template Name *</Label>
            <Input 
              id="name" 
              value={formData.name} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
              placeholder="e.g., Interview Invitation" 
              required 
            />
          </div>
          
          <div>
            <Label htmlFor="subject">Email Subject *</Label>
            <Input 
              id="subject" 
              value={formData.subject} 
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })} 
              placeholder="Interview Invitation for {{candidateName}}" 
              required 
            />
            <p className="mt-1 text-xs text-gray-500">
              Available variables: <code>{`{{candidateName}}`}</code>, <code>{`{{jobTitle}}`}</code>, <code>{`{{InterviewDate}}`}</code>, <code>{`{{interviewTime}}`}</code>, <code>{`{{interviewType}}`}</code>, <code>{`{{location}}`}</code>, <code>{`{{address}}`}</code>
            </p>
          </div>
          
          <div>
            <Label htmlFor="html">Email Body *</Label>
            <QuillEditor value={formData.html} onChange={(content) => setFormData({ ...formData, html: content })} />
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">Available Variables:</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-blue-800 dark:text-blue-200">{`{{candidateName}}`}</code>
                <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-blue-800 dark:text-blue-200">{`{{jobTitle}}`}</code>
                <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-blue-800 dark:text-blue-200">{`{{InterviewDate}}`}</code>
                <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-blue-800 dark:text-blue-200">{`{{interviewTime}}`}</code>
                <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-blue-800 dark:text-blue-200">{`{{interviewType}}`}</code>
                <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-blue-800 dark:text-blue-200">{`{{location}}`}</code>
                <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-blue-800 dark:text-blue-200">{`{{address}}`}</code>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                These variables will be replaced with actual candidate, job position, and interview data when sending emails.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button 
              type="button" 
              onClick={handlePreview} 
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Eye className="size-4 inline mr-2" />
              Preview
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isLoading} 
              className="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white inline-block mr-2" />
              ) : (
                <Save className="size-4 inline mr-2" />
              )}
              Save Template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EmailTemplates({
  companyId,
  embedded = false
}: {
  companyId?: string;
  hideCompanySelector?: boolean;
  embedded?: boolean;
}) {
  const { user, hasPermission } = useAuth();
  const { data: companies = [] } = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(companyId ?? undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

  const isSuperAdmin = !!user?.roleId?.name?.toString().toLowerCase().includes("admin");
  const userCompanyIds = (user?.companies ?? [])
    .map((c: any) => typeof c.companyId === "string" ? c.companyId : c.companyId?._id)
    .filter(Boolean) as string[];

  const availableCompanies = isSuperAdmin
    ? (companies as any[])
    : (companies as any[]).filter((c) => userCompanyIds.includes(c._id));

  const showSelector = isSuperAdmin || userCompanyIds.length > 1;

  const canEdit = !!hasPermission && (
    hasPermission("Company Management", "write") ||
    hasPermission("Settings Management", "write") ||
    hasPermission("Settings Management", "create")
  );

  useEffect(() => {
    if (selectedCompanyId) return;
    if (companyId) { 
      setSelectedCompanyId(companyId); 
      return; 
    }
    if (availableCompanies.length > 0) {
      setSelectedCompanyId(availableCompanies[0]._id);
    }
  }, [availableCompanies, companyId, selectedCompanyId]);

  // Get the selected company and its settings ID
  const selectedCompany = availableCompanies.find((c: any) => c._id === selectedCompanyId);
  const settingsId = selectedCompany?.settings?._id;
  const templates: any[] = selectedCompany?.settings?.mailSettings?.emailTemplates ?? [];

  const deleteMutation = useDeleteMailTemplate();
  const duplicateMutation = useDuplicateMailTemplate();

  const handleDeleteTemplate = async (template: any) => {
    if (!settingsId) {
      Swal.fire("Error", "Settings ID not found", "error");
      return;
    }
    const result = await Swal.fire({
      title: "Delete Template",
      text: `Are you sure you want to delete "${template.name}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete",
    });
    if (result.isConfirmed && template._id) {
      deleteMutation.mutate({
        settingsId,
        templateId: template._id,
        existingTemplates: templates,
      });
    }
  };

  const handleDuplicate = (template: any) => {
    if (!settingsId) {
      Swal.fire("Error", "Settings ID not found", "error");
      return;
    }
    duplicateMutation.mutate({
      settingsId,
      template,
      existingTemplates: templates,
    });
  };

  const getCompanyName = (company: any): string => {
    if (!company) return "";
    if (typeof company.name === "string") return company.name;
    return company.name?.en || company.name?.ar || "Unnamed Company";
  };

  return (
    <div className={embedded ? "space-y-6" : "min-h-screen bg-slate-50 p-4 dark:bg-slate-950"}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Mail className="size-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Email Templates</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Create and manage email templates with dynamic variables for candidate communication.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setEditingTemplate(null); setIsModalOpen(true); }}
            disabled={!canEdit || !selectedCompanyId || !settingsId}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusCircle className="size-4" />
            Create Template
          </button>
        </div>

        <div className="p-6">
          {showSelector && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                  <Mail className="size-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight">Select Company</h3>
              </div>
              <select
                value={selectedCompanyId || ""}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-10 text-sm font-medium outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800"
              >
                {availableCompanies.map((company) => (
                  <option key={company._id} value={company._id}>
                    {getCompanyName(company)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {templates.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="size-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Templates Yet</h3>
              <p className="text-slate-500 mb-4">Create your first email template to get started.</p>
              <button
                onClick={() => { setEditingTemplate(null); setIsModalOpen(true); }}
                disabled={!canEdit || !settingsId}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <PlusCircle className="size-4" />
                Create Template
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <div 
                  key={template._id} 
                  className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-lg transition-shadow bg-white dark:bg-slate-900"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-lg dark:text-white">{template.name}</h3>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => { setEditingTemplate(template); setIsModalOpen(true); }} 
                        disabled={!canEdit || !settingsId} 
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                      >
                        <Edit className="size-4" />
                      </button>
                      <button 
                        onClick={() => handleDuplicate(template)} 
                        disabled={!canEdit || duplicateMutation.isPending || !settingsId} 
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                      >
                        <Copy className="size-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTemplate(template)} 
                        disabled={!canEdit || deleteMutation.isPending || !settingsId} 
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 rounded"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    <strong>Subject:</strong> {template.subject}
                  </p>
                  <div className="text-xs text-slate-500 dark:text-slate-500 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <p>Created: {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'Unknown'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {settingsId && (
        <TemplateFormModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingTemplate(null); }}
          template={editingTemplate}
          settingsId={settingsId}
          existingTemplates={templates}
        />
      )}
    </div>
  );
}