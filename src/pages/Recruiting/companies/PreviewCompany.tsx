import type { ChangeEvent, FormEvent } from "react";
import { useState, useEffect } from "react";
import Swal from '../../../utils/swal';
import { useParams, useNavigate } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  Save, 
  X, 
  Plus, 
  Trash2, 
  Pencil,
  ArrowLeft,
  Briefcase,
  Building,
  Upload,
  Image as ImageIcon
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import {
  useCompany,
  useDepartments,
  useUpdateCompany,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from "../../../hooks/queries";
import { toPlainString } from "../../../utils/strings";

type CompanyForm = {
  name: { en: string; ar: string; };
  description: { en: string; ar: string; };
  address: Array<{ en: string; ar: string; location: string; }>;
  contactEmail?: string;
  phone?: string;
  website?: string;
  logoPath?: string;
  isActive?: boolean;
};

type DepartmentForm = {
  companyId: string;
  name: { en: string; ar: string; };
  description: { en: string; ar: string; };
};

export default function PreviewCompany() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("Company Management", "write");

  const { data: companyData, isLoading: loading } = useCompany(companyId || "");
  const { data: departments = [] } = useDepartments(companyId);

  const updateCompanyMutation = useUpdateCompany();
  const createDepartmentMutation = useCreateDepartment();
  const updateDepartmentMutation = useUpdateDepartment();
  const deleteDepartmentMutation = useDeleteDepartment();

  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    name: { en: "", ar: "" },
    description: { en: "", ar: "" },
    address: [{ en: "", ar: "", location: "" }],
    contactEmail: "",
    phone: "",
    website: "",
    logoPath: "",
    isActive: true,
  });

  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [departmentForm, setDepartmentForm] = useState<DepartmentForm>({
    companyId: companyId || "",
    name: { en: "", ar: "" },
    description: { en: "", ar: "" },
  });

  useEffect(() => {
    if (companyData) {
      const c: any = (companyData as any).company ?? (companyData as any).data ?? companyData;
      setCompanyForm({
        name: {
          en: typeof c.name === 'object' ? c.name.en || '' : toPlainString(c.name) || '',
          ar: typeof c.name === 'object' ? c.name.ar || '' : '',
        },
        description: {
          en: typeof c.description === 'object' ? c.description.en || '' : toPlainString(c.description) || '',
          ar: typeof c.description === 'object' ? c.description.ar || '' : '',
        },
        address: Array.isArray(c.address) && c.address.length > 0 ? c.address.map((a: any) => ({
          en: a.en || '',
          ar: a.ar || '',
          location: a.location || ''
        })) : [{ en: "", ar: "", location: "" }],
        contactEmail: c.contactEmail || "",
        phone: c.phone || "",
        website: c.website || "",
        logoPath: c.logoPath || "",
        isActive: c.isActive ?? true,
      });
    }
  }, [companyData]);

  const handleLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSaving(true);
    try {
      const CLOUD_NAME = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string) || "175237158579478";
      const UPLOAD_PRESET = (import.meta.env.VITE_CLOUDINARY_PRESET as string) || "ml_default";
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
      const result = await res.json();
      setCompanyForm(prev => ({ ...prev, logoPath: result.secure_url }));
    } catch (err) {
      Swal.fire("Upload Failed", "Could not process brand asset", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCompany = async () => {
    setIsSaving(true);
    try {
      await updateCompanyMutation.mutateAsync({ id: companyId!, data: companyForm as any });
      setIsEditingCompany(false);
      Swal.fire({ title: "Profile Updated", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire("Update Failed", err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAddress = () => {
    setCompanyForm(prev => ({
      ...prev,
      address: [...prev.address, { en: "", ar: "", location: "" }]
    }));
  };

  const handleDeleteDepartment = async (deptId: string) => {
    const result = await Swal.fire({
      title: "Eliminate Department?",
      text: "This will dissolve the department structure. Personnel will remain but unassigned.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, dissolve it"
    });
    if (result.isConfirmed) {
      try {
        await deleteDepartmentMutation.mutateAsync(deptId);
        Swal.fire({ title: "Dissolved", icon: "success", timer: 1500, showConfirmButton: false });
      } catch (err: any) {
        Swal.fire("Error", err.message, "error");
      }
    }
  };

  const handleDeptSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingDeptId) {
        await updateDepartmentMutation.mutateAsync({ id: editingDeptId, data: departmentForm });
      } else {
        await createDepartmentMutation.mutateAsync(departmentForm);
      }
      setShowDeptModal(false);
      setEditingDeptId(null);
      setDepartmentForm({ companyId: companyId!, name: { en: "", ar: "" }, description: { en: "", ar: "" } });
      Swal.fire({ title: editingDeptId ? "Updated" : "Created", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0F172A]"><LoadingSpinner /></div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] p-4 sm:p-8 text-slate-900 dark:text-slate-100">
      <PageMeta title={`${toPlainString(companyForm.name.en)} | Company Profile`} description="Manage corporate operations" />
      <PageBreadcrumb pageTitle="Company profile & operations" />

      <div className="max-w-7xl mx-auto">
        {/* Profile Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate("/companies")} className="size-12 rounded-2xl bg-white dark:bg-white/5 border border-white/20 dark:border-white/10 flex items-center justify-center hover:scale-110 active:scale-90 transition-all">
              <ArrowLeft className="size-5" />
            </button>
            <div className="flex items-center gap-6">
              <div className="size-24 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 border-2 border-white dark:border-white/10 overflow-hidden shadow-2xl">
                {companyForm.logoPath ? <img src={companyForm.logoPath} alt="" className="w-full h-full object-cover" /> : <Building2 className="size-10 m-auto mt-6 text-slate-400" />}
              </div>
              <div>
                <h1 className="text-4xl font-black bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent tracking-tight">
                  {toPlainString(companyForm.name.en)}
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${companyForm.isActive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                    {companyForm.isActive ? "Operational" : "Terminated"}
                  </span>
                  <span className="text-gray-400 text-xs font-bold italic">{departments.length} Active Departments</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {canEdit && (
              <button 
                onClick={() => isEditingCompany ? handleSaveCompany() : setIsEditingCompany(true)}
                disabled={isSaving}
                className={`flex items-center gap-2 px-8 py-4 rounded-[1.25rem] font-bold shadow-xl transition-all hover:scale-105 active:scale-95 ${isEditingCompany ? "bg-brand-500 text-white shadow-brand-500/20" : "bg-white dark:bg-white/5 border border-white/20 dark:border-white/10 shadow-sm"}`}
              >
                {isSaving ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (isEditingCompany ? <Save className="size-5" /> : <Pencil className="size-5" />)}
                {isEditingCompany ? "Save Changes" : "Edit"}
              </button>
            )}
            {isEditingCompany && (
              <button onClick={() => setIsEditingCompany(false)} className="size-14 rounded-[1.25rem] bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                <X className="size-6" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content: Info Cards */}
          <div className="lg:col-span-2 space-y-12">
            
            {/* Mission & Branding */}
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[2.5rem] p-10 shadow-sm">
              <div className="flex items-center gap-4 mb-10">
                <div className="size-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                  <Building2 className="size-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Company Registry</h2>
                  <p className="text-xs text-gray-500">Official corporate identification and mission</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Legal Company Name (EN)</label>
                    <input 
                      readOnly={!isEditingCompany}
                      value={companyForm.name.en}
                      onChange={(e) => setCompanyForm(p => ({ ...p, name: { ...p.name, en: e.target.value } }))}
                      className="w-full bg-slate-100/50 dark:bg-white/5 border-none rounded-2xl p-4 font-bold focus:ring-2 ring-brand-500/50 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">اسم الكيان (AR)</label>
                    <input 
                      readOnly={!isEditingCompany}
                      dir="rtl"
                      value={companyForm.name.ar}
                      onChange={(e) => setCompanyForm(p => ({ ...p, name: { ...p.name, ar: e.target.value } }))}
                      className="w-full bg-slate-100/50 dark:bg-white/5 border-none rounded-2xl p-4 font-bold focus:ring-2 ring-brand-500/50 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="relative group">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Corporate Brand Asset</label>
                  <div className="relative size-full min-h-[180px] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center p-6 transition-all group-hover:border-brand-500/50 overflow-hidden">
                    {companyForm.logoPath ? (
                      <>
                        <img src={companyForm.logoPath} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <label className="cursor-pointer bg-white/20 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-2xl">
                            <Upload className="size-6 text-white" />
                            <input type="file" className="hidden" onChange={handleLogoChange} disabled={!isEditingCompany} />
                          </label>
                        </div>
                      </>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center gap-3">
                        <ImageIcon className="size-10 text-slate-300" />
                        <span className="text-[10px] font-black text-slate-400 uppercase">Upload Company Mark</span>
                        <input type="file" className="hidden" onChange={handleLogoChange} disabled={!isEditingCompany} />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Mission Statement (EN)</label>
                  <textarea 
                    readOnly={!isEditingCompany}
                    value={companyForm.description.en}
                    onChange={(e) => setCompanyForm(p => ({ ...p, description: { ...p.description, en: e.target.value } }))}
                    rows={4}
                    className="w-full bg-slate-100/50 dark:bg-white/5 border-none rounded-2xl p-4 font-bold focus:ring-2 ring-brand-500/50 transition-all outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">وصف المهمة (AR)</label>
                  <textarea 
                    readOnly={!isEditingCompany}
                    dir="rtl"
                    value={companyForm.description.ar}
                    onChange={(e) => setCompanyForm(p => ({ ...p, description: { ...p.description, ar: e.target.value } }))}
                    rows={4}
                    className="w-full bg-slate-100/50 dark:bg-white/5 border-none rounded-2xl p-4 font-bold focus:ring-2 ring-brand-500/50 transition-all outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Department Matrix */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                    <Building className="size-5" />
                  </div>
                  <h3 className="text-xl font-black">Department Section</h3>
                </div>
                {canEdit && (
                  <button 
                    onClick={() => { setEditingDeptId(null); setDepartmentForm({ companyId: companyId!, name: { en: "", ar: "" }, description: { en: "", ar: "" } }); setShowDeptModal(true); }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-xl text-xs font-black shadow-lg shadow-brand-500/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Plus className="size-4" /> Create Department
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {departments.map((dept: any) => (
                  <div key={dept._id} className="group bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-3xl p-6 hover:shadow-xl transition-all">
                    <div className="flex items-start justify-between">
                      <div className="size-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 group-hover:bg-brand-500/10 group-hover:text-brand-500 transition-colors">
                        <Briefcase className="size-5" />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingDeptId(dept._id);
                            setDepartmentForm({
                              companyId: companyId!,
                              name: { en: dept.name?.en || "", ar: dept.name?.ar || "" },
                              description: { en: dept.description?.en || "", ar: dept.description?.ar || "" }
                            });
                            setShowDeptModal(true);
                          }}
                          className="size-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteDepartment(dept._id)}
                          className="size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 leading-tight">{toPlainString(dept.name?.en)}</h4>
                      <p className="text-[10px] font-black text-brand-500 mt-0.5">{toPlainString(dept.name?.ar)}</p>
                      <p className="text-xs text-slate-500 mt-3 line-clamp-2 leading-relaxed">
                        {toPlainString(dept.description?.en) || "No strategic overview provided for this business unit."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar: Metadata & Contact */}
          <div className="space-y-8">
           

            {/* Contact Information */}
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[2.5rem] p-8 space-y-8 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                  <Mail className="size-5" />
                </div>
                <h3 className="font-black text-lg">Contact</h3>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Corporate Mail</label>
                  <div className="flex items-center gap-3 bg-slate-100/50 dark:bg-white/5 p-4 rounded-2xl">
                    <Mail className="size-4 text-slate-400" />
                    <input 
                      readOnly={!isEditingCompany}
                      value={companyForm.contactEmail}
                      onChange={(e) => setCompanyForm(p => ({ ...p, contactEmail: e.target.value }))}
                      className="bg-transparent border-none w-full font-bold text-sm outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Hotline</label>
                  <div className="flex items-center gap-3 bg-slate-100/50 dark:bg-white/5 p-4 rounded-2xl">
                    <Phone className="size-4 text-slate-400" />
                    <input 
                      readOnly={!isEditingCompany}
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm(p => ({ ...p, phone: e.target.value }))}
                      className="bg-transparent border-none w-full font-bold text-sm outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Web Portal</label>
                  <div className="flex items-center gap-3 bg-slate-100/50 dark:bg-white/5 p-4 rounded-2xl">
                    <Globe className="size-4 text-slate-400" />
                    <input 
                      readOnly={!isEditingCompany}
                      value={companyForm.website}
                      onChange={(e) => setCompanyForm(p => ({ ...p, website: e.target.value }))}
                      className="bg-transparent border-none w-full font-bold text-sm outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Geographical Registry */}
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                  <MapPin className="size-5" />
                </div>
                <h3 className="font-black text-lg">Location</h3>
              </div>

              <div className="space-y-4">
                {companyForm.address.map((addr, idx) => (
                  <div key={idx} className="p-6 bg-slate-100/30 dark:bg-white/5 border border-white/10 rounded-3xl space-y-4">
                    {isEditingCompany ? (
                      <div className="space-y-3">
                        <input 
                          placeholder="Operational Address (EN)" 
                          value={addr.en} 
                          onChange={(e) => {
                            const newAddrs = [...companyForm.address];
                            newAddrs[idx].en = e.target.value;
                            setCompanyForm(p => ({ ...p, address: newAddrs }));
                          }}
                          className="w-full bg-white dark:bg-white/5 border-none rounded-xl p-3 text-xs font-bold outline-none"
                        />
                        <input 
                          dir="rtl"
                          placeholder="عنوان العمليات (AR)" 
                          value={addr.ar} 
                          onChange={(e) => {
                            const newAddrs = [...companyForm.address];
                            newAddrs[idx].ar = e.target.value;
                            setCompanyForm(p => ({ ...p, address: newAddrs }));
                          }}
                          className="w-full bg-white dark:bg-white/5 border-none rounded-xl p-3 text-xs font-bold outline-none"
                        />
                        <input 
                          placeholder="Google Maps URL" 
                          value={addr.location} 
                          onChange={(e) => {
                            const newAddrs = [...companyForm.address];
                            newAddrs[idx].location = e.target.value;
                            setCompanyForm(p => ({ ...p, address: newAddrs }));
                          }}
                          className="w-full bg-white dark:bg-white/5 border-none rounded-xl p-3 text-[10px] font-bold outline-none opacity-60"
                        />
                        {companyForm.address.length > 1 && (
                          <button onClick={() => setCompanyForm(p => ({ ...p, address: p.address.filter((_, i) => i !== idx) }))} className="text-[10px] font-black text-red-500 uppercase flex items-center gap-1 hover:underline">
                            <X className="size-3" /> Dissolve Location
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-brand-500 transition-colors">Main Campus</span>
                        <p className="text-sm font-bold leading-relaxed">{toPlainString(addr.en)}</p>
                        <p className="text-[10px] font-bold text-slate-400 italic">{toPlainString(addr.ar)}</p>
                      </div>
                    )}
                    {!isEditingCompany && addr.location && (
                      <div className="p-4 bg-slate-100/50 dark:bg-white/5 rounded-2xl flex items-center gap-3">
                        <MapPin className="size-4 text-brand-500" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 line-clamp-1">{addr.location}</span>
                      </div>
                    )}
                  </div>
                ))}
                
                {isEditingCompany && (
                  <button onClick={handleAddAddress} className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl text-xs font-black text-slate-400 hover:border-brand-500/50 hover:text-brand-500 transition-all flex items-center justify-center gap-2">
                    <Plus className="size-4" /> Add Location
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Department Management Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowDeptModal(false)} />
          <div className="relative bg-white dark:bg-[#111827] w-full max-w-xl rounded-[3rem] shadow-2xl border border-white/20 dark:border-white/5 overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black">{editingDeptId ? "Optimize Unit" : "Initialize Unit"}</h3>
                  <p className="text-xs text-slate-500 font-bold">Strategic structural definition</p>
                </div>
                <button onClick={() => setShowDeptModal(false)} className="size-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center hover:scale-110 active:scale-90 transition-all">
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={handleDeptSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Division Name (EN)</label>
                    <input 
                      required
                      value={departmentForm.name.en}
                      onChange={(e) => setDepartmentForm(p => ({ ...p, name: { ...p.name, en: e.target.value } }))}
                      className="w-full bg-slate-100/50 dark:bg-white/5 border-none rounded-2xl p-4 font-bold focus:ring-2 ring-brand-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">اسم القسم (AR)</label>
                    <input 
                      required
                      dir="rtl"
                      value={departmentForm.name.ar}
                      onChange={(e) => setDepartmentForm(p => ({ ...p, name: { ...p.name, ar: e.target.value } }))}
                      className="w-full bg-slate-100/50 dark:bg-white/5 border-none rounded-2xl p-4 font-bold focus:ring-2 ring-brand-500/50 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Strategic Overview (EN)</label>
                    <textarea 
                      value={departmentForm.description.en}
                      onChange={(e) => setDepartmentForm(p => ({ ...p, description: { ...p.description, en: e.target.value } }))}
                      rows={4}
                      className="w-full bg-slate-100/50 dark:bg-white/5 border-none rounded-2xl p-4 font-bold focus:ring-2 ring-brand-500/50 outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">نظرة عامة استراتيجية (AR)</label>
                    <textarea 
                      dir="rtl"
                      value={departmentForm.description.ar}
                      onChange={(e) => setDepartmentForm(p => ({ ...p, description: { ...p.description, ar: e.target.value } }))}
                      rows={4}
                      className="w-full bg-slate-100/50 dark:bg-white/5 border-none rounded-2xl p-4 font-bold focus:ring-2 ring-brand-500/50 outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex-1 py-4 bg-brand-500 text-white rounded-2xl font-bold shadow-xl shadow-brand-500/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isSaving ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="size-5" />}
                    {editingDeptId ? "Commit Changes" : "Initialize Unit"}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowDeptModal(false)}
                    className="px-8 py-4 bg-slate-100 dark:bg-white/5 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
