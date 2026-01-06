import { useMemo, useState, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { useNavigate, useSearchParams } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import TextArea from "../../components/form/input/TextArea";
import Switch from "../../components/form/switch/Switch";
import Select from "../../components/form/Select";
import { PlusIcon, TrashBinIcon, CheckCircleIcon } from "../../icons";
import { useAuth } from "../../context/AuthContext";
import { jobPositionsService } from "../../services/jobPositionsService";
import { companiesService } from "../../services/companiesService";
import { departmentsService } from "../../services/departmentsService";

type JobSpec = {
  spec: string;
  weight: number;
};

type SubField = {
  fieldId: string;
  label: string;
  inputType:
    | "text"
    | "number"
    | "email"
    | "date"
    | "checkbox"
    | "radio"
    | "dropdown"
    | "textarea"
    | "url"
    | "tags";
  isRequired: boolean;
  choices?: string[];
};

type CustomField = {
  fieldId: string;
  label: string;
  inputType:
    | "text"
    | "number"
    | "email"
    | "date"
    | "checkbox"
    | "radio"
    | "select"
    | "textarea"
    | "url"
    | "tags"
    | "groupField";
  isRequired: boolean;
  minValue?: number;
  maxValue?: number;
  choices?: string[];
  subFields?: SubField[];
  displayOrder: number;
};

type JobForm = {
  companyId: string;
  departmentId: string;
  jobCode: string;
  title: string;
  description: string;
  salary: number;
  salaryVisible: boolean;
  openPositions: number;
  registrationStart: string;
  registrationEnd: string;
  termsAndConditions: string[];
  jobSpecs: JobSpec[];
  customFields: CustomField[];
};

const inputTypeOptions = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "date", label: "Date" },
  { value: "url", label: "URL" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio" },
  { value: "dropdown", label: "Dropdown" },
  { value: "select", label: "Select" },
  { value: "textarea", label: "Textarea" },
  { value: "Tags", label: "Tags (Multiple Values)" },
  { value: "groupField", label: "Group Field (Multiple Questions)" },
];

const subFieldTypeOptions = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "date", label: "Date" },
  { value: "radio", label: "Radio" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "url", label: "URL" },
  { value: "Tags", label: "Tags" },
];

export default function CreateJob() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editJobId = searchParams.get("id");
  const { user } = useAuth();
  // Handle different admin role formats - roleId can be an object with name property
  const userRole = user?.role ? String(user.role).toLowerCase() : undefined;

  const isAdmin =
    userRole === "admin" ||
    userRole === "super_admin" ||
    userRole === "superadmin" ||
    ((user as any)?.roleId &&
      typeof (user as any).roleId === "object" &&
      (String((user as any).roleId.name).toLowerCase() === "admin" ||
        String((user as any).roleId.name).toLowerCase() === "super_admin" ||
        String((user as any).roleId.name).toLowerCase() === "superadmin" ||
        String((user as any).roleId.name) === "Admin" ||
        String((user as any).roleId.name) === "Super Admin"));

  const [companies, setCompanies] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [departments, setDepartments] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCompanies = async () => {
    try {
      setIsLoading(true);

      let companyOptions;

      if (isAdmin) {
        // Admin: fetch all companies from API
        const data = await companiesService.getAllCompanies();
        companyOptions = data.map((company) => ({
          value: company._id,
          label: company.name,
        }));
      } else {
        // Non-admin: build options from user's assigned companies
        companyOptions =
          user?.companies?.map((c) => ({
            value:
              typeof c.companyId === "string" ? c.companyId : c.companyId._id,
            label:
              typeof c.companyId === "string" ? c.companyId : c.companyId.name,
          })) || [];
      }

      setCompanies(companyOptions);
    } catch (err) {
      console.error("Failed to load companies:", err);
      const errorMsg = getErrorMessage(err);
      setFormError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDepartments = async (companyId: string) => {
    try {
      if (isAdmin) {
        // Admin: fetch departments from API
        const data = await departmentsService.getAllDepartments(companyId);
        const departmentOptions = data.map((dept) => ({
          value: dept._id,
          label: dept.name,
        }));
        setDepartments(departmentOptions);
      } else {
        // Non-admin: get departments from user's assigned company
        console.log("🔍 All user companies:", user?.companies);
        console.log("🔍 Looking for companyId:", companyId);

        const userCompany = user?.companies?.find((c) => {
          const id =
            typeof c.companyId === "string" ? c.companyId : c.companyId._id;
          console.log("🔍 Checking company:", id, "against", companyId);
          return id === companyId;
        });

        console.log("🔍 Found userCompany:", userCompany);
        console.log("🔍 userCompany departments:", userCompany?.departments);

        const departmentOptions =
          userCompany?.departments?.map((dept) => ({
            value: typeof dept === "string" ? dept : dept._id,
            label: typeof dept === "string" ? dept : dept.name || dept._id,
          })) || [];

        console.log("🔍 Final department options:", departmentOptions);
        setDepartments(departmentOptions);
      }
    } catch (err) {
      console.error("Failed to load departments:", err);
      const errorMsg = getErrorMessage(err);
      setFormError(errorMsg);
    }
  };

  const [jobForm, setJobForm] = useState<JobForm>({
    companyId: "",
    departmentId: "",
    jobCode: "",
    title: "",
    description: "",
    salary: 0,
    salaryVisible: true,
    openPositions: 1,
    registrationStart: "",
    registrationEnd: "",
    termsAndConditions: [""],
    jobSpecs: [{ spec: "", weight: 0 }],
    customFields: [],
  });

  const [newTerm, setNewTerm] = useState("");
  const [newChoice, setNewChoice] = useState("");
  const [newSubFieldChoice, setNewSubFieldChoice] = useState("");
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(
    null
  );
  const [jobStatus, setJobStatus] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [formError, setFormError] = useState("");

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
    if (err.response?.data?.message) return err.response.data.message;
    if (err.message) return err.message;
    return "An unexpected error occurred";
  };
  const companyAutoSet = useRef(false);
  const companiesLoaded = useRef(false);
  const jobDataLoaded = useRef(false);

  useEffect(() => {
    // Only load companies once when user is available
    if (user && !companiesLoaded.current) {
      loadCompanies();
      companiesLoaded.current = true;
    }
  }, [user]);

  // Load existing job data when in edit mode
  useEffect(() => {
    const loadJobData = async () => {
      if (editJobId && !jobDataLoaded.current && companies.length > 0) {
        try {
          setIsLoading(true);
          setIsEditMode(true);
          const job = await jobPositionsService.getJobPositionById(editJobId);

          // Normalize company and department IDs
          const companyId =
            typeof job.companyId === "string"
              ? job.companyId
              : (job.companyId as any)?._id;
          const departmentId =
            typeof job.departmentId === "string"
              ? job.departmentId
              : (job.departmentId as any)?._id;

          // Format dates for input fields
          const formatDateForInput = (dateString?: string) => {
            if (!dateString) return "";
            const date = new Date(dateString);
            return date.toISOString().split("T")[0];
          };

          setJobForm({
            companyId: companyId || "",
            departmentId: departmentId || "",
            jobCode: job.jobCode || "",
            title: job.title || "",
            description: job.description || "",
            salary: job.salary?.min || 0,
            salaryVisible: job.salaryVisible ?? true,
            openPositions: job.openPositions || 1,
            registrationStart: formatDateForInput(job.registrationStart),
            registrationEnd: formatDateForInput(job.registrationEnd),
            termsAndConditions:
              job.termsAndConditions && job.termsAndConditions.length > 0
                ? job.termsAndConditions
                : job.requirements && job.requirements.length > 0
                ? job.requirements
                : [""],
            jobSpecs:
              job.jobSpecs && job.jobSpecs.length > 0
                ? job.jobSpecs
                : [{ spec: "", weight: 0 }],
            customFields: Array.isArray(job.customFields)
              ? (job.customFields as CustomField[])
              : [],
          });

          jobDataLoaded.current = true;
        } catch (err) {
          console.error("Failed to load job data:", err);
          const errorMsg = getErrorMessage(err);
          setFormError(errorMsg);
          setJobStatus(`Error: ${errorMsg}`);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadJobData();
  }, [editJobId, companies]);

  // Auto-select company for non-admin users
  useEffect(() => {
    if (
      user &&
      !isAdmin &&
      companies.length > 0 &&
      !companyAutoSet.current &&
      !editJobId
    ) {
      // Extract the first company ID from user.companies array
      const firstCompany = (user as any)?.companies?.[0];
      const userCompanyId =
        typeof firstCompany?.companyId === "string"
          ? firstCompany.companyId
          : firstCompany?.companyId?._id;

      if (userCompanyId) {
        setJobForm((prev) => ({ ...prev, companyId: userCompanyId }));
        companyAutoSet.current = true;
      }
    }
  }, [user, isAdmin, companies, editJobId]);

  useEffect(() => {
    if (jobForm.companyId) {
      loadDepartments(jobForm.companyId);
    } else {
      setDepartments([]);
    }
  }, [jobForm.companyId, user, isAdmin]);

  const handleInputChange = (field: keyof JobForm, value: any) => {
    setJobForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddTerm = () => {
    if (newTerm.trim()) {
      setJobForm((prev) => ({
        ...prev,
        termsAndConditions: [...prev.termsAndConditions, newTerm],
      }));
      setNewTerm("");
    }
  };

  const handleRemoveTerm = (index: number) => {
    setJobForm((prev) => ({
      ...prev,
      termsAndConditions: prev.termsAndConditions.filter((_, i) => i !== index),
    }));
  };

  const handleAddJobSpec = () => {
    setJobForm((prev) => ({
      ...prev,
      jobSpecs: [...prev.jobSpecs, { spec: "", weight: 0 }],
    }));
  };

  const handleRemoveJobSpec = (index: number) => {
    setJobForm((prev) => ({
      ...prev,
      jobSpecs: prev.jobSpecs.filter((_, i) => i !== index),
    }));
  };

  const handleJobSpecChange = (
    index: number,
    field: keyof JobSpec,
    value: any
  ) => {
    setJobForm((prev) => ({
      ...prev,
      jobSpecs: prev.jobSpecs.map((spec, i) =>
        i === index ? { ...spec, [field]: value } : spec
      ),
    }));
  };

  const handleAddCustomField = () => {
    const newField: CustomField = {
      fieldId: `field_${Date.now()}`,
      label: "",
      inputType: "text",
      isRequired: false,
      displayOrder: jobForm.customFields.length + 1,
    };
    setJobForm((prev) => ({
      ...prev,
      customFields: [...prev.customFields, newField],
    }));
    setEditingFieldIndex(jobForm.customFields.length);
  };

  const handleRemoveCustomField = (index: number) => {
    setJobForm((prev) => ({
      ...prev,
      customFields: prev.customFields.filter((_, i) => i !== index),
    }));
    if (editingFieldIndex === index) {
      setEditingFieldIndex(null);
    }
  };

  const handleCustomFieldChange = (
    index: number,
    field: keyof CustomField,
    value: any
  ) => {
    setJobForm((prev) => ({
      ...prev,
      customFields: prev.customFields.map((cf, i) =>
        i === index ? { ...cf, [field]: value } : cf
      ),
    }));
  };

  const handleAddChoice = (fieldIndex: number) => {
    if (newChoice.trim()) {
      setJobForm((prev) => ({
        ...prev,
        customFields: prev.customFields.map((cf, i) =>
          i === fieldIndex
            ? { ...cf, choices: [...(cf.choices || []), newChoice] }
            : cf
        ),
      }));
      setNewChoice("");
    }
  };

  const handleRemoveChoice = (fieldIndex: number, choiceIndex: number) => {
    setJobForm((prev) => ({
      ...prev,
      customFields: prev.customFields.map((cf, i) =>
        i === fieldIndex
          ? {
              ...cf,
              choices: cf.choices?.filter((_, ci) => ci !== choiceIndex),
            }
          : cf
      ),
    }));
  };

  // Sub-field handlers
  const handleAddSubField = (fieldIndex: number) => {
    const newSubField: SubField = {
      fieldId: `subfield_${Date.now()}`,
      label: "",
      inputType: "text",
      isRequired: false,
    };
    setJobForm((prev) => ({
      ...prev,
      customFields: prev.customFields.map((cf, i) =>
        i === fieldIndex
          ? { ...cf, subFields: [...(cf.subFields || []), newSubField] }
          : cf
      ),
    }));
  };

  const handleRemoveSubField = (fieldIndex: number, subFieldIndex: number) => {
    setJobForm((prev) => ({
      ...prev,
      customFields: prev.customFields.map((cf, i) =>
        i === fieldIndex
          ? {
              ...cf,
              subFields: cf.subFields?.filter((_, si) => si !== subFieldIndex),
            }
          : cf
      ),
    }));
  };

  const handleSubFieldChange = (
    fieldIndex: number,
    subFieldIndex: number,
    field: keyof SubField,
    value: any
  ) => {
    setJobForm((prev) => ({
      ...prev,
      customFields: prev.customFields.map((cf, i) =>
        i === fieldIndex
          ? {
              ...cf,
              subFields: cf.subFields?.map((sf, si) =>
                si === subFieldIndex ? { ...sf, [field]: value } : sf
              ),
            }
          : cf
      ),
    }));
  };

  const handleAddSubFieldChoice = (
    fieldIndex: number,
    subFieldIndex: number
  ) => {
    if (newSubFieldChoice.trim()) {
      setJobForm((prev) => ({
        ...prev,
        customFields: prev.customFields.map((cf, i) =>
          i === fieldIndex
            ? {
                ...cf,
                subFields: cf.subFields?.map((sf, si) =>
                  si === subFieldIndex
                    ? {
                        ...sf,
                        choices: [...(sf.choices || []), newSubFieldChoice],
                      }
                    : sf
                ),
              }
            : cf
        ),
      }));
      setNewSubFieldChoice("");
    }
  };

  const handleRemoveSubFieldChoice = (
    fieldIndex: number,
    subFieldIndex: number,
    choiceIndex: number
  ) => {
    setJobForm((prev) => ({
      ...prev,
      customFields: prev.customFields.map((cf, i) =>
        i === fieldIndex
          ? {
              ...cf,
              subFields: cf.subFields?.map((sf, si) =>
                si === subFieldIndex
                  ? {
                      ...sf,
                      choices: sf.choices?.filter(
                        (_, ci) => ci !== choiceIndex
                      ),
                    }
                  : sf
              ),
            }
          : cf
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const salaryValue = Number(jobForm.salary);
      const salaryObj = salaryValue > 0 ? { min: salaryValue } : undefined;

      const payload = {
        title: jobForm.title,
        description: jobForm.description,
        companyId: jobForm.companyId,
        departmentId: jobForm.departmentId,
        jobCode: jobForm.jobCode,
        requirements: jobForm.termsAndConditions.filter((term) => term.trim()),
        salary: salaryObj,
        salaryVisible: jobForm.salaryVisible,
        openPositions: jobForm.openPositions,
        registrationStart: jobForm.registrationStart,
        registrationEnd: jobForm.registrationEnd,
        jobSpecs: jobForm.jobSpecs.filter((spec) => spec.spec.trim()),
        customFields: jobForm.customFields,
        status: "open" as const,
        employmentType: "Full-time",
      };

      if (isEditMode && editJobId) {
        // Update existing job
        await jobPositionsService.updateJobPosition(editJobId, payload);
        setJobStatus("Job updated successfully");
      } else {
        // Create new job
        await jobPositionsService.createJobPosition(payload);
        setJobStatus("Job created successfully");
      }

      await Swal.fire({
        title: "Success!",
        text: isEditMode
          ? "Job updated successfully."
          : "Job created successfully.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

      setTimeout(() => {
        setJobStatus("");
        navigate("/jobs");
      }, 1500);
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setFormError(errorMsg);
      setJobStatus(`Error: ${errorMsg}`);
      console.error(`Error ${isEditMode ? "updating" : "creating"} job:`, err);
    }
  };

  const jobPayload = useMemo(() => jobForm, [jobForm]);

  const totalWeight = jobForm.jobSpecs.reduce(
    (sum, spec) => sum + spec.weight,
    0
  );

  return (
    <div className="space-y-6">
      <PageMeta
        title={`${isEditMode ? "Edit" : "Create"} Job | TailAdmin React`}
        description={`${
          isEditMode ? "Edit an existing" : "Create a new"
        } job posting for your company`}
      />

      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/jobs")}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
        >
          <svg
            className="size-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Jobs
        </button>
      </div>

      <PageBreadcrumb pageTitle={isEditMode ? "Edit Job" : "Create Job"} />

      {isLoading ? (
        <LoadingSpinner
          fullPage
          message={isEditMode ? "Loading job data..." : "Loading form..."}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start justify-between">
                <p className="text-sm text-red-600 dark:text-red-400">
                  <strong>Error:</strong> {formError}
                </p>
                <button
                  type="button"
                  onClick={() => setFormError("")}
                  className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          {/* Company & Department Selection */}
          <ComponentCard
            title="Company & Department"
            desc="Select the company and department"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="companyId">Company</Label>
                {companies.length > 0 ? (
                  !isAdmin && companies.length === 1 ? (
                    <Input
                      id="companyId"
                      value={companies[0].label}
                      disabled={true}
                      className="bg-gray-50 dark:bg-gray-800"
                    />
                  ) : (
                    <Select
                      options={companies}
                      placeholder="Select company"
                      value={jobForm.companyId}
                      onChange={(value) => {
                        handleInputChange("companyId", value);
                        handleInputChange("departmentId", ""); // Reset department when company changes
                      }}
                    />
                  )
                ) : (
                  <Input
                    id="companyId"
                    value="No company assigned"
                    disabled={true}
                    className="bg-gray-50 dark:bg-gray-800"
                  />
                )}
              </div>
              <div>
                <Label htmlFor="departmentId">Department</Label>
                <Select
                  options={departments}
                  value={jobForm.departmentId}
                  placeholder={
                    jobForm.companyId
                      ? "Select department"
                      : "Select company first"
                  }
                  onChange={(value) => handleInputChange("departmentId", value)}
                />
              </div>
            </div>
          </ComponentCard>

          {/* Basic Job Information */}
          <ComponentCard title="Basic Information" desc="Enter the job details">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="jobCode">Job Code</Label>
                  <Input
                    id="jobCode"
                    value={jobForm.jobCode}
                    onChange={(e) =>
                      handleInputChange("jobCode", e.target.value)
                    }
                    placeholder="DEV-FE-001"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="title">Job Title</Label>
                  <Input
                    id="title"
                    value={jobForm.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="Senior Frontend Developer"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <TextArea
                  value={jobForm.description}
                  onChange={(value) => handleInputChange("description", value)}
                  placeholder="We are looking for a skilled developer..."
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="salary">Salary</Label>
                  <Input
                    id="salary"
                    type="number"
                    value={jobForm.salary}
                    onChange={(e) =>
                      handleInputChange("salary", Number(e.target.value))
                    }
                    placeholder="85000"
                  />
                </div>
                <div>
                  <Label htmlFor="openPositions">Open Positions</Label>
                  <Input
                    id="openPositions"
                    type="number"
                    value={jobForm.openPositions}
                    onChange={(e) =>
                      handleInputChange("openPositions", Number(e.target.value))
                    }
                    placeholder="3"
                    min="1"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <Switch
                    label="Salary Visible"
                    defaultChecked={jobForm.salaryVisible}
                    onChange={(checked) =>
                      handleInputChange("salaryVisible", checked)
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="registrationStart">Registration Start</Label>
                  <Input
                    id="registrationStart"
                    type="date"
                    value={jobForm.registrationStart}
                    onChange={(e) =>
                      handleInputChange("registrationStart", e.target.value)
                    }
                    onClick={(e) => {
                      const input = e.currentTarget as HTMLInputElement;
                      if (input.showPicker) {
                        input.showPicker();
                      }
                    }}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="registrationEnd">Registration End</Label>
                  <Input
                    id="registrationEnd"
                    type="date"
                    value={jobForm.registrationEnd}
                    onChange={(e) =>
                      handleInputChange("registrationEnd", e.target.value)
                    }
                    onClick={(e) => {
                      const input = e.currentTarget as HTMLInputElement;
                      if (input.showPicker) {
                        input.showPicker();
                      }
                    }}
                    required
                  />
                </div>
              </div>
            </div>
          </ComponentCard>

          {/* Terms and Conditions */}
          <ComponentCard
            title="Terms and Conditions"
            desc="Add requirements and conditions for this job"
          >
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  placeholder="Add a term or condition"
                />
                <button
                  type="button"
                  onClick={handleAddTerm}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
                >
                  <PlusIcon className="size-4" />
                  Add
                </button>
              </div>

              <div className="space-y-2">
                {jobForm.termsAndConditions.map((term, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-800 dark:bg-gray-900/50"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {term}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTerm(index)}
                      className="rounded p-1 text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                    >
                      <TrashBinIcon className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </ComponentCard>

          {/* Job Specs */}
          <ComponentCard
            title="Job Specifications"
            desc="Define evaluation criteria and their weights"
          >
            <div className="space-y-4">
              {jobForm.jobSpecs.map((spec, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      value={spec.spec}
                      onChange={(e) =>
                        handleJobSpecChange(index, "spec", e.target.value)
                      }
                      placeholder="Specification name"
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      value={spec.weight}
                      onChange={(e) =>
                        handleJobSpecChange(
                          index,
                          "weight",
                          Number(e.target.value)
                        )
                      }
                      placeholder="Weight"
                      min="0"
                      max="100"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveJobSpec(index)}
                    className="rounded p-2 text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                  >
                    <TrashBinIcon className="size-4" />
                  </button>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleAddJobSpec}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <PlusIcon className="size-4" />
                  Add Specification
                </button>
                <span
                  className={`text-sm font-semibold ${
                    totalWeight === 100
                      ? "text-success-600 dark:text-success-400"
                      : "text-error-600 dark:text-error-400"
                  }`}
                >
                  Total Weight: {totalWeight}%{" "}
                  {totalWeight !== 100 && "(Should be 100%)"}
                </span>
              </div>
            </div>
          </ComponentCard>

          {/* Custom Fields */}
          <ComponentCard
            title="Custom Form Fields"
            desc="Define custom fields for the job application form"
          >
            <div className="mb-4 flex gap-3">
              <button
                type="button"
                onClick={handleAddCustomField}
                className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700"
              >
                <PlusIcon className="size-4" />
                Add Custom Field
              </button>
            </div>

            <div className="space-y-4">
              {jobForm.customFields.map((field, fieldIndex) => (
                <div
                  key={field.fieldId}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Field #{fieldIndex + 1}
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(fieldIndex)}
                        className="rounded p-1 text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                      >
                        <TrashBinIcon className="size-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <Label htmlFor={`field-id-${fieldIndex}`}>
                          Field ID
                        </Label>
                        <Input
                          id={`field-id-${fieldIndex}`}
                          value={field.fieldId}
                          onChange={(e) =>
                            handleCustomFieldChange(
                              fieldIndex,
                              "fieldId",
                              e.target.value
                            )
                          }
                          placeholder="field_name"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`field-label-${fieldIndex}`}>
                          Label
                        </Label>
                        <Input
                          id={`field-label-${fieldIndex}`}
                          value={field.label}
                          onChange={(e) =>
                            handleCustomFieldChange(
                              fieldIndex,
                              "label",
                              e.target.value
                            )
                          }
                          placeholder="Years of Experience"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <Label htmlFor={`field-type-${fieldIndex}`}>
                          Input Type
                        </Label>
                        <Select
                          options={inputTypeOptions}
                          value={field.inputType}
                          placeholder="Select type"
                          onChange={(value) =>
                            handleCustomFieldChange(
                              fieldIndex,
                              "inputType",
                              value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`field-order-${fieldIndex}`}>
                          Display Order
                        </Label>
                        <Input
                          id={`field-order-${fieldIndex}`}
                          type="number"
                          value={field.displayOrder}
                          onChange={(e) =>
                            handleCustomFieldChange(
                              fieldIndex,
                              "displayOrder",
                              Number(e.target.value)
                            )
                          }
                          min="1"
                        />
                      </div>
                      <div className="flex items-end pb-2">
                        <Switch
                          label="Required"
                          defaultChecked={field.isRequired}
                          onChange={(checked) =>
                            handleCustomFieldChange(
                              fieldIndex,
                              "isRequired",
                              checked
                            )
                          }
                        />
                      </div>
                    </div>

                    {field.inputType === "number" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`field-min-${fieldIndex}`}>
                            Min Value
                          </Label>
                          <Input
                            id={`field-min-${fieldIndex}`}
                            type="number"
                            value={field.minValue || ""}
                            onChange={(e) =>
                              handleCustomFieldChange(
                                fieldIndex,
                                "minValue",
                                Number(e.target.value)
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`field-max-${fieldIndex}`}>
                            Max Value
                          </Label>
                          <Input
                            id={`field-max-${fieldIndex}`}
                            type="number"
                            value={field.maxValue || ""}
                            onChange={(e) =>
                              handleCustomFieldChange(
                                fieldIndex,
                                "maxValue",
                                Number(e.target.value)
                              )
                            }
                          />
                        </div>
                      </div>
                    )}

                    {(field.inputType === "checkbox" ||
                      field.inputType === "radio" ||
                      field.inputType === "select" ||
                      field.inputType === "tags") && (
                      <div>
                        <Label>Choices</Label>
                        <div className="flex gap-2">
                          <Input
                            value={newChoice}
                            onChange={(e) => setNewChoice(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddChoice(fieldIndex);
                              }
                            }}
                            placeholder="Add a choice"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddChoice(fieldIndex)}
                            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
                          >
                            <PlusIcon className="size-4" />
                          </button>
                        </div>
                        <div className="mt-2 space-y-1">
                          {field.choices?.map((choice, choiceIndex) => (
                            <div
                              key={choiceIndex}
                              className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
                            >
                              <span className="text-gray-700 dark:text-gray-300">
                                {choice}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveChoice(fieldIndex, choiceIndex)
                                }
                                className="text-error-600 hover:text-error-700 dark:text-error-400"
                              >
                                <TrashBinIcon className="size-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Group Field Sub-Questions */}
                    {field.inputType === "groupField" && (
                      <div className="border-l-4 border-brand-500 pl-4">
                        <div className="mb-3 flex items-center justify-between">
                          <Label>Sub-Questions</Label>
                          <button
                            type="button"
                            onClick={() => handleAddSubField(fieldIndex)}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-200 dark:bg-brand-900/30 dark:text-brand-300"
                          >
                            <PlusIcon className="size-3" />
                            Add Sub-Question
                          </button>
                        </div>

                        <div className="space-y-4">
                          {field.subFields?.map((subField, subFieldIndex) => (
                            <div
                              key={subField.fieldId}
                              className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                            >
                              <div className="mb-3 flex items-center justify-between">
                                <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                  Sub-Question #{subFieldIndex + 1}
                                </h5>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveSubField(
                                      fieldIndex,
                                      subFieldIndex
                                    )
                                  }
                                  className="text-error-600 hover:text-error-700 dark:text-error-400"
                                >
                                  <TrashBinIcon className="size-4" />
                                </button>
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <Label
                                    htmlFor={`subfield-label-${subFieldIndex}`}
                                  >
                                    Label
                                  </Label>
                                  <Input
                                    id={`subfield-label-${subFieldIndex}`}
                                    value={subField.label}
                                    onChange={(e) =>
                                      handleSubFieldChange(
                                        fieldIndex,
                                        subFieldIndex,
                                        "label",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Enter question label"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label
                                      htmlFor={`subfield-type-${subFieldIndex}`}
                                    >
                                      Input Type
                                    </Label>
                                    <Select
                                      options={subFieldTypeOptions}
                                      value={subField.inputType}
                                      placeholder="Select type"
                                      onChange={(value) =>
                                        handleSubFieldChange(
                                          fieldIndex,
                                          subFieldIndex,
                                          "inputType",
                                          value
                                        )
                                      }
                                    />
                                  </div>

                                  <div className="flex items-end pb-2">
                                    <Switch
                                      label="Required"
                                      defaultChecked={subField.isRequired}
                                      onChange={(checked) =>
                                        handleSubFieldChange(
                                          fieldIndex,
                                          subFieldIndex,
                                          "isRequired",
                                          checked
                                        )
                                      }
                                    />
                                  </div>
                                </div>

                                {/* Sub-field choices for radio, checkbox, dropdown, tags */}
                                {(subField.inputType === "radio" ||
                                  subField.inputType === "checkbox" ||
                                  subField.inputType === "dropdown" ||
                                  subField.inputType === "tags") && (
                                  <div>
                                    <Label>Choices</Label>
                                    <div className="flex gap-2">
                                      <Input
                                        value={newSubFieldChoice}
                                        onChange={(e) =>
                                          setNewSubFieldChoice(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddSubFieldChoice(
                                              fieldIndex,
                                              subFieldIndex
                                            );
                                          }
                                        }}
                                        placeholder="Add a choice"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleAddSubFieldChoice(
                                            fieldIndex,
                                            subFieldIndex
                                          )
                                        }
                                        className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
                                      >
                                        <PlusIcon className="size-4" />
                                      </button>
                                    </div>
                                    <div className="mt-2 space-y-1">
                                      {subField.choices?.map(
                                        (choice, choiceIndex) => (
                                          <div
                                            key={choiceIndex}
                                            className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
                                          >
                                            <span className="text-gray-700 dark:text-gray-300">
                                              {choice}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleRemoveSubFieldChoice(
                                                  fieldIndex,
                                                  subFieldIndex,
                                                  choiceIndex
                                                )
                                              }
                                              className="text-error-600 hover:text-error-700 dark:text-error-400"
                                            >
                                              <TrashBinIcon className="size-3" />
                                            </button>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                          {(!field.subFields ||
                            field.subFields.length === 0) && (
                            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/30 dark:text-gray-400">
                              No sub-questions added yet. Click "Add
                              Sub-Question" to add questions to this group.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ComponentCard>

          {/* Submit and Preview */}
          <ComponentCard title="Review & Submit">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
                >
                  <CheckCircleIcon className="size-5" />
                  {isEditMode ? "Update Job" : "Create Job"}
                </button>
                {jobStatus && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-success-50 px-4 py-2 text-sm font-semibold text-success-600 ring-1 ring-inset ring-success-200 dark:bg-success-500/10 dark:text-success-200 dark:ring-success-400/40">
                    <CheckCircleIcon className="size-4" />
                    {jobStatus}
                  </span>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/60">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <span>Payload Preview</span>
                  <span>POST /api/jobs</span>
                </div>
                <pre className="max-h-96 overflow-auto text-xs leading-relaxed text-gray-800 dark:text-gray-200">
                  {JSON.stringify(jobPayload, null, 2)}
                </pre>
              </div>
            </div>
          </ComponentCard>
        </form>
      )}
    </div>
  );
}
