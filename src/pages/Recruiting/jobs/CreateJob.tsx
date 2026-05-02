import { useMemo, useState, useEffect, useRef } from "react";
import Swal from '../../../utils/swal';
import { useNavigate, useSearchParams, useLocation } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import TextArea from "../../../components/form/input/TextArea";
import Switch from "../../../components/form/switch/Switch";
import Select from "../../../components/form/Select";
import MultiSelect from "../../../components/form/MultiSelect";
import { PlusIcon, TrashBinIcon, CheckCircleIcon } from "../../../icons";
import { useAuth } from "../../../context/AuthContext";
import { jobPositionsService } from "../../../services/jobPositionsService";
import {
  useCompanies,
  useDepartments,
} from "../../../hooks/queries";
import { useSavedFields } from "../../../hooks/queries";
import { useRecommendedFields } from "../../../hooks/queries/useSystemSettings";
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

type CompanyStatus = {
  _id?: string;
  id?: string;
  name?: string;
};

type FieldConfigRule = {
  visible: boolean;
  required: boolean;
};

type FieldConfig = {
  fullName: FieldConfigRule;
  email: FieldConfigRule;
  phone: FieldConfigRule;
  gender: FieldConfigRule;
  birthDate: FieldConfigRule;
  address: FieldConfigRule;
  profilePhoto: FieldConfigRule;
  cvFilePath: FieldConfigRule;
  expectedSalary: FieldConfigRule;
};

const getDefaultFieldConfig = (): FieldConfig => ({
  fullName: { visible: true, required: true },
  email: { visible: true, required: true },
  phone: { visible: true, required: true },
  gender: { visible: true, required: true },
  birthDate: { visible: true, required: true },
  address: { visible: true, required: true },
  profilePhoto: { visible: true, required: true },
  cvFilePath: { visible: true, required: false },
  expectedSalary: { visible: false, required: false },
});

const applicantFieldConfigMeta: Array<{
  key: keyof FieldConfig;
  label: string;
  description: string;
}> = [
  {
    key: "fullName",
    label: "Full Name",
    description: "Candidate legal name field.",
  },
  {
    key: "email",
    label: "Email",
    description: "Primary contact email address.",
  },
  {
    key: "phone",
    label: "Phone",
    description: "Phone number used for recruiter outreach.",
  },
  {
    key: "gender",
    label: "Gender",
    description: "Demographic gender selection field.",
  },
  {
    key: "birthDate",
    label: "Birth Date",
    description: "Candidate date of birth field.",
  },
  {
    key: "address",
    label: "Address",
    description: "Current residence details.",
  },
  {
    key: "profilePhoto",
    label: "Profile Photo",
    description: "Profile image upload control.",
  },
  {
    key: "cvFilePath",
    label: "CV Upload",
    description: "Resume or CV file attachment.",
  },
  {
    key: "expectedSalary",
    label: "Expected Salary",
    description: "Candidate salary expectation input.",
  },
];

const normalizeFieldConfig = (
  value: any,
  legacySalaryFieldVisible?: boolean
): FieldConfig => {
  const defaults = getDefaultFieldConfig();
  const raw = value && typeof value === "object" ? value : {};

  const withExpectedSalaryFallback = {
    ...raw,
    expectedSalary:
      raw.expectedSalary && typeof raw.expectedSalary === "object"
        ? raw.expectedSalary
        : typeof legacySalaryFieldVisible === "boolean"
        ? {
            visible: legacySalaryFieldVisible,
            required: false,
          }
        : raw.expectedSalary,
  };

  const normalizeRule = (
    incoming: any,
    fallback: FieldConfigRule
  ): FieldConfigRule => {
    const visible =
      typeof incoming?.visible === "boolean" ? incoming.visible : fallback.visible;
    const required =
      typeof incoming?.required === "boolean"
        ? incoming.required
        : fallback.required;

    return {
      visible,
      required: visible ? required : false,
    };
  };

  return {
    fullName: normalizeRule(withExpectedSalaryFallback.fullName, defaults.fullName),
    email: normalizeRule(withExpectedSalaryFallback.email, defaults.email),
    phone: normalizeRule(withExpectedSalaryFallback.phone, defaults.phone),
    gender: normalizeRule(withExpectedSalaryFallback.gender, defaults.gender),
    birthDate: normalizeRule(withExpectedSalaryFallback.birthDate, defaults.birthDate),
    address: normalizeRule(withExpectedSalaryFallback.address, defaults.address),
    profilePhoto: normalizeRule(
      withExpectedSalaryFallback.profilePhoto,
      defaults.profilePhoto
    ),
    cvFilePath: normalizeRule(withExpectedSalaryFallback.cvFilePath, defaults.cvFilePath),
    expectedSalary: normalizeRule(
      withExpectedSalaryFallback.expectedSalary,
      defaults.expectedSalary
    ),
  };
};

const normalizeStatusLabel = (value: any): string =>
  toPlainString(value).trim().toLowerCase();

const normalizeAllowedStatuses = (
  value: any,
  companyStatuses: CompanyStatus[] = []
): string[] => {
  const rawValues = Array.isArray(value) ? value : [];
  if (rawValues.length === 0) return [];

  const statusMap = new Map<string, string>();
  companyStatuses.forEach((status) => {
    const statusId = String(status?._id || status?.id || '').trim();
    if (!statusId) return;
    statusMap.set(statusId, statusId);
    const statusName = normalizeStatusLabel(status?.name);
    if (statusName) statusMap.set(statusName, statusId);
  });

  return rawValues
    .map((entry) => {
      if (!entry) return '';
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        return statusMap.get(trimmed) || statusMap.get(normalizeStatusLabel(trimmed)) || trimmed;
      }
      if (typeof entry === 'object') {
        const id = String(entry._id || entry.id || '').trim();
        if (id) return id;
        const name = normalizeStatusLabel(entry.name);
        return statusMap.get(name) || name;
      }
      return String(entry).trim();
    })
    .filter(Boolean);
};

const getPendingStatusId = (statuses: CompanyStatus[]): string | null => {
  if (!Array.isArray(statuses) || statuses.length === 0) return null;
  const pendingStatus = statuses.find(
    (status) => normalizeStatusLabel(status?.name) === 'pending'
  );
  return pendingStatus ? String(pendingStatus._id || pendingStatus.id || '').trim() : null;
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
  fieldConfig: FieldConfig;
  bilingual: boolean;
  openPositions: number;
  registrationStart: string;
  registrationEnd: string;
  allowedStatuses: string[];
  hideAfterRegistrationEnd: boolean;
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
    fieldConfig: getDefaultFieldConfig(),
    bilingual: false,
    openPositions: 1,
    registrationStart: "",
    registrationEnd: "",
    allowedStatuses: [],
    hideAfterRegistrationEnd: false,
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
  const { data: allJobs = [], isLoading: jobsLoading } = useJobPositions(companyIdForJobQuery, false);
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

  const getJobCompanyId = (job: any): string => {
    const companyValue = job?.companyId;
    if (typeof companyValue === "string") return companyValue;
    if (companyValue && typeof companyValue === "object") {
      return companyValue._id || companyValue.id || "";
    }
    return "";
  };

  const nextCompanyOrder = useMemo(() => {
    if (!jobForm.companyId) return 1;

    const sameCompanyJobs = (allJobs as any[]).filter((job: any) => {
      const jobCompanyId = getJobCompanyId(job);
      if (!jobCompanyId || jobCompanyId !== jobForm.companyId) return false;
      if (editJobId && job?._id === editJobId) return false;
      return true;
    });

    const usedOrders = new Set(
      sameCompanyJobs
        .map((job: any) => Number(job?.order))
        .filter((value) => Number.isFinite(value) && value > 0)
    );

    // Business rule: next order should follow same-company count (2 jobs -> next is 3).
    let nextOrder = sameCompanyJobs.length + 1;

    // Safety guard if data already contains conflicting order values.
    while (usedOrders.has(nextOrder)) {
      nextOrder += 1;
    }

    return nextOrder;
  }, [allJobs, editJobId, jobForm.companyId]);

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
        fieldConfig: getDefaultFieldConfig(),
        bilingual: false,
        openPositions: 1,
        registrationStart: "",
        registrationEnd: "",
        allowedStatuses: [],
        hideAfterRegistrationEnd: false,
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
        fieldConfig: normalizeFieldConfig(
          (selectedJob as any).fieldConfig,
          (selectedJob as any).salaryFieldVisible
        ),
        bilingual: selectedJob.bilingual ?? false,
        openPositions: selectedJob.openPositions || 1,
        registrationStart: selectedJob.registrationStart ? new Date(selectedJob.registrationStart).toISOString().split("T")[0] : "",
        registrationEnd: selectedJob.registrationEnd ? new Date(selectedJob.registrationEnd).toISOString().split("T")[0] : "",
        allowedStatuses: Array.isArray((selectedJob as any).allowedStatuses)
          ? (selectedJob as any).allowedStatuses.map((status: any) => String(status || '').trim()).filter(Boolean)
          : [],
        hideAfterRegistrationEnd: Boolean((selectedJob as any).hideAfterRegistrationEnd),
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
              displayOrder: cf.displayOrder ?? cf.order ?? 0,
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
            fieldConfig: normalizeFieldConfig(
              (job as any).fieldConfig,
              (job as any).salaryFieldVisible
            ),
            bilingual: job.bilingual ?? false,
            openPositions: job.openPositions || 1,
            registrationStart: formatDateForInput(job.registrationStart),
            registrationEnd: formatDateForInput(job.registrationEnd),
            allowedStatuses: Array.isArray((job as any).allowedStatuses)
              ? (job as any).allowedStatuses.map((status: any) => String(status || '').trim()).filter(Boolean)
              : [],
            hideAfterRegistrationEnd: Boolean((job as any).hideAfterRegistrationEnd),
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
                  displayOrder: cf.displayOrder ?? cf.order ?? 0,
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

  const selectedCompany = useMemo(() => {
    if (!jobForm.companyId) return null;
    return (allCompanies as any[]).find((company: any) => company._id === jobForm.companyId) || null;
  }, [allCompanies, jobForm.companyId]);

  const allowedStatusOptions = useMemo(() => {
    const rawStatuses = Array.isArray(selectedCompany?.settings?.statuses)
      ? selectedCompany.settings.statuses
      : [];

    return rawStatuses
      .map((status: CompanyStatus) => {
        const value = String(status?._id || status?.id || '').trim();
        if (!value) return null;
        return {
          value,
          text: toPlainString(status?.name) || value,
        };
      })
      .filter(Boolean) as Array<{ value: string; text: string }>;
  }, [selectedCompany]);

  useEffect(() => {
    if (!jobForm.companyId) return;
    setJobForm((prev) => {
      const normalized = normalizeAllowedStatuses(prev.allowedStatuses, selectedCompany?.settings?.statuses || []);
      const sameLength = normalized.length === (Array.isArray(prev.allowedStatuses) ? prev.allowedStatuses.length : 0);
      const sameValues = sameLength && normalized.every((value, index) => value === prev.allowedStatuses[index]);
      if (sameValues) return prev;
      return { ...prev, allowedStatuses: normalized };
    });
  }, [jobForm.companyId, selectedCompany]);

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

  const handleFieldConfigChange = (
    field: keyof FieldConfig,
    prop: keyof FieldConfigRule,
    value: boolean
  ) => {
    setJobForm((prev) => {
      const currentRule = prev.fieldConfig[field] ?? { visible: false, required: false };
      const nextRule = {
        ...currentRule,
        [prop]: value,
      };

      if (prop === "visible" && !value) {
        nextRule.required = false;
      }

      return {
        ...prev,
        fieldConfig: {
          ...prev.fieldConfig,
          [field]: nextRule,
        },
      };
    });
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

  // Saved fields (same UI/logic as recommended fields but for user's saved fields)
  const { data: savedFields = [], isLoading: savedFieldsLoading } = useSavedFields();
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [selectedSaved, setSelectedSaved] = useState<string[]>([]);

  const toggleSelectSaved = (fieldId: string) => {
    setSelectedSaved((prev) => (prev.includes(fieldId) ? prev.filter((n) => n !== fieldId) : [...prev, fieldId]));
  };

  const isSavedAdded = (fieldId: string) => {
    return jobForm.customFields.some((cf) => cf.fieldId === `sav_${fieldId}` || cf.fieldId === fieldId);
  };

  const handleAddSelectedSaved = () => {
    if (selectedSaved.length === 0) return;
    const currentFieldCount = jobForm.customFields.length;
    setJobForm((prev) => {
      const additions: CustomField[] = [];
      let currentMax = prev.customFields.reduce((m, cf) => Math.max(m, cf.displayOrder || 0), 0);
      selectedSaved.forEach((fieldId) => {
        if (prev.customFields.some((cf) => cf.fieldId === `sav_${fieldId}` || cf.fieldId === fieldId)) return;
        const sf = (savedFields as any).find((s: any) => s.fieldId === fieldId);
        if (!sf) return;
        currentMax += 1;
        const newField: CustomField = {
          fieldId: `sav_${sf.fieldId}`,
          label: convertToString(sf.label) || "",
          labelAr: (sf.label && typeof sf.label === 'object' && sf.label.ar) ? sf.label.ar : convertToString(sf.label),
          inputType: sf.inputType as CustomField['inputType'],
          isRequired: sf.isRequired || false,
          minValue: sf.minValue,
          maxValue: sf.maxValue,
          choices: convertChoicesArray(sf.choices),
          choicesAr: convertChoicesArrayAr(sf.choices),
          subFields: Array.isArray(sf.groupFields)
            ? sf.groupFields.map((g: any) => ({
                fieldId: g.fieldId || `sub_${Date.now()}`,
                label: convertToString(g.label) || "",
                labelAr: (g.label && typeof g.label === 'object' && g.label.ar) ? g.label.ar : convertToString(g.label),
                inputType: g.inputType as SubField['inputType'],
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
    // collapse newly added
    setCollapsedFields(prev => {
      const next = new Set(prev);
      for (let i = 0; i < selectedSaved.length; i++) {
        next.add(currentFieldCount + i);
      }
      return next;
    });
    setSelectedSaved([]);
    setShowSavedPanel(false);
  };

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

      if (!isEditMode && jobsLoading) {
        const errorMsg = "Please wait, loading existing company jobs to assign order.";
        setFormError(errorMsg);
        setJobStatus(`Error: ${errorMsg}`);
        setIsSubmitting(false);
        await Swal.fire({
          title: "Please wait",
          text: errorMsg,
          icon: "info",
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

      const makeBilingualObject = (en: any, ar?: any) =>
        jobForm.bilingual ? { en: en ?? "", ar: ar ?? en ?? "" } : { en: en ?? "" };

      const buildChoices = (choices: any, choicesAr?: any) => {
        const out: any[] = [];
        if (!Array.isArray(choices)) return out;
        choices.forEach((c: any, i: number) => {
          const enVal = (typeof c === "string" ? c : (c?.en || "") + "").toString().trim();
          const arVal = (Array.isArray(choicesAr) ? (choicesAr[i] || "") : (typeof c === "object" && c?.ar ? c.ar : "")).toString().trim();
          if (jobForm.bilingual) {
            if (!enVal && !arVal) return;
            out.push({ en: enVal || arVal, ar: arVal || enVal });
          } else {
            if (!enVal) return;
            out.push({ en: enVal });
          }
        });
        return out;
      };

      const payload: any = {};
      // Only include companyId and jobCode when creating (not updating)
      if (!isEditMode) {
        payload.companyId = jobForm.companyId;
        if (jobForm.jobCode) payload.jobCode = jobForm.jobCode;
        payload.order = nextCompanyOrder;
      }
      payload.title = makeBilingualObject(jobForm.title, jobForm.titleAr);
      payload.description = makeBilingualObject(jobForm.description, jobForm.descriptionAr);
      // Send departmentId as empty string if not selected
      payload.departmentId = jobForm.departmentId || "";
      payload.termsAndConditions = jobForm.termsAndConditions
        .filter((term, idx) => term.trim() || (jobForm.bilingual && jobForm.termsAndConditionsAr[idx]?.trim()))
        .map((t, idx) => makeBilingualObject(t, jobForm.termsAndConditionsAr[idx] || t));
      payload.salary = isNaN(salaryValue) ? undefined : salaryValue;
      payload.salaryVisible = jobForm.salaryVisible;
      payload.fieldConfig = normalizeFieldConfig(jobForm.fieldConfig);
      payload.openPositions = jobForm.openPositions;
      payload.registrationStart = jobForm.registrationStart;
      payload.registrationEnd = jobForm.registrationEnd;
      payload.allowedStatuses = Array.isArray(jobForm.allowedStatuses)
        ? jobForm.allowedStatuses.filter(Boolean)
        : [];
      payload.hideAfterRegistrationEnd = Boolean(jobForm.hideAfterRegistrationEnd);
      payload.jobSpecs = jobForm.jobSpecs
        .filter((spec) => spec.spec.trim() || (jobForm.bilingual && spec.specAr?.trim()))
        .map((spec) => ({
          spec: makeBilingualObject(spec.spec, spec.specAr || spec.spec),
          weight: spec.weight,
        }));
      payload.customFields = jobForm.customFields.map((cf) => ({
        fieldId: cf.fieldId,
        label: makeBilingualObject(cf.label, cf.labelAr || cf.label),
        inputType: cf.inputType,
        isRequired: cf.isRequired,
        minValue: cf.minValue,
        maxValue: cf.maxValue,
        choices: buildChoices(cf.choices, cf.choicesAr),
        groupFields: Array.isArray(cf.subFields)
          ? cf.subFields.map((sf) => ({
              fieldId: sf.fieldId,
              label: makeBilingualObject(sf.label, sf.labelAr || sf.label),
              inputType: sf.inputType,
              isRequired: sf.isRequired,
              choices: buildChoices(sf.choices, sf.choicesAr),
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
        <form onSubmit={handleSubmit} className="space-y-8">
          {formError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800/30 dark:bg-red-900/10">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <svg className="size-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">
                    {formError}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormError("")}
                  className="rounded-md p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-800/20"
                >
                  <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Job Duplication */}
          {!isEditMode && (
            <div className="group relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-white p-6 shadow-sm transition-all hover:shadow-md dark:border-blue-900/20 dark:from-blue-900/5 dark:to-gray-900">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="size-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
              </div>
              <div className="relative">
                <Label htmlFor="duplicateJob" className="mb-3 block text-sm font-semibold text-blue-900 dark:text-blue-300">
                  Quick Start: Duplicate existing job
                </Label>
                <div className="max-w-2xl">
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
                </div>
                {jobsLoading && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-blue-600 animate-pulse">
                    <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                    Loading jobs...
                  </div>
                )}
                {selectedJobId && (
                  <div className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Job templates loaded successfully. You can now refine the details below.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Company & Department Selection */}
          <div className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {isEditMode ? "Department" : "Company & Organization"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isEditMode ? "Assigned department for this position" : "Specify where this position belongs"}
                </p>
              </div>
              <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-500/10">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>

            <div className={`grid grid-cols-1 gap-6 ${!isEditMode && shouldShowCompanyField ? 'md:grid-cols-2' : ''}`}>
              {!isEditMode && shouldShowCompanyField && (
                <div className="space-y-2">
                  <Label htmlFor="companyId" required>Target Company</Label>
                  {companies.length > 0 ? (
                  <Select
                      options={companies}
                      placeholder="Select company"
                      value={jobForm.companyId}
                      onChange={(value) => {
                        handleInputChange("companyId", value);
                        handleInputChange("departmentId", "");
                        const companyData = jobForm.companyId === value 
                          ? selectedCompany 
                          : allCompanies.find((c: any) => c._id === value);
                        const pendingStatusId = companyData 
                          ? getPendingStatusId(companyData.settings?.statuses || [])
                          : null;
                        handleInputChange("allowedStatuses", pendingStatusId ? [pendingStatusId] : []);
                      }}
                      required
                    />
                  ) : (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-500 dark:border-gray-700 dark:bg-gray-800/50">
                      No companies available
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="departmentId" required>Department</Label>
                <div className={departmentSelectDisabled ? "opacity-50 grayscale pointer-events-none" : ""}>
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
                        : "Select department"
                    }
                    onChange={(value) => {
                      if (!departmentSelectDisabled) handleInputChange("departmentId", value);
                    }}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Basic Job Information */}
          <div className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Basic Information</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Core details and multilingual settings</p>
              </div>
              <div className="rounded-xl bg-orange-50 p-2.5 text-orange-600 dark:bg-orange-500/10">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-6 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/50">
                <div className="flex items-center gap-3">
                  <Switch
                    label="Bilingual (English & Arabic)"
                    checked={jobForm.bilingual}
                    onChange={(checked) => handleInputChange("bilingual", checked)}
                  />
                </div>
                <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Currently viewing: {jobForm.bilingual ? 
                    <span className="inline-flex items-center gap-1.5 text-brand-600"><span className="flex h-2 w-2 rounded-full bg-brand-500" />Bilingual Mode</span> : 
                    <span className="inline-flex items-center gap-1.5 text-gray-600"><span className="flex h-2 w-2 rounded-full bg-gray-400" />English Only</span>
                  }
                </span>
              </div>

              {!isEditMode && (
                <div className="max-w-md space-y-2">
                  <Label htmlFor="jobCode" required>Position Reference Code</Label>
                  <Input
                    id="jobCode"
                    value={jobForm.jobCode}
                    onChange={(e) => handleInputChange("jobCode", e.target.value)}
                    placeholder="Auto-generated (e.g., TECH-2024-001)"
                    required
                  />
                  <p className="text-xs text-gray-500 italic">
                    Unique identifier used for tracking this recruitment cycle.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title" required>Job Title {jobForm.bilingual && "(EN)"}</Label>
                  <Input
                    id="title"
                    value={jobForm.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="e.g. Senior Frontend Developer"
                    required
                  />
                </div>
                {jobForm.bilingual && (
                  <div className="space-y-2" dir="rtl">
                    <Label htmlFor="titleAr" required className="text-right block w-full">مسمى الوظيفة (بالعربية)</Label>
                    <Input
                      id="titleAr"
                      value={jobForm.titleAr}
                      onChange={(e) => handleInputChange("titleAr", e.target.value)}
                      placeholder="مثال: مطور واجهة أمامية أول"
                      required
                      className="text-right"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="description">Job Description {jobForm.bilingual && "(EN)"}</Label>
                  <TextArea
                    value={jobForm.description}
                    onChange={(value) => handleInputChange("description", value)}
                    placeholder="Outline the primary responsibilities and goals..."
                    rows={6}
                  />
                </div>
                {jobForm.bilingual && (
                  <div className="space-y-2" dir="rtl">
                    <Label htmlFor="descriptionAr" className="text-right block w-full">وصف الوظيفة (بالعربية)</Label>
                    <TextArea
                      value={jobForm.descriptionAr}
                      onChange={(value) => handleInputChange("descriptionAr", value)}
                      placeholder="حدد المسؤوليات والأهداف الأساسية..."
                      rows={6}
                      className="text-right"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-6 dark:border-gray-800 dark:bg-gray-800/30">
                <div className="mb-4 flex items-center gap-2">
                  <svg className="size-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Compensation & Availability</h4>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="salary">Salary (Base Monthly)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        id="salary"
                        type="number"
                        className="pl-7"
                        value={jobForm.salary}
                        onChange={(e) => handleInputChange("salary", Number(e.target.value))}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="openPositions">Total Vacancies</Label>
                    <Input
                      id="openPositions"
                      type="number"
                      value={jobForm.openPositions}
                      onChange={(e) => handleInputChange("openPositions", Number(e.target.value))}
                      min="1"
                    />
                  </div>
                  <div className="flex flex-col justify-end gap-4 pb-1">
                    <div className="group/toggle relative">
                      <Switch
                        label="Salary Visible"
                        checked={jobForm.salaryVisible}
                        onChange={(checked) => handleInputChange("salaryVisible", checked)}
                      />
                      <p className="mt-1.5 ml-11 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 opacity-70 group-hover/toggle:opacity-100 transition-opacity">
                        Show the salary range on the public job listing page.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-800/30">
                <div className="mb-2 flex items-center gap-2">
                  <svg className="size-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wider">
                    Applicant Base Field Configuration
                  </h4>
                </div>
                <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                  Control which default applicant fields are shown in the application form and which ones are mandatory.
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {applicantFieldConfigMeta.map((item) => {
                    const rule = jobForm.fieldConfig[item.key];

                    return (
                      <div
                        key={item.key}
                        className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40"
                      >
                        <div className="mb-3">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                          <Switch
                            label="Visible"
                            checked={rule.visible}
                            onChange={(checked) =>
                              handleFieldConfigChange(item.key, "visible", checked)
                            }
                          />
                          <Switch
                            label="Required"
                            checked={rule.required}
                            disabled={!rule.visible}
                            onChange={(checked) =>
                              handleFieldConfigChange(item.key, "required", checked)
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employmentType" required>Employment Type Style</Label>
                  <Select
                    options={[
                      { value: "full-time", label: "Full-time" },
                      { value: "part-time", label: "Part-time" },
                      { value: "contract", label: "Contract" },
                      { value: "internship", label: "Internship" },
                    ]}
                    value={jobForm.employmentType}
                    placeholder="Select option"
                    onChange={(val) => handleInputChange("employmentType", val)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workArrangement" required>Workspace Policy</Label>
                  <Select
                    options={[
                      { value: "on-site", label: "On-site" },
                      { value: "remote", label: "Remote" },
                      { value: "hybrid", label: "Hybrid" },
                    ]}
                    value={jobForm.workArrangement}
                    placeholder="Select arrangement"
                    onChange={(val) => handleInputChange("workArrangement", val)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="registrationStart" required>Recruitment Opening</Label>
                  <Input
                    id="registrationStart"
                    type="date"
                    value={jobForm.registrationStart}
                    onChange={(e) => handleInputChange("registrationStart", e.target.value)}
                    onClick={(e) => (e.currentTarget as any).showPicker?.()}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registrationEnd" required>Application Deadline</Label>
                  <Input
                    id="registrationEnd"
                    type="date"
                    value={jobForm.registrationEnd}
                    onChange={(e) => handleInputChange("registrationEnd", e.target.value)}
                    onClick={(e) => (e.currentTarget as any).showPicker?.()}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  {jobForm.companyId ? (
                    <MultiSelect
                      label="Allowed Statuses"
                      options={allowedStatusOptions}
                      value={jobForm.allowedStatuses}
                      onChange={(selected) => handleInputChange("allowedStatuses", selected)}
                      placeholder={allowedStatusOptions.length > 0 ? "Select statuses" : "No company statuses available"}
                      disabled={allowedStatusOptions.length === 0}
                    />
                  ) : (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-500 dark:border-gray-700 dark:bg-gray-800/50">
                      Select a company first to choose allowed statuses.
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="group/toggle relative rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                    <Switch
                      label="Hide After Registration End"
                      checked={jobForm.hideAfterRegistrationEnd}
                      onChange={(checked) => handleInputChange("hideAfterRegistrationEnd", checked)}
                    />
                    <p className="mt-1.5 ml-11 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 opacity-70 group-hover/toggle:opacity-100 transition-opacity">
                      Hide this job from public listings after the application deadline passes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Terms and Conditions</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Add mandatory requirements or legal fine print</p>
              </div>
              <div className="rounded-xl bg-purple-50 p-2.5 text-purple-600 dark:bg-purple-500/10">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-800/50">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>New Term {jobForm.bilingual && "(EN)"}</Label>
                    <Input
                      value={newTerm}
                      onChange={(e) => setNewTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTerm();
                        }
                      }}
                      placeholder={jobForm.bilingual ? "Enter English term..." : "Enter requirement..."}
                    />
                  </div>
                  {jobForm.bilingual && (
                    <div className="space-y-2" dir="rtl">
                      <Label className="text-right block w-full">الشرط الجديد (بالعربية)</Label>
                      <Input
                        value={newTermAr}
                        onChange={(e) => setNewTermAr(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTerm();
                          }
                        }}
                        placeholder="أضف شرط أو حكم..."
                        className="text-right"
                      />
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleAddTerm}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/20 transition-all hover:bg-brand-600 hover:shadow-brand-500/40 active:scale-95"
                  >
                    <PlusIcon className="size-4" />
                    Add Term
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {jobForm.termsAndConditions.map((term, index) => (
                  <div
                    key={index}
                    className="group item animate-in fade-in slide-in-from-bottom-2 duration-300 relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-brand-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-brand-500 opacity-0 transition-opacity group-hover:opacity-100" />
                    
                    {editingTermIndex === index ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <Input
                            value={term}
                            onChange={(e) => {
                              const newTerms = [...jobForm.termsAndConditions];
                              newTerms[index] = e.target.value;
                              setJobForm(prev => ({ ...prev, termsAndConditions: newTerms }));
                            }}
                            autoFocus
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
                                className="text-right"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingTermIndex(null)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600"
                          >
                            <CheckCircleIcon className="size-4" />
                            Confirm Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-800">
                            {index + 1}
                          </span>
                          <div className="space-y-1.5">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {jobForm.bilingual && <span className="text-[10px] uppercase tracking-wider text-gray-400 mr-2">EN:</span>}
                              {term || <em className="text-gray-400">Empty description</em>}
                            </div>
                            {jobForm.bilingual && (
                              <div className="text-sm font-medium text-gray-700 dark:text-gray-300" dir="rtl">
                                <span className="text-[10px] uppercase tracking-wider text-gray-400 ml-2">AR:</span>
                                {jobForm.termsAndConditionsAr[index] || <em className="text-gray-400">فارغ</em>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => setEditingTermIndex(index)}
                            className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                            title="Quick Edit"
                          >
                            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveTerm(index)}
                            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
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
          </div>

          {/* Job Specs */}
          <div className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Job Specifications</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Define evaluation criteria and their relative weights</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>

            <div className="space-y-4">
              {jobForm.jobSpecs.map((spec, index) => (
                <div key={index} className="group/item relative">
                  {editingSpecIndex === index ? (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4 dark:border-blue-800/30 dark:bg-blue-900/10 space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 items-end">
                        <div className="md:col-span-11 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Specification Name {jobForm.bilingual && "(EN)"}</Label>
                            <Input
                              value={spec.spec}
                              onChange={(e) => handleJobSpecChange(index, "spec", e.target.value)}
                              autoFocus
                            />
                          </div>
                          {jobForm.bilingual && (
                            <div className="space-y-2" dir="rtl">
                              <Label className="text-right block w-full">اسم المواصفة (بالعربية)</Label>
                              <Input
                                value={spec.specAr || ""}
                                onChange={(e) => handleJobSpecChange(index, "specAr", e.target.value)}
                                className="text-right"
                              />
                            </div>
                          )}
                        </div>
                        <div className="md:col-span-1 space-y-2 min-w-[100px]">
                          <Label>Weight %</Label>
                          <Input
                            type="number"
                            value={spec.weight}
                            onChange={(e) => handleJobSpecChange(index, "weight", Number(e.target.value))}
                            min="0"
                            max="100"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingSpecIndex(null)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-600 shadow-md shadow-emerald-500/20"
                        >
                          <CheckCircleIcon className="size-4" />
                          Update Spec
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-brand-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex-1 flex items-center gap-6">
                        <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-xs font-bold text-gray-400 dark:bg-gray-800">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-8">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {jobForm.bilingual && <span className="text-[10px] uppercase text-gray-400 mr-2">EN:</span>}
                                {spec.spec || <em className="text-gray-400 font-normal italic">Undefined Requirement</em>}
                              </p>
                              {jobForm.bilingual && (
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate" dir="rtl">
                                  <span className="text-[10px] uppercase text-gray-400 ml-2">AR:</span>
                                  {spec.specAr || <em className="text-gray-400 font-normal italic">غير محدد</em>}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 w-fit">
                              <span className="text-xs font-bold uppercase tracking-wider">Weight</span>
                              <span className="text-sm font-black">{spec.weight}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover/item:opacity-100">
                        <button
                          type="button"
                          onClick={() => setEditingSpecIndex(index)}
                          className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                        >
                          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveJobSpec(index)}
                          className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          <TrashBinIcon className="size-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl bg-gray-50 p-6 dark:bg-gray-800/40">
                <button
                  type="button"
                  onClick={handleAddJobSpec}
                  className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-6 py-3 text-sm font-bold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:border-brand-300 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  <PlusIcon className="size-5 text-brand-500" />
                  Add New Specification
                </button>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Cumulative Weight</span>
                    <div className={`flex items-center gap-2 rounded-lg px-4 py-2 text-lg font-black ${
                      totalWeight === 100
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 animate-pulse"
                    }`}>
                      {totalWeight}%
                    </div>
                  </div>
                  {totalWeight !== 100 && (
                    <p className="mt-1 text-[11px] font-bold text-red-500 uppercase flex items-center gap-1">
                      <svg className="size-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Attention: Specifications must total 100%
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Custom Fields */}
          <div className="group relative overflow-visible rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Custom Form Fields</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Personalize the application form for candidates</p>
              </div>
              <div className="rounded-xl bg-orange-50 p-2.5 text-orange-600 dark:bg-orange-500/10">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
            </div>

            <div className="mb-6 flex flex-wrap gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
                <button
                  type="button"
                  onClick={handleAddCustomField}
                  className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/20 transition-all hover:bg-brand-600 active:scale-95"
                >
                  <PlusIcon className="size-4" />
                  New Custom Field
                </button>
                <div className="flex gap-2 relative">
                  <button
                    type="button"
                    onClick={() => setShowRecommendedPanel((s) => !s)}
                    className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                  >
                    <svg className="size-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Recommended
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSavedPanel((s) => !s)}
                    className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                  >
                    <svg className="size-4 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                    </svg>
                    Saved Fields
                  </button>

                  {/* Panels - Enhanced UI */}
                  {showSavedPanel && (
                    <div className="absolute left-0 top-full mt-2 w-80 rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl z-50 animate-in zoom-in-95 duration-200 dark:border-gray-700 dark:bg-gray-900">
                      <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-gray-400">Library of Saved Fields</h4>
                      <div className="max-h-80 overflow-auto scrollbar-hide space-y-3">
                        {savedFieldsLoading ? (
                          <div className="flex justify-center p-4">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                          </div>
                        ) : (
                          (savedFields as any).map((sf: any, idx: number) => {
                            const fieldId = sf.fieldId;
                            const disabled = isSavedAdded(fieldId);
                            const checked = selectedSaved.includes(fieldId);
                            const inputId = `sav_${idx}_${fieldId}`;
                            return (
                              <label key={`${fieldId}_${idx}`} htmlFor={inputId} className={`group flex cursor-pointer items-start gap-3 rounded-xl border border-transparent p-3 transition hover:border-brand-100 hover:bg-brand-50/30 dark:hover:bg-brand-500/5 ${disabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                                <input
                                  id={inputId}
                                  type="checkbox"
                                  checked={disabled || checked}
                                  disabled={disabled}
                                  onChange={() => toggleSelectSaved(fieldId)}
                                  className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{convertToString(sf.label) || fieldId}</div>
                                  {sf.description && <div className="line-clamp-2 text-xs text-gray-500 mt-0.5">{convertToString(sf.description)}</div>}
                                </div>
                                {disabled && <CheckCircleIcon className="size-4 text-emerald-500 shrink-0" />}
                              </label>
                            );
                          })
                        )}
                      </div>
                      <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                        <button
                          type="button"
                          onClick={() => { setSelectedSaved([]); setShowSavedPanel(false); }}
                          className="rounded-lg px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddSelectedSaved}
                          disabled={selectedSaved.length === 0}
                          className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-30"
                        >
                          Add Selected ({selectedSaved.length})
                        </button>
                      </div>
                    </div>
                  )}

                  {showRecommendedPanel && (
                    <div className="absolute left-0 top-full mt-2 w-80 rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl z-50 animate-in zoom-in-95 duration-200 dark:border-gray-700 dark:bg-gray-900">
                      <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-orange-500">Expert Recommended</h4>
                      <div className="max-h-80 overflow-auto scrollbar-hide space-y-3">
                        {recommendedLoading ? (
                          <div className="flex justify-center p-4">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                          </div>
                        ) : (
                          recommendedFields.map((rf: any, idx: number) => {
                            const fieldId = rf.fieldId;
                            const disabled = isRecommendedAdded(fieldId);
                            const checked = selectedRecommended.includes(fieldId);
                            const inputId = `rec_${idx}_${fieldId}`;
                            return (
                              <label key={`${fieldId}_${idx}`} htmlFor={inputId} className={`group flex cursor-pointer items-start gap-3 rounded-xl border border-transparent p-3 transition hover:border-orange-100 hover:bg-orange-50/30 dark:hover:bg-orange-500/5 ${disabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                                <input
                                  id={inputId}
                                  type="checkbox"
                                  checked={disabled || checked}
                                  disabled={disabled}
                                  onChange={() => toggleSelectRecommended(fieldId)}
                                  className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{convertToString(rf.label) || fieldId}</div>
                                  {rf.description && <div className="line-clamp-2 text-xs text-gray-500 mt-0.5">{convertToString(rf.description)}</div>}
                                </div>
                                {disabled && <CheckCircleIcon className="size-4 text-emerald-500 shrink-0" />}
                              </label>
                            );
                          })
                        )}
                      </div>
                      <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                        <button
                          type="button"
                          onClick={() => { setSelectedRecommended([]); setShowRecommendedPanel(false); }}
                          className="rounded-lg px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddSelectedRecommended}
                          disabled={selectedRecommended.length === 0}
                          className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-30"
                        >
                          Add Strategic Fields ({selectedRecommended.length})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {jobForm.customFields.map((field, fieldIndex) => {
                const isCollapsed = collapsedFields.has(fieldIndex);
                return (
                  <div
                    key={field.fieldId}
                    className="group/field relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/50 p-5 transition-all hover:border-brand-100 hover:bg-white hover:shadow-lg dark:border-gray-800 dark:bg-gray-900/40"
                  >
                    <div className="absolute left-0 top-0 h-full w-1 bg-brand-500 opacity-0 transition-opacity group-hover/field:opacity-100" />
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => toggleFieldCollapse(fieldIndex)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-gray-200 transition-all hover:scale-110 dark:bg-gray-800 dark:ring-gray-700"
                          >
                            <svg
                              className={`size-4 text-gray-500 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-90'}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">Form Element {fieldIndex + 1}</span>
                            <h4 className="text-base font-bold text-gray-900 dark:text-white">
                              {field.label || <em className="font-normal text-gray-400 italic">Untitled Field</em>}
                            </h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${field.isRequired ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                            {field.isRequired ? 'Required' : 'Optional'}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(fieldIndex)}
                            className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          >
                            <TrashBinIcon className="size-5" />
                          </button>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="animate-in slide-in-from-top-2 duration-300 space-y-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`field-label-${fieldIndex}`}>Display Label {jobForm.bilingual && "(EN)"}</Label>
                              <Input
                                id={`field-label-${fieldIndex}`}
                                value={field.label}
                                onChange={(e) => handleCustomFieldChange(fieldIndex, "label", e.target.value)}
                                placeholder="e.g. Years of Experience"
                              />
                            </div>
                            {jobForm.bilingual && (
                              <div className="space-y-2" dir="rtl">
                                <Label htmlFor={`field-label-ar-${fieldIndex}`} className="text-right block w-full">تسمية الحقل (بالعربية)</Label>
                                <Input
                                  id={`field-label-ar-${fieldIndex}`}
                                  value={field.labelAr || ""}
                                  onChange={(e) => handleCustomFieldChange(fieldIndex, "labelAr", e.target.value)}
                                  placeholder="مثال: سنوات الخبرة"
                                  className="text-right"
                                />
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 items-end">
                            <div className="space-y-2">
                              <Label htmlFor={`field-type-${fieldIndex}`}>Field Type</Label>
                              <Select
                                options={inputTypeOptions}
                                value={field.inputType}
                                placeholder="Select Component"
                                onChange={(value) => handleCustomFieldChange(fieldIndex, "inputType", value)}
                              />
                            </div>
                            <div className="space-y-2 text-center">
                              <Label htmlFor={`field-display-order-${fieldIndex}`}>Sequence</Label>
                              <div className="flex justify-center">
                                <Input
                                  id={`field-display-order-${fieldIndex}`}
                                  type="number"
                                  className="text-center w-24"
                                  value={field.displayOrder}
                                  onChange={(e) => handleCustomFieldChange(fieldIndex, "displayOrder", Number(e.target.value))}
                                  min="1"
                                />
                              </div>
                            </div>
                            <div className="flex h-[44px] items-center justify-center rounded-xl bg-gray-100/50 px-4 dark:bg-gray-800/50">
                              <Switch
                                label="Required"
                                checked={field.isRequired}
                                onChange={(checked) => handleCustomFieldChange(fieldIndex, "isRequired", checked)}
                              />
                            </div>
                          </div>

                          {field.inputType === "number" && (
                            <div className="grid grid-cols-2 gap-6 rounded-2xl bg-brand-50/30 p-4 dark:bg-brand-500/5">
                              <div className="space-y-2">
                                <Label htmlFor={`field-min-${fieldIndex}`}>Minimum Threshold</Label>
                                <Input
                                  id={`field-min-${fieldIndex}`}
                                  type="number"
                                  value={field.minValue || ""}
                                  onChange={(e) => handleCustomFieldChange(fieldIndex, "minValue", Number(e.target.value))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`field-max-${fieldIndex}`}>Maximum Limit</Label>
                                <Input
                                  id={`field-max-${fieldIndex}`}
                                  type="number"
                                  value={field.maxValue || ""}
                                  onChange={(e) => handleCustomFieldChange(fieldIndex, "maxValue", Number(e.target.value))}
                                />
                              </div>
                            </div>
                          )}

                          {(field.inputType === "checkbox" || field.inputType === "radio" || field.inputType === "dropdown") && (
                            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                              <Label className="mb-4 block text-xs font-black uppercase tracking-wider text-gray-400">Response Options</Label>
                              <div className={`grid gap-4 items-end mb-4 ${jobForm.bilingual ? 'md:grid-cols-2' : ''}`}>
                                <div className="space-y-2">
                                  <Input
                                    value={newChoice[fieldIndex] || ""}
                                    onChange={(e) => setNewChoice(prev => ({ ...prev, [fieldIndex]: e.target.value }))}
                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddChoice(fieldIndex))}
                                    placeholder="English Choice..."
                                  />
                                </div>
                                {jobForm.bilingual && (
                                  <div className="space-y-2" dir="rtl">
                                    <Input
                                      value={newChoiceAr[fieldIndex] || ""}
                                      onChange={(e) => setNewChoiceAr(prev => ({ ...prev, [fieldIndex]: e.target.value }))}
                                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddChoice(fieldIndex))}
                                      placeholder="الخيار بالعربية..."
                                      className="text-right"
                                    />
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddChoice(fieldIndex)}
                                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-black dark:bg-brand-500 dark:hover:bg-brand-600"
                              >
                                <PlusIcon className="size-3" />
                                Save Choice
                              </button>

                              <div className="mt-6 flex flex-wrap gap-2">
                                {field.choices?.map((choice, choiceIndex) => (
                                  <div
                                    key={choiceIndex}
                                    className="group/choice flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 pl-4 pr-2 py-2 text-sm dark:border-gray-800 dark:bg-gray-800/50"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-bold text-gray-900 dark:text-white">{choice}</span>
                                      {jobForm.bilingual && field.choicesAr?.[choiceIndex] && (
                                        <span className="text-[10px] text-gray-500 font-medium" dir="rtl">{field.choicesAr[choiceIndex]}</span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveChoice(fieldIndex, choiceIndex)}
                                      className="rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
                                    >
                                      <TrashBinIcon className="size-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {field.inputType === "repeatable_group" && (
                            <div className="rounded-2xl border-2 border-dashed border-brand-100 bg-brand-50/20 p-6 dark:border-brand-900/20 dark:bg-brand-500/5">
                              <div className="mb-6 flex items-center justify-between">
                                <div>
                                  <h5 className="text-sm font-black uppercase tracking-widest text-brand-600">Sub-Question Matrix</h5>
                                  <p className="text-xs text-brand-500/70">Fields inside this repeatable section</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddSubField(fieldIndex)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-600"
                                >
                                  <PlusIcon className="size-3" />
                                  Add Sub-Field
                                </button>
                              </div>

                              <div className="space-y-4">
                                {field.subFields?.map((subField, subFieldIndex) => (
                                  <div
                                    key={subField.fieldId}
                                    className="relative rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                                  >
                                    <div className="mb-4 flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-gray-400 uppercase">Sub-Field #{subFieldIndex + 1}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSubField(fieldIndex, subFieldIndex)}
                                        className="text-gray-300 hover:text-red-500 transition-colors"
                                      >
                                        <TrashBinIcon className="size-4" />
                                      </button>
                                    </div>

                                    <div className="space-y-4">
                                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-1">
                                          <Label className="text-[11px] font-bold text-gray-500">Label (EN)</Label>
                                          <Input
                                            value={subField.label}
                                            onChange={(e) => handleSubFieldChange(fieldIndex, subFieldIndex, "label", e.target.value)}
                                            placeholder="Question label..."
                                            className="h-9 text-sm"
                                          />
                                        </div>
                                        {jobForm.bilingual && (
                                          <div className="space-y-1" dir="rtl">
                                            <Label className="text-[11px] font-bold text-gray-500">Label (AR)</Label>
                                            <Input
                                              value={subField.labelAr || ""}
                                              onChange={(e) => handleSubFieldChange(fieldIndex, subFieldIndex, "labelAr", e.target.value)}
                                              placeholder="السؤال بالعربية..."
                                              className="h-9 text-sm text-right"
                                            />
                                          </div>
                                        )}
                                      </div>

                                      <div className="grid grid-cols-2 gap-4 items-end">
                                        <div className="space-y-1">
                                          <Label className="text-[11px] font-bold text-gray-500">Input Type</Label>
                                          <Select
                                            options={subFieldTypeOptions}
                                            value={subField.inputType}
                                            onChange={(value) => handleSubFieldChange(fieldIndex, subFieldIndex, "inputType", value)}
                                          />
                                        </div>
                                        <div className="flex h-[40px] items-center px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                          <Switch
                                            label="Required"
                                            checked={subField.isRequired}
                                            onChange={(checked) => handleSubFieldChange(fieldIndex, subFieldIndex, "isRequired", checked)}
                                          />
                                        </div>
                                      </div>

                                      {(subField.inputType === "radio" || subField.inputType === "checkbox" || subField.inputType === "dropdown") && (
                                        <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800">
                                          <div className="grid gap-4 md:grid-cols-2 mb-3">
                                            <Input
                                              value={newSubFieldChoice[`${fieldIndex}-${subFieldIndex}`] || ""}
                                              onChange={(e) => setNewSubFieldChoice(prev => ({ ...prev, [`${fieldIndex}-${subFieldIndex}`]: e.target.value }))}
                                              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSubFieldChoice(fieldIndex, subFieldIndex))}
                                              placeholder="English choice..."
                                              className="h-8 text-xs"
                                            />
                                            {jobForm.bilingual && (
                                              <div dir="rtl">
                                                <Input
                                                  value={newSubFieldChoiceAr[`${fieldIndex}-${subFieldIndex}`] || ""}
                                                  onChange={(e) => setNewSubFieldChoiceAr(prev => ({ ...prev, [`${fieldIndex}-${subFieldIndex}`]: e.target.value }))}
                                                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSubFieldChoice(fieldIndex, subFieldIndex))}
                                                  placeholder="الخيار بالعربية..."
                                                  className="h-8 text-xs text-right"
                                                />
                                              </div>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleAddSubFieldChoice(fieldIndex, subFieldIndex)}
                                            className="text-[10px] font-black uppercase text-brand-600 hover:text-brand-700 flex items-center gap-1"
                                          >
                                            <PlusIcon className="size-3" /> Add Choice
                                          </button>
                                          <div className="mt-3 flex flex-wrap gap-2">
                                            {subField.choices?.map((choice, choiceIndex) => (
                                              <div key={choiceIndex} className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1 text-[11px] font-medium dark:bg-gray-800 dark:text-gray-300">
                                                <span>{choice}</span>
                                                <button onClick={() => handleRemoveSubFieldChoice(fieldIndex, subFieldIndex, choiceIndex)} className="text-gray-400 hover:text-red-500">×</button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit and Preview */}
          <div className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-8 shadow-sm transition-all hover:shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col items-center gap-6">
              <div className="text-center">
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-wider">Ready to Finalize?</h3>
                <p className="mt-1 text-sm text-gray-500">Ensure all mandatory fields and specifications are defined before proceeding.</p>
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl bg-brand-500 px-10 py-4 text-sm font-black text-white shadow-2xl shadow-brand-500/30 transition-all hover:bg-brand-600 hover:shadow-brand-500/50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 animate-shimmer" />
                  {isSubmitting ? (
                    <>
                      <svg className="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {isEditMode ? "Propagating Changes..." : "Publishing Job..."}
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="size-6 transition-transform group-hover:scale-110" />
                      {isEditMode ? "Save Changes" : "Launch Position"}
                    </>
                  )}
                </button>
                
                {jobStatus && (
                  <div className="animate-in fade-in zoom-in slide-in-from-right-4 duration-500 flex items-center gap-3 rounded-2xl bg-emerald-50 px-6 py-4 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                      <CheckCircleIcon className="size-4" />
                    </div>
                    <span className="text-sm font-bold uppercase tracking-wider">{jobStatus}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
