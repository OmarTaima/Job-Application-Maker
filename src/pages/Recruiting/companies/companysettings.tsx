import { useEffect, useState } from "react";
import Swal from 'sweetalert2';
import { useAuth } from "../../../context/AuthContext";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { useUpdateCompanySettings, useCompanies } from "../../../hooks/queries/useCompanies";
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
    if (!selectedCompanyId) return;
    const company = (companies as Company[]).find((c) => c._id === selectedCompanyId);
    const settings = (company?.settings ?? company?.mailSettings ?? company?.settings?.mailSettings) as any;
    
    if (settings) {
      setAvailableMails(settings.availableMails || []);
      setDefaultMail(settings.defaultMail || "");
      setCompanyDomain(settings.companyDomain || "");
    }
  }, [selectedCompanyId, companies]);

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
      Swal.fire({ title: "Configuration Synced", icon: "success", timer: 1500, showConfirmButton: false, background: "#1e293b", color: "#fff" });
      onSaved?.({ availableMails, defaultMail, companyDomain });
    } catch (err: any) {
      Swal.fire("Failure", err.message || "Failed to update configuration", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canViewMailManagement) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="size-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
            <ShieldCheck className="size-10" />
          </div>
          <h2 className="text-2xl font-black">Restricted Protocol</h2>
          <p className="text-gray-500 max-w-xs mx-auto">Your account does not have authorization to manage communication infrastructure.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] p-4 sm:p-8 text-slate-900 dark:text-slate-100">
      <PageMeta title="Company Configuration | Job Application Maker" description="Manage infrastructure and settings" />
      <PageBreadcrumb pageTitle="Infrastructure configuration" />

      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="size-16 rounded-3xl bg-brand-500 text-white flex items-center justify-center shadow-xl shadow-brand-500/20">
              <Settings className="size-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent tracking-tight">
                Corporate Infrastructure
              </h1>
              <p className="mt-1 text-gray-500 dark:text-gray-400 font-medium italic">Configure communication protocols and organizational domains</p>
            </div>
          </div>
          
          <button
            onClick={handleSave}
            disabled={isSaving || !canEdit}
            className="flex items-center gap-3 px-10 py-4 bg-brand-500 text-white rounded-[1.5rem] font-black shadow-xl shadow-brand-500/20 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSaving ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="size-5" />}
            Sync Configuration
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left Column: Selector & Domain */}
          <div className="space-y-8">
            {showSelector && (
              <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                    <Building2 className="size-5" />
                  </div>
                  <h3 className="text-lg font-black tracking-tight">Active Company</h3>
                </div>
                <div className="relative">
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full pl-5 pr-10 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl font-black appearance-none focus:ring-4 ring-brand-500/10 transition-all outline-none"
                  >
                    {companies.map((c: any) => (
                      <option key={c._id} value={c._id} className="font-bold">
                        {(typeof c.name === 'object' ? c.name.en : c.name) || "Unnamed Company"}
                      </option>
                    ))}
                  </select>
                  <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 rotate-90" />
                </div>
                <p className="mt-4 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Select the Company you wish to configure</p>
              </div>
            )}

            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="size-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Globe className="size-5" />
                </div>
                <h3 className="text-lg font-black tracking-tight">Domain Protocol</h3>
              </div>
              <div className="space-y-4">
                <div className="relative group">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                  <input
                    value={companyDomain || ""}
                    onChange={(e) => setCompanyDomain(e.target.value)}
                    placeholder="domain.com"
                    className="w-full pl-11 pr-5 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl font-bold focus:ring-4 ring-brand-500/10 transition-all outline-none"
                  />
                </div>
                <p className="text-xs text-slate-500 font-medium italic leading-relaxed">
                  The official domain used for verifying communication origin and automated mail filtering.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Communication Hub */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[2.5rem] p-10 shadow-sm">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                    <Mail className="size-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Communication Infrastructure</h2>
                    <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-black">Managed Messaging Channels</p>
                  </div>
                </div>
              </div>

              <div className="space-y-10">
                {/* New Mail Trigger */}
                <div className="relative">
                  <div className="flex gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-slate-200 dark:border-white/10 focus-within:border-brand-500/50 focus-within:ring-8 ring-brand-500/5 transition-all">
                    <div className="relative flex-1">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                      <input
                        value={newMail}
                        onChange={(e) => setNewMail(e.target.value)}
                        placeholder="Register new communication address (e.g. hr@domain.com)"
                        className="w-full pl-12 pr-4 py-4 bg-transparent outline-none font-bold placeholder:text-slate-400 placeholder:italic"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddMail()}
                      />
                    </div>
                    <button
                      onClick={handleAddMail}
                      className="px-8 py-4 bg-brand-500 text-white rounded-2xl font-black shadow-lg shadow-brand-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                    >
                      <PlusCircle className="size-5" /> Register Address
                    </button>
                  </div>
                </div>

                {/* Mailing Matrix */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <Briefcase className="size-4 text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Authorized Channels Matrix</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableMails.length > 0 ? availableMails.map((mail) => (
                      <div 
                        key={mail}
                        onClick={() => setDefaultMail(mail)}
                        className={`group relative p-6 rounded-[2rem] border-2 transition-all cursor-pointer flex items-center justify-between ${defaultMail === mail ? "bg-brand-500/5 border-brand-500 shadow-xl shadow-brand-500/5" : "bg-white dark:bg-white/5 border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-lg"}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`size-12 rounded-2xl flex items-center justify-center transition-all ${defaultMail === mail ? "bg-brand-500 text-white rotate-12 shadow-lg" : "bg-slate-100 dark:bg-white/10 text-slate-400 group-hover:rotate-6"}`}>
                            {defaultMail === mail ? <CheckCircle className="size-6" /> : <Mail className="size-5" />}
                          </div>
                          <div>
                            <span className="block font-black tracking-tight">{mail}</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${defaultMail === mail ? "text-brand-500" : "text-slate-400"}`}>
                              {defaultMail === mail ? "Default Protocol" : "Standby Channel"}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveMail(mail); }}
                          className="size-10 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all hover:scale-110 active:scale-90"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )) : (
                      <div className="col-span-2 py-16 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[3rem]">
                        <Mail className="size-12 mx-auto mb-4 opacity-5" />
                        <p className="font-bold text-slate-400 italic">No communication infrastructure registered.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Legend / Info */}
                <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-[2.5rem] flex items-start gap-6">
                  <div className="size-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                    <ShieldCheck className="size-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-blue-900 dark:text-blue-300 mb-1">Architecture Note</h4>
                    <p className="text-sm text-blue-700/70 dark:text-blue-400/70 leading-relaxed font-medium">
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
