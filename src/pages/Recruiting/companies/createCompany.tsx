import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import TextArea from "../../../components/form/input/TextArea";
import { PlusIcon } from "../../../icons";
import Swal from "sweetalert2";
import { useAppDispatch } from "../../../store/hooks";
import { createCompany } from "../../../store/slices/companiesSlice";

type CompanyForm = {
  name: {
    en: string;
    ar: string;
  };
  description: {
    en: string;
    ar: string;
  };
  contactEmail: string;
  phone: string;
  address: Array<{
    en: string;
    ar: string;
    location: string;
  }>;
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

export default function RecruitingDashboard() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  // Component state
  const [companyForm, setCompanyForm] = useState<CompanyForm>(defaultCompany);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleCompanyChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setCompanyForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLocalizedChange = (
    field: 'name' | 'description',
    lang: 'en' | 'ar',
    value: string
  ) => {
    setCompanyForm((prev) => ({
      ...prev,
      [field]: { ...prev[field], [lang]: value },
    }));
  };

  const handleAddressChange = (
    index: number,
    field: 'en' | 'ar' | 'location',
    value: string
  ) => {
    setCompanyForm((prev) => {
      const newAddress = [...prev.address];
      newAddress[index] = { ...newAddress[index], [field]: value };
      return { ...prev, address: newAddress };
    });
  };

  const handleAddAddress = () => {
    setCompanyForm((prev) => ({
      ...prev,
      address: [...prev.address, { en: '', ar: '', location: '' }],
    }));
  };

  const handleRemoveAddress = (index: number) => {
    setCompanyForm((prev) => ({
      ...prev,
      address: prev.address.filter((_, i) => i !== index),
    }));
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCompanyForm((prev) => ({ ...prev, logoPath: dataUrl }));
    } catch (err) {
      console.error("Failed to read logo file", err);
    }
  };

  const handleCompanySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const resultAction = await dispatch(
        createCompany({
          name: companyForm.name,
          description: companyForm.description,
          contactEmail: companyForm.contactEmail,
          phone: companyForm.phone,
          address: companyForm.address.map(a => ({ en: a.en, ar: a.ar, location: a.location })),
          website: companyForm.website,
          logoPath: companyForm.logoPath,
        })
      );

      if (createCompany.fulfilled.match(resultAction)) {
        const newCompany = resultAction.payload;
        
        await Swal.fire({
          title: "Success!",
          text: "Company created successfully.",
          icon: "success",
          position: "center",
          timer: 1500,
          showConfirmButton: false,
          customClass: { container: "!mt-16" },
        });

        navigate(`/company/${newCompany._id}`);
      } else {
        // Handle rejected action
        const errorMessage = resultAction.payload as string || "Failed to create company";
        setError(errorMessage);
      }
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to create company";
      setError(errorMessage);
      console.error("Error creating company:", err);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="space-y-6">
      <PageMeta
        title="Create Company | TailAdmin React"
        description="Create a new company for recruiting."
      />
      <PageBreadcrumb pageTitle="Create Company" />

      <ComponentCard
        title="Company Information"
        desc="Enter the company details to create a new recruiting company"
      >
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg">
            {successMessage}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleCompanySubmit}>
          {/* Company Name (EN/AR) */}
          <div className="space-y-3">
            <Label htmlFor="name-en" required>
              Company Name
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  id="name-en"
                  name="name-en"
                  value={companyForm.name.en}
                  onChange={(e) => handleLocalizedChange('name', 'en', e.target.value)}
                  placeholder="Company name (English)"
                  required
                />
                <span className="text-xs text-gray-500 mt-1 block">English</span>
              </div>
              <div>
                <Input
                  id="name-ar"
                  name="name-ar"
                  value={companyForm.name.ar}
                  onChange={(e) => handleLocalizedChange('name', 'ar', e.target.value)}
                  placeholder="اسم الشركة (عربي)"
                  required
                  className="text-right"
                />
                <span className="text-xs text-gray-500 mt-1 block text-right">العربية</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                value={companyForm.website}
                onChange={handleCompanyChange}
                placeholder="https://"
              />
            </div>
            <div>
              <Label htmlFor="logo">Upload logo</Label>
              <input
                id="logo"
                name="logo"
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-600 file:hover:bg-brand-100 file:hover:text-brand-700 file:transition file:duration-150"
              />
              {companyForm.logoPath && (
                <div className="mt-2">
                  <img src={companyForm.logoPath} alt="logo" className="h-16 w-auto rounded" />
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="contactEmail" required>
                Contact Email
              </Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                value={companyForm.contactEmail}
                onChange={handleCompanyChange}
                placeholder="contact@company.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                value={companyForm.phone}
                onChange={handleCompanyChange}
                placeholder="+1-555-0123"
              />
            </div>
          </div>

          {/* Description (EN/AR) */}
          <div className="space-y-3">
            <Label htmlFor="description-en">Description</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <TextArea
                  placeholder="What does this company do? (English)"
                  rows={3}
                  value={companyForm.description.en}
                  onChange={(value) => handleLocalizedChange('description', 'en', value)}
                />
                <span className="text-xs text-gray-500 mt-1 block">English</span>
              </div>
              <div>
                <TextArea
                  placeholder="ماذا تفعل هذه الشركة؟ (عربي)"
                  rows={3}
                  value={companyForm.description.ar}
                  onChange={(value) => handleLocalizedChange('description', 'ar', value)}
                  className="text-right"
                />
                <span className="text-xs text-gray-500 mt-1 block text-right">العربية</span>
              </div>
            </div>
          </div>

          {/* Address Array */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Addresses</Label>
              <button
                type="button"
                onClick={handleAddAddress}
                className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium"
              >
                + Add Address
              </button>
            </div>
            {companyForm.address.map((addr, index) => (
              <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Address {index + 1}
                  </span>
                  {companyForm.address.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAddress(index)}
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Input
                      placeholder="Address (English)"
                      value={addr.en}
                      onChange={(e) => handleAddressChange(index, 'en', e.target.value)}
                    />
                    <span className="text-xs text-gray-500 mt-1 block">English</span>
                  </div>
                  <div>
                    <Input
                      placeholder="العنوان (عربي)"
                      value={addr.ar}
                      onChange={(e) => handleAddressChange(index, 'ar', e.target.value)}
                      className="text-right"
                    />
                    <span className="text-xs text-gray-500 mt-1 block text-right">العربية</span>
                  </div>
                </div>
                <div className="mt-3">
                  <Input
                    placeholder="Location / Coordinates (optional)"
                    value={addr.location}
                    onChange={(e) => handleAddressChange(index, 'location', e.target.value)}
                  />
                  <span className="text-xs text-gray-500 mt-1 block">Location coordinates or map link</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlusIcon className="size-4" />
              {isSubmitting ? "Creating..." : "Create Company"}
            </button>
          </div>

        
        </form>
      </ComponentCard>
    </div>
  );
}
