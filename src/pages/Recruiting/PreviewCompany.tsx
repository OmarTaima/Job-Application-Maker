import type { ChangeEvent, FormEvent } from "react";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
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
import {
  companiesService,
  ApiError as CompaniesApiError,
} from "../../services/companiesService";
import {
  departmentsService,
  ApiError as DepartmentsApiError,
} from "../../services/departmentsService";
import type { Department } from "../../services/departmentsService";

type CompanyForm = {
  name: string;
  address?: string;
  industry?: string;
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

  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    name: "",
    address: "",
    industry: "",
    contactEmail: "",
    phone: "",
  });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentForm, setDepartmentForm] = useState<DepartmentForm>({
    companyId: companyId || "",
    name: "",
    description: "",
    managerId: "",
    location: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyStatus, setCompanyStatus] = useState("");
  const [departmentStatus, setDepartmentStatus] = useState("");
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  useEffect(() => {
    if (companyId) {
      loadCompanyData();
      loadDepartments();
    }
  }, [companyId]);

  const loadCompanyData = async () => {
    try {
      setLoading(true);
      const data = await companiesService.getCompanyById(companyId!);
      setCompanyForm({
        name: data.name,
        address: data.address || "",
        industry: data.industry || "",
        contactEmail: data.contactEmail || "",
        phone: data.phone || "",
      });
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof CompaniesApiError
          ? err.message
          : "Failed to load company";
      setError(errorMessage);
      console.error("Error loading company:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const data = await departmentsService.getAllDepartments(companyId);
      setDepartments(data);
    } catch (err) {
      console.error("Error loading departments:", err);
    }
  };

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
    try {
      await companiesService.updateCompany(companyId!, companyForm);
      await loadCompanyData();
      setCompanyStatus("Company updated successfully");
      setIsEditingCompany(false);
      setTimeout(() => setCompanyStatus(""), 2500);
    } catch (err) {
      const errorMessage =
        err instanceof CompaniesApiError
          ? err.message
          : "Failed to update company";
      setError(errorMessage);
    }
  };

  const handleDepartmentSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await departmentsService.createDepartment(departmentForm);
      await loadDepartments();
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
      const errorMessage =
        err instanceof DepartmentsApiError
          ? err.message
          : "Failed to create department";
      setError(errorMessage);
    }
  };

  const handleDeleteDepartment = async (deptId: string) => {
    if (!confirm("Are you sure you want to delete this department?")) return;
    try {
      await departmentsService.deleteDepartment(deptId);
      await loadDepartments();
    } catch (err) {
      const errorMessage =
        err instanceof DepartmentsApiError
          ? err.message
          : "Failed to delete department";
      setError(errorMessage);
    }
  };

  const handleEditDepartment = (dept: Department) => {
    setEditingDeptId(dept._id);
    setEditingDept({ ...dept });
  };

  const handleSaveDepartment = async () => {
    if (editingDept) {
      try {
        await departmentsService.updateDepartment(editingDept._id, {
          name: editingDept.name,
          description: editingDept.description,
          managerId:
            typeof editingDept.managerId === "string"
              ? editingDept.managerId
              : editingDept.managerId?._id,
          location: editingDept.location,
        });
        await loadDepartments();
        setEditingDeptId(null);
        setEditingDept(null);
      } catch (err) {
        const errorMessage =
          err instanceof DepartmentsApiError
            ? err.message
            : "Failed to update department";
        setError(errorMessage);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingDeptId(null);
    setEditingDept(null);
  };

  return (
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
          {error}
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
                  onClick={() => setIsEditingCompany(!isEditingCompany)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <PencilIcon className="size-4" />
                  {isEditingCompany ? "Cancel" : "Edit"}
                </button>
              </div>

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
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    name="industry"
                    value={companyForm.industry}
                    onChange={handleCompanyChange}
                    placeholder="Technology, Finance, etc."
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
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  >
                    <PlusIcon className="size-4" />
                    Add Department
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
                                    className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
                                  >
                                    <CheckCircleIcon className="size-4" />
                                    Save
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
                                    className="rounded p-1 text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                                    title="Delete department"
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
