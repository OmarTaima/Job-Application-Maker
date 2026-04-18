import { useEffect, useState } from "react";
import Swal from '../../../utils/swal';
import { useAuth } from "../../../context/AuthContext";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { useUpdateCompanySettings, useCompanies, useCompanySettings } from "../../../hooks/queries/useCompanies";
import { 
  Building2, 
  Mail, 
  Trash2, 
  Save, 
  Globe, 
  ShieldCheck, 
  Settings, 
  Briefcase,
  CheckCircle,
  PlusCircle,
  ArrowRight
} from "lucide-react";

type Props = {
  companyId?: string;
  onSaved?: (data: any) => void;
  onChange?: (mailSettings: { availableMails?: string[]; defaultMail?: string | null; companyDomain?: string | null }) => void;
};

export default function CompanySettingsPage({ companyId, onSaved, onChange }: Props) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(companyId);

  // Types
  type MailSettings = {
    companyDomain?: string | null;
    availableMails?: string[];
    defaultMail?: string | null;
    _id?: string;
  };

  type CompanySettings = {
    mailSettings?: MailSettings;
    _id?: string;
  };

  type Company = {
    _id: string;
    contactEmail?: string | null;
    name?: any;
    settings?: CompanySettings | null;
    mailSettings?: MailSettings | null;
  };

  const { data: companies = [] } = useCompanies();
  const { data: selectedCompanySettings } = useCompanySettings(selectedCompanyId, { enabled: !!selectedCompanyId });
  const { user, hasPermission } = useAuth();
  const updateMutation = useUpdateCompanySettings();

  const [availableMails, setAvailableMails] = useState<string[]>([]);
  const [defaultMail, setDefaultMail] = useState<string>("");
  const [companyDomain, setCompanyDomain] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [newMail, setNewMail] = useState("");

  const canViewMailManagement = !!hasPermission && hasPermission('Mail Management', 'read');
  const isSuperAdmin = !!user?.roleId?.name?.toString().toLowerCase().includes("admin");
  const userCompaniesIds = (user?.companies ?? []).map((c: any) => (typeof c.companyId === "string" ? c.companyId : c.companyId?._id)).filter(Boolean) as string[];
  const showSelector = isSuperAdmin || (userCompaniesIds.length > 1);
  const canEdit = !!hasPermission && (hasPermission('Mail Management', 'write') && hasPermission('Mail Management', 'create'));

  useEffect(() => {
    if (companyId) {
      if (selectedCompanyId !== companyId) setSelectedCompanyId(companyId);
      return;
    }
    if (!showSelector) {
      if (userCompaniesIds.length === 1 && selectedCompanyId !== userCompaniesIds[0]) {
        setSelectedCompanyId(userCompaniesIds[0]);
      }
      return;
    }
    if (!selectedCompanyId && companies && companies.length > 0) {
      const firstId = (companies[0] as any)._id;
      if (selectedCompanyId !== firstId) setSelectedCompanyId(firstId);
    }
  }, [companyId, companies, userCompaniesIds.join(","), showSelector, selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setAvailableMails([]);
      setDefaultMail("");
      setCompanyDomain("");
      return;
    }

    const company = (companies as Company[]).find((c) => c._id === selectedCompanyId);

    // Normalize settings from either dedicated settings endpoint or company payload.
    const settings = (
      (selectedCompanySettings as any)?.mailSettings ??
      (selectedCompanySettings as any)?.settings?.mailSettings ??
      (selectedCompanySettings as any)?.settings ??
      (company as any)?.settings?.mailSettings ??
      (company as any)?.mailSettings ??
      (company as any)?.settings
    ) as any;

    const mails = settings?.availableMails ?? settings?.available_senders ?? settings?.availableSenders ?? [];
    setAvailableMails(Array.isArray(mails) ? mails : []);
    setDefaultMail(settings?.defaultMail || company?.contactEmail || "");
    setCompanyDomain(settings?.companyDomain || "");
  }, [selectedCompanyId, companies, selectedCompanySettings]);

  useEffect(() => {
    onChange?.({
      availableMails,
      defaultMail: defaultMail || null,
      companyDomain: companyDomain || null,
    });
  }, [availableMails, defaultMail, companyDomain, onChange]);

  const handleAddMail = () => {
    if (!newMail || !newMail.includes("@")) {
      Swal.fire("Invalid Format", "Please enter a valid credential email", "error");
      return;
    }
    if (availableMails.includes(newMail)) return;
    setAvailableMails([...availableMails, newMail]);
    setNewMail("");
  };

  const handleRemoveMail = (mail: string) => {
    setAvailableMails(availableMails.filter(m => m !== mail));
    if (defaultMail === mail) setDefaultMail("");
  };

  const handleSave = async () => {
    if (!selectedCompanyId) return;
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: selectedCompanyId,
        data: {
          mailSettings: {
            availableMails,
            defaultMail,
            companyDomain
          }
        }
      });
      Swal.fire({ title: "Configuration Synced", icon: "success", timer: 1500, showConfirmButton: false });
      onSaved?.({ availableMails, defaultMail, companyDomain });
    } catch (err: any) {
      Swal.fire("Failure", err.message || "Failed to update configuration", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCompany = (companies as Company[]).find((company) => company._id === selectedCompanyId);
  const selectedCompanyName =
    (typeof selectedCompany?.name === "object"
      ? selectedCompany?.name?.en || selectedCompany?.name?.ar
      : selectedCompany?.name) || "No company selected";
  const defaultIsRegistered = !!defaultMail && availableMails.includes(defaultMail);

  if (!canViewMailManagement) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <ShieldCheck className="size-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Restricted Protocol</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Your account does not have authorization to manage communication infrastructure.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-8">
      <PageMeta title="Company Configuration | Job Application Maker" description="Manage infrastructure and settings" />
      <PageBreadcrumb pageTitle="Infrastructure configuration" />

      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <Settings className="size-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600/80 dark:text-brand-300">Mail Management</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Company Communication Settings</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Configure sender aliases, default mailbox routing, and domain identity in one panel.
                </p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving || !canEdit}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Save className="size-4" />}
              Save Changes
              <ArrowRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected Company</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedCompanyName}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sender Channels</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{availableMails.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Default Sender</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{defaultMail || "Not assigned"}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {defaultIsRegistered ? "Configured in sender list" : "Select one address as default"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-4">
            {showSelector && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                    <Building2 className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight">Active Company</h3>
                </div>
                <div className="relative">
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-10 text-sm font-medium outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800"
                  >
                    {companies.map((c: any) => (
                      <option key={c._id} value={c._id} className="font-medium">
                        {(typeof c.name === 'object' ? c.name.en : c.name) || "Unnamed Company"}
                      </option>
                    ))}
                  </select>
                  <ArrowRight className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-90 text-slate-400" />
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Pick the company profile whose mail infrastructure you want to manage.</p>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <Globe className="size-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight">Domain Identity</h3>
              </div>
              <div className="space-y-4">
                <div className="relative group">
                  <Globe className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-brand-500" />
                  <input
                    value={companyDomain || ""}
                    onChange={(e) => setCompanyDomain(e.target.value)}
                    placeholder="domain.com"
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  Set the official domain used to verify outbound communication origin.
                </p>
              </div>
            </div>
          </div>

          <div className="xl:col-span-8">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-6 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                    <Mail className="size-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">Authorized Sender Addresses</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Add sender aliases and click any row to mark it as the default address.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 self-start rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Briefcase className="size-3.5" />
                  {availableMails.length} Channels
                </span>
              </div>

              <div className="space-y-6 p-6">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                  <div className="relative">
                    <div className="relative flex-1">
                      <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={newMail}
                        onChange={(e) => setNewMail(e.target.value)}
                        placeholder="Add sender address (example: hr@domain.com)"
                        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddMail()}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddMail}
                    disabled={!canEdit}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PlusCircle className="size-4" /> Add Sender
                  </button>
                </div>

                {availableMails.length > 0 ? (
                  <div className="space-y-3">
                    {availableMails.map((mail) => {
                      const isDefault = defaultMail === mail;

                      return (
                      <div 
                        key={mail}
                        onClick={() => setDefaultMail(mail)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setDefaultMail(mail);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className={`group flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-all md:flex-row md:items-center md:justify-between ${
                          isDefault
                            ? "border-brand-300 bg-brand-50/60 dark:border-brand-500/40 dark:bg-brand-500/10"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800/70"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${isDefault ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"}`}>
                            {isDefault ? <CheckCircle className="size-5" /> : <Mail className="size-4" />}
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{mail}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {isDefault ? "Default sender used by system messages" : "Click to mark as default sender"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${isDefault ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                            {isDefault ? "Default" : "Secondary"}
                          </span>

                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveMail(mail); }}
                            disabled={!canEdit}
                            className="inline-flex size-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/20 dark:bg-red-500/10"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
                    <Mail className="mx-auto mb-3 size-10 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No sender addresses registered yet.</p>
                  </div>
                )}

                <div className="flex items-start gap-4 rounded-xl border border-blue-200 bg-blue-50/70 p-5 dark:border-blue-500/30 dark:bg-blue-500/10">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-500 dark:text-blue-300">
                    <ShieldCheck className="size-6" />
                  </div>
                  <div>
                    <h4 className="mb-1 text-sm font-semibold text-blue-900 dark:text-blue-200">Delivery Policy Note</h4>
                    <p className="text-sm leading-relaxed text-blue-900/80 dark:text-blue-200/80">
                      Addresses registered here will be available as "From" aliases in the automated messaging system. The "Default Protocol" address is used for all system-triggered transactional correspondence and recovery protocols.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
