import { useMemo, useState, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { useNavigate, useSearchParams, useLocation } from "react-router";
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
import {
  useCompanies,
  useDepartments,
} from "../../../hooks/queries";
import { useRecommendedFields } from "../../../hooks/queries/useRecommendedFields";
import { useCreateJobPosition, useUpdateJobPosition, useJobPositions } from "../../../hooks/queries/useJobPositions";
import { toPlainString } from "../../../utils/strings";

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
    | "tags"
    | "repeatable_group";
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
    | "dropdown"
    | "textarea"
    | "url"
    | "tags"
    | "repeatable_group";
  isRequired: boolean;
  minValue?: number;
  maxValue?: number;
  choices?: string[];
  choicesAr?: string[];
  subFields?: SubField[];
  displayOrder: number;
};

type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship';
type WorkArrangement = 'on-site' | 'remote' | 'hybrid';

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
  employmentType: EmploymentType;
  workArrangement: WorkArrangement;
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
  { value: "textarea", label: "Textarea" },
  { value: "tags", label: "Tags (Multiple Values)" },
  { value: "repeatable_group", label: "Group Field (Multiple Questions)" },
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
  { value: "tags", label: "Tags" },
];

export default function CreateJob() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const editJobId = searchParams.get("id");
  const jobFromState = location.state?.job; // Get job data from navigation state
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

  // Check if user has multiple companies assigned
  const userCompaniesCount = user?.companies?.length || 0;
  const hasMultipleCompanies = userCompaniesCount > 1;
  const shouldShowCompanyField = isAdmin || hasMultipleCompanies;

  // Determine companyId to pass to company queries (undefined for super admin -> fetch all)
  const companyId = useMemo(() => {
    if (!user) return undefined;
    const roleName = (user as any)?.roleId?.name || String(user.role || "");
    const normalized = String(roleName).toLowerCase();
    const isSuperAdmin = normalized === "super admin" || normalized === "superadmin" || normalized === "super_admin";
    if (isSuperAdmin) return undefined;
    const ids = user.companies?.map((c: any) => (typeof c.companyId === "string" ? c.companyId : c.companyId?._id));
    return ids && ids.length ? ids : undefined;
  }, [user?.companies, user?.roleId?.name, user?.role]);

  // Explicitly detect super admin for clarity
  const isSuperAdmin = useMemo(() => {
    if (!user) return false;
    const roleName = (user as any)?.roleId?.name || String(user.role || "");
    const normalized = String(roleName).toLowerCase();
    return (
      normalized === "super admin" ||
      normalized === "superadmin" ||
      normalized === "super_admin"
    );
  }, [user?.role, user?.roleId?.name]);

  // Prepare companyId specifically for the jobs duplication query.
  // If user is super admin -> undefined (fetch across all companies).
  // If user is not super admin but has no assigned companies -> use sentinel to avoid fetching all.
  const companyIdForJobQuery = useMemo(() => {
    if (isSuperAdmin) return undefined;
    return companyId ?? ['__NO_COMPANY__'];
  }, [isSuperAdmin, companyId]);

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
    employmentType: 'full-time',
    workArrangement: 'on-site',
  });

  const [newTerm, setNewTerm] = useState("");
  const [newTermAr, setNewTermAr] = useState("");
  const [newChoice, setNewChoice] = useState<Record<number, string>>({});
  const [newChoiceAr, setNewChoiceAr] = useState<Record<number, string>>({});
  const [newSubFieldChoice, setNewSubFieldChoice] = useState<Record<string, string>>({});
  const [newSubFieldChoiceAr, setNewSubFieldChoiceAr] = useState<Record<string, string>>({});
  const [collapsedFields, setCollapsedFields] = useState<Set<number>>(new Set());
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(
    null
  );
  const [editingTermIndex, setEditingTermIndex] = useState<number | null>(null);
  const [editingSpecIndex, setEditingSpecIndex] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  // Use React Query hooks for data fetching
  const { data: allCompanies = [], isLoading: companiesLoading } = useCompanies(companyId as any);
  // Fetch jobs for duplication dropdown. Always fetch only active jobs.
  // Super Admin: companyId is undefined -> fetches active jobs across all companies
  // Regular users: companyId contains their assigned company IDs -> fetches active jobs for those companies
  const { data: allJobs = [], isLoading: jobsLoading } = useJobPositions(companyIdForJobQuery, true);
  const createJobMutation = useCreateJobPosition();
  const updateJobMutation = useUpdateJobPosition();
  
  // Fetch all departments if admin or has multiple companies, otherwise fetch for specific company
  const shouldFetchAllDepartments = isAdmin || hasMultipleCompanies;
  const departmentsEnabled = !companiesLoading && (shouldFetchAllDepartments ? true : !!jobForm.companyId);
  const { data: allDepartments = [], isLoading: departmentsLoading } = useDepartments(
    shouldFetchAllDepartments ? undefined : (jobForm.companyId || undefined),
    { enabled: departmentsEnabled }
  );

  // Transform companies based on user role
  const companies = useMemo(() => {
    if (isAdmin) {
      return allCompanies.map((company) => ({
        value: company._id,
        label: toPlainString((company as any).name),
      }));
    } else {
      return (
        user?.companies?.map((c) => ({
          value:
            typeof c.companyId === "string" ? c.companyId : c.companyId._id,
          label:
            typeof c.companyId === "string" ? c.companyId : toPlainString(c.companyId.name),
        })) || []
      );
    }
  }, [allCompanies, isAdmin, user?.companies]);

  // Transform departments based on user role
  const departments = useMemo(() => {
    if (shouldFetchAllDepartments) {
      // Admin or multi-company users: filter departments by selected company
      if (!jobForm.companyId) {
        return []; // No company selected, show no departments
      }
      
      return allDepartments
        .filter((dept) => {
          const deptCompanyId = typeof dept.companyId === 'string' 
            ? dept.companyId 
            : (dept.companyId as any)?._id;
          return deptCompanyId === jobForm.companyId;
        })
        .map((dept) => ({
          value: dept._id,
          label: toPlainString((dept as any).name),
        }));
    } else {
      // Single-company non-admin: show departments for their company
      return allDepartments.map((dept) => ({
        value: dept._id,
        label: toPlainString((dept as any).name),
      }));
    }
  }, [allDepartments, shouldFetchAllDepartments, jobForm.companyId]);

  const isLoading = companiesLoading;

  const departmentSelectDisabled = departmentsLoading || (!jobForm.companyId && shouldFetchAllDepartments);

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
  const jobDataLoaded = useRef(false);

  // Handle job selection for duplication
  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
    
    if (!jobId) {
      // Reset form if no job selected
      setJobForm({
        companyId: jobForm.companyId || "",
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
        employmentType: 'full-time',
        workArrangement: 'on-site',
      });
      return;
    }
    
    const selectedJob = allJobs.find((j: any) => j._id === jobId);
    if (selectedJob) {
      // Extract company and department IDs
      const companyId = typeof selectedJob.companyId === 'string' ? selectedJob.companyId : (selectedJob.companyId as any)?._id;
      const departmentId = typeof selectedJob.departmentId === 'string' ? selectedJob.departmentId : (selectedJob.departmentId as any)?._id;
      
      // Populate form with selected job data (with "Copy" suffix)
      setJobForm({
        companyId: companyId || "",
        departmentId: departmentId || "",
        jobCode: "", // Will be auto-generated
        title: (typeof selectedJob.title === 'object' ? selectedJob.title.en : selectedJob.title) + ' (Copy)',
        titleAr: typeof selectedJob.title === 'object' && selectedJob.title.ar ? selectedJob.title.ar + ' (نسخة)' : '',
        description: typeof selectedJob.description === 'object' ? selectedJob.description.en || '' : (selectedJob.description || ''),
        descriptionAr: typeof selectedJob.description === 'object' ? selectedJob.description.ar || '' : '',
        salary: selectedJob.salary || 0,
        salaryVisible: selectedJob.salaryVisible ?? true,
        bilingual: selectedJob.bilingual ?? false,
        openPositions: selectedJob.openPositions || 1,
        registrationStart: selectedJob.registrationStart ? new Date(selectedJob.registrationStart).toISOString().split("T")[0] : "",
        registrationEnd: selectedJob.registrationEnd ? new Date(selectedJob.registrationEnd).toISOString().split("T")[0] : "",
        termsAndConditions: Array.isArray(selectedJob.termsAndConditions)
          ? selectedJob.termsAndConditions.map((t: any) => typeof t === 'string' ? t : t?.en || '')
          : [],
        termsAndConditionsAr: Array.isArray(selectedJob.termsAndConditions)
          ? selectedJob.termsAndConditions.map((t: any) => typeof t === 'object' ? t?.ar || '' : '')
          : [],
        jobSpecs: Array.isArray(selectedJob.jobSpecs)
          ? selectedJob.jobSpecs.map((s: any) => ({
              spec: typeof s.spec === 'string' ? s.spec : s.spec?.en || '',
              specAr: typeof s.spec === 'object' ? s.spec?.ar || '' : '',
              weight: s.weight || 0,
            }))
          : [],
        customFields: Array.isArray(selectedJob.customFields)
          ? selectedJob.customFields.map((cf: any) => ({
              fieldId: `dup_${Date.now()}_${Math.random()}`,
              label: typeof cf.label === 'string' ? cf.label : cf.label?.en || '',
              labelAr: typeof cf.label === 'object' ? cf.label?.ar || '' : '',
              inputType: cf.inputType,
              isRequired: cf.isRequired,
              minValue: cf.minValue,
              maxValue: cf.maxValue,
              choices: Array.isArray(cf.choices)
                ? cf.choices.map((c: any) => typeof c === 'string' ? c : c?.en || '')
                : [],
              choicesAr: Array.isArray(cf.choices)
                ? cf.choices.map((c: any) => typeof c === 'object' ? c?.ar || '' : '')
                : [],
              subFields: Array.isArray(cf.groupFields || cf.subFields)
                ? (cf.groupFields || cf.subFields).map((sf: any) => ({
                    fieldId: `dup_sub_${Date.now()}_${Math.random()}`,
                    label: typeof sf.label === 'string' ? sf.label : sf.label?.en || '',
                    labelAr: typeof sf.label === 'object' ? sf.label?.ar || '' : '',
                    inputType: sf.inputType,
                    isRequired: sf.isRequired,
                    choices: Array.isArray(sf.choices)
                      ? sf.choices.map((c: any) => typeof c === 'string' ? c : c?.en || '')
                      : [],
                    choicesAr: Array.isArray(sf.choices)
                      ? sf.choices.map((c: any) => typeof c === 'object' ? c?.ar || '' : '')
                      : [],
                  }))
                : [],
              displayOrder: cf.displayOrder || 0,
            }))
          : [],
        employmentType: selectedJob.employmentType || 'full-time',
        workArrangement: selectedJob.workArrangement || 'on-site',
      });
      
      // Collapse all custom fields by default when duplicating
      if (selectedJob.customFields && selectedJob.customFields.length > 0) {
        setCollapsedFields(new Set(Array.from({ length: selectedJob.customFields.length }, (_, i) => i)));
      }
    }
  };

  // Load existing job data when in edit mode
  useEffect(() => {
    const loadJobData = async () => {
      if (editJobId && !jobDataLoaded.current && companies.length > 0) {
        try {
          setIsEditMode(true);
          
          // Use job data from state if available, otherwise fetch from API
          const job = jobFromState || await jobPositionsService.getJobPositionById(editJobId);

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
            employmentType: normalizeEmploymentType(job.employmentType) || 'full-time',
            workArrangement: (job as any).workArrangement || 'on-site',
          });

          // Collapse all custom fields by default when editing
          if (job.customFields && job.customFields.length > 0) {
            setCollapsedFields(new Set(Array.from({ length: job.customFields.length }, (_, i) => i)));
          }

          jobDataLoaded.current = true;
        } catch (err) {
          console.error("Failed to load job data:", err);
          const errorMsg = getErrorMessage(err);
          setFormError(errorMsg);
          setJobStatus(`Error: ${errorMsg}`);
        }
      }
    };

    loadJobData();
  }, [editJobId, companies, jobFromState]);

  // Auto-select company for users with single company
  useEffect(() => {
    if (
      user &&
      !isAdmin &&
      !hasMultipleCompanies &&
      companies.length > 0 &&
      !companyAutoSet.current &&
      !editJobId
    ) {
      // Extract the first (and only) company ID from user.companies array
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
  }, [user, isAdmin, hasMultipleCompanies, companies, editJobId]);

  // Auto-generate job code when company changes (only for new jobs, not edits)
  useEffect(() => {
    if (!isEditMode && jobForm.companyId && allCompanies.length > 0) {
      // Find the selected company
      const selectedCompany = allCompanies.find((c) => c._id === jobForm.companyId);
      if (selectedCompany) {
        // Generate job code: CompanyAbbreviation-Timestamp
        const companyName = toPlainString((selectedCompany as any).name) || "COMP";
        const companyAbbr = companyName
          .split(/\s+/)
          .map((word) => word.charAt(0).toUpperCase())
          .join("")
          .slice(0, 4);
        const timestamp = Date.now().toString().slice(-6);
        const autoJobCode = `${companyAbbr}-${timestamp}`;
        
        setJobForm((prev) => ({ ...prev, jobCode: autoJobCode }));
      }
    }
  }, [jobForm.companyId, allCompanies, isEditMode]);

  const handleInputChange = (field: keyof JobForm, value: any) => {
    setJobForm((prev) => ({ ...prev, [field]: value }));
  };

  // Normalize various possible employmentType formats to canonical values
  const normalizeEmploymentType = (val: any): EmploymentType | undefined => {
    if (!val) return undefined;
    const s = String(val).toLowerCase().trim();
    if (s === "full-time" || s === "full time" || s === "fulltime" || s === "full") return "full-time";
    if (s === "part-time" || s === "part time" || s === "parttime" || s === "part") return "part-time";
    if (s === "contract") return "contract";
    if (s === "internship" || s === "intern") return "internship";
    return undefined;
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
    const tempId = `temp_${Date.now()}`;
    const newField: CustomField = {
      fieldId: tempId,
      label: "",
      inputType: "text",
      isRequired: false,
      displayOrder: jobForm.customFields.length + 1,
    };
    setJobForm((prev) => ({
      ...prev,
      customFields: [...prev.customFields, newField],
    }));
    // New fields start collapsed by default
    setCollapsedFields(prev => new Set(prev).add(jobForm.customFields.length));
    setEditingFieldIndex(jobForm.customFields.length);
  };

  // Recommended fields
  const { data: recommendedFields = [], isLoading: recommendedLoading } = useRecommendedFields();

  // Helper to convert API response objects to strings
  const convertToString = (value: any): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      // Check if it's a bilingual object {en: string, ar: string}
      if (value.en) return value.en;
      // Otherwise it's an indexed object
      return Object.keys(value)
        .filter(key => !isNaN(Number(key)) && key !== '_id')
        .sort((a, b) => Number(a) - Number(b))
        .map(key => value[key])
        .join('');
    }
    return '';
  };

  const convertChoicesArray = (choices: any): string[] => {
    if (!Array.isArray(choices)) return [];
    return choices.map((choice) => {
      if (typeof choice === 'object' && choice !== null && choice.en) {
        return choice.en;
      }
      return convertToString(choice);
    });
  };

  const convertChoicesArrayAr = (choices: any): string[] => {
    if (!Array.isArray(choices)) return [];
    return choices.map((choice) => {
      if (typeof choice === 'object' && choice !== null && choice.ar) {
        return choice.ar;
      }
      return convertToString(choice);
    });
  };

  const isRecommendedAdded = (fieldId: string) => {
    return jobForm.customFields.some((cf) => cf.fieldId === `rec_${fieldId}` || cf.fieldId === fieldId);
  };

  

  // Recommended selection panel state
  const [showRecommendedPanel, setShowRecommendedPanel] = useState(false);
  const [selectedRecommended, setSelectedRecommended] = useState<string[]>([]);

  const toggleSelectRecommended = (fieldId: string) => {
    setSelectedRecommended((prev) =>
      prev.includes(fieldId) ? prev.filter((n) => n !== fieldId) : [...prev, fieldId]
    );
  };

  const toggleFieldCollapse = (index: number) => {
    setCollapsedFields((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAddSelectedRecommended = () => {
    if (selectedRecommended.length === 0) return;
    const currentFieldCount = jobForm.customFields.length;
    setJobForm((prev) => {
      const additions: CustomField[] = [];
      let currentMax = prev.customFields.reduce((m, cf) => Math.max(m, cf.displayOrder || 0), 0);
      selectedRecommended.forEach((fieldId) => {
        if (prev.customFields.some((cf) => cf.fieldId === `rec_${fieldId}` || cf.fieldId === fieldId)) return;
        const rf = recommendedFields.find((r: any) => r.fieldId === fieldId);
        if (!rf) return;
        currentMax += 1;
        const newField: CustomField = {
          fieldId: `rec_${rf.fieldId}`,
          label: convertToString(rf.label) || "",
          labelAr: (rf.label && typeof rf.label === 'object' && rf.label.ar) ? rf.label.ar : convertToString(rf.label),
          inputType: rf.inputType as CustomField["inputType"],
          isRequired: rf.isRequired || false,
          minValue: rf.minValue,
          maxValue: rf.maxValue,
          choices: convertChoicesArray(rf.choices),
          choicesAr: convertChoicesArrayAr(rf.choices),
          subFields: (Array.isArray(rf.subFields) || Array.isArray((rf as any).groupFields))
            ? (rf.subFields || (rf as any).groupFields)?.map((g: any) => ({
                fieldId: g.fieldId || `sub_${Date.now()}`,
                label: convertToString(g.label) || "",
                labelAr: (g.label && typeof g.label === 'object' && g.label.ar) ? g.label.ar : convertToString(g.label),
                inputType: g.inputType as SubField["inputType"],
                isRequired: g.isRequired || false,
                choices: Array.isArray(g.choices) ? g.choices.map((c: any) => (typeof c === 'object' && c.en ? c.en : convertToString(c))) : [],
              }))
            : undefined,
          displayOrder: currentMax,
        };
        additions.push(newField);
      });
      return { ...prev, customFields: [...prev.customFields, ...additions] };
    });
    // Set newly added recommended fields to collapsed by default
    setCollapsedFields(prev => {
      const next = new Set(prev);
      for (let i = 0; i < selectedRecommended.length; i++) {
        next.add(currentFieldCount + i);
      }
      return next;
    });
    setSelectedRecommended([]);
    setShowRecommendedPanel(false);
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
    setJobForm((prev) => {
      const updatedFields = [...prev.customFields];
      updatedFields[index] = { ...updatedFields[index], [field]: value };
      return { ...prev, customFields: updatedFields };
    });
  };

  const handleAddChoice = (fieldIndex: number) => {
    const choice = newChoice[fieldIndex] || "";
    const choiceAr = newChoiceAr[fieldIndex] || "";
    if (choice.trim()) {
      setJobForm((prev) => ({
        ...prev,
        customFields: prev.customFields.map((cf, i) =>
          i === fieldIndex
            ? { 
                ...cf, 
                choices: [...(cf.choices || []), choice],
                choicesAr: jobForm.bilingual 
                  ? [...(cf.choicesAr || []), choiceAr.trim() || choice]
                  : cf.choicesAr
              }
            : cf
        ),
      }));
      setNewChoice(prev => ({ ...prev, [fieldIndex]: "" }));
      setNewChoiceAr(prev => ({ ...prev, [fieldIndex]: "" }));
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
    const key = `${fieldIndex}-${subFieldIndex}`;
    const choice = newSubFieldChoice[key] || "";
    const choiceAr = newSubFieldChoiceAr[key] || "";
    if (choice.trim()) {
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
                        choices: [...(sf.choices || []), choice],
                        choicesAr: jobForm.bilingual
                          ? [...(sf.choicesAr || []), choiceAr.trim() || choice]
                          : sf.choicesAr,
                      }
                    : sf
                ),
              }
            : cf
        ),
      }));
      setNewSubFieldChoice(prev => ({ ...prev, [key]: "" }));
      setNewSubFieldChoiceAr(prev => ({ ...prev, [key]: "" }));
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
      // Validate required fields
      if (!jobForm.companyId) {
        const errorMsg = "Please select a company before submitting.";
        setFormError(errorMsg);
        setJobStatus(`Error: ${errorMsg}`);
        setIsSubmitting(false);
        await Swal.fire({
          title: "Validation Error",
          text: errorMsg,
          icon: "error",
          confirmButtonText: "OK",
        });
        return;
      }

      if (!jobForm.departmentId) {
        const errorMsg = "Please select a department before submitting.";
        setFormError(errorMsg);
        setJobStatus(`Error: ${errorMsg}`);
        setIsSubmitting(false);
        await Swal.fire({
          title: "Validation Error",
          text: errorMsg,
          icon: "error",
          confirmButtonText: "OK",
        });
        return;
      }

      if (!isEditMode && !jobForm.jobCode?.trim()) {
        const errorMsg = "Job code is required.";
        setFormError(errorMsg);
        setJobStatus(`Error: ${errorMsg}`);
        setIsSubmitting(false);
        await Swal.fire({
          title: "Validation Error",
          text: errorMsg,
          icon: "error",
          confirmButtonText: "OK",
        });
        return;
      }

      if (!jobForm.title?.trim() || (jobForm.bilingual && !jobForm.titleAr?.trim())) {
        const errorMsg = jobForm.bilingual 
          ? "Job title (both English and Arabic) is required."
          : "Job title is required.";
        setFormError(errorMsg);
        setJobStatus(`Error: ${errorMsg}`);
        setIsSubmitting(false);
        await Swal.fire({
          title: "Validation Error",
          text: errorMsg,
          icon: "error",
          confirmButtonText: "OK",
        });
        return;
      }

      if (!jobForm.employmentType) {
        const errorMsg = "Employment type is required.";
        setFormError(errorMsg);
        setJobStatus(`Error: ${errorMsg}`);
        setIsSubmitting(false);
        await Swal.fire({
          title: "Validation Error",
          text: errorMsg,
          icon: "error",
          confirmButtonText: "OK",
        });
        return;
      }

      if (!jobForm.workArrangement) {
        const errorMsg = "Work arrangement is required.";
        setFormError(errorMsg);
        setJobStatus(`Error: ${errorMsg}`);
        setIsSubmitting(false);
        await Swal.fire({
          title: "Validation Error",
          text: errorMsg,
          icon: "error",
          confirmButtonText: "OK",
        });
        return;
      }

      if (!jobForm.registrationStart) {
        const errorMsg = "Registration start date is required.";
        setFormError(errorMsg);
        setJobStatus(`Error: ${errorMsg}`);
        setIsSubmitting(false);
        await Swal.fire({
          title: "Validation Error",
          text: errorMsg,
          icon: "error",
          confirmButtonText: "OK",
        });
        return;
      }

      if (!jobForm.registrationEnd) {
        const errorMsg = "Registration end date is required.";
        setFormError(errorMsg);
        setJobStatus(`Error: ${errorMsg}`);
        setIsSubmitting(false);
        await Swal.fire({
          title: "Validation Error",
          text: errorMsg,
          icon: "error",
          confirmButtonText: "OK",
        });
        return;
      }

      // Validate repeatable_group fields have labels
      const emptyGroupFieldLabels = jobForm.customFields
        .map((field, index) => ({ field, index }))
        .filter(({ field }) => field.inputType === "repeatable_group" && !field.label.trim());
      
      if (emptyGroupFieldLabels.length > 0) {
        const errorMsg = `Group Field #${emptyGroupFieldLabels[0].index + 1} must have a label.`;
        setFormError(errorMsg);
        setJobStatus(`Error: ${errorMsg}`);
        setIsSubmitting(false);
        await Swal.fire({
          title: "Validation Error",
          text: errorMsg,
          icon: "error",
          confirmButtonText: "OK",
        });
        return;
      }

      const salaryValue = Number(jobForm.salary);

      const payload: any = {};
      // Only include companyId and jobCode when creating (not updating)
      if (!isEditMode) {
        payload.companyId = jobForm.companyId;
        if (jobForm.jobCode) payload.jobCode = jobForm.jobCode;
      }
      payload.title = jobForm.bilingual ? { en: jobForm.title || "", ar: jobForm.titleAr || "" } : { en: jobForm.title || "", ar: "" };
      payload.description = jobForm.bilingual ? { en: jobForm.description || "", ar: jobForm.descriptionAr || "" } : { en: jobForm.description || "", ar: "" };
      // Send departmentId as empty string if not selected
      payload.departmentId = jobForm.departmentId || "";
      payload.termsAndConditions = jobForm.termsAndConditions
        .filter((term, idx) => term.trim() || (jobForm.bilingual && jobForm.termsAndConditionsAr[idx]?.trim()))
        .map((t, idx) => ({ en: t, ar: jobForm.bilingual ? (jobForm.termsAndConditionsAr[idx] || t) : "" }));
      payload.salary = isNaN(salaryValue) ? undefined : salaryValue;
      payload.salaryVisible = jobForm.salaryVisible;
      payload.openPositions = jobForm.openPositions;
      payload.registrationStart = jobForm.registrationStart;
      payload.registrationEnd = jobForm.registrationEnd;
      payload.jobSpecs = jobForm.jobSpecs
        .filter((spec) => spec.spec.trim() || (jobForm.bilingual && spec.specAr?.trim()))
        .map((spec) => ({
          spec: jobForm.bilingual ? { en: spec.spec || "", ar: spec.specAr || spec.spec || "" } : { en: spec.spec || "", ar: "" },
          weight: spec.weight,
        }));
      payload.customFields = jobForm.customFields.map((cf) => ({
        fieldId: cf.fieldId,
        label: jobForm.bilingual ? { en: cf.label || "", ar: cf.labelAr || cf.label || "" } : { en: cf.label || "", ar: "" },
        inputType: cf.inputType,
        isRequired: cf.isRequired,
        minValue: cf.minValue,
        maxValue: cf.maxValue,
        choices: Array.isArray(cf.choices)
          ? jobForm.bilingual
            ? cf.choices.map((c, i) => ({ en: c, ar: cf.choicesAr?.[i] || c }))
            : cf.choices.map((c) => ({ en: c, ar: "" }))
          : [],
        groupFields: Array.isArray(cf.subFields)
          ? cf.subFields.map((sf) => ({
              fieldId: sf.fieldId,
              label: jobForm.bilingual ? { en: sf.label || "", ar: sf.labelAr || sf.label || "" } : { en: sf.label || "", ar: "" },
              inputType: sf.inputType,
              isRequired: sf.isRequired,
              choices: Array.isArray(sf.choices)
                ? jobForm.bilingual
                  ? sf.choices.map((c, i) => ({ en: c, ar: sf.choicesAr?.[i] || c }))
                  : sf.choices.map((c) => ({ en: c, ar: "" }))
                : [],
            }))
          : [],
        displayOrder: cf.displayOrder,
      }));
      payload.employmentType = jobForm.employmentType;
      payload.workArrangement = jobForm.workArrangement;
      payload.bilingual = jobForm.bilingual;

      if (isEditMode && editJobId) {
        // Update existing job
        await updateJobMutation.mutateAsync({ id: editJobId, data: payload });
        setJobStatus("Job updated successfully");
      } else {
        // Ensure backend receives creator info
        try {
          const createdBy = (user as any)?._id ?? (user as any)?.id ?? undefined;
          if (createdBy) payload.createdBy = createdBy;
        } catch (e) {
          // ignore
        }
        // Create new job with optimistic update
        await createJobMutation.mutateAsync(payload);
        setJobStatus("Job created successfully");
      }

      // Show toast notification
      Swal.fire({
        title: "Success!",
        text: isEditMode
          ? "Job updated successfully."
          : "Job created successfully.",
        icon: "success",
        position: "top-end",
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        customClass: {
          container: "!mt-16",
        },
      });

      // Navigate immediately
      navigate("/jobs");
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setFormError(errorMsg);
      setJobStatus(`Error: ${errorMsg}`);
      console.error(`Error ${isEditMode ? "updating" : "creating"} job:`, err);
    } finally {
      setIsSubmitting(false);
    }
  };

 

  const totalWeight = jobForm.jobSpecs.reduce(
    (sum, spec) => sum + spec.weight,
    0
  );

  return (
    <div className="space-y-6">
      <PageMeta
        title={`${isEditMode ? "Edit" : "Create"} Job | Saber Group - Hiring Management System`}
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

          {/* Job Duplication */}
          {!isEditMode && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Label htmlFor="duplicateJob" className="mb-2">
                Duplicate from existing job (optional)
              </Label>
              <Select
                options={[
                  { value: "", label: "-- Start from scratch --" },
                  ...allJobs.map((job: any) => ({
                    value: job._id,
                    label: `${toPlainString(job.title)} - ${toPlainString((job as any).companyId?.name || '')}`,
                  })),
                ]}
                value={selectedJobId}
                onChange={handleJobSelect}
                placeholder="Select a job to duplicate"
              />
              {jobsLoading && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Loading jobs...
                </p>
              )}
              {selectedJobId && (
                <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                  ✓ Job data loaded. You can edit the fields below before saving.
                </p>
              )}
            </div>
          )}

          {/* Company & Department Selection */}
          <ComponentCard
            title={isEditMode ? "Department" : "Company & Department"}
            desc={isEditMode ? "Select the department" : "Select the company and department"}
          >
            <div className={`grid grid-cols-1 gap-4 ${!isEditMode && shouldShowCompanyField ? 'md:grid-cols-2' : ''}`}>
              {/* Only show company field if not in edit mode AND (user is admin OR has multiple companies) */}
              {!isEditMode && shouldShowCompanyField && (
                <div>
                  <Label htmlFor="companyId" required>Company</Label>
                  {companies.length > 0 ? (
                    <Select
                      options={companies}
                      placeholder="Select company"
                      value={jobForm.companyId}
                      onChange={(value) => {
                        handleInputChange("companyId", value);
                        handleInputChange("departmentId", ""); // Reset department when company changes
                      }}
                      required
                    />
                  ) : (
                    <Input
                      id="companyId"
                      value="No companies available"
                      disabled={true}
                      className="bg-gray-50 dark:bg-gray-800"
                    />
                  )}
                </div>
              )}
              <div>
                <Label htmlFor="departmentId" required>Department</Label>
                <div className={departmentSelectDisabled ? "opacity-50 pointer-events-none" : ""}>
                  <Select
                    options={departments}
                    value={jobForm.departmentId}
                    placeholder={
                      departmentsLoading
                        ? "Loading departments..."
                        : !jobForm.companyId && shouldFetchAllDepartments
                        ? "Select company first"
                        : departments.length === 0
                        ? "No departments available"
                        : "Select department "
                    }
                    onChange={(value) => {
                      if (!departmentSelectDisabled) handleInputChange("departmentId", value);
                    }}
                    required
                  />
                  
                </div>
              </div>
            </div>
          </ComponentCard>

          {/* Basic Job Information */}
          <ComponentCard title="Basic Information" desc="Enter the job details">
            <div className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <Switch
                  label="Bilingual Job (English & Arabic)"
                  checked={jobForm.bilingual}
                  onChange={(checked) => handleInputChange("bilingual", checked)}
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {jobForm.bilingual ? "Showing bilingual inputs" : "Showing English only"}
                </span>
              </div>

              {/* Only show Job Code field when creating a new job */}
              {!isEditMode && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="jobCode" required>Job Code</Label>
                    <Input
                      id="jobCode"
                      value={jobForm.jobCode}
                      onChange={(e) =>
                        handleInputChange("jobCode", e.target.value)
                      }
                      placeholder="Auto-generated"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Auto-generated based on company. You can edit it if needed.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="title" required>Job Title{jobForm.bilingual && " (English)"}</Label>
                  <Input
                    id="title"
                    value={jobForm.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="Senior Frontend Developer"
                    required
                  />
                </div>
                {jobForm.bilingual && (
                  <div>
                    <Label htmlFor="titleAr" required>Job Title (Arabic)</Label>
                    <div dir="rtl">
                      <Input
                        id="titleAr"
                        value={jobForm.titleAr}
                        onChange={(e) => handleInputChange("titleAr", e.target.value)}
                        placeholder="مطور واجهة أمامية أول"
                        required
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
                    checked={jobForm.salaryVisible}
                    onChange={(checked) =>
                      handleInputChange("salaryVisible", checked)
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="employmentType" required>Employment Type</Label>
                  <Select
                      options={[
                        { value: "full-time", label: "Full-time" },
                        { value: "part-time", label: "Part-time" },
                        { value: "contract", label: "Contract" },
                        { value: "internship", label: "Internship" },
                      ]}
                    value={jobForm.employmentType}
                    placeholder="Select employment type"
                    onChange={(val) => handleInputChange("employmentType", val)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="workArrangement" required>Work Arrangement</Label>
                  <Select
                    options={[
                      { value: "on-site", label: "On-site" },
                      { value: "remote", label: "Remote" },
                      { value: "hybrid", label: "Hybrid" },
                    ]}
                    value={jobForm.workArrangement}
                    placeholder="Select work arrangement"
                    onChange={(val) => handleInputChange("workArrangement", val)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="registrationStart" required>Registration Start</Label>
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
                  <Label htmlFor="registrationEnd" required>Registration End</Label>
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
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                setEditingTermIndex(null);
                              }
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
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    setEditingTermIndex(null);
                                  }
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
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                setEditingTermIndex(null);
                              }
                            }}
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
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                setEditingSpecIndex(null);
                              }
                            }}
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
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              setEditingSpecIndex(null);
                            }
                          }}
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
                  className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-brand-700"
                >
                  <PlusIcon className="size-4" />
                  Add Custom Field
                </button>
                <div className="ml-2 relative">
                  <button
                    type="button"
                    onClick={() => setShowRecommendedPanel((s) => !s)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Recommended
                  </button>

                  {showRecommendedPanel && (
                    <div className="absolute right-0 mt-2 w-80 rounded-md border bg-white p-3 shadow-lg z-50">
                      <div className="max-h-64 overflow-auto">
                        {recommendedLoading ? (
                          <div className="text-sm text-gray-500">Loading...</div>
                        ) : (
                          recommendedFields.map((rf: any, idx: number) => {
                            const fieldId = rf.fieldId;
                            const disabled = isRecommendedAdded(fieldId);
                            const checked = selectedRecommended.includes(fieldId);
                            const inputId = `rec_${idx}_${fieldId}`;
                            return (
                              <label key={`${fieldId}_${idx}`} htmlFor={inputId} className={`flex items-center justify-between gap-3 py-2 ${disabled ? 'opacity-60' : ''}`}>
                                <div className="flex items-center gap-3">
                                  <input
                                    id={inputId}
                                    type="checkbox"
                                    checked={disabled || checked}
                                    disabled={disabled}
                                    onChange={() => toggleSelectRecommended(fieldId)}
                                    className="h-4 w-4 rounded border-gray-300 text-brand-600"
                                  />
                                  <div className="text-sm">
                                    <div className="font-medium">{convertToString(rf.label) || fieldId}</div>
                                    {rf.description && <div className="text-xs text-gray-500">{convertToString(rf.description)}</div>}
                                  </div>
                                </div>
                                {disabled && <span className="text-xs text-green-600">Added</span>}
                              </label>
                            );
                          })
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => { setSelectedRecommended([]); setShowRecommendedPanel(false); }}
                          className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddSelectedRecommended}
                          disabled={selectedRecommended.length === 0}
                          className="rounded bg-brand-500 px-3 py-1 text-sm text-white disabled:opacity-50"
                        >
                          Add Selected
                        </button>
                      </div>
                    </div>
                  )}
                </div>
            </div>

            <div className="space-y-4">
              {jobForm.customFields.map((field, fieldIndex) => {
                const isCollapsed = collapsedFields.has(fieldIndex);
                return (
                  <div
                    key={field.fieldId}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleFieldCollapse(fieldIndex)}
                            className="rounded p-1 text-gray-600 transition hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                            title={isCollapsed ? "Expand" : "Collapse"}
                          >
                            <svg
                              className={`size-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Field #{fieldIndex + 1}{field.label && `: ${field.label}`}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomField(fieldIndex)}
                          className="rounded p-1 text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                        >
                          <TrashBinIcon className="size-4" />
                        </button>
                      </div>

                      {!isCollapsed && (
                        <>
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
                      field.inputType === "dropdown") && (
                      <div>
                        <div className={`grid gap-3 ${jobForm.bilingual ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                          <div>
                            <Label>Choices{jobForm.bilingual && " (English)"}</Label>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Input
                                  value={newChoice[fieldIndex] || ""}
                                  onChange={(e) => setNewChoice(prev => ({ ...prev, [fieldIndex]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleAddChoice(fieldIndex);
                                    }
                                  }}
                                  placeholder="Add a choice"
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
                          {jobForm.bilingual && (
                            <div>
                              <Label>Choices (Arabic)</Label>
                              <div className="flex gap-2">
                                <div dir="rtl" className="flex-1">
                                  <Input
                                    value={newChoiceAr[fieldIndex] || ""}
                                    onChange={(e) => setNewChoiceAr(prev => ({ ...prev, [fieldIndex]: e.target.value }))}
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
                        </div>
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
                    {field.inputType === "repeatable_group" && (
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

                                {/* Sub-field choices for radio, checkbox, dropdown */}
                                {(subField.inputType === "radio" ||
                                  subField.inputType === "checkbox" ||
                                  subField.inputType === "dropdown") && (
                                  <div>
                                    <Label>Choices{jobForm.bilingual && " (English)"}</Label>
                                    <div className="flex gap-2">
                                      <Input
                                        value={newSubFieldChoice[`${fieldIndex}-${subFieldIndex}`] || ""}
                                        onChange={(e) =>
                                          setNewSubFieldChoice(prev => ({ ...prev, [`${fieldIndex}-${subFieldIndex}`]: e.target.value }))
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
                                              value={newSubFieldChoiceAr[`${fieldIndex}-${subFieldIndex}`] || ""}
                                              onChange={(e) =>
                                                setNewSubFieldChoiceAr(prev => ({ ...prev, [`${fieldIndex}-${subFieldIndex}`]: e.target.value }))
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
                        </div>
                      </div>
                    )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
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


            </div>
          </ComponentCard>
        </form>
      )}
    </div>
  );
}
