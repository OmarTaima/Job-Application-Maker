import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { useParams, useNavigate, useLocation } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import ComponentCard from "../../../components/common/ComponentCard";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { PencilIcon, TrashBinIcon } from "../../../icons";
import {
  useCompany,
  useDepartment,
  useDeleteJobPosition,
  useJobPosition,
} from "../../../hooks/queries";

export default function PreviewJob() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get job data from navigation state
  const jobFromState = location.state?.job;
  
  // Fallback: Fetch job by ID only if no data in state
  const { data: jobFromApi, isLoading: isLoadingJob } = useJobPosition(
    jobId || "",
    { enabled: !jobFromState && !!jobId }
  );
  
  // Use data from state if available, otherwise use fetched data
  const job = jobFromState || jobFromApi;

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
  const { data: companyFromApi } = useCompany(companyId || "", { enabled: !companyData && !!companyId });
  const { data: departmentFromApi } = useDepartment(departmentId || "", { enabled: !departmentData && !!departmentId });
  
  // Use populated data if available, otherwise use fetched data
  const company = companyData || companyFromApi;
  const department = departmentData || departmentFromApi;

  // Mutations
  const deleteJobMutation = useDeleteJobPosition();

  const [deleteError, setDeleteError] = useState("");
  const [isDeletingJob, setIsDeletingJob] = useState(false);

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
          .map(([field, msg]: [string, any]) => `${field}: ${msg}`)
          .join(", ");
      }
    }
    if (err.response?.data?.message) return err.response.data.message;
    if (err.message) return err.message;
    return "An unexpected error occurred";
  };

  const handleEdit = () => {
    navigate(`/create-job?id=${jobId}`);
  };

  const handleDelete = async () => {
    if (!jobId) return;

    const result = await Swal.fire({
      title: "Delete Job?",
      text: "Are you sure you want to delete this job?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
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
        customClass: {
          container: "!mt-16",
        },
      });
      navigate("/jobs");
    } catch (err) {
      console.error("Error deleting job:", err);
      const errorMsg = getErrorMessage(err);
      setDeleteError(errorMsg);
    } finally {
      setIsDeletingJob(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatEmploymentType = (val: any) => {
    if (!val) return undefined;
    const s = String(val).toLowerCase();
    if (s.includes("full")) return "Full-time";
    if (s.includes("part")) return "Part-time";
    if (s.includes("contract")) return "Contract";
    if (s.includes("intern")) return "Internship";
    return String(val);
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
      <div className="space-y-6">
        <PageMeta title="Job Not Found" description="Job not found" />
        <PageBreadcrumb pageTitle="Job Details" />
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-24 dark:border-gray-700">
          <svg
            className="mb-4 size-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Job Not Found
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            The job you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate("/jobs")}
            className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageMeta
        title={`${job.title} | Job Preview`}
        description={`View details for ${job.title}`}
      />

      {deleteError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start justify-between">
            <p className="text-sm text-red-600 dark:text-red-400">
              <strong>Error:</strong> {deleteError}
            </p>
            <button
              type="button"
              onClick={() => setDeleteError("")}
              className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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

      <PageBreadcrumb pageTitle={typeof job.title === "string" ? job.title : job.title?.en || "Job"} />

      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {typeof job.title === "string" ? job.title : job.title?.en || "Untitled Job"}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Job Code: {job.jobCode || "N/A"}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Employment Type: {formatEmploymentType(job?.employmentType) || "N/A"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEdit}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
          >
            <PencilIcon className="size-4" />
            Edit Job
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeletingJob}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrashBinIcon className="size-4" />
            {isDeletingJob ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {/* Job Status */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold ${
            job.status === "open"
              ? "bg-green-100 text-green-700 ring-1 ring-inset ring-green-200 dark:bg-green-500/10 dark:text-green-200 dark:ring-green-400/40"
              : job.status === "closed"
              ? "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-400/40"
              : "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-gray-500/10 dark:text-gray-200 dark:ring-gray-400/40"
          }`}
        >
          {job.status
            ? job.status.charAt(0).toUpperCase() + job.status.slice(1)
            : "Unknown"}
        </span>
        <span className="inline-flex items-center rounded-full bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-600 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-400/40">
          {job.openPositions || 0} Open Position
          {job.openPositions !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Basic Information */}
      <ComponentCard title="Basic Information" desc="General job details">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Company
            </label>
            <p className="mt-1 text-base text-gray-900 dark:text-white">
              {company?.name || "Unknown Company"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Department
            </label>
            <p className="mt-1 text-base text-gray-900 dark:text-white">
              {department?.name || "Unknown Department"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Employment Type
            </label>
            <p className="mt-1 text-base text-gray-900 dark:text-white">
              {job?.employmentType
                ? (
                    job.employmentType
                      .split("-")
                      .map((p: string) => p[0].toUpperCase() + p.slice(1))
                      .join("-")
                  )
                : "N/A"}
            </p>
          </div>
        </div>
      </ComponentCard>

      {/* Description */}
      <ComponentCard title="Job Description" desc="Detailed job description">
        <div className="prose max-w-none dark:prose-invert">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {typeof job.description === "string" ? job.description : job.description?.en || "No description provided"}
          </p>
        </div>
      </ComponentCard>

      {/* Salary Information */}
      {job.salary && typeof job.salary === "number" && (
        <ComponentCard title="Salary Information" desc="Compensation details">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Salary
              </label>
              <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                $ {job.salary.toLocaleString()}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Salary Visibility
              </label>
              <p className="mt-1 text-base text-gray-900 dark:text-white">
                {job.salaryVisible ? "Public" : "Hidden"}
              </p>
            </div>
          </div>
        </ComponentCard>
      )}

      {/* Registration Period */}
      <ComponentCard title="Registration Period" desc="Application timeline">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Registration Start
            </label>
            <p className="mt-1 text-base text-gray-900 dark:text-white">
              {formatDate(job.registrationStart)}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Registration End
            </label>
            <p className="mt-1 text-base text-gray-900 dark:text-white">
              {formatDate(job.registrationEnd)}
            </p>
          </div>
        </div>
      </ComponentCard>

      {/* Requirements */}
      {job.requirements && job.requirements.length > 0 && (
        <ComponentCard
          title="Requirements"
          desc="Job requirements and qualifications"
        >
          <ul className="space-y-2">
            {job.requirements.map((req: string, index: number) => (
              <li
                key={index}
                className="flex items-start gap-3 text-gray-700 dark:text-gray-300"
              >
                <svg
                  className="mt-1 size-5 flex-shrink-0 text-brand-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </ComponentCard>
      )}

      {/* Terms and Conditions */}
      {job.termsAndConditions && job.termsAndConditions.length > 0 && (
        <ComponentCard
          title="Terms and Conditions"
          desc="Terms and conditions for this position"
        >
          <ul className="space-y-2">
            {job.termsAndConditions.map((term: any, index: number) => (
              <li
                key={index}
                className="flex items-start gap-3 text-gray-700 dark:text-gray-300"
              >
                <svg
                  className="mt-1 size-5 flex-shrink-0 text-amber-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{typeof term === "string" ? term : term?.en || ""}</span>
              </li>
            ))}
          </ul>
        </ComponentCard>
      )}

      {/* Job Specifications */}
      {job.jobSpecs && job.jobSpecs.length > 0 && (
        <ComponentCard
          title="Job Specifications"
          desc="Evaluation criteria and weights"
        >
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Specification
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Weight
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                {job.jobSpecs.map((spec: any, index: number) => (
                  <tr key={index}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {typeof spec.spec === "string" ? spec.spec : spec.spec?.en || ""}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {spec.weight}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <td className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Total Weight
                  </td>
                  <td className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {job.jobSpecs.reduce((sum: number, spec: any) => sum + spec.weight, 0)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </ComponentCard>
      )}

      {/* Custom Fields */}
      {job.customFields && job.customFields.length > 0 && (
        <ComponentCard
          title="Custom Application Fields"
          desc="Additional fields for applicants"
        >
          <div className="space-y-4">
            {job.customFields.map((field: any) => (
              <div
                key={field.fieldId}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {typeof field.label === "string" ? field.label : field.label?.en || ""}
                      {field.isRequired && (
                        <span className="ml-1 text-red-500">*</span>
                      )}
                    </h4>
                    <div className="mt-1 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <span>Type: {field.inputType}</span>
                      <span>•</span>
                      <span>Order: {field.displayOrder}</span>
                      {field.minValue !== undefined && (
                        <>
                          <span>•</span>
                          <span>Min: {field.minValue}</span>
                        </>
                      )}
                      {field.maxValue !== undefined && (
                        <>
                          <span>•</span>
                          <span>Max: {field.maxValue}</span>
                        </>
                      )}
                    </div>
                    {field.choices && field.choices.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Options:
                        </span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {field.choices.map((choice: any, idx: number) => (
                            <span
                              key={idx}
                              className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                            >
                              {typeof choice === "string" ? choice : choice?.en || ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ComponentCard>
      )}
    </div>
  );
}
