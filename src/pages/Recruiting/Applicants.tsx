import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
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

type JobGroup = {
  jobPositionId: string;
  jobTitle: string;
  applicants: Applicant[];
};

const Applicants = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedJobs, setExpandedJobs] = useState<string[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApplicants();
  }, []);

  const loadApplicants = async () => {
    try {
      setLoading(true);
      const data = await applicantsService.getAllApplicants();
      setApplicants(data);

      // Fetch job titles for each unique job position
      const uniqueJobIds = [...new Set(data.map((app) => app.jobPositionId))];
      const titles: Record<string, string> = {};

      await Promise.all(
        uniqueJobIds.map(async (jobId) => {
          try {
            const job = await jobPositionsService.getJobPositionById(jobId);
            titles[jobId] = job.title;
          } catch (err) {
            console.error(`Failed to fetch job ${jobId}:`, err);
            titles[jobId] = "Unknown Job";
          }
        })
      );

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
  };

  // Group applicants by job
  const groupedApplicants: JobGroup[] = Object.keys(jobTitles).map((jobId) => ({
    jobPositionId: jobId,
    jobTitle: jobTitles[jobId],
    applicants: applicants.filter((app) => app.jobPositionId === jobId),
  }));

  // Filter applicants by status
  const filteredGroups = groupedApplicants
    .map((group) => ({
      ...group,
      applicants:
        statusFilter === "all"
          ? group.applicants
          : group.applicants.filter((app) => app.status === statusFilter),
    }))
    .filter((group) => group.applicants.length > 0);

  const toggleJobExpand = (jobId: string) => {
    setExpandedJobs((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "approved":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "interview":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "rejected":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                {error}
              </div>
            )}

            {loading ? (
              <div className="p-12 text-center text-gray-500">
                Loading applicants...
              </div>
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
                                <TableRow
                                  key={applicant._id}
                                  onClick={() =>
                                    navigate(`/applicant/${applicant._id}`)
                                  }
                                  className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                  <TableCell className="px-4 py-3 align-middle">
                                    <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                      {applicant.profilePhoto ? (
                                        <img
                                          src={applicant.profilePhoto}
                                          alt={applicant.fullName}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500 dark:text-gray-400">
                                          {applicant.fullName
                                            .charAt(0)
                                            .toUpperCase()}
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
                                      {applicant.status
                                        .charAt(0)
                                        .toUpperCase() +
                                        applicant.status.slice(1)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="px-4 py-3 align-middle text-sm text-gray-600 dark:text-gray-400">
                                    {formatDate(applicant.submittedAt)}
                                  </TableCell>
                                </TableRow>
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
    </>
  );
};

export default Applicants;
