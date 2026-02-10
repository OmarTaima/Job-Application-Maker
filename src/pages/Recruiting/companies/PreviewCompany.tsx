import type { ChangeEvent, FormEvent } from "react";
import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { useParams, useNavigate } from "react-router";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import TextArea from "../../../components/form/input/TextArea";
import {
  CheckCircleIcon,
  PlusIcon,
  TrashBinIcon,
  PencilIcon,
  CloseIcon,
} from "../../../icons";
import type { Department } from "../../../services/departmentsService";
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
  name: {
    en: string;
    ar: string;
  };
  description: {
    en: string;
    ar: string;
  };
  address: Array<{
    en: string;
    ar: string;
    location: string;
  }>;
  contactEmail?: string;
  phone?: string;
  website?: string;
  logoPath?: string;
  isActive?: boolean;
};

type DepartmentForm = {
  companyId: string;
  name: {
    en: string;
    ar: string;
  };
  description: {
    en: string;
    ar: string;
  };
  managerId?: string;
};

export default function PreviewCompany() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const canEdit = hasPermission("Company Management", "write");

  // React Query hooks - data fetching happens automatically
  const {
    data: company,
    isLoading: loading,
    error,
  } = useCompany(companyId || "");
  const { data: departments = [] } = useDepartments(companyId);

  // Mutations
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
  const [departmentForm, setDepartmentForm] = useState<DepartmentForm>({
    companyId: companyId || "",
    name: { en: "", ar: "" },
    description: { en: "", ar: "" },
    managerId: "",
  });

  const [companyStatus, setCompanyStatus] = useState("");
  const [departmentStatus, setDepartmentStatus] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [departmentError, setDepartmentError] = useState("");
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [isSubmittingDept, setIsSubmittingDept] = useState(false);
  const [isDeletingDept, setIsDeletingDept] = useState<string | null>(null);
  const [isSavingDept, setIsSavingDept] = useState(false);

  // Helper function to extract detailed error messages
  const getErrorMessage = (err: any): string => {
    // Check for validation errors in 'details' array (new format)
    if (
      err.response?.data?.details &&
      Array.isArray(err.response.data.details)
    ) {
      return err.response.data.details
        .map((detail: any) => {
          const field = detail.path?.[0] || "";
          const message = detail.message || "";
          return field ? `${field}: ${message}` : message;
        })
        .join(", ");
    }

    // Check for validation errors in 'errors' array (old format)
    if (err.response?.data?.errors) {
      const errors = err.response.data.errors;
      if (Array.isArray(errors)) {
        return errors.map((e: any) => e.msg || e.message).join(", ");
      }
      if (typeof errors === "object") {
        return Object.entries(errors)
          .map(([field, msg]) => `${field}: ${msg}`)
          .join(", ");
      }
    }

    // Check for specific error message
    if (err.response?.data?.message) {
      return err.response.data.message;
    }

    // Check for general error message
    if (err.message) {
      return err.message;
    }

    return "An unexpected error occurred";
  };

  // Update form when company data loads
  useEffect(() => {
    if (company) {
      const srcName = (company as any).name;
      const srcDesc = (company as any).description;
      const srcAddr = (company as any).address;
      
      setCompanyForm({
        name: {
          en: typeof srcName === 'object' ? srcName.en || '' : toPlainString(srcName) || '',
          ar: typeof srcName === 'object' ? srcName.ar || '' : '',
        },
        description: {
          en: typeof srcDesc === 'object' ? srcDesc.en || '' : toPlainString(srcDesc) || '',
          ar: typeof srcDesc === 'object' ? srcDesc.ar || '' : '',
        },
        address: Array.isArray(srcAddr) && srcAddr.length > 0
          ? srcAddr
          : [{
              en: typeof srcAddr === 'object' && !Array.isArray(srcAddr) ? srcAddr.en || '' : toPlainString(srcAddr) || '',
              ar: typeof srcAddr === 'object' && !Array.isArray(srcAddr) ? srcAddr.ar || '' : '',
              location: typeof srcAddr === 'object' && !Array.isArray(srcAddr) ? srcAddr.location || '' : '',
            }],
        contactEmail: company.contactEmail || "",
        phone: company.phone || "",
        website: company.website || "",
        logoPath: company.logoPath || "",
        isActive: company.isActive ?? true,
      });
    }
  }, [company]);

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

  const handleDepartmentChange = (
    field: 'name' | 'description',
    lang: 'en' | 'ar',
    value: string
  ) => {
    setDepartmentForm((prev) => ({
      ...prev,
      [field]: { ...prev[field], [lang]: value },
    }));
  };

  const handleCompanySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCompanyError("");

    // Validation
    if (!companyForm.name?.en?.trim() || !companyForm.name?.ar?.trim()) {
      setCompanyError("Company name (both English and Arabic) is required");
      return;
    }
    // Ensure contact email is provided (backend requires it)
    if (!companyForm.contactEmail || !companyForm.contactEmail.trim()) {
      setCompanyError("Contact email is required");
      return;
    }

    try {
      const payload = {
        ...companyForm,
        address: Array.isArray(companyForm.address)
          ? companyForm.address.map((a) => ({ en: a.en, ar: a.ar, location: a.location }))
          : companyForm.address,
      };

      await updateCompanyMutation.mutateAsync({
        id: companyId!,
        data: payload,
      });

      await Swal.fire({
        title: "Success!",
        text: "Company updated successfully.",
        icon: "success",
        position: "center",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
      });

      setCompanyStatus("Company updated successfully");
      setIsEditingCompany(false);
      setTimeout(() => setCompanyStatus(""), 2500);
    } catch (err) {
      console.error("Error updating company:", err);
      const errorMsg = getErrorMessage(err);
      setCompanyError(errorMsg);
    }
  };

  const handleDepartmentSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDepartmentError("");

    // Validation
    if (!departmentForm.name?.en?.trim() || !departmentForm.name?.ar?.trim()) {
      setDepartmentError("Department name (both English and Arabic) is required");
      return;
    }

    try {
      setIsSubmittingDept(true);
      // Use current user's ID as managerId if not explicitly set
      const payload = {
        ...departmentForm,
        managerId: departmentForm.managerId || user?.id || undefined,
      };

      await createDepartmentMutation.mutateAsync(payload);

      await Swal.fire({
        title: "Success!",
        text: "Department created successfully.",
        icon: "success",
        position: "center",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
      });

      setDepartmentStatus("Department created successfully");
      setDepartmentForm({
        companyId: companyId || "",
        name: { en: "", ar: "" },
        description: { en: "", ar: "" },
        managerId: "",
      });
      setTimeout(() => setDepartmentStatus(""), 2500);
    } catch (err) {
      console.error("Error creating department:", err);
      const errorMsg = getErrorMessage(err);
      setDepartmentError(errorMsg);
    } finally {
      setIsSubmittingDept(false);
    }
  };

  const handleDeleteDepartment = async (deptId: string) => {
    const result = await Swal.fire({
      title: "Delete Department?",
      text: "Are you sure you want to delete this department?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    setDepartmentError("");

    try {
      setIsDeletingDept(deptId);
      await deleteDepartmentMutation.mutateAsync(deptId);
      await Swal.fire({
        title: "Deleted!",
        text: "Department has been deleted successfully.",
        icon: "success",
        position: "center",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
      });
    } catch (err) {
      console.error("Error deleting department:", err);
      const errorMsg = getErrorMessage(err);
      setDepartmentError(errorMsg);
    } finally {
      setIsDeletingDept(null);
    }
  };

  const handleEditDepartment = (dept: Department) => {
    setEditingDeptId(dept._id);
    
    // Ensure bilingual format for editing
    const deptName = dept.name as any;
    const deptDesc = dept.description as any;
    
    setEditingDept({
      ...dept,
      name: typeof deptName === 'object' 
        ? deptName 
        : { en: toPlainString(deptName) || '', ar: '' },
      description: typeof deptDesc === 'object'
        ? deptDesc
        : { en: toPlainString(deptDesc) || '', ar: '' },
    });
  };

  const handleSaveDepartment = async () => {
    if (editingDept) {
      setDepartmentError("");

      // Validation
      const deptName = editingDept.name as any;
      if (!deptName?.en?.trim() || !deptName?.ar?.trim()) {
        setDepartmentError("Department name (both English and Arabic) is required");
        return;
      }

      try {
        setIsSavingDept(true);
        await updateDepartmentMutation.mutateAsync({
          id: editingDept._id,
          data: {
            name: editingDept.name,
            description: editingDept.description,
            managerId:
              typeof editingDept.managerId === "string"
                ? editingDept.managerId
                : editingDept.managerId?._id,
            isActive: typeof editingDept?.isActive === "boolean" ? editingDept.isActive : undefined,
          },
        } as any);
        setEditingDeptId(null);
        setEditingDept(null);
        await Swal.fire({
          title: "Success!",
          text: "Department updated successfully.",
          icon: "success",
          position: "center",
          timer: 2000,
          showConfirmButton: false,
          customClass: { container: "!mt-16" },
        });
      } catch (err) {
        console.error("Error updating department:", err);
        const errorMsg = getErrorMessage(err);
        setDepartmentError(errorMsg);
      } finally {
        setIsSavingDept(false);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingDeptId(null);
    setEditingDept(null);
  };

  return loading ? (
    <div className="space-y-6">
      <PageMeta title="Loading..." description="Loading company details" />
      <PageBreadcrumb pageTitle="Company Details" />
      <LoadingSpinner fullPage message="Loading company details..." />
    </div>
  ) : (
    <div className="space-y-6">
      <PageMeta
        title={`${toPlainString(companyForm.name) || "Company"} | Company Preview`}
        description="View and edit company details and departments."
      />

      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate("/companies")}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
        >
          <svg
            className="size-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Companies
        </button>
      </div>

      <PageBreadcrumb pageTitle={toPlainString(companyForm.name) || "Company"} />

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {String(error instanceof Error ? error.message : error)}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500">
          Loading company data...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <div className="relative">
            {canEdit && (
              <div className="absolute top-5 right-5 z-10">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingCompany(!isEditingCompany);
                    setCompanyError("");
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
                >
                  <PencilIcon className="size-4" />
                  {isEditingCompany ? "Cancel" : "Edit"}
                </button>
              </div>
            )}

            <ComponentCard title="Company Information" desc="View and edit company details">
              <form className="space-y-4" onSubmit={handleCompanySubmit}>

              {companyError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    <strong>Error:</strong> {companyError}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Company Name (EN/AR) */}
                <div className="md:col-span-2 space-y-3">
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
                        disabled={!isEditingCompany}
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
                        disabled={!isEditingCompany}
                        required
                        className="text-right"
                      />
                      <span className="text-xs text-gray-500 mt-1 block text-right">العربية</span>
                    </div>
                  </div>
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
                    disabled={!isEditingCompany}
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
                    disabled={!isEditingCompany}
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    name="website"
                    type="url"
                    value={companyForm.website}
                    onChange={handleCompanyChange}
                    placeholder="https://company.com"
                    disabled={!isEditingCompany}
                  />
                </div>
                <div>
                  <Label htmlFor="logoPath">Logo</Label>
                  {isEditingCompany ? (
                    <>
                      <input
                        id="logoPath"
                        name="logoPath"
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
                    </>
                  ) : (
                    companyForm.logoPath && (
                      <div className="mt-1">
                        <img src={companyForm.logoPath} alt="logo" className="h-16 w-auto rounded" />
                      </div>
                    )
                  )}
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
                      disabled={!isEditingCompany}
                    />
                    <span className="text-xs text-gray-500 mt-1 block">English</span>
                  </div>
                  <div>
                    <TextArea
                      placeholder="ماذا تفعل هذه الشركة؟ (عربي)"
                      rows={3}
                      value={companyForm.description.ar}
                      onChange={(value) => handleLocalizedChange('description', 'ar', value)}
                      disabled={!isEditingCompany}
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
                  {isEditingCompany && (
                    <button
                      type="button"
                      onClick={handleAddAddress}
                      className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium"
                    >
                      + Add Address
                    </button>
                  )}
                </div>
                {companyForm.address.map((addr, index) => (
                  <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Address {index + 1}
                      </span>
                      {isEditingCompany && companyForm.address.length > 1 && (
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
                          disabled={!isEditingCompany}
                        />
                        <span className="text-xs text-gray-500 mt-1 block">English</span>
                      </div>
                      <div>
                        <Input
                          placeholder="العنوان (عربي)"
                          value={addr.ar}
                          onChange={(e) => handleAddressChange(index, 'ar', e.target.value)}
                          disabled={!isEditingCompany}
                          className="text-right"
                        />
                        <span className="text-xs text-gray-500 mt-1 block text-right">العربية</span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Input
                        placeholder="Location / Coordinates (optional)"
                        value={addr.location || ''}
                        onChange={(e) => handleAddressChange(index, 'location', e.target.value)}
                        disabled={!isEditingCompany}
                      />
                      <span className="text-xs text-gray-500 mt-1 block">Location coordinates or map link</span>
                    </div>
                  </div>
                ))}
              </div>

              {isEditingCompany && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  >
                    <CheckCircleIcon className="size-4" />
                    Save Changes
                  </button>
                  <div className="flex items-center gap-3">
                    <input
                      id="isActive"
                      type="checkbox"
                      checked={!!companyForm.isActive}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({
                          ...prev,
                          isActive: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 text-brand-500"
                    />
                    <Label htmlFor="isActive" className="!mb-0">
                      Active
                    </Label>
                  </div>
                  {companyStatus && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-600 ring-1 ring-inset ring-success-200 dark:bg-success-500/10 dark:text-success-200 dark:ring-success-400/40">
                      <CheckCircleIcon className="size-4" />
                      {companyStatus}
                    </span>
                  )}
                </div>
              )}
            </form>
          </ComponentCard>
          </div>

          <ComponentCard
            title="Departments"
            desc="Manage departments for this company"
          >
            <div className="space-y-6">
              {departmentError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    <strong>Error:</strong> {departmentError}
                  </p>
                  <button
                    onClick={() => setDepartmentError("")}
                    className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <form className="space-y-4" onSubmit={handleDepartmentSubmit}>
                {/* Department Name (EN/AR) */}
                <div className="space-y-3">
                  <Label htmlFor="departmentName-en" required>
                    Department Name
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Input
                        id="departmentName-en"
                        name="name-en"
                        value={departmentForm.name.en}
                        onChange={(e) =>
                          handleDepartmentChange("name", "en", e.target.value)
                        }
                        placeholder="Department name (English)"
                        required
                      />
                      <span className="text-xs text-gray-500 mt-1 block">English</span>
                    </div>
                    <div>
                      <Input
                        id="departmentName-ar"
                        name="name-ar"
                        value={departmentForm.name.ar}
                        onChange={(e) =>
                          handleDepartmentChange("name", "ar", e.target.value)
                        }
                        placeholder="اسم القسم (عربي)"
                        required
                        className="text-right"
                      />
                      <span className="text-xs text-gray-500 mt-1 block text-right">العربية</span>
                    </div>
                  </div>
                </div>

                {/* Description (EN/AR) */}
                <div className="space-y-3">
                  <Label htmlFor="departmentDescription-en">Description</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Input
                        id="departmentDescription-en"
                        name="description-en"
                        value={departmentForm.description.en}
                        onChange={(e) =>
                          handleDepartmentChange("description", "en", e.target.value)
                        }
                        placeholder="What this team does (English)"
                      />
                      <span className="text-xs text-gray-500 mt-1 block">English</span>
                    </div>
                    <div>
                      <Input
                        id="departmentDescription-ar"
                        name="description-ar"
                        value={departmentForm.description.ar}
                        onChange={(e) =>
                          handleDepartmentChange("description", "ar", e.target.value)
                        }
                        placeholder="ماذا يفعل هذا الفريق (عربي)"
                        className="text-right"
                      />
                      <span className="text-xs text-gray-500 mt-1 block text-right">العربية</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={isSubmittingDept}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PlusIcon className="size-4" />
                    {isSubmittingDept ? "Creating..." : "Add Department"}
                  </button>
                  {departmentStatus && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-600 ring-1 ring-inset ring-success-200 dark:bg-success-500/10 dark:text-success-200 dark:ring-success-400/40">
                      <CheckCircleIcon className="size-4" />
                      {departmentStatus}
                    </span>
                  )}
                </div>
              </form>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    All Departments
                  </h4>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 dark:bg-gray-950 dark:text-gray-200 dark:ring-gray-800">
                    {departments.length} total
                  </span>
                </div>

                <div className="space-y-2">
                  {departments.map((dept) => {
                    const isEditing = editingDeptId === dept._id;
                    const currentDept =
                      isEditing && editingDept ? editingDept : dept;

                    return (
                      <div
                        key={dept._id}
                        className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
                      >
                        <div className="flex-1 space-y-3">
                          {isEditing ? (
                            <>
                              <div className="space-y-3">
                                {/* Department Name (EN/AR) */}
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-name-en-${dept._id}`} required>
                                    Department Name
                                  </Label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <Input
                                        id={`edit-name-en-${dept._id}`}
                                        value={(currentDept.name as any)?.en || ''}
                                        onChange={(e) =>
                                          setEditingDept(
                                            editingDept
                                              ? {
                                                  ...editingDept,
                                                  name: { ...(editingDept.name as any), en: e.target.value },
                                                }
                                              : null
                                          )
                                        }
                                        placeholder="Department name (English)"
                                        required
                                      />
                                      <span className="text-xs text-gray-500 mt-1 block">English</span>
                                    </div>
                                    <div>
                                      <Input
                                        id={`edit-name-ar-${dept._id}`}
                                        value={(currentDept.name as any)?.ar || ''}
                                        onChange={(e) =>
                                          setEditingDept(
                                            editingDept
                                              ? {
                                                  ...editingDept,
                                                  name: { ...(editingDept.name as any), ar: e.target.value },
                                                }
                                              : null
                                          )
                                        }
                                        placeholder="اسم القسم (عربي)"
                                        required
                                        className="text-right"
                                      />
                                      <span className="text-xs text-gray-500 mt-1 block text-right">العربية</span>
                                    </div>
                                  </div>
                                </div>
                                {/* Description (EN/AR) */}
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-desc-en-${dept._id}`}>
                                    Description
                                  </Label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <Input
                                        id={`edit-desc-en-${dept._id}`}
                                        value={(currentDept.description as any)?.en || ''}
                                        onChange={(e) =>
                                          setEditingDept(
                                            editingDept
                                              ? {
                                                  ...editingDept,
                                                  description: { ...(editingDept.description as any), en: e.target.value },
                                                }
                                              : null
                                          )
                                        }
                                        placeholder="Description (English)"
                                      />
                                      <span className="text-xs text-gray-500 mt-1 block">English</span>
                                    </div>
                                    <div>
                                      <Input
                                        id={`edit-desc-ar-${dept._id}`}
                                        value={(currentDept.description as any)?.ar || ''}
                                        onChange={(e) =>
                                          setEditingDept(
                                            editingDept
                                              ? {
                                                  ...editingDept,
                                                  description: { ...(editingDept.description as any), ar: e.target.value },
                                                }
                                              : null
                                          )
                                        }
                                        placeholder="الوصف (عربي)"
                                        className="text-right"
                                      />
                                      <span className="text-xs text-gray-500 mt-1 block text-right">العربية</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-3">
                                      <input
                                        id={`edit-isActive-${dept._id}`}
                                        type="checkbox"
                                        checked={!!editingDept?.isActive}
                                        onChange={(e) =>
                                          setEditingDept(
                                            editingDept
                                              ? { ...editingDept, isActive: e.target.checked }
                                              : null
                                          )
                                        }
                                        className="w-4 h-4 text-brand-500"
                                      />
                                      <Label htmlFor={`edit-isActive-${dept._id}`} className="!mb-0">
                                        Active
                                      </Label>
                                    </div>
                                  <button
                                    onClick={handleSaveDepartment}
                                    disabled={isSavingDept}
                                    className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <CheckCircleIcon className="size-4" />
                                    {isSavingDept ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                  >
                                    <CloseIcon className="size-4" />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                                    {toPlainString((dept as any).name)}
                                  </span>
                                  {dept.isActive === false ? (
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
                                      Inactive
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                  {dept.managerId && (
                                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                      Manager:{" "}
                                      {typeof dept.managerId === "object"
                                        ? dept.managerId.fullName
                                        : dept.managerId}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => handleEditDepartment(dept)}
                                    className="rounded p-1 text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                                    title="Edit department"
                                  >
                                    <PencilIcon className="size-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteDepartment(dept._id)
                                    }
                                    disabled={isDeletingDept === dept._id}
                                    className="rounded p-1 text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={isDeletingDept === dept._id ? "Deleting..." : "Delete department"}
                                  >
                                    <TrashBinIcon className="size-4" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {toPlainString((dept as any).description) || "No description provided"}
                              </p>
                              <div className="flex items-center justify-between">
                                
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {departments.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center dark:border-gray-700">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No departments yet. Add your first department above.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ComponentCard>
        </div>
      )}
    </div>
  );
}
