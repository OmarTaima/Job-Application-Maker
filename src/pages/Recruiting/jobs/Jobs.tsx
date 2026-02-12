import { useState, useMemo } from "react";
import Swal from "sweetalert2";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import ComponentCard from "../../../components/common/ComponentCard";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { Link, useNavigate } from "react-router";
import { PlusIcon, PencilIcon, TrashBinIcon } from "../../../icons";
import { useAuth } from "../../../context/AuthContext";
import Switch from "../../../components/form/switch/Switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  useJobPositions,
  useDeleteJobPosition,
  useUpdateJobPosition,
} from "../../../hooks/queries";
import type { JobPosition } from "../../../store/slices/jobPositionsSlice";
import { toPlainString } from "../../../utils/strings";

type Job = JobPosition & {
  companyName?: string;
  departmentName?: string;
};

export default function Jobs() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  // Check permissions
  const canRead = hasPermission("Job Position Management", "read");
  const canCreate = hasPermission("Job Position Management", "create");
  const canWrite = hasPermission("Job Position Management", "write");

  const [searchTerm, setSearchTerm] = useState("");

  // Memoize user-derived values
  const { isAdmin, companyId } = useMemo(() => {
    if (!user) return { isAdmin: false, companyId: undefined };

    const isAdmin = user?.roleId?.name?.toLowerCase().includes("super admin");
    const usercompanyId = user?.companies?.map((c) =>
      typeof c.companyId === "string" ? c.companyId : c.companyId._id
    );

    const companyId =
      !isAdmin && usercompanyId?.length ? usercompanyId : undefined;

    return { isAdmin, companyId };
  }, [user?._id, user?.roleId?.name, user?.companies?.length]);

  // Use React Query hooks
  const {
    data: jobPositions = [],
    isLoading: jobsLoading,
    error,
  } = useJobPositions(companyId);
  const deleteJobMutation = useDeleteJobPosition();
  const updateJobMutation = useUpdateJobPosition();

  const [statusError, setStatusError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeletingJob, setIsDeletingJob] = useState<string | null>(null);
  const [isUpdatingJob, setIsUpdatingJob] = useState<string | null>(null);

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

  // Enrich job positions with company and department names
  const jobs = useMemo(() => {
    // Extract user's assigned company IDs for filtering
    const usercompanyId = user?.companies?.map((c) =>
      typeof c.companyId === "string" ? c.companyId : c.companyId._id
    );

    // Filter and enrich job positions
    return jobPositions
      .filter((position: any) => {
        // Admin users see all jobs
        if (isAdmin) return true;

        // Non-admin users only see jobs from their assigned companies
        if (!usercompanyId || usercompanyId.length === 0) return false;

        // Get the company ID from the position (handle both string and object)
        const positionCompanyId =
          typeof position.companyId === "string"
            ? position.companyId
            : (position.companyId as any)?._id;

        return usercompanyId.includes(positionCompanyId);
      })
      .map((position: any) => {
        // Extract company and department names from populated data
        const companyName = typeof position.companyId === "object" && position.companyId
          ? toPlainString((position.companyId as any).name) || "Unknown Company"
          : "Unknown Company";

        const departmentName = typeof position.departmentId === "object" && position.departmentId
          ? toPlainString((position.departmentId as any).name) || "Unknown Department"
          : "Unknown Department";

        return {
          ...position,
          companyName,
          departmentName,
        };
      });
  }, [jobPositions, user, isAdmin]);

  const filteredJobs = jobs.filter(
    (job: any) => {
      const title = typeof job.title === "string" ? job.title : job.title?.en || "";
      const companyName = toPlainString(job.companyName);
      const departmentName = toPlainString(job.departmentName);
      return (
        title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.jobCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        departmentName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  );

  const handleToggleActive = async (jobId: string, currentIsActive: boolean) => {
    try {
      const newIsActive = !currentIsActive;
      
      // Find the job to get required fields
      const job = jobPositions.find((j: any) => j._id === jobId);
      if (!job) {
        throw new Error("Job not found");
      }
      
      await updateJobMutation.mutateAsync({
        id: jobId,
        data: { 
          isActive: newIsActive,
          workArrangement: job.workArrangement // Include required field
        },
      });
      await Swal.fire({
        title: "Success!",
        text: `Job ${newIsActive ? "activated" : "deactivated"} successfully.`,
        icon: "success",
        position: "center",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err: any) {
      console.error("Error updating job status:", err);
      const errorMsg = getErrorMessage(err);
      setStatusError(errorMsg);
    } finally {
      setIsUpdatingJob(null);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
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
      setIsDeletingJob(jobId);
      await deleteJobMutation.mutateAsync(jobId);
      await Swal.fire({
        title: "Deleted!",
        text: "Job has been deleted successfully.",
        icon: "success",
        position: "center",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
      });
    } catch (err: any) {
      console.error("Error deleting job:", err);
      const errorMsg = getErrorMessage(err);
      setDeleteError(errorMsg);
    } finally {
      setIsDeletingJob(null);
    }
  };

  const isLoading = jobsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600">
        Error loading jobs: {(error as Error).message}
      </div>
    );
  }

  // If user doesn't have read permission, show access denied
  if (!canRead) {
    return (
      <div className="space-y-6">
        <PageMeta
          title="Jobs | Saber Group - Hiring Management System"
          description="View and manage all job positions in the system."
        />
        <PageBreadcrumb pageTitle="Jobs" />
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
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Access Denied
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            You don't have permission to view jobs
          </p>
        </div>
      </div>
    );
  }

  const handleEditJob = (job: Job) => {
    // Navigate to edit job page with state to avoid re-fetching
    navigate(`/create-job?id=${job._id}`, {
      state: { job }
    });
  };
  console.log(jobPositions)
  return (
    <div className="space-y-6">
      <PageMeta
        title="Jobs | Saber Group - Hiring Management System"
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

          {statusError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start justify-between">
                <p className="text-sm text-red-600 dark:text-red-400">
                  <strong>Error updating status:</strong> {statusError}
                </p>
                <button
                  type="button"
                  onClick={() => setStatusError("")}
                  className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {deleteError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start justify-between">
                <p className="text-sm text-red-600 dark:text-red-400">
                  <strong>Error deleting job:</strong> {deleteError}
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
            {canCreate && (
              <Link
                to="/create-job"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <PlusIcon className="size-4" />
                Create Job
              </Link>
            )}
          </div>

          {isLoading ? (
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
                    {filteredJobs.map((job: any) => (
                      <TableRow
                        key={job._id}
                        onClick={() => navigate(`/job/${job._id}`, { state: { job } })}
                        className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                      >
                        <TableCell className="px-5 py-4 text-start">
                          <span className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                            {typeof job.title === "string" ? job.title : job.title?.en || "Untitled"}
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
                            {canWrite ? (
                              <Switch
                                label=""
                                checked={(job as any).isActive === true}
                                onChange={() =>
                                  handleToggleActive(job._id, (job as any).isActive || false)
                                }
                                disabled={isUpdatingJob === job._id}
                              />
                            ) : (
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {(job as any).isActive ? "Active" : "Inactive"}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canWrite && (
                              <button
                                onClick={() => handleEditJob(job)}
                                className="rounded p-1.5 text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                                title="Edit job"
                              >
                                <PencilIcon className="size-4" />
                              </button>
                            )}
                            {canCreate && (
                              <button
                                onClick={() => handleDeleteJob(job._id)}
                                disabled={isDeletingJob === job._id}
                                className="rounded p-1.5 text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={isDeletingJob === job._id ? "Deleting..." : "Delete job"}
                              >
                                <TrashBinIcon className="size-4" />
                              </button>
                            )}
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
