import { useMemo, useState, useEffect } from "react";
import Swal from '../../../utils/swal';
import { useParams, useNavigate, useLocation } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { 
  PencilIcon, 
  TrashBinIcon, 
  CalenderIcon, 
  InfoIcon, 
  DollarLineIcon, 
  TimeIcon, 
  CheckCircleIcon,
  UserIcon,
  AngleLeftIcon
} from "../../../icons";
import {
  useCompany,
  useDepartment,
  useDeleteJobPosition,
  useJobPosition,
} from "../../../hooks/queries";
import { toPlainString } from "../../../utils/strings";

// Helper to handle multilingual objects or strings and always return plain text
const getTranslation = (value: any, defaultValue = ""): string => {
  const plain = toPlainString(value);
  return plain || defaultValue;
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

const previewFieldConfigItems: Array<{ key: keyof FieldConfig; label: string }> = [
  { key: "fullName", label: "Full Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "gender", label: "Gender" },
  { key: "birthDate", label: "Birth Date" },
  { key: "address", label: "Address" },
  { key: "profilePhoto", label: "Profile Photo" },
  { key: "cvFilePath", label: "CV Upload" },
  { key: "expectedSalary", label: "Expected Salary" },
];

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

export default function PreviewJob() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get job data from navigation state
  const jobFromState = location.state?.job;
  
  // Fallback: Fetch job by ID only if no data in state
  const {
    data: jobFromApi,
    isLoading: isLoadingJob,
    isFetching: isJobFetching,
    isFetched: isJobFetched,
    refetch: refetchJob
  } = useJobPosition(jobId || "", { enabled: !jobFromState && !!jobId });
  
  // Use data from state if available, otherwise use fetched data
  const job = jobFromState || jobFromApi;

  const normalizedFieldConfig = useMemo(
    () =>
      normalizeFieldConfig(
        (job as any)?.fieldConfig,
        typeof (job as any)?.salaryFieldVisible === "boolean"
          ? (job as any).salaryFieldVisible
          : undefined
      ),
    [job]
  );

  const visibleBaseFieldCount = useMemo(
    () => previewFieldConfigItems.filter((item) => normalizedFieldConfig[item.key].visible).length,
    [normalizedFieldConfig]
  );

  // Extract company and department data or IDs
  const { companyId, companyData, departmentId, departmentData } = useMemo(() => {
    if (!job) return { companyId: undefined, companyData: undefined, departmentId: undefined, departmentData: undefined };
    
    // Check if company is already populated
    const companyIsObject = typeof job.companyId === "object" && job.companyId !== null;
    const companyId = companyIsObject ? (job.companyId as any)?._id : job.companyId as string;
    const companyData = companyIsObject ? job.companyId as any : undefined;
    
    // Check if department is already populated
    const departmentIsObject = typeof job.departmentId === "object" && job.departmentId !== null;
    const departmentId = departmentIsObject ? (job.departmentId as any)?._id : job.departmentId as string;
    const departmentData = departmentIsObject ? job.departmentId as any : undefined;
    
    return { companyId, companyData, departmentId, departmentData };
  }, [job]);

  // Fetch company and department names ONLY if not already populated
  const { data: companyFromApi, isFetched: isCompanyFetched, isFetching: isCompanyFetching, refetch: refetchCompany } = useCompany(companyId || "", { enabled: !companyData && !!companyId });
  const { data: departmentFromApi, isFetched: isDepartmentFetched, isFetching: isDepartmentFetching, refetch: refetchDepartment } = useDepartment(departmentId || "", { enabled: !departmentData && !!departmentId });
  
  // Use populated data if available, otherwise use fetched data
  const company = companyData || companyFromApi;
  const department = departmentData || departmentFromApi;

  // Mutations
  const deleteJobMutation = useDeleteJobPosition();

  const [isDeletingJob, setIsDeletingJob] = useState(false);
  const [lastRefetch, setLastRefetch] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoadingJob && lastRefetch === null && (isJobFetched || isCompanyFetched || isDepartmentFetched)) {
      setLastRefetch(new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingJob]);

  useEffect(() => {
    if (!lastRefetch) {
      setElapsed(null);
      return;
    }
    const formatRelative = (d: Date) => {
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 60) return "just now";
      const mins = Math.floor(diffSec / 60);
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return d.toLocaleDateString();
    };

    const update = () => setElapsed(formatRelative(lastRefetch));
    update();
    const id = setInterval(update, 30 * 1000);
    return () => clearInterval(id);
  }, [lastRefetch]);

  // Helper function to extract detailed error messages
  const getErrorMessage = (err: any): string => {
    if (err.response?.data?.details && Array.isArray(err.response.data.details)) {
      return err.response.data.details.map((detail: any) => {
        const field = detail.path?.[0] || "";
        const message = detail.message || "";
        return field ? `${field}: ${message}` : message;
      }).join(", ");
    }
    if (err.response?.data?.errors) {
      const errors = err.response.data.errors;
      if (Array.isArray(errors)) return errors.map((e: any) => e.msg || e.message).join(", ");
      if (typeof errors === "object") return Object.entries(errors).map(([field, msg]: [string, any]) => `${field}: ${msg}`).join(", ");
    }
    return err.response?.data?.message || err.message || "An unexpected error occurred";
  };

  const handleEdit = () => {
    navigate(`/create-job?id=${jobId}`, { state: { job } });
  };

  const handleUpdate = async () => {
    try {
      const promises: Promise<any>[] = [];
      if (refetchJob) promises.push(refetchJob());
      if (refetchCompany) promises.push(refetchCompany());
      if (refetchDepartment) promises.push(refetchDepartment());
      if (promises.length === 0) return;
      await Promise.all(promises);
      setLastRefetch(new Date());
    } catch (e) {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!jobId) return;
    const result = await Swal.fire({
      title: "Delete Job?",
      text: "Are you sure you want to delete this job?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Yes, delete it!",
    });
    if (!result.isConfirmed) return;
    try {
      setIsDeletingJob(true);
      await deleteJobMutation.mutateAsync(jobId);
      await Swal.fire({
        title: "Deleted!",
        text: "Job has been deleted successfully.",
        icon: "success",
        position: "center",
        timer: 1500,
        showConfirmButton: false,
      });
      navigate("/jobs");
    } catch (err) {
      Swal.fire({
        title: "Error",
        text: getErrorMessage(err),
        icon: "error",
      });
    } finally {
      setIsDeletingJob(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatEmploymentType = (val: any) => {
    if (!val) return "N/A";
    const s = String(val).toLowerCase();
    if (s.includes("full")) return "Full-time";
    if (s.includes("part")) return "Part-time";
    if (s.includes("contract")) return "Contract";
    if (s.includes("intern")) return "Internship";
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
  };

  const formatInputType = (type: string) => {
    const typeMap: { [key: string]: string } = {
      text: "Short Text",
      textarea: "Long Text",
      number: "Numeric",
      email: "Email Address",
      date: "Date Picker",
      radio: "Single Choice",
      dropdown: "Dropdown Menu",
      checkbox: "Multiple Choice",
      url: "Website URL",
      tags: "Tag Input",
      repeatable_group: "Grouping",
    };
    return typeMap[type] || type;
  };

  if (isLoadingJob) {
    return (
      <div className="space-y-6">
        <PageMeta title="Loading..." description="Loading job details" />
        <PageBreadcrumb pageTitle="Job Details" />
        <LoadingSpinner fullPage message="Loading job details..." />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <PageMeta title="Job Not Found" description="Job not found" />
        <PageBreadcrumb pageTitle="Job Details" />
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-20 dark:border-gray-800">
          <div className="rounded-full bg-gray-50 p-4 dark:bg-gray-900">
             <InfoIcon className="size-12 text-gray-400" />
          </div>
          <p className="mt-4 text-xl font-bold text-gray-900 dark:text-white">Job Not Found</p>
          <p className="mt-2 text-center text-gray-500 dark:text-gray-400 max-w-sm px-6">
            The job you're looking for doesn't exist or might have been removed already.
          </p>
          <button
            onClick={() => navigate("/jobs")}
            className="mt-8 rounded-xl bg-brand-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-brand-600 active:scale-95"
          >
            Go Back to Job List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-10">
      <PageMeta
        title={`${getTranslation(job.title, "Job Detail")} | Preview`}
        description={`Details for ${getTranslation(job.title, "job")}`}
      />

      {/* Floating Mobile Action Header (Optional enhancement for UX) */}
      <div className="sticky top-0 z-40 -mx-4 flex items-center justify-between border-b bg-white/80 px-4 py-3 backdrop-blur-md md:hidden dark:border-gray-800 dark:bg-gray-900/80">
        <button onClick={() => navigate("/jobs")} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
          <AngleLeftIcon className="size-6 text-gray-600 dark:text-gray-400" />
        </button>
        <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
          {getTranslation(job.title)}
        </span>
        <div className="flex gap-2 items-center">
           <button 
             onClick={handleUpdate} 
             title="Update data"
             className={`p-2 rounded-lg transition-colors ${isJobFetching || isCompanyFetching || isDepartmentFetching ? 'text-amber-500 animate-spin' : 'text-gray-400 hover:text-brand-500'}`}
           >
             <TimeIcon className="size-5" />
           </button>
           <button onClick={handleEdit} className="p-2 text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"><PencilIcon className="size-5"/></button>
        </div>
      </div>

      <div className="hidden md:flex items-center justify-between">
        <button
          onClick={() => navigate("/jobs")}
          className="group flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
        >
          <AngleLeftIcon className="size-4 transition-transform group-hover:-translate-x-1" />
          Back to Career List
        </button>
        
        <div className="flex items-center gap-4 text-xs text-gray-400 italic">
          <button 
            onClick={handleUpdate}
            className="flex items-center gap-1.5 hover:text-brand-500 transition-colors cursor-pointer group/sync"
          >
            <span className={`size-2 rounded-full ${isJobFetching || isCompanyFetching || isDepartmentFetching ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 group-hover/sync:bg-brand-400'}`} />
            {isJobFetching || isCompanyFetching || isDepartmentFetching ? "Syncing..." : "Synced"}
          </button>
          {elapsed && <span>{elapsed}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content Area */}
        <div className="space-y-6 lg:col-span-2">
          {/* Hero Section */}
          <div className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900 md:p-8">
            <div className="absolute top-0 right-0 p-4 opacity-0 transition-opacity group-hover:opacity-100 hidden md:block">
               <span className="text-[120px] font-black text-gray-50/10 leading-none pointer-events-none select-none dark:text-white/[0.02]">JOB</span>
            </div>
            
            <div className="relative">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <CheckCircleIcon className="mr-1 size-3.5" />
                  Active Listing
                </span>
                <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                   {job.jobCode || "NO-CODE"}
                </span>
              </div>

              <h1 className="text-2xl font-black tracking-tight text-gray-900 sm:text-4xl dark:text-white">
                {getTranslation(job.title, "Untitled Position")}
              </h1>

              <div className="mt-6 flex flex-wrap gap-y-4 gap-x-8">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                    <UserIcon className="size-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Department</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {toPlainString((department as any)?.name) || "Cross-functional"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                    <TimeIcon className="size-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Type</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatEmploymentType(job?.employmentType)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    <CalenderIcon className="size-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Deadline</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatDate(job.registrationEnd)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <section className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
               <InfoIcon className="size-5 text-brand-500" />
               Role Overview
            </h2>
            <div className="prose prose-brand max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap text-gray-600 leading-relaxed dark:text-gray-400">
                {getTranslation(job.description, "Detailed description is coming soon.")}
              </div>
            </div>
          </section>

          {/* Requirements & Terms (Consolidated) */}
          <div className="grid grid-cols-1 gap-6 items-start md:grid-cols-2">
            {job.requirements && job.requirements.length > 0 && (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Requirements</h3>
                <ul className="space-y-3">
                  {job.requirements.map((req: any, i: number) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-600 dark:text-gray-400">
                      <div className="mt-1 flex-shrink-0 size-1.5 rounded-full bg-brand-500" />
                      {getTranslation(req)}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {job.termsAndConditions && job.termsAndConditions.length > 0 && (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Terms</h3>
                <ul className="space-y-3">
                  {job.termsAndConditions.map((term: any, i: number) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-600 dark:text-gray-400 italic">
                       <span className="text-brand-500 font-bold">•</span>
                       {getTranslation(term)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 md:p-7">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Application Guidance</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Quick snapshot for recruiters and candidates before moving to the evaluation matrix.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Open Seats</p>
                <p className="mt-1 text-base font-black text-gray-900 dark:text-white">{job.openPositions || 0}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Base Fields Visible</p>
                <p className="mt-1 text-base font-black text-gray-900 dark:text-white">{visibleBaseFieldCount}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Custom Inputs</p>
                <p className="mt-1 text-base font-black text-gray-900 dark:text-white">{job.customFields?.length || 0}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Scoring Factors</p>
                <p className="mt-1 text-base font-black text-gray-900 dark:text-white">{job.jobSpecs?.length || 0}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 md:p-7">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Base Applicant Fields</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Visibility and required rules configured for the default application form fields.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {previewFieldConfigItems.map((item) => {
                const config = normalizedFieldConfig[item.key];

                return (
                  <div
                    key={item.key}
                    className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50"
                  >
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{item.label}</p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wider">
                      <span
                        className={`rounded-md px-2 py-1 font-bold ${
                          config.visible
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {config.visible ? "Visible" : "Hidden"}
                      </span>
                      <span
                        className={`rounded-md px-2 py-1 font-bold ${
                          config.required
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {config.required ? "Required" : "Optional"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sidebar info */}
        <div className="space-y-6">
          {/* Actions Card */}
          <div className="hidden md:block rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Manage Position</h3>
            <div className="space-y-3">
              <button
                onClick={handleEdit}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-sm font-bold text-white shadow-brand-100 transition hover:bg-brand-600 hover:shadow-lg dark:shadow-none"
              >
                <PencilIcon className="size-4" />
                Edit Job
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeletingJob}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 py-3.5 text-sm font-bold text-red-600 transition hover:bg-red-100 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400"
              >
                <TrashBinIcon className="size-4" />
                {isDeletingJob ? "Deleting..." : "Delete Job"}
              </button>
            </div>
          </div>

          {/* Quick Stats Widget */}
          <div className="rounded-3xl border border-gray-200 bg-brand-500 p-6 text-white shadow-lg dark:border-gray-800">
            <p className="text-brand-100 text-xs font-bold uppercase tracking-wider">Hiring Goal</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-black">{job.openPositions || 0}</span>
              <span className="text-brand-100 font-medium">Open Seats</span>
            </div>
            <div className="mt-6 flex gap-4 border-t border-white/10 pt-6">
               <div className="flex-1">
                  <p className="text-[10px] font-bold text-brand-100 uppercase mb-1">Status</p>
                  <p className="text-sm font-bold">Internal/External</p>
               </div>
               <div className="flex-1">
                  <p className="text-[10px] font-bold text-brand-100 uppercase mb-1">Company</p>
                <p className="text-sm font-bold truncate">{getTranslation((company as any)?.name, "Corporate")}</p>
               </div>
            </div>
          </div>

          {/* Salary Card */}
          {job.salary && typeof job.salary === "number" && (
            <div className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between mb-4">
                <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 p-2 rounded-xl">
                  <DollarLineIcon className="size-5" />
                </span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${job.salaryVisible ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                  {job.salaryVisible ? "Public" : "Confidential"}
                </span>
              </div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Annual Compensation</p>
              <h3 className="mt-1 text-2xl font-black text-gray-900 dark:text-white">
                ${job.salary.toLocaleString()}
              </h3>
            </div>
          )}

          {/* Timeline Card */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
             <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Application Period</h3>
             <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-gray-100 dark:before:bg-gray-800">
                <div className="pl-6 relative">
                   <div className="absolute left-0 top-1.5 size-4 -translate-x-1/2 rounded-full border-2 border-white bg-emerald-500 ring-4 ring-emerald-100 dark:border-gray-900 dark:ring-emerald-900/30" />
                   <p className="text-xs font-bold text-gray-400 uppercase">Starts</p>
                   <p className="text-sm font-bold text-gray-900 dark:text-white">{formatDate(job.registrationStart)}</p>
                </div>
                <div className="pl-6 relative">
                   <div className="absolute left-0 top-1.5 size-4 -translate-x-1/2 rounded-full border-2 border-white bg-amber-500 ring-4 ring-amber-100 dark:border-gray-900 dark:ring-amber-900/30" />
                   <p className="text-xs font-bold text-gray-400 uppercase">Closes</p>
                   <p className="text-sm font-bold text-gray-900 dark:text-white">{formatDate(job.registrationEnd)}</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Specifications Table - Smarter UI */}
      {job.jobSpecs && job.jobSpecs.length > 0 && (
        <section className="rounded-3xl border border-gray-200 bg-white overflow-hidden shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="p-6 md:p-8 border-b dark:border-gray-800">
             <h3 className="text-xl font-bold text-gray-900 dark:text-white">Evaluation Matrix</h3>
             <p className="text-sm text-gray-500">Weight distribution for applicant scoring</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <th className="px-8 py-4">Assessment Factor</th>
                  <th className="px-8 py-4 text-center">Relative Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-800">
                {job.jobSpecs.map((spec: any, i: number) => (
                  <tr key={i} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-8 py-5">
                      <p className="font-bold text-gray-900 dark:text-white">
                        {getTranslation(spec.spec, "Criterion")}
                      </p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center gap-4">
                        <div className="w-24 bg-gray-100 rounded-full h-1.5 dark:bg-gray-800 hidden sm:block">
                          <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${spec.weight}%` }} />
                        </div>
                        <span className="font-mono text-sm font-bold text-brand-600 dark:text-brand-400">
                          {spec.weight}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/80 dark:bg-gray-800/80">
                  <td className="px-8 py-4 font-black text-gray-900 dark:text-white">Overall Score Distribution</td>
                  <td className="px-8 py-4 text-center font-black text-brand-600 dark:text-brand-400">
                    {job.jobSpecs.reduce((sum: number, spec: any) => sum + spec.weight, 0)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Custom Fields - Cards-style UI */}
      {job.customFields && job.customFields.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline gap-2 px-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Dynamic Form Fields</h3>
            <span className="text-xs font-bold text-gray-400">({job.customFields.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {job.customFields.map((field: any) => (
              <div key={field.fieldId} className="group rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:border-brand-200 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-900/40">
                <div className="flex justify-between items-start mb-3">
                  <div className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-black uppercase dark:bg-gray-800">
                    {formatInputType(field.inputType)}
                  </div>
                  {field.isRequired && (
                    <span className="text-[10px] font-bold text-red-500 uppercase">Required</span>
                  )}
                </div>
                
                <h4 className="font-bold text-gray-900 dark:text-white leading-tight mb-2">
                  {getTranslation(field.label, "Custom Input")}
                </h4>
                
                {field.choices && field.choices.length > 0 && (
                   <div className="mt-4 flex flex-wrap gap-1.5">
                      {field.choices.slice(0, 4).map((c: any, idx: number) => (
                        <span key={idx} className="text-[10px] font-medium px-2 py-1 rounded bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400">
                          {getTranslation(c)}
                        </span>
                      ))}
                      {field.choices.length > 4 && (
                        <span className="text-[10px] font-medium px-2 py-1 text-gray-400">+{field.choices.length - 4} more</span>
                      )}
                   </div>
                )}
                
                <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between opacity-50 group-hover:opacity-100 transition-opacity">
                   <span className="text-[10px] text-gray-400">Display Order: {field.displayOrder ?? field.order ?? 0}</span>
                   <div className="flex gap-2">
                      {field.minValue !== undefined && <span className="text-[10px] text-gray-400 italic">Min: {field.minValue}</span>}
                      {field.maxValue !== undefined && <span className="text-[10px] text-gray-400 italic">Max: {field.maxValue}</span>}
                   </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Floating Action Button for Mobile Add Applicant or similar could go here */}
    </div>
  );
}

