import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import ComponentCard from "../../../components/common/ComponentCard";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { useCompanySettings, useCreateCompanySettings, useUpdateCompanySettings, useCompanies } from "../../../hooks/queries/useCompanies";

type Props = {
  companyId?: string;
  onSaved?: (data: any) => void;
  // called whenever settings change (draft mode before company exists)
  onChange?: (mailSettings: { availableMails?: string[]; defaultMail?: string | null; companyDomain?: string | null }) => void;
};

export default function CompanySettingsPage({ companyId, onSaved, onChange }: Props) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(companyId);

  // fetch companies for selector when needed
  const { data: companies = [] } = useCompanies();
  const { user } = useAuth();

  const isSuperAdmin = !!user?.roleId?.name?.toString().toLowerCase().includes("admin");
  const userCompaniesIds = (user?.companies ?? []).map((c: any) => (typeof c.companyId === "string" ? c.companyId : c.companyId?._id)).filter(Boolean) as string[];
  const showSelector = isSuperAdmin || (userCompaniesIds.length > 1);

  useEffect(() => {
    // priority: prop `companyId` -> if user has single assigned company -> that -> otherwise first company from list
    if (companyId) {
      setSelectedCompanyId(companyId);
      return;
    }
    if (!showSelector) {
      // if user has a single company, use it
      if (userCompaniesIds.length === 1) setSelectedCompanyId(userCompaniesIds[0]);
      return;
    }
    if (!selectedCompanyId && companies && companies.length > 0) {
      setSelectedCompanyId(companies[0]._id);
    }
  }, [companyId, companies, userCompaniesIds.join(","), showSelector]);

  const { data: settings, isLoading } = useCompanySettings(selectedCompanyId ?? undefined);
  const createMutation = useCreateCompanySettings();
  const updateMutation = useUpdateCompanySettings();

  const [availableMails, setAvailableMails] = useState<string[]>([]);
  const [defaultMail, setDefaultMail] = useState<string>("");
  const [companyDomain, setCompanyDomain] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Ensure company contact email is included in available mails and set as default upon selection
    const company = companies.find((c: any) => c._id === selectedCompanyId);
    const companyMail = (company && (company.contactEmail || (company as any).email)) || "";

    if (settings && settings.mailSettings) {
      const fromSettings = settings.mailSettings.availableMails ?? [];
      const merged = companyMail
        ? Array.from(new Set([companyMail, ...fromSettings.filter(Boolean)]))
        : Array.from(new Set(fromSettings.filter(Boolean)));

      setAvailableMails(merged);

      // Set default to companyMail when a company is selected; otherwise prefer settings default
      setDefaultMail(companyMail || settings.mailSettings.defaultMail || "");

      // derive domain from company email (part after @) when possible; otherwise fall back to saved setting
      const domainFromEmail = companyMail && companyMail.includes("@") ? companyMail.split("@")[1] : "";
      setCompanyDomain(domainFromEmail || settings.mailSettings.companyDomain || "");
    } else {
      // No settings yet: initialize with company contact email if available
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
  const handleMailChange = (idx: number, val: string) => setAvailableMails((s) => s.map((m, i) => (i === idx ? val : m)));

  const handleSave = async () => {
    const cid = selectedCompanyId ?? companyId;
    if (!cid) return;
    setIsSaving(true);
    const payload = {
      company: cid,
      mailSettings: {
        availableMails: availableMails.filter(Boolean),
        defaultMail: defaultMail || null,
        companyDomain: companyDomain || null,
      },
    };

    try {
      if (settings && settings._id) {
        const res = await updateMutation.mutateAsync({ id: settings._id, data: { mailSettings: payload.mailSettings } });
        onSaved?.(res);
      } else {
        const res = await createMutation.mutateAsync(payload);
        onSaved?.(res);
      }
    } catch (err) {
      // no-op; caller can read mutation errors if needed
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
                availableMails.map((m, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input value={m} onChange={(e) => handleMailChange(idx, e.target.value)} placeholder={`mail ${idx + 1}`} />
                    <button type="button" onClick={() => handleRemoveMail(idx)} className="text-red-600">Remove</button>
                  </div>
                ))
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
              <button onClick={handleSave} disabled={isSaving || !(selectedCompanyId || companyId)} className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
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
