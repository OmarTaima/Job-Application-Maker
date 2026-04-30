// Applicants.tsx - Complete working version
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../../../config/axios';
import Swal from '../../../../utils/swal';
import { useAuth } from '../../../../context/AuthContext';
import {
  useApplicants,
  useJobPositions,
  useCompanies,
} from '../../../../hooks/queries';
import { useTableLayout } from '../../../../hooks/queries/useTableLayout';
import { buildApplicantDuplicateLookup } from '../../../../utils/applicantDuplicateSort';
import { toPlainString } from '../../../../utils/strings';
import { buildFieldToJobIds } from '../../../../components/modals/CustomFilterModal';
import { useQuery } from '@tanstack/react-query';

// Components
import PageBreadcrumb from '../../../../components/common/PageBreadCrumb';
import PageMeta from '../../../../components/common/PageMeta';
import ComponentCard from '../../../../components/common/ComponentCard';
import { Modal } from '../../../../components/ui/modal';
import BulkMessageModal from '../../../../components/modals/BulkMessageModal';
import InterviewScheduleModal from '../../../../components/modals/InterviewScheduleModal';
import StatusChangeModal from '../../../../components/modals/StatusChangeModal';
import CustomFilterModal from '../../../../components/modals/CustomFilterModal';
import { ColumnMultiSelectHeader } from './components/ColumnMultiSelectHeader';
import { StatusCell } from './components/StatusCell';
import { TrashBinIcon, ChatIcon } from '../../../../icons';

// Hooks
import { useTableState } from './hooks/useTableState';
import { useApplicantSelection } from './hooks/useApplicantSelection';
import { useBulkActions } from './hooks/useBulkActions';
import { useApplicantFilters } from './hooks/useApplicantFilters';

// Utils
import { exportToExcel, showExportNotification } from './utils/exportHelpers';
import { normalizeGender, getApplicantCompanyId } from './utils/filterHelpers';

// Types
import {
  MaterialReactTable,
  MRT_SelectCheckbox,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from 'material-react-table';
import { ThemeProvider, createTheme } from '@mui/material';
import { Skeleton } from '@mui/material';
import { Applicant } from '../../../../store/slices/applicantsSlice';

type ApiMailResponse = {
  message: string;
  page: string;
  PageCount: number | null;
  TotalCount: number;
  data: Array<{ _id: string; applicant: string | null; [key: string]: any }>;
};

const APPLICANTS_DEFAULT_LAYOUT = {
  columnVisibility: {},
  columnSizing: {},
  columnOrder: [],
};

// Helper to extract ID from various formats
const extractId = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = extractId(item);
      if (resolved) return resolved;
    }
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (value && typeof value === 'object') {
    const maybeId = value as { _id?: unknown; id?: unknown };
    if (typeof maybeId._id === 'string' && maybeId._id.trim())
      return maybeId._id.trim();
    if (typeof maybeId.id === 'string' && maybeId.id.trim())
      return maybeId.id.trim();
  }
  return null;
};

// Simple in-memory cache for compressed thumbnails
const thumbnailCache: Map<string, string> = new Map();

async function createCompressedDataUrl(
  src: string,
  maxBytes = 5120
): Promise<string> {
  if (!src) return src;
  if (thumbnailCache.has(src)) return thumbnailCache.get(src) as string;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    let resolved = false;

    const finish = (result: string) => {
      if (resolved) return;
      resolved = true;
      try {
        thumbnailCache.set(src, result);
      } catch (e) {}
      resolve(result);
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(src);
        const MAX_DIM = 160;
        let { width, height } = img;
        const ratio = Math.max(width / MAX_DIM, height / MAX_DIM, 1);
        canvas.width = Math.max(32, Math.round(width / ratio));
        canvas.height = Math.max(32, Math.round(height / ratio));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const tryQualities = (qualities: number[]) => {
          for (const q of qualities) {
            try {
              const dataUrl = canvas.toDataURL('image/jpeg', q);
              const b64 = dataUrl.split(',')[1] || '';
              const bytes = Math.ceil((b64.length * 3) / 4);
              if (bytes <= maxBytes) return dataUrl;
            } catch (e) {
              return null;
            }
          }
          return null;
        };

        let dataUrl = tryQualities([
          0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1,
        ]);
        if (dataUrl) return finish(dataUrl);

        let w = canvas.width;
        let h = canvas.height;
        while ((w > 32 || h > 32) && !dataUrl) {
          w = Math.max(24, Math.floor(w * 0.75));
          h = Math.max(24, Math.floor(h * 0.75));
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          dataUrl = tryQualities([0.6, 0.4, 0.25, 0.15, 0.1]);
        }

        if (dataUrl) return finish(dataUrl);
        finish(src);
      } catch (e) {
        finish(src);
      }
    };

    img.onerror = () => finish(src);
    try {
      img.src = src;
    } catch (e) {
      finish(src);
    }
    setTimeout(() => finish(src), 1500);
  });
}

function ImageThumbnailComponent({
  src,
  alt,
  onClick,
}: {
  src?: string | null;
  alt?: string;
  onClick?: () => void;
}) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!src) {
      setThumb(null);
      return () => {
        mounted = false;
      };
    }
    if (typeof src === 'string' && src.startsWith('data:')) {
      setThumb(src);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const compressed = await createCompressedDataUrl(src as string, 5120);
        if (mounted) setThumb(compressed || (src as string));
      } catch (e) {
        if (mounted) setThumb(src as string);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [src]);

  if (!thumb) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500 dark:text-gray-400 cursor-pointer"
        onClick={onClick}
      >
        {alt && alt.charAt(0) ? alt.charAt(0).toUpperCase() : '-'}
      </div>
    );
  }

  return (
    <img
      loading="lazy"
      src={thumb}
      alt={alt || ''}
      className="h-full w-full object-cover cursor-pointer"
      onClick={onClick}
    />
  );
}

type ApplicantsProps = {
  layoutKey?: string;
  defaultLayout?: typeof APPLICANTS_DEFAULT_LAYOUT;
  onlyStatus?: string | string[];
  companyIdOverride?: string | string[] | undefined;
};

export default function Applicants({
  layoutKey,
  defaultLayout,
  onlyStatus,
  companyIdOverride,
}: ApplicantsProps = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const location = useLocation();
  const params = useParams();

  const { layout, saveLayout } = useTableLayout(
    layoutKey || 'applicants_table',
    defaultLayout || APPLICANTS_DEFAULT_LAYOUT
  );

  const effectiveOnlyStatus = useMemo((): string | string[] | undefined => {
    if (onlyStatus) return onlyStatus;
    if (params.status) return params.status;
    return undefined;
  }, [onlyStatus, params.status]);

  const isSuperAdmin = useMemo(() => {
    const roleName = user?.roleId?.name;
    return (
      typeof roleName === 'string' && roleName.toLowerCase() === 'super admin'
    );
  }, [user?.roleId?.name]);

  // Get persisted table state
  const persistedTableState = useMemo(() => {
    try {
      const rawLocal = localStorage.getItem('applicants_table_state');
      if (rawLocal) return JSON.parse(rawLocal);
      const raw = sessionStorage.getItem('applicants_table_state');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }, []); // Empty dependency array - only runs once on mount

  // URL params
  const urlParams = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return {
      status: searchParams.get('status'),
      company: searchParams.get('company'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
    };
  }, [location.search]);

  const currentUserId = useMemo(
    () => String((user as any)?._id || (user as any)?.id || ''),
    [user]
  );

  // Data fetching
  const companyId = useMemo(() => {
    if (companyIdOverride !== undefined) return companyIdOverride as any;
    if (!user) return undefined;
    const roleName = user?.roleId?.name?.toLowerCase();
    const isSuperAdminRole = roleName === 'super admin';
    const userCompanyId = user?.companies?.map((c) =>
      typeof c.companyId === 'string' ? c.companyId : c.companyId._id
    );
    if (isSuperAdminRole) return undefined;
    return userCompanyId?.length ? userCompanyId : undefined;
  }, [companyIdOverride, user]);

  const showCompanyColumn = useMemo(() => {
    if (!companyId) return true;
    if (Array.isArray(companyId) && companyId.length === 1) return false;
    return true;
  }, [companyId]);

  const assignedCompanyIds = useMemo(() => {
    if (isSuperAdmin) return [];
    const fromCompanies = Array.isArray(user?.companies)
      ? user.companies.map((c: any) => extractId(c?.companyId))
      : [];
    const fromAssigned = Array.isArray(user?.assignedcompanyId)
      ? user.assignedcompanyId
      : [];
    return Array.from(new Set([...fromCompanies, ...fromAssigned])).filter(
      Boolean
    ) as string[];
  }, [user, isSuperAdmin]);

  // React Query hooks
  const {
    data: jobPositions = [],
    isFetching: isJobPositionsFetching,
    isFetched: isJobPositionsFetched,
    refetch: refetchJobPositions,
  } = useJobPositions(companyId);
  const {
    data: applicants = [],
    error,
    refetch: refetchApplicants,
    isFetching: isApplicantsFetching,
    isFetched: isApplicantsFetched,
  } = useApplicants(companyId as any);
  const {
    data: allCompaniesRaw = [],
    refetch: refetchCompanies,
    isFetching: isCompaniesFetching,
    isFetched: isCompaniesFetched,
  } = useCompanies(companyId as any);

  const queryCompanyIds = useMemo(() => {
    if (!isSuperAdmin && assignedCompanyIds.length > 0)
      return assignedCompanyIds;
    return [] as string[];
  }, [isSuperAdmin, assignedCompanyIds]);

  // Mail count
  const { data: mailApiResponse } = useQuery<ApiMailResponse>({
    queryKey: ['mail-logs', queryCompanyIds.join(',')],
    queryFn: async () => {
      const baseParams: Record<string, string> = { PageCount: 'all' };
      if (queryCompanyIds.length <= 1) {
        if (queryCompanyIds.length === 1)
          baseParams.company = queryCompanyIds[0];
        const res = await axiosInstance.get<ApiMailResponse>('/mail', {
          params: baseParams,
        });
        return res.data;
      }
      const responses = await Promise.all(
        queryCompanyIds.map((companyId: string) =>
          axiosInstance.get<ApiMailResponse>('/mail', {
            params: { ...baseParams, company: companyId },
          })
        )
      );
      const mergedMap = new Map<string, any>();
      responses.forEach((r) =>
        (r.data?.data || []).forEach((m: any) => mergedMap.set(m._id, m))
      );
      const data = Array.from(mergedMap.values());
      return {
        message: 'success',
        page: 'all',
        PageCount: null,
        TotalCount: data.length,
        data,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const mailCountByApplicantId = useMemo(() => {
    const map = new Map<string, number>();
    (mailApiResponse?.data || []).forEach((mail: any) => {
      const applicantId =
        typeof mail.applicant === 'string'
          ? mail.applicant.trim()
          : (mail.applicant as any)?._id?.trim() || '';
      if (!applicantId) return;
      map.set(applicantId, (map.get(applicantId) || 0) + 1);
    });
    return map;
  }, [mailApiResponse]);

  // Table state
  const {
    rowSelection,
    setRowSelection,
    columnFilters,
    setColumnFilters,
    sorting,
    setSorting,
    pagination,
    setPagination,
    customFilters,
    setCustomFilters,
  } = useTableState({
    onlyStatus: effectiveOnlyStatus,
    showCompanyColumn,
    jobPositionMap: {},
    genderOptions: [],
    persistedState: persistedTableState,
  });

  // Apply URL filters
  useEffect(() => {
    if (urlParams.status) {
      setColumnFilters((prev: any) => {
        const withoutStatus = prev.filter((f: any) => f.id !== 'status');
        return [...withoutStatus, { id: 'status', value: urlParams.status }];
      });
    }
    if (urlParams.company) {
      setColumnFilters((prev: any) => {
        const withoutCompany = prev.filter((f: any) => f.id !== 'companyId');
        return [
          ...withoutCompany,
          { id: 'companyId', value: urlParams.company },
        ];
      });
    }
  }, [urlParams.status, urlParams.company, setColumnFilters]);

  // Job position map
  const jobPositionMap = useMemo(() => {
    const map: Record<string, any> = {};
    const getIdValue = (v: any) =>
      typeof v === 'string' ? v : (v?._id ?? v?.id);
    jobPositions.forEach((job: any) => {
      const ids = new Set<string>();
      const primary = getIdValue(job._id) || getIdValue(job.id);
      if (primary) ids.add(primary);
      if (job._id && typeof job._id === 'object' && job._id._id)
        ids.add(job._id._id);
      if (job.id && typeof job.id === 'object' && job.id._id)
        ids.add(job.id._id);
      ids.forEach((id) => {
        if (id) map[id] = job;
      });
    });
    return map;
  }, [jobPositions]);

  // Company map
  const companyMap = useMemo(() => {
    const map: Record<string, any> = {};
    allCompaniesRaw.forEach((company: any) => {
      const stringId =
        typeof company._id === 'string' ? company._id : company._id?._id;
      if (stringId) map[stringId] = company;
      if (company._id) map[company._id] = company;
    });
    return map;
  }, [allCompaniesRaw]);

  // Gender options
  const genderOptions = useMemo(() => {
    const s = new Set<string>();
    const rows = Array.isArray(applicants) ? applicants : [];
    rows.forEach((a: any) => {
      if (!isSuperAdmin && a?.status === 'trashed') return;
      const raw =
        a?.gender ||
        a?.customResponses?.gender ||
        a?.customResponses?.['النوع'] ||
        (a as any)['النوع'];
      const g = normalizeGender(raw);
      if (g) s.add(g);
    });
    const items = Array.from(s);
    const ordered: string[] = [];
    if (items.includes('Male')) ordered.push('Male');
    if (items.includes('Female')) ordered.push('Female');
    items.forEach((it) => {
      if (it !== 'Male' && it !== 'Female') ordered.push(it);
    });
    return ordered.map((g) => ({ id: g, title: g }));
  }, [applicants, isSuperAdmin]);

  // Job options for filter
  const jobOptions = useMemo(() => {
    const getIdValue = (v: any) =>
      typeof v === 'string' ? v : (v?._id ?? v?.id);
    return jobPositions
      .map((j: any) => {
        const id = getIdValue(j._id) || getIdValue(j.id) || '';
        const title =
          typeof j.title === 'string' ? j.title : j?.title?.en || '';
        return { id, title };
      })
      .filter((x) => x.id && x.title);
  }, [jobPositions]);

  // Company options for filter
  const companyOptions = useMemo(() => {
    return allCompaniesRaw
      .map((c: any) => {
        const id = typeof c._id === 'string' ? c._id : c._id?._id || '';
        const title = toPlainString(c?.name) || c?.title || '';
        return { id, title };
      })
      .filter((x) => x.id && x.title);
  }, [allCompaniesRaw]);

  // Field to job IDs mapping
  const fieldToJobIds = useMemo(
    () => buildFieldToJobIds(jobPositions),
    [jobPositions]
  );

  // Applicant filters — spread the options object so the hook receives its expected positional/named args
  const selectedCompanyFilterValue = useMemo(():
    | string[]
    | string
    | null
    | undefined => {
    const companyFilter = columnFilters.find((f: any) => f.id === 'companyId');
    if (!companyFilter?.value) return undefined;
    const value = companyFilter.value;

    // Handle different possible value types
    if (Array.isArray(value)) {
      return value as string[];
    }
    if (typeof value === 'string') {
      return value;
    }
    if (value === null) {
      return null;
    }
    return undefined;
  }, [columnFilters]);

  const {
    filteredApplicants,
    duplicatesOnlyEnabled,
    statusFilterOptions,
    getStatusColor,
    selectedCompanyFilter,
  } = useApplicantFilters({
    applicants,
    columnFilters,
    customFilters,
    isSuperAdmin,
    effectiveOnlyStatus,
    selectedCompanyFilterValue,
    jobPositionMap,
    fieldToJobIds,
    currentUserId,
    allCompaniesRaw,
  });

  // Applicant selection
  const {
    selectedApplicantIds,
    selectedApplicantRecipients,
    selectedApplicantsForInterview,
    selectedApplicantCompanyId,
    selectedApplicantCompany,
    selectedApplicantCount,
  } = useApplicantSelection({
    rowSelection,
    applicants,
    allCompaniesRaw,
  });

  // Bulk actions
  const {
    isDeleting,
    isProcessing,
    isSubmittingBulkInterview,
    isSubmittingBulkStatus,
    showBulkModal,
    showBulkInterviewModal,
    showBulkInterviewPreviewModal,
    showBulkStatusModal,
    showBulkPreviewFallbackModal,
    bulkFormResetKey,
    bulkInterviewError,
    bulkStatusError,
    bulkInterviewIntervalMinutes,
    bulkInterviewForm,
    bulkNotificationChannels,
    bulkEmailOption,
    bulkCustomEmail,
    bulkPhoneOption,
    bulkCustomPhone,
    bulkMessageTemplate,
    bulkInterviewEmailSubject,
    bulkPreviewHtml,
    bulkInterviewPreviewItems,
    bulkStatusForm,
    setShowBulkModal,
    setShowBulkInterviewModal,
    setShowBulkInterviewPreviewModal,
    setShowBulkStatusModal,
    setShowBulkPreviewFallbackModal,
    setBulkInterviewError,
    setBulkStatusError,
    setBulkInterviewIntervalMinutes,
    setBulkInterviewForm,
    setBulkNotificationChannels,
    setBulkEmailOption,
    setBulkCustomEmail,
    setBulkPhoneOption,
    setBulkCustomPhone,
    setBulkMessageTemplate,
    setBulkInterviewEmailSubject,
    setBulkPreviewHtml,
    setBulkStatusForm,
    handleBulkDelete,
    handleBulkStatusChange,
    handleBulkInterviewSubmit,
    handlePreviewBulkInterviews,
    openBulkInterviewModal,
    resetBulkInterviewModal,
    fillBulkCompanyAddress,
  } = useBulkActions({
    selectedApplicantIds,
    selectedApplicantsForInterview,
    selectedApplicantCompanyId,
    selectedApplicantCompany,
    refetchApplicants,
    queryClient,
    onClearSelection: () => setRowSelection({}),
  });

  // Viewport detection
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1920
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isLaptopViewport = viewportWidth <= 1440;
  const isNarrowDesktopViewport = viewportWidth <= 1024;
  const tableMinWidth = isNarrowDesktopViewport
    ? 820
    : isLaptopViewport
      ? 980
      : 1160;
  const selectColumnWidth = isLaptopViewport ? 36 : 48;

  const columnSizeConfig = useMemo(
    () => ({
      applicantNo: isLaptopViewport ? 56 : 80,
      profilePhoto: isLaptopViewport ? 52 : 72,
      fullName: isLaptopViewport ? 92 : 120,
      email: isLaptopViewport ? 128 : 170,
      phone: isLaptopViewport ? 86 : 110,
      gender: isLaptopViewport ? 70 : 90,
      companyId: isLaptopViewport ? 96 : 130,
      jobPositionId: isLaptopViewport ? 118 : 160,
      expectedSalary: isLaptopViewport ? 104 : 140,
      sscore: isLaptopViewport ? 72 : 96,
      status: isLaptopViewport ? 84 : 105,
      submittedAt: isLaptopViewport ? 88 : 110,
      actions: isLaptopViewport ? 58 : 90,
    }),
    [isLaptopViewport]
  );

  // Helper functions for navigation
  // Helper functions for navigation
  const getApplicantHref = useCallback((row: any) => {
    const orig: any = row?.original ?? row;
    const navId = String(orig?._id || orig?.id || row?.id || '');
    return `/applicant-details/${navId}`;
  }, []);

  const currentFiltersRef = useRef<{
    columnFilters: any[];
    customFilters: any[];
    filteredApplicants: any[];
  }>({
    columnFilters: [],
    customFilters: [],
    filteredApplicants: [],
  });

  // ✅ THIS IS THE CRITICAL LINE - update ref on every render
  currentFiltersRef.current = {
    columnFilters,
    customFilters,
    filteredApplicants,
  };

  const handleApplicantLinkClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, row: any) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      // Use values from ref to ensure we have the latest
      const currentFilters = currentFiltersRef.current;

      // Navigate with the current state
      navigate(getApplicantHref(row), {
        state: {
          applicant: row.original,
          columnFilters: currentFilters.columnFilters,
          sorting: sorting,
          pagination: pagination,
          customFilters: currentFilters.customFilters,
          statusFilter: currentFilters.columnFilters.find(
            (f: any) => f.id === 'status'
          )?.value,
          companyFilter: currentFilters.columnFilters.find(
            (f: any) => f.id === 'companyId'
          )?.value,
          totalFilteredCount: currentFilters.filteredApplicants.length,
          applicantsList: currentFilters.filteredApplicants,
          returnToApplicants: true,
          timestamp: Date.now(),
        },
      });
    },
    [getApplicantHref, navigate, sorting, pagination]
  );

  const handleApplicantLinkAuxClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.stopPropagation();
    },
    []
  );

  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [customFilterOpen, setCustomFilterOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [lastRefetch, setLastRefetch] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState<string | null>(null);

  useEffect(() => {
    // When filters change, clear the navigation state to force fresh data
    if (columnFilters.length > 0 || customFilters.length > 0) {
      // Clear the navigation state from location
      if (location.state?.returnToApplicants) {
        window.history.replaceState({}, document.title);
      }

      // Also clear any stored session data
      try {
        sessionStorage.removeItem('applicants_current_state');
        sessionStorage.removeItem('applicants_table_state_backup');
        sessionStorage.removeItem('applicants_filtered_list');
      } catch (e) {}
    }
  }, [columnFilters, customFilters, location.state]);
  // In the useEffect that restores table state, add a check to ensure data is loaded first

  useEffect(() => {
    if (
      !lastRefetch &&
      (isJobPositionsFetched || isApplicantsFetched || isCompaniesFetched)
    ) {
      if (mountedRef.current) setLastRefetch(new Date());
    }
  }, [
    isJobPositionsFetched,
    isApplicantsFetched,
    isCompaniesFetched,
    lastRefetch,
  ]);

  useEffect(() => {
    if (!lastRefetch) {
      setElapsed(null);
      return;
    }
    const formatRelative = (d: Date) => {
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 60) return 'now';
      const mins = Math.floor(diffSec / 60);
      if (mins < 60) return `${mins} min ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      const days = Math.floor(hours / 24);
      if (days === 1) return 'yesterday';
      if (days < 7) return `${days} days ago`;
      return d.toLocaleDateString();
    };
    const update = () => {
      if (mountedRef.current) setElapsed(formatRelative(lastRefetch));
    };
    update();
    const id = setInterval(update, 30 * 1000);
    return () => clearInterval(id);
  }, [lastRefetch]);

  // Helper functions for columns
  const getExpectedSalaryDisplay = useCallback((applicant: any): string => {
    const toText = (value: any): string => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' || typeof value === 'number')
        return String(value).trim();
      if (Array.isArray(value))
        return value.map(toText).filter(Boolean).join(', ');
      if (typeof value === 'object') {
        const candidateKeys = [
          'expectedSalary',
          'salary',
          'amount',
          'value',
          'val',
          'label',
          'name',
          'title',
          'en',
          'ar',
          'text',
        ];
        for (const key of candidateKeys) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            const nested = toText((value as any)[key]);
            if (nested) return nested;
          }
        }
      }
      return '';
    };
    const directCandidates = [
      applicant?.expectedSalary,
      applicant?.expected_salary,
      applicant?.salaryExpectation,
      applicant?.desiredSalary,
    ];
    for (const candidate of directCandidates) {
      const text = toText(candidate);
      if (text) return text;
    }
    const responses =
      applicant?.customResponses || applicant?.customFieldResponses || {};
    const normalizeKey = (key: any) =>
      String(key || '')
        .replace(/[\s_-]+/g, '')
        .toLowerCase();
    const expectedKeyMatchers = [
      'expectedsalary',
      'salary',
      'salaryexpectation',
      'desiredsalary',
      'الراتب',
      'راتب',
      'الراتبالمتوقع',
    ];
    for (const [key, value] of Object.entries(responses || {})) {
      const normalized = normalizeKey(key);
      const isSalaryKey = expectedKeyMatchers.some((matcher) =>
        normalized.includes(normalizeKey(matcher))
      );
      if (!isSalaryKey) continue;
      const text = toText(value);
      if (text) return text;
    }
    return '-';
  }, []);

  const resolveAnyId = useCallback((value: any): string => {
    if (!value) return '';
    if (typeof value === 'string' || typeof value === 'number')
      return String(value);
    if (typeof value === 'object') {
      const nested = value._id ?? value.id ?? value.jobSpecId ?? value.specId;
      if (nested === undefined || nested === null) return '';
      if (typeof nested === 'string' || typeof nested === 'number')
        return String(nested);
      return String((nested as any)?._id ?? (nested as any)?.id ?? '');
    }
    return '';
  }, []);

  const parseComparableNumber = useCallback((value: any): number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const normalizeDigits = (input: string) => {
      const map: Record<string, string> = {
        '\u0660': '0',
        '\u0661': '1',
        '\u0662': '2',
        '\u0663': '3',
        '\u0664': '4',
        '\u0665': '5',
        '\u0666': '6',
        '\u0667': '7',
        '\u0668': '8',
        '\u0669': '9',
        '\u06F0': '0',
        '\u06F1': '1',
        '\u06F2': '2',
        '\u06F3': '3',
        '\u06F4': '4',
        '\u06F5': '5',
        '\u06F6': '6',
        '\u06F7': '7',
        '\u06F8': '8',
        '\u06F9': '9',
      };
      return input.replace(
        /[\u0660-\u0669\u06F0-\u06F9]/g,
        (ch) => map[ch] || ch
      );
    };
    if (Array.isArray(value)) {
      const nums = value
        .map((item) => parseComparableNumber(item))
        .filter(
          (n): n is number => typeof n === 'number' && Number.isFinite(n)
        );
      if (!nums.length) return null;
      return Math.max(...nums);
    }
    if (typeof value === 'object') {
      const candidates = [
        (value as any).expectedSalary,
        (value as any).salary,
        (value as any).amount,
        (value as any).value,
        (value as any).val,
        (value as any).max,
        (value as any).min,
      ];
      const nums = candidates
        .map((item) => parseComparableNumber(item))
        .filter(
          (n): n is number => typeof n === 'number' && Number.isFinite(n)
        );
      if (nums.length) return Math.max(...nums);
      const nestedNums = Object.values(value)
        .map((item) => parseComparableNumber(item))
        .filter(
          (n): n is number => typeof n === 'number' && Number.isFinite(n)
        );
      if (nestedNums.length) return Math.max(...nestedNums);
      return null;
    }
    const text = normalizeDigits(String(value));
    const matches = text.match(/-?\d+(?:[.,]\d+)?/g);
    if (!matches?.length) return null;
    const nums = matches
      .map((m) => Number(m.replace(/,/g, '')))
      .filter((n) => Number.isFinite(n));
    if (!nums.length) return null;
    return Math.max(...nums);
  }, []);

  const getApplicantSScore = useCallback(
    (applicant: any): number | null => {
      const parseAnswer = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value > 0;
        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          if (
            [
              'true',
              '1',
              'yes',
              'y',
              'accepted',
              'met',
              'pass',
              'passed',
            ].includes(normalized)
          )
            return true;
          if (
            ['false', '0', 'no', 'n', 'rejected', 'failed', 'not met'].includes(
              normalized
            )
          )
            return false;
        }
        return Boolean(value);
      };
      const getApplicantSpecResponses = (): any[] => {
        if (
          Array.isArray(applicant?.jobSpecsWithDetails) &&
          applicant.jobSpecsWithDetails.length
        )
          return applicant.jobSpecsWithDetails;
        if (
          Array.isArray(applicant?.jobSpecsResponses) &&
          applicant.jobSpecsResponses.length
        )
          return applicant.jobSpecsResponses;
        if (Array.isArray(applicant?.jobSpecs) && applicant.jobSpecs.length)
          return applicant.jobSpecs;
        if (
          typeof applicant?.jobPositionId === 'object' &&
          applicant.jobPositionId
        ) {
          if (
            Array.isArray(applicant.jobPositionId.jobSpecsWithDetails) &&
            applicant.jobPositionId.jobSpecsWithDetails.length
          )
            return applicant.jobPositionId.jobSpecsWithDetails;
          if (
            Array.isArray(applicant.jobPositionId.jobSpecsResponses) &&
            applicant.jobPositionId.jobSpecsResponses.length
          )
            return applicant.jobPositionId.jobSpecsResponses;
          if (
            Array.isArray(applicant.jobPositionId.jobSpecs) &&
            applicant.jobPositionId.jobSpecs.length
          )
            return applicant.jobPositionId.jobSpecs;
        }
        return [];
      };
      const getJobSpecs = (): any[] => {
        const rawJob = applicant?.jobPositionId;
        const jobId = resolveAnyId(rawJob);
        const mapped = jobId ? jobPositionMap[jobId] : undefined;
        const source =
          mapped ||
          (typeof rawJob === 'object' ? rawJob : undefined) ||
          applicant?.jobPosition;
        if (
          source &&
          Array.isArray(source.jobSpecsWithDetails) &&
          source.jobSpecsWithDetails.length
        )
          return source.jobSpecsWithDetails;
        if (source && Array.isArray(source.jobSpecs) && source.jobSpecs.length)
          return source.jobSpecs;
        const fallbackSpecs = getApplicantSpecResponses();
        return Array.isArray(fallbackSpecs) ? fallbackSpecs : [];
      };
      const specs = getJobSpecs();
      if (!specs.length) return null;
      const applicantResponses = getApplicantSpecResponses();
      const answerById: Record<string, boolean> = {};
      applicantResponses.forEach((entry: any) => {
        if (!entry || typeof entry !== 'object') return;
        const answerRaw =
          entry.answer ??
          entry.accepted ??
          entry.isAccepted ??
          entry.met ??
          entry.match ??
          entry.selected;
        const answer = parseAnswer(answerRaw);
        [entry.jobSpecId, entry.specId, entry._id, entry.id]
          .map((id) => resolveAnyId(id))
          .filter(Boolean)
          .forEach((id) => {
            answerById[id] = answer;
          });
      });
      let totalWeight = 0,
        acceptedWeight = 0,
        totalCount = 0,
        acceptedCount = 0;
      specs.forEach((spec: any) => {
        totalCount += 1;
        const rawWeight = Number(spec?.weight ?? 0);
        const weight =
          Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 0;
        totalWeight += weight;
        const specIds = [spec?.jobSpecId, spec?.specId, spec?._id, spec?.id]
          .map((id) => resolveAnyId(id))
          .filter(Boolean);
        let accepted: boolean | undefined;
        for (const specId of specIds) {
          if (answerById[specId] !== undefined) {
            accepted = answerById[specId];
            break;
          }
        }
        if (accepted === undefined) {
          const fallback = applicantResponses.find(
            (_: any, idx: number) => idx === specs.indexOf(spec)
          );
          if (fallback !== undefined) {
            const fallbackRaw =
              fallback?.answer ??
              fallback?.accepted ??
              fallback?.isAccepted ??
              fallback?.met ??
              fallback?.match ??
              fallback?.selected;
            accepted = parseAnswer(fallbackRaw);
          } else {
            accepted = false;
          }
        }
        if (accepted) {
          acceptedCount += 1;
          acceptedWeight += weight;
        }
      });
      if (totalWeight > 0)
        return Math.round((acceptedWeight / totalWeight) * 100);
      if (totalCount > 0) return Math.round((acceptedCount / totalCount) * 100);
      return null;
    },
    [jobPositionMap, resolveAnyId]
  );

  const formatDate = useCallback((dateString: string) => {
    if (!dateString) return '-';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const downloadCvForApplicant = useCallback(async (a: any) => {
    if (!a)
      return Swal.fire(
        'No CV',
        'No CV file available for this applicant',
        'info'
      );
    const resolveCvPath = (applicant: any): string | null => {
      const keys = [
        'cvFilePath',
        'resumePath',
        'cvUrl',
        'resumeUrl',
        'curriculumVitaePath',
      ] as const;
      for (const key of keys) {
        const value = applicant?.[key];
        if (typeof value === 'string' && value.trim().length > 0) return value;
      }
      return null;
    };
    const path = resolveCvPath(a);
    if (!path)
      return Swal.fire(
        'No CV',
        'No CV file available for this applicant',
        'info'
      );
    const url = (() => {
      if (!path) return null;
      if (
        typeof path === 'string' &&
        (path.startsWith('http') || path.startsWith('data:'))
      )
        return path;
      const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      return base ? `${base}/${String(path).replace(/^\//, '')}` : String(path);
    })();
    const buildCloudinaryDownloadUrl = (u: string, idHint?: string) => {
      try {
        if (!u) return null;
        const urlParts = u.split('/upload/');
        if (urlParts.length !== 2) return null;
        const fileName = `CV_${idHint || 'cv'}`;
        const transformations = `f_auto/fl_attachment:${fileName}`;
        return `${urlParts[0]}/upload/${transformations}/${urlParts[1]}`;
      } catch (e) {
        return null;
      }
    };
    const cloudUrl = buildCloudinaryDownloadUrl(
      url || '',
      (a?.applicantNo || a?._id || '').toString()
    );
    if (cloudUrl) {
      window.open(cloudUrl, '_blank');
      return;
    }
    window.open(url || String(path), '_blank');
  }, []);

  const handleExportToExcel = useCallback(async () => {
    if (selectedApplicantIds.length === 0) {
      await Swal.fire({
        title: 'No Selection',
        text: 'Please select at least one applicant to export.',
        icon: 'warning',
        timer: 2000,
        showConfirmButton: false,
      });
      return;
    }
    setIsExporting(true);
    try {
      const result = await exportToExcel(applicants, selectedApplicantIds, {
        jobPositionMap,
        companyMap,
        getExpectedSalaryDisplay,
        getApplicantSScore,
        normalizeGender,
        options: { includeCustomFields: true, includeJobSpecs: true },
      });
      await showExportNotification(result);
    } finally {
      setIsExporting(false);
    }
  }, [
    selectedApplicantIds,
    applicants,
    jobPositionMap,
    companyMap,
    getExpectedSalaryDisplay,
    getApplicantSScore,
  ]);

  const isTableLoading = Boolean(
    isJobPositionsFetching || isApplicantsFetching || isCompaniesFetching
  );

  const renderCellSkeleton = (
    variant: 'text' | 'circular' | 'rectangular' = 'text',
    width?: number | string,
    height?: number
  ) => {
    if (variant === 'circular') {
      return (
        <div className="flex h-10 w-10 items-center justify-center">
          <Skeleton
            variant="circular"
            width={width || 40}
            height={height || 40}
          />
        </div>
      );
    }
    return (
      <Skeleton
        variant={variant as any}
        width={width || '60%'}
        height={height}
      />
    );
  };

  // Add this function near your other helper functions (before the columns definition)
  const extractRejectionReasons = useCallback((applicant: Applicant): string[] => {
    try {
      // Check status history
      const history = applicant?.statusHistory;
      if (Array.isArray(history)) {
        const rejected = history.filter(
          (h: any) => String(h?.status || '').toLowerCase() === applicant.status
        );
        if (rejected.length) {
          rejected.sort((x: any, y: any) => {
            const tx = x?.changedAt ? new Date(x.changedAt).getTime() : 0;
            const ty = y?.changedAt ? new Date(y.changedAt).getTime() : 0;
            return ty - tx;
          });
          const latest = rejected[0] || {};
          const reasons =
            latest.reasons ??
            [];
          if (Array.isArray(reasons)) {
            return reasons
              .map((r: any) => String(r ?? '').trim())
              .filter(Boolean);
          }
          if (typeof reasons === 'string' && reasons) {
            return [reasons];
          }
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  }, []);

  // Add this memo for rejection reasons options (add it near your other useMemo hooks)
  const rejectionReasonsOptions = useMemo(() => {
    const reasonsSet = new Set<string>();

    // Extract rejection reasons from filteredApplicants
    (filteredApplicants || []).forEach((applicant: any) => {
      const reasons = extractRejectionReasons(applicant);
      reasons.forEach((reason: string) => {
        if (reason) reasonsSet.add(reason);
      });
    });

    // Convert to array and sort alphabetically
    return Array.from(reasonsSet)
      .sort()
      .map((reason) => ({ id: reason, title: reason }));
  }, [filteredApplicants, extractRejectionReasons]);

  // Build complete columns for the table
  const columns = useMemo<MRT_ColumnDef<any>[]>(
    () => [
      {
        accessorKey: 'applicantNo',
        header: isLaptopViewport ? 'ID' : 'ApplicantNo',
        size: columnSizeConfig.applicantNo,
        enableColumnFilter: false,
        enableSorting: !duplicatesOnlyEnabled,
        sortingFn: (rowA, rowB, columnId) => {
          if (duplicatesOnlyEnabled) return 0;
          const a = rowA.getValue(columnId);
          const b = rowB.getValue(columnId);
          const numA = Number(a);
          const numB = Number(b);
          if (isNaN(numA) || isNaN(numB)) {
            return String(a).localeCompare(String(b));
          }
          return numA - numB;
        },
        Cell: ({ row, table }) => {
          if (isTableLoading) return renderCellSkeleton('text', '40%');
          const orig: any = row.original as any;
          const possible =
            orig?.applicantNo ||
            orig?.applicantNumber ||
            orig?.applicationNo ||
            orig?.applicationId;
          if (possible) {
            return (
              <a
                href={getApplicantHref(row)}
                className="text-inherit no-underline hover:no-underline"
                onClick={(e) => handleApplicantLinkClick(e, row)}
                onAuxClick={handleApplicantLinkAuxClick}
              >
                {String(possible)}
              </a>
            );
          }
          const idx =
            row.index ??
            table.getRowModel().rows.findIndex((r) => r.id === row.id);
          if (typeof idx === 'number' && idx >= 0) {
            return (
              <a
                href={getApplicantHref(row)}
                className="text-inherit no-underline hover:no-underline"
                onClick={(e) => handleApplicantLinkClick(e, row)}
                onAuxClick={handleApplicantLinkAuxClick}
              >
                {String(idx + 1)}
              </a>
            );
          }
          const id = orig?._id || orig?.id || '';
          if (!id) return '-';
          return (
            <a
              href={getApplicantHref(row)}
              className="text-inherit no-underline hover:no-underline"
              onClick={(e) => handleApplicantLinkClick(e, row)}
              onAuxClick={handleApplicantLinkAuxClick}
            >
              {String(id).slice(0, 8)}
            </a>
          );
        },
      },
      {
        accessorKey: 'profilePhoto',
        header: 'Photo',
        size: columnSizeConfig.profilePhoto,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }: { row: { original: any } }) => {
          if (isTableLoading) return renderCellSkeleton('circular', 40, 40);
          return (
            <div
              className="cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (row.original.profilePhoto) {
                  setPreviewPhoto(row.original.profilePhoto);
                } else {
                  handleApplicantLinkClick(e as any, row);
                }
              }}
            >
              <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 transition hover:ring-2 hover:ring-brand-500">
                <ImageThumbnailComponent
                  src={row.original.profilePhoto}
                  alt={row.original.fullName}
                  onClick={() => {
                    if (row.original.profilePhoto) {
                      setPreviewPhoto(row.original.profilePhoto);
                    }
                  }}
                />
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'fullName',
        header: 'Name',
        size: columnSizeConfig.fullName,
        enableColumnFilter: false,
        enableSorting: true,
        Cell: ({ row }: { row: { original: any } }) => {
          if (isTableLoading) return renderCellSkeleton('text');
          const orig: any = row.original;
          const seenBy = orig?.seenBy ?? [];
          const isSeen =
            Array.isArray(seenBy) &&
            seenBy.some((s: any) => {
              if (!s) return false;
              if (typeof s === 'string') return s === currentUserId;
              return s._id === currentUserId || s.id === currentUserId;
            });
          return (
            <a
              href={getApplicantHref(row)}
              className="text-inherit no-underline hover:no-underline"
              style={{ color: isSeen ? '#9CA3AF' : 'inherit' }}
              onClick={(e) => handleApplicantLinkClick(e, row)}
              onAuxClick={handleApplicantLinkAuxClick}
            >
              {orig?.fullName || '-'}
            </a>
          );
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        size: columnSizeConfig.email,
        enableColumnFilter: false,
        enableSorting: true,
        Cell: ({ row }: { row: { original: any } }) => {
          if (isTableLoading) return renderCellSkeleton('text');
          return (
            <a
              href={getApplicantHref(row)}
              className="text-inherit no-underline hover:no-underline"
              onClick={(e) => handleApplicantLinkClick(e, row)}
              onAuxClick={handleApplicantLinkAuxClick}
            >
              {row.original.email || '-'}
            </a>
          );
        },
      },
      {
        id: 'messages',
        header: 'Messages',
        size: 90,
        enableSorting: true,
        accessorFn: (row: any) =>
          mailCountByApplicantId.get(String(row?._id || row?.id || '')) ?? 0,
        sortingFn: (rowA: any, rowB: any, columnId: string) => {
          const a = Number(rowA.getValue(columnId) ?? 0);
          const b = Number(rowB.getValue(columnId) ?? 0);
          return a === b ? 0 : a > b ? 1 : -1;
        },
        enableColumnFilter: false,
        Cell: ({ row }: { row: { original: any } }) => {
          if (isTableLoading) return renderCellSkeleton('text');
          const id = String(
            (row.original as any)?._id || (row.original as any)?.id || ''
          );
          const count = mailCountByApplicantId.get(id) ?? 0;
          if (count === 0) return <div />;
          return (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ChatIcon className="w-4 h-4 text-gray-500" />
              <span className="whitespace-nowrap">{count}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        size: columnSizeConfig.phone,
        enableColumnFilter: false,
        enableSorting: true,
        Cell: ({ row }: { row: { original: any } }) => {
          if (isTableLoading) return renderCellSkeleton('text');
          return (
            <a
              href={getApplicantHref(row)}
              className="text-inherit no-underline hover:no-underline"
              onClick={(e) => handleApplicantLinkClick(e, row)}
              onAuxClick={handleApplicantLinkAuxClick}
            >
              {row.original.phone || '-'}
            </a>
          );
        },
      },
      {
        id: 'gender',
        accessorFn: (row: any) =>
          normalizeGender(
            row.gender ||
              row.customResponses?.gender ||
              row.customResponses?.['النوع'] ||
              (row as any)['النوع'] ||
              ''
          ),
        header: 'Gender',
        size: columnSizeConfig.gender,
        enableColumnFilter: false,
        enableSorting: true,
        Header: ({ column }: { column: any }) => (
          <ColumnMultiSelectHeader
            column={column}
            label="Gender"
            options={genderOptions}
            isLaptopViewport={isLaptopViewport}
            menuWidth={200}
            menuMaxHeight={240}
          />
        ),
        filterFn: (row: any, columnId: string, filterValue: any) => {
          if (!filterValue) return true;
          const vals = Array.isArray(filterValue) ? filterValue : [filterValue];
          if (!vals.length) return true;
          const cell = String(row.getValue(columnId) ?? '');
          return vals.includes(cell);
        },
        Cell: ({ row }: { row: { original: any } }) => {
          if (isTableLoading) return renderCellSkeleton('text');
          const raw =
            row.original.gender ||
            row.original.customResponses?.gender ||
            row.original.customResponses?.['النوع'] ||
            (row.original as any)['النوع'] ||
            '';
          const g = normalizeGender(raw);
          return (
            <a
              href={getApplicantHref(row)}
              className="text-inherit no-underline hover:no-underline"
              onClick={(e) => handleApplicantLinkClick(e, row)}
              onAuxClick={handleApplicantLinkAuxClick}
            >
              {g || '-'}
            </a>
          );
        },
      },
      ...(showCompanyColumn
        ? [
            {
              id: 'companyId',
              header: 'Company',
              size: columnSizeConfig.companyId,
              enableColumnFilter: false,
              enableSorting: true,
              accessorFn: (row: any) =>
                getApplicantCompanyId(row, jobPositionMap),
              Header: ({ column }: { column: any }) => (
                <ColumnMultiSelectHeader
                  column={column}
                  label="Company"
                  options={companyOptions}
                  isLaptopViewport={isLaptopViewport}
                  menuWidth={240}
                  menuMaxHeight={300}
                />
              ),
              filterFn: (row: any, columnId: string, filterValue: any) => {
                if (!filterValue) return true;
                const vals = Array.isArray(filterValue)
                  ? filterValue
                  : [filterValue];
                if (!vals.length) return true;
                const cell = String(row.getValue(columnId) ?? '');
                return vals.includes(cell);
              },
              Cell: ({ row }: { row: { original: any } }) => {
                if (isTableLoading) return renderCellSkeleton('text');
                const cId = getApplicantCompanyId(row.original, jobPositionMap);
                const company = companyMap[cId || ''];
                return (
                  <a
                    href={getApplicantHref(row)}
                    className="text-inherit no-underline hover:no-underline"
                    onClick={(e) => handleApplicantLinkClick(e, row)}
                    onAuxClick={handleApplicantLinkAuxClick}
                  >
                    {toPlainString(company?.name) || company?.title || 'N/A'}
                  </a>
                );
              },
            },
          ]
        : []),
      {
        id: 'jobPositionId',
        header: isLaptopViewport ? 'Job' : 'Job Position',
        enableSorting: true,
        accessorFn: (row: any) => {
          const raw = row?.jobPositionId;
          const getId = (v: any) =>
            typeof v === 'string' ? v : (v?._id ?? v?.id ?? '');
          return getId(raw);
        },
        Header: ({ column }: { column: any }) => (
          <ColumnMultiSelectHeader
            column={column}
            label={isLaptopViewport ? 'Job' : 'Job Position'}
            options={jobOptions}
            isLaptopViewport={isLaptopViewport}
            menuWidth={260}
            menuMaxHeight={280}
          />
        ),
        filterFn: (row: any, columnId: string, filterValue: any) => {
          if (!filterValue) return true;
          const vals = Array.isArray(filterValue) ? filterValue : [filterValue];
          if (!vals.length) return true;
          const cell = String(row.getValue(columnId) ?? '');
          return vals.includes(cell);
        },
        size: columnSizeConfig.jobPositionId,
        enableColumnFilter: false,
        Cell: ({ row }: { row: { original: any } }) => {
          if (isTableLoading) return renderCellSkeleton('text');
          const raw = row.original.jobPositionId;
          const getId = (v: any) => {
            if (!v) return '';
            if (typeof v === 'string') return v;
            return v._id ?? v.id ?? '';
          };
          const jobId = getId(raw);
          const job = jobPositionMap[jobId];
          const title =
            typeof job?.title === 'string'
              ? job.title
              : (job?.title?.en ??
                jobOptions.find((o) => o.id === jobId)?.title ??
                'N/A');
          return (
            <a
              href={getApplicantHref(row)}
              className="text-inherit no-underline hover:no-underline text-sm font-medium"
              onClick={(e) => handleApplicantLinkClick(e, row)}
              onAuxClick={handleApplicantLinkAuxClick}
            >
              {title}
            </a>
          );
        },
      },
      {
        id: 'expectedSalary',
        header: 'Expected Salary',
        size: columnSizeConfig.expectedSalary,
        enableColumnFilter: false,
        enableSorting: true,
        accessorFn: (row: any) => getExpectedSalaryDisplay(row),
        sortingFn: (rowA: any, rowB: any) => {
          const a = parseComparableNumber(
            getExpectedSalaryDisplay(rowA.original)
          );
          const b = parseComparableNumber(
            getExpectedSalaryDisplay(rowB.original)
          );
          const va = a ?? -1;
          const vb = b ?? -1;
          if (va === vb) return 0;
          return va > vb ? 1 : -1;
        },
        Cell: ({ row }: { row: { original: any } }) => {
          if (isTableLoading) return renderCellSkeleton('text');
          const expectedSalary = getExpectedSalaryDisplay(row.original);
          return (
            <a
              href={getApplicantHref(row)}
              className="text-inherit no-underline hover:no-underline"
              onClick={(e) => handleApplicantLinkClick(e, row)}
              onAuxClick={handleApplicantLinkAuxClick}
            >
              {expectedSalary || '-'}
            </a>
          );
        },
      },
      {
        id: 'sscore',
        header: 'Score',
        size: columnSizeConfig.sscore,
        enableColumnFilter: false,
        enableSorting: true,
        accessorFn: (row: any) => getApplicantSScore(row),
        sortingFn: (rowA: any, rowB: any, columnId: string) => {
          const a = Number(rowA.getValue(columnId));
          const b = Number(rowB.getValue(columnId));
          const scoreA = Number.isFinite(a) ? a : -1;
          const scoreB = Number.isFinite(b) ? b : -1;
          if (scoreA === scoreB) return 0;
          return scoreA > scoreB ? 1 : -1;
        },
        Cell: ({ row }: { row: { original: any } }) => {
          if (isTableLoading) return renderCellSkeleton('text');
          const score = getApplicantSScore(row.original);
          return (
            <a
              href={getApplicantHref(row)}
              className="text-inherit no-underline hover:no-underline"
              onClick={(e) => handleApplicantLinkClick(e, row)}
              onAuxClick={handleApplicantLinkAuxClick}
            >
              {score === null ? '-' : `${score}%`}
            </a>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: true,
        Header: ({ column }: { column: any }) => {
          if (
            effectiveOnlyStatus !== undefined &&
            effectiveOnlyStatus !== null
          ) {
            return <span className="text-sm font-medium">Status</span>;
          }
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <ColumnMultiSelectHeader
                column={column}
                label="Status"
                options={statusFilterOptions}
                isLaptopViewport={isLaptopViewport}
                menuWidth={220}
                menuMaxHeight={240}
              />
            </div>
          );
        },
        filterFn: (row: any, columnId: string, filterValue: any) => {
          if (!filterValue) return true;
          const vals = Array.isArray(filterValue) ? filterValue : [filterValue];
          if (!vals.length) return true;
          const cell = String(row.getValue(columnId) ?? '');
          return vals.includes(cell);
        },
        size: columnSizeConfig.status,
        enableColumnFilter: false,
        Cell: ({ row }: { row: { original: any } }) => {
          if (isTableLoading) return renderCellSkeleton('text', '80px');

          // Get the company ID from the applicant
          const applicantCompanyId = getApplicantCompanyId(
            row.original,
            jobPositionMap
          );

          return (
            <a
              href={getApplicantHref(row)}
              className="text-inherit no-underline hover:no-underline"
              onClick={(e) => handleApplicantLinkClick(e, row)}
              onAuxClick={handleApplicantLinkAuxClick}
            >
              <StatusCell
                status={row.original.status}
                showTooltip
                selectedCompanyFilter={selectedCompanyFilter}
                companyId={applicantCompanyId}
                allCompanies={allCompaniesRaw}
                applicant={row.original}
              />
            </a>
          );
        },
      },
      // Rejection reasons column - shown only when this view is fixed to 'rejected'
      ...(onlyStatus !== undefined
        ? [
            {
              id: 'rejectionReasons',
              header: 'Reasons',
              enableSorting: true,
              enableColumnFilter: true,
              size: 260,
              accessorFn: (row: any) => extractRejectionReasons(row),
              sortingFn: (rowA: any, rowB: any, columnId: string) => {
                const reasonsA = rowA.getValue(columnId) as string[];
                const reasonsB = rowB.getValue(columnId) as string[];
                const a = reasonsA.length;
                const b = reasonsB.length;
                if (a === b) return 0;
                return a > b ? 1 : -1;
              },
              filterFn: (row: any, columnId: string, filterValue: any) => {
                if (!filterValue) return true;
                const selectedReasons = Array.isArray(filterValue)
                  ? filterValue
                  : [filterValue];
                if (selectedReasons.length === 0) return true;

                const applicantReasons = row.getValue(columnId) as string[];

                // Check if any of the applicant's reasons match any selected filter
                return selectedReasons.some((selectedReason) =>
                  applicantReasons.some(
                    (applicantReason) =>
                      applicantReason
                        .toLowerCase()
                        .includes(selectedReason.toLowerCase()) ||
                      selectedReason
                        .toLowerCase()
                        .includes(applicantReason.toLowerCase())
                  )
                );
              },
              Header: ({ column }: { column: any }) => (
                <ColumnMultiSelectHeader
                  column={column}
                  label="Reasons"
                  options={rejectionReasonsOptions}
                  isLaptopViewport={isLaptopViewport}
                  menuWidth={260}
                  menuMaxHeight={320}
                />
              ),
              Cell: ({ row }: { row: { original: any } }) => {
                if (isTableLoading) return renderCellSkeleton('text');
                const a = row.original || {};
                const reasons = extractRejectionReasons(a);

                if (!reasons || reasons.length === 0) {
                  return <span className="text-sm text-gray-500">-</span>;
                }

                return (
                  <div className="flex flex-wrap gap-1">
                    {reasons.map((r: string, i: number) => (
                      <span
                        key={i}
                        className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                );
              },
            },
          ]
        : []),
      {
        accessorKey: 'submittedAt',
        header: 'Submitted',
        Header: ({ column, table }: { column: any; table: any }) => {
          const sortingState = table.getState().sorting;
          const submittedSort = sortingState.find(
            (s: any) => s.id === column.id
          );
          const desc = submittedSort ? submittedSort.desc : true;
          const toggle = (e: any) => {
            e.preventDefault();
            e.stopPropagation();
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
        size: columnSizeConfig.submittedAt,
        enableColumnFilter: false,
        enableSorting: true,
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
        Cell: ({ row }: any) => {
          if (isTableLoading) return renderCellSkeleton('text');
          return (
            <a
              href={getApplicantHref(row)}
              className="text-inherit no-underline hover:no-underline"
              onClick={(e) => handleApplicantLinkClick(e, row)}
              onAuxClick={handleApplicantLinkAuxClick}
            >
              {formatDate(row.original.submittedAt)}
            </a>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        size: columnSizeConfig.actions,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }: any) => {
          if (isTableLoading) return renderCellSkeleton('text');
          const orig = row.original as any;
          const resolveCvPath = (applicant: any): string | null => {
            const keys = [
              'cvFilePath',
              'resumePath',
              'cvUrl',
              'resumeUrl',
              'curriculumVitaePath',
            ] as const;
            for (const key of keys) {
              const value = applicant?.[key];
              if (typeof value === 'string' && value.trim().length > 0)
                return value;
            }
            return null;
          };
          const hasCv = Boolean(resolveCvPath(orig));
          return (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2"
            >
              {hasCv ? (
                <button
                  type="button"
                  aria-label="Download CV"
                  title="Download CV"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await downloadCvForApplicant(orig);
                  }}
                  className="inline-flex items-center justify-center rounded bg-brand-500 p-1 text-white hover:bg-brand-600"
                >
                  <span className="sr-only">Download CV</span>
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 3v12m0 0l-4-4m4 4l4-4M21 21H3"
                    />
                  </svg>
                </button>
              ) : (
                <span className="text-xs text-gray-500">-</span>
              )}
            </div>
          );
        },
      },
    ],
    [
      columnSizeConfig,
      isLaptopViewport,
      duplicatesOnlyEnabled,
      isTableLoading,
      genderOptions,
      showCompanyColumn,
      companyOptions,
      jobOptions,
      statusFilterOptions,
      effectiveOnlyStatus,
      getStatusColor,
      formatDate,
      getExpectedSalaryDisplay,
      getApplicantSScore,
      parseComparableNumber,
      mailCountByApplicantId,
      jobPositionMap,
      companyMap,
      currentUserId,
    ]
  );

  // MUI Theme
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
          primary: { main: '#e42e2b' },
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
          MuiCheckbox: {
            defaultProps: { size: 'large' },
            styleOverrides: {
              root: {
                color: isDarkMode ? '#667085' : '#98A2B3',
                padding: '2px',
                '& .MuiSvgIcon-root': { fontSize: '2rem' },
                '&.Mui-checked': { color: '#e42e2b' },
              },
            },
          },
        },
      }),
    [isDarkMode]
  );

  const skeletonData = useMemo(
    () =>
      Array.from({ length: pagination.pageSize || 10 }).map((_, i) => ({
        _id: `skeleton-${i}`,
        _skeleton: true,
      })),
    [pagination.pageSize]
  );

  const table = useMaterialReactTable({
    columns,
    enableSorting: !duplicatesOnlyEnabled,
    data: isTableLoading ? skeletonData : filteredApplicants,
    displayColumnDefOptions: {
      'mrt-row-select': {
        size: selectColumnWidth,
        muiTableHeadCellProps: {
          align: 'center',
          sx: {
            padding: 0,
            width: `${selectColumnWidth}px`,
            minWidth: `${selectColumnWidth}px`,
            maxWidth: `${selectColumnWidth}px`,
          },
        },
        muiTableBodyCellProps: {
          align: 'center',
          sx: {
            padding: 0,
            width: `${selectColumnWidth}px`,
            minWidth: `${selectColumnWidth}px`,
            maxWidth: `${selectColumnWidth}px`,
          },
        },
        Cell: ({ row, table }: any) => {
          if (isTableLoading) return null;
          return (
            <div
              className="flex items-center justify-center p-2"
              onClick={(e) => e.stopPropagation()}
              onAuxClick={(e) => e.stopPropagation()}
            >
              <MRT_SelectCheckbox row={row} table={table} />
            </div>
          );
        },
      },
    },
    enableRowSelection: !isTableLoading,
    enablePagination: true,
    enableBatchRowSelection: false,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    enableColumnFilters: true,
    enableFilters: true,
    enableHiding: true,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableColumnActions: false,
    enableColumnResizing: true,
    layoutMode: 'grid',
    manualPagination: false,
    manualFiltering: false,
    manualSorting: false,
    rowCount: isTableLoading ? skeletonData.length : filteredApplicants.length,
    initialState: {
      pagination,
      columnFilters,
      columnVisibility: layout.columnVisibility || {},
      density: 'compact',
      columnOrder:
        Array.isArray(layout.columnOrder) && layout.columnOrder.length
          ? layout.columnOrder
          : Array.from(
              new Set([
                'mrt-row-select',
                ...columns
                  .map((c) => (c as any).id ?? (c as any).accessorKey)
                  .filter(Boolean),
              ])
            ),
    },
    state: {
      sorting,
      pagination,
      columnFilters,
      rowSelection,
      columnVisibility: layout.columnVisibility || {},
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater(layout.columnVisibility)
          : updater;
      saveLayout({ columnVisibility: next });
    },
    onColumnSizingChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(layout.columnSizing) : updater;
      saveLayout({ columnSizing: next });
    },
    onColumnOrderChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(layout.columnOrder) : updater;
      saveLayout({ columnOrder: next });
    },
    renderTopToolbarCustomActions: () => (
      <div className="flex items-center p-2 w-full justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const currentFilter = customFilters.find(
                (f: any) => f?.fieldId === '__duplicates_only'
              );
              if (currentFilter) {
                setCustomFilters((prev: any) =>
                  prev.filter((f: any) => f?.fieldId !== '__duplicates_only')
                );
              } else {
                setCustomFilters((prev: any) => [
                  ...prev,
                  {
                    fieldId: '__duplicates_only',
                    value: true,
                    type: 'boolean',
                    label: 'Show Duplicates Only',
                  },
                ]);
              }
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-semibold transition-all duration-200 ${duplicatesOnlyEnabled ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200'}`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
              />
            </svg>
            {duplicatesOnlyEnabled ? 'Duplicates Only' : 'Show Duplicates'}
          </button>
          {duplicatesOnlyEnabled && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {(() => {
                const duplicateLookup = buildApplicantDuplicateLookup(
                  filteredApplicants as any[],
                  currentUserId,
                  {
                    getCompanyId: (applicant: any) =>
                      getApplicantCompanyId(applicant, jobPositionMap),
                  }
                );
                const duplicateCount = Array.from(
                  duplicateLookup.values()
                ).filter((d) => d.isDuplicate === true).length;
                return `${duplicateCount} duplicate applicant(s) found`;
              })()}
            </span>
          )}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCustomFilterOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
          >
            Filter Settings
          </button>
        </div>
      </div>
    ),
    muiTablePaperProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        backgroundImage: 'none',
      },
    },
    muiTableProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        tableLayout: 'auto',
        width: '100%',
        minWidth: `${tableMinWidth}px`,
        fontFamily: "'Cairo', Outfit, system-ui",
        fontSize: '0.82rem',
      },
    },
    muiTableContainerProps: { sx: { maxWidth: '100%', overflowX: 'auto' } },
    muiTableBodyCellProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        color: isDarkMode ? '#E4E7EC' : '#101828',
        borderColor: isDarkMode ? '#344054' : '#E4E7EC',
        display: 'flex',
        alignItems: 'center',
        fontSize: isLaptopViewport ? '0.76rem' : '0.8rem',
        padding: isLaptopViewport ? '5px 6px' : '6px 8px',
        whiteSpace: 'nowrap',
      },
    },
    muiTableHeadCellProps: {
      sx: {
        backgroundColor: isDarkMode ? '#1C2434' : '#F9FAFB',
        color: isDarkMode ? '#E4E7EC' : '#344054',
        fontWeight: 600,
        fontSize: isLaptopViewport ? '0.74rem' : '0.78rem',
        padding: isLaptopViewport ? '7px 6px' : '8px 8px',
        whiteSpace: 'nowrap',
      },
    },
    muiTableBodyRowProps: () => ({
      sx: {
        cursor: 'default',
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        '&:hover': { backgroundColor: isDarkMode ? '#344054' : '#F9FAFB' },
      },
    }),
    getRowId: (row) => row._id,
  });

  return (
    <ThemeProvider theme={muiTheme}>
      <PageMeta title="Applicants" description="Manage job applicants" />
      <PageBreadcrumb
        pageTitle="Applicants"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const promises: Promise<any>[] = [];
                if (isJobPositionsFetched) promises.push(refetchJobPositions());
                if (isApplicantsFetched) promises.push(refetchApplicants());
                if (isCompaniesFetched) promises.push(refetchCompanies());
                if (promises.length === 0) return;
                await Promise.all(promises);
                if (mountedRef.current) setLastRefetch(new Date());
              }}
              disabled={
                isJobPositionsFetching ||
                isApplicantsFetching ||
                isCompaniesFetching
              }
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
            >
              {isJobPositionsFetching ||
              isApplicantsFetching ||
              isCompaniesFetching
                ? 'Updating Data'
                : 'Update Data'}
            </button>
            <div className="text-sm text-gray-500">
              {elapsed ? `Last Update: ${elapsed}` : 'Not updated yet'}
            </div>
          </div>
        }
      />
      <div className="grid gap-6">
        <ComponentCard
          title="Job Applicants"
          desc="View and manage all applicants"
        >
          <>
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                {String(error)}
              </div>
            )}

            {selectedApplicantCount > 0 && (
              <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg bg-brand-50 px-4 py-3 dark:bg-brand-900/20">
                <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
                  {selectedApplicantCount} applicant(s) selected
                </span>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkStatusForm({ status: '', reasons: [], notes: '' });
                      setBulkStatusError('');
                      setShowBulkStatusModal(true);
                    }}
                    disabled={isProcessing || selectedApplicantCount === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
                  >
                    {isProcessing ? 'Changing...' : 'Change Status'}
                  </button>
                  <button
                    onClick={handleExportToExcel}
                    disabled={isExporting || selectedApplicantCount === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                      />
                    </svg>
                    {isExporting
                      ? 'Exporting...'
                      : `Export (${selectedApplicantCount})`}
                  </button>
                  <button
                    onClick={() => setShowBulkModal(true)}
                    disabled={
                      isProcessing || selectedApplicantRecipients.length === 0
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {`Send Mail (${selectedApplicantRecipients.length})`}
                  </button>
                  <button
                    onClick={openBulkInterviewModal}
                    disabled={
                      isSubmittingBulkInterview ||
                      selectedApplicantsForInterview.length === 0
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                  >
                    {isSubmittingBulkInterview
                      ? 'Scheduling...'
                      : `Schedule Interviews (${selectedApplicantsForInterview.length})`}
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    <TrashBinIcon className="h-4 w-4" />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            )}

            <div className="w-full overflow-x-auto custom-scrollbar">
              <MaterialReactTable table={table} />
            </div>

            <BulkMessageModal
              isOpen={showBulkModal}
              onClose={() => setShowBulkModal(false)}
              recipients={selectedApplicantRecipients}
              companyId={selectedApplicantCompanyId}
              company={selectedApplicantCompany}
              onSuccess={() => {
                setRowSelection({});
                setShowBulkModal(false);
              }}
            />

            <StatusChangeModal
              isOpen={showBulkStatusModal}
              onClose={() => {
                setShowBulkStatusModal(false);
                setBulkStatusError('');
              }}
              statusForm={bulkStatusForm}
              setStatusForm={setBulkStatusForm}
              statusError={bulkStatusError}
              setStatusError={setBulkStatusError}
              handleStatusChange={handleBulkStatusChange}
              isSubmittingStatus={isSubmittingBulkStatus}
              companyId={selectedApplicantCompanyId ?? undefined}
            />

            <InterviewScheduleModal
              isOpen={showBulkInterviewModal}
              onClose={() => {
                setShowBulkInterviewModal(false);
                setBulkInterviewError('');
                resetBulkInterviewModal();
              }}
              formResetKey={bulkFormResetKey}
              interviewForm={bulkInterviewForm}
              setInterviewForm={setBulkInterviewForm}
              interviewError={bulkInterviewError}
              setInterviewError={setBulkInterviewError}
              handleInterviewSubmit={handleBulkInterviewSubmit}
              fillCompanyAddress={fillBulkCompanyAddress}
              notificationChannels={bulkNotificationChannels}
              setNotificationChannels={setBulkNotificationChannels}
              emailOption={bulkEmailOption}
              setEmailOption={setBulkEmailOption}
              customEmail={bulkCustomEmail}
              setCustomEmail={setBulkCustomEmail}
              phoneOption={bulkPhoneOption}
              setPhoneOption={setBulkPhoneOption}
              customPhone={bulkCustomPhone}
              setCustomPhone={setBulkCustomPhone}
              messageTemplate={bulkMessageTemplate}
              setMessageTemplate={setBulkMessageTemplate}
              interviewEmailSubject={bulkInterviewEmailSubject}
              setInterviewEmailSubject={setBulkInterviewEmailSubject}
              isSubmittingInterview={isSubmittingBulkInterview}
              setShowPreviewModal={setShowBulkPreviewFallbackModal}
              setPreviewHtml={setBulkPreviewHtml}
              buildInterviewEmailHtml={({ rawMessage }: any) =>
                `<html><body>${rawMessage}</body></html>`
              }
              getJobTitle={() => ({ en: '' })}
              companyData={selectedApplicantCompany || null}
              applicant={{
                fullName: '{{candidateName}}',
                company:
                  selectedApplicantCompany ||
                  (selectedApplicantCompanyId
                    ? { _id: selectedApplicantCompanyId }
                    : null),
                companyObj:
                  selectedApplicantCompany ||
                  (selectedApplicantCompanyId
                    ? { _id: selectedApplicantCompanyId }
                    : null),
              }}
              bulkMode
              bulkCount={selectedApplicantsForInterview.length}
              intervalMinutes={bulkInterviewIntervalMinutes}
              setIntervalMinutes={setBulkInterviewIntervalMinutes}
              onPreview={handlePreviewBulkInterviews}
              recipients={selectedApplicantsForInterview} // ADD THIS - passes the selected applicants
              jobTitleById={jobPositionMap} // ADD THIS - passes the job title mapping
            />

            <Modal
              isOpen={showBulkInterviewPreviewModal}
              onClose={() => setShowBulkInterviewPreviewModal(false)}
              className="max-w-5xl p-6"
            >
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Interview Email Preview ({bulkInterviewPreviewItems.length})
                </h2>
                <div className="max-h-[70vh] space-y-4 overflow-auto pr-1">
                  {bulkInterviewPreviewItems.map((item, index) => (
                    <div
                      key={`${item.applicantId}-${index}`}
                      className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                    >
                      <div className="mb-2 text-sm font-semibold text-gray-800 dark:text-white/90">
                        Applicant #{item.applicantNo} - {item.applicantName}
                      </div>
                      <div className="mb-3 text-xs text-gray-600 dark:text-gray-300">
                        <span className="mr-4">
                          To: {item.to || 'No email'}
                        </span>
                        <span>Scheduled: {item.scheduledLabel}</span>
                      </div>
                      <iframe
                        srcDoc={item.html}
                        title={`Interview Preview ${item.applicantId}`}
                        className="min-h-[360px] w-full rounded border-none bg-white"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowBulkInterviewPreviewModal(false)}
                    className="rounded-lg border border-stroke px-4 py-2 hover:bg-gray-100"
                  >
                    Close
                  </button>
                </div>
              </div>
            </Modal>

            <Modal
              isOpen={showBulkPreviewFallbackModal}
              onClose={() => setShowBulkPreviewFallbackModal(false)}
              className="max-w-3xl p-6"
            >
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Preview
                </h2>
                <div
                  className="border rounded p-2 bg-white dark:bg-gray-800"
                  style={{ maxHeight: '70vh', overflow: 'auto' }}
                >
                  <iframe
                    srcDoc={bulkPreviewHtml}
                    title="Bulk Interview Preview"
                    className="w-full min-h-[480px] rounded border-none"
                  />
                </div>
              </div>
            </Modal>
          </>
        </ComponentCard>
      </div>

      {previewPhoto && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] p-4">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg hover:bg-gray-100"
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

      <CustomFilterModal
        open={customFilterOpen}
        onClose={() => setCustomFilterOpen(false)}
        jobPositions={jobPositions}
        applicants={applicants}
        jobPositionMap={jobPositionMap}
        companies={allCompaniesRaw}
        customFilters={customFilters}
        setCustomFilters={setCustomFilters}
        columnFilters={columnFilters}
        setColumnFilters={setColumnFilters}
        genderOptions={genderOptions}
      />
    </ThemeProvider>
  );
}
