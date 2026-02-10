import { useState, useMemo } from "react";
import Swal from "sweetalert2";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import ComponentCard from "../../../components/common/ComponentCard";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { Link, useNavigate } from "react-router";
import { PlusIcon, PencilIcon, TrashBinIcon } from "../../../icons";
import { useAuth } from "../../../context/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  useCompanies,
  useDepartments,
  useDeleteCompany,
} from "../../../hooks/queries";
import { toPlainString } from "../../../utils/strings";

export default function Companies() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  // Check permissions
  const canRead = hasPermission("Company Management", "read");
  const canCreate = hasPermission("Company Management", "create");
  const canEdit = hasPermission("Company Management", "write");

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showRaw, setShowRaw] = useState(false);

  // Memoize user-derived values
  const { isAdmin } = useMemo(() => {
    if (!user) return { isAdmin: false, companyId: undefined };

    const isAdmin = user?.roleId?.name?.toLowerCase().includes("admin");
    const usercompanyId = user?.companies?.map((c) =>
      typeof c.companyId === "string" ? c.companyId : c.companyId._id
    );

    const companyIdFiltered =
      !isAdmin && usercompanyId?.length ? usercompanyId : undefined;

    return { isAdmin, companyId: companyIdFiltered };
  }, [user?._id, user?.roleId?.name, user?.companies?.length]);

  // Use React Query hooks for data fetching
  const {
    data: companies = [],
    isLoading: companiesLoading,
    error,
  } = useCompanies();
  const { data: departments = [] } = useDepartments();
  const deleteCompanyMutation = useDeleteCompany();

  const [deleteError, setDeleteError] = useState("");
  const [isDeletingCompany, setIsDeletingCompany] = useState<string | null>(null);

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

  // Calculate department counts from React Query data
  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    companies.forEach((company) => {
      counts[company._id] = departments.filter((dept) => {
        const deptCompanyId =
          typeof dept.companyId === "string"
            ? dept.companyId
            : dept.companyId._id;
        return deptCompanyId === company._id;
      }).length;
    });
    return counts;
  }, [companies, departments]);

  const handleDeleteCompany = async (
    companyId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: "Delete Company?",
      text: "Are you sure you want to delete this company?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      setIsDeletingCompany(companyId);
      await deleteCompanyMutation.mutateAsync(companyId);
      await Swal.fire({
        title: "Deleted!",
        text: "Company has been deleted successfully.",
        icon: "success",
        position: "center",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
      });
    } catch (err: any) {
      console.error("Error deleting company:", err);
      const errorMsg = getErrorMessage(err);
      setDeleteError(errorMsg);
    } finally {
      setIsDeletingCompany(null);
    }
  };

  const filteredCompanies = companies.filter((company) => {
    // Filter by user's assigned companies first
    const usercompanyId = user?.companies?.map((c) =>
      typeof c.companyId === "string" ? c.companyId : c.companyId._id
    );

    // If not admin and has assigned companies, only show those
    if (!isAdmin && usercompanyId && usercompanyId.length > 0) {
      if (!usercompanyId.includes(company._id)) {
        return false;
      }
    }

    // Then filter by search term (defensive: ensure we call toLowerCase on strings)
    const term = searchTerm.toLowerCase();
    const contactRaw =
      company.contactEmail ||
      (company as any).email ||
      (company as any).contact ||
      company.phone ||
      "";
    
    // Handle address - could be array of localized objects or legacy string
    let addressRaw: any = "";
    if (company.address) {
      addressRaw = company.address;
    } else {
      addressRaw = (company as any).location || (company as any).city || "";
    }

    const nameStr = toPlainString((company as any).name);
    const contact = toPlainString(contactRaw);
    const address = toPlainString(addressRaw);

    return (
      (nameStr && nameStr.toLowerCase().includes(term)) ||
      (contact && contact.toLowerCase().includes(term)) ||
      (address && address.toLowerCase().includes(term))
    );
  });

  const handleRowClick = (companyId: string) => {
    navigate(`/company/${companyId}`);
  };

  // If user doesn't have read permission, show access denied
  if (!canRead) {
    return (
      <div className="space-y-6">
        <PageMeta
          title="Companies | TailAdmin React"
          description="View and manage all recruiting companies in the system."
        />
        <PageBreadcrumb pageTitle="Companies" />
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
            You don't have permission to view companies
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageMeta
        title="Companies | TailAdmin React"
        description="View and manage all recruiting companies in the system."
      />
      <PageBreadcrumb pageTitle="Companies" />

      {companiesLoading ? (
        <LoadingSpinner fullPage message="Loading companies..." />
      ) : (
        <ComponentCard
          title="All Companies"
          desc="Browse and manage companies registered for recruiting"
        >
          <div className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                {error.message || String(error)}
              </div>
            )}

            {deleteError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    <strong>Error deleting company:</strong> {deleteError}
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
                  placeholder="Search companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 w-full max-w-md rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                />
              </div>
              {canCreate && (
                <Link
                  to="/recruiting"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
                >
                  <PlusIcon className="size-4" />
                  Create Company
                </Link>
              )}
              <button
                onClick={() => setShowRaw((s) => !s)}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 ml-2"
                type="button"
              >
                {showRaw ? "Hide raw data" : "Show raw data"}
              </button>
            </div>

            {filteredCompanies.length === 0 ? (
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
                          className="px-3 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 w-16"
                        >
                          Logo
                        </TableCell>
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
                          <TableCell className="px-3 py-4 text-start">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                              {company.logoPath ? (
                                <img
                                  src={company.logoPath}
                                  alt={`${toPlainString((company as any).name)} logo`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-semibold text-gray-600">
                                  {toPlainString((company as any).name)
                                    ? toPlainString((company as any).name).charAt(0).toUpperCase()
                                    : "?"}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-5 py-4 text-start">
                            <div>
                              <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">
                                {toPlainString((company as any).name)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-5 py-4 text-start">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {(() => {
                                const addr = company.address ||
                                  (company as any).location ||
                                  (company as any).city;
                                return addr ? toPlainString(addr) : "-";
                              })()}
                            </span>
                          </TableCell>
                          <TableCell className="px-5 py-4 text-start">
                            <span className="text-sm text-gray-800 dark:text-gray-200">
                              {toPlainString(
                                company.contactEmail ||
                                  (company as any).email ||
                                  (company as any).contact ||
                                  company.phone ||
                                  "-"
                              )}
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
                            <div className="inline-flex items-center gap-2">
                                <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2">
                                  {canEdit && (
                                    <button
                                      onClick={() => navigate(`/company/${company._id}`)}
                                      type="button"
                                      className="rounded p-1.5 text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                                      title="Edit company"
                                    >
                                      <PencilIcon className="size-4" />
                                    </button>
                                  )}

                                  {canCreate && (
                                    <button
                                      onClick={(e) => handleDeleteCompany(company._id, e)}
                                      disabled={isDeletingCompany === company._id}
                                      className="rounded p-1.5 text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title={isDeletingCompany === company._id ? "Deleting..." : "Delete company"}
                                    >
                                      <TrashBinIcon className="size-4" />
                                    </button>
                                  )}
                                </div>
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
      )}
    </div>
  );
}
