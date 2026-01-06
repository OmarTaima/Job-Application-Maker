import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import Swal from "sweetalert2";
import { useParams, useNavigate } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import TextArea from "../../components/form/input/TextArea";
import {
  CheckCircleIcon,
  PlusIcon,
  TrashBinIcon,
  PencilIcon,
  CloseIcon,
} from "../../icons";
import type { Department } from "../../services/departmentsService";
import { useAuth } from "../../context/AuthContext";
import {
  useCompany,
  useDepartments,
  useUpdateCompany,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from "../../hooks/queries";

type CompanyForm = {
  name: string;
  address?: string;
  contactEmail?: string;
  phone?: string;
};

type DepartmentForm = {
  name: string;
  description?: string;
  companyId: string;
  managerId?: string;
  location?: string;
};

export default function PreviewCompany() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

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
    name: company?.name || "",
    address: company?.address || "",
    contactEmail: company?.contactEmail || "",
    phone: company?.phone || "",
  });
  const [departmentForm, setDepartmentForm] = useState<DepartmentForm>({
    companyId: companyId || "",
    name: "",
    description: "",
    managerId: "",
    location: "",
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
  useState(() => {
    if (company) {
      setCompanyForm({
        name: company.name,
        address: company.address || "",
        contactEmail: company.contactEmail || "",
        phone: company.phone || "",
      });
    }
  });

  const handleCompanyChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setCompanyForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDepartmentChange = (
    field: keyof DepartmentForm,
    value: string
  ) => {
    setDepartmentForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCompanySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCompanyError("");

    // Validation
    if (!companyForm.name?.trim()) {
      setCompanyError("Company name is required");
      return;
    }

    try {
      await updateCompanyMutation.mutateAsync({
        id: companyId!,
        data: companyForm,
      });

      await Swal.fire({
        title: "Success!",
        text: "Company updated successfully.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
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
    if (!departmentForm.name?.trim()) {
      setDepartmentError("Department name is required");
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
        timer: 2000,
        showConfirmButton: false,
      });

      setDepartmentStatus("Department created successfully");
      setDepartmentForm({
        companyId: companyId || "",
        name: "",
        description: "",
        managerId: "",
        location: "",
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
        timer: 2000,
        showConfirmButton: false,
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
    setEditingDept({ ...dept });
  };

  const handleSaveDepartment = async () => {
    if (editingDept) {
      setDepartmentError("");

      // Validation
      if (!editingDept.name?.trim()) {
        setDepartmentError("Department name is required");
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
            location: editingDept.location,
          },
        });
        setEditingDeptId(null);
        setEditingDept(null);
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
        title={`${companyForm.name || "Company"} | Company Preview`}
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

      <PageBreadcrumb pageTitle={companyForm.name || "Company"} />

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
          <ComponentCard
            title="Company Information"
            desc="View and edit company details"
          >
            <form className="space-y-4" onSubmit={handleCompanySubmit}>
              <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/50">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Company ID
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                    {companyId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingCompany(!isEditingCompany);
                    setCompanyError("");
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <PencilIcon className="size-4" />
                  {isEditingCompany ? "Cancel" : "Edit"}
                </button>
              </div>

              {companyError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    <strong>Error:</strong> {companyError}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Company name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={companyForm.name}
                    onChange={handleCompanyChange}
                    placeholder="Company name"
                    disabled={!isEditingCompany}
                  />
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
                    disabled={!isEditingCompany}
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
                  disabled={!isEditingCompany}
                />
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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="departmentName">Department name</Label>
                    <Input
                      id="departmentName"
                      name="name"
                      value={departmentForm.name}
                      onChange={(e) =>
                        handleDepartmentChange("name", e.target.value)
                      }
                      placeholder="Engineering"
                    />
                  </div>
                  <div>
                    <Label htmlFor="departmentLocation">Location</Label>
                    <Input
                      id="departmentLocation"
                      name="location"
                      value={departmentForm.location}
                      onChange={(e) =>
                        handleDepartmentChange("location", e.target.value)
                      }
                      placeholder="Building A, Floor 3"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="departmentDescription">Description</Label>
                  <Input
                    id="departmentDescription"
                    name="description"
                    value={departmentForm.description}
                    onChange={(e) =>
                      handleDepartmentChange("description", e.target.value)
                    }
                    placeholder="What this team does"
                  />
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
                                <div>
                                  <Label htmlFor={`edit-name-${dept._id}`}>
                                    Department name
                                  </Label>
                                  <Input
                                    id={`edit-name-${dept._id}`}
                                    value={currentDept.name}
                                    onChange={(e) =>
                                      setEditingDept(
                                        editingDept
                                          ? {
                                              ...editingDept,
                                              name: e.target.value,
                                            }
                                          : null
                                      )
                                    }
                                    placeholder="Department name"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`edit-location-${dept._id}`}>
                                    Location
                                  </Label>
                                  <Input
                                    id={`edit-location-${dept._id}`}
                                    value={currentDept.location}
                                    onChange={(e) =>
                                      setEditingDept(
                                        editingDept
                                          ? {
                                              ...editingDept,
                                              location: e.target.value,
                                            }
                                          : null
                                      )
                                    }
                                    placeholder="Building A, Floor 3"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`edit-desc-${dept._id}`}>
                                    Description
                                  </Label>
                                  <Input
                                    id={`edit-desc-${dept._id}`}
                                    value={currentDept.description}
                                    onChange={(e) =>
                                      setEditingDept(
                                        editingDept
                                          ? {
                                              ...editingDept,
                                              description: e.target.value,
                                            }
                                          : null
                                      )
                                    }
                                    placeholder="Description"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
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
                                    {dept.name}
                                  </span>
                                  {dept.location && (
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700">
                                      {dept.location}
                                    </span>
                                  )}
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
                                {dept.description || "No description provided"}
                              </p>
                              <div className="flex items-center justify-between">
                                <p className="font-mono text-xs uppercase tracking-wide text-gray-400">
                                  ID: {dept._id.slice(-8)}
                                </p>
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
