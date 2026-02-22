import { useEffect, useState } from "react";
import Swal from 'sweetalert2';
import { useAuth } from "../../../context/AuthContext";
import ComponentCard from "../../../components/common/ComponentCard";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { useUpdateCompanySettings, useCompanies } from "../../../hooks/queries/useCompanies";

type Props = {
  companyId?: string;
  onSaved?: (data: any) => void;
  // called whenever settings change (draft mode before company exists)
  onChange?: (mailSettings: { availableMails?: string[]; defaultMail?: string | null; companyDomain?: string | null }) => void;
};

export default function CompanySettingsPage({ companyId, onSaved, onChange }: Props) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(companyId);

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
    email?: string | null;
    name?: any;
    settings?: CompanySettings | null;
    mailSettings?: MailSettings | null;
  };

  // fetch companies for selector when needed
  const { data: companies = [] } = useCompanies();
  const { user } = useAuth();

  const isSuperAdmin = !!user?.roleId?.name?.toString().toLowerCase().includes("admin");
  const userCompaniesIds = (user?.companies ?? []).map((c: any) => (typeof c.companyId === "string" ? c.companyId : c.companyId?._id)).filter(Boolean) as string[];
  const showSelector = isSuperAdmin || (userCompaniesIds.length > 1);

  useEffect(() => {
    // priority: prop `companyId` -> if user has single assigned company -> that -> otherwise first company from list
    if (companyId) {
      if (selectedCompanyId !== companyId) setSelectedCompanyId(companyId);
      return;
    }
    if (!showSelector) {
      // if user has a single company, use it
      if (userCompaniesIds.length === 1 && selectedCompanyId !== userCompaniesIds[0]) {
        setSelectedCompanyId(userCompaniesIds[0]);
      }
      return;
    }
    if (!selectedCompanyId && companies && companies.length > 0) {
      const firstId = companies[0]._id;
      if (selectedCompanyId !== firstId) setSelectedCompanyId(firstId);
    }
  }, [companyId, companies, userCompaniesIds.join(","), showSelector, selectedCompanyId]);

  // Derive settings from the already-loaded companies list to avoid making
  // an additional GET request for a single company's settings.
  const company = (companies as Company[]).find((c) => c._id === selectedCompanyId);
  const settings = (company?.settings ?? company?.mailSettings ?? company?.settings?.mailSettings) as any;
  const isLoading = false;
  const updateMutation = useUpdateCompanySettings();

  const [availableMails, setAvailableMails] = useState<string[]>([]);
  const [defaultMail, setDefaultMail] = useState<string>("");
  const [companyDomain, setCompanyDomain] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Initialize mails from the preloaded companies list so we don't have to
  // wait for the specific company settings GET to populate the UI.
  useEffect(() => {
    if (!selectedCompanyId) return;
    const company = (companies as Company[]).find((c) => c._id === selectedCompanyId);
    const companyMail = (company && (company.contactEmail || (company as any).email)) || "";

    // Only initialize from company data when we don't already have any mails
    // (avoid overwriting user edits or later settings merge).
    if (companyMail && availableMails.length === 0) {
      setAvailableMails([companyMail]);
      setDefaultMail(companyMail);
      const domainFromEmail = companyMail && companyMail.includes("@") ? companyMail.split("@")[1] : "";
      setCompanyDomain(domainFromEmail);
    }
  }, [companies, selectedCompanyId, availableMails.length]);

  useEffect(() => {
  // Find the current company from the companies list
  const company = (companies as Company[]).find((c) => c._id === selectedCompanyId);
  const companyMail = (company && (company.contactEmail || (company as any).email)) || "";
  
  // Debug: log the settings structure to see what we're getting
  console.debug('companysettings: settings structure', { 
    selectedCompanyId, 
    settings,
    company,
    companyMail 
  });

  if (settings) {
    // The settings object might be nested in different ways
    // Based on your API response, settings.company.settings.mailSettings is the path
    let mailSettings = null;
    
    if (settings.company?.settings?.mailSettings) {
      // Structure: { company: { settings: { mailSettings: {...} } } }
      mailSettings = settings.company.settings.mailSettings;
    } else if (settings.mailSettings) {
      // Structure: { mailSettings: {...} }
      mailSettings = settings.mailSettings;
    } else if (settings.settings?.mailSettings) {
      // Structure: { settings: { mailSettings: {...} } }
      mailSettings = settings.settings.mailSettings;
    }
    
    console.debug('companysettings: extracted mailSettings', { mailSettings });

    if (mailSettings) {
      const fromSettings = mailSettings.availableMails ?? [];
      
      // Merge company email with settings emails, removing duplicates
      const merged = companyMail
        ? Array.from(new Set([companyMail, ...fromSettings.filter(Boolean)]))
        : Array.from(new Set(fromSettings.filter(Boolean)));

      console.debug('companysettings: merged mails', { fromSettings, merged, companyMail });
      
      setAvailableMails(merged);

      // Set default mail: prioritize company email, then settings default
      setDefaultMail(companyMail || mailSettings.defaultMail || "");

      // Set domain: derive from company email or use settings domain
      const domainFromEmail = companyMail && companyMail.includes("@") ? companyMail.split("@")[1] : "";
      setCompanyDomain(domainFromEmail || mailSettings.companyDomain || "");
    } else {
      // No mailSettings found, just use company email if available
      if (companyMail) {
        setAvailableMails([companyMail]);
        setDefaultMail(companyMail);
        const domainFromEmail = companyMail && companyMail.includes("@") ? companyMail.split("@")[1] : "";
        setCompanyDomain(domainFromEmail);
      } else {
        setAvailableMails([]);
        setDefaultMail("");
        setCompanyDomain("");
      }
    }
  } else {
    // No settings at all, initialize with company contact email if available
    if (companyMail) {
      setAvailableMails([companyMail]);
      setDefaultMail(companyMail);
      const domainFromEmail = companyMail && companyMail.includes("@") ? companyMail.split("@")[1] : "";
      setCompanyDomain(domainFromEmail);
    } else {
      setAvailableMails([]);
      setDefaultMail("");
      setCompanyDomain("");
    }
  }
}, [settings, selectedCompanyId, companies]);

  // notify parent when fields change (draft mode)
  useEffect(() => {
    onChange?.({ availableMails, defaultMail: defaultMail || null, companyDomain: companyDomain || null });
  }, [availableMails, defaultMail, companyDomain, onChange]);

  const handleAddMail = () => setAvailableMails((s) => [...s, ""]);
  
 
  const handleRemoveMail = (idx: number) => setAvailableMails((s) => s.filter((_, i) => i !== idx));
  const normalizeMail = (raw: string) => {
    const v = String(raw || "").trim();
    if (!v) return "";
    // if already contains domain, return as-is
    if (v.includes("@")) return v;
    // if we have a configured companyDomain, append it
    if (companyDomain && companyDomain.trim()) return `${v}@${companyDomain.trim()}`;
    // otherwise return raw local-part (user will see warning on save)
    return v;
  };
  const handleMailChange = (idx: number, val: string, domain?: string) => setAvailableMails((s) => s.map((m, i) => {
    if (i !== idx) return m;
    const v = String(val || '').trim();
    if (!v) return '';
    if (v.includes('@')) return v;
    // prefer explicit domain param (from existing value), then companyDomain, else leave as local-part
    const useDomain = domain || (companyDomain && companyDomain.trim()) || '';
    return useDomain ? `${v}@${useDomain}` : v;
  }));

  useEffect(() => {
    try { console.debug('companysettings: availableMails state', { selectedCompanyId, availableMails }); } catch (e) {}
  }, [availableMails, selectedCompanyId]);

  const handleSave = async () => {
    const cid = selectedCompanyId ?? companyId;
    if (!cid) return;
    setIsSaving(true);
    const payload = {
      company: cid,
      mailSettings: {
        availableMails: availableMails.map(normalizeMail).filter(Boolean),
        defaultMail: defaultMail || null,
        companyDomain: companyDomain || null,
      },
    };

    try {
      // Use the company id for the /companies/{id}/settings endpoint
      // Robustly find a generated settings id in the `settings` object if present
      const findSettingsId = (obj: any): string | undefined => {
        if (!obj || typeof obj !== 'object') return undefined;
        if (obj.settings && obj.settings._id) return obj.settings._id;
        if (obj._id && typeof obj._id === 'string' && obj._id.match(/^[0-9a-fA-F]{24}$/)) return obj._id;
        if (obj.company && obj.company.settings && obj.company.settings._id) return obj.company.settings._id;
        if (obj.company && obj.company._id && typeof obj.company._id === 'string' && obj.company._id.match(/^[0-9a-fA-F]{24}$/)) return obj.company._id;
        if (obj.mailSettings && obj.mailSettings._id) return obj.mailSettings._id;
        for (const k of Object.keys(obj)) {
          if (k.endsWith('_id') && typeof obj[k] === 'string' && obj[k].match(/^[0-9a-fA-F]{24}$/)) return obj[k];
        }
        return undefined;
      };

        const companyObj = (companies as Company[]).find((c) => c._id === cid) as Company | undefined;
        const companySettingsId = companyObj?.settings?._id;
        const generatedSettingsId = companySettingsId ?? findSettingsId(settings);
        const idToSend = generatedSettingsId ?? cid; // fall back to company id if no settings id
        const res = await updateMutation.mutateAsync({ id: idToSend, data: { mailSettings: payload.mailSettings } });
        // Apply server response to local state so UI reflects saved changes
        try {
          const payload = res?.result ?? res?.data ?? res ?? {};
          const mailSettingsFromPayload = payload?.mailSettings ?? payload?.settings?.mailSettings ?? payload?.result?.mailSettings ?? payload?.result?.settings?.mailSettings ?? null;

          const returnedMails = (mailSettingsFromPayload && Array.isArray(mailSettingsFromPayload.availableMails)
            ? mailSettingsFromPayload.availableMails
            : Array.isArray(payload?.availableMails)
            ? payload.availableMails
            : []);

          if (returnedMails && returnedMails.length > 0) {
            // Ensure we include company contact email as first entry if present
            const company = (companies as Company[]).find((c) => c._id === cid);
            const companyMail = (company && (company.contactEmail || (company as any).email)) || '';
            const merged = companyMail ? Array.from(new Set([companyMail, ...returnedMails.filter(Boolean)])) : Array.from(new Set(returnedMails.filter(Boolean)));
            setAvailableMails(merged);
          }

          const returnedDefault = (mailSettingsFromPayload && mailSettingsFromPayload.defaultMail) || payload?.defaultMail || '';
          if (returnedDefault) setDefaultMail(returnedDefault);

          const returnedDomain = (mailSettingsFromPayload && mailSettingsFromPayload.companyDomain) || payload?.companyDomain || '';
          if (returnedDomain) setCompanyDomain(returnedDomain);
        } catch (e) { /* ignore */ }
        try { Swal.fire('Saved', 'Settings saved successfully', 'success'); } catch (e) { /* ignore */ }
      onSaved?.(res);
    } catch (err) {
      console.error('handleSave: save error', err);
      try {
        const msg = (err && ((err as any).message || (err as any).toString())) || 'Failed to save settings';
        Swal.fire('Save failed', msg, 'error');
      } catch (e) { /* ignore */ }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageMeta title="Company Settings | Hiring" description="Company mail settings" />
      <PageBreadcrumb pageTitle="Company Settings" />

      <ComponentCard title="Mail Settings" desc="Configure company mail settings and domain">
        <div className="space-y-4">
          {showSelector && (
            <div>
              <Label>Choose Company</Label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="h-10 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select company...</option>
                {companies.map((c: any) => (
                  <option key={c._id} value={c._id}>
                    {typeof c.name === 'object' ? c.name.en || c.name.ar : c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label>Available Mails</Label>
            <div className="space-y-2">
              {isLoading && selectedCompanyId && availableMails.length === 0 ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : (
                availableMails.map((m, idx) => {
                  const raw = String(m || '');
                  const parts = raw.split('@');
                  const local = parts[0] || '';
                  const dom = parts[1] || companyDomain || '';
                  return (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input value={local} onChange={(e) => handleMailChange(idx, e.target.value, dom)} placeholder={`mail ${idx + 1}`} />
                      <div className="text-sm text-gray-600">
                        {dom ? `@${dom}` : <span className="text-amber-600">⚠️ No domain</span>}
                      </div>
                      <button type="button" onClick={() => handleRemoveMail(idx)} className="text-red-600">Remove</button>
                    </div>
                  );
                })
              )}
            </div>
            <button type="button" onClick={handleAddMail} className="mt-2 text-sm text-brand-600">+ Add mail</button>
          </div>

          <div>
            <Label>Default Mail</Label>
            <Input value={defaultMail} onChange={(e) => setDefaultMail(e.target.value)} placeholder="default@mail.com" />
          </div>

          <div>
            <Label>Company Domain</Label>
            <Input value={companyDomain} onChange={(e) => setCompanyDomain(e.target.value)} placeholder="example.com" />
          </div>

          <div className="flex items-center gap-3">
            {(selectedCompanyId || companyId) ? (
              <button onClick={handleSave} disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
                {isSaving ? "Saving..." : "Save Settings"}
              </button>
            ) : (
              <div className="text-sm text-gray-500">Settings will be saved after company creation.</div>
            )}
          </div>
        </div>
      </ComponentCard>
    </div>
  );
}
