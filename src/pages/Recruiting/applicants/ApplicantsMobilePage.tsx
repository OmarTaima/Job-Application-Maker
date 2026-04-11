import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useApplicants } from "../../../hooks/queries/useApplicants";
import { useCompanies } from "../../../hooks/queries/useCompanies";
import { useJobPositions } from "../../../hooks/queries/useJobPositions";
import { useAuth } from "../../../context/AuthContext";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { useQueryClient } from '@tanstack/react-query';
import { applicantsKeys } from '../../../hooks/queries/useApplicants';
import { toPlainString } from "../../../utils/strings";
import {
  buildApplicantDuplicateLookup,
  sortApplicantsByDuplicatePriority,
} from '../../../utils/applicantDuplicateSort';
import CustomFilterModal from "../../../components/modals/CustomFilterModal";
import Swal from '../../../utils/swal';
import BulkMessageModal from '../../../components/modals/BulkMessageModal';
import { useDeleteApplicant, useUpdateApplicantStatus } from '../../../hooks/queries/useApplicants';

// Icons (using emoji as fallback, but in production use proper icon library)
import { 
  Search, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
Trash2,
  Send,
  ArrowUpDown,
  SlidersHorizontal,
  Download,
  ExternalLink
} from 'lucide-react';

const MOBILE_FILTERS_STORAGE_KEY = 'applicants_mobile_filters';

const toStringArray = (value: any): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value) return [value];
  return [];
};

const readPersistedMobileFilters = () => {
  try {
    const rawSession = sessionStorage.getItem(MOBILE_FILTERS_STORAGE_KEY);
    const rawLocal = rawSession
      ? null
      : localStorage.getItem(MOBILE_FILTERS_STORAGE_KEY);
    const raw = rawSession || rawLocal;
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      query: typeof parsed?.query === 'string' ? parsed.query : '',
      companyFilters: toStringArray(parsed?.companyFilters),
      jobFilters: toStringArray(parsed?.jobFilters),
      statusFilters: toStringArray(parsed?.statusFilters),
      genderFilters: toStringArray(parsed?.genderFilters),
      pageIndex:
        typeof parsed?.pageIndex === 'number' && parsed.pageIndex >= 0
          ? parsed.pageIndex
          : 0,
      pageSize:
        typeof parsed?.pageSize === 'number' && parsed.pageSize > 0
          ? parsed.pageSize
          : 10,
      submittedDesc:
        typeof parsed?.submittedDesc === 'boolean' ? parsed.submittedDesc : true,
    };
  } catch (e) {
    return {
      query: '',
      companyFilters: [] as string[],
      jobFilters: [] as string[],
      statusFilters: [] as string[],
      genderFilters: [] as string[],
      pageIndex: 0,
      pageSize: 10,
      submittedDesc: true,
    };
  }
};

export default function ApplicantsMobilePage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [initialMobileFilters] = useState(() => readPersistedMobileFilters());

  // Lazy image loader with enhanced features
  function LazyImage({ src, alt, className, fallback }: { src?: string | null; alt?: string; className?: string; fallback?: string }) {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const seenImagesRef = useRef<Set<string>>((globalThis as any).__seenApplicantImages || new Set<string>());
    const [visible, setVisible] = useState<boolean>(() => !!src && seenImagesRef.current.has(String(src)));
    const [error, setError] = useState(false);

    if (!(globalThis as any).__seenApplicantImages) (globalThis as any).__seenApplicantImages = seenImagesRef.current;

    useEffect(() => {
      if (!src || error) return;
      if (visible) return;
      
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisible(true);
              if (src) seenImagesRef.current.add(String(src));
              observer.disconnect();
            }
          });
        },
        { rootMargin: "50px", threshold: 0.1 }
      );

      if (imgRef.current) observer.observe(imgRef.current);
      return () => observer.disconnect();
    }, [src, visible, error]);

    if (!src || error) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400">
          <span className="text-2xl font-bold">{fallback || '?'}</span>
        </div>
      );
    }

    return (
      <img
        ref={imgRef}
        src={visible ? src : undefined}
        data-src={src}
        alt={alt || ''}
        loading="lazy"
        className={className}
        onError={() => setError(true)}
      />
    );
  }

  const [query, setQuery] = useState(initialMobileFilters.query);
  const [companyFilters, setCompanyFilters] = useState<string[]>(
    initialMobileFilters.companyFilters
  );
  const [jobFilters, setJobFilters] = useState<string[]>(
    initialMobileFilters.jobFilters
  );
  const [statusFilters, setStatusFilters] = useState<string[]>(
    initialMobileFilters.statusFilters
  );
  const [genderFilters, setGenderFilters] = useState<string[]>(
    initialMobileFilters.genderFilters
  );
  const [customFilterOpen, setCustomFilterOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [customFilters, setCustomFilters] = useState<Array<any>>(() => {
    try {
      const raw = sessionStorage.getItem('applicants_table_state');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && Array.isArray(parsed.customFilters) ? parsed.customFilters : [];
    } catch (e) {
      return [];
    }
  });

  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [pageIndex, setPageIndex] = useState<number>(initialMobileFilters.pageIndex);
  const [pageSize, setPageSize] = useState<number>(initialMobileFilters.pageSize);
  const [submittedDesc, setSubmittedDesc] = useState<boolean>(
    initialMobileFilters.submittedDesc
  );
  const [refreshing, setRefreshing] = useState(false);
  const hasSearchQuery = query.trim().length > 0;
  const normalizedSearchQuery = query.trim().toLowerCase();

  const { data: companies = [], refetch: refetchCompanies, isFetching: isCompaniesFetching } = useCompanies();
  const { user } = useAuth();

  const isSuperAdmin = useMemo(() => {
    const roleName = user?.roleId?.name;
    return typeof roleName === 'string' && roleName.toLowerCase() === 'super admin';
  }, [user?.roleId?.name]);

  const currentUserId = useMemo(
    () =>
      String((user as any)?._id || (user as any)?.id || ''),
    [user]
  );

  const companyId = useMemo(() => {
    if (!user) return undefined;
    const roleName = user?.roleId?.name?.toLowerCase();
    const isSuperAdmin = roleName === "super admin";
    const usercompanyId = user?.companies?.map((c: any) => (typeof c.companyId === "string" ? c.companyId : c.companyId?._id));
    if (isSuperAdmin) return undefined;
    return usercompanyId?.length ? usercompanyId : undefined;
  }, [user?._id, user?.roleId?.name, user?.companies]);

  const availableCompanyIds = useMemo(() => (companies || []).map((c: any) => c._id || c.id).filter(Boolean), [companies]);

  const primarySelectedCompany =
    companyFilters.length === 1 ? companyFilters[0] : undefined;
  const needServerFetchForCompany = primarySelectedCompany
    ? !availableCompanyIds.includes(primarySelectedCompany)
    : false;
  const jobPositionsFetchParam = needServerFetchForCompany
    ? [primarySelectedCompany as string]
    : companyId;
  const applicantsFetchParam = needServerFetchForCompany
    ? [primarySelectedCompany as string]
    : companyId;

  const { data: jobPositions = [], refetch: refetchJobPositions, isFetching: isJobPositionsFetching } = useJobPositions(jobPositionsFetchParam as any);
  const { data: applicants = [], isLoading, error, refetch } = useApplicants(applicantsFetchParam as any, undefined);

  const [columnFilters, _setColumnFilters] = useState<any[]>(() => {
    try {
      const raw = sessionStorage.getItem('applicants_table_state');
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed.columnFilters || [];
    } catch (e) { return []; }
  });

  const setColumnFilters = (updater: any) => {
    const next = typeof updater === 'function' ? updater(columnFilters) : updater;
    _setColumnFilters(next);
    try {
      const comp = Array.isArray(next) ? next.find((c: any) => c.id === 'companyId') : undefined;
      const job = Array.isArray(next) ? next.find((c: any) => c.id === 'jobPositionId') : undefined;
      if (comp) {
        setCompanyFilters(toStringArray(comp.value));
      } else {
        setCompanyFilters([]);
      }
      if (job) {
        setJobFilters(toStringArray(job.value));
      } else {
        setJobFilters([]);
      }
    } catch (e) {}
    return next;
  };

  // create jobPositionMap used in applicant-company derivation and the modal
  const jobPositionMap = useMemo(() => {
    const map: Record<string, any> = {};
    const getIdValue = (v: any) => (typeof v === 'string' ? v : v?._id ?? v?.id);
    jobPositions.forEach((job: any) => {
      const ids = new Set<string>();
      const primary = getIdValue(job._id) || getIdValue(job.id);
      if (primary) ids.add(primary);
      if (job._id && typeof job._id === 'object' && job._id._id) ids.add(job._id._id);
      if (job.id && typeof job.id === 'object' && job.id._id) ids.add(job.id._id);
      ids.forEach((id) => { if (id) map[id] = job; });
    });
    return map;
  }, [jobPositions]);

  const displayedJobPositions = useMemo(() => {
    if (companyFilters.length === 0) return jobPositions || [];
    return (jobPositions || []).filter((j: any) => {
      const cid = j?.companyId || j?.company || (j?.companyObj && j.companyObj._id) || (j?.companyId?._id);
      const id = typeof cid === 'string' ? cid : cid?._id || cid?.id;
      return id ? companyFilters.includes(String(id)) : false;
    });
  }, [jobPositions, companyFilters]);

  const displayedApplicants = useMemo(() => {
    const normalizeId = (v: any) => {
      if (!v && v !== 0) return undefined;
      if (typeof v === 'string') return v;
      if (typeof v === 'number') return String(v);
      if (typeof v === 'object') {
        return v._id || v.id || (v.companyId && (v.companyId._id || v.companyId.id)) || undefined;
      }
      return undefined;
    };

    const getApplicantCompanyId = (a: any) => {
      const tryFields = [a?.companyId, a?.company, a?.companyObj];
      for (const f of tryFields) {
        const n = normalizeId(f);
        if (n) return n;
      }
      // fallback: derive from jobPositionId
      const jobId = normalizeId(a?.jobPositionId);
      if (jobId && jobPositionMap && jobPositionMap[jobId]) {
        const job = jobPositionMap[jobId];
        return normalizeId(job?.companyId || job?.company || job?.companyObj);
      }
      return undefined;
    };

    const getApplicantJobId = (a: any) => normalizeId(a?.jobPositionId || a?.job);

    let list = Array.isArray(applicants) ? applicants.slice() : [];
    if (!hasSearchQuery) {
      if (companyFilters.length > 0) {
        list = list.filter((a: any) => {
          const cid = getApplicantCompanyId(a);
          return cid ? companyFilters.includes(String(cid)) : false;
        });
      }
      if (jobFilters.length > 0) {
        list = list.filter((a: any) => {
          const jid = getApplicantJobId(a);
          return jid ? jobFilters.includes(String(jid)) : false;
        });
      }
    }
    return list;
  }, [applicants, companyFilters, jobFilters, jobPositionMap, hasSearchQuery]);


  // Keep selected job filters valid for selected companies.
  useEffect(() => {
    if (companyFilters.length === 0) return;
    setJobFilters((prev) => {
      const next = prev.filter((jobId) => {
        const job = jobPositionMap[jobId];
        if (!job) return false;
        const raw = job?.companyId || job?.company || job?.companyObj;
        const cid = typeof raw === 'string' ? raw : raw?._id || raw?.id || '';
        return cid ? companyFilters.includes(String(cid)) : false;
      });
      return next.length === prev.length ? prev : next;
    });
  }, [companyFilters, jobPositionMap]);

  // Sync company/job filters with the column filter model used by custom modal.
  useEffect(() => {
    _setColumnFilters((prev) => {
      const base = Array.isArray(prev)
        ? prev.filter((p: any) => p.id !== 'companyId' && p.id !== 'jobPositionId')
        : [];
      if (companyFilters.length > 0) base.push({ id: 'companyId', value: companyFilters });
      if (jobFilters.length > 0) base.push({ id: 'jobPositionId', value: jobFilters });
      if (JSON.stringify(prev || []) === JSON.stringify(base)) return prev;
      return base;
    });
  }, [companyFilters, jobFilters]);

  // Persist filters and list preferences so they survive entering applicant details and coming back.
  useEffect(() => {
    try {
      const mobileState = {
        query,
        companyFilters,
        jobFilters,
        statusFilters,
        genderFilters,
        pageIndex,
        pageSize,
        submittedDesc,
      };
      const mobileStr = JSON.stringify(mobileState);
      sessionStorage.setItem(MOBILE_FILTERS_STORAGE_KEY, mobileStr);
      try { localStorage.setItem(MOBILE_FILTERS_STORAGE_KEY, mobileStr); } catch (e) { }

      const raw = sessionStorage.getItem('applicants_table_state');
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.customFilters = customFilters || [];
      parsed.columnFilters = columnFilters || parsed.columnFilters || [];
      const str = JSON.stringify(parsed);
      sessionStorage.setItem('applicants_table_state', str);
      try { localStorage.setItem('applicants_table_state', str); } catch (e) { }
    } catch (e) {}
  }, [
    query,
    companyFilters,
    jobFilters,
    statusFilters,
    genderFilters,
    pageIndex,
    pageSize,
    submittedDesc,
    customFilters,
    columnFilters,
  ]);


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
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // helper to read custom response value (copied from Applicants.tsx)
  const getCustomResponseValue = (a: any, f: any) => {
    if (!a) return '';
    const responses = a.customResponses || a.customFieldResponses || {};
    const top = a || {};
    const tryKey = (k: any) => {
      if (k === undefined || k === null) return undefined;
      if (typeof k !== 'string' && typeof k !== 'number') return undefined;
      const key = String(k);
      if (responses && Object.prototype.hasOwnProperty.call(responses, key)) return responses[key];
      if (top && Object.prototype.hasOwnProperty.call(top, key)) return top[key];
      return undefined;
    };
    const byId = tryKey(f.fieldId);
    if (byId !== undefined) return byId;
    const byEn = tryKey(f.labelEn);
    if (byEn !== undefined) return byEn;
    const byAr = tryKey(f.labelAr);
    if (byAr !== undefined) return byAr;
    const byLabel = tryKey(f.label);
    if (byLabel !== undefined) return byLabel;
    const norm = (s: any) => (s || '').toString().replace(/\u200E|\u200F/g, '').replace(/[^\w\u0600-\u06FF\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const rawTargets = [f.labelEn, f.labelAr, f.fieldId].filter(Boolean);
    const targetSet = new Set<string>();
    rawTargets.map(norm).forEach((t) => { if (t) targetSet.add(t); });
    for (const k of Object.keys(responses || {})) {
      try {
        const kn = norm(k);
        if (targetSet.has(kn)) return responses[k];
        const kn2 = kn.replace(/_/g, ' ');
        if (targetSet.has(kn2)) return responses[k];
      } catch (e) { }
    }
    for (const k of Object.keys(top || {})) {
      try {
        const kn = norm(k);
        if (targetSet.has(kn)) return top[k];
        const kn2 = kn.replace(/_/g, ' ');
        if (targetSet.has(kn2)) return top[k];
      } catch (e) { }
    }
    return '';
  };

    // Helpers to resolve and download CVs for applicants (copied from Applicants.tsx)
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

  const allCustomFilters = Array.isArray(customFilters) ? customFilters : [];
  const duplicatesOnlyEnabled = allCustomFilters.some(
    (f: any) => f?.fieldId === '__duplicates_only' && f?.value === true
  );
  const effectiveCustomFilters = allCustomFilters.filter(
    (f: any) => f?.fieldId !== '__duplicates_only'
  );

  const baseFiltered = (displayedApplicants || []).filter((a) => {

    if (hasSearchQuery) {
      return (
        (a.fullName || "").toLowerCase().includes(normalizedSearchQuery) ||
        (a.email || "").toLowerCase().includes(normalizedSearchQuery) ||
        (a.phone || "").toLowerCase().includes(normalizedSearchQuery)
      );
    }

    // status + trashed visibility
    if (statusFilters.length === 0) {
      // default 'All statuses' — hide trashed for everyone
      if (a.status === 'trashed') return false;
    } else {
      const allowed = isSuperAdmin
        ? statusFilters
        : statusFilters.filter((s) => s !== 'trashed');
      if (allowed.length === 0) return false;
      if (!allowed.includes(String(a.status || ''))) return false;
    }
    // gender
    if (genderFilters.length > 0) {
      const raw = (a as any)?.gender || a?.customResponses?.gender || a?.customResponses?.['النوع'] || (a as any)['النوع'] || '';
      const g = normalizeGender(raw);
      if (!genderFilters.includes(g)) return false;
    }
    // custom filters
    if (effectiveCustomFilters.length) {
      for (const f of effectiveCustomFilters) {
        try {
          const val = getCustomResponseValue(a, f);
          if (f.operator === 'equals' || f.operator === 'is') {
            if (String(val) !== String(f.value)) return false;
          } else if (f.operator === 'contains') {
            if (!String(val || '').toLowerCase().includes(String(f.value || '').toLowerCase())) return false;
          }
        } catch (e) { return false; }
      }
    }
    return true;
  });

  const filtered = useMemo(() => {
    if (hasSearchQuery || !duplicatesOnlyEnabled) return baseFiltered;
    const duplicateLookup = buildApplicantDuplicateLookup(
      baseFiltered as any[],
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
    return baseFiltered.filter((a: any) => {
      const aid = String((a as any)?._id || (a as any)?.id || '');
      return duplicateLookup.get(aid)?.isDuplicate === true;
    });
  }, [baseFiltered, duplicatesOnlyEnabled, currentUserId, jobPositionMap, hasSearchQuery]);

  // sort filtered by submittedAt (newest first by default)
  const sortedFiltered = useMemo(() => {
    try {
      const getTime = (r: any): number => {
        const v = r?.submittedAt || r?.submittedAt === 0 ? r.submittedAt : (r?.submittedAt ?? r?.submittedAt);
        const t = v ? new Date(v).getTime() : 0;
        return Number.isNaN(t) ? 0 : t;
      };

      return sortApplicantsByDuplicatePriority(
        filtered || [],
        currentUserId,
        (a: any, b: any) => {
        const ta = getTime(a);
        const tb = getTime(b);
        if (ta === tb) return 0;
        return submittedDesc ? (tb - ta) : (ta - tb);
        },
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
    } catch (e) {
      return filtered || [];
    }
  }, [filtered, submittedDesc, currentUserId, jobPositionMap]);

  const companyMap = useMemo(() => {
    const m: Record<string, string> = {};
    companies.forEach((c: any) => {
      const id = c._id || c.id;
      const label = toPlainString(c?.name) || toPlainString(c?.companyName) || toPlainString(c?.title) || "";
      if (id) m[id] = label;
    });
    return m;
  }, [companies]);

  const jobMap = useMemo(() => {
    const m: Record<string, string> = {};
    const getTitle = (j: any) => {
      if (!j) return '';
      if (typeof j.title === 'string') return j.title;
      if (typeof j.name === 'string') return j.name;
      if (j?.title?.en) return j.title.en;
      if (j?.name?.en) return j.name.en;
      return '';
    };
    jobPositions.forEach((j: any) => {
      const id = j._id || j.id;
      const title = getTitle(j) || '';
      if (id) m[id] = title;
    });
    return m;
  }, [jobPositions]);

  // Selection helpers
  const toggleSelect = (id?: string) => {
    if (!id) return;
    setSelectedMap((p) => {
      const next = { ...p };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };
  

  
  const clearSelection = () => setSelectedMap({});
  
  const selectedApplicantIds = useMemo(() => Object.keys(selectedMap), [selectedMap]);
  const deleteMutation = useDeleteApplicant();
  const updateStatusMutation = useUpdateApplicantStatus();

  const selectedApplicantRecipients = useMemo(() => {
    try {
      const ids = new Set(selectedApplicantIds);
      return (Array.isArray(applicants) ? applicants : [])
        .filter((a: any) => ids.has(normalizeIdGlobal(a._id) || normalizeIdGlobal(a.id)))
        .map((a: any) => {
          let jobPositionId = a.jobPositionId || (a.jobPosition && typeof a.jobPosition === 'object' ? a.jobPosition._id : a.jobPosition);
          if (jobPositionId && typeof jobPositionId === 'object') {
            jobPositionId = jobPositionId._id || jobPositionId.id || String(jobPositionId);
          }
          const fullName = a.fullName || a.name || a.firstName || '';
          return {
            email: typeof a.email === 'string' ? a.email.trim() : '',
            applicant: normalizeIdGlobal(a._id) || normalizeIdGlobal(a.id),
            jobPositionId: typeof jobPositionId === 'string' ? jobPositionId : undefined,
            applicantName: fullName,
          }
        })
        .filter((item: any) => Boolean(item.email));
    } catch (e) { return []; }
  }, [selectedApplicantIds, applicants]);

  const selectedApplicantCompanyId = useMemo(() => {
    try {
      const ids = new Set(selectedApplicantIds);
      const companiesFor = (Array.isArray(applicants) ? applicants : []).map((a: any) => {
        if (!ids.has(normalizeIdGlobal(a._id) || normalizeIdGlobal(a.id))) return null;
        const cid = a.companyId || a.company || a.companyObj || (a.jobPositionId && (a.jobPositionId.companyId || a.jobPositionId.company || a.jobPositionId.companyObj));
        const normalized = normalizeIdGlobal(cid);
        return normalized || null;
      }).filter(Boolean) as string[];
      const uniq = Array.from(new Set(companiesFor));
      return uniq.length === 1 ? uniq[0] : null;
    } catch (e) { return null; }
  }, [selectedApplicantIds, applicants]);

  const selectedApplicantCompany = useMemo(() => {
    try {
      if (!selectedApplicantCompanyId) return null;
      return (companies || []).find((c: any) => (c._id || c.id) === selectedApplicantCompanyId) || null;
    } catch (e) { return null; }
  }, [selectedApplicantCompanyId, companies]);

  const normalizeIdGlobal = (v: any) => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object') return v._id || v.id || undefined;
    return undefined;
  };

  // build gender options
  const genderOptions = useMemo(() => {
    const s = new Set<string>();
    const rows = Array.isArray(applicants) ? applicants : [];
    rows.forEach((a: any) => {
      // respect trashed visibility like desktop: non-super-admins should not see trashed
      if (!isSuperAdmin && a?.status === 'trashed') return;
      const raw = (a as any)?.gender || a?.customResponses?.gender || a?.customResponses?.['النوع'] || (a as any)['النوع'];
      const g = normalizeGender(raw);
      if (g) s.add(g);
    });
    const items = Array.from(s);
    const ordered: string[] = [];
    if (items.includes('Male')) ordered.push('Male');
    if (items.includes('Female')) ordered.push('Female');
    items.forEach((it) => { if (it !== 'Male' && it !== 'Female') ordered.push(it); });
    return ordered.map((g) => ({ id: g, title: g }));
  }, [applicants, isSuperAdmin]);

  // Update Data button
  const updating = Boolean(isJobPositionsFetching || isCompaniesFetching || isLoading || refreshing);

  // Pagination logic (apply to sortedFiltered)
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / pageSize));
  useEffect(() => {
    if (pageIndex >= totalPages) setPageIndex(0);
  }, [pageIndex, totalPages]);
  const paginated = sortedFiltered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const promises: Promise<any>[] = [];
      if (refetchJobPositions) promises.push(refetchJobPositions());
      if (refetch) promises.push(refetch());
      if (refetchCompanies) promises.push(refetchCompanies());
      await Promise.all(promises);
    } catch (e) {
      console.error('Refresh failed', e);
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; bg: string; icon: JSX.Element }> = {
      pending: { 
        color: 'text-yellow-700', 
        bg: 'bg-yellow-50 border-yellow-200',
        icon: <Clock size={12} className="text-yellow-600" />
      },
      interview: { 
        color: 'text-blue-700', 
        bg: 'bg-blue-50 border-blue-200',
        icon: <Users size={12} className="text-blue-600" />
      },
      interviewed: { 
        color: 'text-purple-700', 
        bg: 'bg-purple-50 border-purple-200',
        icon: <CheckCircle2 size={12} className="text-purple-600" />
      },
      approved: { 
        color: 'text-green-700', 
        bg: 'bg-green-50 border-green-200',
        icon: <CheckCircle2 size={12} className="text-green-600" />
      },
      rejected: { 
        color: 'text-red-700', 
        bg: 'bg-red-50 border-red-200',
        icon: <XCircle size={12} className="text-red-600" />
      },
      trashed: { 
        color: 'text-gray-700', 
        bg: 'bg-gray-50 border-gray-200',
        icon: <Trash2 size={12} className="text-gray-600" />
      },
    };
    return statusConfig[status] || statusConfig.pending;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-200/60 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-brand-600 to-brand-700 bg-clip-text text-transparent">
                Applicants
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {sortedFiltered.length} of {applicants?.length || 0} applicants
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterDrawerOpen(true)}
                className="p-2 rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
              >
                <SlidersHorizontal size={18} className="text-gray-600" />
              </button>
              <button
                onClick={handleRefresh}
                disabled={updating}
                className="p-2 rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
              >
                <RefreshCw size={18} className={`text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, or phone..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100"
              >
                <XCircle size={14} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 pb-24">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <LoadingSpinner />
            <p className="text-sm text-gray-500 mt-4">Loading applicants...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <AlertCircle size={32} className="text-red-500 mx-auto mb-2" />
            <p className="text-red-700 text-sm">{String(error)}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 px-4 py-2 bg-white border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50"
            >
              Try Again
            </button>
          </div>
        ) : sortedFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Users size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No applicants found</h3>
            <p className="text-sm text-gray-500 text-center max-w-xs">
              Try adjusting your filters or search query to find what you're looking for.
            </p>
          </div>
        ) : (
          <>
            {/* Selection Bar */}
            {selectedApplicantIds.length > 0 && (
              <div className="fixed bottom-20 left-4 right-4 z-30 animate-slide-up">
                <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-600">
                      {selectedApplicantIds.length} selected
                    </span>
                    <button
                      onClick={clearSelection}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <button
                      onClick={() => setShowBulkModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 rounded-xl text-blue-700 text-sm whitespace-nowrap"
                    >
                      <Send size={16} />
                      <span>Send Mail</span>
                    </button>
                    <button
                      onClick={async () => {
                        const { value: status } = await Swal.fire({
                          title: 'Change Status',
                          text: `Update status for ${selectedApplicantIds.length} applicant(s)`,
                          input: 'select',
                          inputOptions: {
                            pending: 'Pending',
                            interview: 'Interview',
                            interviewed: 'Interviewed',
                            approved: 'Approved',
                            rejected: 'Rejected',
                            trashed: 'Trashed'
                          },
                          showCancelButton: true,
                          confirmButtonText: 'Update',
                        });
                        if (!status) return;
                        
                        try {
                          await Promise.all(selectedApplicantIds.map((id) => 
                            updateStatusMutation.mutateAsync({ id, data: { status } } as any)
                          ));
                          Swal.fire('Success', `${selectedApplicantIds.length} applicants updated.`, 'success');
                          clearSelection();
                        } catch (e) {
                          Swal.fire('Error', 'Failed to update status', 'error');
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 rounded-xl text-purple-700 text-sm whitespace-nowrap"
                    >
                      <RefreshCw size={16} />
                      <span>Status</span>
                    </button>
                    <button
                      onClick={async () => {
                        const result = await Swal.fire({
                          title: 'Delete Applicants',
                          text: `Are you sure you want to delete ${selectedApplicantIds.length} applicant(s)?`,
                          icon: 'warning',
                          showCancelButton: true,
                          confirmButtonColor: '#ef4444',
                        });
                        if (!result.isConfirmed) return;
                        
                        try {
                          await Promise.all(selectedApplicantIds.map((id) => 
                            deleteMutation.mutateAsync(id)
                          ));
                          Swal.fire('Deleted', `${selectedApplicantIds.length} applicants deleted.`, 'success');
                          clearSelection();
                        } catch (e) {
                          Swal.fire('Error', 'Failed to delete', 'error');
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-50 rounded-xl text-red-700 text-sm whitespace-nowrap"
                    >
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Applicant Cards */}
            <div className="space-y-3">
              {paginated.map((a, index) => {
                const id = normalizeIdGlobal(a._id) || normalizeIdGlobal((a as any).id) || '';
                const isSelected = !!selectedMap[id];
                const statusBadge = getStatusBadge(a.status || 'pending');
                const seenBy = (a as any)?.seenBy ?? [];
                const currentUserId = (user as any)?._id || (user as any)?.id;
                const isSeen = Array.isArray(seenBy) && seenBy.some((s: any) => {
                  if (!s) return false;
                  if (typeof s === 'string') return s === currentUserId;
                  return (s._id === currentUserId) || (s.id === currentUserId);
                });

                return (
                  <div
                    key={id || index}
                    className={`bg-white rounded-2xl border-2 transition-all duration-200 hover:shadow-md active:scale-[0.98] ${
                      isSelected 
                        ? 'border-brand-500 shadow-lg shadow-blue-100' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                    onClick={(e) => {
                      if (a && (a._id || (a as any).id)) {
                        const navId = normalizeIdGlobal(a._id) || normalizeIdGlobal((a as any).id);
                        if (navId) queryClient.setQueryData(applicantsKeys.detail(navId), a as any);
                        if (e.ctrlKey || e.metaKey) {
                          const url = `${window.location.origin}/applicant-details/${navId}`;
                          window.open(url, '_blank', 'noopener,noreferrer');
                          return;
                        }
                        navigate(`/applicant-details/${navId}`, { state: { applicant: a } });
                      }
                    }}
                    onAuxClick={(e) => {
                      if (e.button !== 1) return;
                      e.preventDefault();
                      e.stopPropagation();
                      if (a && (a._id || (a as any).id)) {
                        const navId = normalizeIdGlobal(a._id) || normalizeIdGlobal((a as any).id);
                        if (!navId) return;
                        const url = `${window.location.origin}/applicant-details/${navId}`;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-start gap-3 mb-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => { e.stopPropagation(); toggleSelect(id); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 mt-1 rounded-lg border-2 border-gray-300 text-blue-600 focus:ring-brand-500 focus:ring-offset-0"
                        />
                        
                        <div 
                          className="relative w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 ring-2 ring-white shadow-md cursor-pointer flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); if (a.profilePhoto) setPreviewPhoto(a.profilePhoto); }}
                        >
                          {a.profilePhoto ? (
                            <LazyImage 
                              src={a.profilePhoto} 
                              alt={a.fullName} 
                              className="w-full h-full object-cover"
                              fallback={(a.firstName || a.fullName || '').charAt(0).toUpperCase()}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-500">
                              {(a.firstName || a.fullName || '').charAt(0).toUpperCase()}
                            </div>
                          )}
                          
                          {/* Seen indicator */}
                          {isSeen && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className={`text-base font-semibold truncate ${isSeen ? 'text-gray-500' : 'text-gray-900'}`}>
                              {a.fullName}
                            </h3>
                            <div className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${statusBadge.bg} ${statusBadge.color}`}>
                              {statusBadge.icon}
                              <span>{a.status?.replace('_', ' ')}</span>
                            </div>
                          </div>

                          <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                            <Mail size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate">{a.email || 'No email'}</span>
                          </p>
                          
                          {a.phone && (
                            <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                              <Phone size={14} className="text-gray-400 flex-shrink-0" />
                              <span className="truncate">{a.phone}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Company & Job Info */}
                      {(() => {
                        const rawCompany = (a as any).companyId || (a as any).company || (a as any).companyObj;
                        const rawJob = (a as any).jobPositionId || (a as any).job;
                        const displayCompany = companyMap[normalizeIdGlobal(rawCompany) || ''] || '';
                        const displayJob = jobMap[normalizeIdGlobal(rawJob) || ''] || '';
                        
                        if (!displayCompany && !displayJob) return null;
                        
                        return (
                          <div className="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-100">
                            {displayCompany && (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <Building2 size={14} className="text-gray-400 flex-shrink-0" />
                                <span className="truncate">{displayCompany}</span>
                              </div>
                            )}
                            {displayJob && (
                              <div className="flex items-center gap-2 text-sm text-gray-700 mt-1">
                                <Briefcase size={14} className="text-gray-400 flex-shrink-0" />
                                <span className="truncate">{displayJob}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const navId = normalizeIdGlobal(a._id) || normalizeIdGlobal((a as any).id);
                            if (!navId) return;
                            const url = `${window.location.origin}/applicant-details/${navId}`;
                            try {
                              window.open(url, '_blank', 'noopener,noreferrer');
                            } catch (err) {
                              // ignore
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 rounded-xl text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                          <ExternalLink size={16} />
                          <span>Open in new tab</span>
                        </button>
                        {/* <a
                          href={`mailto:${a.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 rounded-xl text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                          <Mail size={16} />
                          <span>Email</span>
                        </a> */}
                        {a.cvFilePath && (
                          <button
                            onClick={(e) => { e.stopPropagation(); void downloadCvForApplicant(a); }}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-brand-50 rounded-xl text-brand-700 text-sm font-medium hover:bg-green-100 transition-colors"
                          >
                            <Download size={16} />
                            <span>Download CV</span>
                          </button>
                        )}
                      </div>

                      {/* Submitted Date */}
                      {a.submittedAt && (
                        <div className="mt-2 flex items-center justify-end gap-1 text-xs text-gray-400">
                          <Calendar size={12} />
                          <span>Applied {new Date(a.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">
                  Showing {sortedFiltered.length === 0 ? 0 : (pageIndex * pageSize) + 1}-
                  {Math.min((pageIndex + 1) * pageSize, sortedFiltered.length)} of {sortedFiltered.length}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0); }}
                  className="px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between gap-3">
                <button
                  disabled={pageIndex <= 0}
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-50 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>
                <span className="text-sm font-medium text-gray-700">
                  Page {pageIndex + 1} of {totalPages}
                </span>
                <button
                  disabled={pageIndex >= totalPages - 1}
                  onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-50 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Sort Bar */}
            <div className="fixed bottom-4 left-4 right-4 z-20">
              <button
                onClick={() => setSubmittedDesc((s) => !s)}
                className="w-full bg-white rounded-2xl shadow-lg border border-gray-200 px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ArrowUpDown size={16} className="text-brand-500" />
                  Sort by submission date
                </span>
                <span className="flex items-center gap-1 text-brand-600">
                  {submittedDesc ? 'Newest first' : 'Oldest first'}
                  {submittedDesc ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>
            </div>
          </>
        )}
      </main>

      {/* Filter Drawer */}
      <div
        className={`fixed inset-0 z-50 transition-all duration-300 ${
          filterDrawerOpen ? 'visible' : 'invisible'
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
            filterDrawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setFilterDrawerOpen(false)}
        />
        
        {/* Drawer */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 transform ${
            filterDrawerOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <button
                onClick={() => setFilterDrawerOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Company Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-2">
                <p className="mb-2 text-xs text-gray-500">
                  {companyFilters.length ? `${companyFilters.length} selected` : 'All companies'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {companies.map((c: any) => {
                    const cid = String(c._id || c.id || '');
                    const selected = companyFilters.includes(cid);
                    return (
                      <button
                        key={cid}
                        type="button"
                        onClick={() => {
                          setCompanyFilters((prev) => {
                            if (selected) return prev.filter((id) => id !== cid);
                            return [...prev, cid];
                          });
                        }}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-gray-300 bg-white text-gray-700'
                        }`}
                      >
                        {toPlainString(c?.name) || toPlainString(c?.companyName) || toPlainString(c?.title)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Job Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Job Position</label>
              {companyFilters.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-500">
                  Select one or more companies first to show related job positions.
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-2">
                  <p className="mb-2 text-xs text-gray-500">
                    {jobFilters.length ? `${jobFilters.length} selected` : 'All jobs'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {displayedJobPositions.map((j: any) => {
                      const jid = String(j._id || j.id || '');
                      const selected = jobFilters.includes(jid);
                      return (
                        <button
                          key={jid}
                          type="button"
                          onClick={() => {
                            setJobFilters((prev) => {
                              if (selected) return prev.filter((id) => id !== jid);
                              return [...prev, jid];
                            });
                          }}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            selected
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-gray-300 bg-white text-gray-700'
                          }`}
                        >
                          {jobMap[j._id || j.id] || ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-2">
                <p className="mb-2 text-xs text-gray-500">
                  {statusFilters.length ? `${statusFilters.length} selected` : 'All statuses'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'pending',
                    'interview',
                    'interviewed',
                    'approved',
                    'rejected',
                    ...(isSuperAdmin ? ['trashed'] : []),
                  ].map((status) => {
                    const selected = statusFilters.includes(status);
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => {
                          setStatusFilters((prev) => {
                            if (selected) return prev.filter((s) => s !== status);
                            return [...prev, status];
                          });
                        }}
                        className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                          selected
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-gray-300 bg-white text-gray-700'
                        }`}
                      >
                        {status.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Gender Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-2">
                <p className="mb-2 text-xs text-gray-500">
                  {genderFilters.length ? `${genderFilters.length} selected` : 'All genders'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {genderOptions.map((g) => {
                    const selected = genderFilters.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setGenderFilters((prev) => {
                            if (selected) return prev.filter((id) => id !== g.id);
                            return [...prev, g.id];
                          });
                        }}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-gray-300 bg-white text-gray-700'
                        }`}
                      >
                        {g.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Clear Filters Button */}
            <button
              onClick={() => {
                setCompanyFilters([]);
                setJobFilters([]);
                setStatusFilters([]);
                setGenderFilters([]);
                setQuery("");
                setCustomFilters([]);
                setFilterDrawerOpen(false);
              }}
              className="w-full px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium hover:bg-red-100 transition-colors"
            >
              Clear All Filters
            </button>

            {/* Custom Filter Settings Button */}
            <button
              onClick={() => {
                setFilterDrawerOpen(false);
                setCustomFilterOpen(true);
              }}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              <SlidersHorizontal size={16} />
              <span>Custom Filter Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-lg"
          onClick={() => setPreviewPhoto(null)}
        >
          <button
            onClick={() => setPreviewPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors"
          >
            <X size={24} className="text-white" />
          </button>
          <img
            src={previewPhoto}
            alt="Applicant photo preview"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Custom Filter Modal */}
      <CustomFilterModal
        open={customFilterOpen}
        onClose={() => setCustomFilterOpen(false)}
        jobPositions={jobPositions}
        applicants={applicants}
        companies={companies}
        jobPositionMap={jobPositionMap}
        customFilters={customFilters}
        setCustomFilters={setCustomFilters}
        columnFilters={columnFilters}
        setColumnFilters={setColumnFilters as any}
      />

      {/* Bulk Message Modal */}
      <BulkMessageModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        recipients={selectedApplicantRecipients}
        companyId={selectedApplicantCompanyId || undefined}
        company={selectedApplicantCompany}
        onSuccess={() => {
          setShowBulkModal(false);
          clearSelection();
          Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: 'Bulk message sent successfully',
            timer: 2000,
            showConfirmButton: false
          });
        }}
      />
    </div>
  );
}