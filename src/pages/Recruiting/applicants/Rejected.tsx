import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useDeferredValue,
} from 'react';

const _thumbnailCache: Map<string, string> = new Map();

async function createCompressedDataUrl(src: string, maxBytes = 5120): Promise<string> {
  if (!src) return src;
  if (_thumbnailCache.has(src)) return _thumbnailCache.get(src) as string;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    let resolved = false;
    const finish = (result: string) => {
      if (resolved) return;
      resolved = true;
      try { _thumbnailCache.set(src, result); } catch {}
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
            } catch { return null; }
          }
          return null;
        };
        let dataUrl = tryQualities([0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1]);
        if (dataUrl) return finish(dataUrl);
        let w = canvas.width, h = canvas.height;
        while ((w > 32 || h > 32) && !dataUrl) {
          w = Math.max(24, Math.floor(w * 0.75));
          h = Math.max(24, Math.floor(h * 0.75));
          canvas.width = w; canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          dataUrl = tryQualities([0.6, 0.4, 0.25, 0.15, 0.1]);
        }
        if (dataUrl) return finish(dataUrl);
        finish(src);
      } catch { finish(src); }
    };
    img.onerror = () => finish(src);
    try { img.src = src; } catch { finish(src); }
    setTimeout(() => finish(src), 1500);
  });
}

function ImageThumbnail({ src, alt }: { src?: string | null; alt?: string }) {
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    if (!src) { setThumb(null); return () => { mounted = false; }; }
    if (typeof src === 'string' && src.startsWith('data:')) { setThumb(src); return () => { mounted = false; }; }
    (async () => {
      try {
        const compressed = await createCompressedDataUrl(src as string, 5120);
        if (mounted) setThumb(compressed || (src as string));
      } catch { if (mounted) setThumb(src as string); }
    })();
    return () => { mounted = false; };
  }, [src]);
  if (!thumb) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500 dark:text-gray-400">
        {alt && alt.charAt(0) ? alt.charAt(0).toUpperCase() : '-'}
      </div>
    );
  }
  return <img loading="lazy" src={thumb} alt={alt || ''} className="h-full w-full object-cover" />;
}

// ---------- imports ----------
import { useNavigate } from 'react-router';
import {
  MaterialReactTable,
  MRT_SelectCheckbox,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_RowSelectionState,
  type MRT_ColumnFiltersState,
} from 'material-react-table';
import { ThemeProvider, createTheme, Skeleton } from '@mui/material';
import ComponentCard from '../../../components/common/ComponentCard';
import PageBreadcrumb from '../../../components/common/PageBreadCrumb';
import PageMeta from '../../../components/common/PageMeta';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { useAuth } from '../../../context/AuthContext';
import {
  useApplicants,
  useJobPositions,
  useCompanies,
} from '../../../hooks/queries';
import type { Applicant } from '../../../store/slices/applicantsSlice';
import { toPlainString } from '../../../utils/strings';
import { useTableLayout } from '../../../hooks/queries/useTableLayout';
import { TableLayout } from '../../../services/authService';

// ---------- constants ----------
const REJECTED_DEFAULT_LAYOUT: TableLayout = {
  columnVisibility: {},
  columnSizing: {},
  columnOrder: [],
};

// ---------- reason resolver ----------
/**
 * Finds the most recent statusHistory entry where status === 'rejected'
 * and returns the reasons[] array from that entry.
 * Falls back to top-level scalar fields if statusHistory is absent or empty.
 */
const resolveRejectionReasons = (a: any): string[] => {
  // 1. statusHistory — find the latest 'rejected' entry
  if (Array.isArray(a?.statusHistory) && a.statusHistory.length > 0) {
    const rejectedEntries = [...a.statusHistory]
      .filter((h: any) => h?.status === 'rejected')
      .sort((x: any, y: any) => {
        const tx = x?.changedAt ? new Date(x.changedAt).getTime() : 0;
        const ty = y?.changedAt ? new Date(y.changedAt).getTime() : 0;
        return ty - tx; // descending → latest first
      });

    if (rejectedEntries.length > 0) {
      const latest = rejectedEntries[0];
      const reasons: string[] = Array.isArray(latest?.reasons)
        ? latest.reasons.map(String).filter((r: string) => r.trim())
        : [];
      // Also include a notes string from that history entry if present
      if (typeof latest?.notes === 'string' && latest.notes.trim()) {
        reasons.push(latest.notes.trim());
      }
      if (reasons.length > 0) return reasons;
    }
  }

  // 2. Fallback: top-level scalar/array fields
  const fallbacks = [a?.rejectionReason, a?.notes, a?.comment, a?.comments, a?.note, a?.statusNote];
  for (const f of fallbacks) {
    if (typeof f === 'string' && f.trim()) return [f.trim()];
    if (Array.isArray(f)) {
      const items = f.map(String).filter((s) => s.trim());
      if (items.length) return items;
    }
  }

  return [];
};

// ---------- Reasons badges cell ----------
function ReasonsBadges({ reasons }: { reasons: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (reasons.length === 0) {
    return (
      <span className="italic text-gray-400 dark:text-gray-500 text-xs">
        No reason provided
      </span>
    );
  }

  const PREVIEW = 2;
  const visible = expanded ? reasons : reasons.slice(0, PREVIEW);
  const hasMore = reasons.length > PREVIEW;

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visible.map((r, i) => (
        <span
          key={i}
          title={r}
          className="inline-block max-w-[180px] truncate rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
        >
          {r}
        </span>
      ))}
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
        >
          +{reasons.length - PREVIEW} more
        </button>
      )}
      {expanded && hasMore && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
        >
          Show less
        </button>
      )}
    </div>
  );
}

// =============================================================================
// Main component
// =============================================================================
const RejectedApplicants = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { layout, saveLayout } = useTableLayout(
    'rejected_applicants_table',
    REJECTED_DEFAULT_LAYOUT
  );

  const currentUserId = useMemo(
    () => String((user as any)?._id || (user as any)?.id || ''),
    [user]
  );

  const companyId = useMemo(() => {
    if (!user) return undefined;
    const roleName = user?.roleId?.name?.toLowerCase();
    if (roleName === 'super admin') return undefined;
    const ids = user?.companies?.map((c) =>
      typeof c.companyId === 'string' ? c.companyId : c.companyId._id
    );
    return ids?.length ? ids : undefined;
  }, [user?._id, user?.roleId?.name, user?.companies]);

  const showCompanyColumn = useMemo(() => {
    if (!companyId) return true;
    if (Array.isArray(companyId) && companyId.length === 1) return false;
    return true;
  }, [companyId]);

  // ---------- queries ----------
  const {
    data: jobPositions = [],
    refetch: refetchJobPositions,
    isFetching: isJobPositionsFetching,
    isFetched: isJobPositionsFetched,
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

  // ---------- local state ----------
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [lastRefetch, setLastRefetch] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<Array<any>>([{ id: 'submittedAt', desc: true }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1920
  );
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [mobileQuery, setMobileQuery] = useState<string>('');

  // ---------- effects ----------
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const isLaptopViewport = viewportWidth <= 1440;
  const isNarrowDesktopViewport = viewportWidth <= 1024;
  const isSmallViewport = viewportWidth <= 768;
  const tableMinWidth = isNarrowDesktopViewport ? 860 : isLaptopViewport ? 1020 : 1160;
  const selectColumnWidth = isLaptopViewport ? 36 : 48;

  const columnSizeConfig = useMemo(() => ({
    applicantNo:    isLaptopViewport ? 56  : 80,
    profilePhoto:   isLaptopViewport ? 52  : 72,
    fullName:       isLaptopViewport ? 92  : 120,
    email:          isLaptopViewport ? 128 : 170,
    phone:          isLaptopViewport ? 86  : 110,
    gender:         isLaptopViewport ? 70  : 90,
    companyId:      isLaptopViewport ? 96  : 130,
    jobPositionId:  isLaptopViewport ? 118 : 160,
    expectedSalary: isLaptopViewport ? 100 : 130,
    reasons:        isLaptopViewport ? 240 : 300,
    submittedAt:    isLaptopViewport ? 88  : 110,
  }), [isLaptopViewport]);

  // ---------- elapsed ----------
  useEffect(() => {
    if (!lastRefetch && (isJobPositionsFetched || isApplicantsFetched || isCompaniesFetched)) {
      if (mountedRef.current) setLastRefetch(new Date());
    }
  }, [isJobPositionsFetched, isApplicantsFetched, isCompaniesFetched, lastRefetch]);

  useEffect(() => {
    if (!lastRefetch) { setElapsed(null); return; }
    const fmt = (d: Date) => {
      const s = Math.floor((Date.now() - d.getTime()) / 1000);
      if (s < 60) return 'now';
      const m = Math.floor(s / 60);
      if (m < 60) return `${m} min ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
      const days = Math.floor(h / 24);
      if (days === 1) return 'yesterday';
      if (days < 7) return `${days} days ago`;
      return d.toLocaleDateString();
    };
    const upd = () => { if (mountedRef.current) setElapsed(fmt(lastRefetch)); };
    upd();
    const id = setInterval(upd, 30000);
    return () => clearInterval(id);
  }, [lastRefetch]);

  // ---------- derived ----------
  const allCompanies = useMemo(() => {
    if (!companyId || companyId.length === 0) return allCompaniesRaw;
    return allCompaniesRaw.filter((c: any) => companyId.includes(c._id));
  }, [allCompaniesRaw, companyId]);

  const jobPositionMap = useMemo(() => {
    const map: Record<string, any> = {};
    const getId = (v: any) => typeof v === 'string' ? v : (v?._id ?? v?.id);
    jobPositions.forEach((job: any) => {
      const id = getId(job._id) || getId(job.id);
      if (id) map[id] = job;
    });
    return map;
  }, [jobPositions]);

  const companyMap = useMemo(() => {
    const map: Record<string, any> = {};
    allCompanies.forEach((c: any) => {
      const id = typeof c._id === 'string' ? c._id : c._id?._id;
      if (id) map[id] = c;
      if (c._id) map[c._id] = c;
    });
    return map;
  }, [allCompanies]);

  const jobOptions = useMemo(() => {
    const getId = (v: any) => typeof v === 'string' ? v : (v?._id ?? v?.id);
    return jobPositions
      .map((j: any) => ({
        id: getId(j._id) || getId(j.id) || '',
        title: typeof j.title === 'string' ? j.title : j?.title?.en || '',
      }))
      .filter((x) => x.id && x.title);
  }, [jobPositions]);

  // Only rejected applicants — the sole dataset for this page
  const rejectedApplicants = useMemo(
    () => (applicants as Applicant[]).filter((a: any) => a.status === 'rejected'),
    [applicants]
  );
  const deferredRejected = useDeferredValue(rejectedApplicants);

  const isTableLoading = Boolean(
    isJobPositionsFetching || isApplicantsFetching || isCompaniesFetching
  );

  // ---------- helpers ----------
  const formatDate = useCallback((dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    }), []);

  const normalizeGender = (raw: any) => {
    if (!raw) return '';
    const s = String(raw).trim();
    const lower = s.toLowerCase();
    if (['ذكر', 'ذكرً', 'ذَكر'].some((v) => v === s || v === lower)) return 'Male';
    if (['انثى', 'أنثى', 'انثي', 'انسه', 'أنسه', 'انثا'].some((v) => v === s)) return 'Female';
    if (lower === 'male' || lower === 'm') return 'Male';
    if (lower === 'female' || lower === 'f') return 'Female';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const getExpectedSalaryDisplay = useCallback((applicant: any): string => {
    const toText = (v: any): string => {
      if (v == null) return '';
      if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
      if (Array.isArray(v)) return v.map(toText).filter(Boolean).join(', ');
      if (typeof v === 'object') {
        for (const k of ['expectedSalary', 'salary', 'amount', 'value', 'val', 'label', 'name', 'en', 'ar']) {
          if (Object.prototype.hasOwnProperty.call(v, k)) {
            const n = toText((v as any)[k]);
            if (n) return n;
          }
        }
      }
      return '';
    };
    for (const c of [applicant?.expectedSalary, applicant?.expected_salary, applicant?.salaryExpectation, applicant?.desiredSalary]) {
      const t = toText(c); if (t) return t;
    }
    const responses = applicant?.customResponses || applicant?.customFieldResponses || {};
    const nk = (k: any) => String(k || '').replace(/[\s_-]+/g, '').toLowerCase();
    for (const [key, value] of Object.entries(responses || {})) {
      if (['expectedsalary', 'salary', 'الراتب', 'راتب'].some((m) => nk(key).includes(m))) {
        const t = toText(value); if (t) return t;
      }
    }
    return '-';
  }, []);

  const getApplicantHref = useCallback((row: any) => {
    const orig: any = row?.original ?? row;
    return `/applicant-details/${String(orig?._id || orig?.id || row?.id || '')}`;
  }, []);

  const handleApplicantLinkClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, row: any) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) { e.stopPropagation(); return; }
      e.preventDefault(); e.stopPropagation();
      navigate(getApplicantHref(row), { state: { applicant: row.original } });
    },
    [getApplicantHref, navigate]
  );

  const handleApplicantLinkAuxClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => { e.stopPropagation(); },
    []
  );

  const openApplicantDetailsInNewTab = useCallback((row: any) => {
    try { window.open(`${window.location.origin}/applicant-details/${row.id}`, '_blank', 'noopener,noreferrer'); } catch {}
  }, []);

  // ---------- skeleton renderer ----------
  const renderCellSkeleton = (variant: 'text' | 'circular' = 'text', width?: number | string, height?: number) => {
    if (variant === 'circular') {
      return <div className="flex items-center justify-center h-10 w-10"><Skeleton variant="circular" width={width || 40} height={height || 40} /></div>;
    }
    return <Skeleton variant="text" width={width || '60%'} height={height} />;
  };

  // ---------- columns ----------
  const columns = useMemo<MRT_ColumnDef<Applicant>[]>(() => [
    {
      accessorKey: 'applicantNo',
      header: isLaptopViewport ? 'ID' : 'ApplicantNo',
      size: columnSizeConfig.applicantNo,
      enableColumnFilter: false,
      enableSorting: false,
      Cell: ({ row, table }) => {
        if (isTableLoading) return renderCellSkeleton('text', '40%');
        const orig: any = row.original;
        const href = getApplicantHref(row);
        const possible = orig?.applicantNo || orig?.applicantNumber || orig?.applicationNo;
        const display = possible
          ? String(possible)
          : (() => {
              const idx = row.index ?? table.getRowModel().rows.findIndex((r) => r.id === row.id);
              return typeof idx === 'number' && idx >= 0 ? String(idx + 1) : (String(orig?._id || orig?.id || '').slice(0, 8) || '-');
            })();
        return (
          <a href={href} className="block h-full w-full text-inherit underline-offset-2 hover:underline"
            onClick={(e) => handleApplicantLinkClick(e, row)} onAuxClick={handleApplicantLinkAuxClick}>
            {display}
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
          <a href={href} className="block h-full w-full"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (row.original.profilePhoto) setPreviewPhoto(row.original.profilePhoto); }}
            onAuxClick={handleApplicantLinkAuxClick}>
            <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 transition hover:ring-2 hover:ring-brand-500 cursor-pointer">
              {row.original.profilePhoto ? (
                <ImageThumbnail src={row.original.profilePhoto} alt={row.original.fullName} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500 dark:text-gray-400">
                  {row.original.fullName.charAt(0).toUpperCase()}
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
      enableSorting: false,
      Cell: ({ row }: { row: { original: Applicant } }) => {
        if (isTableLoading) return renderCellSkeleton();
        const orig: any = row.original;
        const href = getApplicantHref(row);
        const isSeen = Array.isArray(orig?.seenBy) && orig.seenBy.some((s: any) =>
          typeof s === 'string' ? s === currentUserId : (s?._id === currentUserId || s?.id === currentUserId)
        );
        return (
          <a href={href} className={isSeen ? 'block h-full w-full text-gray-400' : 'block h-full w-full text-gray-900'}
            onClick={(e) => handleApplicantLinkClick(e, row)} onAuxClick={handleApplicantLinkAuxClick}>
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
      enableSorting: false,
      Cell: ({ row }: { row: { original: Applicant } }) => {
        if (isTableLoading) return renderCellSkeleton();
        const href = getApplicantHref(row);
        return (
          <a href={href} className="block h-full w-full text-inherit"
            onClick={(e) => handleApplicantLinkClick(e, row)} onAuxClick={handleApplicantLinkAuxClick}>
            {row.original.email || '-'}
          </a>
        );
      },
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      size: columnSizeConfig.phone,
      enableColumnFilter: true,
      enableSorting: false,
      Cell: ({ row }: { row: { original: Applicant } }) => {
        if (isTableLoading) return renderCellSkeleton();
        const href = getApplicantHref(row);
        return (
          <a href={href} className="block h-full w-full text-inherit"
            onClick={(e) => handleApplicantLinkClick(e, row)} onAuxClick={handleApplicantLinkAuxClick}>
            {row.original.phone || '-'}
          </a>
        );
      },
    },
    {
      id: 'gender',
      accessorFn: (row: any) => normalizeGender(
        row.gender || row.customResponses?.gender || row.customResponses?.['النوع'] || (row as any)['النوع'] || ''
      ),
      header: 'Gender',
      size: columnSizeConfig.gender,
      enableColumnFilter: true,
      enableSorting: false,
      Cell: ({ row }: { row: { original: any } }) => {
        if (isTableLoading) return renderCellSkeleton();
        const href = getApplicantHref(row);
        const g = normalizeGender(row.original.gender || row.original.customResponses?.gender || '');
        return (
          <a href={href} className="block h-full w-full text-inherit"
            onClick={(e) => handleApplicantLinkClick(e, row)} onAuxClick={handleApplicantLinkAuxClick}>
            {g || '-'}
          </a>
        );
      },
    },
    ...(showCompanyColumn ? [{
      id: 'companyId',
      header: 'Company',
      size: columnSizeConfig.companyId,
      enableColumnFilter: true,
      enableSorting: false,
      accessorFn: (row: any) => {
        const getId = (v: any) => typeof v === 'string' ? v : (v?._id ?? v?.id ?? '');
        const job = jobPositionMap[getId(row?.jobPositionId)];
        return job?.companyId ? (typeof job.companyId === 'string' ? job.companyId : job.companyId._id || '') : '';
      },
      Cell: ({ row }: { row: { original: Applicant } }) => {
        if (isTableLoading) return renderCellSkeleton();
        const getId = (v: any) => typeof v === 'string' ? v : (v?._id ?? v?.id ?? '');
        const job = jobPositionMap[getId(row.original.jobPositionId)];
        const href = getApplicantHref(row);
        const compName = job?.companyId
          ? (() => {
              const cId = typeof job.companyId === 'string' ? job.companyId : job.companyId._id || '';
              return toPlainString(companyMap[cId]?.name) || companyMap[cId]?.title || 'N/A';
            })()
          : 'N/A';
        return (
          <a href={href} className="block h-full w-full text-inherit"
            onClick={(e) => handleApplicantLinkClick(e, row)} onAuxClick={handleApplicantLinkAuxClick}>
            {compName}
          </a>
        );
      },
    }] : []),
    {
      id: 'jobPositionId',
      header: isLaptopViewport ? 'Job' : 'Job Position',
      size: columnSizeConfig.jobPositionId,
      enableColumnFilter: true,
      enableSorting: false,
      accessorFn: (row: any) => {
        const getId = (v: any) => typeof v === 'string' ? v : (v?._id ?? v?.id ?? '');
        return getId(row?.jobPositionId);
      },
      Cell: ({ row }: { row: { original: Applicant } }) => {
        if (isTableLoading) return renderCellSkeleton();
        const getId = (v: any) => { if (!v) return ''; if (typeof v === 'string') return v; return v._id ?? v.id ?? ''; };
        const jobId = getId(row.original.jobPositionId);
        const job = jobPositionMap[jobId];
        const title = typeof job?.title === 'string' ? job.title
          : (job?.title?.en ?? jobOptions.find((o) => o.id === jobId)?.title ?? 'N/A');
        const href = getApplicantHref(row);
        return (
          <a href={href} className="block h-full w-full text-sm font-medium text-inherit"
            onClick={(e) => handleApplicantLinkClick(e, row)} onAuxClick={handleApplicantLinkAuxClick}>
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
      enableSorting: false,
      accessorFn: (row: any) => getExpectedSalaryDisplay(row),
      Cell: ({ row }: { row: { original: Applicant } }) => {
        if (isTableLoading) return renderCellSkeleton();
        const href = getApplicantHref(row);
        return (
          <a href={href} className="block h-full w-full text-inherit"
            onClick={(e) => handleApplicantLinkClick(e, row)} onAuxClick={handleApplicantLinkAuxClick}>
            {getExpectedSalaryDisplay(row.original) || '-'}
          </a>
        );
      },
    },
    // ── REJECTION REASONS (read-only) ─────────────────────────────────────────
    {
      id: 'rejectionReasons',
      header: 'Rejection Reasons',
      size: columnSizeConfig.reasons,
      enableColumnFilter: true,
      enableSorting: false,
      // Flat string for built-in text search/filter
      accessorFn: (row: any) => resolveRejectionReasons(row).join(' | '),
      Cell: ({ row }: { row: { original: any } }) => {
        if (isTableLoading) return renderCellSkeleton('text', '80%');
        const reasons = resolveRejectionReasons(row.original);
        return (
          // Prevent row-click while interacting with badge expand buttons
          <div onClick={(e) => e.stopPropagation()} className="w-full py-0.5">
            <ReasonsBadges reasons={reasons} />
          </div>
        );
      },
    },
    // ─────────────────────────────────────────────────────────────────────────
    {
      accessorKey: 'submittedAt',
      header: 'Submitted',
      Header: ({ column, table }: { column: any; table: any }) => {
        const s = table.getState().sorting.find((s: any) => s.id === column.id);
        const desc = s ? s.desc : true;
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); table.setSorting([{ id: column.id, desc: !desc }]); }}
            className="flex items-center gap-1 text-sm font-medium"
          >
            <span>Submitted</span>
            <span className="text-xs">{desc ? '▼' : '▲'}</span>
          </button>
        );
      },
      size: columnSizeConfig.submittedAt,
      enableColumnFilter: false,
      enableSorting: true,
      muiTableHeadCellProps: { className: 'hide-default-sort-icon' },
      sortingFn: (rowA: any, rowB: any, columnId: string) => {
        const t = (r: any) => { const v = r.getValue(columnId) ?? r.original?.submittedAt; const ts = v ? new Date(v).getTime() : 0; return Number.isNaN(ts) ? 0 : ts; };
        const a = t(rowA), b = t(rowB);
        return a === b ? 0 : a > b ? 1 : -1;
      },
      Cell: ({ row }: any) => {
        if (isTableLoading) return renderCellSkeleton();
        const href = getApplicantHref(row);
        return (
          <a href={href} className="block h-full w-full text-inherit"
            onClick={(e) => handleApplicantLinkClick(e, row)} onAuxClick={handleApplicantLinkAuxClick}>
            {formatDate(row.original.submittedAt)}
          </a>
        );
      },
    },
  ], [
    companyMap, jobPositionMap, jobOptions, showCompanyColumn,
    columnSizeConfig, isLaptopViewport, isTableLoading,
    formatDate, getExpectedSalaryDisplay, currentUserId,
  ]);

  // ---------- MUI theme ----------
  const muiTheme = useMemo(() => createTheme({
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: { main: '#e42e2b' },
      background: {
        default: isDarkMode ? '#24303F' : '#FFFFFF',
        paper:   isDarkMode ? '#24303F' : '#FFFFFF',
      },
      text: {
        primary:   isDarkMode ? '#E4E7EC' : '#101828',
        secondary: isDarkMode ? '#98A2B3' : '#667085',
      },
      divider: isDarkMode ? '#344054' : '#E4E7EC',
    },
    components: {
      MuiPaper:          { styleOverrides: { root: { backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF', backgroundImage: 'none' } } },
      MuiTable:          { styleOverrides: { root: { backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF' } } },
      MuiTableContainer: { styleOverrides: { root: { backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF' } } },
      MuiTableBody:      { styleOverrides: { root: { backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF' } } },
      MuiTableHead:      { styleOverrides: { root: { backgroundColor: isDarkMode ? '#1C2434' : '#F9FAFB' } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: isDarkMode ? '#344054' : '#E4E7EC', backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF', color: isDarkMode ? '#E4E7EC' : '#101828' },
          head: { backgroundColor: isDarkMode ? '#1C2434' : '#F9FAFB', color: isDarkMode ? '#E4E7EC' : '#344054', fontWeight: 600 },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: { backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF', '&:hover': { backgroundColor: isDarkMode ? '#344054' : '#F9FAFB' } },
        },
      },
      MuiIconButton: { styleOverrides: { root: { color: isDarkMode ? '#98A2B3' : '#667085' } } },
      MuiCheckbox: {
        defaultProps: { size: 'large' },
        styleOverrides: {
          root: { color: isDarkMode ? '#667085' : '#98A2B3', padding: '2px', '& .MuiSvgIcon-root': { fontSize: '2rem' }, '&.Mui-checked': { color: '#e42e2b' } },
        },
      },
      MuiToolbar: { styleOverrides: { root: { backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF', color: isDarkMode ? '#E4E7EC' : '#101828' } } },
    },
  }), [isDarkMode]);

  const skeletonData = useMemo(
    () => Array.from({ length: pagination?.pageSize || 10 }).map((_: any, i) => ({ _id: `skeleton-${i}`, _skeleton: true })),
    [pagination?.pageSize]
  );
  const tableData = isTableLoading ? skeletonData : deferredRejected;
  const responsiveColumnVisibility = useMemo(() => layout.columnVisibility || {}, [layout.columnVisibility]);

  // Mobile filtered / paginated list (simple search by name/email/phone)
  const mobileFiltered = useMemo(() => {
    try {
      const list = Array.isArray(deferredRejected) ? deferredRejected.slice() : [];
      const q = (mobileQuery || '').trim().toLowerCase();
      if (!q) return list;
      return list.filter((a: any) => {
        const s = `${String(a?.fullName||'')} ${String(a?.email||'')} ${String(a?.phone||'')}`.toLowerCase();
        return s.includes(q);
      });
    } catch (e) { return Array.isArray(deferredRejected) ? deferredRejected : []; }
  }, [deferredRejected, mobileQuery]);

  const mobileTotalPages = Math.max(1, Math.ceil((mobileFiltered || []).length / pagination.pageSize));
  const mobilePaginated = (mobileFiltered || []).slice(pagination.pageIndex * pagination.pageSize, (pagination.pageIndex + 1) * pagination.pageSize);
  useEffect(() => { if (pagination.pageIndex >= mobileTotalPages) setPagination((p) => ({ ...p, pageIndex: 0 })); }, [mobileTotalPages]);

  // Ensure column filters don't reference the Company column when it's hidden
  const effectiveColumnFilters = useMemo(() => {
    try {
      if (!Array.isArray(columnFilters)) return columnFilters;
      if (showCompanyColumn) return columnFilters;
      return columnFilters.filter((f: any) => f?.id !== 'companyId');
    } catch (e) {
      return columnFilters;
    }
  }, [columnFilters, showCompanyColumn]);

  // ---------- table ----------
  const table = useMaterialReactTable({
    columns,
    data: tableData as any,
    displayColumnDefOptions: {
      'mrt-row-select': {
        size: selectColumnWidth,
        muiTableHeadCellProps: { align: 'center', sx: { padding: 0, width: `${selectColumnWidth}px`, minWidth: `${selectColumnWidth}px`, maxWidth: `${selectColumnWidth}px` } },
        muiTableBodyCellProps: { align: 'center', sx: { padding: 0, width: `${selectColumnWidth}px`, minWidth: `${selectColumnWidth}px`, maxWidth: `${selectColumnWidth}px` } },
        Cell: ({ row, table }: any) => {
          const href = getApplicantHref(row);
          return (
            <div className="relative flex items-center justify-center p-2">
              <a href={href} className="absolute inset-0 z-0 block"
                onClick={(e) => handleApplicantLinkClick(e, row)} onAuxClick={handleApplicantLinkAuxClick}
                aria-label={`Open ${row.original?.fullName || 'applicant'} details`} />
              <div className="relative z-10" onClick={(e) => e.stopPropagation()} onAuxClick={(e) => e.stopPropagation()}>
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
    enableTopToolbar: false,        // no toolbar needed — this page is read-only
    enableColumnFilters: true,
    enableFilters: true,
    enableHiding: true,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableSorting: true,
    enableColumnActions: false,
    enableColumnResizing: true,
    layoutMode: 'grid',
    manualPagination: false,
    manualFiltering: false,
    manualSorting: false,
    rowCount: isTableLoading ? tableData.length : deferredRejected.length,
    initialState: {
      pagination,
      columnFilters: effectiveColumnFilters,
      columnVisibility: responsiveColumnVisibility,
      density: 'compact',
      columnOrder: Array.isArray(layout.columnOrder) && layout.columnOrder.length
        ? layout.columnOrder
        : Array.from(new Set([
            'mrt-row-select',
            ...columns.map((c) => (c as any).id ?? (c as any).accessorKey).filter(Boolean),
          ])),
    },
    state: { sorting, pagination, columnFilters: effectiveColumnFilters, rowSelection, columnVisibility: responsiveColumnVisibility },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: (updater) => saveLayout({ columnVisibility: typeof updater === 'function' ? updater(layout.columnVisibility) : updater }),
    onColumnSizingChange:     (updater) => saveLayout({ columnSizing:    typeof updater === 'function' ? updater(layout.columnSizing)    : updater }),
    onColumnOrderChange:      (updater) => saveLayout({ columnOrder:     typeof updater === 'function' ? updater(layout.columnOrder)     : updater }),
    getRowId: (row) => row._id,
    muiTablePaperProps: { sx: { backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF', backgroundImage: 'none' } },
    muiTableProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        tableLayout: 'auto', width: '100%', minWidth: `${tableMinWidth}px`,
        fontFamily: "'Cairo', Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans'",
        fontSize: '0.82rem',
      },
    },
    muiTableContainerProps: { sx: { maxWidth: '100%', overflowX: 'auto' } },
    muiTableBodyProps:      { sx: { backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF' } },
    muiTableHeadProps:      { sx: { backgroundColor: isDarkMode ? '#1C2434' : '#F9FAFB' } },
    muiTableBodyCellProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        color: isDarkMode ? '#E4E7EC' : '#101828',
        borderColor: isDarkMode ? '#344054' : '#E4E7EC',
        display: 'flex', alignItems: 'center',
        fontSize: isLaptopViewport ? '0.76rem' : '0.8rem',
        lineHeight: 1.25,
        padding: isLaptopViewport ? '5px 6px' : '6px 8px',
        fontFamily: "'Cairo', Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans'",
        // Allow the reasons cell to wrap badges naturally
        whiteSpace: 'normal',
        overflow: 'visible',
        '& > a': { display: 'flex', alignItems: 'center', width: '100%', height: '100%', color: 'inherit', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        '& .Mui-TableBodyCell-Content': { display: 'flex', alignItems: 'center', width: '100%', minHeight: '100%' },
      },
    },
    muiTableHeadCellProps: {
      sx: {
        backgroundColor: isDarkMode ? '#1C2434' : '#F9FAFB',
        color: isDarkMode ? '#E4E7EC' : '#344054',
        borderColor: isDarkMode ? '#344054' : '#E4E7EC',
        display: 'flex', alignItems: 'center', fontWeight: 600,
        fontSize: isLaptopViewport ? '0.74rem' : '0.78rem',
        lineHeight: 1.2, padding: isLaptopViewport ? '7px 6px' : '8px 8px',
        fontFamily: "'Cairo', Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans'",
        whiteSpace: 'nowrap',
        '& .Mui-TableHeadCell-Content': { display: 'flex', alignItems: 'center', width: '100%', minHeight: '100%' },
        '& .Mui-TableHeadCell-Content-Wrapper': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
        '& .MuiTableSortLabel-icon': { opacity: 0, transition: 'opacity 150ms ease' },
        '& .MuiTableSortLabel-root.MuiTableSortLabel-active .MuiTableSortLabel-icon': { opacity: 1 },
        '& .MuiIconButton-root': { display: 'none !important' },
        overflow: 'visible', zIndex: 2,
      },
    },
    muiBottomToolbarProps: { sx: { backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF', color: isDarkMode ? '#E4E7EC' : '#101828' } },
    muiTableBodyRowProps: ({ row }) => ({
      onClick: (e: any) => {
        if (e?.ctrlKey || e?.metaKey) { openApplicantDetailsInNewTab(row); return; }
        navigate(`/applicant-details/${row.id}`, { state: { applicant: row.original } });
      },
      onAuxClick: (e: any) => {
        if (e?.button === 1) { e.preventDefault(); e.stopPropagation(); openApplicantDetailsInNewTab(row); }
      },
      sx: {
        cursor: 'pointer',
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        '&:hover': { backgroundColor: isDarkMode ? '#344054' : '#F9FAFB' },
      },
    }),
  });

  // ---------- render ----------
  return (
    <>
      <PageMeta title="Rejected Applicants" description="View rejected applicants and their reasons" />
      <PageBreadcrumb
        pageTitle="Rejected Applicants"
        
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  const ps: Promise<any>[] = [];
                  if (isJobPositionsFetched && refetchJobPositions) ps.push(refetchJobPositions());
                  if (isApplicantsFetched && refetchApplicants)     ps.push(refetchApplicants());
                  if (isCompaniesFetched && refetchCompanies)       ps.push(refetchCompanies());
                  if (!ps.length) return;
                  await Promise.all(ps);
                  if (mountedRef.current) setLastRefetch(new Date());
                } catch {}
              }}
              disabled={isJobPositionsFetching || isApplicantsFetching || isCompaniesFetching}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
            >
              {isJobPositionsFetching || isApplicantsFetching || isCompaniesFetching ? 'Updating…' : 'Update Data'}
            </button>

            <span className="text-sm text-gray-500">
              {elapsed ? `Last Update: ${elapsed}` : 'Not updated yet'}
            </span>
          </div>
        }
      />

      <div className="grid gap-6">
        <ComponentCard title="Rejected Applicants" desc="All applicants with rejected status, showing rejection reasons from their status history">
          <>
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                {String(error)}
              </div>
            )}

            {isSmallViewport ? (
              <div className="space-y-4">
                <div className="mb-2">
                  <input
                    value={mobileQuery}
                    onChange={(e) => { setMobileQuery(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
                    placeholder="Search by name, email, or phone..."
                    className="w-full pl-3 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none"
                  />
                </div>

                {isTableLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <LoadingSpinner />
                    <p className="text-sm text-gray-500 mt-3">Loading applicants...</p>
                  </div>
                ) : (mobileFiltered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500">
                    <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center text-2xl">👥</div>
                    <p className="mt-4 font-semibold">No applicants found</p>
                    <p className="text-sm">Try adjusting your search query or filters.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(mobilePaginated || []).map((a: any) => {
                      const href = `/applicant-details/${String(a?._id || a?.id || '')}`;
                      const jobId = (a?.jobPositionId && (typeof a.jobPositionId === 'string' ? a.jobPositionId : a.jobPositionId._id || a.jobPositionId.id)) || '';
                      const job = jobPositionMap[jobId];
                      const jobTitle = typeof job?.title === 'string' ? job.title : job?.title?.en || '';
                      const companyIdOf = (a?.companyId && (typeof a.companyId === 'string' ? a.companyId : a.companyId._id || a.companyId.id)) || '';
                      const companyName = toPlainString(companyMap[companyIdOf]?.name) || companyMap[companyIdOf]?.title || '';
                      const reasons = resolveRejectionReasons(a) || [];
                      return (
                        <a key={String(a?._id || a?.id || Math.random())} href={href} onClick={(e) => { e.preventDefault(); navigate(href, { state: { applicant: a } }); }} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                          <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100">
                            {a?.profilePhoto ? <ImageThumbnail src={a.profilePhoto} alt={a.fullName} /> : <div className="flex h-full w-full items-center justify-center text-sm">{(a?.fullName||'').charAt(0)}</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="truncate font-medium text-sm">{a?.fullName || '-'}</div>
                              <div className="text-xs text-gray-400">{formatDate(a?.submittedAt)}</div>
                            </div>
                            <div className="text-xs text-gray-500 truncate">{jobTitle}{companyName ? ` • ${companyName}` : ''}</div>
                            <div className="mt-2"><ReasonsBadges reasons={reasons} /></div>
                          </div>
                        </a>
                      );
                    })}

                    <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
                      <div>Showing {mobileFiltered.length === 0 ? 0 : (pagination.pageIndex * pagination.pageSize) + 1}-{Math.min((pagination.pageIndex + 1) * pagination.pageSize, mobileFiltered.length)} of {mobileFiltered.length}</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setPagination((p) => ({ ...p, pageIndex: Math.max(0, p.pageIndex - 1) }))} disabled={pagination.pageIndex <= 0} className="px-3 py-1 rounded bg-white border">Prev</button>
                        <button onClick={() => setPagination((p) => ({ ...p, pageIndex: Math.min(mobileTotalPages - 1, p.pageIndex + 1) }))} disabled={(pagination.pageIndex + 1) >= mobileTotalPages} className="px-3 py-1 rounded bg-white border">Next</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ThemeProvider theme={muiTheme}>
                <div className="w-full overflow-x-auto custom-scrollbar">
                  <MaterialReactTable table={table} />
                </div>
              </ThemeProvider>
            )}
          </>
        </ComponentCard>
      </div>

      {/* Photo preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] p-4">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300"
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

export default RejectedApplicants;
