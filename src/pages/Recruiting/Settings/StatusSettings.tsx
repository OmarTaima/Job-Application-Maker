import React, { useEffect, useMemo, useState } from "react";
import { PlusCircle, Save, Trash2, ArrowRight, Settings } from "lucide-react";
import Swal from "../../../utils/swal";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadCrumb from "../../../components/common/PageBreadCrumb";
import { useAuth } from "../../../context/AuthContext";
import { useCompanies, useCompanySettings, useUpdateCompanySettings } from "../../../hooks/queries/useCompanies";
import { useStatusSettings } from "../../../utils/useStatusSettings";
import { useQueryClient } from "@tanstack/react-query";

type LeadStatus = {
  name: string;
  color: string;
  textColor?: string;
  isDefault?: boolean;
  description: string;
  statusKey?: string;
};

// Default descriptions for static status names (fallback only)
const DEFAULT_STATUS_DESCRIPTIONS: Record<string, string> = {
  pending: "Pending leads awaiting triage.",
  approved: "Approved leads ready for next steps.",
  interview: "Scheduled for interview.",
  interviewed: "Interview completed.",
  rejected: "Not a fit / disqualified.",
  trashed: "Removed or archived applications.",
};

const DEFAULT_STATUSES: LeadStatus[] = [
  { name: "pending", color: "#FEF3C7", textColor: "#92400E", isDefault: true, description: DEFAULT_STATUS_DESCRIPTIONS.pending, statusKey: "pending" },
  { name: "approved", color: "#D1FAE5", textColor: "#065F46", isDefault: false, description: DEFAULT_STATUS_DESCRIPTIONS.approved, statusKey: "approved" },
  { name: "interview", color: "#DBEAFE", textColor: "#1E40AF", isDefault: false, description: DEFAULT_STATUS_DESCRIPTIONS.interview, statusKey: "interview" },
  { name: "interviewed", color: "#DBEAFE", textColor: "#065F46", isDefault: false, description: DEFAULT_STATUS_DESCRIPTIONS.interviewed, statusKey: "interviewed" },
  { name: "rejected", color: "#FEE2E2", textColor: "#991B1B", isDefault: false, description: DEFAULT_STATUS_DESCRIPTIONS.rejected, statusKey: "rejected" },
  { name: "trashed", color: "#6B7280", textColor: "#FFFFFF", isDefault: false, description: DEFAULT_STATUS_DESCRIPTIONS.trashed, statusKey: "trashed" },
];

const makeId = () => `s_${Math.random().toString(36).slice(2, 9)}`;

const arrayMove = <T,>(arr: T[], from: number, to: number) => {
  const copy = [...arr];
  const item = copy.splice(from, 1)[0];
  copy.splice(to, 0, item);
  return copy;
};

const getContrastColor = (hex: string | undefined): string => {
  try {
    if (!hex) return '#111827';
    const h = String(hex).replace('#', '').trim();
    const r = parseInt(h.length === 3 ? h[0] + h[0] : h.substring(0, 2), 16);
    const g = parseInt(h.length === 3 ? h[1] + h[1] : h.substring(h.length === 3 ? 1 : 2, h.length === 3 ? 2 : 4), 16);
    const b = parseInt(h.length === 3 ? h[2] + h[2] : h.substring(h.length === 3 ? 2 : 4, h.length === 3 ? 3 : 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#111827' : '#FFFFFF';
  } catch (e) {
    return '#111827';
  }
};

const getCompanyIdFromPayload = (company: any, fallbackCompanyId?: string | undefined): string | undefined => {
  const idFromSettings = company?.settings?.company;
  if (typeof idFromSettings === "string" && idFromSettings.trim()) return idFromSettings;
  if (company?._id) return company._id;
  return fallbackCompanyId;
};

const getCompanySettingsIdFromPayload = (company: any): string | undefined => {
  const settingsId = company?.settings?._id;
  if (typeof settingsId === "string" && settingsId.trim()) return settingsId;
  return undefined;
};

const isStaticStatus = (statusKey: string): boolean => {
  const staticKeys = ['pending', 'approved', 'interview', 'interviewed', 'rejected', 'trashed'];
  return staticKeys.includes(statusKey?.toLowerCase());
};

type Props = {
  companyId?: string;
  hideCompanySelector?: boolean;
  embedded?: boolean;
};

export default function StatusLabelsSettings({ companyId, hideCompanySelector, embedded }: Props = {}) {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies = [] } = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(companyId ?? undefined);
  const { data: selectedCompanySettings } = useCompanySettings(selectedCompanyId, { enabled: !!selectedCompanyId });
  const updateMutation = useUpdateCompanySettings();

  const isSuperAdmin = !!user?.roleId?.name?.toString().toLowerCase().includes("admin");
  const userCompaniesIds = (user?.companies ?? []).map((c: any) => (typeof c.companyId === "string" ? c.companyId : c.companyId?._id)).filter(Boolean) as string[];
  const computedShowSelector = isSuperAdmin || userCompaniesIds.length > 1;
  const showSelector = hideCompanySelector ? false : computedShowSelector;

  useEffect(() => {
    if (companyId && selectedCompanyId !== companyId) {
      setSelectedCompanyId(companyId);
      return;
    }

    if (!selectedCompanyId && companies.length > 0) {
      if (!computedShowSelector && userCompaniesIds.length === 1) {
        setSelectedCompanyId(userCompaniesIds[0]);
        return;
      }
      setSelectedCompanyId((companies[0] as any)?._id);
    }
  }, [companies, selectedCompanyId, computedShowSelector, userCompaniesIds, companyId]);

  const selectedCompany = useMemo(() => (companies as any[]).find((c) => c._id === selectedCompanyId), [companies, selectedCompanyId]);

  const deriveStatuses = (payload: any): LeadStatus[] => {
    const fromSettings = payload?.statuses ?? payload?.settings?.statuses ?? payload?.settings;
    
    if (Array.isArray(fromSettings) && fromSettings.length > 0) {
      return fromSettings.map((s: any) => {
        const statusKey = s.statusKey || s.name?.toLowerCase();
        const isStatic = !!DEFAULT_STATUS_DESCRIPTIONS[statusKey];
        
        return {
          name: String(s?.name ?? "").trim() || "",
          color: String(s?.color ?? "#94a3b8"),
          textColor: String(s?.textColor ?? s?.text_color ?? getContrastColor(s?.color ?? "#94a3b8")),
          description: isStatic ? DEFAULT_STATUS_DESCRIPTIONS[statusKey] : String(s?.description ?? ""),
          isDefault: !!s?.isDefault,
          statusKey: statusKey,
        };
      });
    }

    const companyLevel = (payload ?? {})?.statuses ?? (payload ?? {})?.applicantStatus ?? (payload ?? {})?.leadStatuses;
    if (Array.isArray(companyLevel) && companyLevel.length > 0) {
      return companyLevel.map((s: any) => {
        const statusKey = s.statusKey || s.name?.toLowerCase();
        const isStatic = !!DEFAULT_STATUS_DESCRIPTIONS[statusKey];
        
        return {
          name: String(s?.name ?? "").trim() || "",
          color: String(s?.color ?? "#94a3b8"),
          textColor: String(s?.textColor ?? s?.text_color ?? getContrastColor(s?.color ?? "#94a3b8")),
          description: isStatic ? DEFAULT_STATUS_DESCRIPTIONS[statusKey] : String(s?.description ?? ""),
          isDefault: !!s?.isDefault,
          statusKey: statusKey,
        };
      });
    }

    return DEFAULT_STATUSES;
  };

  const [statuses, setStatuses] = useState<LeadStatus[]>(() => DEFAULT_STATUSES);
  const [statusIds, setStatusIds] = useState<string[]>(() => DEFAULT_STATUSES.map(() => makeId()));
  const [originalStatusesJson, setOriginalStatusesJson] = useState<string>(JSON.stringify(DEFAULT_STATUSES));
  const [isSaving, setIsSaving] = useState(false);

  // Get the hook for checking static statuses
  const { isStaticStatus: checkIsStatic, getDescription } = useStatusSettings(selectedCompanySettings || selectedCompany);

  useEffect(() => {
    const normalized = deriveStatuses(selectedCompanySettings ?? selectedCompany ?? {});
    setStatuses(normalized);
    setStatusIds(normalized.map(() => makeId()));
    setOriginalStatusesJson(JSON.stringify(normalized));
  }, [selectedCompanySettings, selectedCompanyId, selectedCompany]);

  const canEdit = !!hasPermission && (hasPermission("Company Management", "write") || hasPermission("Settings Management", "write") || hasPermission("Settings Management", "create"));

  const hasChanges = useMemo(() => JSON.stringify(statuses) !== originalStatusesJson, [statuses, originalStatusesJson]);

  const addStatus = () => {
    setStatuses((prev) => [...prev, { name: "", color: "#F3F4F6", textColor: getContrastColor('#F3F4F6'), isDefault: false, description: "" }]);
    setStatusIds((prev) => [...prev, makeId()]);
  };

  const removeStatus = (index: number) => {
    setStatuses((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((s) => s.isDefault)) {
        next[0].isDefault = true;
      }
      return next;
    });
    setStatusIds((prev) => prev.filter((_, i) => i !== index));
  };

  const setDefault = (index: number) => {
    setStatuses((prev) => prev.map((s, i) => ({ ...s, isDefault: i === index })));
  };

  const handleNameChange = (index: number, value: string) => {
    setStatuses((prev) => prev.map((s, i) => (i === index ? { ...s, name: value } : s)));
  };

  const handleColorChange = (index: number, value: string) => {
    setStatuses((prev) => prev.map((s, i) => (i === index ? { ...s, color: value, textColor: getContrastColor(value) } : s)));
  };

  const handleDescriptionChange = (index: number, value: string) => {
    setStatuses((prev) => prev.map((s, i) => (i === index ? { ...s, description: value } : s)));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDropOnRow = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const fromIndex = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(fromIndex)) return;
    if (fromIndex === index) return;
    setStatuses((prev) => arrayMove(prev, fromIndex, index));
    setStatusIds((prev) => arrayMove(prev, fromIndex, index));
  };

  const handleDropAtEnd = (e: React.DragEvent) => {
    e.preventDefault();
    const fromIndex = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(fromIndex)) return;
    if (fromIndex === statuses.length - 1) return;
    setStatuses((prev) => arrayMove(prev, fromIndex, statuses.length - 1));
    setStatusIds((prev) => arrayMove(prev, fromIndex, statusIds.length - 1));
  };

  const handleSave = async () => {
    if (!selectedCompanyId) {
      Swal.fire("Validation", "Please select a company first.", "warning");
      return;
    }

    const targetCompanyId = getCompanyIdFromPayload(selectedCompany, selectedCompanyId);
    const companySettingsId = getCompanySettingsIdFromPayload(selectedCompany);
    const primarySaveId = companySettingsId ?? targetCompanyId;
    const fallbackSaveId = companySettingsId && targetCompanyId && companySettingsId !== targetCompanyId ? targetCompanyId : undefined;

    if (!primarySaveId) {
      Swal.fire("Validation", "Unable to resolve company identity for saving.", "warning");
      return;
    }

    // Prepare payload WITHOUT statusKey (backend doesn't accept it)
    const payload = statuses.map((s) => ({
      name: String(s.name ?? "").trim(),
      color: s.color,
      textColor: s.textColor,
      description: isStaticStatus(s.statusKey || s.name) ? "" : String(s.description ?? "").trim(),
      isDefault: !!s.isDefault,
    }));

    setIsSaving(true);
    
    try {
      await updateMutation.mutateAsync({ id: primarySaveId, data: { statuses: payload } as any });
      
      // Invalidate queries to refresh data across the app
      queryClient.invalidateQueries({ queryKey: ['company-settings', selectedCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['company', selectedCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
      
      if (targetCompanyId && targetCompanyId !== selectedCompanyId) {
        queryClient.invalidateQueries({ queryKey: ['company-settings', targetCompanyId] });
        queryClient.invalidateQueries({ queryKey: ['company', targetCompanyId] });
      }
      
      if (companySettingsId) {
        queryClient.invalidateQueries({ queryKey: ['company-settings', companySettingsId] });
      }
      
      Swal.fire({ title: "Saved", icon: "success", timer: 1200, showConfirmButton: false });
      
      const payloadWithoutKeys = payload.map((p, idx) => ({
        ...p,
        statusKey: statuses[idx].statusKey,
      }));
      setOriginalStatusesJson(JSON.stringify(payloadWithoutKeys));
      
    } catch (err: any) {
      if (fallbackSaveId) {
        try {
          await updateMutation.mutateAsync({ id: fallbackSaveId, data: { statuses: payload } as any });
          
          queryClient.invalidateQueries({ queryKey: ['company-settings', fallbackSaveId] });
          queryClient.invalidateQueries({ queryKey: ['company', fallbackSaveId] });
          queryClient.invalidateQueries({ queryKey: ['companies'] });
          queryClient.invalidateQueries({ queryKey: ['applicants'] });
          
          Swal.fire({ title: "Saved", icon: "success", timer: 1200, showConfirmButton: false });
          
          const payloadWithoutKeys = payload.map((p, idx) => ({
            ...p,
            statusKey: statuses[idx].statusKey,
          }));
          setOriginalStatusesJson(JSON.stringify(payloadWithoutKeys));
          setIsSaving(false);
          return;
        } catch (e) {
          // fall through
        }
      }
      Swal.fire("Failure", err?.message || "Failed to update configuration", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={embedded ? "space-y-6" : "min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-8"}>
      {!embedded && (
        <>
          <PageMeta title="Status Settings | Job Application Maker" description="Configure status labels and pipeline" />
          <PageBreadCrumb pageTitle="Statuses" />
        </>
      )}

      <div className={embedded ? "space-y-6" : "mx-auto max-w-7xl space-y-6"}>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <Settings className="size-6" />
              </div>
              <div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Status Labels</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Customize your company's statuses, colors, default stage, and notifications.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={addStatus}
                disabled={!canEdit}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PlusCircle className="size-4" /> Add Status
              </button>
              <button
                onClick={handleSave}
                disabled={!canEdit || !hasChanges || isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Save className="size-4" />}
                Save Changes
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-12">
            <div className="space-y-6 xl:col-span-4">
              {showSelector && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                      <Settings className="size-5" />
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
                          {(typeof c.name === "object" ? c.name.en : c.name) || "Unnamed Company"}
                        </option>
                      ))}
                    </select>
                    <ArrowRight className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-90 text-slate-400" />
                  </div>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Pick the company profile to manage statuses for.</p>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                    <PlusCircle className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight">Preview</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {statuses.map((s, i) => (
                    <span
                      key={statusIds[i] ?? i}
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium"
                      style={{ background: s.color, color: s.textColor ?? getContrastColor(s.color) }}
                    >
                      {s.name || "Untitled"}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Live preview of how statuses will appear in lists and applicant cards.</p>
              </div>
            </div>

            <div className="xl:col-span-8">
              <div className="space-y-4">
                {statuses.map((status, index) => {
                  const id = statusIds[index] ?? index;
                  const isStatic = checkIsStatic(status.statusKey || status.name);
                  const staticDescription = isStatic ? getDescription(status.statusKey || status.name) : null;

                  return (
                    <div
                      key={id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropOnRow(e as any, index)}
                      className={`group flex cursor-default flex-col gap-3 rounded-xl border p-4 transition md:flex-row md:items-center md:justify-between ${
                        status.isDefault ? "border-brand-300 bg-brand-50/60 dark:border-brand-500/40 dark:bg-brand-500/10" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          className="flex h-9 w-9 cursor-grab items-center justify-center rounded-lg text-slate-500 hover:text-slate-700"
                          aria-label="Drag to reorder"
                        >
                          ≡
                        </div>

                        <div className="min-w-0 flex-1">
                          <input
                            value={status.name}
                            onChange={(e) => handleNameChange(index, e.target.value)}
                            placeholder="Status label"
                            className="w-full rounded-xl border border-transparent bg-transparent py-2 text-sm font-semibold outline-none focus:border-brand-300 focus:ring-0"
                          />
                          
                          {/* Description - Static statuses show read-only text, custom statuses have editable input */}
                          {isStatic ? (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {staticDescription}
                            </p>
                          ) : (
                            <input
                              value={status.description}
                              onChange={(e) => handleDescriptionChange(index, e.target.value)}
                              placeholder="Description (optional)"
                              className="mt-1 w-full rounded-xl border border-transparent bg-transparent py-1 text-xs text-slate-500 outline-none focus:border-brand-300 focus:ring-0 dark:text-slate-400"
                            />
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-3 md:mt-0">
                        <div className="relative">
                          <input
                            id={`color-${id}`}
                            type="color"
                            value={status.color}
                            onChange={(e) => handleColorChange(index, e.target.value)}
                            className="h-8 w-8 cursor-pointer rounded-full border border-slate-200 shadow-sm"
                          />
                        </div>

                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="default-status"
                            checked={!!status.isDefault}
                            onChange={() => setDefault(index)}
                            className="h-4 w-4"
                          />
                          <span className="text-slate-600 dark:text-slate-400">Default</span>
                        </label>

                        <button
                          onClick={(e) => { e.stopPropagation(); removeStatus(index); }}
                          disabled={statuses.length === 1 || !canEdit}
                          className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-500 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div onDragOver={(e) => e.preventDefault()} onDrop={handleDropAtEnd} className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Drag here to move a status to the end</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}