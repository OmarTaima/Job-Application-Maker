import { useState, useEffect } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { Link, useNavigate } from "react-router";
import { PlusIcon } from "../../icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { companiesService, ApiError } from "../../services/companiesService";
import type { Company } from "../../services/companiesService";
import { departmentsService } from "../../services/departmentsService";

export default function Companies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departmentCounts, setDepartmentCounts] = useState<
    Record<string, number>
  >({});
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const data = await companiesService.getAllCompanies();
      // Log first item for quick inspection in browser console
      console.debug("Loaded companies:", data && data.length ? data[0] : data);
      setCompanies(data);

      // Load department counts for each company
      const counts: Record<string, number> = {};
      await Promise.all(
        data.map(async (company) => {
          try {
            const departments = await departmentsService.getAllDepartments(
              company._id
            );
            counts[company._id] = departments.length;
          } catch (err) {
            counts[company._id] = 0;
          }
        })
      );
      setDepartmentCounts(counts);

      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to load companies";
      setError(errorMessage);
      console.error("Error loading companies:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCompany = async (
    companyId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this company?")) return;

    try {
      await companiesService.deleteCompany(companyId);
      await loadCompanies();
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to delete company";
      setError(errorMessage);
      console.error("Error deleting company:", err);
    }
  };

  const filteredCompanies = companies.filter((company) => {
    const term = searchTerm.toLowerCase();
    const contact =
      company.contactEmail ||
      (company as any).email ||
      (company as any).contact ||
      company.phone ||
      "";
    const address =
      company.address ||
      (company as any).location ||
      (company as any).city ||
      "";

    return (
      (company.name && company.name.toLowerCase().includes(term)) ||
      (contact && contact.toLowerCase().includes(term)) ||
      (address && address.toLowerCase().includes(term))
    );
  });

  const handleRowClick = (companyId: string) => {
    navigate(`/company/${companyId}`);
  };

  return (
    <div className="space-y-6">
      <PageMeta
        title="Companies | TailAdmin React"
        description="View and manage all recruiting companies in the system."
      />
      <PageBreadcrumb pageTitle="Companies" />

      <ComponentCard
        title="All Companies"
        desc="Browse and manage companies registered for recruiting"
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
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 w-full max-w-md rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              />
            </div>
            <Link
              to="/recruiting"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
            >
              <PlusIcon className="size-4" />
              Create Company
            </Link>
            <button
              onClick={() => setShowRaw((s) => !s)}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 ml-2"
              type="button"
            >
              {showRaw ? "Hide raw data" : "Show raw data"}
            </button>
          </div>

          {loading ? (
            <LoadingSpinner message="Loading companies..." />
          ) : filteredCompanies.length === 0 ? (
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
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                No companies found
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Get started by creating a new company"}
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
                        Company Name
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Address
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Contact
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Departments
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Created
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
                    {filteredCompanies.map((company) => (
                      <TableRow
                        key={company._id}
                        onClick={() => handleRowClick(company._id)}
                        className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                      >
                        <TableCell className="px-5 py-4 text-start">
                          <div>
                            <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">
                              {company.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {company.address ||
                              (company as any).location ||
                              (company as any).city ||
                              "-"}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <span className="text-sm text-gray-800 dark:text-gray-200">
                            {company.contactEmail ||
                              (company as any).email ||
                              (company as any).contact ||
                              company.phone ||
                              "-"}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-400/40">
                            {departmentCounts[company._id] ?? 0}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                          {company.createdAt
                            ? new Date(company.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }
                              )
                            : "-"}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <button
                            onClick={(e) => handleDeleteCompany(company._id, e)}
                            className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                          >
                            Delete
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
        {/* Debug: show raw JSON for each company when toggled */}
        {showRaw && (
          <div className="p-4 bg-gray-50 dark:bg-black/20">
            {companies.map((c) => (
              <pre
                key={c._id}
                className="mb-3 max-w-full overflow-auto rounded bg-white p-3 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                {JSON.stringify(c, null, 2)}
              </pre>
            ))}
          </div>
        )}
      </ComponentCard>
    </div>
  );
}
