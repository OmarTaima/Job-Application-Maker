import { useState, useEffect } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { Link, useNavigate } from "react-router";
import { PlusIcon, PencilIcon, TrashBinIcon } from "../../icons";
import Switch from "../../components/form/switch/Switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  jobPositionsService,
  ApiError,
} from "../../services/jobPositionsService";
import type { JobPosition } from "../../services/jobPositionsService";
import { companiesService } from "../../services/companiesService";
import { departmentsService } from "../../services/departmentsService";

type Job = JobPosition & {
  companyName?: string;
  departmentName?: string;
};

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const positions = await jobPositionsService.getAllJobPositions();

      // Fetch company and department names
      const jobsWithNames = await Promise.all(
        positions.map(async (position) => {
          let companyName = "Unknown Company";
          let departmentName = "Unknown Department";

          // Normalize IDs (handle cases where the API returns populated objects)
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

          return {
            ...position,
            companyName,
            departmentName,
          };
        })
      );

      setJobs(jobsWithNames);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to load jobs";
      setError(errorMessage);
      console.error("Error loading jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs.filter(
    (job) =>
      job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.jobCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.departmentName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleActive = async (jobId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "open" ? "closed" : "open";
      await jobPositionsService.updateJobPosition(jobId, {
        status: newStatus as "open" | "closed",
      });

      // Update local state
      setJobs(
        jobs.map((job) =>
          job._id === jobId
            ? { ...job, status: newStatus as "open" | "closed" }
            : job
        )
      );
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to update job status";
      setError(errorMessage);
      console.error("Error updating job status:", err);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this job?")) return;

    try {
      await jobPositionsService.deleteJobPosition(jobId);
      setJobs(jobs.filter((job) => job._id !== jobId));
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to delete job";
      setError(errorMessage);
      console.error("Error deleting job:", err);
    }
  };

  const handleEditJob = (job: Job) => {
    // Navigate to edit job page - TODO: implement edit page
    navigate(`/create-job?id=${job._id}`);
  };

  return (
    <div className="space-y-6">
      <PageMeta
        title="Jobs | TailAdmin React"
        description="View and manage all job postings across companies."
      />
      <PageBreadcrumb pageTitle="Jobs" />

      <ComponentCard
        title="All Jobs"
        desc="Browse and manage job postings across all companies"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 w-full max-w-md rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              />
            </div>
            <Link
              to="/create-job"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <PlusIcon className="size-4" />
              Create Job
            </Link>
          </div>

          {loading ? (
            <LoadingSpinner message="Loading jobs..." />
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12 dark:border-gray-700">
              <svg
                className="mb-4 size-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                No jobs found
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Get started by creating a new job"}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                    <TableRow>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Job Title
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Job Code
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Company
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Department
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Positions
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Deadline
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Status
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHeader>

                  <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {filteredJobs.map((job) => (
                      <TableRow
                        key={job._id}
                        onClick={() => navigate(`/job/${job._id}`)}
                        className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                      >
                        <TableCell className="px-5 py-4 text-start">
                          <span className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                            {job.title}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                            {job.jobCode || "N/A"}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <span className="text-sm text-gray-800 dark:text-gray-200">
                            {job.companyName || "Unknown"}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {job.departmentName || "Unknown"}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-400/40">
                            {job.openPositions || 0}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                          {job.registrationEnd
                            ? new Date(job.registrationEnd).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }
                              )
                            : "N/A"}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Switch
                              label=""
                              defaultChecked={job.status === "open"}
                              onChange={() =>
                                handleToggleActive(job._id, job.status)
                              }
                            />
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleEditJob(job)}
                              className="rounded p-1.5 text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                              title="Edit job"
                            >
                              <PencilIcon className="size-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteJob(job._id)}
                              className="rounded p-1.5 text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                              title="Delete job"
                            >
                              <TrashBinIcon className="size-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </ComponentCard>
    </div>
  );
}
