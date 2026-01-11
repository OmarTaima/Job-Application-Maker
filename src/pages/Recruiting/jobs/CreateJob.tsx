import { useMemo, useState, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { useNavigate, useSearchParams } from "react-router";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import TextArea from "../../../components/form/input/TextArea";
import Switch from "../../../components/form/switch/Switch";
import Select from "../../../components/form/Select";
import { PlusIcon, TrashBinIcon, CheckCircleIcon } from "../../../icons";
import { useAuth } from "../../../context/AuthContext";
import { jobPositionsService } from "../../../services/jobPositionsService";
import { companiesService } from "../../../services/companiesService";
import { departmentsService } from "../../../services/departmentsService";

type JobSpec = {
  spec: string;
  specAr?: string;
  weight: number;
};

type SubField = {
  fieldId: string;
  label: string;
  labelAr?: string;
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
  choicesAr?: string[];
};

type CustomField = {
  fieldId: string;
  label: string;
  labelAr?: string;
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
  choicesAr?: string[];
  subFields?: SubField[];
  displayOrder: number;
};

type JobForm = {
  companyId: string;
  departmentId: string;
  jobCode: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  salary: number;
  salaryVisible: boolean;
  bilingual: boolean;
  openPositions: number;
  registrationStart: string;
  registrationEnd: string;
  termsAndConditions: string[];
  termsAndConditionsAr: string[];
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
    titleAr: "",
    description: "",
    descriptionAr: "",
    salary: 0,
    salaryVisible: true,
    bilingual: false,
    openPositions: 1,
    registrationStart: "",
    registrationEnd: "",
    termsAndConditions: [],
    termsAndConditionsAr: [],
    jobSpecs: [],
    customFields: [],
  });

  const [newTerm, setNewTerm] = useState("");
  const [newTermAr, setNewTermAr] = useState("");
  const [newChoice, setNewChoice] = useState("");
  const [newChoiceAr, setNewChoiceAr] = useState("");
  const [newSubFieldChoice, setNewSubFieldChoice] = useState("");
  const [newSubFieldChoiceAr, setNewSubFieldChoiceAr] = useState("");
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(
    null
  );
  const [editingTermIndex, setEditingTermIndex] = useState<number | null>(null);
  const [editingSpecIndex, setEditingSpecIndex] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
            title:
              (typeof job.title === "object" && job.title?.en) ||
              (typeof job.title === "string" ? job.title : ""),
            titleAr:
              (typeof job.title === "object" && job.title?.ar) || "",
            description:
              (typeof job.description === "object" && job.description?.en) ||
              (typeof job.description === "string" ? job.description : ""),
            descriptionAr:
              (typeof job.description === "object" && job.description?.ar) || "",
            salary:
              // handle previous shape { min } or new numeric salary
              (job.salary && typeof job.salary === "object" && (job.salary as any).min) ||
              (typeof job.salary === "number" ? job.salary : 0),
            salaryVisible: job.salaryVisible ?? true,
            bilingual: job.bilingual ?? false,
            openPositions: job.openPositions || 1,
            registrationStart: formatDateForInput(job.registrationStart),
            registrationEnd: formatDateForInput(job.registrationEnd),
            termsAndConditions:
              job.termsAndConditions && job.termsAndConditions.length > 0
                ? job.termsAndConditions.map((t: any) =>
                    typeof t === "string" ? t : t?.en || ""
                  )
                : job.requirements && job.requirements.length > 0
                ? job.requirements
                : [],
            termsAndConditionsAr:
              job.termsAndConditions && job.termsAndConditions.length > 0
                ? job.termsAndConditions.map((t: any) =>
                    typeof t === "string" ? "" : t?.ar || ""
                  )
                : [],
            jobSpecs:
              job.jobSpecs && job.jobSpecs.length > 0
                ? job.jobSpecs.map((s: any) => ({
                    spec: typeof s.spec === "string" ? s.spec : s.spec?.en || "",
                    specAr: typeof s.spec === "object" ? s.spec?.ar || "" : "",
                    weight: s.weight || 0,
                  }))
                : [],
            customFields: Array.isArray(job.customFields)
              ? (job.customFields as any[]).map((cf: any) => ({
                  fieldId: cf.fieldId,
                  label: typeof cf.label === "string" ? cf.label : cf.label?.en || "",
                  labelAr: typeof cf.label === "object" ? cf.label?.ar || "" : "",
                  inputType: cf.inputType,
                  isRequired: cf.isRequired,
                  minValue: cf.minValue,
                  maxValue: cf.maxValue,
                  choices: Array.isArray(cf.choices)
                    ? cf.choices.map((c: any) => (typeof c === "string" ? c : c?.en || ""))
                    : [],
                  choicesAr: Array.isArray(cf.choices)
                    ? cf.choices.map((c: any) => (typeof c === "object" ? c?.ar || "" : ""))
                    : [],
                  subFields: Array.isArray(cf.groupFields)
                    ? cf.groupFields.map((sf: any) => ({
                        fieldId: sf.fieldId,
                        label: typeof sf.label === "string" ? sf.label : sf.label?.en || "",
                        labelAr: typeof sf.label === "object" ? sf.label?.ar || "" : "",
                        inputType: sf.inputType,
                        isRequired: sf.isRequired,
                        choices: Array.isArray(sf.choices)
                          ? sf.choices.map((c: any) => (typeof c === "string" ? c : c?.en || ""))
                          : [],
                        choicesAr: Array.isArray(sf.choices)
                          ? sf.choices.map((c: any) => (typeof c === "object" ? c?.ar || "" : ""))
                          : [],
                      }))
                    : Array.isArray(cf.subFields)
                    ? cf.subFields.map((sf: any) => ({
                        fieldId: sf.fieldId,
                        label: typeof sf.label === "string" ? sf.label : sf.label?.en || "",
                        labelAr: typeof sf.label === "object" ? sf.label?.ar || "" : "",
                        inputType: sf.inputType,
                        isRequired: sf.isRequired,
                        choices: Array.isArray(sf.choices)
                          ? sf.choices.map((c: any) => (typeof c === "string" ? c : c?.en || ""))
                          : [],
                        choicesAr: Array.isArray(sf.choices)
                          ? sf.choices.map((c: any) => (typeof c === "object" ? c?.ar || "" : ""))
                          : [],
                      }))
                    : [],
                  displayOrder: cf.displayOrder || 0,
                }))
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
    if (newTerm.trim() || newTermAr.trim()) {
      setJobForm((prev) => ({
        ...prev,
        termsAndConditions: [...prev.termsAndConditions, newTerm],
        termsAndConditionsAr: [...prev.termsAndConditionsAr, newTermAr],
      }));
      setNewTerm("");
      setNewTermAr("");
    }
  };

  const handleRemoveTerm = (index: number) => {
    setJobForm((prev) => ({
      ...prev,
      termsAndConditions: prev.termsAndConditions.filter((_, i) => i !== index),
      termsAndConditionsAr: prev.termsAndConditionsAr.filter((_, i) => i !== index),
    }));
  };

  const handleAddJobSpec = () => {
    setJobForm((prev) => ({
      ...prev,
      jobSpecs: [...prev.jobSpecs, { spec: "", specAr: "", weight: 0 }],
    }));
    // Set the newly added spec to edit mode
    setEditingSpecIndex(jobForm.jobSpecs.length);
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
            ? { 
                ...cf, 
                choices: [...(cf.choices || []), newChoice],
                choicesAr: jobForm.bilingual 
                  ? [...(cf.choicesAr || []), newChoiceAr.trim() || newChoice]
                  : cf.choicesAr
              }
            : cf
        ),
      }));
      setNewChoice("");
      setNewChoiceAr("");
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
              choicesAr: cf.choicesAr?.filter((_, ci) => ci !== choiceIndex),
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
                        choicesAr: jobForm.bilingual
                          ? [...(sf.choicesAr || []), newSubFieldChoiceAr.trim() || newSubFieldChoice]
                          : sf.choicesAr,
                      }
                    : sf
                ),
              }
            : cf
        ),
      }));
      setNewSubFieldChoice("");
      setNewSubFieldChoiceAr("");
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
                      choicesAr: sf.choicesAr?.filter(
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
    setIsSubmitting(true);

    try {
      const salaryValue = Number(jobForm.salary);

      const payload = {
        title: jobForm.bilingual ? { en: jobForm.title || "", ar: jobForm.titleAr || "" } : { en: jobForm.title || "", ar: "" },
        description: jobForm.bilingual ? { en: jobForm.description || "", ar: jobForm.descriptionAr || "" } : { en: jobForm.description || "", ar: "" },
        companyId: jobForm.companyId,
        departmentId: jobForm.departmentId,
        jobCode: jobForm.jobCode,
        termsAndConditions: jobForm.termsAndConditions
          .filter((term, idx) => term.trim() || (jobForm.bilingual && jobForm.termsAndConditionsAr[idx]?.trim()))
          .map((t, idx) => ({ en: t, ar: jobForm.bilingual ? (jobForm.termsAndConditionsAr[idx] || "") : "" })),
        salary: isNaN(salaryValue) ? undefined : salaryValue,
        salaryVisible: jobForm.salaryVisible,
        openPositions: jobForm.openPositions,
        registrationStart: jobForm.registrationStart,
        registrationEnd: jobForm.registrationEnd,
        jobSpecs: jobForm.jobSpecs
          .filter((spec) => spec.spec.trim() || (jobForm.bilingual && spec.specAr?.trim()))
          .map((spec) => ({ 
            spec: jobForm.bilingual 
              ? { en: spec.spec || "", ar: spec.specAr || "" }
              : { en: spec.spec || "", ar: "" }, 
            weight: spec.weight 
          })),
        customFields: jobForm.customFields.map((cf) => ({
          fieldId: cf.fieldId,
          label: jobForm.bilingual 
            ? { en: cf.label || "", ar: cf.labelAr || "" }
            : { en: cf.label || "", ar: "" },
          inputType: cf.inputType,
          isRequired: cf.isRequired,
          minValue: cf.minValue,
          maxValue: cf.maxValue,
          choices: Array.isArray(cf.choices)
            ? jobForm.bilingual
              ? cf.choices.map((c, i) => ({ en: c, ar: cf.choicesAr?.[i] || "" }))
              : cf.choices.map((c) => ({ en: c, ar: "" }))
            : [],
          groupFields: Array.isArray(cf.subFields)
            ? cf.subFields.map((sf) => ({
                fieldId: sf.fieldId,
                label: jobForm.bilingual
                  ? { en: sf.label || "", ar: sf.labelAr || "" }
                  : { en: sf.label || "", ar: "" },
                inputType: sf.inputType,
                isRequired: sf.isRequired,
                choices: Array.isArray(sf.choices)
                  ? jobForm.bilingual
                    ? sf.choices.map((c, i) => ({ en: c, ar: sf.choicesAr?.[i] || "" }))
                    : sf.choices.map((c) => ({ en: c, ar: "" }))
                  : [],
              }))
            : [],
          displayOrder: cf.displayOrder,
        })),
        status: "open" as const,
        employmentType: "Full-time",
        bilingual: jobForm.bilingual,
        isActive: true,
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
        toast: true,
        position: "top-end",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
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
      setIsSubmitting(false);
    }
  };

  const jobPayload = useMemo(() => {
    const salaryValue = Number(jobForm.salary);
    return {
      title: jobForm.bilingual ? { en: jobForm.title || "", ar: jobForm.titleAr || "" } : { en: jobForm.title || "", ar: "" },
      description: jobForm.bilingual ? { en: jobForm.description || "", ar: jobForm.descriptionAr || "" } : { en: jobForm.description || "", ar: "" },
      companyId: jobForm.companyId,
      departmentId: jobForm.departmentId,
      jobCode: jobForm.jobCode,
      termsAndConditions: jobForm.termsAndConditions
        .filter((term, idx) => term.trim() || (jobForm.bilingual && jobForm.termsAndConditionsAr[idx]?.trim()))
        .map((t, idx) => ({ en: t, ar: jobForm.bilingual ? (jobForm.termsAndConditionsAr[idx] || "") : "" })),
      salary: isNaN(salaryValue) ? undefined : salaryValue,
      salaryVisible: jobForm.salaryVisible,
      openPositions: jobForm.openPositions,
      registrationStart: jobForm.registrationStart,
      registrationEnd: jobForm.registrationEnd,
      jobSpecs: jobForm.jobSpecs
        .filter((spec) => spec.spec.trim() || (jobForm.bilingual && spec.specAr?.trim()))
        .map((spec) => ({ 
          spec: jobForm.bilingual 
            ? { en: spec.spec || "", ar: spec.specAr || "" }
            : { en: spec.spec || "", ar: "" }, 
          weight: spec.weight 
        })),
      customFields: jobForm.customFields.map((cf) => ({
        fieldId: cf.fieldId,
        label: jobForm.bilingual 
          ? { en: cf.label || "", ar: cf.labelAr || "" }
          : { en: cf.label || "", ar: "" },
        inputType: cf.inputType,
        isRequired: cf.isRequired,
        minValue: cf.minValue,
        maxValue: cf.maxValue,
        choices: Array.isArray(cf.choices)
          ? jobForm.bilingual
            ? cf.choices.map((c, i) => ({ en: c, ar: cf.choicesAr?.[i] || "" }))
            : cf.choices.map((c) => ({ en: c, ar: "" }))
          : [],
        groupFields: Array.isArray(cf.subFields)
          ? cf.subFields.map((sf) => ({
              fieldId: sf.fieldId,
              label: jobForm.bilingual
                ? { en: sf.label || "", ar: sf.labelAr || "" }
                : { en: sf.label || "", ar: "" },
              inputType: sf.inputType,
              isRequired: sf.isRequired,
              choices: Array.isArray(sf.choices)
                ? jobForm.bilingual
                  ? sf.choices.map((c, i) => ({ en: c, ar: sf.choicesAr?.[i] || "" }))
                  : sf.choices.map((c) => ({ en: c, ar: "" }))
                : [],
            }))
          : [],
        displayOrder: cf.displayOrder,
      })),
      status: "open" as const,
      employmentType: "Full-time",
      bilingual: jobForm.bilingual,
      isActive: true,
    };
  }, [jobForm]);

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
              <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <Switch
                  label="Bilingual Job (English & Arabic)"
                  defaultChecked={jobForm.bilingual}
                  onChange={(checked) => handleInputChange("bilingual", checked)}
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {jobForm.bilingual ? "Showing bilingual inputs" : "Showing English only"}
                </span>
              </div>

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
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="title">Job Title{jobForm.bilingual && " (English)"}</Label>
                  <Input
                    id="title"
                    value={jobForm.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="Senior Frontend Developer"
                  />
                </div>
                {jobForm.bilingual && (
                  <div>
                    <Label htmlFor="titleAr">Job Title (Arabic)</Label>
                    <div dir="rtl">
                      <Input
                        id="titleAr"
                        value={jobForm.titleAr}
                        onChange={(e) => handleInputChange("titleAr", e.target.value)}
                        placeholder="مطور واجهة أمامية أول"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="description">Description{jobForm.bilingual && " (English)"}</Label>
                  <TextArea
                    value={jobForm.description}
                    onChange={(value) => handleInputChange("description", value)}
                    placeholder="We are looking for a skilled developer..."
                    rows={5}
                  />
                </div>
                {jobForm.bilingual && (
                  <div>
                    <Label htmlFor="descriptionAr">Description (Arabic)</Label>
                    <div dir="rtl">
                      <TextArea
                        value={jobForm.descriptionAr}
                        onChange={(value) => handleInputChange("descriptionAr", value)}
                        placeholder="نبحث عن مطور ماهر..."
                        rows={5}
                      />
                    </div>
                  </div>
                )}
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
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Input
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTerm();
                    }
                  }}
                  placeholder={jobForm.bilingual ? "Add a term or condition (English)" : "Add a term or condition"}
                />
                {jobForm.bilingual && (
                  <div dir="rtl">
                    <Input
                      value={newTermAr}
                      onChange={(e) => setNewTermAr(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTerm();
                        }
                      }}
                      placeholder="أضف شرط أو حكم (العربية)"
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleAddTerm}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
              >
                <PlusIcon className="size-4" />
                Add
              </button>

              <div className="space-y-2">
                {jobForm.termsAndConditions.map((term, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/50"
                  >
                    {editingTermIndex === index ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <Input
                            value={term}
                            onChange={(e) => {
                              const newTerms = [...jobForm.termsAndConditions];
                              newTerms[index] = e.target.value;
                              setJobForm(prev => ({ ...prev, termsAndConditions: newTerms }));
                            }}
                            placeholder={jobForm.bilingual ? "Term (English)" : "Term"}
                          />
                          {jobForm.bilingual && (
                            <div dir="rtl">
                              <Input
                                value={jobForm.termsAndConditionsAr[index] || ""}
                                onChange={(e) => {
                                  const newTermsAr = [...jobForm.termsAndConditionsAr];
                                  newTermsAr[index] = e.target.value;
                                  setJobForm(prev => ({ ...prev, termsAndConditionsAr: newTermsAr }));
                                }}
                                placeholder="الشرط (العربية)"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingTermIndex(null)}
                            className="inline-flex items-center gap-1 rounded px-3 py-1 text-sm font-medium text-success-600 transition hover:bg-success-50 dark:text-success-400 dark:hover:bg-success-500/10"
                          >
                            <CheckCircleIcon className="size-4" />
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            {jobForm.bilingual && <strong>EN: </strong>}{term || "(empty)"}
                          </div>
                          {jobForm.bilingual && (
                            <div className="text-sm text-gray-700 dark:text-gray-300" dir="rtl">
                              <strong>AR:</strong> {jobForm.termsAndConditionsAr[index] || "(فارغ)"}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingTermIndex(index)}
                            className="rounded p-1 text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                            title="Edit"
                          >
                            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveTerm(index)}
                            className="rounded p-1 text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                            title="Delete"
                          >
                            <TrashBinIcon className="size-4" />
                          </button>
                        </div>
                      </div>
                    )}
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
                <div key={index}>
                  {editingSpecIndex === index ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/50 space-y-2">
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <Input
                            value={spec.spec}
                            onChange={(e) =>
                              handleJobSpecChange(index, "spec", e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                setEditingSpecIndex(null);
                              }
                            }}
                            placeholder={jobForm.bilingual ? "Specification (English)" : "Specification"}
                          />
                        </div>
                        {jobForm.bilingual && (
                          <div className="flex-1" dir="rtl">
                            <Input
                              value={spec.specAr || ""}
                              onChange={(e) =>
                                handleJobSpecChange(index, "specAr", e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  setEditingSpecIndex(null);
                                }
                              }}
                              placeholder="المواصفة (العربية)"
                            />
                          </div>
                        )}
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
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingSpecIndex(null)}
                          className="inline-flex items-center gap-1 rounded px-3 py-1 text-sm font-medium text-success-600 transition hover:bg-success-50 dark:text-success-400 dark:hover:bg-success-500/10"
                        >
                          <CheckCircleIcon className="size-4" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/50">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 flex items-center gap-3">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {jobForm.bilingual && <span className="text-gray-500">EN: </span>}
                              {spec.spec || "(empty)"}
                            </div>
                          </div>
                          {jobForm.bilingual && (
                            <div className="flex-1" dir="rtl">
                              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                <span className="text-gray-500">AR: </span>
                                {spec.specAr || "(فارغ)"}
                              </div>
                            </div>
                          )}
                          <div className="w-32 text-center">
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              {spec.weight}%
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingSpecIndex(index)}
                            className="rounded p-1 text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                            title="Edit"
                          >
                            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveJobSpec(index)}
                            className="rounded p-1 text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                            title="Delete"
                          >
                            <TrashBinIcon className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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
                        <Label htmlFor={`field-label-${fieldIndex}`}>
                          Label{jobForm.bilingual && " (English)"}
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
                      {jobForm.bilingual && (
                        <div>
                          <Label htmlFor={`field-label-ar-${fieldIndex}`}>
                            Label (Arabic)
                          </Label>
                          <div dir="rtl">
                            <Input
                              id={`field-label-ar-${fieldIndex}`}
                              value={field.labelAr || ""}
                              onChange={(e) =>
                                handleCustomFieldChange(
                                  fieldIndex,
                                  "labelAr",
                                  e.target.value
                                )
                              }
                              placeholder="سنوات الخبرة"
                            />
                          </div>
                        </div>
                      )}
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
                        <Label>Choices{jobForm.bilingual && " (English)"}</Label>
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
                        {jobForm.bilingual && (
                          <div className="mt-2">
                            <Label>Choices (Arabic)</Label>
                            <div className="flex gap-2">
                              <div dir="rtl" className="flex-1">
                                <Input
                                  value={newChoiceAr}
                                  onChange={(e) => setNewChoiceAr(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleAddChoice(fieldIndex);
                                    }
                                  }}
                                  placeholder="أضف خيارًا"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddChoice(fieldIndex)}
                                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
                              >
                                <PlusIcon className="size-4" />
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="mt-2 space-y-1">
                          {field.choices?.map((choice, choiceIndex) => (
                            <div
                              key={choiceIndex}
                              className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
                            >
                              <span className="text-gray-700 dark:text-gray-300">
                                {jobForm.bilingual && "EN: "}{choice}
                                {jobForm.bilingual && field.choicesAr?.[choiceIndex] && (
                                  <span className="mt-1 block" dir="rtl">
                                    AR: {field.choicesAr[choiceIndex]}
                                  </span>
                                )}
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
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <div>
                                    <Label
                                      htmlFor={`subfield-label-${subFieldIndex}`}
                                    >
                                      Label{jobForm.bilingual && " (English)"}
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
                                  {jobForm.bilingual && (
                                    <div>
                                      <Label
                                        htmlFor={`subfield-label-ar-${subFieldIndex}`}
                                      >
                                        Label (Arabic)
                                      </Label>
                                      <div dir="rtl">
                                        <Input
                                          id={`subfield-label-ar-${subFieldIndex}`}
                                          value={subField.labelAr || ""}
                                          onChange={(e) =>
                                            handleSubFieldChange(
                                              fieldIndex,
                                              subFieldIndex,
                                              "labelAr",
                                              e.target.value
                                            )
                                          }
                                          placeholder="أدخل تسمية السؤال"
                                        />
                                      </div>
                                    </div>
                                  )}
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
                                    <Label>Choices{jobForm.bilingual && " (English)"}</Label>
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
                                    {jobForm.bilingual && (
                                      <div className="mt-2">
                                        <Label>Choices (Arabic)</Label>
                                        <div className="flex gap-2">
                                          <div dir="rtl" className="flex-1">
                                            <Input
                                              value={newSubFieldChoiceAr}
                                              onChange={(e) =>
                                                setNewSubFieldChoiceAr(e.target.value)
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
                                              placeholder="أضف خيارًا"
                                            />
                                          </div>
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
                                      </div>
                                    )}
                                    <div className="mt-2 space-y-1">
                                      {subField.choices?.map(
                                        (choice, choiceIndex) => (
                                          <div
                                            key={choiceIndex}
                                            className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
                                          >
                                            <span className="text-gray-700 dark:text-gray-300">
                                              {jobForm.bilingual && "EN: "}{choice}
                                              {jobForm.bilingual && subField.choicesAr?.[choiceIndex] && (
                                                <span className="mt-1 block" dir="rtl">
                                                  AR: {subField.choicesAr[choiceIndex]}
                                                </span>
                                              )}
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
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {isEditMode ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="size-5" />
                      {isEditMode ? "Update Job" : "Create Job"}
                    </>
                  )}
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
