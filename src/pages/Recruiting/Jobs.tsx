import { useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import { Link, useNavigate } from "react-router";
import { PlusIcon, PencilIcon } from "../../icons";
import Switch from "../../components/form/switch/Switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

type Job = {
  id: string;
  companyId: string;
  companyName: string;
  departmentId: string;
  departmentName: string;
  jobCode: string;
  title: string;
  openPositions: number;
  registrationEnd: string;
  isActive: boolean;
};

// Mock data - replace with API call
const mockJobs: Job[] = [
  {
    id: "JOB-001",
    companyId: "COMP-12345678",
    companyName: "Tech Solutions Inc.",
    departmentId: "DEPT-001",
    departmentName: "Software Development",
    jobCode: "DEV-FE-001",
    title: "Senior Frontend Developer",
    openPositions: 3,
    registrationEnd: "2024-12-31",
    isActive: true,
  },
  {
    id: "JOB-002",
    companyId: "COMP-87654321",
    companyName: "Innovation Labs",
    departmentId: "DEPT-002",
    departmentName: "Human Resources",
    jobCode: "HR-MGR-001",
    title: "HR Manager",
    openPositions: 1,
    registrationEnd: "2024-11-30",
    isActive: true,
  },
  {
    id: "JOB-003",
    companyId: "COMP-11223344",
    companyName: "Digital Ventures",
    departmentId: "DEPT-003",
    departmentName: "Marketing",
    jobCode: "MKT-SPE-001",
    title: "Marketing Specialist",
    openPositions: 2,
    registrationEnd: "2024-10-15",
    isActive: false,
  },
];

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>(mockJobs);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredJobs = jobs.filter(
    (job) =>
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.jobCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.departmentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleActive = (jobId: string, currentStatus: boolean) => {
    setJobs(
      jobs.map((job) =>
        job.id === jobId ? { ...job, isActive: !currentStatus } : job
      )
    );
  };

  const handleEditJob = (job: Job) => {
    // Navigate to edit job page
    navigate(`/company/${job.companyId}/create-job`);
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

          {filteredJobs.length === 0 ? (
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
                        key={job.id}
                        className="transition hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                      >
                        <TableCell className="px-5 py-4 text-start">
                          <span className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                            {job.title}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                            {job.jobCode}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <span className="text-sm text-gray-800 dark:text-gray-200">
                            {job.companyName}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {job.departmentName}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-400/40">
                            {job.openPositions}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                          {new Date(job.registrationEnd).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Switch
                              label=""
                              defaultChecked={job.isActive}
                              onChange={(checked) =>
                                handleToggleActive(job.id, job.isActive)
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
