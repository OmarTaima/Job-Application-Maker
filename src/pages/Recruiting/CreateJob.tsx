import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import TextArea from "../../components/form/input/TextArea";
import Switch from "../../components/form/switch/Switch";
import Select from "../../components/form/Select";
import { PlusIcon, TrashBinIcon, CheckCircleIcon } from "../../icons";
import { useAuth } from "../../context/AuthContext";
import { Modal } from "../../components/ui/modal";
import {
  jobPositionsService,
  ApiError,
} from "../../services/jobPositionsService";
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
  const { user, canAccessCompany } = useAuth();

  const [companies, setCompanies] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [departments, setDepartments] = useState<
    Array<{ value: string; label: string }>
  >([]);

  const loadCompanies = async () => {
    try {
      const data = await companiesService.getAllCompanies();
      const companyOptions = data.map((company) => ({
        value: company._id,
        label: company.name,
      }));

      // Filter companies based on user access
      const filteredCompanies =
        user?.role === "admin"
          ? companyOptions
          : companyOptions.filter((c) => canAccessCompany(c.value));

      setCompanies(filteredCompanies);
    } catch (err) {
      console.error("Failed to load companies:", err);
    }
  };

  const loadDepartments = async (companyId: string) => {
    try {
      const data = await departmentsService.getAllDepartments(companyId);
      const departmentOptions = data.map((dept) => ({
        value: dept._id,
        label: dept.name,
      }));
      setDepartments(departmentOptions);
    } catch (err) {
      console.error("Failed to load departments:", err);
    }
  };

  // Mock recommended fields - in production, fetch from API
  const mockRecommendedFields: CustomField[] = [
    {
      fieldId: "years_experience_template",
      label: "Years of Experience",
      inputType: "number",
      isRequired: true,
      minValue: 0,
      maxValue: 50,
      displayOrder: 1,
    },
    {
      fieldId: "education_level_template",
      label: "Education Level",
      inputType: "select",
      isRequired: true,
      displayOrder: 2,
      choices: ["High School", "Bachelor's", "Master's", "PhD"],
    },
    {
      fieldId: "skills_template",
      label: "Skills",
      inputType: "tags",
      isRequired: false,
      displayOrder: 3,
    },
    {
      fieldId: "portfolio_url_template",
      label: "Portfolio URL",
      inputType: "url",
      isRequired: false,
      displayOrder: 4,
    },
  ];

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
  const [showRecommendedFieldsModal, setShowRecommendedFieldsModal] =
    useState(false);
  const [selectedRecommendedFields, setSelectedRecommendedFields] = useState<
    string[]
  >([]);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (jobForm.companyId) {
      loadDepartments(jobForm.companyId);
    }
  }, [jobForm.companyId]);

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
      const payload = {
        title: jobForm.title,
        description: jobForm.description,
        companyId: jobForm.companyId,
        departmentId: jobForm.departmentId,
        jobCode: jobForm.jobCode,
        requirements: jobForm.termsAndConditions.filter((term) => term.trim()),
        salary: {
          min: jobForm.salary,
          max: jobForm.salary,
          currency: "USD",
        },
        salaryVisible: jobForm.salaryVisible,
        openPositions: jobForm.openPositions,
        registrationStart: jobForm.registrationStart,
        registrationEnd: jobForm.registrationEnd,
        jobSpecs: jobForm.jobSpecs.filter((spec) => spec.spec.trim()),
        customFields: jobForm.customFields,
        status: "open" as const,
        employmentType: "Full-time",
      };

      await jobPositionsService.createJobPosition(payload);
      setJobStatus("Job created successfully");
      setTimeout(() => {
        setJobStatus("");
        navigate("/jobs");
      }, 1500);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to create job";
      setJobStatus(`Error: ${errorMessage}`);
      console.error("Error creating job:", err);
    }
  };

  const handleToggleRecommendedField = (fieldId: string) => {
    setSelectedRecommendedFields((prev) =>
      prev.includes(fieldId)
        ? prev.filter((id) => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleAddRecommendedFields = () => {
    const fieldsToAdd = mockRecommendedFields
      .filter((field) => selectedRecommendedFields.includes(field.fieldId))
      .map((field) => ({
        ...field,
        fieldId: `${field.fieldId}_${Date.now()}`, // Make unique
        displayOrder:
          jobForm.customFields.length +
          selectedRecommendedFields.indexOf(field.fieldId) +
          1,
      }));

    setJobForm((prev) => ({
      ...prev,
      customFields: [...prev.customFields, ...fieldsToAdd],
    }));

    setShowRecommendedFieldsModal(false);
    setSelectedRecommendedFields([]);
  };

  const jobPayload = useMemo(() => jobForm, [jobForm]);

  const totalWeight = jobForm.jobSpecs.reduce(
    (sum, spec) => sum + spec.weight,
    0
  );

  return (
    <div className="space-y-6">
      <PageMeta
        title="Create Job | TailAdmin React"
        description="Create a new job posting for your company"
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

      <PageBreadcrumb pageTitle="Create Job" />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company & Department Selection */}
        <ComponentCard
          title="Company & Department"
          desc="Select the company and department"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="companyId">Company</Label>
              <Select
                options={companies}
                placeholder="Select company"
                onChange={(value) => {
                  handleInputChange("companyId", value);
                  handleInputChange("departmentId", ""); // Reset department when company changes
                }}
              />
            </div>
            <div>
              <Label htmlFor="departmentId">Department</Label>
              <Select
                options={departments}
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
                  onChange={(e) => handleInputChange("jobCode", e.target.value)}
                  placeholder="DEV-FE-001"
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
            <button
              type="button"
              onClick={() => setShowRecommendedFieldsModal(true)}
              className="flex items-center gap-2 rounded-lg border border-primary bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm transition-all hover:bg-primary/5 dark:bg-gray-900 dark:hover:bg-primary/10"
            >
              <CheckCircleIcon className="size-4" />
              Preview Recommended Fields
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
                      <Label htmlFor={`field-id-${fieldIndex}`}>Field ID</Label>
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
                      <Label htmlFor={`field-label-${fieldIndex}`}>Label</Label>
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

                        {(!field.subFields || field.subFields.length === 0) && (
                          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/30 dark:text-gray-400">
                            No sub-questions added yet. Click "Add Sub-Question"
                            to add questions to this group.
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
                Create Job
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

      {/* Recommended Fields Modal */}
      <Modal
        isOpen={showRecommendedFieldsModal}
        onClose={() => {
          setShowRecommendedFieldsModal(false);
          setSelectedRecommendedFields([]);
        }}
        className="max-w-4xl max-h-[90vh] overflow-y-auto p-6"
      >
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Recommended Fields
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Select pre-configured fields to add to your job application form
            </p>
          </div>

          <div className="grid gap-4">
            {mockRecommendedFields.map((field) => (
              <div
                key={field.fieldId}
                className={`rounded-lg border-2 p-4 transition cursor-pointer ${
                  selectedRecommendedFields.includes(field.fieldId)
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                }`}
                onClick={() => handleToggleRecommendedField(field.fieldId)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedRecommendedFields.includes(field.fieldId)}
                    onChange={() => handleToggleRecommendedField(field.fieldId)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {field.label}
                      </h3>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {field.inputType}
                      </span>
                      {field.isRequired && (
                        <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-mono text-xs">{field.fieldId}</span>
                    </p>
                    {field.minValue !== undefined &&
                      field.maxValue !== undefined && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                          Range: {field.minValue} - {field.maxValue}
                        </p>
                      )}
                    {field.choices && field.choices.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {field.choices.map((choice, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          >
                            {choice}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                setShowRecommendedFieldsModal(false);
                setSelectedRecommendedFields([]);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddRecommendedFields}
              disabled={selectedRecommendedFields.length === 0}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add{" "}
              {selectedRecommendedFields.length > 0 &&
                `(${selectedRecommendedFields.length})`}{" "}
              Selected Fields
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
