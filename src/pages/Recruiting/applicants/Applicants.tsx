import { useState, useMemo, useCallback, memo } from "react";
import Swal from "sweetalert2";
import { useNavigate } from "react-router";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { TrashBinIcon } from "../../../icons";
import { useAuth } from "../../../context/AuthContext";
import {
  useApplicants,
  useJobPositions,
  useUpdateApplicantStatus,
  useCompanies,
} from "../../../hooks/queries";
import type { Applicant } from "../../../store/slices/applicantsSlice";

// (previous JobGroup type removed — grouping is handled by company/job structure)

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
  const { user } = useAuth();

  // Local state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedJobs, setExpandedJobs] = useState<string[]>([]);
  const [expandedCompanies, setExpandedCompanies] = useState<string[]>([]);
  const [selectedApplicants, setSelectedApplicants] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Memoize user-derived values
  const companyIds = useMemo(() => {
    if (!user) return undefined;

    const isAdmin = user?.roleId?.name?.toLowerCase().includes("admin");
    const userCompanyIds = user?.companies?.map((c) =>
      typeof c.companyId === "string" ? c.companyId : c.companyId._id
    );

    return !isAdmin && userCompanyIds?.length ? userCompanyIds : undefined;
  }, [user?._id, user?.roleId?.name, user?.companies]);

  // Use React Query hooks — request only applicants that are assigned to a job position
  const {
    data: applicants = [],
    isLoading: applicantsLoading,
    error,
  } = useApplicants(companyIds);
  const { data: jobPositions = [], isLoading: jobPositionsLoading } =
    useJobPositions(companyIds);
  const updateStatusMutation = useUpdateApplicantStatus();

  const [bulkStatusError, setBulkStatusError] = useState("");
  const [bulkDeleteError, setBulkDeleteError] = useState("");

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

  // Fetch all companies for selector and grouping
  const { data: allCompanies = [], isLoading: allCompaniesLoading } = useCompanies();

  // Build a nested structure: companies -> jobs -> applicants
  const companyJobApplicantGroups = useMemo(() => {
    // helper to normalize id
    const getId = (v: any) => (typeof v === "string" ? v : v?._id);

    // map job id to job info
    const jobsById: Record<string, any> = {};
    jobPositions.forEach((job) => {
      const jid = getId(job._id);
      const cid = getId(job.companyId) || "unknown";
      jobsById[jid] = {
        jobPositionId: jid,
        jobTitle: typeof job.title === "string" ? job.title : job.title?.en || "Untitled",
        companyId: cid,
        applicants: [] as Applicant[],
      };
    });

    // assign applicants to their job entry
    applicants.forEach((app: Applicant) => {
      const appJobId = getId(app.jobPositionId);
      if (!appJobId) return;
      if (!jobsById[appJobId]) return;
      jobsById[appJobId].applicants.push(app);
    });

    // group jobs under companies
    const groups: Array<{
      companyId: string;
      companyName: string;
      jobs: Array<{ jobPositionId: string; jobTitle: string; applicants: Applicant[] }>;
    }> = [];

    // start from all companies list (so we show companies even with no applicants)
    const companiesList = allCompanies && allCompanies.length ? allCompanies : [];

    // map for quick lookup
    companiesList.forEach((c: any) => {
      const cid = getId(c._id);
      groups.push({ companyId: cid, companyName: c.name || c.title || "Unnamed Company", jobs: [] });
    });

    // For jobs that belong to a company, add them (include jobs even if they have no applicants)
    Object.values(jobsById).forEach((job: any) => {
      const cid = job.companyId || "unknown";
      const companyGroup = groups.find((g) => g.companyId === cid);
      if (companyGroup) {
        // filter applicants by status
        const apps = job.applicants.filter((app: Applicant) => {
          if (statusFilter === "all") return app.status !== "trashed";
          return app.status === statusFilter;
        });
        // only include jobs that have applicants after filtering
        if (apps.length > 0) {
          companyGroup.jobs.push({ jobPositionId: job.jobPositionId, jobTitle: job.jobTitle, applicants: apps });
        }
      }
    });

    // Keep companies that have at least one job (even if that job has no applicants)
    return groups.filter((g) => g.jobs.length > 0);
  }, [allCompanies, jobPositions, applicants, statusFilter]);

  // Companies visible after applying selectedCompany filter
  const visibleCompanies = useMemo(() => {
    return selectedCompany === "all"
      ? companyJobApplicantGroups
      : companyJobApplicantGroups.filter((g) => g.companyId === selectedCompany);
  }, [companyJobApplicantGroups, selectedCompany]);

  const toggleJobExpand = useCallback((jobId: string) => {
    setExpandedJobs((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId]
    );
  }, []);

  const toggleCompanyExpand = useCallback((companyId: string) => {
    setExpandedCompanies((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
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
      // Find and pass the applicant data to avoid re-fetching
      const applicantData = applicants.find((app) => app._id === applicantId);
      navigate(`/applicant/${applicantId}`, {
        state: { applicant: applicantData },
      });
    },
    [navigate, applicants]
  );

  const handlePhotoPreview = useCallback((photo: string | null) => {
    setPreviewPhoto(photo);
  }, []);

  const handleBulkChangeStatus = useCallback(async () => {
    if (selectedApplicants.length === 0 || !bulkAction) return;

    const result = await Swal.fire({
      title: "Change Status?",
      text: `Are you sure you want to change the status of ${selectedApplicants.length} applicant(s) to ${bulkAction}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, change it!",
    });

    if (!result.isConfirmed) return;

    try {
      setIsProcessing(true);
      // Make API calls
      await Promise.all(
        selectedApplicants.map((id) =>
          updateStatusMutation.mutateAsync({
            id,
            data: {
              status: bulkAction as
                | "applied"
                | "under_review"
                | "interviewed"
                | "accepted"
                | "rejected"
                | "trashed",
              notes: `Bulk status change to ${bulkAction} on ${new Date().toLocaleDateString()}`,
            },
          })
        )
      );

      await Swal.fire({
        title: "Success!",
        text: `Status updated for ${selectedApplicants.length} applicant(s).`,
        icon: "success",
        position: "center",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
      });

      setSelectedApplicants([]);
      setBulkAction("");
    } catch (err: any) {
      console.error("Error changing status:", err);
      const errorMsg = getErrorMessage(err);
      setBulkStatusError(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedApplicants, bulkAction, updateStatusMutation]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedApplicants.length === 0) return;

    const result = await Swal.fire({
      title: "Delete Applicants?",
      text: `Are you sure you want to delete ${selectedApplicants.length} applicant(s)? They will be moved to trash.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete them!",
    });

    if (!result.isConfirmed) return;

    try {
      setIsDeleting(true);
      // Make API calls
      await Promise.all(
        selectedApplicants.map((id) =>
          updateStatusMutation.mutateAsync({
            id,
            data: {
              status: "trashed",
              notes: `Moved to trash on ${new Date().toLocaleDateString()}`,
            },
          })
        )
      );

      await Swal.fire({
        title: "Success!",
        text: `${selectedApplicants.length} applicant(s) moved to trash.`,
        icon: "success",
        position: "center",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
      });

      setSelectedApplicants([]);
    } catch (err: any) {
      console.error("Error deleting applicants:", err);
      const errorMsg = getErrorMessage(err);
      setBulkDeleteError(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedApplicants, updateStatusMutation]);

  return (
    <>
      <PageMeta title="Applicants" description="Manage job applicants" />
      <PageBreadcrumb pageTitle="Applicants" />

      {applicantsLoading || jobPositionsLoading ? (
        <LoadingSpinner fullPage message="Loading applicants..." />
      ) : (
        <div className="grid gap-6">
          <ComponentCard
            title="Job Applicants"
            desc="View and manage all applicants"
          >
            <>
              {/* Error Messages */}
              {bulkStatusError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      <strong>Error changing status:</strong> {bulkStatusError}
                    </p>
                    <button
                      type="button"
                      onClick={() => setBulkStatusError("")}
                      className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {bulkDeleteError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      <strong>Error deleting applicants:</strong>{" "}
                      {bulkDeleteError}
                    </p>
                    <button
                      type="button"
                      onClick={() => setBulkDeleteError("")}
                      className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

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
                        onChange={(e) => setBulkAction(e.target.value)}
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
                  {String(error)}
                </div>
              )}

              {applicantsLoading || jobPositionsLoading ? (
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

                  {/* Companies -> Jobs -> Applicants */}
                  <div className="mb-4 flex items-center justify-between">
                    <div />
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Company:</label>
                      <select
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                        disabled={allCompaniesLoading}
                        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="all">All Companies</option>
                        {allCompanies && allCompanies.map((c: any) => (
                          <option key={c._id} value={typeof c._id === 'string' ? c._id : c._id._id}>{c.name || c.title || c._id}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {visibleCompanies.map((company) => (
                      <div key={company.companyId} className="rounded-lg border border-stroke dark:border-strokedark">
                        <button
                          onClick={() => toggleCompanyExpand(company.companyId)}
                          className="flex w-full items-center justify-between bg-gray-50 px-6 py-4 text-left transition hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
                        >
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{company.companyName}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{company.jobs.length} job{company.jobs.length !== 1 ? 's' : ''}</p>
                          </div>
                          <svg
                            className={`h-5 w-5 transition-transform ${expandedCompanies.includes(company.companyId) ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {expandedCompanies.includes(company.companyId) && (
                          <div className="space-y-4 p-4">
                            {company.jobs.map((job) => (
                              <div key={job.jobPositionId} className="rounded-lg border border-dashed border-stroke dark:border-strokedark">
                                <button
                                  onClick={() => toggleJobExpand(job.jobPositionId)}
                                  className="flex w-full items-center justify-between bg-gray-50 px-6 py-3 text-left transition hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
                                >
                                  <div>
                                    <h4 className="text-md font-medium text-gray-900 dark:text-white">{job.jobTitle}</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{job.applicants.length} applicant{job.applicants.length !== 1 ? 's' : ''}</p>
                                  </div>
                                  <svg className={`h-5 w-5 transition-transform ${expandedJobs.includes(job.jobPositionId) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>

                                {expandedJobs.includes(job.jobPositionId) && (
                                  <div className="overflow-x-auto">
                                    <Table>
                                      <TableHeader className="bg-gray-50 dark:bg-gray-800">
                                        <TableRow>
                                          <TableCell isHeader className="px-4 py-3 align-middle text-left font-semibold w-12">
                                            <input
                                              type="checkbox"
                                              checked={job.applicants.every((app) => selectedApplicants.includes(app._id))}
                                              onChange={() => handleSelectAll(job.applicants)}
                                              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                                            />
                                          </TableCell>
                                          <TableCell isHeader className="px-4 py-3 align-middle text-left font-semibold">Photo</TableCell>
                                          <TableCell isHeader className="px-4 py-3 align-middle text-left font-semibold">Name</TableCell>
                                          <TableCell isHeader className="px-4 py-3 align-middle text-left font-semibold">Email</TableCell>
                                          <TableCell isHeader className="px-4 py-3 align-middle text-left font-semibold">Phone</TableCell>
                                          <TableCell isHeader className="px-4 py-3 align-middle text-left font-semibold">Status</TableCell>
                                          <TableCell isHeader className="px-4 py-3 align-middle text-left font-semibold">Submitted</TableCell>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {applicantsLoading ? (
                                          Array.from({ length: 3 }).map((_, i) => (
                                            <TableRow key={`skeleton-${job.jobPositionId}-${i}`} className="animate-pulse">
                                              <TableCell className="px-4 py-3 align-middle"><div className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700" /></TableCell>
                                              <TableCell className="px-4 py-3 align-middle"><div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" /></TableCell>
                                              <TableCell className="px-4 py-3 align-middle font-medium"><div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" /></TableCell>
                                              <TableCell className="px-4 py-3 align-middle"><div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" /></TableCell>
                                              <TableCell className="px-4 py-3 align-middle"><div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" /></TableCell>
                                              <TableCell className="px-4 py-3 align-middle"><div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" /></TableCell>
                                              <TableCell className="px-4 py-3 align-middle text-sm text-gray-600 dark:text-gray-400"><div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" /></TableCell>
                                            </TableRow>
                                          ))
                                        ) : (
                                          job.applicants.map((applicant) => (
                                            <ApplicantRow
                                              key={applicant._id}
                                              applicant={applicant}
                                              isSelected={selectedApplicants.includes(applicant._id)}
                                              onSelect={handleSelectApplicant}
                                              onNavigate={handleNavigate}
                                              onPhotoPreview={handlePhotoPreview}
                                              getStatusColor={getStatusColor}
                                              formatDate={formatDate}
                                            />
                                          ))
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {visibleCompanies.length === 0 && (
                      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-800/30">
                        <p className="text-gray-500 dark:text-gray-400">
                          {selectedCompany === "all"
                            ? "No applicants found for the selected status/company."
                            : "No jobs with applicants for the selected company."}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          </ComponentCard>
        </div>
      )}

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
