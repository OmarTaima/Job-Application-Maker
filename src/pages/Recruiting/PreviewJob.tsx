import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import {
  jobPositionsService,
  ApiError,
} from "../../services/jobPositionsService";
import type { JobPosition } from "../../services/jobPositionsService";
import { companiesService } from "../../services/companiesService";
import { departmentsService } from "../../services/departmentsService";
import { PencilIcon, TrashBinIcon } from "../../icons";

type JobDetails = JobPosition & {
  companyName?: string;
  departmentName?: string;
};

export default function PreviewJob() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (jobId) {
      loadJobDetails();
    }
  }, [jobId]);

  const loadJobDetails = async () => {
    if (!jobId) return;

    try {
      setLoading(true);
      const position = await jobPositionsService.getJobPositionById(jobId);

      // Fetch company and department names
      let companyName = "Unknown Company";
      let departmentName = "Unknown Department";

      const companyId =
        typeof position.companyId === "string"
          ? position.companyId
          : (position.companyId as any)?._id;

      const departmentId =
        typeof position.departmentId === "string"
          ? position.departmentId
          : (position.departmentId as any)?._id;

      try {
        if (companyId) {
          const company = await companiesService.getCompanyById(companyId);
          companyName = company.name;
        }
      } catch (err) {
        console.error(`Failed to fetch company ${companyId}:`, err);
      }

      try {
        if (departmentId) {
          const department = await departmentsService.getDepartmentById(
            departmentId
          );
          departmentName = department.name;
        }
      } catch (err) {
        console.error(`Failed to fetch department ${departmentId}:`, err);
      }

      setJob({
        ...position,
        companyName,
        departmentName,
      });
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to load job details";
      setError(errorMessage);
      console.error("Error loading job details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/create-job?id=${jobId}`);
  };

  const handleDelete = async () => {
    if (!jobId || !confirm("Are you sure you want to delete this job?")) return;

    try {
      await jobPositionsService.deleteJobPosition(jobId);
      navigate("/jobs");
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to delete job";
      setError(errorMessage);
      console.error("Error deleting job:", err);
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

  if (loading) {
    return (
      <div className="space-y-6">
        <PageMeta title="Loading..." description="Loading job details" />
        <PageBreadcrumb pageTitle="Job Details" />
        <LoadingSpinner fullPage message="Loading job details..." />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-6">
        <PageMeta title="Error" description="Failed to load job" />
        <PageBreadcrumb pageTitle="Job Details" />
        <div className="p-12 text-center">
          <p className="text-red-600 dark:text-red-400">
            {error || "Job not found"}
          </p>
          <button
            onClick={() => navigate("/jobs")}
            className="mt-4 text-brand-600 hover:text-brand-700 dark:text-brand-400"
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

      <PageBreadcrumb pageTitle={job.title} />

      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {job.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Job Code: {job.jobCode || "N/A"}
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
            className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-red-600"
          >
            <TrashBinIcon className="size-4" />
            Delete
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Company
            </label>
            <p className="mt-1 text-base text-gray-900 dark:text-white">
              {job.companyName}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Department
            </label>
            <p className="mt-1 text-base text-gray-900 dark:text-white">
              {job.departmentName}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Employment Type
            </label>
            <p className="mt-1 text-base text-gray-900 dark:text-white">
              {job.employmentType || "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Location
            </label>
            <p className="mt-1 text-base text-gray-900 dark:text-white">
              {job.location || "N/A"}
            </p>
          </div>
        </div>
      </ComponentCard>

      {/* Description */}
      <ComponentCard title="Job Description" desc="Detailed job description">
        <div className="prose max-w-none dark:prose-invert">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {job.description || "No description provided"}
          </p>
        </div>
      </ComponentCard>

      {/* Salary Information */}
      {job.salary && (job.salary.min || job.salary.max) && (
        <ComponentCard title="Salary Information" desc="Compensation details">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {job.salary.min && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Minimum Salary
                </label>
                <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                  {job.salary.currency || "$"} {job.salary.min.toLocaleString()}
                </p>
              </div>
            )}
            {job.salary.max && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Maximum Salary
                </label>
                <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                  {job.salary.currency || "$"} {job.salary.max.toLocaleString()}
                </p>
              </div>
            )}
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
            {job.requirements.map((req, index) => (
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
            {job.termsAndConditions.map((term, index) => (
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
                <span>{term}</span>
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
                {job.jobSpecs.map((spec, index) => (
                  <tr key={index}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {spec.spec}
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
                    {job.jobSpecs.reduce((sum, spec) => sum + spec.weight, 0)}%
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
            {job.customFields.map((field) => (
              <div
                key={field.fieldId}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {field.label}
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
                          {field.choices.map((choice, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                            >
                              {choice}
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
