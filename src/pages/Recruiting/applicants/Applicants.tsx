import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { useNavigate } from "react-router";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
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
import { toPlainString } from "../../../utils/strings";

const Applicants = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Local state
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  // MRT will manage pagination internally (page size set in initialState)
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
  // MRT sorting state (control sorting externally so we can offer only asc/desc for Submitted)
  const [sorting, setSorting] = useState<Array<any>>([{ id: 'submittedAt', desc: true }]);
  // Sorting will be managed by MRT (default newest-first)

  // Get selected applicant IDs from row selection
  const selectedApplicantIds = useMemo(() => {
    return Object.keys(rowSelection);
  }, [rowSelection]);

  // MRT will reset pagination when filters/sorting change internally
  // Memoize user-derived values
  const companyId = useMemo(() => {
    if (!user) return undefined;

    const roleName = user?.roleId?.name?.toLowerCase();
    const isSuperAdmin = roleName === "super admin";
    const usercompanyId = user?.companies?.map((c) =>
      typeof c.companyId === "string" ? c.companyId : c.companyId._id
    );

    // Super Admin gets all companies (undefined means no filter)
    if (isSuperAdmin) return undefined;
    
    // Regular users get their assigned companies only
    return usercompanyId?.length ? usercompanyId : undefined;
  }, [user?._id, user?.roleId?.name, user?.companies]);

  // Determine whether to show the Company column: hide when user is assigned to a single company
  const showCompanyColumn = useMemo(() => {
    if (!companyId) return true; // super admin or no filter
    if (Array.isArray(companyId) && companyId.length === 1) return false;
    return true;
  }, [companyId]);

  // Use React Query hooks
  // Fetch job positions first so we can convert company filter into jobPositionIds
  const { data: jobPositions = [], isLoading: jobPositionsLoading } =
    useJobPositions(companyId);

  const {
    data: applicants = [],
    isLoading: applicantsLoading,
    error,
  } = useApplicants(companyId as any);
  const updateStatusMutation = useUpdateApplicantStatus();
  const { data: allCompaniesRaw = [] } = useCompanies(companyId as any);

  const [bulkStatusError, setBulkStatusError] = useState("");
  const [bulkDeleteError, setBulkDeleteError] = useState("");
  const [jobFilterOpen, setJobFilterOpen] = useState(false);
  const jobFilterRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (!jobFilterOpen) return;
      if (jobFilterRef.current && !jobFilterRef.current.contains(e.target as Node)) {
        setJobFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [jobFilterOpen]);

  // Close job dropdown when the table's column filters change (e.g. user selected a job)
  useEffect(() => {
    const jobFilter = columnFilters.find((f) => f.id === 'jobPositionId');
    if (jobFilter) {
      setJobFilterOpen(false);
    }
  }, [columnFilters]);

  
  // Synchronously measure the button and set dropdown position when opening


  

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
    if (!companyId || companyId.length === 0) {
      return allCompaniesRaw;
    }
    return allCompaniesRaw.filter((company: any) => 
      companyId.includes(company._id)
    );
  }, [allCompaniesRaw, companyId]);

  // Create job lookup map
  const jobPositionMap = useMemo(() => {
    const map: Record<string, any> = {};
    const getIdValue = (v: any) => (typeof v === 'string' ? v : v?._id ?? v?.id);
    jobPositions.forEach((job: any) => {
      const ids = new Set<string>();
      const primary = getIdValue(job._id) || getIdValue(job.id);
      if (primary) ids.add(primary);
      // also add nested forms if present
      if (job._id && typeof job._id === 'object' && job._id._id) ids.add(job._id._id);
      if (job.id && typeof job.id === 'object' && job.id._id) ids.add(job.id._id);
      // index by all discovered ids
      ids.forEach((id) => {
        if (id) map[id] = job;
      });
    });
    return map;
  }, [jobPositions]);

  // Build filter options
  const statusOptions = useMemo(() => {
    const defaultStatuses = ['pending','approved','interview','interviewed','rejected','trashed'];
    const s = new Set<string>();
    applicants.forEach((a: any) => a?.status && s.add(a.status));
    // include default statuses always (in this order), then any additional dynamic statuses
    const extra = Array.from(s).filter((st) => !defaultStatuses.includes(st));
    return [...defaultStatuses, ...extra];
  }, [applicants]);

  const jobOptions = useMemo(() => {
    const getIdValue = (v: any) => (typeof v === 'string' ? v : v?._id ?? v?.id);
    return jobPositions
      .map((j: any) => {
        const id = getIdValue(j._id) || getIdValue(j.id) || '';
        const title = typeof j.title === 'string' ? j.title : j?.title?.en || '';
        return { id, title };
      })
      .filter((x) => x.id && x.title);
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



  // Determine dataset to pass to MRT: by default exclude trashed applicants unless
  // the user explicitly filters for status === 'trashed'. This makes "All Statuses"
  // hide trashed rows while still allowing an explicit trashed view.
  const displayedApplicants = useMemo(() => {
    const statusFilter = columnFilters.find((f) => f.id === 'status');
    const explicitlyTrashed = statusFilter && statusFilter.value === 'trashed';
    if (explicitlyTrashed) return applicants;
    return applicants.filter((a: Applicant) => a.status !== 'trashed');
  }, [applicants, columnFilters]);

  // MRT will handle pagination (we pass full dataset to the table)

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "pending":
        return { bg: "#FEF3C7", color: "#92400E" };
      case "approved":
        return { bg: "#D1FAE5", color: "#065F46" };
      case "interview":
        return { bg: "#DBEAFE", color: "#1E40AF" };
        case "interviewed":
        return { bg: "#DBEAFE", color: "#065F46" };
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
        accessorKey: "applicantNo",
        header: "ApplicantNo",
        size: 100,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row, table }) => {
          const orig: any = row.original as any;
          const possible = orig?.applicantNo || orig?.applicantNumber || orig?.applicationNo || orig?.applicationId;
          if (possible) return String(possible);
          // fallback to visible index + 1 for human-friendly numbering
          const idx = (row.index ?? table.getRowModel().rows.findIndex(r => r.id === row.id));
          if (typeof idx === 'number' && idx >= 0) return String(idx + 1);
          // last resort: shortened id
          const id = orig?._id || orig?.id || "";
          return id ? String(id).slice(0, 8) : "-";
        },
      },
      {
        accessorKey: "profilePhoto",
        header: "Photo",
        size: 80,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }: { row: { original: Applicant } }) => (
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
        enableColumnFilter: true,
        enableSorting: false,

      },
      {
        accessorKey: "email",
        header: "Email",
        size: 200,
        enableColumnFilter: true,
        enableSorting: false,

      },
      {
        accessorKey: "phone",
        header: "Phone",
        size: 130,
        enableColumnFilter: true,
        enableSorting: false,

      },
      ...(showCompanyColumn
        ? [
            {
              accessorKey: "companyId",
              header: "Company",
              size: 150,
              enableColumnFilter: true,
              enableSorting: false,
              Cell: ({ row }: { row: { original: Applicant } }) => {
                // Get company from job position since applicant doesn't have companyId directly
                const jobPositionId = row.original.jobPositionId;
                const getId = (v: any) => (typeof v === "string" ? v : v?._id);
                const jobPosition = jobPositionMap[getId(jobPositionId)];

                if (jobPosition?.companyId) {
                  const companyId = getId(jobPosition.companyId);
                  const company = companyMap[companyId];
                  return toPlainString(company?.name) || company?.title || "N/A";
                }

                return "N/A";
              },
            },
          ]
        : []),
      {
        id: "jobPositionId",
        header: "Job Position",
        enableSorting: false,
        // Normalize jobPositionId to the job TITLE so MRT's filtering compares by name
        accessorFn: (row: any) => {
          const raw = row?.jobPositionId;
          const getId = (v: any) => (typeof v === 'string' ? v : v?._id ?? v?.id ?? '');

          // If applicant already embeds a title, use it
          if (raw && typeof raw === 'object' && 'title' in raw) {
            const cand = typeof raw.title === 'string' ? raw.title : raw?.title?.en ?? '';
            return cand || '';
          }

          const jobId = getId(raw);
          if (!jobId) return '';

          // Try jobOptions list first
          const opt = jobOptions.find((o: any) => o.id === jobId);
          if (opt) return opt.title;
          const j = jobPositionMap[jobId];
          if (j) return typeof j.title === 'string' ? j.title : j.title?.en ?? '';

          // Last resort: scan jobPositions list for matching id
          if (Array.isArray(jobPositions)) {
            const getIdValue = (v: any) => (typeof v === 'string' ? v : v?._id ?? v?.id ?? '');
            const found = jobPositions.find((jp: any) => {
              const candidateId = getIdValue(jp._id) || getIdValue(jp.id) || '';
              return candidateId === jobId;
            });
            if (found) return typeof found.title === 'string' ? found.title : found.title?.en ?? '';
          }

          return '';
        },

        Header: ({ column }) => (
          <div className="flex items-center gap-2 -mt-1">
            <span className="text-sm font-medium">Job Position</span>
            <select
              value={(column.getFilterValue() as string) ?? ""}
              onChange={(e) => {
                column.setFilterValue(e.target.value || undefined);
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-sm border-none bg-transparent appearance-none p-0 px-2 py-1 focus:outline-none focus:ring-0"
              style={{ boxShadow: 'none' }}
            >
              <option value="">All</option>
              {jobOptions.map((j) => (
                <option key={j.id} value={j.title}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>
        ),

        size: 200,
        enableColumnFilter: true,

        Cell: ({ row }: { row: { original: Applicant } }) => {

          const raw = row.original.jobPositionId;
          let title: string | null = null;

          // If applicant stores jobPosition as an object with a title, use it
          if (raw && typeof raw === 'object' && 'title' in raw) {
            const cand = typeof (raw as any).title === 'string' ? (raw as any).title : (raw as any)?.title?.en;
            if (cand) title = cand;
          }

          // Determine an id to lookup in maps
          const getId = (v: any) => {
            if (!v) return '';
            if (typeof v === 'string') return v;
            return v._id ?? v.id ?? '';
          };

          const jobId = getId(raw);

          // Try jobPositionMap
          if (!title && jobId) {
            const job = jobPositionMap[jobId];
            if (job) {
              title = typeof job.title === 'string' ? job.title : job.title?.en || null;
            }
          }

          // If still not found, try directly searching jobPositions array (covers alternate id shapes)
          if (!title && jobId && Array.isArray(jobPositions)) {
            const getIdValue = (v: any) => (typeof v === 'string' ? v : v?._id ?? v?.id);
            const jobFromList = jobPositions.find((jp: any) => {
              const candidateId = getIdValue(jp._id) || getIdValue(jp.id) || '';
              return candidateId === jobId;
            });
            if (jobFromList) {
              title = typeof jobFromList.title === 'string' ? jobFromList.title : jobFromList.title?.en || null;
            }
          }

          // Try jobOptions fallback
          if (!title && jobId) {
            const opt = jobOptions.find((o) => o.id === jobId);
            if (opt) title = opt.title;
          }

          // Final fallback: if raw is a string show shortened id, else placeholder
          if (!title) {
            if (typeof raw === 'string' && raw) title = String(raw).slice(0, 8);
            else if (jobId) title = String(jobId).slice(0, 8);
            else title = 'N/A';
          }

          return <span className="text-sm font-medium">{title}</span>;
        },
      },
            {
        accessorKey: "status",
        header: "Status",
        enableSorting: false,
        Header: ({ column }) => (
          <div className="flex items-center gap-2 -mt-1">
            <span className="text-sm font-medium">Status</span>
            <select
              value={(column.getFilterValue() as string) ?? ""}
              onChange={(e) => {
                column.setFilterValue(e.target.value || undefined);
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-sm border-none bg-transparent appearance-none p-0 px-2 py-1 focus:outline-none focus:ring-0"
              style={{ boxShadow: 'none' }}
            >
              <option value="">All</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        ),

        size: 120,
        enableColumnFilter: true,

        Cell: ({ row }: { row: { original: Applicant } }) => {
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
        // Custom header shows a two-state control (Newest / Oldest)
        Header: ({ column, table }: { column: any; table: any }) => {
          const sortingState = table.getState().sorting;
          const submittedSort = sortingState.find((s: any) => s.id === column.id);
          const desc = submittedSort ? submittedSort.desc : true;

          const toggle = (e: any) => {
            e.stopPropagation();
            // Force two-state sorting only (no unsorted state)
            table.setSorting([{ id: column.id, desc: !desc }]);
          };

          return (
            <button
              onClick={toggle}
              className="flex items-center gap-1 text-sm font-medium"
              type="button"
              title={desc ? 'Newest' : 'Oldest'}
            >
              <span>Submitted</span>
              <span className="text-xs">{desc ? '▼' : '▲'}</span>
            </button>
          );
        },
        size: 120,
        enableColumnFilter: false,
        // Disable MRT's built-in sort UI for this column so we can render a single up/down arrow
        enableSorting: true,
        // Add a class to the head cell so we can hide MUI's default double-arrow icon
        muiTableHeadCellProps: { className: 'hide-default-sort-icon' },
        // Sorting function compares ISO date strings safely
        sortingFn: (rowA: any, rowB: any, columnId: string) => {
          const getVal = (r: any) => {
            const v = r.getValue(columnId) ?? r.original?.submittedAt;
            const t = v ? new Date(v).getTime() : 0;
            return Number.isNaN(t) ? 0 : t;
          };
          const a = getVal(rowA);
          const b = getVal(rowB);
          if (a === b) return 0;
          return a > b ? 1 : -1;
        },
        Cell: ({ row }: any) => formatDate(row.original.submittedAt),
      },
    ],
    [companyMap, jobPositionMap, jobOptions, getStatusColor, formatDate]
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
            main: '#e42e2b',
          },
          background: {
            default: isDarkMode ? '#24303F' : '#FFFFFF',
            paper: isDarkMode ? '#24303F' : '#FFFFFF',
          },
          text: {
            primary: isDarkMode ? '#E4E7EC' : '#101828',
            secondary: isDarkMode ? '#98A2B3' : '#667085',
          },
          divider: isDarkMode ? '#344054' : '#E4E7EC',
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
                backgroundImage: 'none',
              },
            },
          },
          MuiTable: {
            styleOverrides: {
              root: {
                backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
              },
            },
          },
          MuiTableContainer: {
            styleOverrides: {
              root: {
                backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
              },
            },
          },
          MuiTableBody: {
            styleOverrides: {
              root: {
                backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
              },
            },
          },
          MuiTableHead: {
            styleOverrides: {
              root: {
                backgroundColor: isDarkMode ? '#1C2434' : '#F9FAFB',
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderColor: isDarkMode ? '#344054' : '#E4E7EC',
                backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
                color: isDarkMode ? '#E4E7EC' : '#101828',
              },
              head: {
                backgroundColor: isDarkMode ? '#1C2434' : '#F9FAFB',
                color: isDarkMode ? '#E4E7EC' : '#344054',
                fontWeight: 600,
              },
            },
          },
          MuiTableRow: {
            styleOverrides: {
              root: {
                backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
                '&:hover': {
                  backgroundColor: isDarkMode ? '#344054' : '#F9FAFB',
                },
              },
            },
          },
          MuiIconButton: {
            styleOverrides: {
              root: {
                color: isDarkMode ? '#98A2B3' : '#667085',
              },
            },
          },
          MuiCheckbox: {
            styleOverrides: {
              root: {
                color: isDarkMode ? '#667085' : '#98A2B3',
                '&.Mui-checked': {
                  color: '#e42e2b',
                },
              },
            },
          },
          MuiToolbar: {
            styleOverrides: {
              root: {
                backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
                color: isDarkMode ? '#E4E7EC' : '#101828',
              },
            },
          },
        },
      }),
    [isDarkMode]
  );

  const table = useMaterialReactTable({
    columns,
    // Pass the displayedApplicants list (excludes trashed by default)
    data: displayedApplicants,
    enableRowSelection: true,
    enablePagination: true,
    enableBatchRowSelection: false,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    enableColumnFilters: true,
    enableFilters: true,
    enableHiding: true,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableSorting: true,
    enableColumnActions: false,
    manualPagination: false,
    manualFiltering: false,
    manualSorting: false,
    rowCount: displayedApplicants.length,
    // Default pagination and sorting: 10 rows per page, newest first
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [{ id: 'submittedAt', desc: true }],
    },
    muiTablePaperProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        backgroundImage: 'none',
      },
    },
    muiTableProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        fontFamily: "'Cairo', Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans'",
      },
    },
    muiTableBodyProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
      },
    },
    muiTableHeadProps: {
      sx: {
        backgroundColor: isDarkMode ? '#1C2434' : '#F9FAFB',
      },
    },
    muiTableBodyCellProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        color: isDarkMode ? '#E4E7EC' : '#101828',
        borderColor: isDarkMode ? '#344054' : '#E4E7EC',
        fontFamily: "'Cairo', Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans'",
      },
    },
    muiTableHeadCellProps: {
      sx: {
        backgroundColor: isDarkMode ? '#1C2434' : '#F9FAFB',
        color: isDarkMode ? '#E4E7EC' : '#344054',
        borderColor: isDarkMode ? '#344054' : '#E4E7EC',
        fontWeight: 600,
        fontFamily: "'Cairo', Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans'",
        // Hide the default unsorted double-arrow icon; show icon only when active (sorted)
        '& .MuiTableSortLabel-icon': {
          opacity: 0,
          transition: 'opacity 150ms ease',
        },
        '& .MuiTableSortLabel-root.MuiTableSortLabel-active .MuiTableSortLabel-icon': {
          opacity: 1,
        },
        '& .MuiIconButton-root': {
          display: 'none !important',
        },
      },
    },
    muiTopToolbarProps: {
      sx: {
        backgroundColor: isDarkMode ? '#1C2434' : '#FFFFFF',
        color: isDarkMode ? '#E4E7EC' : '#101828',
      },
    },
    muiBottomToolbarProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        color: isDarkMode ? '#E4E7EC' : '#101828',
      },
    },
    state: {
      rowSelection,
      columnFilters,
      sorting,
      isLoading: applicantsLoading || jobPositionsLoading,
      showSkeletons: applicantsLoading || jobPositionsLoading,
      showAlertBanner: false,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row._id,
    renderTopToolbarCustomActions: () => {
      
      

      return (
        <div style={{
          backgroundColor: isDarkMode ? '#1C2434' : '#FFFFFF',
        }} className="flex items-center gap-3 p-2">
          {/* <select
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
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="all">
              Select The Job Position
            </option>
            {filteredJobs.map((job: any) => {
              const jobTitle = typeof job.title === 'string' ? job.title : job.title?.en || 'Untitled';
              return (
                <option key={jobTitle} value={jobTitle}>
                  {jobTitle}
                </option>
              );
            })}
          </select> */}
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
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        '&:hover': {
          backgroundColor: isDarkMode ? '#344054' : '#F9FAFB',
        },
      },
    }),
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

            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                {String(error)}
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
                      <option value="interviewed">Interviewed</option>
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

            {/* Material React Table */}
            <ThemeProvider theme={muiTheme}>
              <MaterialReactTable table={table} />
            </ThemeProvider>

            {/* MRT handles pagination in its bottom toolbar (10 rows per page) */}
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
