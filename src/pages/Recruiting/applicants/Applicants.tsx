import { useState, useMemo, useCallback, useEffect, useRef } from "react";
// simple in-memory cache for compressed thumbnails
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
      try { _thumbnailCache.set(src, result); } catch (e) {}
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

        let dataUrl = tryQualities([0.9,0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.15,0.1]);
        if (dataUrl) return finish(dataUrl);

        // progressively downscale and retry
        let w = canvas.width;
        let h = canvas.height;
        while ((w > 32 || h > 32) && !dataUrl) {
          w = Math.max(24, Math.floor(w * 0.75));
          h = Math.max(24, Math.floor(h * 0.75));
          canvas.width = w; canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          dataUrl = tryQualities([0.6,0.4,0.25,0.15,0.1]);
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
    try { img.src = src; } catch (e) { finish(src); }
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
      return () => { mounted = false; };
    }
    if (typeof src === 'string' && src.startsWith('data:')) {
      setThumb(src);
      return () => { mounted = false; };
    }

    (async () => {
      try {
        const compressed = await createCompressedDataUrl(src as string, 5120);
        if (mounted) setThumb(compressed || src as string);
      } catch (e) {
        if (mounted) setThumb(src as string);
      }
    })();

    return () => { mounted = false; };
  }, [src]);

  if (!thumb) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500 dark:text-gray-400">
        {(alt && alt.charAt(0)) ? alt.charAt(0).toUpperCase() : '-'}
      </div>
    );
  }

  return (
    <img loading="lazy" src={thumb} alt={alt || ''} className="h-full w-full object-cover" />
  );
}
import Swal from "sweetalert2";
import ApplicantsMobilePage from "./ApplicantsMobilePage";
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
import BulkMessageModal from '../../../components/modals/BulkMessageModal';
import { Menu, MenuItem, Checkbox, ListItemText } from "@mui/material";
import  { normalizeLabelSimple, canonicalMap, getCanonicalType, buildFieldToJobIds, isExcludedLabel } from "../../../components/modals/CustomFilterModal";
import type { Applicant } from "../../../store/slices/applicantsSlice";
import { toPlainString } from "../../../utils/strings";
import CustomFilterModal from "../../../components/modals/CustomFilterModal";

const Applicants = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isSuperAdmin = useMemo(() => {
    const roleName = user?.roleId?.name;
    return typeof roleName === 'string' && roleName.toLowerCase() === 'super admin';
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

  // Context menu state (declared early so menu position memo can read it)
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    row?: any;
  }>({ open: false, x: 0, y: 0 });

  const menuPos = useMemo(() => {
    if (!contextMenu.open) return { x: 0, y: 0 };
    try {
      const maxW = Math.max(0, window.innerWidth - 220);
      const maxH = Math.max(0, window.innerHeight - 160);
      const x = Math.max(8, Math.min(contextMenu.x, maxW));
      const y = Math.max(8, Math.min(contextMenu.y, maxH));
      return { x, y };
    } catch (err) {
      return { x: contextMenu.x || 0, y: contextMenu.y || 0 };
    }
  }, [contextMenu.open, contextMenu.x, contextMenu.y]);

  const saveTableState = () => {
    try {
      const state = table.getState();
      const toSave: any = {
        pagination: state.pagination,
        sorting: state.sorting,
        columnFilters: state.columnFilters,
      };
      try {
        // include customFilters if present in component scope
        if (Array.isArray((window as any).__app_customFilters)) {
          toSave.customFilters = (window as any).__app_customFilters;
        }
      } catch {}
      const str = JSON.stringify(toSave);
      sessionStorage.setItem('applicants_table_state', str);
      try { localStorage.setItem('applicants_table_state', str); } catch (e) { /* ignore */ }
    } catch (e) {
      // ignore
    }
  };

  // Local state

  const [isDeleting, setIsDeleting] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  // MRT will manage pagination internally (page size set in initialState)
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(persistedTableState?.columnFilters ?? []);
  // MRT sorting state (control sorting externally so we can offer only asc/desc for Submitted)
  const [sorting, setSorting] = useState<Array<any>>(persistedTableState?.sorting ?? [{ id: 'submittedAt', desc: true }]);
  // Pagination state persisted
  const [pagination, setPagination] = useState(() => persistedTableState?.pagination ?? { pageIndex: 0, pageSize: 10 });
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
  // If the Company column has an active filter, prefer that companyId(s)
  const selectedCompanyFilter = useMemo(() => {
    try {
      const cf = Array.isArray(columnFilters) ? columnFilters.find((c: any) => c.id === 'companyId') : undefined;
      if (!cf) return undefined;
      const v = cf.value;
      if (!v) return undefined;
      if (Array.isArray(v) && v.length) return v;
      return typeof v === 'string' ? [v] : undefined;
    } catch (e) {
      return undefined;
    }
  }, [columnFilters]);

  const jobPositionCompanyParam = selectedCompanyFilter ?? companyId;
const { data: jobPositions = [], isLoading: jobPositionsLoading, refetch: refetchJobPositions, isFetching: isJobPositionsFetching, isFetched: isJobPositionsFetched } =
   useJobPositions(jobPositionCompanyParam);
const {
   data: applicants = [],
   isLoading: applicantsLoading,
   error,
   refetch: refetchApplicants,
   isFetching: isApplicantsFetching,
   isFetched: isApplicantsFetched,
 } = useApplicants(companyId as any);
 // Load companies early so memos below can reference `allCompaniesRaw`
 const { data: allCompaniesRaw = [], refetch: refetchCompanies, isFetching: isCompaniesFetching, isFetched: isCompaniesFetched } = useCompanies(companyId as any);
  const selectedApplicantEmails = useMemo(() => {
    try {
      const ids = new Set(selectedApplicantIds);
      return applicants
        .filter((a: any) => {
          const id = typeof a._id === 'string' ? a._id : a._id?._id || a.id || a._id;
          return ids.has(id);
        })
        .map((a: any) => a.email)
        .filter(Boolean);
    } catch (e) { return []; }
  }, [selectedApplicantIds, applicants]);
  // If we already loaded companies, resolve the full company object for the selected applicants
  // If all selected applicants belong to the same company, provide that company id
  const selectedApplicantCompanyId = useMemo(() => {
    try {
      const ids = new Set(selectedApplicantIds);
      const companies = applicants
        .filter((a: any) => {
          const id = typeof a._id === 'string' ? a._id : a._id?._id || a.id || a._id;
          return ids.has(id);
        })
        .map((a: any) => {
          // possible company id fields
          const c = a.company || a.companyObj || (a.jobPositionId && (a.jobPositionId.companyId || a.jobPositionId.company || a.jobPositionId.companyObj));
          if (!c) return null;
          return typeof c === 'string' ? c : c._id || c.id || null;
        })
        .filter(Boolean) as string[];
      const unique = Array.from(new Set(companies));
      return unique.length === 1 ? unique[0] : null;
    } catch (e) { return null; }
  }, [selectedApplicantIds, applicants]);

  // If we already loaded companies, resolve the full company object for the selected applicants
  const selectedApplicantCompany = useMemo(() => {
    try {
      if (!selectedApplicantCompanyId) return null;
      const found = (allCompaniesRaw || []).find((c: any) => c && (c._id === selectedApplicantCompanyId || c.id === selectedApplicantCompanyId));
      return found || null;
    } catch (e) {
      return null;
    }
  }, [selectedApplicantCompanyId, allCompaniesRaw]);
 const updateStatusMutation = useUpdateApplicantStatus();
 const [lastRefetch, setLastRefetch] = useState<Date | null>(null);
 const [elapsed, setElapsed] = useState<string | null>(null);
 const [statusAnchorEl, setStatusAnchorEl] = useState<HTMLElement | null>(null);
 const [jobAnchorEl, setJobAnchorEl] = useState<HTMLElement | null>(null);
 const [bulkStatusError, setBulkStatusError] = useState("");
 const [bulkDeleteError, setBulkDeleteError] = useState("");
 


 
  useEffect(() => {
    if (!lastRefetch && (isJobPositionsFetched || isApplicantsFetched || isCompaniesFetched)) {
      setLastRefetch(new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJobPositionsFetched, isApplicantsFetched, isCompaniesFetched]);

  useEffect(() => {
    if (!lastRefetch) {
      setElapsed(null);
      return;
    }
    const formatRelative = (d: Date) => {
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 60) return "now";
      const mins = Math.floor(diffSec / 60);
      if (mins < 60) return `${mins} min ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      const days = Math.floor(hours / 24);
      if (days === 1) return "yesterday";
      if (days < 7) return `${days} days ago`;
      return d.toLocaleDateString();
    };

    const update = () => setElapsed(formatRelative(lastRefetch));
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

  // Helpers to resolve and download CVs for applicants (copied logic from ApplicantData)
  const buildCloudinaryDownloadUrl = (u: string, idHint?: string) => {
    try {
      if (!u) return null;
      const urlParts = u.split('/upload/');
      if (urlParts.length !== 2) return null;
      const fileName = `CV_${idHint || 'cv'}`;
      const transformations = `f_auto/fl_attachment:${fileName}`;
      const downloadUrl = `${urlParts[0]}/upload/${transformations}/${urlParts[1]}`;
      return downloadUrl;
    } catch (e) {
      return null;
    }
  };

  const downloadViaFetch = async (u: string, filename?: string) => {
    try {
      const res = await fetch(u, { mode: 'cors' });
      if (!res.ok) throw new Error('Network response not ok');
      const blob = await res.blob();
      const a = document.createElement('a');
      const blobUrl = URL.createObjectURL(blob);
      a.href = blobUrl;
      a.download = filename || (u.split('/').pop() || 'download');
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
    try {
      if (!a) return null;
      // Common fields that may contain a CV or resume path
      const keys = ['cvFilePath','cvUrl','resume','cv','attachments','resumeUrl','cvFilePath','cvFile','resumeFilePath','resumeFile','cv_file_path','cv_file','cv_path'];
      for (const k of keys) {
        const v = (a as any)[k];
        if (!v) continue;
        if (typeof v === 'string' && v.trim()) return v;
        if (Array.isArray(v) && v.length) {
          const first = v.find((it) => typeof it === 'string' && it.trim());
          if (first) return first;
        }
      }
      // search custom responses for keys mentioning cv/resume
      const resp = a?.customResponses || a?.customFieldResponses || {};
      for (const [k, v] of Object.entries(resp || {})) {
        const lk = String(k || '').toLowerCase();
        if (lk.includes('cv') || lk.includes('resume') || lk.includes('cvfile') || lk.includes('cv_file') || lk.includes('cvfilepath')) {
          if (typeof v === 'string' && v.trim()) return v as string;
          if (Array.isArray(v) && v.length) {
            const f = v.find((it) => typeof it === 'string' && it.trim());
            if (f) return f as string;
          }
        }
        if (typeof v === 'string' && /https?:\/\/.+\.(pdf|docx?|rtf|txt|zip)$/i.test(v)) return v as string;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const downloadCvForApplicant = async (a: any) => {
    if (!a) return Swal.fire('No CV', 'No CV file available for this applicant', 'info');
    const path = resolveCvPath(a);
    if (!path) return Swal.fire('No CV', 'No CV file available for this applicant', 'info');

    const url = (() => {
      if (!path) return null;
      if (typeof path === 'string' && (path.startsWith('http') || path.startsWith('data:'))) return path;
      const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      return base ? `${base}/${String(path).replace(/^\//, '')}` : String(path);
    })();

    const cloudUrl = buildCloudinaryDownloadUrl(url || '', (a?.applicantNo || a?._id || '').toString());
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

  // Field-exclusion and canonical helpers are provided by CustomFilterModal
  // via named exports. See src/components/modals/CustomFilterModal.tsx

  // Which job positions are currently selected in the Job Position column filter
 

  // Map normalized field keys -> set of jobPosition ids that declare that field
  const fieldToJobIds = useMemo(() => buildFieldToJobIds(jobPositions), [jobPositions]);
  

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
    if (arabicFemale.includes(s) || arabicFemale.includes(lower)) return 'Female';
    if (lower === 'male' || lower === 'm') return 'Male';
    if (lower === 'female' || lower === 'f') return 'Female';
    // fallback: title-case the original
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

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

  // availableCustomFields was replaced by dedupedCustomFields; keep jobPositions dependency above

  // Custom filters configured via the modal (rehydrate from persisted table state)
  const [customFilters, setCustomFilters] = useState<Array<any>>(persistedTableState?.customFilters ?? []);
  useEffect(() => {
    try { (window as any).__app_customFilters = customFilters; } catch { }
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
      try { localStorage.setItem('applicants_table_state', str); } catch (e) { /* ignore */ }
    } catch (e) {
      // ignore
    }
  }, [customFilters]);

  // Clear persisted localStorage state when navigating away from Applicants/ApplicantData pages
  useEffect(() => {
    return () => {
      // run after navigation completes so pathname reflects destination
      setTimeout(() => {
        try {
          const p = window.location.pathname || '';
          const inApplicantsPages = p.startsWith('/applicant') || p.startsWith('/applicants');
          if (!inApplicantsPages) {
            try { localStorage.removeItem('applicants_table_state'); } catch (e) { /* ignore */ }
            try { sessionStorage.removeItem('applicants_table_state'); } catch (e) { /* ignore */ }
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


  // Determine dataset to pass to MRT: by default exclude trashed applicants unless
  // the user explicitly filters for status === 'trashed'. This makes "All Statuses"
  // hide trashed rows while still allowing an explicit trashed view.
  const displayedApplicants = useMemo(() => {
    const statusFilter = columnFilters.find((f) => f.id === 'status');
    const statusVal = statusFilter?.value;

    // Super admin: allow viewing trashed when explicitly filtered
    if (isSuperAdmin) {
      if (statusVal === 'trashed') return applicants;
      if (Array.isArray(statusVal) && statusVal.length > 0) {
        return applicants.filter((a: Applicant) => statusVal.includes(a.status));
      }
      return applicants.filter((a: Applicant) => a.status !== 'trashed');
    }

    // Non-super-admin: never show trashed applicants regardless of filters
    if (Array.isArray(statusVal) && statusVal.length > 0) {
      const allowed = statusVal.filter((s: any) => s !== 'trashed');
      if (allowed.length === 0) return applicants.filter((a: Applicant) => a.status !== 'trashed');
      return applicants.filter((a: Applicant) => allowed.includes(a.status) && a.status !== 'trashed');
    }

    return applicants.filter((a: Applicant) => a.status !== 'trashed');
  }, [applicants, columnFilters, isSuperAdmin]);

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
      if (responses && Object.prototype.hasOwnProperty.call(responses, key)) return responses[key];
      if (top && Object.prototype.hasOwnProperty.call(top, key)) return top[key];
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
    const norm = (s: any) => (s || '').toString().replace(/\u200E|\u200F/g, '').replace(/[^\w\u0600-\u06FF\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
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
      const allowed = canonicalMap[canonical].map((s) => normalizeLabelSimple(s));
      for (const [k, v] of Object.entries(responses || {})) {
        try {
          const nk = normalizeLabelSimple(k);
          if (allowed.includes(nk) || allowed.some((al) => nk.includes(al) || al.includes(nk))) return v;
        } catch (e) {
          // ignore
        }
      }
      // no matching key found for canonical field -> return empty
      return '';
    }
    // search both responses map and top-level applicant fields
    for (const [k, v] of Object.entries({ ...(responses || {}), ...(top || {}) })) {
      const nk = norm(k);
      if (targetSet.has(nk)) return v;
      // also try underscore/space variants of the key
      if (targetSet.has(nk.replace(/\s+/g, '_'))) return v;
      if (targetSet.has(nk.replace(/_/g, ' '))) return v;
    }

    // 5) Heuristics for numeric/range fields: try to find a numeric candidate
    const matchesSalaryLabel = (/salary|expected salary|الراتب|الراتب المتوقع|راتب/).test(((f.label?.en || '') + ' ' + (f.label?.ar || '')).toString().toLowerCase());
    if (f.type === 'range' || matchesSalaryLabel) {
      for (const v of Object.values({ ...(responses || {}), ...(top || {}) })) {
        // primitive number
        if (typeof v === 'number') return v;
        // string with digits (e.g., "5,000 SAR")
        if (typeof v === 'string' && /\d|[\u0660-\u0669\u06F0-\u06F9]/.test(v)) return v;
        if (Array.isArray(v)) {
          const found = v.find((it) => (typeof it === 'number') || (typeof it === 'string' && /\d/.test(it)));
          if (found !== undefined) return found;
        }
        if (typeof v === 'object' && v !== null) {
          const candidateKeys = ['value','val','amount','salary','expectedSalary','min','max','amountValue','numeric','0'];
          for (const ck of candidateKeys) {
            if (Object.prototype.hasOwnProperty.call(v, ck)) {
              const cand = (v as any)[ck];
              if (cand !== undefined && cand !== null && (typeof cand === 'number' || (typeof cand === 'string' && /\d/.test(cand)))) return cand;
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
      return (o.id ?? o._id ?? o.value ?? o.val ?? o.en ?? o.ar ?? o.label ?? o.name ?? '') + '';
    };

    if (Array.isArray(raw)) return raw.map(pickFromObject).filter((s) => s !== '');
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

  const normalizeForCompare = (s: any) => (s || '').toString().replace(/\u200E|\u200F/g, '').trim().toLowerCase();

  const expandForms = (s: string) => {
    const out = new Set<string>();
    if (!s) return [] as string[];
    out.add(s);
    out.add(s.replace(/\s+/g, '_'));
    out.add(s.replace(/_/g, ' '));
    return Array.from(out);
  };

  const filteredApplicants = useMemo(() => {
    if (!customFilters || !customFilters.length) return displayedApplicants;
    return displayedApplicants.filter((a: any) => {
      try {
        for (const f of customFilters) {
          let raw = getCustomResponseValue(a, f);
          // Override for hardcoded personal-info filters that are not stored
          // as job custom fields.
          try {
            if (f.fieldId === '__gender') {
              raw = a?.gender || a?.customResponses?.gender || a?.customResponses?.['النوع'] || (a as any)['النوع'] || raw || '';
            }
            if (f.fieldId === '__birthdate') {
              raw = a?.birthdate || a?.dateOfBirth || a?.dob || a?.customResponses?.birthdate || a?.customResponses?.['تarih'] || a?.customResponses?.['تاريخ الميلاد'] || raw || '';
            }
            if (f.fieldId === '__has_cv') {
              const hasTop = Boolean(
                a?.resume || a?.cv || a?.attachments || a?.resumeUrl || a?.cvFilePath || a?.cvFile || a?.cvUrl || a?.resumeFilePath || a?.resumeFile || a?.cv_file_path || a?.cv_file || a?.cv_path
              );
              let has = hasTop;
              try {
                const resp = a?.customResponses || a?.customFieldResponses || {};
                for (const [k, v] of Object.entries(resp || {})) {
                  const lk = String(k || '').toLowerCase();
                  if (lk.includes('cv') || lk.includes('resume') || lk.includes('cvfile') || lk.includes('cv_file') || lk.includes('cvfilepath')) {
                    if (v) { has = true; break; }
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
              const addSet = (s?: Set<string>) => { if (!s) return; s.forEach((x) => allowedUnion.add(String(x))); };
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
                const getId = (v: any) => (typeof v === 'string' ? v : v?._id ?? v?.id ?? '');
                const applicantJobId = getId(a.jobPositionId);
                try {
                  const topLevelKeys = Object.keys(a || {}).filter((k) => k !== 'customResponses' && k !== 'customFieldResponses' && k !== 'customFields');
                  const customRespKeys = Object.keys(a?.customResponses || {});
                  const customFieldRespKeys = Object.keys(a?.customFieldResponses || {});
                  const cfKeys = Object.keys(a?.customFields || {});
                  const allKeys = Array.from(new Set([...topLevelKeys, ...customRespKeys, ...customFieldRespKeys, ...cfKeys]));
                  const respKeys = allKeys.map((k) => normalizeLabelSimple(k));
                  const allowedLabels = canonicalMap[canonical].map((s) => normalizeLabelSimple(s));
                  const hasRespKeyMatch = respKeys.some((rk) => allowedLabels.some((al) => rk === al || rk.includes(al) || al.includes(rk)));
                  if (!hasRespKeyMatch) {
                    if (!applicantJobId || !allowedUnion.has(String(applicantJobId))) {
                      return false;
                    }
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
          if (f.type === 'hasWorkExperience' || f.type === 'hasField' || f.type === 'hasCV' || f.fieldId === '__has_cv') {
            const want = f.value; // true/false/'any'
            if (want === 'any' || want === undefined) continue;

            const evaluateHas = () => {
              try {
                if (f.type === 'hasWorkExperience') {
                  if (Array.isArray(a.workExperiences) && a.workExperiences.length) return true;
                  if (Array.isArray(a.experiences) && a.experiences.length) return true;
                  const resp = a?.customResponses || a?.customFieldResponses || {};
                  const keys = ['work_experience','workExperience','workexperience','الخبرة','خبرة'];
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
                    a?.resume || a?.cv || a?.attachments || a?.resumeUrl || a?.cvFilePath || a?.cvFile || a?.cvUrl || a?.resumeFilePath || a?.resumeFile || a?.cv_file_path || a?.cv_file || a?.cv_path
                  );
                  if (hasTop) return true;
                  try {
                    const resp = a?.customResponses || a?.customFieldResponses || {};
                    for (const [k, v] of Object.entries(resp || {})) {
                      const lk = String(k || '').toLowerCase();
                      if (lk.includes('cv') || lk.includes('resume') || lk.includes('cvfile') || lk.includes('cv_file') || lk.includes('cvfilepath')) {
                        if (v) return true;
                      }
                      // also consider string values containing a file URL
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
            let num: number | null = null;
            if (raw === null || raw === undefined || raw === '') return false;
            const toNum = (v: any) => {
              if (v === null || v === undefined) return NaN;
              if (typeof v === 'number') return v;
              const rawS = String(v);
              // normalize Arabic-Indic and Extended-Indic digits to ASCII
              const conv = (str: string) => {
                const map: Record<string,string> = {
                  '\u0660':'0','\u0661':'1','\u0662':'2','\u0663':'3','\u0664':'4','\u0665':'5','\u0666':'6','\u0667':'7','\u0668':'8','\u0669':'9',
                  '\u06F0':'0','\u06F1':'1','\u06F2':'2','\u06F3':'3','\u06F4':'4','\u06F5':'5','\u06F6':'6','\u06F7':'7','\u06F8':'8','\u06F9':'9'
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
              if (nums.length) num = Math.max(...nums); else num = null;
            } else if (typeof raw === 'object') {
              // prefer explicit numeric keys (max/min/amount/value), otherwise try to extract any numeric child
              const candKeys = ['max','value','val','amount','salary','expectedSalary','min','amountValue','numeric','0'];
              let found: number | null = null;
              for (const ck of candKeys) {
                if (Object.prototype.hasOwnProperty.call(raw, ck)) {
                  const c = toNum((raw as any)[ck]);
                  if (Number.isFinite(c)) { found = (found === null ? c : Math.max(found, c)); }
                }
              }
              if (found === null) {
                // inspect object children
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
              .map((v: any) => normalizeForCompare((v && (v.id || v._id || v.en || v.ar)) ? (v.id || v._id || v.en || v.ar) : v))
              .filter((x: string) => x);
            if (!valsNormalized.length) continue;

            const valsExpandedSet = new Set<string>();
            valsNormalized.forEach((v: string) => expandForms(v).forEach((x) => valsExpandedSet.add(x)));

            const rawItems = extractResponseItems(raw).map(normalizeForCompare);

            // Direct equality checks between the filter values and the raw response
            // (handles primitives, arrays, objects and keyed-boolean maps). This
            // ensures we compare the actual stored customResponse value to the
            // selected filter value before falling back to normalized/expanded forms.
            let matched = false;
            try {
              // primitives
              if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
                const rv = normalizeForCompare(raw);
                if (rv && valsExpandedSet.has(rv)) { matched = true; ; }
              }
              // arrays
              if (!matched && Array.isArray(raw)) {
                for (const el of raw) {
                  const v = normalizeForCompare(el);
                  if (v && valsExpandedSet.has(v)) { matched = true;  break; }
                }
              }
              // objects: check values first, then check keyed booleans (key name when value truthy)
              if (!matched && raw && typeof raw === 'object') {
                for (const v of Object.values(raw)) {
                  const nv = normalizeForCompare(v);
                    if (nv && valsExpandedSet.has(nv)) { matched = true; break; }
                }
                if (!matched) {
                  for (const [k, v] of Object.entries(raw)) {
                    if (v === true || v === 'true' || v === 1 || v === '1') {
                      const nk = normalizeForCompare(k);
                      if (nk && valsExpandedSet.has(nk)) { matched = true; break; }
                    }
                  }
                }
              }
            } catch (e) {
              // ignore and fall back to normalized/rawItems matching
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

            if (!matched) {
              return false;
            }
            continue;
          }

          // TEXT / CONTAINS
          if (f.type === 'text') {
            const needle = normalizeForCompare(f.value || '');
            if (!needle) continue;
            const rawItems = extractResponseItems(raw).map(normalizeForCompare);
            let matched = rawItems.some((it) => it.includes(needle));
            // If this is engineering specialization, only search the canonical
            // allowed response keys so we don't match unrelated fields.
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
                } else {
                  // Non-engineering canonical fields: preserve previous behavior
                  if (canonical && canonicalMap[canonical]) {
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
                }
              } catch (e) {
                // ignore
              }
            }
            if (!matched) {
              return false;
            }
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
              const map: Record<string,string> = {
                '\u0660':'0','\u0661':'1','\u0662':'2','\u0663':'3','\u0664':'4','\u0665':'5','\u0666':'6','\u0667':'7','\u0668':'8','\u0669':'9',
                '\u06F0':'0','\u06F1':'1','\u06F2':'2','\u06F3':'3','\u06F4':'4','\u06F5':'5','\u06F6':'6','\u06F7':'7','\u06F8':'8','\u06F9':'9'
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
              // try Date parse
              try {
                const d = new Date(s);
                if (!Number.isNaN(d.getTime())) return d.getFullYear();
              } catch {
                // ignore
              }
              // fallback: find a 4-digit year (1900-2099)
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
            if (!matched) {
              return false;
            }
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
            if (!matchFound) {
              return false;
            }
            continue;
          }
        }
        return true;
      } catch (e) {
        return false;
      }
    });
  }, [displayedApplicants, customFilters]);

  // Build gender filter options from the applicants dataset but apply only
  // the trashed-visibility rule (so options persist after refresh even when
  // columnFilters are restored from sessionStorage). Order Male/Female first.
  const genderOptions = useMemo(() => {
    const s = new Set<string>();
    const rows = Array.isArray(applicants) ? applicants : [];
    rows.forEach((a: any) => {
      // Respect trashed visibility for non-super-admins
      if (!isSuperAdmin && a?.status === 'trashed') return;
      const raw = a?.gender || a?.customResponses?.gender || a?.customResponses?.['النوع'] || (a as any)['النوع'];
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

  // Keep a ref to genderOptions so memoized column Header closures can
  // access the latest list even when `columns` is memoized and not re-created.
  const genderOptionsRef = useRef<typeof genderOptions>(genderOptions);
  useEffect(() => {
    genderOptionsRef.current = genderOptions;
  }, [genderOptions]);

  // Sanitize persisted column filters: if a gender filter was stored but the
  // available gender options don't include the stored values, remove/trim
  // the gender filter so the filter menu shows proper options after reload.
  useEffect(() => {
    try {
      const genderFilterIndex = columnFilters.findIndex((f: any) => f.id === 'gender');
      if (genderFilterIndex === -1) return;
      const current = columnFilters[genderFilterIndex];
      const vals = Array.isArray(current.value) ? current.value : (current.value ? [current.value] : []);
      if (!vals.length) return;
      const optionIds = new Set(genderOptions.map((g) => g.id));
      const intersection = vals.filter((v: string) => optionIds.has(v));
      if (intersection.length === vals.length) return; // all valid
      // build new filters array with updated gender filter (or removed)
      const next = columnFilters.slice();
      if (intersection.length === 0) {
        next.splice(genderFilterIndex, 1);
      } else {
        next[genderFilterIndex] = { ...next[genderFilterIndex], value: intersection };
      }
      setColumnFilters(next);
      // persist cleaned state immediately so page reloads start clean
      try {
        const raw = sessionStorage.getItem('applicants_table_state');
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.columnFilters = next;
        sessionStorage.setItem('applicants_table_state', JSON.stringify(parsed));
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
      // Optimistically mark as trashed
      selectedApplicantIds.forEach((aid) =>
        updateStatusMutation.mutate({
          id: aid,
          data: {
            status: "trashed",
            notes: `Moved to trash on ${new Date().toLocaleDateString()}`,
          },
        })
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
              <ImageThumbnail
                src={row.original.profilePhoto}
                alt={row.original.fullName}
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
        Cell: ({ row }: { row: { original: Applicant } }) => {
          const orig: any = row.original;
          const seenBy = orig?.seenBy ?? [];
          const currentUserId = (user as any)?._id || (user as any)?.id || undefined;
          const isSeen = Array.isArray(seenBy) && seenBy.some((s: any) => {
            if (!s) return false;
            if (typeof s === 'string') return s === currentUserId;
            return (s._id === currentUserId) || (s.id === currentUserId);
          });

          return (
            <div className={isSeen ? 'text-gray-400' : 'text-gray-900'}>
              {orig?.fullName || '-'}
            </div>
          );
        }
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
      {
        id: 'gender',
        accessorFn: (row: any) => normalizeGender(row.gender || row.customResponses?.gender || row.customResponses?.['النوع'] || (row as any)['النوع'] || ''),
        header: 'Gender',
        size: 110,
        enableColumnFilter: true,
        enableSorting: false,
        Header: ({ column }: { column: any }) => {
          const current = column.getFilterValue();
          const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

          const selected: string[] = Array.isArray(current)
            ? current
            : current
            ? [current]
            : [];

          const toggle = (val: string) => {
            const next = new Set(selected);
            if (next.has(val)) next.delete(val);
            else next.add(val);
            const arr = Array.from(next);
            column.setFilterValue(arr.length ? arr : undefined);
          };

          const clear = () => { column.setFilterValue(undefined); setAnchorEl(null); };

          const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            setAnchorEl(event.currentTarget);
          };

          const handleClose = () => setAnchorEl(null);

          return (
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 -mt-1">
                <span className="text-sm font-medium">Gender</span>
                <div>
                  <button
                    type="button"
                    onClick={handleClick}
                    className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                  >
                    {selected.length ? `${selected.length}` : "Filter"}
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none">
                      <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleClose}
                    onClick={(e) => e.stopPropagation()}
                    PaperProps={{ style: { maxHeight: 240, width: 200 } }}
                  >
                    <MenuItem onClick={clear} dense>Clear</MenuItem>
                    {(genderOptionsRef.current || []).map((g) => (
                      <MenuItem key={g.id} dense onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(g.id); }}>
                        <Checkbox checked={selected.includes(g.id)} size="small" />
                        <ListItemText primary={g.title} />
                      </MenuItem>
                    ))}
                  </Menu>
                </div>
              </div>
            </div>
          );
        },
        filterFn: (row: any, columnId: string, filterValue: any) => {
          if (!filterValue) return true;
          const vals = Array.isArray(filterValue) ? filterValue : [filterValue];
          if (!vals.length) return true;
          const cell = String(row.getValue(columnId) ?? "");
          return vals.includes(cell);
        },
        Cell: ({ row }: { row: { original: any } }) => {
          const raw = row.original.gender || row.original.customResponses?.gender || row.original.customResponses?.['النوع'] || (row.original as any)['النوع'] || '';
          const g = normalizeGender(raw);
          return g || '-';
        },
      },
      ... (showCompanyColumn
  ? [
      {
        id: "companyId",
        header: "Company",
        size: 150,
        enableColumnFilter: true,
        enableSorting: false,
        accessorFn: (row: any) => {
          const raw = row?.jobPositionId;
          const getId = (v: any) => (typeof v === 'string' ? v : v?._id ?? v?.id ?? '');
          const jobId = getId(raw);
          const job = jobPositionMap[jobId];
          const comp = job?.companyId ? getId(job.companyId) : '';
          return comp;
        },
        Header: ({ column }: { column: any }) => {
          const current = column.getFilterValue();
          const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
          
          const selected: string[] = Array.isArray(current)
            ? current
            : current
            ? [current]
            : [];

          const toggle = (id: string) => {
            const next = new Set(selected);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            const arr = Array.from(next);
            column.setFilterValue(arr.length ? arr : undefined);
          };

          const clear = () => {
            column.setFilterValue(undefined);
            setAnchorEl(null);
          };

          const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            setAnchorEl(event.currentTarget);
          };

          const handleClose = () => {
            setAnchorEl(null);
          };

          return (
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 -mt-1">
                <span className="text-sm font-medium">Company</span>
                <div>
                  <button
                    type="button"
                    onClick={handleClick}
                    className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                  >
                    {selected.length ? `${selected.length}` : "Filter"}
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none">
                      <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleClose}
                    onClick={(e) => e.stopPropagation()}
                    PaperProps={{ style: { maxHeight: 300, width: 240 } }}
                  >
                    <MenuItem onClick={clear} dense>Clear</MenuItem>
                    {companyOptions.map((c) => (
                      <MenuItem 
                        key={c.id} 
                        dense 
                        onClick={(e) => { 
                          e.preventDefault(); 
                          e.stopPropagation(); 
                          toggle(c.id); 
                        }}
                      >
                        <Checkbox checked={selected.includes(c.id)} size="small" />
                        <ListItemText primary={c.title} />
                      </MenuItem>
                    ))}
                  </Menu>
                </div>
              </div>
            </div>
          );
        },
        filterFn: (row: any, columnId: string, filterValue: any) => {
          if (!filterValue) return true;
          const vals = Array.isArray(filterValue) ? filterValue : [filterValue];
          if (!vals.length) return true;
          const cell = String(row.getValue(columnId) ?? "");
          return vals.includes(cell);
        },
        Cell: ({ row }: { row: { original: Applicant } }) => {
          // display company name via job position
          const jobPositionId = row.original.jobPositionId;
          const getId = (v: any) => (typeof v === 'string' ? v : v?._id ?? v?.id ?? '');
          const jobPosition = jobPositionMap[getId(jobPositionId)];
          if (jobPosition?.companyId) {
            const companyId = typeof jobPosition.companyId === 'string' ? jobPosition.companyId : jobPosition.companyId._id || '';
            const company = companyMap[companyId];
            return toPlainString(company?.name) || company?.title || 'N/A';
          }
          return 'N/A';
        },
      },
    ]
  : []),
 {
  id: "jobPositionId",
  header: "Job Position",
  enableSorting: false,

  accessorFn: (row: any) => {
    const raw = row?.jobPositionId;
    const getId = (v: any) =>
      typeof v === "string" ? v : v?._id ?? v?.id ?? "";
    return getId(raw);
  },

  Header: ({ column }: { column: any }) => {
    const current = column.getFilterValue();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    
    const selected: string[] = Array.isArray(current)
      ? current
      : current
      ? [current]
      : [];

    const toggle = (jobId: string) => {
      const next = new Set(selected);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);

      const arr = Array.from(next);
      column.setFilterValue(arr.length ? arr : undefined);
    };

    const clear = () => {
      column.setFilterValue(undefined);
      setAnchorEl(null);
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
      setAnchorEl(null);
    };

    return (
      <div onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 -mt-1">
          <span className="text-sm font-medium">Job Position</span>

          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
          >
            {selected.length ? `${selected.length}` : "Filter"}
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
            onClick={(e) => e.stopPropagation()}
            PaperProps={{
              style: { maxHeight: 280, width: 260 },
            }}
          >
            <MenuItem onClick={clear} dense>
              Clear
            </MenuItem>

            {jobOptions.map((j) => (
              <MenuItem
                key={j.id}
                dense
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggle(j.id);
                  // Don't close the menu after selection to allow multiple selections
                }}
              >
                <Checkbox checked={selected.includes(j.id)} size="small" />
                <ListItemText primary={j.title} />
              </MenuItem>
            ))}
          </Menu>
        </div>
      </div>
    );
  },

  filterFn: (row: any, columnId: string, filterValue: any) => {
    if (!filterValue) return true;
    const vals = Array.isArray(filterValue) ? filterValue : [filterValue];
    if (!vals.length) return true;

    const cell = String(row.getValue(columnId) ?? "");
    return vals.includes(cell);
  },

  size: 200,
  enableColumnFilter: true,

  Cell: ({ row }: { row: { original: Applicant } }) => {
    const raw = row.original.jobPositionId;

    const getId = (v: any) => {
      if (!v) return "";
      if (typeof v === "string") return v;
      return v._id ?? v.id ?? "";
    };

    const jobId = getId(raw);
    const job = jobPositionMap[jobId];

    const title =
      typeof job?.title === "string"
        ? job.title
        : job?.title?.en ??
          jobOptions.find((o) => o.id === jobId)?.title ??
          "N/A";

    return <span className="text-sm font-medium">{title}</span>;
  },
},
         {
  accessorKey: "status",
  header: "Status",
  enableSorting: false,

  Header: ({ column }) => {
    const current = column.getFilterValue();

    const selected: string[] = Array.isArray(current)
      ? current
      : current
      ? [current]
      : [];

    const toggle = (s: string) => {
      const next = new Set(selected);
      if (next.has(s)) next.delete(s);
      else next.add(s);

      const arr = Array.from(next);
      column.setFilterValue(arr.length ? arr : undefined);
    };

    const clear = () => {
      column.setFilterValue(undefined);
      setStatusAnchorEl(null);
    };

    return (
      <div onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 -mt-1">
          <span className="text-sm font-medium">Status</span>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              // IMPORTANT: close job if open
              setJobAnchorEl(null);

              const target = e.currentTarget as HTMLElement;
              if (statusAnchorEl === target) setStatusAnchorEl(null);
              else setStatusAnchorEl(target);
            }}
            className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
          >
            {selected.length ? `${selected.length}` : "Filter"}
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
            anchorEl={statusAnchorEl}
            open={Boolean(statusAnchorEl)}
            onClose={() => setStatusAnchorEl(null)}
            PaperProps={{
              style: { maxHeight: 240, width: 220 },
              onMouseDown: (e: any) => e.stopPropagation(),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem onClick={clear} dense>
              Clear
            </MenuItem>

            {statusOptions.map((s) => (
              <MenuItem
                key={s}
                dense
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggle(s);
                }}
              >
                <Checkbox checked={selected.includes(s)} size="small" />
                <ListItemText
                  primary={s.charAt(0).toUpperCase() + s.slice(1)}
                />
              </MenuItem>
            ))}
          </Menu>
        </div>
      </div>
    );
  },

  filterFn: (row: any, columnId: string, filterValue: any) => {
    if (!filterValue) return true;
    const vals = Array.isArray(filterValue) ? filterValue : [filterValue];
    if (!vals.length) return true;

    const cell = String(row.getValue(columnId) ?? "");
    return vals.includes(cell);
  },

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
}
,
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
      {
        id: 'actions',
        header: 'Actions',
        size: 120,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }: any) => {
          const orig = row.original as any;
          const hasCv = Boolean(resolveCvPath(orig));
          return (
            <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
              {hasCv ? (
                <button
                  type="button"
                  aria-label="Download CV"
                  title="Download CV"
                  onClick={async (e) => {
                    try { e.stopPropagation(); } catch {}
                    try { await downloadCvForApplicant(orig); } catch (err) { /* ignore */ }
                  }}
                  className="inline-flex items-center justify-center rounded bg-brand-500 p-1 text-white hover:bg-brand-600"
                >
                  <span className="sr-only">Download CV</span>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v12m0 0l-4-4m4 4l4-4M21 21H3" />
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
    [companyMap, jobPositionMap, jobOptions, getStatusColor, formatDate, statusAnchorEl, jobAnchorEl]
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
    // Pass the filteredApplicants list (applies custom filters on top of displayedApplicants)
    data: filteredApplicants,
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
      pagination,
      sorting,
      columnFilters,
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
    state: {
      rowSelection,
      columnFilters,
      sorting,
      pagination,
      isLoading: applicantsLoading || jobPositionsLoading,
      showSkeletons: applicantsLoading || jobPositionsLoading,
      showAlertBanner: false,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row._id,
        renderTopToolbarCustomActions: () => {
      return (
        <div
          style={{ backgroundColor: isDarkMode ? '#1C2434' : '#FFFFFF' }}
          className="flex items-center p-2 w-full"
        >
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                try { (e.currentTarget as HTMLButtonElement).blur(); } catch {}
                // remove any existing customFilters that target excluded fields
                try {
                  setCustomFilters((prev) => prev.filter((cf: any) => {
                      const rawCandidates = [`${cf.labelEn || ''} ${cf.labelAr || ''}`, cf.labelEn || '', cf.labelAr || '', cf.fieldId || ''];
                      for (const rc of rawCandidates) {
                        if (isExcludedLabel(rc)) return false;
                      }
                      return true;
                    }));
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
      onClick: () => {
        try {
          const state = table.getState();
          sessionStorage.setItem('applicants_table_state', JSON.stringify({
            pagination: state.pagination,
            sorting: state.sorting,
            columnFilters: state.columnFilters,
          }));
        } catch (e) {
          // ignore
        }
        navigate(`/applicant/${row.id}`, {
          state: { applicant: row.original },
        });
      },
      onContextMenu: (e) => {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch {}
        setContextMenu({ open: true, x: e.clientX, y: e.clientY, row });
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

  // Close custom context menu on outside click or Escape
  useEffect(() => {
    const onDocClick = () => {
      setContextMenu((c) => (c.open ? { ...c, open: false } : c));
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu((c) => (c.open ? { ...c, open: false } : c));
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  return (
    <>
      <PageMeta title="Applicants" description="Manage job applicants" />
      <PageBreadcrumb pageTitle="Applicants" />

      <div className="grid gap-6">
        <ComponentCard
          title="Job Applicants"
          desc="View and manage all applicants"
          actions={
            <div className="flex items-center mr-30 gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const promises: Promise<any>[] = [];
                    if (isJobPositionsFetched && refetchJobPositions) promises.push(refetchJobPositions());
                    if (isApplicantsFetched && refetchApplicants) promises.push(refetchApplicants());
                    if (isCompaniesFetched && refetchCompanies) promises.push(refetchCompanies());
                    if (promises.length === 0) return;
                    await Promise.all(promises);
                    setLastRefetch(new Date());
                  } catch (e) {
                    // ignore
                  }
                }}
                disabled={isJobPositionsFetching || isApplicantsFetching || isCompaniesFetching}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
              >
                {(isJobPositionsFetching || isApplicantsFetching || isCompaniesFetching) ? 'Updating Data' : 'Update Data'}
              </button>
              <div className="text-sm text-gray-500">{elapsed ? `Last Update: ${elapsed}` : 'Not updated yet'}</div>
            </div>
          }
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
                    onClick={() => setShowBulkModal(true)}
                    disabled={isProcessing || selectedApplicantEmails.length === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {`Send Mail (${selectedApplicantEmails.length})`}
                  </button>
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

            {/* Filter Settings moved to card header actions */}

            {/* Material React Table */}
            <ThemeProvider theme={muiTheme}>
              <MaterialReactTable table={table} />
            </ThemeProvider>
            <BulkMessageModal
              isOpen={showBulkModal}
              onClose={() => setShowBulkModal(false)}
              recipients={selectedApplicantEmails}
              companyId={selectedApplicantCompanyId}
              company={selectedApplicantCompany}
              onSuccess={() => { setRowSelection({}); setShowBulkModal(false); }}
            />

            {/* MRT handles pagination in its bottom toolbar (10 rows per page) */}
          </>
        </ComponentCard>
      </div>

      {/* Custom context menu for applicant rows */}
      {contextMenu.open && (
        <div
          style={{ position: 'fixed', left: menuPos.x, top: menuPos.y, zIndex: 11000 }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="w-52 rounded bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-lg overflow-hidden text-sm">
            <button
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => {
                saveTableState();
                try {
                  const url = `${window.location.origin}/applicant/${contextMenu.row.id}`;
                  window.open(url, '_blank');
                } catch (err) {
                  navigate(`/applicant/${contextMenu.row.id}`, { state: { applicant: contextMenu.row.original } });
                }
                setContextMenu((c) => ({ ...c, open: false }));
              }}
            >
              Open in new tab
            </button>
            <button
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => {
                saveTableState();
                navigate(`/applicant/${contextMenu.row.id}`, { state: { applicant: contextMenu.row.original } });
                setContextMenu((c) => ({ ...c, open: false }));
              }}
            >
              Open in this tab
            </button>
            <button
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={async () => {
                try {
                  const url = `${window.location.origin}/applicant/${contextMenu.row.id}`;
                  await navigator.clipboard.writeText(url);
                } catch (err) {
                  // ignore
                }
                setContextMenu((c) => ({ ...c, open: false }));
              }}
            >
              Copy link
            </button>
            {resolveCvPath(contextMenu.row.original) && (
              <button
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={async () => {
                  try {
                    await downloadCvForApplicant(contextMenu.row.original);
                  } catch (e) {
                    // ignore
                  }
                  setContextMenu((c) => ({ ...c, open: false }));
                }}
              >
                Download CV
              </button>
            )}
          </div>
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

export default function ApplicantsWrapper() {
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth <= 425 : false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 425);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (isMobile) return <ApplicantsMobilePage />;
  return <Applicants />;
}

 

