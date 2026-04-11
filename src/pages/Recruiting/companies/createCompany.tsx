import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Swal from '../../../utils/swal';
import { useAppDispatch } from "../../../store/hooks";
import { createCompany } from "../../../store/slices/companiesSlice";
import { companiesKeys } from "../../../hooks/queries/useCompanies";
import { 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  Save, 
  Plus, 
  Trash2, 
  Image as ImageIcon,
  Upload,
  AlertCircle,
  ArrowLeft
} from "lucide-react";

type CompanyForm = {
  name: { en: string; ar: string; };
  description: { en: string; ar: string; };
  contactEmail: string;
  phone: string;
  address: Array<{ en: string; ar: string; location: string; }>;
  website: string;
  logoPath?: string;
};

const defaultCompany: CompanyForm = {
  name: { en: "", ar: "" },
  description: { en: "", ar: "" },
  contactEmail: "",
  phone: "",
  address: [{ en: "", ar: "", location: "" }],
  website: "",
  logoPath: "",
};

export default function CreateCompany() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  
  const [companyForm, setCompanyForm] = useState<CompanyForm>(defaultCompany);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompanyChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCompanyForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLocalizedChange = (field: 'name' | 'description', lang: 'en' | 'ar', value: string) => {
    setCompanyForm((prev) => ({
      ...prev, [field]: { ...prev[field], [lang]: value },
    }));
  };

  const handleAddressChange = (index: number, field: 'en' | 'ar' | 'location', value: string) => {
    setCompanyForm((prev) => {
      const newAddress = [...prev.address];
      newAddress[index] = { ...newAddress[index], [field]: value };
      return { ...prev, address: newAddress };
    });
  };

  const handleAddAddress = () => {
    setCompanyForm((prev) => ({
      ...prev, address: [...prev.address, { en: '', ar: '', location: '' }],
    }));
  };

  const handleRemoveAddress = (index: number) => {
    setCompanyForm((prev) => ({
      ...prev, address: prev.address.filter((_, i) => i !== index),
    }));
  };

  const uploadToCloudinary = async (file: File) => {
    const CLOUD_NAME = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string) || "175237158579478";
    const UPLOAD_PRESET = (import.meta.env.VITE_CLOUDINARY_PRESET as string) || "ml_default";
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    const res = await fetch(url, { method: "POST", body: formData });
    if (!res.ok) throw new Error("Cloudinary upload failed");
    return res.json();
  };

  const handleLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const result: any = await uploadToCloudinary(file);
      setCompanyForm((prev) => ({ ...prev, logoPath: result.secure_url }));
    } catch (err: any) {
      setError(err.message || "Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleCompanySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const previousCompanies = queryClient.getQueryData(companiesKeys.list());
    const tempId = `temp-${Date.now()}`;
    const tempCompany: any = { ...companyForm, _id: tempId };

    try {
      queryClient.setQueryData<any>(companiesKeys.list(), (old: any) => {
        if (!old) return [tempCompany];
        if (Array.isArray(old)) return [...old, tempCompany];
        return { ...old, data: [...(old.data || []), tempCompany] };
      });

      await Swal.fire({
        title: "Submitting...",
        text: "Registering new corporate Company",
        icon: "info",
        showConfirmButton: false,
        timer: 1000
      });

      const promise = dispatch(createCompany(companyForm)) as any;
      const resultAction = await promise;

      if (createCompany.fulfilled.match(resultAction)) {
        const newCompany = resultAction.payload as any;
        const newId = newCompany?._id ?? newCompany?.data?._id;
        queryClient.invalidateQueries({ queryKey: companiesKeys.list() });
        Swal.fire({ title: "Company Created", icon: "success", timer: 1500, showConfirmButton: false });
        if (newId) navigate(`/company/${newId}`);
        else navigate("/companies");
      } else {
        throw new Error(resultAction.payload || "Failed to create company");
      }
    } catch (err: any) {
      queryClient.setQueryData(companiesKeys.list(), previousCompanies);
      setError(err.message || "Failed to create company");
      Swal.fire("Registration Failed", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] p-4 sm:p-8 text-slate-900 dark:text-slate-100">
      <PageMeta title="New Company | Job Application Maker" description="Register a new company Company" />
      <PageBreadcrumb pageTitle="New Company registry" />

      <div className="max-w-5xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/companies")}
              className="size-12 rounded-2xl bg-white dark:bg-white/5 border border-white/20 dark:border-white/10 flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-sm"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent tracking-tight">
                New Company Registry
              </h1>
              <p className="text-gray-500 dark:text-gray-400 font-medium italic">Initialize a new corporate Company within the ecosystem</p>
            </div>
          </div>
          
          <button
            form="company-form"
            type="submit"
            disabled={isSubmitting || isUploadingLogo}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-brand-500 text-white rounded-[1.25rem] font-bold shadow-xl shadow-brand-500/20 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="size-5" />}
            Save Company
          </button>
        </div>

        <form id="company-form" onSubmit={handleCompanySubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Basic Info & Branding */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="size-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                  <Building2 className="size-5" />
                </div>
                <h2 className="text-xl font-black tracking-tight">Company Profile</h2>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      Company Name (English) <span className="text-brand-500">*</span>
                    </label>
                    <input
                      required
                      value={companyForm.name.en}
                      onChange={(e) => handleLocalizedChange('name', 'en', e.target.value)}
                      placeholder="e.g. Acme Corporation"
                      className="w-full px-5 py-3.5 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center justify-end gap-2">
                      <span className="text-brand-500">*</span> اسم الكيان (بالعربية)
                    </label>
                    <input
                      required
                      value={companyForm.name.ar}
                      onChange={(e) => handleLocalizedChange('name', 'ar', e.target.value)}
                      placeholder="مثال: شركة أكمي"
                      dir="rtl"
                      className="w-full px-5 py-3.5 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Mission Statement (English)</label>
                  <textarea
                    rows={4}
                    value={companyForm.description.en}
                    onChange={(e) => handleLocalizedChange('description', 'en', e.target.value)}
                    placeholder="Describe the company mission and operations..."
                    className="w-full px-5 py-3.5 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-medium italic"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <MapPin className="size-5" />
                  </div>
                  <h2 className="text-xl font-black tracking-tight">Locations</h2>
                </div>
                <button
                  type="button"
                  onClick={handleAddAddress}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-500/10 text-brand-500 rounded-xl text-xs font-black hover:bg-brand-500 hover:text-white transition-all"
                >
                  <Plus className="size-3" /> Add Location
                </button>
              </div>

              <div className="space-y-6">
                {companyForm.address.map((addr, idx) => (
                  <div key={idx} className="relative group p-6 border border-slate-200 dark:border-white/5 rounded-[2rem] bg-slate-50/50 dark:bg-white/5 space-y-4">
                    {companyForm.address.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAddress(idx)}
                        className="absolute -top-3 -right-3 size-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-90"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Street Address (EN)</label>
                        <input
                          value={addr.en}
                          onChange={(e) => handleAddressChange(idx, 'en', e.target.value)}
                          className="w-full bg-transparent border-b border-slate-300 dark:border-white/10 py-1 outline-none focus:border-brand-500 transition-colors font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right block">Street Address (AR)</label>
                        <input
                          value={addr.ar}
                          dir="rtl"
                          onChange={(e) => handleAddressChange(idx, 'ar', e.target.value)}
                          className="w-full bg-transparent border-b border-slate-300 dark:border-white/10 py-1 outline-none focus:border-brand-500 transition-colors font-bold"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Geolocation / Landmarks</label>
                      <input
                        value={addr.location}
                        onChange={(e) => handleAddressChange(idx, 'location', e.target.value)}
                        placeholder="Google Maps link or landmark notes"
                        className="w-full bg-transparent border-b border-slate-300 dark:border-white/10 py-1 outline-none focus:border-brand-500 transition-colors font-medium italic"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Contact & Logo */}
          <div className="space-y-8">
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="relative group">
                  <div className="size-40 rounded-[3rem] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-4xl font-black text-slate-300 overflow-hidden border-2 border-dashed border-slate-300 dark:border-white/10 group-hover:border-brand-500/50 transition-all">
                    {companyForm.logoPath ? (
                      <img src={companyForm.logoPath} alt="Logo Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="size-12 opacity-20" />
                    )}
                    <label className="absolute inset-0 bg-brand-500/80 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-all gap-2 p-4">
                      <Upload className="size-6" />
                      <span className="text-xs font-black uppercase tracking-wider">Update Logo</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                    </label>
                  </div>
                  {isUploadingLogo && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-sm rounded-[3rem] flex items-center justify-center">
                      <div className="size-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Brand Company</h3>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG or WebP. Max 2MB.</p>
                </div>
              </div>
            </div>

            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[2.5rem] p-8 shadow-sm space-y-8">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                  <Mail className="size-5" />
                </div>
                <h2 className="text-xl font-black tracking-tight">Contact</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">Corporate Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                      name="contactEmail"
                      value={companyForm.contactEmail}
                      onChange={handleCompanyChange}
                      placeholder="hr@acme.com"
                      className="w-full pl-11 pr-5 py-3.5 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">Central Switchboard</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                      name="phone"
                      value={companyForm.phone}
                      onChange={handleCompanyChange}
                      placeholder="+966 5..."
                      className="w-full pl-11 pr-5 py-3.5 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">Official Website</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                      name="website"
                      value={companyForm.website}
                      onChange={handleCompanyChange}
                      placeholder="www.acme.com"
                      className="w-full pl-11 pr-5 py-3.5 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all font-bold"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-shake">
                  <AlertCircle className="size-5 text-red-500 flex-shrink-0" />
                  <p className="text-xs font-black text-red-500 leading-tight">{error}</p>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
