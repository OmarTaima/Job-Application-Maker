import { useState, useMemo, useCallback, useEffect } from "react";
import Swal from "sweetalert2";
import { useNavigate } from "react-router";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_PaginationState,
  type MRT_RowSelectionState,
  type MRT_ColumnFiltersState,
} from "material-react-table";
import { ThemeProvider, createTheme } from "@mui/material";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import { TrashBinIcon } from "../../../icons";
import { useAuth } from "../../../context/AuthContext";
import {
  useApplicants,
  useJobPositions,
  useUpdateApplicantStatus,
  useCompanies,
} from "../../../hooks/queries";
import type { Applicant } from "../../../store/slices/applicantsSlice";

const Applicants = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Local state
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);

  // Get selected applicant IDs from row selection
  const selectedApplicantIds = useMemo(() => {
    return Object.keys(rowSelection);
  }, [rowSelection]);

  // Memoize user-derived values
  const companyIds = useMemo(() => {
    if (!user) return undefined;

    const roleName = user?.roleId?.name?.toLowerCase();
    const isSuperAdmin = roleName === "super admin";
    const userCompanyIds = user?.companies?.map((c) =>
      typeof c.companyId === "string" ? c.companyId : c.companyId._id
    );

    // Super Admin gets all companies (undefined means no filter)
    if (isSuperAdmin) return undefined;
    
    // Regular users get their assigned companies only
    return userCompanyIds?.length ? userCompanyIds : undefined;
  }, [user?._id, user?.roleId?.name, user?.companies]);

  // Use React Query hooks
  const {
    data: applicants = [],
    isLoading: applicantsLoading,
    error,
  } = useApplicants(companyIds);
  const { data: jobPositions = [], isLoading: jobPositionsLoading } =
    useJobPositions(companyIds);
  const updateStatusMutation = useUpdateApplicantStatus();
  const { data: allCompaniesRaw = [] } = useCompanies(companyIds as any);

  const [bulkStatusError, setBulkStatusError] = useState("");
  const [bulkDeleteError, setBulkDeleteError] = useState("");

  // Helper function to extract detailed error messages
  const getErrorMessage = (err: any): string => {
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

  // Filter companies on the frontend
  const allCompanies = useMemo(() => {
    if (!companyIds || companyIds.length === 0) {
      return allCompaniesRaw;
    }
    return allCompaniesRaw.filter((company: any) => 
      companyIds.includes(company._id)
    );
  }, [allCompaniesRaw, companyIds]);

  // Create job lookup map
  const jobPositionMap = useMemo(() => {
    const map: Record<string, any> = {};
    jobPositions.forEach((job) => {
      const getId = (v: any) => (typeof v === "string" ? v : v?._id);
      map[getId(job._id)] = job;
    });
    return map;
  }, [jobPositions]);

  // Create company lookup map
  const companyMap = useMemo(() => {
    const map: Record<string, any> = {};
    allCompanies.forEach((company: any) => {
      // Store by both possible ID formats
      const stringId = typeof company._id === "string" ? company._id : company._id?._id;
      if (stringId) {
        map[stringId] = company;
      }
      // Also store by _id directly in case it's already a string
      if (company._id) {
        map[company._id] = company;
      }
    });
    return map;
  }, [allCompanies]);

  // Filter applicants based on MRT column filters
  const filteredApplicants = useMemo(() => {
    let filtered = applicants;

    // WORKAROUND: Filter by user's companies first (backend should do this but doesn't)
    // Only apply if user has specific company restrictions
    if (companyIds && companyIds.length > 0) {
      filtered = filtered.filter((app: Applicant) => {
        // Skip applicants with no job position (they'll be filtered out later)
        if (!app.jobPositionId) return false;
        
        const getId = (v: any) => (typeof v === "string" ? v : v?._id);
        const jobPositionId = getId(app.jobPositionId);
        const jobPosition = jobPositionMap[jobPositionId];
        
        if (jobPosition?.companyId) {
          const jobCompanyId = getId(jobPosition.companyId);
          return companyIds.includes(jobCompanyId);
        }
        return false;
      });
    } else {
      // For super admin (no company restrictions), still filter out applicants with null jobPositionId
      filtered = filtered.filter((app: Applicant) => app.jobPositionId != null);
    }

    // Always filter out trashed unless explicitly selected
    const statusFilter = columnFilters.find(f => f.id === 'status');
    if (!statusFilter || statusFilter.value === 'all') {
      filtered = filtered.filter((app: Applicant) => app.status !== "trashed");
    } else if (statusFilter.value && statusFilter.value !== 'all') {
      filtered = filtered.filter((app: Applicant) => app.status === statusFilter.value);
    }

    // Apply company filter - filter through job position
    const companyFilter = columnFilters.find(f => f.id === 'companyId');
    if (companyFilter && companyFilter.value && companyFilter.value !== "all") {
      filtered = filtered.filter((app: Applicant) => {
        const getId = (v: any) => (typeof v === "string" ? v : v?._id);
        const jobPositionId = getId(app.jobPositionId);
        const jobPosition = jobPositionMap[jobPositionId];
        if (jobPosition?.companyId) {
          const companyId = getId(jobPosition.companyId);
          return companyId === companyFilter.value;
        }
        return false;
      });
    }

    // Apply job position filter
    const jobFilter = columnFilters.find(f => f.id === 'jobPositionId');
    if (jobFilter && jobFilter.value && jobFilter.value !== "all") {
      filtered = filtered.filter((app: Applicant) => {
        const getId = (v: any) => (typeof v === "string" ? v : v?._id);
        const jobPositionId = getId(app.jobPositionId);
        return jobPositionId === jobFilter.value;
      });
    }

    return filtered;
  }, [applicants, columnFilters, jobPositionMap, companyIds]);

  // Apply pagination
  const paginatedApplicants = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredApplicants.slice(start, end);
  }, [filteredApplicants, pagination]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "pending":
        return { bg: "#FEF3C7", color: "#92400E" };
      case "approved":
        return { bg: "#D1FAE5", color: "#065F46" };
      case "interview":
        return { bg: "#DBEAFE", color: "#1E40AF" };
      case "rejected":
        return { bg: "#FEE2E2", color: "#991B1B" };
      case "trashed":
        return { bg: "#6B7280", color: "#FFFFFF" };
      default:
        return { bg: "#F3F4F6", color: "#1F2937" };
    }
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, []);

  const handleBulkChangeStatus = useCallback(async () => {
    if (selectedApplicantIds.length === 0 || !bulkAction) return;

    const result = await Swal.fire({
      title: "Change Status?",
      text: `Are you sure you want to change the status of ${selectedApplicantIds.length} applicant(s) to ${bulkAction}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, change it!",
    });

    if (!result.isConfirmed) return;

    try {
      setIsProcessing(true);
      await Promise.all(
        selectedApplicantIds.map((id) =>
          updateStatusMutation.mutateAsync({
            id,
            data: {
              status: bulkAction as any,
              notes: `Bulk status change to ${bulkAction} on ${new Date().toLocaleDateString()}`,
            },
          })
        )
      );

      await Swal.fire({
        title: "Success!",
        text: `Status updated for ${selectedApplicantIds.length} applicant(s).`,
        icon: "success",
        position: "center",
        timer: 2000,
        showConfirmButton: false,
      });

      setRowSelection({});
      setBulkAction("");
    } catch (err: any) {
      console.error("Error changing status:", err);
      const errorMsg = getErrorMessage(err);
      setBulkStatusError(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedApplicantIds, bulkAction, updateStatusMutation]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedApplicantIds.length === 0) return;

    const result = await Swal.fire({
      title: "Delete Applicants?",
      text: `Are you sure you want to delete ${selectedApplicantIds.length} applicant(s)? They will be moved to trash.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete them!",
    });

    if (!result.isConfirmed) return;

    try {
      setIsDeleting(true);
      await Promise.all(
        selectedApplicantIds.map((id) =>
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
        text: `${selectedApplicantIds.length} applicant(s) moved to trash.`,
        icon: "success",
        position: "center",
        timer: 2000,
        showConfirmButton: false,
      });

      setRowSelection({});
    } catch (err: any) {
      console.error("Error deleting applicants:", err);
      const errorMsg = getErrorMessage(err);
      setBulkDeleteError(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedApplicantIds, updateStatusMutation]);

  // Define table columns
  const columns = useMemo<MRT_ColumnDef<Applicant>[]>(
    () => [
      {
        accessorKey: "profilePhoto",
        header: "Photo",
        size: 80,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <div
            className="h-10 w-10 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 cursor-pointer hover:ring-2 hover:ring-brand-500 transition"
            onClick={(e) => {
              e.stopPropagation();
              if (row.original.profilePhoto) {
                setPreviewPhoto(row.original.profilePhoto);
              }
            }}
          >
            {row.original.profilePhoto ? (
              <img
                src={row.original.profilePhoto}
                alt={row.original.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500 dark:text-gray-400">
                {row.original.fullName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "fullName",
        header: "Name",
        size: 150,
        enableColumnFilter: false,
      },
      {
        accessorKey: "email",
        header: "Email",
        size: 200,
        enableColumnFilter: false,
      },
      {
        accessorKey: "phone",
        header: "Phone",
        size: 130,
        enableColumnFilter: false,
      },
      {
        accessorKey: "companyId",
        header: "Company",
        size: 150,
        enableColumnFilter: false,
        Cell: ({ row }) => {
          // Get company from job position since applicant doesn't have companyId directly
          const jobPositionId = row.original.jobPositionId;
          const getId = (v: any) => (typeof v === "string" ? v : v?._id);
          const jobPosition = jobPositionMap[getId(jobPositionId)];
          
          if (jobPosition?.companyId) {
            const companyId = getId(jobPosition.companyId);
            const company = companyMap[companyId];
            return company?.name || company?.title || "N/A";
          }
          
          return "N/A";
        },
      },
      {
        accessorKey: "jobPositionId",
        header: "Job Position",
        size: 180,
        enableColumnFilter: false,
        Cell: ({ row }) => {
          const getId = (v: any) => (typeof v === "string" ? v : v?._id);
          const job = jobPositionMap[getId(row.original.jobPositionId)];
          return typeof job?.title === "string" ? job.title : job?.title?.en || "N/A";
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        enableColumnFilter: false,
        Cell: ({ row }) => {
          const colors = getStatusColor(row.original.status);
          return (
            <span
              style={{
                backgroundColor: colors.bg,
                color: colors.color,
              }}
              className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
            >
              {row.original.status.charAt(0).toUpperCase() +
                row.original.status.slice(1)}
            </span>
          );
        },
      },
      {
        accessorKey: "submittedAt",
        header: "Submitted",
        size: 120,
        enableColumnFilter: false,
        Cell: ({ row }) => formatDate(row.original.submittedAt),
      },
    ],
    [companyMap, jobPositionMap, getStatusColor, formatDate]
  );

  // Create custom MUI theme that matches the app's dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      const darkMode = document.documentElement.classList.contains('dark');
      setIsDarkMode(darkMode);
    };

    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDarkMode ? 'dark' : 'light',
          primary: {
            main: '#3C50E0',
          },
          background: {
            default: isDarkMode ? '#1C2434' : '#FFFFFF',
            paper: isDarkMode ? '#24303F' : '#FFFFFF',
          },
        },
      }),
    [isDarkMode]
  );

  const table = useMaterialReactTable({
    columns,
    data: paginatedApplicants,
    enableRowSelection: true,
    enablePagination: false,
    enableBottomToolbar: false,
    enableTopToolbar: true,
    enableColumnFilters: false,
    enableFilters: false,
    enableHiding: false,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableSorting: false,
    enableColumnActions: false,
    manualPagination: true,
    manualFiltering: true,
    rowCount: filteredApplicants.length,
    state: {
      rowSelection,
      columnFilters,
      isLoading: applicantsLoading || jobPositionsLoading,
      showSkeletons: applicantsLoading || jobPositionsLoading,
    },
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row._id,
    renderTopToolbarCustomActions: () => {
      const selectedCompanyId = (columnFilters.find(f => f.id === 'companyId')?.value as string) || 'all';
      
      // Filter jobs based on selected company
      const filteredJobs = selectedCompanyId === 'all' 
        ? jobPositions 
        : jobPositions.filter((job: any) => {
            const getId = (v: any) => (typeof v === "string" ? v : v?._id);
            const jobCompanyId = getId(job.companyId);
            return jobCompanyId === selectedCompanyId;
          });

      return (
        <div className="flex items-center gap-3 p-2">
          <select
            value={(columnFilters.find(f => f.id === 'status')?.value as string) || 'all'}
            onChange={(e) => {
              const value = e.target.value;
              setColumnFilters(prev => {
                const filtered = prev.filter(f => f.id !== 'status');
                if (value && value !== 'all') {
                  return [...filtered, { id: 'status', value }];
                }
                return filtered;
              });
            }}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="interview">Interview</option>
            <option value="interviewed">Interviewed</option>
            <option value="rejected">Rejected</option>
            <option value="trashed">Trashed</option>
          </select>
          
          <select
            value={selectedCompanyId}
            onChange={(e) => {
              const value = e.target.value;
              setColumnFilters(prev => {
                // Remove both company and job filters
                let filtered = prev.filter(f => f.id !== 'companyId' && f.id !== 'jobPositionId');
                if (value && value !== 'all') {
                  filtered = [...filtered, { id: 'companyId', value }];
                }
                // Job filter is cleared when company changes
                return filtered;
              });
            }}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Companies</option>
            {allCompanies.map((c: any) => (
              <option key={c._id} value={typeof c._id === 'string' ? c._id : c._id._id}>
                {c.name || c.title || c._id}
              </option>
            ))}
          </select>

          <select
            value={(columnFilters.find(f => f.id === 'jobPositionId')?.value as string) || 'all'}
            onChange={(e) => {
              const value = e.target.value;
              setColumnFilters(prev => {
                const filtered = prev.filter(f => f.id !== 'jobPositionId');
                if (value && value !== 'all') {
                  return [...filtered, { id: 'jobPositionId', value }];
                }
                return filtered;
              });
            }}
            disabled={selectedCompanyId === 'all'}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="all">
              {selectedCompanyId === 'all' ? 'Select a company first' : 'All Jobs'}
            </option>
            {filteredJobs.map((job: any) => {
              const jobId = typeof job._id === 'string' ? job._id : job._id?._id;
              const jobTitle = typeof job.title === 'string' ? job.title : job.title?.en || 'Untitled';
              return (
                <option key={jobId} value={jobId}>
                  {jobTitle}
                </option>
              );
            })}
          </select>
        </div>
      );
    },
    muiTableBodyRowProps: ({ row }) => ({
      onClick: () => {
        navigate(`/applicant/${row.id}`, {
          state: { applicant: row.original },
        });
      },
      sx: {
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
        },
      },
    }),
    muiTablePaperProps: {
      elevation: 0,
      sx: {
        borderRadius: '0.5rem',
        border: isDarkMode ? '1px solid #313D4A' : '1px solid #E2E8F0',
      },
    },
    muiTableProps: {
      sx: {
        tableLayout: 'fixed',
      },
    },
  });

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
            {selectedApplicantIds.length > 0 && (
              <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg bg-brand-50 px-4 py-3 dark:bg-brand-900/20">
                <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
                  {selectedApplicantIds.length} applicant(s) selected
                </span>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
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

            {/* Material React Table */}
            <ThemeProvider theme={muiTheme}>
              <MaterialReactTable table={table} />
            </ThemeProvider>

            {/* Custom Pagination Controls */}
            {filteredApplicants.length > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Showing {pagination.pageIndex * pagination.pageSize + 1} to{" "}
                  {Math.min(
                    (pagination.pageIndex + 1) * pagination.pageSize,
                    filteredApplicants.length
                  )}{" "}
                  of {filteredApplicants.length} applicants
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        pageIndex: Math.max(0, prev.pageIndex - 1),
                      }))
                    }
                    disabled={pagination.pageIndex === 0}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from(
                      { length: Math.ceil(filteredApplicants.length / pagination.pageSize) },
                      (_, i) => {
                        const totalPages = Math.ceil(filteredApplicants.length / pagination.pageSize);
                        // Show max 5 page buttons
                        if (totalPages <= 5) {
                          return i;
                        } else if (pagination.pageIndex <= 2) {
                          return i < 5 ? i : null;
                        } else if (pagination.pageIndex >= totalPages - 3) {
                          return i >= totalPages - 5 ? i : null;
                        } else {
                          return i >= pagination.pageIndex - 2 && i <= pagination.pageIndex + 2 ? i : null;
                        }
                      }
                    )
                      .filter((i) => i !== null)
                      .map((i) => (
                        <button
                          key={i}
                          onClick={() =>
                            setPagination((prev) => ({ ...prev, pageIndex: i as number }))
                          }
                          className={`h-9 w-9 rounded-lg text-sm font-medium transition ${
                            pagination.pageIndex === i
                              ? "bg-brand-500 text-white"
                              : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                          }`}
                        >
                          {(i as number) + 1}
                        </button>
                      ))}
                  </div>

                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        pageIndex: Math.min(
                          Math.ceil(filteredApplicants.length / pagination.pageSize) - 1,
                          prev.pageIndex + 1
                        ),
                      }))
                    }
                    disabled={
                      pagination.pageIndex >=
                      Math.ceil(filteredApplicants.length / pagination.pageSize) - 1
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Next
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
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
