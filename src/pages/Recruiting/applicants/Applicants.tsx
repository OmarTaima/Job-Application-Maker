import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useDeferredValue,
} from 'react';
import { ChatIcon } from '../../../icons';
import { useStatusSettings } from '../../../utils/useStatusSettings';
import { useQueryClient } from '@tanstack/react-query';
import { sortApplicantsByDuplicatePriority } from '../../../utils/applicantDuplicateSort';
import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../../../config/axios';
import * as XLSX from 'xlsx';


type ApiMailResponse = {
  message: string;
  page: string;
  PageCount: number | null;
  TotalCount: number;
  data: Array<{ _id: string; applicant: string | null; [key: string]: any }>;
};

// simple in-memory cache for compressed thumbnails
const _thumbnailCache: Map<string, string> = new Map();

async function createCompressedDataUrl(
  src: string,
  maxBytes = 5120
): Promise<string> {
  if (!src) return src;
  if (_thumbnailCache.has(src)) return _thumbnailCache.get(src) as string;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    let resolved = false;

    const finish = (result: string) => {
      if (resolved) return;
      resolved = true;
      try {
        _thumbnailCache.set(src, result);
      } catch (e) {}
      resolve(result);
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(src);
        // scale down to a reasonable thumbnail size
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
              // toDataURL may throw on cross-origin images
              return null;
            }
          }
          return null;
        };

        let dataUrl = tryQualities([
          0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1,
        ]);
        if (dataUrl) return finish(dataUrl);

        // progressively downscale and retry
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
        // fallback to original src
        finish(src);
      } catch (e) {
        finish(src);
      }
    };

    img.onerror = () => finish(src);
    // attempt load; if the image is data: or same-origin, this will work. crossOrigin may still fail for some hosts.
    try {
      img.src = src;
    } catch (e) {
      finish(src);
    }
    // safety timeout: resolve with original after 1500ms
    setTimeout(() => finish(src), 1500);
  });
}

function ImageThumbnail({ src, alt }: { src?: string | null; alt?: string }) {
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
      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500 dark:text-gray-400">
        {alt && alt.charAt(0) ? alt.charAt(0).toUpperCase() : '-'}
      </div>
    );
  }

  return (
    <img
      loading="lazy"
      src={thumb}
      alt={alt || ''}
      className="h-full w-full object-cover"
    />
  );
}
import Swal from '../../../utils/swal';
import ApplicantsMobilePage from './ApplicantsMobilePage';
import { useNavigate } from 'react-router';
import {
  MaterialReactTable,
  MRT_SelectCheckbox,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_RowSelectionState,
  type MRT_ColumnFiltersState,
} from 'material-react-table';
import { ThemeProvider, createTheme } from '@mui/material';
import ComponentCard from '../../../components/common/ComponentCard';
import PageBreadcrumb from '../../../components/common/PageBreadCrumb';
import PageMeta from '../../../components/common/PageMeta';
import { Modal } from '../../../components/ui/modal';
import { TrashBinIcon } from '../../../icons';
import { useAuth } from '../../../context/AuthContext';
import {
  useApplicants,
  useJobPositions,
  useUpdateApplicantStatus,
  useCompanies,
  useScheduleBulkInterviews,
  useSendMessage,
  useBatchUpdateApplicantStatus
} from '../../../hooks/queries';
import BulkMessageModal from '../../../components/modals/BulkMessageModal';
import InterviewScheduleModal from '../../../components/modals/InterviewScheduleModal';
import StatusChangeModal from '../../../components/modals/StatusChangeModal';
import { Menu, MenuItem, Checkbox, ListItemText, Skeleton } from '@mui/material';
import useSendBatchEmail from '../../../hooks/queries/useSendBatchEmail';
import {
  normalizeLabelSimple,
  canonicalMap,
  getCanonicalType,
  buildFieldToJobIds,
  isExcludedLabel,
} from '../../../components/modals/CustomFilterModal';
import type { Applicant } from '../../../store/slices/applicantsSlice';
import { toPlainString } from '../../../utils/strings';
import { buildApplicantDuplicateLookup } from '../../../utils/applicantDuplicateSort';
import CustomFilterModal from '../../../components/modals/CustomFilterModal';
import { TableLayout } from '../../../services/authService';
import { useTableLayout } from '../../../hooks/queries/useTableLayout';

const APPLICANTS_DEFAULT_LAYOUT: TableLayout = {
  columnVisibility: {},
  columnSizing: {},
  columnOrder: [],
};

type ColumnFilterOption = {
  id: string;
  title: string;
};

type ColumnMultiSelectHeaderProps = {
  column: any;
  label: string;
  options: ColumnFilterOption[];
  isLaptopViewport: boolean;
  menuWidth?: number;
  menuMaxHeight?: number;
};

function ColumnMultiSelectHeader({
  column,
  label,
  options,
  isLaptopViewport,
  menuWidth = 220,
  menuMaxHeight = 280,
}: ColumnMultiSelectHeaderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const current = column.getFilterValue();

  // Add type check for current
  const selected: string[] = Array.isArray(current)
    ? current.map(String)
    : current 
      ? [String(current)]
      : [];

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    const arr = Array.from(next);
    column.setFilterValue(arr.length ? arr : undefined);
  };
  const clear = () => {
    column.setFilterValue(undefined);
    setAnchorEl(null);
  };

  const handleDropdownClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation(); // Stop propagation to prevent row click
    setAnchorEl(event.currentTarget);
  };

  // Handle label click for sorting
  const handleLabelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop propagation
    if (column.getCanSort()) {
      column.toggleSorting();
    }
  };

  const handleClose = () => setAnchorEl(null);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()} // Stop propagation on the container
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        {/* Make label clickable for sorting */}
        <span
          className="text-sm font-medium cursor-pointer select-none hover:text-brand-500"
          onClick={handleLabelClick}
        >
          {label}
          {/* Show sort indicator */}
          {column.getIsSorted() === 'asc' && ' ▲'}
          {column.getIsSorted() === 'desc' && ' ▼'}
        </span>

        <button
          type="button"
          onClick={handleDropdownClick}
          className={`inline-flex items-center gap-1 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 ${
            isLaptopViewport ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
          }`}
        >
          {selected.length ? `${selected.length}` : ''}
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none">
            <path
              d="M6 8l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          onClick={handleMenuClick} // Prevent propagation on menu clicks
          PaperProps={{
            style: { maxHeight: menuMaxHeight, width: menuWidth },
            onMouseDown: (e: any) => e.stopPropagation(),
            onClick: (e: any) => e.stopPropagation(),
          }}
        >
          <MenuItem onClick={(e) => { e.stopPropagation(); clear(); }} dense>
            Clear
          </MenuItem>
          {options.map((option) => (
            <MenuItem
              key={option.id}
              dense
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggle(option.id);
              }}
            >
              <Checkbox checked={selected.includes(option.id)} size="small" />
              <ListItemText primary={option.title} />
            </MenuItem>
          ))}
        </Menu>
      </div>
    </div>
  );
}

type ApplicantsProps = {
  layoutKey?: string;
  defaultLayout?: TableLayout;
  onlyStatus?: string | string[];
  companyIdOverride?: string | string[] | undefined;
};

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
    if (typeof maybeId._id === 'string' && maybeId._id.trim()) return maybeId._id.trim();
    if (typeof maybeId.id === 'string' && maybeId.id.trim()) return maybeId.id.trim();
  }
  return null;
};

const Applicants = ({ layoutKey, defaultLayout, onlyStatus, companyIdOverride }: ApplicantsProps = {}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { layout, saveLayout} = useTableLayout(
    layoutKey || 'applicants_table',
    defaultLayout || APPLICANTS_DEFAULT_LAYOUT
  );


  
  const isSuperAdmin = useMemo(() => {
    const roleName = user?.roleId?.name;
    return (
      typeof roleName === 'string' && roleName.toLowerCase() === 'super admin'
    );
  }, [user?.roleId?.name]);

  // Restore persisted table state (pagination, sorting, filters) from sessionStorage
  const persistedTableState = useMemo(() => {
    try {
      // prefer localStorage (persist across reloads) then fallback to sessionStorage
      const rawLocal = localStorage.getItem('applicants_table_state');
      if (rawLocal) return JSON.parse(rawLocal);
      const raw = sessionStorage.getItem('applicants_table_state');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }, []);

  // If this component is used as a fixed-status view (onlyStatus provided),
  // drop any persisted `status` column filter so the page isn't affected
  // by filters saved from other views.
  const initialColumnFilters = useMemo(() => {
    try {
      const persisted = persistedTableState?.columnFilters ?? [];
      if (!Array.isArray(persisted)) return persisted;
      if (onlyStatus !== undefined && onlyStatus !== null) {
        return persisted.filter((f: any) => f?.id !== 'status');
      }
      return persisted;
    } catch (e) {
      return persistedTableState?.columnFilters ?? [];
    }
  }, [persistedTableState, onlyStatus]);

  const openApplicantDetailsInNewTab = useCallback((row: any) => {
    try {
      const url = `${window.location.origin}/applicant-details/${row.id}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      // ignore
    }
  }, []);

  const currentUserId = useMemo(
    () => String((user as any)?._id || (user as any)?.id || ''),
    [user]
  );

  

  const getApplicantHref = useCallback((row: any) => {
    const orig: any = row?.original ?? row;
    const navId = String(orig?._id || orig?.id || row?.id || '');
    return `/applicant-details/${navId}`;
  }, []);

  const handleApplicantLinkClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, row: any) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      navigate(getApplicantHref(row), { state: { applicant: row.original } });
    },
    [getApplicantHref, navigate]
  );

  const handleApplicantLinkAuxClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.stopPropagation();
    },
    []
  );

  // Local state

  const [isDeleting, setIsDeleting] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showBulkInterviewModal, setShowBulkInterviewModal] = useState(false);
  const [showBulkInterviewPreviewModal, setShowBulkInterviewPreviewModal] =
    useState(false);
  const [bulkFormResetKey, setBulkFormResetKey] = useState(0);
  const [isSubmittingBulkInterview, setIsSubmittingBulkInterview] =
    useState(false);
  const [bulkInterviewError, setBulkInterviewError] = useState('');
  const [bulkInterviewIntervalMinutes, setBulkInterviewIntervalMinutes] =
    useState(15);
  const [bulkInterviewForm, setBulkInterviewForm] = useState({
    date: '',
    time: '',
    description: '',
    comment: '',
    location: '',
    link: '',
    type: 'phone' as 'phone' | 'video' | 'in-person',
  });
  const [bulkNotificationChannels, setBulkNotificationChannels] = useState({
    email: true,
    sms: false,
    whatsapp: false,
  });
  const [bulkEmailOption, setBulkEmailOption] = useState<'company' | 'new'>(
    'company'
  );
  const [bulkCustomEmail, setBulkCustomEmail] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const [bulkPhoneOption, setBulkPhoneOption] = useState<
    'company' | 'user' | 'whatsapp' | 'custom'
  >('company');
  const [bulkCustomPhone, setBulkCustomPhone] = useState('');
  const [bulkMessageTemplate, setBulkMessageTemplate] = useState('');
  const [bulkInterviewEmailSubject, setBulkInterviewEmailSubject] =
    useState('Interview Invitation');
  const [bulkPreviewHtml, setBulkPreviewHtml] = useState('');
  const [showBulkPreviewFallbackModal, setShowBulkPreviewFallbackModal] =
    useState(false);
  const [bulkInterviewPreviewItems, setBulkInterviewPreviewItems] = useState<
    Array<{
      applicantId: string;
      applicantName: string;
      applicantNo: string;
      to: string;
      companyId: string;
      jobPositionId?: string;
      scheduledAt: string;
      scheduledLabel: string;
      subject: string;
      html: string;
      status?: string;
    }>
  >([]);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatusForm, setBulkStatusForm] = useState<{
    status?: string;
    reasons?: string[];
    notes?: string;
  }>({ status: '', reasons: [], notes: '' });
  const [isSubmittingBulkStatus, setIsSubmittingBulkStatus] = useState(false);
  // MRT will manage pagination internally (page size set in initialState)
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    initialColumnFilters ?? []
  );
  // MRT sorting state (control sorting externally so we can offer only asc/desc for Submitted)
  const [sorting, setSorting] = useState<Array<any>>(
    [{ id: 'submittedAt', desc: true }]
  );
  // Pagination state persisted
const [pagination, setPagination] = useState(
  () => ({
    pageIndex: 0,
    pageSize: persistedTableState?.pagination?.pageSize ?? 10,
  })
);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1920
  );
  // Sorting will be managed by MRT (default newest-first)

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

  // Get selected applicant IDs from row selection
  const selectedApplicantIds = useMemo(() => {
    return Object.keys(rowSelection);
  }, [rowSelection]);

  // MRT will reset pagination when filters/sorting change internally
  // Memoize user-derived values
  const companyId = useMemo(() => {
    // If caller provided an override, prefer that
    if (companyIdOverride !== undefined) return companyIdOverride as any;
    if (!user) return undefined;

    const roleName = user?.roleId?.name?.toLowerCase();
    const isSuperAdmin = roleName === 'super admin';
    const usercompanyId = user?.companies?.map((c) =>
      typeof c.companyId === 'string' ? c.companyId : c.companyId._id
    );

    // Super Admin gets all companies (undefined means no filter)
    if (isSuperAdmin) return undefined;

    // Regular users get their assigned companies only
    return usercompanyId?.length ? usercompanyId : undefined;
  }, [companyIdOverride, user?._id, user?.roleId?.name, user?.companies]);

  // Determine whether to show the Company column: hide when user is assigned to a single company
  const showCompanyColumn = useMemo(() => {
    if (!companyId) return true; // super admin or no filter
    if (Array.isArray(companyId) && companyId.length === 1) return false;
    return true;
  }, [companyId]);

  const assignedCompanyIds = useMemo(() => {
  if (isSuperAdmin) return [];
  const fromCompanies = Array.isArray(user?.companies)
    ? user.companies.map((c: any) => extractId(c?.companyId))
    : [];
  const fromAssigned = Array.isArray(user?.assignedcompanyId) ? user.assignedcompanyId : [];
  return Array.from(new Set([...fromCompanies, ...fromAssigned])).filter(Boolean) as string[];
}, [user, isSuperAdmin]);

  // Use React Query hooks
  // Keep a full job-position map for the current user scope so MRT company/job
  // filters always resolve consistently even while filter values are changing.
  const jobPositionCompanyParam = companyId;
  const {
    data: jobPositions = [],
    refetch: refetchJobPositions,
    isFetching: isJobPositionsFetching,
    isFetched: isJobPositionsFetched,
  } = useJobPositions(jobPositionCompanyParam);
  const {
    data: applicants = [],
    error,
    refetch: refetchApplicants,
    isFetching: isApplicantsFetching,
    isFetched: isApplicantsFetched,
  } = useApplicants(companyId as any);
  // Load companies early so memos below can reference `allCompaniesRaw`
  const {
    data: allCompaniesRaw = [],
    refetch: refetchCompanies,
    isFetching: isCompaniesFetching,
    isFetched: isCompaniesFetched,
  } = useCompanies(companyId as any);

 const queryCompanyIds = useMemo(() => {
  if (!isSuperAdmin && assignedCompanyIds.length > 0) return assignedCompanyIds;
  return [] as string[];
}, [isSuperAdmin, assignedCompanyIds]);

const { data: mailApiResponse } = useQuery<ApiMailResponse>({
  queryKey: ['mail-logs', queryCompanyIds.join(',')],
  queryFn: async () => {
    const baseParams: Record<string, string> = { PageCount: 'all' };
    if (queryCompanyIds.length <= 1) {
      if (queryCompanyIds.length === 1) baseParams.company = queryCompanyIds[0];
      const res = await axiosInstance.get<ApiMailResponse>('/mail', { params: baseParams });
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
    responses.forEach((r) => (r.data?.data || []).forEach((m: any) => mergedMap.set(m._id, m)));
    const data = Array.from(mergedMap.values());
    return { message: 'success', page: 'all', PageCount: null, TotalCount: data.length, data };
  },
  staleTime: 5 * 60 * 1000,
  refetchInterval: 30 * 1000,
  refetchIntervalInBackground: true,
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




  const selectedApplicantRecipients = useMemo(() => {
    try {
      const ids = new Set(selectedApplicantIds);
      return applicants
        .filter((a: any) => {
          const id =
            typeof a._id === 'string' ? a._id : a._id?._id || a.id || a._id;
          return ids.has(id);
        })
        .map((a: any) => {
          const applicantId =
            typeof a._id === 'string' ? a._id : a._id?._id || a.id || undefined;
          const email = typeof a.email === 'string' ? a.email.trim() : '';
          let jobPositionId = a.jobPositionId || (a.jobPosition && typeof a.jobPosition === 'object' ? a.jobPosition._id : a.jobPosition);
          if (jobPositionId && typeof jobPositionId === 'object') {
            jobPositionId = jobPositionId._id || jobPositionId.id || String(jobPositionId);
          }
          const fullName = a.fullName || a.name || a.firstName || '';
          return { email, applicant: applicantId, jobPositionId: typeof jobPositionId === 'string' ? jobPositionId : undefined, applicantName: fullName };
        })
        .filter((item: any) => Boolean(item.email));
    } catch (e) {
      return [];
    }
  }, [selectedApplicantIds, applicants]);

  const batchUpdateStatusMutation = useBatchUpdateApplicantStatus();


  const selectedApplicantsForInterview = useMemo(() => {
    try {
      const ids = new Set(selectedApplicantIds);
      const mapped = applicants
        .filter((a: any) => {
          const id =
            typeof a._id === 'string' ? a._id : a._id?._id || a.id || a._id;
          return ids.has(id);
        })
        .map((a: any) => {
          const applicantId =
            typeof a._id === 'string' ? a._id : a._id?._id || a.id || '';
          let jobPositionId =
            a.jobPositionId ||
            (a.jobPosition && typeof a.jobPosition === 'object'
              ? a.jobPosition._id
              : a.jobPosition);
          if (jobPositionId && typeof jobPositionId === 'object') {
            jobPositionId =
              jobPositionId._id || jobPositionId.id || String(jobPositionId);
          }

          const companyRef =
            a.company ||
            a.companyObj ||
            (a.jobPositionId &&
              (a.jobPositionId.companyId ||
                a.jobPositionId.company ||
                a.jobPositionId.companyObj));
          const companyId = companyRef
            ? typeof companyRef === 'string'
              ? companyRef
              : companyRef._id || companyRef.id || ''
            : '';

          const applicantNoRaw =
            a.applicantNo ?? a.applicantNumber ?? a.no ?? a.number;
          const parsedApplicantNo = Number(applicantNoRaw);
          const applicantNo = Number.isFinite(parsedApplicantNo)
            ? parsedApplicantNo
            : null;

          return {
            applicantId: String(applicantId),
            applicantName:
              String(a.fullName || a.name || a.firstName || 'Candidate').trim(),
            email: String(a.email || '').trim(),
            applicantNo,
            jobPositionId:
              typeof jobPositionId === 'string' ? jobPositionId : undefined,
            companyId: String(companyId || ''),
            status: String(a.status || ''),
          };
        })
        .filter((item: any) => item.applicantId);

      mapped.sort((a: any, b: any) => {
        const noA = typeof a.applicantNo === 'number' ? a.applicantNo : Infinity;
        const noB = typeof b.applicantNo === 'number' ? b.applicantNo : Infinity;
        if (noA !== noB) return noA - noB;
        return String(a.applicantName).localeCompare(String(b.applicantName));
      });

      return mapped;
    } catch (e) {
      return [];
    }
  }, [selectedApplicantIds, applicants]);
  // If we already loaded companies, resolve the full company object for the selected applicants
  // If all selected applicants belong to the same company, provide that company id
  const selectedApplicantCompanyId = useMemo(() => {
    try {
      const ids = new Set(selectedApplicantIds);
      const companies = applicants
        .filter((a: any) => {
          const id =
            typeof a._id === 'string' ? a._id : a._id?._id || a.id || a._id;
          return ids.has(id);
        })
        .map((a: any) => {
          // possible company id fields
          const c =
            a.company ||
            a.companyObj ||
            (a.jobPositionId &&
              (a.jobPositionId.companyId ||
                a.jobPositionId.company ||
                a.jobPositionId.companyObj));
          if (!c) return null;
          return typeof c === 'string' ? c : c._id || c.id || null;
        })
        .filter(Boolean) as string[];
      const unique = Array.from(new Set(companies));
      return unique.length === 1 ? unique[0] : null;
    } catch (e) {
      return null;
    }
  }, [selectedApplicantIds, applicants]);

  // If we already loaded companies, resolve the full company object for the selected applicants
  const selectedApplicantCompany = useMemo(() => {
    try {
      if (!selectedApplicantCompanyId) return null;
      const found = (allCompaniesRaw || []).find(
        (c: any) =>
          c &&
          (c._id === selectedApplicantCompanyId ||
            c.id === selectedApplicantCompanyId)
      );
      return found || null;
    } catch (e) {
      return null;
    }
  }, [selectedApplicantCompanyId, allCompaniesRaw]);
  const updateStatusMutation = useUpdateApplicantStatus();
  const scheduleBulkInterviewsMutation = useScheduleBulkInterviews();
  const sendBatchEmailMutation = useSendBatchEmail();
  const sendMessageMutation = useSendMessage();
  // Mounted ref to avoid state updates after unmount
  const mountedRef = useRef(false);

  const [lastRefetch, setLastRefetch] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState<string | null>(null);
  // mark mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [bulkStatusError, setBulkStatusError] = useState('');
  const [bulkDeleteError, setBulkDeleteError] = useState('');

  useEffect(() => {
    if (
      !lastRefetch &&
      (isJobPositionsFetched || isApplicantsFetched || isCompaniesFetched)
    ) {
      if (mountedRef.current) setLastRefetch(new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJobPositionsFetched, isApplicantsFetched, isCompaniesFetched, lastRefetch]);

  

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
      if (!mountedRef.current) return;
      setElapsed(formatRelative(lastRefetch));
    };
    update();
    const id = setInterval(update, 30 * 1000);
    return () => clearInterval(id);
  }, [lastRefetch]);

  // Synchronously measure the button and set dropdown position when opening

  // Helper function to extract detailed error messages
  const getErrorMessage = (err: any): string => {
    if (
      err.response?.data?.details &&
      Array.isArray(err.response.data.details)
    ) {
      return err.response.data.details
        .map((detail: any) => {
          const field = detail.path?.[0] || '';
          const message = detail.message || '';
          return field ? `${field}: ${message}` : message;
        })
        .join(', ');
    }
    if (err.response?.data?.errors) {
      const {errors} = err.response.data;
      if (Array.isArray(errors)) {
        return errors.map((e: any) => e.msg || e.message).join(', ');
      }
      if (typeof errors === 'object') {
        return Object.entries(errors)
          .map(([field, msg]) => `${field}: ${msg}`)
          .join(', ');
      }
    }
    if (err.response?.data?.message) return err.response.data.message;
    if (err.message) return err.message;
    return 'An unexpected error occurred';
  };

  // Helpers to resolve and download CVs for applicants (copied logic from ApplicantData)
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
// Create axios instance with base URL and auth interceptor

  const downloadViaFetch = async (u: string, filename?: string) => {
    try {
      const res = await fetch(u, { mode: 'cors' });
      if (!res.ok) throw new Error('Network response not ok');
      const blob = await res.blob();
      const a = document.createElement('a');
      const blobUrl = URL.createObjectURL(blob);
      a.href = blobUrl;
      a.download = filename || u.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      return true;
    } catch (err) {
      return false;
    }
  };

  const resolveCvPath = (a: any): string | null => {
    // Deduplicated candidate keys to avoid redundant iterations
    const keys = [
      'cvFilePath',
      'resumePath',
      'cvUrl',
      'resumeUrl',
      'curriculumVitaePath',
    ] as const;

    for (const key of keys) {
      const value = a?.[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return null;
  };



  const downloadCvForApplicant = async (a: any) => {
    if (!a)
      return Swal.fire(
        'No CV',
        'No CV file available for this applicant',
        'info'
      );
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

    const cloudUrl = buildCloudinaryDownloadUrl(
      url || '',
      (a?.applicantNo || a?._id || '').toString()
    );
    if (cloudUrl) {
      window.open(cloudUrl, '_blank');
      return;
    }

    const ok = await downloadViaFetch(url || String(path), undefined);
    if (ok) return;
    window.open(url || String(path), '_blank');
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
    const getIdValue = (v: any) =>
      typeof v === 'string' ? v : (v?._id ?? v?.id);
    jobPositions.forEach((job: any) => {
      const ids = new Set<string>();
      const primary = getIdValue(job._id) || getIdValue(job.id);
      if (primary) ids.add(primary);
      // also add nested forms if present
      if (job._id && typeof job._id === 'object' && job._id._id)
        ids.add(job._id._id);
      if (job.id && typeof job.id === 'object' && job.id._id)
        ids.add(job.id._id);
      // index by all discovered ids
      ids.forEach((id) => {
        if (id) map[id] = job;
      });
    });
    return map;
  }, [jobPositions]);

  

  // Map normalized field keys -> set of jobPosition ids that declare that field
  const fieldToJobIds = useMemo(
    () => buildFieldToJobIds(jobPositions),
    [jobPositions]
  );

  // Final deduped list by normalized label (merge fields that differ by id but share the same label)

  // Normalize gender values: map Arabic variants to English buckets
  const normalizeGender = (raw: any) => {
    if (raw === null || raw === undefined) return '';
    const s = String(raw).trim();
    if (!s) return '';
    const lower = s.toLowerCase();
    const arabicMale = ['ذكر', 'ذكرً', 'ذَكر'];
    const arabicFemale = ['انثى', 'أنثى', 'انثي', 'انسه', 'أنسه', 'انثا'];
    if (arabicMale.includes(s) || arabicMale.includes(lower)) return 'Male';
    if (arabicFemale.includes(s) || arabicFemale.includes(lower))
      return 'Female';
    if (lower === 'male' || lower === 'm') return 'Male';
    if (lower === 'female' || lower === 'f') return 'Female';
    // fallback: title-case the original
    return s.charAt(0).toUpperCase() + s.slice(1);
  };



  
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

  // Keep columnFilters compatible with the current MRT column set and selected company/jobs.
  useEffect(() => {
    try {
      if (!Array.isArray(columnFilters)) return;

      const getId = (v: any) =>
        typeof v === 'string' ? v : (v?._id ?? v?.id ?? '');
      const toArray = (v: any): string[] => {
        if (Array.isArray(v)) return v.map(String).filter(Boolean);
        if (v === undefined || v === null || v === '') return [];
        return [String(v)];
      };

      let changed = false;
      let next = [...columnFilters] as any[];

      if (!showCompanyColumn) {
        const prevLen = next.length;
        next = next.filter((f: any) => f?.id !== 'companyId');
        if (next.length !== prevLen) changed = true;
      }

      const companyFilter = next.find((f: any) => f?.id === 'companyId');
      const selectedCompanyIds = new Set(toArray(companyFilter?.value));

      const jobFilterIndex = next.findIndex((f: any) => f?.id === 'jobPositionId');
      if (jobFilterIndex !== -1) {
        const current = next[jobFilterIndex];
        const currentJobIds = toArray(current?.value);

        const sanitizedJobIds =
          selectedCompanyIds.size === 0
            ? currentJobIds
            : currentJobIds.filter((jobId) => {
                const job = jobPositionMap[jobId];
                if (!job) return false;
                const companyRaw = job?.companyId || job?.company || job?.companyObj;
                const companyId = String(getId(companyRaw) || '');
                return companyId ? selectedCompanyIds.has(companyId) : false;
              });

        const uniqueJobIds = Array.from(new Set(sanitizedJobIds));

        if (uniqueJobIds.length === 0) {
          next.splice(jobFilterIndex, 1);
          changed = true;
        } else if (
          uniqueJobIds.length !== currentJobIds.length ||
          uniqueJobIds.some((v, i) => v !== currentJobIds[i])
        ) {
          next[jobFilterIndex] = { ...current, value: uniqueJobIds };
          changed = true;
        }
      }

      const compacted = next.filter((f: any) => {
        if (!f || !f.id) return false;
        if (Array.isArray(f.value)) return f.value.length > 0;
        return true;
      });
      if (compacted.length !== next.length) {
        next = compacted;
        changed = true;
      }

      if (!changed) return;

      setColumnFilters(next as MRT_ColumnFiltersState);

      try {
        const raw = sessionStorage.getItem('applicants_table_state');
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.columnFilters = next;
        const str = JSON.stringify(parsed);
        sessionStorage.setItem('applicants_table_state', str);
        try {
          localStorage.setItem('applicants_table_state', str);
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore
    }
  }, [columnFilters, showCompanyColumn, jobPositionMap]);

  // availableCustomFields was replaced by dedupedCustomFields; keep jobPositions dependency above

  // Custom filters configured via the modal (rehydrate from persisted table state)
  const [customFilters, setCustomFilters] = useState<Array<any>>(
    persistedTableState?.customFilters ?? []
  );
  useEffect(() => {
    try {
      (window as any).__app_customFilters = customFilters;
    } catch {}
  }, [customFilters]);

  // On mount, hydrate any persisted customFilters (covers SPA back-navigation)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('applicants_table_state');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.customFilters)) {
        setCustomFilters(parsed.customFilters);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Persist customFilters to sessionStorage immediately so navigation/back
  // restores current modal filter state even if the user didn't click Save.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('applicants_table_state');
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.customFilters = customFilters || [];
      const str = JSON.stringify(parsed);
      sessionStorage.setItem('applicants_table_state', str);
      try {
        localStorage.setItem('applicants_table_state', str);
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      // ignore
    }
  }, [customFilters]);

  // Listen for company settings changes and refresh the cache
useEffect(() => {
  if (!isSuperAdmin) return;
  
  // Create a subscription to query invalidation events
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event?.query?.queryKey?.[0] === 'company-settings') {
      // Company settings were updated, clear the cache
      
      // Force a re-render by updating a state
      setLastRefetch(new Date());
    }
  });
  
  return () => unsubscribe();
}, [queryClient, isSuperAdmin]);

  // Clear persisted localStorage state when navigating away from Applicants/ApplicantData pages
  useEffect(() => {
    return () => {
      // run after navigation completes so pathname reflects destination
      setTimeout(() => {
        try {
          const p = window.location.pathname || '';
          const inApplicantsPages =
            p.startsWith('/applicant-details') || p.startsWith('/applicants');
          if (!inApplicantsPages) {
            try {
              localStorage.removeItem('applicants_table_state');
            } catch (e) {
              /* ignore */
            }
            try {
              sessionStorage.removeItem('applicants_table_state');
            } catch (e) {
              /* ignore */
            }
          }
        } catch (e) {
          // ignore
        }
      }, 0);
    };
  }, []);
  const [customFilterOpen, setCustomFilterOpen] = useState(false);
  // Modal-local selected jobs for composing custom filters

  const companyOptions = useMemo(() => {
    return allCompanies
      .map((c: any) => {
        const id = typeof c._id === 'string' ? c._id : c._id?._id || '';
        const title = toPlainString(c?.name) || c?.title || '';
        return { id, title };
      })
      .filter((x) => x.id && x.title);
  }, [allCompanies]);

  

  // Get selected company from column filters
const selectedCompanyFilter = useMemo(() => {
  const companyFilter = columnFilters.find((f: any) => f.id === 'companyId');
  if (!companyFilter?.value) return null;
  
  const companyIds = Array.isArray(companyFilter.value) 
    ? companyFilter.value 
    : [companyFilter.value];
  
  return companyIds;
}, [columnFilters]);
const selectedCompanyForStatus = useMemo(() => {
  if (selectedCompanyFilter && selectedCompanyFilter.length === 1) {
    return allCompaniesRaw.find((c: any) => c._id === selectedCompanyFilter[0]);
  }
  return null;
}, [selectedCompanyFilter, allCompaniesRaw]);

// Get status settings for the selected company (if any)

  // Determine dataset to pass to MRT: by default exclude trashed applicants unless
  // the user explicitly filters for status === 'trashed'. This makes "All Statuses"
  // hide trashed rows while still allowing an explicit trashed view.
const displayedApplicants = useMemo(() => {
  // Start with applicants
  let filtered = applicants || [];
  
  // Apply company filter if present
  if (selectedCompanyFilter && selectedCompanyFilter.length > 0) {
    filtered = filtered.filter((applicant: Applicant) => {
      // Get applicant's company ID
      let applicantCompanyId = null;
      const rawCompany = (applicant as any)?.companyId;
      
      if (rawCompany) {
        applicantCompanyId = typeof rawCompany === 'string' 
          ? rawCompany 
          : (rawCompany as any)?._id || (rawCompany as any)?.id;
      } else {
        // Try to get from job position
        const jobId = typeof (applicant as any)?.jobPositionId === 'string' 
          ? (applicant as any).jobPositionId 
          : (applicant as any)?.jobPositionId?._id || (applicant as any)?.jobPositionId?.id;
        const job = jobPositionMap[jobId];
        const jobCompany = (job as any)?.companyId || (job as any)?.company;
        applicantCompanyId = typeof jobCompany === 'string' ? jobCompany : (jobCompany as any)?._id;
      }
      
      return applicantCompanyId && selectedCompanyFilter.includes(applicantCompanyId);
    });
  }
  
  // Apply status filter (if caller requested a fixed status view)
  if (onlyStatus !== undefined && onlyStatus !== null) {
    const allowed = Array.isArray(onlyStatus) ? onlyStatus : [onlyStatus];
    filtered = filtered.filter((a: Applicant) => allowed.includes(a.status));
    return filtered;
  }
  
  // Apply status column filter
  const statusFilter = columnFilters.find((f) => f.id === 'status');
  const statusVal = statusFilter?.value;

  // Super admin: allow viewing trashed when explicitly filtered
  if (isSuperAdmin) {
    if (statusVal === 'trashed') return filtered;
    if (Array.isArray(statusVal) && statusVal.length > 0) {
      return filtered.filter((a: Applicant) => statusVal.includes(a.status));
    }
    return filtered.filter((a: Applicant) => a.status !== 'trashed');
  }

  // Non-super-admin: never show trashed applicants regardless of filters
  if (Array.isArray(statusVal) && statusVal.length > 0) {
    const allowed = statusVal.filter((s: any) => s !== 'trashed');
    if (allowed.length === 0) {
      return filtered.filter((a: Applicant) => a.status !== 'trashed');
    }
    return filtered.filter(
      (a: Applicant) => allowed.includes(a.status) && a.status !== 'trashed'
    );
  }

  return filtered.filter((a: Applicant) => a.status !== 'trashed');
}, [applicants, columnFilters, isSuperAdmin, onlyStatus, selectedCompanyFilter, jobPositionMap]);


  const deferredDisplayedApplicants = useDeferredValue(displayedApplicants);

  const duplicatesOnlyEnabled = useMemo(
    () =>
      Array.isArray(customFilters) &&
      customFilters.some(
        (f: any) => f?.fieldId === '__duplicates_only' && f?.value === true
      ),
    [customFilters]
  );

  // Apply custom filters (from Filter Settings modal) on top of displayedApplicants
  // Helper to robustly read a custom response value for a given filter definition
  const getCustomResponseValue = (a: any, f: any) => {
    if (!a) return '';
    const responses = a.customResponses || a.customFieldResponses || {};
    // also consider top-level applicant properties (many imports store some fields at root)
    const top = a || {};

    const tryKey = (k: any) => {
      if (k === undefined || k === null) return undefined;
      if (typeof k !== 'string' && typeof k !== 'number') return undefined;
      const key = String(k);
      if (responses && Object.prototype.hasOwnProperty.call(responses, key))
        return responses[key];
      if (top && Object.prototype.hasOwnProperty.call(top, key))
        return top[key];
      return undefined;
    };

    // 1) try exact fieldId
    const byId = tryKey(f.fieldId);
    if (byId !== undefined) return byId;

    // 2) try explicit labels stored on the filter
    const byEn = tryKey(f.labelEn);
    if (byEn !== undefined) return byEn;
    const byAr = tryKey(f.labelAr);
    if (byAr !== undefined) return byAr;

    // 3) try common label key
    const byLabel = tryKey(f.label);
    if (byLabel !== undefined) return byLabel;

    // 4) fallback: search keys by normalized match (handles localized keys).
    // Also compare underscore/space variants so keys like "الحالة_العسكرية" match "الحالة العسكرية".
    const norm = (s: any) =>
      (s || '')
        .toString()
        .replace(/\u200E|\u200F/g, '')
        .replace(/[^\w\u0600-\u06FF\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    const rawTargets = [f.labelEn, f.labelAr, f.fieldId].filter(Boolean);
    const targetSet = new Set<string>();
    rawTargets.map(norm).forEach((t) => {
      if (!t) return;
      targetSet.add(t);
      targetSet.add(t.replace(/\s+/g, '_'));
      targetSet.add(t.replace(/_/g, ' '));
    });
    // If this filter maps to a canonical type, prefer matching only the allowed response keys
    const canonical = getCanonicalType(f);
    if (canonical && canonicalMap[canonical]) {
      const allowed = canonicalMap[canonical].map((s) =>
        normalizeLabelSimple(s)
      );
      for (const [k, v] of Object.entries(responses || {})) {
        try {
          const nk = normalizeLabelSimple(k);
          if (
            allowed.includes(nk) ||
            allowed.some((al) => nk.includes(al) || al.includes(nk))
          )
            return v;
        } catch (e) {
          // ignore
        }
      }
      // no matching key found for canonical field -> return empty
      return '';
    }
    // search both responses map and top-level applicant fields
    for (const [k, v] of Object.entries({
      ...(responses || {}),
      ...(top || {}),
    })) {
      const nk = norm(k);
      if (targetSet.has(nk)) return v;
      // also try underscore/space variants of the key
      if (targetSet.has(nk.replace(/\s+/g, '_'))) return v;
      if (targetSet.has(nk.replace(/_/g, ' '))) return v;
    }

    // 5) Heuristics for numeric/range fields: try to find a numeric candidate
    const matchesSalaryLabel =
      /salary|expected salary|الراتب|الراتب المتوقع|راتب/.test(
        ((f.label?.en || '') + ' ' + (f.label?.ar || ''))
          .toString()
          .toLowerCase()
      );
    if (f.type === 'range' || matchesSalaryLabel) {
      for (const v of Object.values({ ...(responses || {}), ...(top || {}) })) {
        // primitive number
        if (typeof v === 'number') return v;
        // string with digits (e.g., "5,000 SAR")
        if (typeof v === 'string' && /\d|[\u0660-\u0669\u06F0-\u06F9]/.test(v))
          return v;
        if (Array.isArray(v)) {
          const found = v.find(
            (it) =>
              typeof it === 'number' ||
              (typeof it === 'string' && /\d/.test(it))
          );
          if (found !== undefined) return found;
        }
        if (typeof v === 'object' && v !== null) {
          const candidateKeys = [
            'value',
            'val',
            'amount',
            'salary',
            'expectedSalary',
            'min',
            'max',
            'amountValue',
            'numeric',
            '0',
          ];
          for (const ck of candidateKeys) {
            if (Object.prototype.hasOwnProperty.call(v, ck)) {
              const cand = (v as any)[ck];
              if (
                cand !== undefined &&
                cand !== null &&
                (typeof cand === 'number' ||
                  (typeof cand === 'string' && /\d/.test(cand)))
              )
                return cand;
            }
          }
        }
      }
    }

    return '';
  };

  // Helper: normalize any raw response into an array of primitive strings for comparison
  const extractResponseItems = (raw: any): string[] => {
    if (raw === null || raw === undefined) return [];
    const pickFromObject = (o: any) => {
      if (o === null || o === undefined) return '';
      if (typeof o === 'number') return String(o);
      if (typeof o === 'string') return o;
      // common object shapes
      return (
        (o.id ??
          o._id ??
          o.value ??
          o.val ??
          o.en ??
          o.ar ??
          o.label ??
          o.name ??
          '') + ''
      );
    };

    if (Array.isArray(raw))
      return raw.map(pickFromObject).filter((s) => s !== '');
    if (typeof raw === 'object') {
      // If object is a map of keys -> values, try to return meaningful values
      // e.g., { value: '123' } or { id: 'x', label: 'Label' }
      const candidates: string[] = [];
      const prim = pickFromObject(raw);
      if (prim) candidates.push(prim);
      // include any primitive child values
      Object.entries(raw).forEach(([k, v]) => {
        if (v === null || v === undefined) return;
        if (typeof v === 'object') return;
        // If the value is a boolean true, include the key (e.g., { Exempted: true })
        if (typeof v === 'boolean') {
          if (v) candidates.push(String(k));
          return;
        }
        // include both the primitive value and the key so maps and keyed-boolean shapes match
        candidates.push(String(v));
        candidates.push(String(k));
      });
      return Array.from(new Set(candidates)).filter((s) => s !== '');
    }

    return [String(raw)];
  };

  const normalizeForCompare = (s: any) =>
    (s || '')
      .toString()
      .replace(/\u200E|\u200F/g, '')
      .trim()
      .toLowerCase();

  const expandForms = (s: string) => {
    const out = new Set<string>();
    if (!s) return [] as string[];
    out.add(s);
    out.add(s.replace(/\s+/g, '_'));
    out.add(s.replace(/_/g, ' '));
    return Array.from(out);
  };

const statusSettingsCompany = useMemo(() => {
  // First, check if there's a company filter applied in MRT
  if (selectedCompanyFilter && selectedCompanyFilter.length === 1) {
    // Use the single selected company for status colors
    return allCompaniesRaw.find((c: any) => c._id === selectedCompanyFilter[0]);
  }
  
  // For Super Admin with no company filter, we need to get the company from the applicants' data
  if (isSuperAdmin) {
    // Get unique companies from the currently displayed applicants
    const uniqueCompanyIds = new Set<string>();
    const displayedApplicantsList = displayedApplicants || [];
    
    for (const applicant of displayedApplicantsList) {
      let companyId: string | null = null;
      
      // Try to get company from applicant
      const rawCompany = (applicant as any)?.companyId || (applicant as any)?.company || (applicant as any)?.companyObj;
      if (rawCompany) {
        companyId = typeof rawCompany === 'string' ? rawCompany : (rawCompany as any)?._id || (rawCompany as any)?.id;
      } else {
        // Try to get from job position
        const jobId = typeof (applicant as any)?.jobPositionId === 'string' 
          ? (applicant as any).jobPositionId 
          : (applicant as any)?.jobPositionId?._id || (applicant as any)?.jobPositionId?.id;
        if (jobId && jobPositionMap[jobId]) {
          const job = jobPositionMap[jobId];
          const jobCompany = (job as any)?.companyId || (job as any)?.company;
          companyId = typeof jobCompany === 'string' ? jobCompany : (jobCompany as any)?._id;
        }
      }
      
      if (companyId) uniqueCompanyIds.add(companyId);
    }
    
    // If all displayed applicants belong to one company, use that company
    if (uniqueCompanyIds.size === 1) {
      const singleCompanyId = Array.from(uniqueCompanyIds)[0];
      return allCompaniesRaw.find((c: any) => c._id === singleCompanyId);
    }
    
    // For mixed companies, return null to handle colors per applicant
    return null;
  }
  
  // For non-super-admin (original logic)
  if (companyId && !Array.isArray(companyId) && typeof companyId === 'string') {
    return allCompaniesRaw.find((c: any) => c._id === companyId);
  }
  if (selectedApplicantCompanyId) {
    return allCompaniesRaw.find((c: any) => c._id === selectedApplicantCompanyId);
  }
  return allCompaniesRaw[0];
}, [companyId, selectedApplicantCompanyId, allCompaniesRaw, isSuperAdmin, displayedApplicants, jobPositionMap, selectedCompanyFilter]);



const { getColor, getTextColor, getDescription, statusOptions: statusOptionsFromSettings } = useStatusSettings(statusSettingsCompany);
const selectedCompanyStatusSettings = useStatusSettings(selectedCompanyForStatus);



const { statusOptions: selectedCompanyStatusOptions } = selectedCompanyStatusSettings;



const statusFilterOptions = useMemo<ColumnFilterOption[]>(() => {
  // Get status options from company settings
  let statusOptionsList: Array<{ value: string; label: string }> = [];
  
  // Priority 1: If a single company is selected in the filter, use that company's statuses
  if (selectedCompanyFilter && selectedCompanyFilter.length === 1 && selectedCompanyStatusOptions) {
    statusOptionsList = selectedCompanyStatusOptions;
  } 
  // Priority 2: Use the main statusSettingsCompany's statuses
  else if (statusOptionsFromSettings && statusOptionsFromSettings.length > 0) {
    statusOptionsList = statusOptionsFromSettings;
  }
  
  // Convert to ColumnFilterOption format
  if (statusOptionsList.length > 0) {
    return statusOptionsList.map((status: any) => ({
      id: status.value,
      title: status.label.charAt(0).toUpperCase() + status.label.slice(1),
    }));
  }
  
  // Fallback: get from applicants (original behavior)
  const uniqueStatuses = Array.from(new Set(applicants.map((a: any) => a?.status).filter(Boolean)));
  const defaultOrder = ['pending', 'approved', 'interview', 'interviewed', 'rejected', 'trashed'];
  const sorted = [...defaultOrder, ...uniqueStatuses.filter(s => !defaultOrder.includes(s))];
  return sorted.map((status) => ({
    id: status,
    title: status.charAt(0).toUpperCase() + status.slice(1),
  }));
}, [applicants, selectedCompanyFilter, selectedCompanyStatusOptions, statusOptionsFromSettings]);

const getStatusColor = useCallback((status: string) => {
  if (!status) {
    return { bg: '#F3F4F6', color: '#1F2937' };
  }
  
  // Debug log
  console.log('getStatusColor called with status:', status);
  console.log('selectedCompanyFilter:', selectedCompanyFilter);
  console.log('selectedCompanyForStatus:', selectedCompanyForStatus);
  console.log('selectedCompanyStatusSettings exists?', !!selectedCompanyStatusSettings);
  
  // Priority 1: If there's a single company selected in MRT filter, use THAT company's colors
  if (selectedCompanyFilter && selectedCompanyFilter.length === 1) {
    const bgColor = selectedCompanyStatusSettings.getColor(status);
    const textColor = selectedCompanyStatusSettings.getTextColor(status);
    console.log('Using selected company colors:', { bgColor, textColor });
    return { 
      bg: bgColor || '#F3F4F6', 
      color: textColor || '#1F2937' 
    };
  }
  
  // Priority 2: Fall back to the main statusSettingsCompany
  const bgColor = getColor(status);
  const textColor = getTextColor(status);
  console.log('Using fallback colors:', { bgColor, textColor });
  
  return { 
    bg: bgColor || '#F3F4F6', 
    color: textColor || '#1F2937' 
  };
}, [getColor, getTextColor, selectedCompanyFilter, selectedCompanyStatusSettings, selectedCompanyForStatus]);

// In Applicants component, add a useEffect to refetch company settings when the modal closes
// or when the page becomes visible again

useEffect(() => {
  if (!statusSettingsCompany) return;
  
  // Refetch status settings when the component mounts or when the company changes
  const refetch = async () => {
    try {
      // This will trigger the useStatusSettings hook to re-evaluate
      // by forcing a re-fetch of company settings
      await queryClient.invalidateQueries({ queryKey: ['company-settings', statusSettingsCompany?._id] });
    } catch (e) {
      // ignore
    }
  };
  
  refetch();
}, [statusSettingsCompany?._id, queryClient]);




 const filteredApplicants = useMemo(() => {
  const effectiveCustomFilters = Array.isArray(customFilters)
    ? customFilters.filter(
      (f: any) => f?.fieldId !== '__duplicates_only'
    )
    : [];

  const getApplicantCompanyId = (applicant: any) => {
    const rawCompany = applicant?.companyId || applicant?.company || applicant?.companyObj;
    if (rawCompany) {
      if (typeof rawCompany === 'string' || typeof rawCompany === 'number') {
        return String(rawCompany);
      }
      return String(rawCompany?._id || rawCompany?.id || '');
    }
    const rawJob = applicant?.jobPositionId;
    const jobId = typeof rawJob === 'string'
      ? rawJob
      : (rawJob?._id ?? rawJob?.id ?? '');
    const job = jobPositionMap[jobId];
    const jobCompany = job?.companyId || job?.company || job?.companyObj;
    if (!jobCompany) return undefined;
    if (typeof jobCompany === 'string' || typeof jobCompany === 'number') {
      return String(jobCompany);
    }
    return String(jobCompany?._id || jobCompany?.id || '');
  };

  
  const baseFiltered =
    effectiveCustomFilters.length === 0
      ? deferredDisplayedApplicants
      : deferredDisplayedApplicants.filter((a: any) => {
          try {
            for (const f of effectiveCustomFilters) {
              let raw = getCustomResponseValue(a, f);
              // Override for hardcoded personal-info filters that are not stored
              // as job custom fields.
              try {
                if (f.fieldId === '__gender') {
                  raw =
                    a?.gender ||
                    a?.customResponses?.gender ||
                    a?.customResponses?.['النوع'] ||
                    (a as any)['النوع'] ||
                    raw ||
                    '';
                }
                if (f.fieldId === '__birthdate') {
                  raw =
                    a?.birthdate ||
                    a?.dateOfBirth ||
                    a?.dob ||
                    a?.customResponses?.birthdate ||
                    a?.customResponses?.['تarih'] ||
                    a?.customResponses?.['تاريخ الميلاد'] ||
                    raw ||
                    '';
                }
                if (f.fieldId === '__has_cv') {
                  const hasTop = Boolean(
                    a?.resume ||
                    a?.cv ||
                    a?.attachments ||
                    a?.resumeUrl ||
                    a?.cvFilePath ||
                    a?.cvFile ||
                    a?.cvUrl ||
                    a?.resumeFilePath ||
                    a?.resumeFile ||
                    a?.cv_file_path ||
                    a?.cv_file ||
                    a?.cv_path
                  );
                  let has = hasTop;
                  try {
                    const resp = a?.customResponses || a?.customFieldResponses || {};
                    for (const [k, v] of Object.entries(resp || {})) {
                      const lk = String(k || '').toLowerCase();
                      if ((lk.includes('cv') ||
                        lk.includes('resume') ||
                        lk.includes('cvfile') ||
                        lk.includes('cv_file') ||
                        lk.includes('cvfilepath')) && v) {
                        has = true;
                        break;
                      }
                    }
                  } catch (e) {
                    // ignore
                  }
                  raw = has;
                }
              } catch (e) {
                // ignore overrides on error
              }

              // Only enforce job-based exclusion for engineering specialization
              // (fields that truly belong to a single job). All other custom filters
              // are evaluated across applicants regardless of jobPositionId.
              try {
                const canonical = getCanonicalType(f);
                if (canonical === 'engineering_specialization') {
                  const rawLabel = `${f.labelEn || f.label?.en || ''} ${f.labelAr || f.label?.ar || ''} ${f.fieldId || ''}`;
                  const keyNorm = normalizeLabelSimple(rawLabel) || String(f.fieldId || '');
                  const allowedUnion = new Set<string>();
                  const addSet = (s?: Set<string>) => {
                    if (!s) return;
                    s.forEach((x) => allowedUnion.add(String(x)));
                  };
                  addSet(fieldToJobIds[keyNorm]);
                  addSet(fieldToJobIds[String(f.fieldId || '')]);
                  try {
                    addSet(fieldToJobIds[canonical]);
                    (canonicalMap[canonical] || []).forEach((v) => {
                      const nk = normalizeLabelSimple(v);
                      if (nk) addSet(fieldToJobIds[nk]);
                    });
                  } catch (e) {
                    // ignore
                  }

                  // If this canonical field maps to a single job, exclude applicants
                  // whose jobPositionId isn't that job unless the applicant already
                  // contains a matching canonical response key.
                  if (allowedUnion.size === 1) {
                    const getId = (v: any) => typeof v === 'string' ? v : (v?._id ?? v?.id ?? '');
                    const applicantJobId = getId(a.jobPositionId);
                    try {
                      const topLevelKeys = Object.keys(a || {}).filter(
                        (k) => k !== 'customResponses' && k !== 'customFieldResponses' && k !== 'customFields'
                      );
                      const customRespKeys = Object.keys(a?.customResponses || {});
                      const customFieldRespKeys = Object.keys(a?.customFieldResponses || {});
                      const cfKeys = Object.keys(a?.customFields || {});
                      const allKeys = Array.from(new Set([...topLevelKeys, ...customRespKeys, ...customFieldRespKeys, ...cfKeys]));
                      const respKeys = allKeys.map((k) => normalizeLabelSimple(k));
                      const allowedLabels = canonicalMap[canonical].map((s) => normalizeLabelSimple(s));
                      const hasRespKeyMatch = respKeys.some((rk) =>
                        allowedLabels.some((al) => rk === al || rk.includes(al) || al.includes(rk))
                      );
                      if (!hasRespKeyMatch && (!applicantJobId || !allowedUnion.has(String(applicantJobId)))) {
                        return false;
                      }
                    } catch (e) {
                      if (!applicantJobId || !allowedUnion.has(String(applicantJobId))) {
                        return false;
                      }
                    }
                  }
                }
              } catch (e) {
                // ignore and continue
              }

              // Special: boolean presence filters (work experience, courses, personal skills)
              if (
                f.type === 'hasWorkExperience' ||
                f.type === 'hasField' ||
                f.type === 'hasCV' ||
                f.fieldId === '__has_cv'
              ) {
                const want = f.value; // true/false/'any'
                if (want === 'any' || want === undefined) continue;

                const evaluateHas = () => {
                  try {
                    if (f.type === 'hasWorkExperience') {
                      if (Array.isArray(a.workExperiences) && a.workExperiences.length) return true;
                      if (Array.isArray(a.experiences) && a.experiences.length) return true;
                      const resp = a?.customResponses || a?.customFieldResponses || {};
                      const keys = ['work_experience', 'workExperience', 'workexperience', 'الخبرة', 'خبرة'];
                      for (const k of keys) {
                        if (Object.prototype.hasOwnProperty.call(resp, k)) {
                          const v = resp[k];
                          if (v === true) return true;
                          if (Array.isArray(v) && v.length) return true;
                          if (typeof v === 'string' && v.trim()) return true;
                          if (typeof v === 'object' && Object.keys(v).length) return true;
                        }
                      }
                      for (const v of Object.values(resp)) {
                        if (Array.isArray(v) && v.length) return true;
                      }
                      return false;
                    }

                    // hardcoded CV presence filter
                    if (f.fieldId === '__has_cv' || f.type === 'hasCV') {
                      const hasTop = Boolean(
                        a?.resume ||
                        a?.cv ||
                        a?.attachments ||
                        a?.resumeUrl ||
                        a?.cvFilePath ||
                        a?.cvFile ||
                        a?.cvUrl ||
                        a?.resumeFilePath ||
                        a?.resumeFile ||
                        a?.cv_file_path ||
                        a?.cv_file ||
                        a?.cv_path
                      );
                      if (hasTop) return true;
                      try {
                        const resp = a?.customResponses || a?.customFieldResponses || {};
                        for (const [k, v] of Object.entries(resp || {})) {
                          const lk = String(k || '').toLowerCase();
                          if (lk.includes('cv') || lk.includes('resume') || lk.includes('cvfile') || lk.includes('cv_file') || lk.includes('cvfilepath')) {
                            if (v) return true;
                          }
                          if (typeof v === 'string' && /https?:\/\/.+\.(pdf|docx?|rtf|txt|zip)$/i.test(v)) return true;
                        }
                      } catch (e) {
                        // ignore
                      }
                      return false;
                    }

                    // generic hasField: consider getCustomResponseValue truthy -> has response
                    const rawVal = getCustomResponseValue(a, f);
                    if (rawVal === undefined || rawVal === null) return false;
                    if (rawVal === '') return false;
                    if (Array.isArray(rawVal)) return rawVal.length > 0;
                    if (typeof rawVal === 'object') return Object.keys(rawVal).length > 0;
                    if (typeof rawVal === 'string') return rawVal.trim().length > 0;
                    if (typeof rawVal === 'number') return true;
                    if (typeof rawVal === 'boolean') return rawVal === true;
                    return false;
                  } catch (e) {
                    return false;
                  }
                };

                const hasIt = evaluateHas();
                if ((want === true && !hasIt) || (want === false && hasIt)) {
                  return false;
                }
                continue;
              }

              // RANGE / NUMBER
              if (f.type === 'range') {
                // If this filter corresponds to a canonical salary field, prefer the
                // top-level applicant expected salary properties which are not
                // stored in customResponses/customFieldResponses.
                try {
                  const canonical = getCanonicalType(f);
                  if (canonical === 'salary') {
                    raw = a?.expectedSalary ?? a?.expected_salary ?? a?.expected ?? raw;
                  }
                } catch (e) {
                  // ignore
                }
                let num: number | null = null;
                if (raw === null || raw === undefined || raw === '') return false;
                const toNum = (v: any) => {
                  if (v === null || v === undefined) return NaN;
                  if (typeof v === 'number') return v;
                  const rawS = String(v);
                  // normalize Arabic-Indic and Extended-Indic digits to ASCII
                  const conv = (str: string) => {
                    const map: Record<string, string> = {
                      '\u0660': '0', '\u0661': '1', '\u0662': '2', '\u0663': '3', '\u0664': '4',
                      '\u0665': '5', '\u0666': '6', '\u0667': '7', '\u0668': '8', '\u0669': '9',
                      '\u06F0': '0', '\u06F1': '1', '\u06F2': '2', '\u06F3': '3', '\u06F4': '4',
                      '\u06F5': '5', '\u06F6': '6', '\u06F7': '7', '\u06F8': '8', '\u06F9': '9',
                    };
                    return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => map[ch] || ch);
                  };
                  const s = conv(rawS).replace(/[^0-9.\-]/g, '');
                  const p = Number(s);
                  return Number.isFinite(p) ? p : NaN;
                };
                if (typeof raw === 'number') num = raw;
                else if (typeof raw === 'string') {
                  const parsed = toNum(raw);
                  num = Number.isNaN(parsed) ? null : parsed;
                } else if (Array.isArray(raw)) {
                  const nums = raw.map(toNum).filter((n) => Number.isFinite(n));
                  if (nums.length) num = Math.max(...nums);
                  else num = null;
                } else if (typeof raw === 'object') {
                  const candKeys = ['max', 'value', 'val', 'amount', 'salary', 'expectedSalary', 'min', 'amountValue', 'numeric', '0'];
                  let found: number | null = null;
                  for (const ck of candKeys) {
                    if (Object.prototype.hasOwnProperty.call(raw, ck)) {
                      const c = toNum((raw as any)[ck]);
                      if (Number.isFinite(c)) {
                        found = found === null ? c : Math.max(found, c);
                      }
                    }
                  }
                  if (found === null) {
                    const children = Object.values(raw).map(toNum).filter((n) => Number.isFinite(n));
                    if (children.length) found = Math.max(...children);
                  }
                  num = found;
                } else num = null;
                if (num === null || !Number.isFinite(num)) {
                  return false;
                }
                const parseFilterNum = (v: any) => {
                  if (v === undefined || v === null || v === '') return undefined;
                  const s = String(v).replace(/[^0-9.\-]/g, '');
                  const p = Number(s);
                  return Number.isFinite(p) ? p : undefined;
                };
                const minFilter = parseFilterNum(f.value?.min);
                const maxFilter = parseFilterNum(f.value?.max);
                if (minFilter !== undefined && num < minFilter) {
                  return false;
                }
                if (maxFilter !== undefined && num > maxFilter) {
                  return false;
                }
                continue;
              }

              // MULTI / CHOICES
              if (f.type === 'multi') {
                const valsRaw = Array.isArray(f.value) ? f.value : (f.value !== undefined && f.value !== null ? [f.value] : []);
                const valsNormalized = valsRaw
                  .map((v: any) => normalizeForCompare(v && (v.id || v._id || v.en || v.ar) ? v.id || v._id || v.en || v.ar : v))
                  .filter((x: string) => x);
                if (!valsNormalized.length) continue;

                const valsExpandedSet = new Set<string>();
                valsNormalized.forEach((v: string) => expandForms(v).forEach((x) => valsExpandedSet.add(x)));

                const rawItems = extractResponseItems(raw).map(normalizeForCompare);

                let matched = false;
                try {
                  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
                    const rv = normalizeForCompare(raw);
                    if (rv && valsExpandedSet.has(rv)) matched = true;
                  }
                  if (!matched && Array.isArray(raw)) {
                    for (const el of raw) {
                      const v = normalizeForCompare(el);
                      if (v && valsExpandedSet.has(v)) {
                        matched = true;
                        break;
                      }
                    }
                  }
                  if (!matched && raw && typeof raw === 'object') {
                    for (const v of Object.values(raw)) {
                      const nv = normalizeForCompare(v);
                      if (nv && valsExpandedSet.has(nv)) {
                        matched = true;
                        break;
                      }
                    }
                    if (!matched) {
                      for (const [k, v] of Object.entries(raw)) {
                        if (v === true || v === 'true' || v === 1 || v === '1') {
                          const nk = normalizeForCompare(k);
                          if (nk && valsExpandedSet.has(nk)) {
                            matched = true;
                            break;
                          }
                        }
                      }
                    }
                  }
                } catch (e) {
                  // ignore
                }

                if (!matched && Array.isArray(f.choices) && f.choices.length) {
                  const choiceNormsForSelected = new Set<string>();
                  f.choices.forEach((c: any) => {
                    const forms = [c.id ?? c._id ?? c.en ?? c.ar ?? c.value ?? c.val ?? c.label ?? ''];
                    if (c.en) forms.push(c.en);
                    if (c.ar) forms.push(c.ar);
                    if (c.value) forms.push(c.value);
                    const formsNorm = Array.from(new Set(forms.map((fm: any) => normalizeForCompare(fm)).filter(Boolean)));
                    const expanded = formsNorm.flatMap((fn: string) => expandForms(fn));
                    if (expanded.some((fn: string) => valsExpandedSet.has(fn))) {
                      expanded.forEach((fn: string) => choiceNormsForSelected.add(fn));
                    }
                  });
                  if (choiceNormsForSelected.size) matched = rawItems.some((rv) => choiceNormsForSelected.has(rv));
                }

                if (!matched) return false;
                continue;
              }

              // TEXT / CONTAINS
              if (f.type === 'text') {
                const needle = normalizeForCompare(f.value || '');
                if (!needle) continue;
                const rawItems = extractResponseItems(raw).map(normalizeForCompare);
                let matched = rawItems.some((it) => it.includes(needle));
                if (!matched) {
                  try {
                    const canonical = getCanonicalType(f);
                    const allResp = a?.customResponses || a?.customFieldResponses || {};
                    if (canonical === 'engineering_specialization' && canonicalMap[canonical]) {
                      const allowed = canonicalMap[canonical].map((s) => normalizeLabelSimple(s));
                      for (const [k, v] of Object.entries(allResp)) {
                        const nk = normalizeLabelSimple(k);
                        if (!nk) continue;
                        if (!(allowed.includes(nk) || allowed.some((al) => nk.includes(al) || al.includes(nk)))) continue;
                        const items = extractResponseItems(v).map(normalizeForCompare);
                        if (items.some((it) => it.includes(needle))) {
                          matched = true;
                          break;
                        }
                      }
                    } else if (canonical && canonicalMap[canonical]) {
                      const allowed = canonicalMap[canonical].map((s) => normalizeLabelSimple(s));
                      for (const [k, v] of Object.entries(allResp)) {
                        const nk = normalizeLabelSimple(k);
                        if (!nk) continue;
                        if (!(allowed.includes(nk) || allowed.some((al) => nk.includes(al) || al.includes(nk)))) continue;
                        const items = extractResponseItems(v).map(normalizeForCompare);
                        if (items.some((it) => it.includes(needle))) {
                          matched = true;
                          break;
                        }
                      }
                    } else {
                      for (const v of Object.values(allResp)) {
                        const items = extractResponseItems(v).map(normalizeForCompare);
                        if (items.some((it) => it.includes(needle))) {
                          matched = true;
                          break;
                        }
                      }
                    }
                  } catch (e) {
                    // ignore
                  }
                }
                if (!matched) return false;
                continue;
              }

              // BIRTH YEAR filter (choose year and Before/After)
              if (f.type === 'birthYear') {
                const v = f.value || {};
                const selYear = Number(v.year);
                if (!selYear || !Number.isFinite(selYear)) continue;
                const mode = v.mode === 'before' ? 'before' : 'after';
                const rawItems = extractResponseItems(raw);
                const convDigits = (str: string) => {
                  const map: Record<string, string> = {
                    '\u0660': '0', '\u0661': '1', '\u0662': '2', '\u0663': '3', '\u0664': '4',
                    '\u0665': '5', '\u0666': '6', '\u0667': '7', '\u0668': '8', '\u0669': '9',
                    '\u06F0': '0', '\u06F1': '1', '\u06F2': '2', '\u06F3': '3', '\u06F4': '4',
                    '\u06F5': '5', '\u06F6': '6', '\u06F7': '7', '\u06F8': '8', '\u06F9': '9',
                  };
                  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => map[ch] || ch);
                };

                const extractYear = (r: any) => {
                  if (r === null || r === undefined) return null;
                  if (typeof r === 'number') {
                    const n = Math.floor(r);
                    if (n > 1900 && n < 2100) return n;
                    return null;
                  }
                  let s = String(r).trim();
                  if (!s) return null;
                  s = convDigits(s);
                  try {
                    const d = new Date(s);
                    if (!Number.isNaN(d.getTime())) return d.getFullYear();
                  } catch { /* ignore */ }
                  const m = s.match(/(19|20)\d{2}/);
                  if (m) return Number(m[0]);
                  return null;
                };

                const matched = rawItems.some((r) => {
                  const y = extractYear(r);
                  if (!y) return false;
                  if (mode === 'before') return y < selYear;
                  return y > selYear;
                });
                if (!matched) return false;
                continue;
              }

              // DATE equality (yyyy-mm-dd)
              if (f.type === 'date') {
                const target = f.value;
                if (!target) continue;
                const rawItems = extractResponseItems(raw);
                const matchFound = rawItems.some((r) => {
                  try {
                    const d = new Date(String(r));
                    if (Number.isNaN(d.getTime())) return false;
                    const iso = d.toISOString().slice(0, 10);
                    return iso === String(target);
                  } catch {
                    return false;
                  }
                });
                if (!matchFound) return false;
                continue;
              }
            }
            return true;
          } catch (e) {
            return false;
          }
        });

  if (!duplicatesOnlyEnabled) return baseFiltered;

  // Sort duplicates to group them together WITHOUT using applicant number
  const sortedApplicants = sortApplicantsByDuplicatePriority(
    baseFiltered as any[],
    currentUserId,
    (a, b) => {
      // Custom fallback comparator that sorts by something else, NOT applicant number
      // Sort by name instead of applicant number
      const nameA = String(a?.fullName || '').toLowerCase();
      const nameB = String(b?.fullName || '').toLowerCase();
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      
      // If names are the same, sort by ID to keep consistent ordering
      const idA = String(a?._id || a?.id || '');
      const idB = String(b?._id || b?.id || '');
      return idA.localeCompare(idB);
    },
    { getCompanyId: getApplicantCompanyId }
  );

  // Filter to only show duplicates
  const duplicateLookup = buildApplicantDuplicateLookup(
    baseFiltered as any[],
    currentUserId,
    { getCompanyId: getApplicantCompanyId }
  );

  const onlyDuplicates = sortedApplicants.filter((a: any) => {
    const id = String(a?._id || a?.id || '');
    return duplicateLookup.get(id)?.isDuplicate === true;
  });

  return onlyDuplicates;
}, [
  deferredDisplayedApplicants,
  customFilters,
  duplicatesOnlyEnabled,
  currentUserId,
  jobPositionMap,
  fieldToJobIds,
]);

  // Build gender filter options from the applicants dataset but apply only
  // the trashed-visibility rule (so options persist after refresh even when
  // columnFilters are restored from sessionStorage). Order Male/Female first.
  const genderOptions = useMemo(() => {
    const s = new Set<string>();
    const rows = Array.isArray(applicants) ? applicants : [];
    rows.forEach((a: any) => {
      // Respect trashed visibility for non-super-admins
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

  // Sanitize persisted column filters: if a gender filter was stored but the
  // available gender options don't include the stored values, remove/trim
  // the gender filter so the filter menu shows proper options after reload.
  useEffect(() => {
    try {
      const genderFilterIndex = columnFilters.findIndex(
        (f: any) => f.id === 'gender'
      );
      if (genderFilterIndex === -1) return;
      const current = columnFilters[genderFilterIndex];
      const vals = Array.isArray(current.value)
        ? current.value
        : current.value
          ? [current.value]
          : [];
      if (!vals.length) return;
      const optionIds = new Set(genderOptions.map((g) => g.id));
      const intersection = vals.filter((v: string) => optionIds.has(v));
      if (intersection.length === vals.length) return; // all valid
      // build new filters array with updated gender filter (or removed)
      const next = columnFilters.slice();
      if (intersection.length === 0) {
        next.splice(genderFilterIndex, 1);
      } else {
        next[genderFilterIndex] = {
          ...next[genderFilterIndex],
          value: intersection,
        };
      }
      setColumnFilters(next);
      // persist cleaned state immediately so page reloads start clean
      try {
        const raw = sessionStorage.getItem('applicants_table_state');
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.columnFilters = next;
        sessionStorage.setItem(
          'applicants_table_state',
          JSON.stringify(parsed)
        );
      } catch (e) {
        // ignore persistence errors
      }
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genderOptions]);

  // Create company lookup map
  const companyMap = useMemo(() => {
    const map: Record<string, any> = {};
    allCompanies.forEach((company: any) => {
      // Store by both possible ID formats
      const stringId =
        typeof company._id === 'string' ? company._id : company._id?._id;
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

  // MRT will handle pagination (we pass full dataset to the table)



const formatDate = useCallback((dateString: string) => {
  if (!dateString) return '-';
  // Parse as local date to avoid UTC offset shifting the date
  const date = new Date(dateString);
  // If it's a date-only string (no time component), parse manually to avoid UTC interpretation
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}, []);

  const parseComparableNumber = useCallback((value: any): number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

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
      return input.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => map[ch] || ch);
    };

    if (Array.isArray(value)) {
      const nums = value
        .map((item) => parseComparableNumber(item))
        .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
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
        .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));

      if (nums.length) return Math.max(...nums);

      const nestedNums = Object.values(value)
        .map((item) => parseComparableNumber(item))
        .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
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

  const resolveAnyId = useCallback((value: any): string => {
    if (!value) return '';
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'object') {
      const nested = value._id ?? value.id ?? value.jobSpecId ?? value.specId;
      if (nested === undefined || nested === null) return '';
      if (typeof nested === 'string' || typeof nested === 'number') {
        return String(nested);
      }
      return String((nested as any)?._id ?? (nested as any)?.id ?? '');
    }
    return '';
  }, []);

  const getExpectedSalaryDisplay = useCallback((applicant: any): string => {
    const toText = (value: any): string => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' || typeof value === 'number') {
        return String(value).trim();
      }
      if (Array.isArray(value)) {
        return value
          .map((item) => toText(item))
          .filter(Boolean)
          .join(', ')
          .trim();
        
      }
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
          '0',
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

    const responses = applicant?.customResponses || applicant?.customFieldResponses || {};
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

  const getApplicantSScore = useCallback(
    (applicant: any): number | null => {
      const parseAnswer = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value > 0;
        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          if (['true', '1', 'yes', 'y', 'accepted', 'met', 'pass', 'passed'].includes(normalized)) {
            return true;
          }
          if (['false', '0', 'no', 'n', 'rejected', 'failed', 'not met'].includes(normalized)) {
            return false;
          }
        }
        return Boolean(value);
      };

      const getApplicantSpecResponses = (): any[] => {
        if (Array.isArray(applicant?.jobSpecsWithDetails) && applicant.jobSpecsWithDetails.length) {
          return applicant.jobSpecsWithDetails;
        }
        if (Array.isArray(applicant?.jobSpecsResponses) && applicant.jobSpecsResponses.length) {
          return applicant.jobSpecsResponses;
        }
        if (Array.isArray(applicant?.jobSpecs) && applicant.jobSpecs.length) {
          return applicant.jobSpecs;
        }
        if (typeof applicant?.jobPositionId === 'object' && applicant.jobPositionId) {
          if (
            Array.isArray(applicant.jobPositionId.jobSpecsWithDetails) &&
            applicant.jobPositionId.jobSpecsWithDetails.length
          ) {
            return applicant.jobPositionId.jobSpecsWithDetails;
          }
          if (Array.isArray(applicant.jobPositionId.jobSpecsResponses) && applicant.jobPositionId.jobSpecsResponses.length) {
            return applicant.jobPositionId.jobSpecsResponses;
          }
          if (Array.isArray(applicant.jobPositionId.jobSpecs) && applicant.jobPositionId.jobSpecs.length) {
            return applicant.jobPositionId.jobSpecs;
          }
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

        if (source && Array.isArray(source.jobSpecsWithDetails) && source.jobSpecsWithDetails.length) {
          return source.jobSpecsWithDetails;
        }
        if (source && Array.isArray(source.jobSpecs) && source.jobSpecs.length) {
          return source.jobSpecs;
        }

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
          entry.answer ?? entry.accepted ?? entry.isAccepted ?? entry.met ?? entry.match ?? entry.selected;
        const answer = parseAnswer(answerRaw);
        [entry.jobSpecId, entry.specId, entry._id, entry.id]
          .map((id) => resolveAnyId(id))
          .filter(Boolean)
          .forEach((id) => {
            answerById[id] = answer;
          });
      });

      let totalWeight = 0;
      let acceptedWeight = 0;
      let totalCount = 0;
      let acceptedCount = 0;

      specs.forEach((spec: any, idx: number) => {
        totalCount += 1;

        const rawWeight = Number(spec?.weight ?? 0);
        const weight = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 0;
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
          const fallback = applicantResponses[idx];
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

      if (totalWeight > 0) {
        return Math.round((acceptedWeight / totalWeight) * 100);
      }
      if (totalCount > 0) {
        return Math.round((acceptedCount / totalCount) * 100);
      }
      return null;
    },
    [jobPositionMap, resolveAnyId]
  );

// Export selected applicants to Excel
const handleExportToExcel = useCallback(async () => {
  if (selectedApplicantIds.length === 0) {
    Swal.fire({
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
    // Get the selected applicants data
    const selectedApplicantsData = applicants.filter((a: any) => {
      const id = typeof a._id === 'string' ? a._id : a._id?._id || a.id || a._id;
      return selectedApplicantIds.includes(id);
    });

    // Helper function to format custom response values for display
    const formatCustomResponseValue = (value: any): string => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') {
        // Clean up HTML tags if present
        return value.replace(/<[^>]*>/g, '').trim();
      }
      if (typeof value === 'number') return String(value);
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      
      if (Array.isArray(value)) {
        if (value.length === 0) return '';
        
        // Check if it's an array of objects
        if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
          return value.map((item, index) => {
            const formatted = Object.entries(item)
              .map(([key, val]) => {
                const displayKey = key.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                let displayVal = val;
                if (typeof val === 'object' && val !== null) {
                  displayVal = JSON.stringify(val);
                } else if (typeof val === 'string') {
                  displayVal = val;
                }
                return `${displayKey}: ${displayVal}`;
              })
              .join(', ');
            return `${index + 1}. { ${formatted} }`;
          }).join('; ');
        }
        // Simple array
        return value.join(', ');
      }
      
      if (typeof value === 'object' && value !== null) {
        try {
          const formatted = Object.entries(value)
            .map(([key, val]) => {
              const displayKey = key.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              let displayVal = val;
              if (typeof val === 'object' && val !== null) {
                displayVal = JSON.stringify(val);
              }
              return `${displayKey}: ${displayVal}`;
            })
            .join(', ');
          return `{ ${formatted} }`;
        } catch (e) {
          return JSON.stringify(value);
        }
      }
      
      return String(value);
    };

    // Create a map of display key to original key (declare this FIRST)
    const customFieldKeyMap = new Map<string, string>();
    
    // Collect all unique custom field keys from all selected applicants
    const allCustomFieldKeys = new Set<string>();
    selectedApplicantsData.forEach((applicant: any) => {
      const customResponses = applicant.customResponses || applicant.customFieldResponses || {};
      Object.keys(customResponses).forEach(key => {
        // Format key for display (convert snake_case/camelCase to readable format)
        const displayKey = key
          .replace(/[_-]/g, ' ')
          .replace(/([A-Z])/g, ' $1')
          .replace(/\b\w/g, l => l.toUpperCase())
          .trim();
        allCustomFieldKeys.add(displayKey);
        // Also store original key mapping
        if (!customFieldKeyMap.has(displayKey)) {
          customFieldKeyMap.set(displayKey, key);
        }
      });
    });
    
    // Also collect job spec responses keys
    const allJobSpecKeys = new Set<string>();
    selectedApplicantsData.forEach((applicant: any) => {
      const jobSpecsResponses = applicant.jobSpecsResponses || [];
      jobSpecsResponses.forEach((spec: any) => {
        if (spec.spec) {
          const specText = typeof spec.spec === 'string' ? spec.spec : (spec.spec?.en || '');
          if (specText) allJobSpecKeys.add(specText);
        }
      });
    });

    // Prepare data for Excel export
    const exportData = selectedApplicantsData.map((applicant: any) => {
      // Base applicant information
      const baseData: any = {
        'Applicant No': applicant.applicantNo || applicant.applicantNumber || applicant.applicationNo || '-',
        'Full Name': applicant.fullName || '-',
        'Email': applicant.email || '-',
        'Phone': applicant.phone || '-',
        'Gender': (() => {
          const g = normalizeGender(
            applicant.gender ||
              applicant.customResponses?.gender ||
              applicant.customResponses?.['النوع'] ||
              (applicant as any)['النوع'] ||
              ''
          );
          return g || '-';
        })(),
        'Birth Date': (() => {
          const bd = applicant.birthDate ||
            applicant.birthdate ||
            applicant.customResponses?.birthdate ||
            applicant.customResponses?.birthDate ||
            applicant.customResponses?.['تاريخ_الميلاد'] ||
            applicant.customResponses?.['تاريخ الميلاد'];
          return bd ? new Date(bd).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
        })(),
        'Job Position': (() => {
          const raw = applicant.jobPositionId;
          const getId = (v: any) => {
            if (!v) return '';
            if (typeof v === 'string') return v;
            return v._id ?? v.id ?? '';
          };
          const jobId = getId(raw);
          const job = jobPositionMap[jobId];
          const title = typeof job?.title === 'string' ? job.title : (job?.title?.en || '');
          return title || '-';
        })(),
        'Company': (() => {
          const raw = applicant.jobPositionId;
          const getId = (v: any) => {
            if (!v) return '';
            if (typeof v === 'string') return v;
            return v._id ?? v.id ?? '';
          };
          const jobId = getId(raw);
          const job = jobPositionMap[jobId];
          const comp = job?.companyId ? getId(job.companyId) : '';
          const company = companyMap[comp];
          return toPlainString(company?.name) || company?.title || 'N/A';
        })(),
        'Expected Salary': getExpectedSalaryDisplay(applicant) || '-',
        'Score': (() => {
          const score = getApplicantSScore(applicant);
          return score !== null ? `${score}%` : '-';
        })(),
        'Status': applicant.status ? applicant.status.charAt(0).toUpperCase() + applicant.status.slice(1) : '-',
        'Submitted': applicant.submittedAt ? new Date(applicant.submittedAt).toLocaleDateString() : '-',
        'Address': applicant.address || '-',
      };

      // Add custom responses dynamically
      const customResponses = applicant.customResponses || applicant.customFieldResponses || {};
      Array.from(allCustomFieldKeys).forEach(displayKey => {
        const originalKey = customFieldKeyMap.get(displayKey) || displayKey;
        // Try to find the value using different key variations
        let value = customResponses[originalKey];
        if (value === undefined) {
          // Try alternative key formats
          const altKey1 = originalKey.toLowerCase().replace(/ /g, '_');
          const altKey2 = originalKey.toLowerCase().replace(/ /g, '');
          value = customResponses[altKey1] || customResponses[altKey2];
        }
        baseData[displayKey] = formatCustomResponseValue(value) || '-';
      });

      // Add job specifications responses dynamically
      const jobSpecsResponses = applicant.jobSpecsResponses || [];
      const jobSpecsMap = new Map();
      jobSpecsResponses.forEach((spec: any) => {
        const specText = typeof spec.spec === 'string' ? spec.spec : (spec.spec?.en || '');
        if (specText) {
          const answer = typeof spec.answer === 'boolean' ? (spec.answer ? 'Met' : 'Not Met') : (spec.answer || 'No');
          jobSpecsMap.set(specText, answer);
        }
      });

      Array.from(allJobSpecKeys).forEach(specText => {
        baseData[`[Spec] ${specText}`] = jobSpecsMap.get(specText) || 'Not Answered';
      });

      return baseData;
    });

    if (exportData.length === 0) {
      throw new Error('No data to export');
    }

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Auto-size columns
    const maxWidth = 60;
    const minWidth = 12;
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.min(maxWidth, Math.max(minWidth, key.length + 3, 
        Math.max(...exportData.map(row => String(row[key] || '').length)) + 2))
    }));
    worksheet['!cols'] = colWidths;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Selected Applicants');

    // Generate filename
    const date = new Date();
    const filename = `applicants_export_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${selectedApplicantIds.length}_applicants.xlsx`;

    // Download file
    XLSX.writeFile(workbook, filename);

    await Swal.fire({
      title: 'Export Successful!',
      text: `${selectedApplicantIds.length} applicant(s) exported to Excel.`,
      icon: 'success',
      position: 'center',
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (error) {
    console.error('Export error:', error);
    Swal.fire({
      title: 'Export Failed',
      text: error instanceof Error ? error.message : 'An error occurred while exporting data.',
      icon: 'error',
    });
  } finally {
    setIsExporting(false);
  }
}, [selectedApplicantIds, applicants, jobPositionMap, companyMap, getExpectedSalaryDisplay, getApplicantSScore, normalizeGender]);
  const getSelectedCompanyAddress = () => {
    const c: any = selectedApplicantCompany || {};
    const isInvalidAddressString = (value: string) => {
      const s = String(value || '').trim();
      if (!s) return true;
      if (/^[a-f0-9]{24}$/i.test(s)) return true;
      if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) return true;
      return false;
    };
    const candidates = [
      c.address,
      c.location,
      c.officeAddress,
      c.contactAddress,
      c.settings?.address,
      c.settings?.companyAddress,
    ];

    for (const value of candidates) {
      const plain = toPlainString(value);
      if (plain && plain.trim() && !isInvalidAddressString(plain)) {
        return plain.trim();
      }
    }

    for (const [key, value] of Object.entries(c)) {
      if (!/address|location/i.test(key)) continue;
      const plain = toPlainString(value);
      if (plain && plain.trim() && !isInvalidAddressString(plain)) {
        return plain.trim();
      }
    }

    return '';
  };

  const getDefaultBulkInterviewTemplate = () => {
    return (
      '<p>Dear {{candidateName}},</p>' +
      '<p>We are pleased to invite you for an interview for the position you applied for {{jobtitle}}.</p>' +
      '<p><strong>Interview Details:</strong></p>' +
      '<p>Date: {{interviewDate}}</p>' +
      '<p>Time: {{interviewTime}}</p>' +
      '<p>Type: {{interviewType}}</p>' +
      '<p>Location: {{interviewLocation}}</p>' +
      '<p>Video Link: {{interviewLink}}</p>' +
      '<p>Description: {{interviewDescription}}</p>' +
      '<p>Comment: {{interviewComment}}</p>' +
      '<p>Please confirm your availability at your earliest convenience.</p>' +
      '<p>Best regards,<br/>HR Team</p>'
    );
  };

  const inlineStyleHtml = (html: string) => {
    if (!html) return '';
    let out = String(html);
    out = out.replace(/<p\b([^>]*)>/g, (match, attrs) =>
      attrs.includes('style=')
        ? match
        : `<p style="margin:0 0 12px;color:#444;"${attrs}>`
    );
    out = out.replace(/<ul\b([^>]*)>/g, (match, attrs) =>
      attrs.includes('style=')
        ? match
        : `<ul style="margin:0 0 12px 18px;padding-left:18px;"${attrs}>`
    );
    out = out.replace(/<ol\b([^>]*)>/g, (match, attrs) =>
      attrs.includes('style=')
        ? match
        : `<ol style="margin:0 0 12px 18px;padding-left:18px;"${attrs}>`
    );
    out = out.replace(/<li\b([^>]*)>/g, (match, attrs) =>
      attrs.includes('style=')
        ? match
        : `<li style="margin-bottom:6px;"${attrs}>`
    );
    return out;
  };

  const escapeHtml = (value: string) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

// In the Applicants component, update the buildInterviewEmailHtml function (around line 1370)
// In the Applicants component, update the buildInterviewEmailHtml function (around line 1370)
const buildInterviewEmailHtml = (subject: string, rawBody: string, replacements?: Record<string, string>) => {
  // Create a case-insensitive replacement function
  const applyReplacements = (text: string): string => {
    if (!text || !replacements) return text;
    
    let result = text;
    Object.entries(replacements).forEach(([token, value]) => {
      // Create case-insensitive regex for each token
      // Escape special regex characters in the token (like { and })
      const escapedToken = token.replace(/[{}]/g, '\\$&');
      const regex = new RegExp(escapedToken, 'gi');
      result = result.replace(regex, value);
    });
    return result;
  };
  
  // Function to convert URLs to clickable links
  const convertUrlsToLinks = (text: string): string => {
    // Don't process if already HTML
    if (text.indexOf('<') !== -1) {
      // For HTML content, convert URLs within text nodes
      // This regex matches URLs that are not already inside an <a> tag
      const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)(?![^<]*<\/a>)/gi;
      return text.replace(urlRegex, (url) => {
        let href = url;
        if (!href.startsWith('http://') && !href.startsWith('https://')) {
          href = 'https://' + href;
        }
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${escapeHtml(url)}</a>`;
      });
    }
    
    // For plain text, convert all URLs
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    return text.replace(urlRegex, (url) => {
      let href = url;
      if (!href.startsWith('http://') && !href.startsWith('https://')) {
        href = 'https://' + href;
      }
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${escapeHtml(url)}</a>`;
    });
  };
  
  // Also convert specific location patterns
  const formatLocationLinks = (text: string): string => {
  const locationPattern = /(Location:\s*)(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  return text.replace(locationPattern, (_, locationLabel, url) => {
    let href = url;
    if (!href.startsWith('http://') && !href.startsWith('https://')) {
      href = 'https://' + href;
    }
    return `${locationLabel}<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${escapeHtml(url)}</a>`;
  });
};
  
  // Apply substitutions to subject
  let processedSubject = applyReplacements(subject);
  
  // Apply substitutions to body
  let processedBody = applyReplacements(rawBody);
  
  // Apply URL conversion to make links clickable
  let processedBodyWithLinks = formatLocationLinks(processedBody);
  processedBodyWithLinks = convertUrlsToLinks(processedBodyWithLinks);
  
  const body = String(processedBodyWithLinks || '').trim();
  const hasHtmlTags = /<[^>]+>/.test(body);
  const normalizedBody = hasHtmlTags
    ? inlineStyleHtml(body)
    : String(body)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map(
          (line) =>
            `<p style="margin:0 0 12px;color:#444;">${line}</p>`
        )
        .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(processedSubject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; background-color: #f5f5f5; margin:0; padding:0; }
    .container { max-width:600px; margin:24px auto; background:#fff; border-radius:8px; overflow:hidden; }
    .header { padding:24px 30px; background:#fff; border-bottom:1px solid #e5e7eb; text-align:center; }
    .header h1 { color:#111827; margin:0; font-size:20px; font-weight:700; }
    .content { padding:28px 30px; color:#222; }
    .footer { padding:18px 30px; color:#999; font-size:12px; text-align:center; }
    a { color: #3b82f6 !important; text-decoration: underline !important; }
    a:hover { color: #2563eb !important; text-decoration: underline !important; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${escapeHtml(processedSubject)}</h1></div>
      <div class="content">
      <div style="margin-top:12px;margin-bottom:18px;">${normalizedBody}</div>
    </div>
  </div>
</body>
</html>`;
};



const buildBulkInterviewPreview = () => {
  if (selectedApplicantsForInterview.length === 0) {
    return { error: 'Please select at least one applicant.', items: [] as any[] };
  }
  if (!bulkInterviewForm.date || !bulkInterviewForm.time) {
    // Don't block preview if date/time missing, but show placeholder
  }

  // Create date in local timezone without UTC conversion
  let baseDate: Date;
  let scheduledDateValid = false;
  
  if (bulkInterviewForm.date && bulkInterviewForm.time) {
    const [year, month, day] = bulkInterviewForm.date.split('-').map(Number);
    const [hours, minutes] = bulkInterviewForm.time.split(':').map(Number);
    // Create date using local time constructor (not UTC)
    baseDate = new Date(year, month - 1, day, hours, minutes);
    scheduledDateValid = !isNaN(baseDate.getTime());
  } else {
    baseDate = new Date();
    scheduledDateValid = false;
  }
  
  if (!scheduledDateValid) {
    return { error: 'Invalid interview date/time.', items: [] as any[] };
  }

  const interval = Math.max(1, Number(bulkInterviewIntervalMinutes) || 1);
  const typeLabel = String(bulkInterviewForm.type || 'phone')
    .charAt(0)
    .toUpperCase() + String(bulkInterviewForm.type || 'phone').slice(1);
  const sourceSubject =
    String(bulkInterviewEmailSubject || '').trim() || 'Interview Invitation';
  const sourceTemplate =
    String(bulkMessageTemplate || '').trim() || getDefaultBulkInterviewTemplate();

  const items = selectedApplicantsForInterview.map((candidate: { applicantId: string; applicantName: string; applicantNo: number | null; email: string; companyId: string; jobPositionId?: string; status: string }, index: number) => {
    // Calculate scheduled time using local time arithmetic
    const scheduled = new Date(baseDate.getTime() + index * interval * 60000);
    
    // FIXED: Format date manually to avoid timezone issues
    const interviewDate = (() => {
      const year = scheduled.getFullYear();
      const month = scheduled.getMonth();
      const day = scheduled.getDate();
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `${days[day]}, ${months[month]} ${day}, ${year}`;
    })();
    
    // Format time in 12-hour format
    const interviewTime = scheduled.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Build ISO-like string without timezone offset (preserve local time)
    const year = scheduled.getFullYear();
    const month = String(scheduled.getMonth() + 1).padStart(2, '0');
    const day = String(scheduled.getDate()).padStart(2, '0');
    const hours = String(scheduled.getHours()).padStart(2, '0');
    const minutes = String(scheduled.getMinutes()).padStart(2, '0');
    const scheduledAt = `${year}-${month}-${day}T${hours}:${minutes}:00`;

    // Get job title from jobPositionId
    const jobTitle = (() => {
      if (!candidate.jobPositionId) return '';
      const job = jobPositionMap[candidate.jobPositionId];
      if (!job) return '';
      return typeof job.title === 'string' ? job.title : (job.title?.en || '');
    })();

    const replacements: Record<string, string> = {
      '{{candidateName}}': candidate.applicantName || 'Candidate',
      '{{candidatename}}': candidate.applicantName || 'Candidate',
      '{{jobTitle}}': jobTitle || '[Position]',
      '{{jobtitle}}': jobTitle || '[Position]',
      '{{applicantNo}}':
        typeof candidate.applicantNo === 'number'
          ? String(candidate.applicantNo)
          : '-',
      '{{interviewDate}}': interviewDate,
      '{{interviewTime}}': interviewTime,
      '{{interviewType}}': typeLabel,
      '{{interviewLocation}}': String(
        bulkInterviewForm.location || '[Location]'
      ),
      '{{interviewLink}}': String(bulkInterviewForm.link || ''),
      '{{interviewDescription}}': String(bulkInterviewForm.description || ''),
      '{{interviewComment}}': String(bulkInterviewForm.comment || ''),
    };

    // Apply substitutions to subject
    let processedSubject = sourceSubject;
    Object.entries(replacements).forEach(([token, value]) => {
      const regex = new RegExp(token.replace(/[{}]/g, '\\$&'), 'gi');
      processedSubject = processedSubject.replace(regex, value);
    });

    let messageBody = sourceTemplate;
    Object.entries(replacements).forEach(([token, value]) => {
      const regex = new RegExp(token.replace(/[{}]/g, '\\$&'), 'gi');
      messageBody = messageBody.replace(regex, value);
    });

    const html = buildInterviewEmailHtml(processedSubject, messageBody, replacements);

    return {
      applicantId: candidate.applicantId,
      applicantName: candidate.applicantName,
      applicantNo:
        typeof candidate.applicantNo === 'number'
          ? String(candidate.applicantNo)
          : '-',
      to: candidate.email || '',
      companyId: candidate.companyId || selectedApplicantCompanyId || '',
      jobPositionId: candidate.jobPositionId,
      scheduledAt,
      scheduledLabel: `${interviewDate} at ${interviewTime}`,
      subject: processedSubject,
      html,
      status: candidate.status,
    };
  });

  return { error: '', items };
};

  const handlePreviewBulkInterviews = () => {
    setBulkInterviewError('');
    const built = buildBulkInterviewPreview();
    if (built.error) {
      setBulkInterviewError(built.error);
      return;
    }
    setBulkInterviewPreviewItems(built.items as any);
    setShowBulkInterviewPreviewModal(true);
  };

  const fillBulkCompanyAddress = () => {
    const address = getSelectedCompanyAddress();
    if (!address) return false;
    setBulkInterviewForm((prev) => ({ ...prev, location: address }));
    return true;
  };

  const resetBulkInterviewModal = () => {
    setBulkInterviewError('');
    setBulkInterviewIntervalMinutes(15);
    setBulkInterviewForm({
      date: '',
      time: '',
      description: '',
      comment: '',
      location: getSelectedCompanyAddress(),
      link: '',
      type: 'phone',
    });
    setBulkNotificationChannels({ email: true, sms: false, whatsapp: false });
    setBulkEmailOption('company');
    setBulkCustomEmail('');
    setBulkPhoneOption('company');
    setBulkCustomPhone('');
    setBulkInterviewEmailSubject('Interview Invitation');
    setBulkMessageTemplate(getDefaultBulkInterviewTemplate());
    setBulkInterviewPreviewItems([]);
    setShowBulkInterviewPreviewModal(false);
    setBulkFormResetKey((prev) => prev + 1);
  };

  const openBulkInterviewModal = async () => {
    if (selectedApplicantsForInterview.length === 0) return;

    if (!selectedApplicantCompanyId) {
      await Swal.fire({
        title: 'Single Company Required',
        text: 'Please select applicants from one company to schedule interviews together.',
        icon: 'warning',
      });
      return;
    }

    resetBulkInterviewModal();
    setShowBulkInterviewModal(true);
  };

  const handleBulkInterviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkInterviewError('');

    const built = buildBulkInterviewPreview();
    if (built.error) {
      setBulkInterviewError(built.error);
      return;
    }

    const previewItems = built.items;
    const missingEmails = previewItems.filter((item: any) => !item.to);

    const fallbackFromEmail =
      String(
        (selectedApplicantCompany as any)?.settings?.mailSettings?.defaultMail ||
          (selectedApplicantCompany as any)?.mailSettings?.defaultMail ||
          (selectedApplicantCompany as any)?.contactEmail ||
          (selectedApplicantCompany as any)?.email ||
          ''
      ).trim() || '';
    const fromEmail = String(bulkCustomEmail || fallbackFromEmail || '').trim();

    let shouldSendEmail = Boolean(bulkNotificationChannels.email);
    let emailResultNote = '';

    if (shouldSendEmail && !fromEmail) {
      shouldSendEmail = false;
      emailResultNote =
        'Email sending was skipped because no sender address is configured.';
    }

    if (shouldSendEmail && !selectedApplicantCompanyId) {
      shouldSendEmail = false;
      emailResultNote =
        'Email sending was skipped because selected applicants are not from one company.';
    }

    const emailableItems = previewItems.filter((item: any) => Boolean(item.to));
    if (shouldSendEmail && emailableItems.length === 0) {
      shouldSendEmail = false;
      emailResultNote =
        'Email sending was skipped because selected applicants do not have email addresses.';
    }

    try {
      setIsSubmittingBulkInterview(true);

      const bulkInterviewPayload = previewItems.map((item: any) => ({
        applicantId: item.applicantId,
        scheduledAt: item.scheduledAt,
        conductedBy: undefined,
        description: bulkInterviewForm.description || undefined,
        type: bulkInterviewForm.type || undefined,
        location: bulkInterviewForm.location || undefined,
        address: bulkInterviewForm.location || undefined,
        videoLink: bulkInterviewForm.link || undefined,
        notes: bulkInterviewForm.comment || undefined,
        status: 'scheduled',
      }));

      await scheduleBulkInterviewsMutation.mutateAsync(bulkInterviewPayload);

      previewItems.forEach((item: any) => {
        if (item.status !== 'interview') {
          updateStatusMutation.mutate({
            id: item.applicantId,
            data: {
              status: 'interview' as any,
              notes: `Status updated to interview on ${new Date().toLocaleDateString()} (bulk interview scheduling)`,
            },
          });
        }
      });

      if (shouldSendEmail) {
        const batch = emailableItems.map((item: any) => ({
          to: item.to,
          from: fromEmail,
          subject: item.subject,
          html: item.html,
          applicant: item.applicantId,
          jobPosition: item.jobPositionId,
        }));

        await sendBatchEmailMutation.mutateAsync({
          company: String(selectedApplicantCompanyId),
          batch,
        });

        // Persist each sent email into applicant message history
        try {
          await Promise.allSettled(
            emailableItems.map((item: any) =>
              sendMessageMutation.mutateAsync({
                id: item.applicantId,
                data: {
                  type: 'email',
                  content: item.html,
                },
              })
            )
          );
        } catch (e) {
          // best-effort: don't fail the whole flow if saving messages fails
          console.warn('Failed to save some interview messages to history', e);
        }

        if (missingEmails.length > 0) {
          emailResultNote = `Email sent to ${emailableItems.length} applicant(s); ${missingEmails.length} without email were skipped.`;
        }
      }

      const successMessageBase = `Interviews scheduled for ${previewItems.length} applicant(s).`;
      const successText = emailResultNote
        ? `${successMessageBase} ${emailResultNote}`
        : successMessageBase;

      await Swal.fire({
        title: 'Success!',
        text: successText,
        icon: 'success',
        position: 'center',
        timer: 2000,
        showConfirmButton: false,
      });

      if (mountedRef.current) {
        setRowSelection({});
        setShowBulkInterviewModal(false);
        setShowBulkInterviewPreviewModal(false);
        resetBulkInterviewModal();
      }

      try {
        await refetchApplicants();
      } catch (err) {
        // ignore refresh errors after successful scheduling
      }
    } catch (err: any) {
      console.error('Error scheduling bulk interviews:', err);
      setBulkInterviewError(getErrorMessage(err));
    } finally {
      if (mountedRef.current) setIsSubmittingBulkInterview(false);
    }
  };

  const handleBulkChangeStatus = useCallback(async () => {
    if (selectedApplicantIds.length === 0 || !bulkAction) return;
void handleBulkChangeStatus();
    // For rejected status we open the StatusChangeModal to collect reasons/notes
    if (bulkAction === 'rejected') {
      setBulkStatusForm({ status: 'rejected', reasons: [], notes: '' });
      setBulkStatusError('');
      setShowBulkStatusModal(true);
      return;
    }

    const result = await Swal.fire({
      title: 'Change Status?',
      text: `Are you sure you want to change the status of ${selectedApplicantIds.length} applicant(s) to ${bulkAction}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, change it!',
    });

    if (!result.isConfirmed) return;

    try {
      setIsProcessing(true);
      // Optimistically trigger mutations and show success immediately
      selectedApplicantIds.forEach((aid) =>
        updateStatusMutation.mutate({
          id: aid,
          data: {
            status: bulkAction as any,
            notes: `Bulk status change to ${bulkAction} on ${new Date().toLocaleDateString()}`,
          },
        })
      );

      await Swal.fire({
        title: 'Success!',
        text: `Status updated for ${selectedApplicantIds.length} applicant(s).`,
        icon: 'success',
        position: 'center',
        timer: 2000,
        showConfirmButton: false,
      });
      if (mountedRef.current) {
        setRowSelection({});
        setBulkAction('');
      }
    } catch (err: any) {
      console.error('Error changing status:', err);
      const errorMsg = getErrorMessage(err);
      if (mountedRef.current) setBulkStatusError(errorMsg);
    } finally {
      if (mountedRef.current) setIsProcessing(false);
    }
  }, [selectedApplicantIds, bulkAction, updateStatusMutation]);


const handleBulkStatusChange = useCallback(
  async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedApplicantIds.length === 0) return;

    if (!bulkStatusForm.status || bulkStatusForm.status.trim() === '') {
      setBulkStatusError('Please select a status before submitting.');
      return;
    }

    // Prepare the updates array
    const updates = selectedApplicantIds.map((applicantId) => {
      const update: any = {
        applicantId: applicantId,
        status: bulkStatusForm.status,
      };
      
      if (bulkStatusForm.notes && bulkStatusForm.notes.trim()) {
        update.notes = bulkStatusForm.notes.trim();
      }
      
      if (Array.isArray(bulkStatusForm.reasons) && bulkStatusForm.reasons.length) {
        update.reasons = bulkStatusForm.reasons.map((r) => String(r ?? '').trim()).filter(Boolean);
      }
      
      return update;
    });

    try {
      setIsSubmittingBulkStatus(true);
      setBulkStatusError('');

      // Use the batch mutation
      await batchUpdateStatusMutation.mutateAsync(updates);

      await Swal.fire({
        title: 'Success!',
        text: `Status updated for ${selectedApplicantIds.length} applicant(s).`,
        icon: 'success',
        position: 'center',
        timer: 2000,
        showConfirmButton: false,
      });
      
      if (mountedRef.current) {
        setRowSelection({});
        setBulkAction('');
        setShowBulkStatusModal(false);
        setBulkStatusForm({ status: '', reasons: [], notes: '' });
        await refetchApplicants();
        queryClient.invalidateQueries({ queryKey: ['applicants'] });
      }
    } catch (err: any) {
      console.error('Error bulk changing status:', err);
      const errorMsg = err.message || 'Failed to update statuses';
      setBulkStatusError(errorMsg);
    } finally {
      if (mountedRef.current) setIsSubmittingBulkStatus(false);
    }
  },
  [selectedApplicantIds, bulkStatusForm, refetchApplicants, queryClient, batchUpdateStatusMutation]
);

const handleBulkDelete = useCallback(async () => {
  if (selectedApplicantIds.length === 0) return;

  const result = await Swal.fire({
    title: 'Delete Applicants?',
    text: `Are you sure you want to delete ${selectedApplicantIds.length} applicant(s)? They will be moved to trash.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, delete them!',
  });

  if (!result.isConfirmed) return;

  // Prepare updates for moving to trash
  const updates = selectedApplicantIds.map((applicantId) => ({
    applicantId: applicantId,
    status: 'trashed',
    notes: `Moved to trash on ${new Date().toLocaleDateString()}`,
  }));

  try {
    setIsDeleting(true);
    
    await batchUpdateStatusMutation.mutateAsync(updates);
    
    await Swal.fire({
      title: 'Success!',
      text: `${selectedApplicantIds.length} applicant(s) moved to trash.`,
      icon: 'success',
      position: 'center',
      timer: 2000,
      showConfirmButton: false,
    });
    
    if (mountedRef.current) {
      setRowSelection({});
      await refetchApplicants();
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
    }
  } catch (err: any) {
    console.error('Error deleting applicants:', err);
    const errorMsg = err.message || 'Failed to delete applicants';
    if (mountedRef.current) setBulkDeleteError(errorMsg);
  } finally {
    if (mountedRef.current) setIsDeleting(false);
  }
}, [selectedApplicantIds, refetchApplicants, queryClient, batchUpdateStatusMutation]);




  // Define table columns
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
        <div className="flex items-center justify-center h-10 w-10">
          <Skeleton variant="circular" width={width || 40} height={height || 40} />
        </div>
      );
    }
    return <Skeleton variant={variant as any} width={width || '60%'} height={height} />;
  };

    const rejectionReasonsOptions = useMemo(() => {
  const reasonsSet = new Set<string>();
  
  // Extract rejection reasons from applicants
  filteredApplicants.forEach((applicant: any) => {
    const extractReasons = (obj: any) => {
      try {
        // Check status history
        const history = obj?.statusHistory;
        if (Array.isArray(history)) {
          const rejected = history.filter((h: any) => 
            String(h?.status || '').toLowerCase() === 'rejected'
          );
          if (rejected.length) {
            rejected.sort((x: any, y: any) => {
              const tx = x?.changedAt ? new Date(x.changedAt).getTime() : 0;
              const ty = y?.changedAt ? new Date(y.changedAt).getTime() : 0;
              return ty - tx;
            });
            const latest = rejected[0] || {};
            const reasons = latest.reasons ?? latest.rejectionReasons ?? latest.reasonsSelected ?? [];
            if (Array.isArray(reasons)) {
              reasons.forEach((r: any) => {
                const reasonStr = String(r ?? '').trim();
                if (reasonStr) reasonsSet.add(reasonStr);
              });
            } else if (typeof reasons === 'string' && reasons) {
              reasonsSet.add(reasons);
            }
          }
        }
        
        // Check top-level reasons
        const topReasons = obj?.reasons ?? obj?.rejectionReasons ?? obj?.rejectReasons ?? obj?.reasonsSelected;
        if (Array.isArray(topReasons)) {
          topReasons.forEach((r: any) => {
            const reasonStr = String(r ?? '').trim();
            if (reasonStr) reasonsSet.add(reasonStr);
          });
        } else if (typeof topReasons === 'string' && topReasons) {
          reasonsSet.add(topReasons);
        }
      } catch (e) {
        // ignore
      }
    };
    
    extractReasons(applicant);
  });
  
  // Convert to array and sort alphabetically
  return Array.from(reasonsSet)
    .sort()
    .map(reason => ({ id: reason, title: reason }));
}, [filteredApplicants]);

// Helper function to extract rejection reasons from an applicant
const extractRejectionReasons = useCallback((applicant: any): string[] => {
  try {
    // Check status history
    const history = applicant?.statusHistory;
    if (Array.isArray(history)) {
      const rejected = history.filter((h: any) => 
        String(h?.status || '').toLowerCase() === 'rejected'
      );
      if (rejected.length) {
        rejected.sort((x: any, y: any) => {
          const tx = x?.changedAt ? new Date(x.changedAt).getTime() : 0;
          const ty = y?.changedAt ? new Date(y.changedAt).getTime() : 0;
          return ty - tx;
        });
        const latest = rejected[0] || {};
        const reasons = latest.reasons ?? latest.rejectionReasons ?? latest.reasonsSelected ?? [];
        if (Array.isArray(reasons)) {
          return reasons.map((r: any) => String(r ?? '').trim()).filter(Boolean);
        }
        if (typeof reasons === 'string' && reasons) {
          return [reasons];
        }
      }
    }
    
    // Check top-level reasons
    const topReasons = applicant?.reasons ?? applicant?.rejectionReasons ?? applicant?.rejectReasons ?? applicant?.reasonsSelected;
    if (Array.isArray(topReasons)) {
      return topReasons.map((r: any) => String(r ?? '').trim()).filter(Boolean);
    }
    if (typeof topReasons === 'string' && topReasons) {
      return [topReasons];
    }
    
    return [];
  } catch (e) {
    return [];
  }
}, []);

  const columns = useMemo<MRT_ColumnDef<Applicant>[]>(
    () => [
     {
  accessorKey: 'applicantNo',
  header: isLaptopViewport ? 'ID' : 'ApplicantNo',
  size: columnSizeConfig.applicantNo,
  enableColumnFilter: false,
  enableSorting: !duplicatesOnlyEnabled, // Disable sorting when duplicates filter is active
  sortingFn: (rowA, rowB, columnId) => {
    if (duplicatesOnlyEnabled) {
      // When showing duplicates, maintain the grouped order from sortApplicantsByDuplicatePriority
      // Return 0 to preserve the original order
      return 0;
    }
    // Normal sorting logic for when duplicates filter is not active
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
    const href = getApplicantHref(row);
    const possible =
      orig?.applicantNo ||
      orig?.applicantNumber ||
      orig?.applicationNo ||
      orig?.applicationId;
    if (possible)
      return (
        <a
          href={href}
          className="block h-full w-full text-inherit underline-offset-2 hover:underline"
          onClick={(e) => handleApplicantLinkClick(e, row)}
          onAuxClick={handleApplicantLinkAuxClick}
        >
          {String(possible)}
        </a>
      );
    // fallback to visible index + 1 for human-friendly numbering
    const idx =
      row.index ??
      table.getRowModel().rows.findIndex((r) => r.id === row.id);
    if (typeof idx === 'number' && idx >= 0)
      return (
        <a
          href={href}
          className="block h-full w-full text-inherit underline-offset-2 hover:underline"
          onClick={(e) => handleApplicantLinkClick(e, row)}
          onAuxClick={handleApplicantLinkAuxClick}
        >
          {String(idx + 1)}
        </a>
      );
    // last resort: shortened id
    const id = orig?._id || orig?.id || '';
    if (!id) return '-';
    return (
      <a
        href={href}
        className="block h-full w-full text-inherit underline-offset-2 hover:underline"
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
  Cell: ({ row }: { row: { original: Applicant } }) => {
    if (isTableLoading) return renderCellSkeleton('circular', 40, 40);
    const href = getApplicantHref(row);
    return (
      <a
        href={href}
        className="block h-full w-full"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (row.original.profilePhoto) {
            setPreviewPhoto(row.original.profilePhoto);
          }
        }}
        onAuxClick={handleApplicantLinkAuxClick}
      >
        <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 transition hover:ring-2 hover:ring-brand-500 cursor-pointer">
          {row.original.profilePhoto ? (
            <ImageThumbnail
              src={row.original.profilePhoto}
              alt={row.original.fullName}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500 dark:text-gray-400">
              {(() => {
                const fullName =
                  (row?.original as any)?.fullName ||
                  (row?.original as any)?.name ||
                  (row?.original as any)?.firstName ||
                  '';
                const initial = fullName
                  ? String(fullName).charAt(0).toUpperCase()
                  : '-';
                return initial;
              })()}
            </div>
          )}
        </div>
      </a>
    );
  },
},

      {
        accessorKey: 'fullName',
        header: 'Name',
        size: columnSizeConfig.fullName,
        enableColumnFilter: true,
        enableSorting: true,
        Cell: ({ row }: { row: { original: Applicant } }) => {
          if (isTableLoading) return renderCellSkeleton('text');
          const orig: any = row.original;
          const href = getApplicantHref(row);
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
              href={href}
              className={
                isSeen
                  ? 'block h-full w-full text-gray-400'
                  : 'block h-full w-full text-gray-900'
              }
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
        enableColumnFilter: true,
        enableSorting: true,
        Cell: ({ row }: { row: { original: Applicant } }) => {
          if (isTableLoading) return renderCellSkeleton('text');
          const href = getApplicantHref(row);
          return (
            <a
              href={href}
              className="block h-full w-full text-inherit"
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
  accessorFn: (row: any) => {
    const id = String(row?._id || row?.id || '');
    return mailCountByApplicantId.get(id) ?? 0;
  },
  sortingFn: (rowA: any, rowB: any, columnId: string) => {
    const a = Number(rowA.getValue(columnId) ?? 0);
    const b = Number(rowB.getValue(columnId) ?? 0);
    return a === b ? 0 : a > b ? 1 : -1;
  },
  enableColumnFilter: false,
  Cell: ({ row }: { row: { original: Applicant } }) => {
    if (isTableLoading) return renderCellSkeleton('text');
    const id = String((row.original as any)?._id || (row.original as any)?.id || '');
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
        enableColumnFilter: true,
        enableSorting: true,
        Cell: ({ row }: { row: { original: Applicant } }) => {
          if (isTableLoading) return renderCellSkeleton('text');
          const href = getApplicantHref(row);
          return (
            <a
              href={href}
              className="block h-full w-full text-inherit"
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
        enableColumnFilter: true,
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
          const href = getApplicantHref(row);
          return (
            <a
              href={href}
              className="block h-full w-full text-inherit"
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
              enableColumnFilter: true,
              enableSorting: true,
              accessorFn: (row: any) => {
                const raw = row?.jobPositionId;
                const getId = (v: any) =>
                  typeof v === 'string' ? v : (v?._id ?? v?.id ?? '');
                const jobId = getId(raw);
                const job = jobPositionMap[jobId];
                const comp = job?.companyId ? getId(job.companyId) : '';
                return comp;
              },
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
              Cell: ({ row }: { row: { original: Applicant } }) => {
                if (isTableLoading) return renderCellSkeleton('text');
                // display company name via job position
                const jobPositionId = row.original.jobPositionId;
                const getId = (v: any) =>
                  typeof v === 'string' ? v : (v?._id ?? v?.id ?? '');
                const jobPosition = jobPositionMap[getId(jobPositionId)];
                const href = getApplicantHref(row);
                if (jobPosition?.companyId) {
                  const companyId =
                    typeof jobPosition.companyId === 'string'
                      ? jobPosition.companyId
                      : jobPosition.companyId._id || '';
                  const company = companyMap[companyId];
                  return (
                    <a
                      href={href}
                      className="block h-full w-full text-inherit"
                      onClick={(e) => handleApplicantLinkClick(e, row)}
                      onAuxClick={handleApplicantLinkAuxClick}
                    >
                      {toPlainString(company?.name) || company?.title || 'N/A'}
                    </a>
                  );
                }
                return (
                  <a
                    href={href}
                    className="block h-full w-full text-inherit"
                    onClick={(e) => handleApplicantLinkClick(e, row)}
                    onAuxClick={handleApplicantLinkAuxClick}
                  >
                    N/A
                  </a>
                );
              },
            },
          ]
        : []),
      {
        id: 'jobPositionId',
        header: 'Job Position',
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
        enableColumnFilter: true,

        Cell: ({ row }: { row: { original: Applicant } }) => {
          if (isTableLoading) return renderCellSkeleton('text');
          const raw = row.original.jobPositionId;
          const href = getApplicantHref(row);

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
              href={href}
              className="block h-full w-full text-sm font-medium text-inherit"
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
          const a = parseComparableNumber(getExpectedSalaryDisplay(rowA.original));
          const b = parseComparableNumber(getExpectedSalaryDisplay(rowB.original));
          const va = a ?? -1;
          const vb = b ?? -1;
          if (va === vb) return 0;
          return va > vb ? 1 : -1;
        },
        Cell: ({ row }: { row: { original: Applicant } }) => {
          if (isTableLoading) return renderCellSkeleton('text');
          const href = getApplicantHref(row);
          const expectedSalary = getExpectedSalaryDisplay(row.original);
          return (
            <a
              href={href}
              className="block h-full w-full text-inherit"
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
        Cell: ({ row }: { row: { original: Applicant } }) => {
          if (isTableLoading) return renderCellSkeleton('text');
          const href = getApplicantHref(row);
          const score = getApplicantSScore(row.original);
          return (
            <a
              href={href}
              className="block h-full w-full text-inherit"
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
 // Update the status column header (around line 1753)
Header: ({ column }: { column: any }) => {
  if (onlyStatus !== undefined && onlyStatus !== null) {
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
  enableColumnFilter: onlyStatus === undefined,
  Cell: ({ row }: { row: { original: Applicant } }) => {
  if (isTableLoading) return renderCellSkeleton('text', '80px');
  
  const colors = getStatusColor(row.original.status);
  const href = getApplicantHref(row);
  const statusStr = String((row?.original as any)?.status || '');
  const statusLabel = statusStr
    ? statusStr.charAt(0).toUpperCase() + statusStr.slice(1)
    : '-';

  const statusDescription = getDescription(statusStr);



  return (
    <a
      href={href}
      className="block h-full w-full"
      onClick={(e) => handleApplicantLinkClick(e, row)}
      onAuxClick={handleApplicantLinkAuxClick}
      title={statusDescription || undefined}
    >
      <span
        style={{
          backgroundColor: colors.bg,
          color: colors.color,
        }}
        className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
      >
        {statusLabel}
      </span>
    </a>
  );
},
},
        // Rejection reasons column - shown only when this view is fixed to 'rejected'
        ...( (onlyStatus !== undefined && (Array.isArray(onlyStatus) ? onlyStatus.includes('rejected') : String(onlyStatus) === 'rejected'))
          ? [
             {
  id: 'rejectionReasons',
  header: 'Rejection Reasons',
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
    const selectedReasons = Array.isArray(filterValue) ? filterValue : [filterValue];
    if (selectedReasons.length === 0) return true;
    
    const applicantReasons = row.getValue(columnId) as string[];
    
    // Check if any of the applicant's reasons match any selected filter
    return selectedReasons.some(selectedReason => 
      applicantReasons.some(applicantReason => 
        applicantReason.toLowerCase().includes(selectedReason.toLowerCase()) ||
        selectedReason.toLowerCase().includes(applicantReason.toLowerCase())
      )
    );
  },
  Header: ({ column }: { column: any }) => (
    <ColumnMultiSelectHeader
      column={column}
      label="Rejection Reasons"
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
        // Custom header shows a two-state control (Newest / Oldest)
       Header: ({ column, table }: { column: any; table: any }) => {
  const sortingState = table.getState().sorting;
  const submittedSort = sortingState.find(
    (s: any) => s.id === column.id
  );
  const desc = submittedSort ? submittedSort.desc : true;

  const toggle = (e: any) => {
    e.preventDefault();
    e.stopPropagation(); // Stop propagation to prevent row click
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
        size: columnSizeConfig.submittedAt,
        enableColumnFilter: false,
        // Disable MRT's built-in sort UI for this column so we can render a single up/down arrow
        enableSorting: true,
        // Add a class to the head cell so we can hide MUI's default double-arrow icon
        muiTableHeadCellProps: { className: 'hide-default-sort-icon' },
        // Sorting function compares ISO date strings safely.
        // Do NOT prioritize duplicates — sort only by submitted date.
        // Return a stable ascending comparator; MRT will apply asc/desc.
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
          const href = getApplicantHref(row);
          return (
            <a
              href={href}
              className="block h-full w-full text-inherit"
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
          const hasCv = Boolean(resolveCvPath(orig));
          const href = getApplicantHref(row);
          return (
            <a
              href={href}
              className="block h-full w-full"
              onClick={(e) => handleApplicantLinkClick(e, row)}
              onAuxClick={handleApplicantLinkAuxClick}
            >
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
                      try {
                        e.stopPropagation();
                      } catch {}
                      try {
                        await downloadCvForApplicant(orig);
                      } catch (err) {
                        /* ignore */
                      }
                    }}
                    className="inline-flex items-center justify-center rounded bg-brand-500 p-1 text-white hover:bg-brand-600"
                  >
                    <span className="sr-only">Download CV</span>
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
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
            </a>
          );
        },
      },
    ],
    [
      companyMap,
      jobPositionMap,
      jobOptions,
      companyOptions,
      showCompanyColumn,
      statusFilterOptions,
      onlyStatus,
      genderOptions,
      columnSizeConfig,
      isLaptopViewport,
      isTableLoading,
      getStatusColor,
      getDescription,
      formatDate,
      parseComparableNumber,
      getExpectedSalaryDisplay,
      getApplicantSScore,
      selectedCompanyFilter,
      selectedCompanyFilter,
      mailCountByApplicantId,
    ]
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

  const responsiveColumnVisibility = useMemo(
    () => layout.columnVisibility || {},
    [layout.columnVisibility]
  );

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
            defaultProps: {
              size: 'large',
            },
            styleOverrides: {
              root: {
                color: isDarkMode ? '#667085' : '#98A2B3',
                padding: '2px',
                '& .MuiSvgIcon-root': {
                  fontSize: '2rem',
                },
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

  const skeletonData = useMemo(
    () =>
      Array.from({ length: (pagination?.pageSize as number) || 10 }).map(
        (_: any, i: number) => ({ _id: `skeleton-${i}`, _skeleton: true })
      ),
    [pagination?.pageSize]
  );

    const tableData = isTableLoading ? skeletonData : filteredApplicants;
    // Ensure initial column filters are compatible with the current column set.
    const effectiveColumnFilters = useMemo(() => {
      try {
        if (!Array.isArray(columnFilters)) return columnFilters;
        if (showCompanyColumn) return columnFilters;
        return columnFilters.filter((f: any) => f?.id !== 'companyId');
      } catch (e) {
        return columnFilters;
      }
    }, [columnFilters, showCompanyColumn]);
// Add a helper function to check if a click target is within a filter element
const isFilterElement = (target: HTMLElement): boolean => {
  return (
    target.closest('.MuiMenu-paper') !== null || // Material-UI menu
    target.closest('[role="menu"]') !== null || // Role menu
    target.closest('.MuiPopover-root') !== null || // Popover
    target.closest('.MuiModal-root') !== null || // Modal
    target.closest('button[aria-haspopup="menu"]') !== null || // Dropdown buttons
    target.closest('.MuiTableSortLabel-root') !== null || // Sort buttons
    target.closest('.MuiCheckbox-root') !== null || // Checkboxes
    target.closest('input') !== null || // Input fields
    target.closest('select') !== null // Select dropdowns
  );
};

  const table = useMaterialReactTable({
    columns,
  enableSorting: !duplicatesOnlyEnabled, // Disable sorting when showing duplicates
    data: tableData as any,
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
          const href = getApplicantHref(row);
          return (
            <div className="relative flex items-center justify-center p-2">
              <a
                href={href}
                className="absolute inset-0 z-0 block"
                onClick={(e) => handleApplicantLinkClick(e, row)}
                onAuxClick={handleApplicantLinkAuxClick}
                aria-label={`Open ${row.original?.fullName || 'applicant'} details`}
              />
              <div
                className="relative z-10"
                onClick={(e) => e.stopPropagation()}
                onAuxClick={(e) => e.stopPropagation()}
              >
                <MRT_SelectCheckbox row={row} table={table} />
              </div>
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
    // Data passed to the table is `filteredApplicants` (or placeholder during loading), so rowCount should match it
    rowCount: isTableLoading ? tableData.length : filteredApplicants.length,
    // Default pagination: 10 rows per page
    initialState: {
      pagination,
      columnFilters: effectiveColumnFilters,
      columnVisibility: responsiveColumnVisibility,
      density: 'compact',
      columnOrder:
        Array.isArray(layout.columnOrder) && layout.columnOrder.length
          ? layout.columnOrder
          : Array.from(
              new Set(
                ['mrt-row-select', ...columns.map((c) => (c as any).id ?? (c as any).accessorKey).filter(Boolean)]
              )
            ),
    },
    // Control table state from component so updates (from persisted state or programmatic
    // changes) are reflected immediately in the table. MRT will still call the on* handlers
    // when the user interacts, which update these values via the setters below.
    state: {
      sorting,
      pagination,
      columnFilters: effectiveColumnFilters,
      rowSelection,
      columnVisibility: responsiveColumnVisibility,
    },
    // Keep table state synchronized with component state so our
    // `sorting`/`pagination`/`columnFilters` values stay current
    // (and are persisted to sessionStorage).
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
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
        fontFamily:
          "'Cairo', Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans'",
        fontSize: '0.82rem',
      },
    },
    muiTableContainerProps: {
      sx: {
        maxWidth: '100%',
        overflowX: 'auto',
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
        display: 'flex',
        alignItems: 'center',
        fontSize: isLaptopViewport ? '0.76rem' : '0.8rem',
        lineHeight: 1.25,
        padding: isLaptopViewport ? '5px 6px' : '6px 8px',
        verticalAlign: 'middle',
        fontFamily:
          "'Cairo', Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans'",
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        '& > a': {
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          color: 'inherit',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
        '& .Mui-TableBodyCell-Content': {
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          minHeight: '100%',
        },
      },
    },
    muiTableHeadCellProps: {
      sx: {
        backgroundColor: isDarkMode ? '#1C2434' : '#F9FAFB',
        color: isDarkMode ? '#E4E7EC' : '#344054',
        borderColor: isDarkMode ? '#344054' : '#E4E7EC',
        display: 'flex',
        alignItems: 'center',
        fontWeight: 600,
        fontSize: isLaptopViewport ? '0.74rem' : '0.78rem',
        lineHeight: 1.2,
        padding: isLaptopViewport ? '7px 6px' : '8px 8px',
        verticalAlign: 'middle',
        fontFamily:
          "'Cairo', Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans'",
        whiteSpace: 'nowrap',
        '& .Mui-TableHeadCell-Content': {
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          minHeight: '100%',
        },
        '& .Mui-TableHeadCell-Content-Wrapper': {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
        // Hide the default unsorted double-arrow icon; show icon only when active (sorted)
        '& .MuiTableSortLabel-icon': {
          opacity: 0,
          transition: 'opacity 150ms ease',
        },
        '& .MuiTableSortLabel-root.MuiTableSortLabel-active .MuiTableSortLabel-icon':
          {
            opacity: 1,
          },
        '& .MuiIconButton-root': {
          display: 'none !important',
        },
        // allow header popovers to overflow the table head cell
        overflow: 'visible',
        zIndex: 2,
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
   
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row._id,
 renderTopToolbarCustomActions: () => {
  return (
    <div
      style={{ backgroundColor: isDarkMode ? '#1C2434' : '#FFFFFF' }}
      className="flex items-center p-2 w-full justify-between"
    >
      <div className="flex items-center gap-2">
        {/* Duplicates Filter Toggle Button */}
        <button
          type="button"
          onClick={() => {
            // Toggle duplicates only filter
            const currentFilter = customFilters.find(
              (f: any) => f?.fieldId === '__duplicates_only'
            );
            
            if (currentFilter) {
              // Remove the filter if it exists
              setCustomFilters((prev) =>
                prev.filter((f: any) => f?.fieldId !== '__duplicates_only')
              );
            } else {
              // Add the filter
              setCustomFilters((prev) => [
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
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-semibold transition-all duration-200 ${
            duplicatesOnlyEnabled
              ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300 dark:ring-amber-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
          }`}
          title={duplicatesOnlyEnabled ? 'Show all applicants' : 'Show only duplicate applicants'}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
            />
          </svg>
          {duplicatesOnlyEnabled ? (
            <span className="flex items-center gap-1">
              <span>Duplicates Only</span>
              <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
                Active
              </span>
            </span>
          ) : (
            'Show Duplicates'
          )}
        </button>

        {/* Show count of duplicates when filter is active */}
        {duplicatesOnlyEnabled && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {(() => {
              // Count unique duplicate groups
              const duplicateLookup = buildApplicantDuplicateLookup(
                filteredApplicants as any[],
                currentUserId,
                {
                  getCompanyId: (applicant: any) => {
                    const rawCompany =
                      applicant?.companyId || applicant?.company || applicant?.companyObj;
                    if (rawCompany) {
                      if (typeof rawCompany === 'string' || typeof rawCompany === 'number') {
                        return String(rawCompany);
                      }
                      return String(rawCompany?._id || rawCompany?.id || '');
                    }
                    const rawJob = applicant?.jobPositionId;
                    const jobId =
                      typeof rawJob === 'string'
                        ? rawJob
                        : (rawJob?._id ?? rawJob?.id ?? '');
                    const job = jobPositionMap[jobId];
                    const jobCompany = job?.companyId || job?.company || job?.companyObj;
                    if (!jobCompany) return undefined;
                    if (typeof jobCompany === 'string' || typeof jobCompany === 'number') {
                      return String(jobCompany);
                    }
                    return String(jobCompany?._id || jobCompany?.id || '');
                  },
                }
              );
              const duplicateCount = Array.from(duplicateLookup.values()).filter(
                (d) => d.isDuplicate === true
              ).length;
              return `${duplicateCount} duplicate applicant(s) found`;
            })()}
          </span>
        )}
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            try {
              (e.currentTarget as HTMLButtonElement).blur();
            } catch {}
            // remove any existing customFilters that target excluded fields
            try {
              setCustomFilters((prev) =>
                prev.filter((cf: any) => {
                  const rawCandidates = [
                    `${cf.labelEn || ''} ${cf.labelAr || ''}`,
                    cf.labelEn || '',
                    cf.labelAr || '',
                    cf.fieldId || '',
                  ];
                  for (const rc of rawCandidates) {
                    if (isExcludedLabel(rc)) return false;
                  }
                  return true;
                })
              );
            } catch (e) {
              // ignore
            }
            setCustomFilterOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
        >
          Filter Settings
        </button>
      </div>
    </div>
  );
},



    muiTableBodyRowProps: ({ row }) => ({
  onClick: (e: any) => {
    // Prevent navigation if clicking on interactive elements
    if (isFilterElement(e.target)) {
      e.stopPropagation();
      return;
    }

    try {
      const state = table.getState();
      sessionStorage.setItem(
        'applicants_table_state',
        JSON.stringify({
          pagination: state.pagination,
          sorting: state.sorting,
          columnFilters: state.columnFilters,
        })
      );
    } catch (e) {
      // ignore
    }

    // Support Ctrl/Cmd click on row to open details in new tab.
    if (e?.ctrlKey || e?.metaKey) {
      openApplicantDetailsInNewTab(row);
      return;
    }

    navigate(`/applicant-details/${row.id}`, {
      state: { applicant: row.original },
    });
  },
  onAuxClick: (e: any) => {
    // Prevent navigation on middle-click for filter elements
    if (isFilterElement(e.target)) {
      e.stopPropagation();
      return;
    }

    // Middle-click on row opens in new tab.
    if (e?.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      openApplicantDetailsInNewTab(row);
    }
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

  // Persist table state to sessionStorage so pagination/filtering is restored when returning
  useEffect(() => {
    try {
      const toSave = {
        pagination,
        sorting,
        columnFilters,
      };
      sessionStorage.setItem('applicants_table_state', JSON.stringify(toSave));
    } catch (e) {
      // ignore
    }
  }, [pagination, sorting, columnFilters]);
  useEffect(() => {
  setPagination((prev: any) => ({ ...prev, pageIndex: 0 }));
}, [columnFilters, customFilters]);

  return (
    <>
      <PageMeta title="Applicants" description="Manage job applicants" />
      <PageBreadcrumb
        pageTitle="Applicants"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  const promises: Promise<any>[] = [];
                  if (isJobPositionsFetched && refetchJobPositions)
                    promises.push(refetchJobPositions());
                  if (isApplicantsFetched && refetchApplicants)
                    promises.push(refetchApplicants());
                  if (isCompaniesFetched && refetchCompanies)
                    promises.push(refetchCompanies());
                  if (promises.length === 0) return;
                  await Promise.all(promises);
                  if (mountedRef.current) setLastRefetch(new Date());
                } catch (e) {
                  // ignore
                }
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
            {/* Error Messages */}
            {bulkInterviewError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    <strong>Error scheduling interviews:</strong>{' '}
                    {bulkInterviewError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setBulkInterviewError('')}
                    className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {bulkStatusError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    <strong>Error changing status:</strong> {bulkStatusError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setBulkStatusError('')}
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
                    <strong>Error deleting applicants:</strong>{' '}
                    {bulkDeleteError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setBulkDeleteError('')}
                    className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            {/* Filter Settings button above the table */}
            {/* removed in-body toolbar button; moved to ComponentCard header actions */}
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
        <button
          type="button"
          onClick={() => {
            setBulkStatusForm({ status: '', reasons: [], notes: '' });
            setBulkStatusError('');
            setShowBulkStatusModal(true);
          }}
          disabled={isProcessing || selectedApplicantIds.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Changing...' : 'Change Status'}
        </button>
      </div>
      
      {/* Export Button */}
      <button
        onClick={handleExportToExcel}
        disabled={isExporting || selectedApplicantIds.length === 0}
        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        {isExporting ? 'Exporting...' : `Export (${selectedApplicantIds.length})`}
      </button>
      
      <button
        onClick={() => setShowBulkModal(true)}
        disabled={
          isProcessing || selectedApplicantRecipients.length === 0
        }
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {`Send Mail (${selectedApplicantRecipients.length})`}
      </button>
      
      <button
        onClick={openBulkInterviewModal}
        disabled={
          isSubmittingBulkInterview ||
          selectedApplicantsForInterview.length === 0
        }
        className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmittingBulkInterview
          ? 'Scheduling...'
          : `Schedule Interviews (${selectedApplicantsForInterview.length})`}
      </button>
      
      <button
        onClick={handleBulkDelete}
        disabled={isDeleting}
        className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <TrashBinIcon className="h-4 w-4" />
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  </div>
)}

            {/* Filter Settings moved to card header actions */}

            {/* Material React Table */}
            <ThemeProvider theme={muiTheme}>
              <div className="w-full overflow-x-auto custom-scrollbar">
                <MaterialReactTable table={table} />
              </div>
            </ThemeProvider>
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
  // Remove statusOptions prop - no longer needed
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
              buildInterviewEmailHtml={({ subject, rawMessage, replacements }: any) =>
    buildInterviewEmailHtml(
      String(subject || ''), 
      String(rawMessage || ''),
      replacements
    )
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
                        <span className="mr-4">To: {item.to || 'No email'}</span>
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
                    className="rounded-lg border border-stroke px-4 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
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
                <div className="border rounded p-2 bg-white dark:bg-gray-800" style={{ maxHeight: '70vh', overflow: 'auto' }}>
                  <iframe
                    srcDoc={bulkPreviewHtml}
                    title="Bulk Interview Preview"
                    className="w-full min-h-[480px] rounded border-none"
                  />
                </div>
              </div>
            </Modal>

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
      {/* Custom Filter Modal */}
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
    </>
  );
};

  export { Applicants };

export default function ApplicantsWrapper() {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 425 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 425);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (isMobile) return <ApplicantsMobilePage />;
  return <Applicants />;
}
