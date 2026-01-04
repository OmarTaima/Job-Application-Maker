import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { applicantsService, ApiError } from "../../services/applicantsService";
import type { Applicant } from "../../services/applicantsService";
import { jobPositionsService } from "../../services/jobPositionsService";
import { TrashBinIcon } from "../../icons";

type JobGroup = {
  jobPositionId: string;
  jobTitle: string;
  applicants: Applicant[];
};

// Memoized ApplicantRow component to prevent unnecessary re-renders
const ApplicantRow = memo(
  ({
    applicant,
    isSelected,
    onSelect,
    onNavigate,
    onPhotoPreview,
    getStatusColor,
    formatDate,
  }: {
    applicant: Applicant;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onNavigate: (id: string) => void;
    onPhotoPreview: (photo: string | null) => void;
    getStatusColor: (status: string) => string;
    formatDate: (date: string) => string;
  }) => {
    return (
      <TableRow
        onClick={() => onNavigate(applicant._id)}
        className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <TableCell className="px-4 py-3 align-middle">
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(applicant._id)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
            />
          </div>
        </TableCell>
        <TableCell className="px-4 py-3 align-middle">
          <div
            className="h-10 w-10 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 cursor-pointer hover:ring-2 hover:ring-brand-500 transition"
            onClick={(e) => {
              e.stopPropagation();
              if (applicant.profilePhoto) {
                onPhotoPreview(applicant.profilePhoto);
              }
            }}
          >
            {applicant.profilePhoto ? (
              <img
                src={applicant.profilePhoto}
                alt={applicant.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500 dark:text-gray-400">
                {applicant.fullName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell className="px-4 py-3 align-middle font-medium">
          {applicant.fullName}
        </TableCell>
        <TableCell className="px-4 py-3 align-middle">
          {applicant.email}
        </TableCell>
        <TableCell className="px-4 py-3 align-middle">
          {applicant.phone}
        </TableCell>
        <TableCell className="px-4 py-3 align-middle">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(
              applicant.status
            )}`}
          >
            {applicant.status.charAt(0).toUpperCase() +
              applicant.status.slice(1)}
          </span>
        </TableCell>
        <TableCell className="px-4 py-3 align-middle text-sm text-gray-600 dark:text-gray-400">
          {formatDate(applicant.submittedAt)}
        </TableCell>
      </TableRow>
    );
  }
);

ApplicantRow.displayName = "ApplicantRow";

const Applicants = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedJobs, setExpandedJobs] = useState<string[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplicants, setSelectedApplicants] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  // UI bulk actions
  type BulkAction = "" | "pending" | "approved" | "interview" | "rejected";
  // API allowed status values
  type ApiStatus =
    | "applied"
    | "under_review"
    | "interviewed"
    | "accepted"
    | "rejected"
    | "trashed";
  // map UI actions to API statuses
  const actionToApiStatus: Record<Exclude<BulkAction, "">, ApiStatus> = {
    pending: "under_review",
    approved: "accepted",
    interview: "interviewed",
    rejected: "rejected",
  };
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadApplicants();
  }, []);

  const loadApplicants = useCallback(async () => {
    try {
      setLoading(true);
      const data = await applicantsService.getAllApplicants();
      setApplicants(data);

      // Fetch job titles for each unique job position
      const uniqueJobIds = [
        ...new Set(
          data.map((app) =>
            typeof app.jobPositionId === "string"
              ? app.jobPositionId
              : (app.jobPositionId as any)?._id
          )
        ),
      ].filter((id): id is string => !!id);

      if (uniqueJobIds.length === 0) {
        setJobTitles({});
        setError(null);
        setLoading(false);
        return;
      }

      const titles: Record<string, string> = {};

      // Batch fetch with better error handling and Promise.allSettled for resilience
      const results = await Promise.allSettled(
        uniqueJobIds.map((jobId) =>
          jobPositionsService.getJobPositionById(jobId)
        )
      );

      results.forEach((result, index) => {
        const jobId = uniqueJobIds[index];
        if (result.status === "fulfilled") {
          titles[jobId] = result.value.title;
        } else {
          console.error(`Failed to fetch job ${jobId}:`, result.reason);
          titles[jobId] = "Unknown Job";
        }
      });

      setJobTitles(titles);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to load applicants";
      setError(errorMessage);
      console.error("Error loading applicants:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Group applicants by job (memoized for performance)
  const groupedApplicants: JobGroup[] = useMemo(() => {
    return Object.keys(jobTitles).map((jobId) => ({
      jobPositionId: jobId,
      jobTitle: jobTitles[jobId],
      applicants: applicants.filter((app) => {
        const appJobId =
          typeof app.jobPositionId === "string"
            ? app.jobPositionId
            : (app.jobPositionId as any)?._id;
        return appJobId === jobId;
      }),
    }));
  }, [applicants, jobTitles]);

  // Filter applicants by status (memoized for performance)
  const filteredGroups = useMemo(() => {
    return groupedApplicants
      .map((group) => ({
        ...group,
        applicants:
          statusFilter === "all"
            ? group.applicants
            : group.applicants.filter((app) => app.status === statusFilter),
      }))
      .filter((group) => group.applicants.length > 0);
  }, [groupedApplicants, statusFilter]);

  const toggleJobExpand = useCallback((jobId: string) => {
    setExpandedJobs((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId]
    );
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "approved":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "interview":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "rejected":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "trashed":
        return "bg-gray-500 text-white dark:bg-gray-600 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, []);

  const handleSelectApplicant = useCallback((applicantId: string) => {
    setSelectedApplicants((prev) =>
      prev.includes(applicantId)
        ? prev.filter((id) => id !== applicantId)
        : [...prev, applicantId]
    );
  }, []);

  const handleSelectAll = useCallback(
    (jobApplicants: Applicant[]) => {
      const jobApplicantIds = jobApplicants.map((app) => app._id);
      const allSelected = jobApplicantIds.every((id) =>
        selectedApplicants.includes(id)
      );

      if (allSelected) {
        setSelectedApplicants((prev) =>
          prev.filter((id) => !jobApplicantIds.includes(id))
        );
      } else {
        setSelectedApplicants((prev) => [
          ...new Set([...prev, ...jobApplicantIds]),
        ]);
      }
    },
    [selectedApplicants]
  );

  const handleNavigate = useCallback(
    (applicantId: string) => {
      navigate(`/applicant/${applicantId}`);
    },
    [navigate]
  );

  const handlePhotoPreview = useCallback((photo: string | null) => {
    setPreviewPhoto(photo);
  }, []);

  const handleBulkChangeStatus = useCallback(async () => {
    if (selectedApplicants.length === 0 || !bulkAction) return;

    const confirmed = window.confirm(
      `Are you sure you want to change the status of ${selectedApplicants.length} applicant(s) to ${bulkAction}?`
    );

    if (!confirmed) return;

    // map the UI bulk action to the API status value
    const apiStatus = bulkAction
      ? actionToApiStatus[bulkAction as Exclude<BulkAction, "">]
      : undefined;
    if (!apiStatus) {
      setError("Invalid status selected");
      return;
    }

    try {
      setIsProcessing(true);
      await Promise.all(
        selectedApplicants.map((id) =>
          applicantsService.updateApplicantStatus(id, {
            status: apiStatus,
            notes: `Bulk status change to ${apiStatus} on ${new Date().toLocaleDateString()}`,
          })
        )
      );
      setSelectedApplicants([]);
      setBulkAction("");
      await loadApplicants();
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to change status";
      setError(errorMessage);
      console.error("Error changing status:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedApplicants, bulkAction, loadApplicants]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedApplicants.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedApplicants.length} applicant(s)? They will be moved to trash.`
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await Promise.all(
        selectedApplicants.map((id) =>
          applicantsService.updateApplicantStatus(id, {
            status: "trashed",
            notes: `Moved to trash on ${new Date().toLocaleDateString()}`,
          })
        )
      );
      setSelectedApplicants([]);
      await loadApplicants();
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to delete applicants";
      setError(errorMessage);
      console.error("Error deleting applicants:", err);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedApplicants, loadApplicants]);

  return (
    <>
      <PageMeta title="Applicants" description="Manage job applicants" />
      <PageBreadcrumb pageTitle="Applicants" />

      <div className="grid gap-6">
        <ComponentCard
          title="Job Applicants"
          desc="View and manage all applicants"
        >
          <>
            {/* Bulk Actions Bar */}
            {selectedApplicants.length > 0 && (
              <div className="mb-4 flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3 dark:bg-brand-900/20">
                <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
                  {selectedApplicants.length} applicant(s) selected
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={bulkAction}
                      onChange={(e) =>
                        setBulkAction(e.target.value as BulkAction)
                      }
                      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    >
                      <option value="">Select Status</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="interview">Interview</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <button
                      onClick={handleBulkChangeStatus}
                      disabled={isProcessing || !bulkAction}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? "Changing..." : "Change Status"}
                    </button>
                  </div>
                  <button
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <TrashBinIcon className="h-4 w-4" />
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                {error}
              </div>
            )}

            {loading ? (
              <LoadingSpinner message="Loading applicants..." />
            ) : (
              <>
                {/* Status Filter */}
                <div className="mb-6 flex flex-wrap gap-2">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      statusFilter === "all"
                        ? "bg-brand-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    View All
                  </button>
                  <button
                    onClick={() => setStatusFilter("pending")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      statusFilter === "pending"
                        ? "bg-yellow-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => setStatusFilter("approved")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      statusFilter === "approved"
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    Approved
                  </button>
                  <button
                    onClick={() => setStatusFilter("interview")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      statusFilter === "interview"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    Interview
                  </button>
                  <button
                    onClick={() => setStatusFilter("rejected")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      statusFilter === "rejected"
                        ? "bg-red-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    Rejected
                  </button>
                  <button
                    onClick={() => setStatusFilter("trashed")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      statusFilter === "trashed"
                        ? "bg-gray-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    Trashed
                  </button>
                </div>

                {/* Grouped Applicants by Job */}
                <div className="space-y-4">
                  {filteredGroups.map((group) => (
                    <div
                      key={group.jobPositionId}
                      className="rounded-lg border border-stroke dark:border-strokedark"
                    >
                      {/* Job Title Header - Clickable */}
                      <button
                        onClick={() => toggleJobExpand(group.jobPositionId)}
                        className="flex w-full items-center justify-between bg-gray-50 px-6 py-4 text-left transition hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
                      >
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {group.jobTitle}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {group.applicants.length} applicant
                            {group.applicants.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <svg
                          className={`h-5 w-5 transition-transform ${
                            expandedJobs.includes(group.jobPositionId)
                              ? "rotate-180"
                              : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {/* Applicants Table - Expandable */}
                      {expandedJobs.includes(group.jobPositionId) && (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="bg-gray-50 dark:bg-gray-800">
                              <TableRow>
                                <TableCell
                                  isHeader
                                  className="px-4 py-3 align-middle text-left font-semibold w-12"
                                >
                                  <input
                                    type="checkbox"
                                    checked={group.applicants.every((app) =>
                                      selectedApplicants.includes(app._id)
                                    )}
                                    onChange={() =>
                                      handleSelectAll(group.applicants)
                                    }
                                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                                  />
                                </TableCell>
                                <TableCell
                                  isHeader
                                  className="px-4 py-3 align-middle text-left font-semibold"
                                >
                                  Photo
                                </TableCell>
                                <TableCell
                                  isHeader
                                  className="px-4 py-3 align-middle text-left font-semibold"
                                >
                                  Name
                                </TableCell>
                                <TableCell
                                  isHeader
                                  className="px-4 py-3 align-middle text-left font-semibold"
                                >
                                  Email
                                </TableCell>
                                <TableCell
                                  isHeader
                                  className="px-4 py-3 align-middle text-left font-semibold"
                                >
                                  Phone
                                </TableCell>
                                <TableCell
                                  isHeader
                                  className="px-4 py-3 align-middle text-left font-semibold"
                                >
                                  Status
                                </TableCell>
                                <TableCell
                                  isHeader
                                  className="px-4 py-3 align-middle text-left font-semibold"
                                >
                                  Submitted
                                </TableCell>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.applicants.map((applicant) => (
                                <ApplicantRow
                                  key={applicant._id}
                                  applicant={applicant}
                                  isSelected={selectedApplicants.includes(
                                    applicant._id
                                  )}
                                  onSelect={handleSelectApplicant}
                                  onNavigate={handleNavigate}
                                  onPhotoPreview={handlePhotoPreview}
                                  getStatusColor={getStatusColor}
                                  formatDate={formatDate}
                                />
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  ))}

                  {filteredGroups.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-800/30">
                      <p className="text-gray-500 dark:text-gray-400">
                        No applicants found for the selected status.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        </ComponentCard>
      </div>

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] p-4">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              ✕
            </button>
            <img
              src={previewPhoto}
              alt="Applicant photo preview"
              className="max-h-[85vh] max-w-full rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Applicants;
