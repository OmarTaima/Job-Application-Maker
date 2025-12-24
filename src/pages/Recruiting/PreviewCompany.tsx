import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import TextArea from "../../components/form/input/TextArea";
import Switch from "../../components/form/switch/Switch";
import {
  CheckCircleIcon,
  PlusIcon,
  TrashBinIcon,
  PencilIcon,
  CloseIcon,
} from "../../icons";

type CompanyForm = {
  name: string;
  description: string;
  contactEmail: string;
  phone: string;
  address: string;
  website: string;
};

type DepartmentForm = {
  companyId: string;
  name: string;
  description: string;
  managerId: string;
  isActive: boolean;
};

type Department = DepartmentForm & {
  id: string;
};

export default function PreviewCompany() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();

  // Mock data - would fetch from API based on companyId
  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    name: "Tech Solutions Inc.",
    description: "A technology solutions company",
    contactEmail: "contact@techsolutions.com",
    phone: "+1-555-0123",
    address: "123 Tech Street, Silicon Valley, CA",
    website: "https://techsolutions.com",
  });

  const [departments, setDepartments] = useState<Department[]>([
    {
      id: "DEPT-001",
      companyId: companyId || "",
      name: "Software Development",
      description: "Software engineering and development department",
      managerId: "MGR-123456",
      isActive: true,
    },
    {
      id: "DEPT-002",
      companyId: companyId || "",
      name: "Human Resources",
      description: "HR and talent management",
      managerId: "MGR-789012",
      isActive: true,
    },
  ]);

  const [departmentForm, setDepartmentForm] = useState<DepartmentForm>({
    companyId: companyId || "",
    name: "",
    description: "",
    managerId: "",
    isActive: true,
  });

  const [companyStatus, setCompanyStatus] = useState("");
  const [departmentStatus, setDepartmentStatus] = useState("");
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

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

  const handleCompanySubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCompanyStatus("Company updated successfully");
    setIsEditingCompany(false);
    setTimeout(() => setCompanyStatus(""), 2500);
  };

  const handleDepartmentSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const generatedDeptId = `DEPT-${Date.now().toString().slice(-6)}`;
    const generatedManagerId = `MGR-${Date.now().toString().slice(-6)}`;
    const newDept: Department = {
      ...departmentForm,
      id: generatedDeptId,
      companyId: companyId || "",
      managerId: generatedManagerId,
    };
    setDepartments((prev) => [...prev, newDept]);
    setDepartmentStatus("Department created successfully");
    setDepartmentForm({
      companyId: companyId || "",
      name: "",
      description: "",
      managerId: "",
      isActive: true,
    });
    setTimeout(() => setDepartmentStatus(""), 2500);
  };

  const handleDeleteDepartment = (deptId: string) => {
    setDepartments((prev) => prev.filter((dept) => dept.id !== deptId));
  };

  const handleEditDepartment = (dept: Department) => {
    setEditingDeptId(dept.id);
    setEditingDept({ ...dept });
  };

  const handleSaveDepartment = () => {
    if (editingDept) {
      setDepartments((prev) =>
        prev.map((dept) => (dept.id === editingDept.id ? editingDept : dept))
      );
      setEditingDeptId(null);
      setEditingDept(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingDeptId(null);
    setEditingDept(null);
  };

  const handleToggleActive = (deptId: string, isActive: boolean) => {
    setDepartments((prev) =>
      prev.map((dept) => (dept.id === deptId ? { ...dept, isActive } : dept))
    );
  };

  return (
    <div className="space-y-6">
      <PageMeta
        title={`${companyForm.name} | Company Preview`}
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

      <PageBreadcrumb pageTitle={companyForm.name} />

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
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  name="website"
                  value={companyForm.website}
                  onChange={handleCompanyChange}
                  placeholder="https://"
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
              <Label htmlFor="description">Description</Label>
              <TextArea
                placeholder="What does this company do?"
                rows={3}
                value={companyForm.description}
                onChange={(value) =>
                  setCompanyForm((prev) => ({ ...prev, description: value }))
                }
                disabled={!isEditingCompany}
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
                  const isEditing = editingDeptId === dept.id;
                  const currentDept =
                    isEditing && editingDept ? editingDept : dept;

                  return (
                    <div
                      key={dept.id}
                      className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
                    >
                      <div className="flex-1 space-y-3">
                        {isEditing ? (
                          <>
                            <div className="space-y-3">
                              <div>
                                <Label htmlFor={`edit-name-${dept.id}`}>
                                  Department name
                                </Label>
                                <Input
                                  id={`edit-name-${dept.id}`}
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
                                <Label htmlFor={`edit-desc-${dept.id}`}>
                                  Description
                                </Label>
                                <Input
                                  id={`edit-desc-${dept.id}`}
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
                              <div>
                                <Switch
                                  label="Active Status"
                                  defaultChecked={currentDept.isActive}
                                  onChange={(checked) =>
                                    setEditingDept(
                                      editingDept
                                        ? { ...editingDept, isActive: checked }
                                        : null
                                    )
                                  }
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
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    dept.isActive
                                      ? "bg-success-50 text-success-600 ring-1 ring-inset ring-success-200 dark:bg-success-500/10 dark:text-success-200 dark:ring-success-400/40"
                                      : "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700"
                                  }`}
                                >
                                  {dept.isActive ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                  {dept.managerId}
                                </span>
                                <button
                                  onClick={() => handleEditDepartment(dept)}
                                  className="rounded p-1 text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                                  title="Edit department"
                                >
                                  <PencilIcon className="size-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteDepartment(dept.id)
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
                                {dept.id}
                              </p>
                              <Switch
                                label=""
                                defaultChecked={dept.isActive}
                                onChange={(checked) =>
                                  handleToggleActive(dept.id, checked)
                                }
                              />
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
    </div>
  );
}
