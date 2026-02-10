import type { ChangeEvent, FormEvent } from "react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import TextArea from "../../../components/form/input/TextArea";
import Select from "../../../components/form/Select";
import { PlusIcon } from "../../../icons";
import Swal from "sweetalert2";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchCompanies, createCompany } from "../../../store/slices/companiesSlice";

type CompanyForm = {
  name: string;
  description: string;
  contactEmail: string;
  phone: string;
  address: string;
  website: string;
  logoPath?: string;
};

const defaultCompany: CompanyForm = {
  name: "",
  description: "",
  contactEmail: "",
  phone: "",
  address: "",
  website: "",
  logoPath: "",
};

export default function RecruitingDashboard() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  // Redux state
  const { companies, loading: companiesLoading, isFetched } = useAppSelector(
    (state) => state.companies
  );
  
  // Component state
  const [companyForm, setCompanyForm] = useState<CompanyForm>(defaultCompany);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  // Load companies on mount (only if not already fetched)
  useEffect(() => {
    if (!isFetched && !companiesLoading) {
      dispatch(fetchCompanies());
    }
  }, [dispatch, isFetched, companiesLoading]);

  // Handle company selection for duplication
  const handleCompanySelect = (companyId: string) => {
    setSelectedCompanyId(companyId);
    
    if (!companyId) {
      // Reset form if no company selected
      setCompanyForm(defaultCompany);
      return;
    }
    
    const selectedCompany = companies.find((c) => c._id === companyId);
    if (selectedCompany) {
      // Populate form with selected company data (excluding _id for duplication)
      setCompanyForm({
        name: `${selectedCompany.name} (Copy)`,
        description: selectedCompany.description || "",
        contactEmail: selectedCompany.contactEmail || "",
        phone: selectedCompany.phone || "",
        address: selectedCompany.address || "",
        website: selectedCompany.website || "",
        logoPath: selectedCompany.logoPath || "",
      });
    }
  };

  const handleCompanyChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setCompanyForm((prev) => ({ ...prev, [name]: value }));
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
          address: companyForm.address,
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

        {/* Company Selection for Duplication */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <Label htmlFor="duplicateCompany" className="mb-2">
            Duplicate from existing company (optional)
          </Label>
          <Select
            options={[
              { value: "", label: "-- Start from scratch --" },
              ...companies.map((company) => ({
                value: company._id,
                label: company.name,
              })),
            ]}
            value={selectedCompanyId}
            onChange={handleCompanySelect}
            placeholder="Select a company to duplicate"
          />
          {companiesLoading && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Loading companies...
            </p>
          )}
          {selectedCompanyId && (
            <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
              ✓ Company data loaded. You can edit the fields below before saving.
            </p>
          )}
        </div>

        <form className="space-y-4" onSubmit={handleCompanySubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Company name</Label>
              <Input
                id="name"
                name="name"
                value={companyForm.name}
                onChange={handleCompanyChange}
                placeholder="Company name"
              />
            </div>
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
              <Label htmlFor="contactEmail">Contact email</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                value={companyForm.contactEmail}
                onChange={handleCompanyChange}
                placeholder="contact@company.com"
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
          <div>
            <Label htmlFor="description">Description</Label>
            <TextArea
              placeholder="What does this company do?"
              rows={3}
              value={companyForm.description}
              onChange={(value) =>
                setCompanyForm((prev) => ({ ...prev, description: value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <TextArea
              placeholder="Street, city, state"
              rows={2}
              value={companyForm.address}
              onChange={(value) =>
                setCompanyForm((prev) => ({ ...prev, address: value }))
              }
            />
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
