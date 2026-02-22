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
import CustomFilterModal from "../../../components/modals/CustomFilterModal";
import Swal from 'sweetalert2';
import BulkMessageModal from '../../../components/modals/BulkMessageModal';
import { useDeleteApplicant, useUpdateApplicantStatus } from '../../../hooks/queries/useApplicants';

export default function ApplicantsMobilePage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Lazy image loader for profile photos to avoid loading all images at once
  function LazyImage({ src, alt, className }: { src?: string | null; alt?: string; className?: string }) {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
      if (!src) return;
      if (visible) return;
      try {
        const el = imgRef.current;
        if (!el) return;
        if (typeof IntersectionObserver === 'undefined') {
          setVisible(true);
          return;
        }
        const obs = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisible(true);
              try { obs.disconnect(); } catch (e) {}
            }
          });
        });
        obs.observe(el);
        return () => { try { obs.disconnect(); } catch (e) {} };
      } catch (e) {
        setVisible(true);
      }
    }, [src, visible]);

    if (!src) return null;
    return (
      // eslint-disable-next-line jsx-a11y/img-redundant-alt
      <img ref={imgRef} src={visible ? src : undefined} data-src={src} alt={alt || ''} loading="lazy" className={className} />
    );
  }
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string | undefined>(undefined);
  const [jobFilter, setJobFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [genderFilter, setGenderFilter] = useState<string | undefined>(undefined);
  const [customFilterOpen, setCustomFilterOpen] = useState(false);
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
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [submittedDesc, setSubmittedDesc] = useState<boolean>(true);

  const { data: companies = [], refetch: refetchCompanies, isFetching: isCompaniesFetching } = useCompanies();
  const { user } = useAuth();

  const isSuperAdmin = useMemo(() => {
    const roleName = user?.roleId?.name;
    return typeof roleName === 'string' && roleName.toLowerCase() === 'super admin';
  }, [user?.roleId?.name]);

  const companyId = useMemo(() => {
    if (!user) return undefined;
    const roleName = user?.roleId?.name?.toLowerCase();
    const isSuperAdmin = roleName === "super admin";
    const usercompanyId = user?.companies?.map((c: any) => (typeof c.companyId === "string" ? c.companyId : c.companyId?._id));
    if (isSuperAdmin) return undefined;
    return usercompanyId?.length ? usercompanyId : undefined;
  }, [user?._id, user?.roleId?.name, user?.companies]);

  // Decide whether we need to fetch for a specific company (when user selects a company
  // that's not part of the already-fetched `companies` list). For companies already
  // present in `companies`, we avoid refetch and filter client-side.
  const availableCompanyIds = useMemo(() => (companies || []).map((c: any) => c._id || c.id).filter(Boolean), [companies]);

  const needServerFetchForCompany = companyFilter ? !availableCompanyIds.includes(companyFilter) : false;
  const jobPositionsFetchParam = needServerFetchForCompany ? [companyFilter as string] : companyId;
  const applicantsFetchParam = needServerFetchForCompany ? [companyFilter as string] : companyId;

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
        if (Array.isArray(comp.value) && comp.value.length > 0) setCompanyFilter(String(comp.value[0]));
        else if (typeof comp.value === 'string') setCompanyFilter(comp.value);
        else setCompanyFilter(undefined);
      }
      if (job) {
        if (Array.isArray(job.value) && job.value.length > 0) setJobFilter(String(job.value[0]));
        else if (typeof job.value === 'string') setJobFilter(job.value);
        else setJobFilter(undefined);
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
    if (!companyFilter) return jobPositions || [];
    return (jobPositions || []).filter((j: any) => {
      const cid = j?.companyId || j?.company || (j?.companyObj && j.companyObj._id) || (j?.companyId?._id);
      const id = typeof cid === 'string' ? cid : cid?._id || cid?.id;
      return id === companyFilter;
    });
  }, [jobPositions, companyFilter]);

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
    if (companyFilter) {
      list = list.filter((a: any) => {
        const cid = getApplicantCompanyId(a);
        return cid === companyFilter;
      });
    }
    if (jobFilter) {
      list = list.filter((a: any) => {
        const jid = getApplicantJobId(a);
        return jid === jobFilter;
      });
    }
    return list;
  }, [applicants, companyFilter, jobFilter]);


  // persist custom filters immediately (so back navigation restores state)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('applicants_table_state');
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.customFilters = customFilters || [];
      const str = JSON.stringify(parsed);
      sessionStorage.setItem('applicants_table_state', str);
      try { localStorage.setItem('applicants_table_state', str); } catch (e) { }
    } catch (e) {}
  }, [customFilters]);


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

  const filtered = (displayedApplicants || []).filter((a) => {
    // status + trashed visibility
    if (!statusFilter) {
      // default 'All statuses' — hide trashed for everyone
      if (a.status === 'trashed') return false;
    } else {
      // explicit status selected
      if (statusFilter === 'trashed') {
        // only super admin can view trashed
        if (!isSuperAdmin) return false;
        if (a.status !== 'trashed') return false;
      } else {
        if (a.status !== statusFilter) return false;
      }
    }
    // gender
    if (genderFilter) {
      const raw = (a as any)?.gender || a?.customResponses?.gender || a?.customResponses?.['النوع'] || (a as any)['النوع'] || '';
      const g = normalizeGender(raw);
      if (g !== genderFilter) return false;
    }
    // custom filters
    if (customFilters && customFilters.length) {
      for (const f of customFilters) {
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
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (a.fullName || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q) ||
      (a.phone || "").toLowerCase().includes(q)
    );
  });

  // sort filtered by submittedAt (newest first by default)
  const sortedFiltered = useMemo(() => {
    try {
      const rows = (filtered || []).slice();
      const getTime = (r: any) => {
        const v = r?.submittedAt || r?.submittedAt === 0 ? r.submittedAt : (r?.submittedAt ?? r?.submittedAt);
        const t = v ? new Date(v).getTime() : 0;
        return Number.isNaN(t) ? 0 : t;
      };
      rows.sort((a: any, b: any) => {
        const ta = getTime(a);
        const tb = getTime(b);
        if (ta === tb) return 0;
        return submittedDesc ? (tb - ta) : (ta - tb);
      });
      return rows;
    } catch (e) {
      return filtered || [];
    }
  }, [filtered, submittedDesc]);

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

  const selectedApplicantEmails = useMemo(() => {
    try {
      const ids = new Set(selectedApplicantIds);
      return (Array.isArray(applicants) ? applicants : [])
        .filter((a: any) => ids.has(normalizeIdGlobal(a._id) || normalizeIdGlobal(a.id)))
        .map((a: any) => a.email)
        .filter(Boolean);
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
  }, [applicants]);

  // Update Data button
  const updating = Boolean(isJobPositionsFetching || isCompaniesFetching || isLoading);

  // Pagination logic (apply to sortedFiltered)
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / pageSize));
  useEffect(() => {
    if (pageIndex >= totalPages) setPageIndex(0);
  }, [pageIndex, totalPages]);
  const paginated = sortedFiltered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 overflow-x-hidden sm:px-0">
      <div className="sticky top-0 z-40 bg-white/60 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-md mx-auto px-6 sm:px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-primary-700">Applicants (Mobile)</h2>
            <p className="text-xs text-gray-500">Showing {sortedFiltered.length} of {(applicants || []).length}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setSubmittedDesc((s) => !s)} title={submittedDesc ? 'Newest' : 'Oldest'} className="px-2 py-1 text-sm bg-white border border-gray-200 rounded">
              <span className="mr-1">Submitted</span>
              <span className="text-xs">{submittedDesc ? '▼' : '▲'}</span>
            </button>
            <button
              onClick={async () => {
                try {
                  const promises: Promise<any>[] = [];
                  if (refetchJobPositions) promises.push(refetchJobPositions());
                  if (refetch) promises.push(refetch());
                  if (refetchCompanies) promises.push(refetchCompanies());
                  if (promises.length === 0) return;
                  await Promise.all(promises);
                } catch (e) {}
              }}
              disabled={updating}
              className="px-2 py-1 text-sm bg-white border border-gray-200 rounded hover:shadow-sm"
            >
              {updating ? 'Updating Data' : 'Update Data'}
            </button>
            <button onClick={async () => { try { if (refetchCompanies) await refetchCompanies(); } catch (e) {} setCustomFilterOpen(true); }} className="px-2 py-1 text-sm bg-white border border-gray-200 rounded">Filter Settings</button>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or phone"
              className="flex-1 px-2 py-1 text-sm rounded-md border border-gray-200 bg-white/70 placeholder-gray-400 focus:ring focus:ring-primary-100"
            />
            <div className="w-full sm:w-auto">
              <button onClick={() => { setCompanyFilter(undefined); setJobFilter(undefined); setStatusFilter(undefined); setGenderFilter(undefined); setQuery(""); setCustomFilters([]); }} className="w-full sm:w-auto px-2 py-1 text-sm bg-white border border-gray-200 rounded hover:bg-gray-50">Clear</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 sm:px-4 py-3 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <select value={companyFilter ?? ""} onChange={(e) => { setCompanyFilter(e.target.value || undefined); setJobFilter(undefined); }} className="px-2 py-1 text-sm rounded-md border border-gray-200 bg-white/80 shadow-sm">
            <option value="">All companies</option>
            {companies.map((c: any) => (
              <option key={c._id || c.id} value={c._id || c.id}>{toPlainString(c?.name) || toPlainString(c?.companyName) || toPlainString(c?.title)}</option>
            ))}
          </select>
          <select value={jobFilter ?? ""} onChange={(e) => setJobFilter(e.target.value || undefined)} className="px-2 py-1 text-sm rounded-md border border-gray-200 bg-white/80 shadow-sm">
            <option value="">All jobs</option>
            {displayedJobPositions.map((j: any) => (
              <option key={j._id || j.id} value={j._id || j.id}>{(jobMap[j._id || j.id] || '')}</option>
            ))}
          </select>
          <select value={statusFilter ?? ""} onChange={(e) => setStatusFilter(e.target.value || undefined)} className="px-2 py-1 text-sm rounded-md border border-gray-200 bg-white/80 shadow-sm">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="interview">Interview</option>
            <option value="interviewed">Interviewed</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="trashed">Trashed</option>
          </select>
          <select value={genderFilter ?? ""} onChange={(e) => setGenderFilter(e.target.value || undefined)} className="px-2 py-1 text-sm rounded-md border border-gray-200 bg-white/80 shadow-sm">
            <option value="">All genders</option>
            {genderOptions.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="py-10 flex justify-center"><LoadingSpinner /></div>
        ) : error ? (
          <div className="text-center text-red-600">{String(error)}</div>
        ) : sortedFiltered.length === 0 ? (
          <div className="text-center text-gray-500 py-10">No applicants found</div>
        ) : (
          <div className="space-y-3">
            {selectedApplicantIds.length > 0 && (
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm text-gray-700">{selectedApplicantIds.length} selected</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowBulkModal(true)} className="px-3 py-1 bg-white border border-gray-200 rounded text-xs shadow-sm">✉️ Mail</button>
                  <button onClick={async () => {
                    const { value: status } = await Swal.fire({
                      title: `Change status for ${selectedApplicantIds.length} applicant(s)`,
                      input: 'select',
                      inputOptions: { pending: 'pending', interview: 'interview', interviewed: 'interviewed', approved: 'approved', rejected: 'rejected', trashed: 'trashed' },
                      inputPlaceholder: 'Select status',
                      showCancelButton: true,
                    });
                    if (!status) return;
                    const confirmed = await Swal.fire({ title: 'Confirm', text: `Change status to ${status}?`, showCancelButton: true, confirmButtonText: 'Yes' });
                    if (!confirmed.isConfirmed) return;
                    try {
                      await Promise.all(selectedApplicantIds.map((id) => updateStatusMutation.mutateAsync({ id, data: { status } } as any)));
                      Swal.fire('Updated', `${selectedApplicantIds.length} applicants updated.`, 'success');
                      clearSelection();
                    } catch (e) { Swal.fire('Error', 'Failed to update status', 'error'); }
                  }} className="px-3 py-1 bg-white border border-gray-200 rounded text-xs shadow-sm">🔁 Status</button>
                  <button onClick={async () => {
                    const ok = await Swal.fire({ title: 'Delete applicants', text: `Are you sure you want to delete ${selectedApplicantIds.length} applicant(s)?`, icon: 'warning', showCancelButton: true });
                    if (!ok.isConfirmed) return;
                    try {
                      await Promise.all(selectedApplicantIds.map((id) => deleteMutation.mutateAsync(id)));
                      Swal.fire('Deleted', `${selectedApplicantIds.length} applicants deleted.`, 'success');
                      clearSelection();
                    } catch (e) { Swal.fire('Error', 'Failed to delete', 'error'); }
                  }} className="px-3 py-1 bg-white border border-red-200 text-red-700 rounded text-xs shadow-sm">🗑️ Delete</button>
                </div>
              </div>
            )}
        
            {paginated.map((a) => {
              const id = normalizeIdGlobal(a._id) || normalizeIdGlobal((a as any).id) || '';
              const isSelected = !!selectedMap[id];
              return (
                <article key={id || String(Math.random())} className={`bg-white/60 backdrop-blur-sm border ${isSelected ? 'border-primary-300 ring-1 ring-primary-100' : 'border-gray-100'} rounded-2xl p-3 shadow-sm hover:shadow-md transition relative`} onClick={() => {
                  if (a && (a._id || (a as any).id)) {
                    const navId = normalizeIdGlobal(a._id) || normalizeIdGlobal((a as any).id);
                    if (navId) queryClient.setQueryData(applicantsKeys.detail(navId), a as any);
                    navigate(`/applicant/${navId}`, { state: { applicant: a } });
                  }
                }}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(id); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 mt-1 ml-0 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500"
                      />
                    </div>
                    <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center text-xl font-semibold text-gray-700 ring-1 ring-primary-100 cursor-pointer" onClick={(e) => { e.stopPropagation(); if (a.profilePhoto) setPreviewPhoto(a.profilePhoto); }}>
                      {a.profilePhoto ? <LazyImage src={a.profilePhoto} alt={a.fullName} className="w-full h-full object-cover" /> : (a.firstName || a.fullName || '').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        {
                          (() => {
                            const seenBy = (a as any)?.seenBy ?? [];
                            const currentUserId = (user as any)?._id || (user as any)?.id || undefined;
                            const isSeen = Array.isArray(seenBy) && seenBy.some((s: any) => {
                              if (!s) return false;
                              if (typeof s === 'string') return s === currentUserId;
                              return (s._id === currentUserId) || (s.id === currentUserId);
                            });
                            return (
                              <h3 className={`text-sm font-semibold truncate ${isSeen ? 'text-gray-400' : 'text-slate-800'}`}>{a.fullName}</h3>
                            );
                          })()
                        }
                        <span className={`text-xs px-2 py-1 rounded-full ${a.status==='rejected' || a.status==='trashed' ? 'bg-red-50 text-red-700 ring-1 ring-red-100' : a.status==='accepted' || a.status==='approved' ? 'bg-green-50 text-green-700 ring-1 ring-green-100' : 'bg-yellow-50 text-yellow-800 ring-1 ring-yellow-100'}`}>{a.status.replace('_',' ')}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 truncate overflow-hidden whitespace-nowrap">{a.email || ''}{a.email && a.phone ? ' • ' : ''}{a.phone || ''}</p>
                      {
                        (() => {
                          const rawCompany = (a as any).companyId || (a as any).company || (a as any).companyObj;
                          const rawJob = (a as any).jobPositionId || (a as any).job;
                          const displayCompany = companyMap[normalizeIdGlobal(rawCompany) || ''] || '';
                          const displayJob = jobMap[normalizeIdGlobal(rawJob) || ''] || '';
                          if (!displayCompany && !displayJob) return null;
                          return (
                            <p className="text-xs text-gray-400 mt-1 truncate overflow-hidden whitespace-nowrap">{displayCompany}{displayCompany && displayJob ? ' • ' : ''}{displayJob}</p>
                          );
                        })()
                      }
                      <div className="mt-3 flex items-center gap-2">
                        <a onClick={(e) => e.stopPropagation()} href={`mailto:${a.email}`} className="px-3 py-1 bg-white/90 border border-gray-200 rounded text-xs shadow-sm">✉️ Email</a>
                        {a.phone ? <a onClick={(e) => e.stopPropagation()} href={`tel:${a.phone}`} className="px-3 py-1 bg-white/90 border border-gray-200 rounded text-xs shadow-sm">📞 Call</a> : null}
                        <button onClick={(e) => { e.stopPropagation(); if (a && a._id) { queryClient.setQueryData(applicantsKeys.detail(a._id), a as any); navigate(`/applicant/${a._id}`, { state: { applicant: a } }); } }} className="ml-auto px-3 py-1 bg-primary-600 text-white rounded text-xs shadow">View</button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {/* Pagination controls */}
            <div className="flex items-center justify-between mt-2 gap-2">
              <div className="text-xs text-gray-500">Showing {(sortedFiltered.length === 0) ? 0 : (pageIndex * pageSize) + 1}-{Math.min((pageIndex + 1) * pageSize, sortedFiltered.length)} of {sortedFiltered.length}</div>
              <div className="flex items-center gap-2">
                <button disabled={pageIndex <= 0} onClick={() => setPageIndex((p) => Math.max(0, p - 1))} className="px-2 py-1 bg-white border border-gray-200 rounded disabled:opacity-50">Prev</button>
                <button disabled={pageIndex >= totalPages - 1} onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))} className="px-2 py-1 bg-white border border-gray-200 rounded disabled:opacity-50">Next</button>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0); }} className="px-2 py-1 text-sm rounded-md border border-gray-200 bg-white">
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreviewPhoto(null)}>
              <div className="relative w-full h-full max-w-full max-h-full p-4 sm:rounded-lg sm:p-6 flex items-center justify-center">
                <button onClick={() => setPreviewPhoto(null)} className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg hover:bg-gray-100">✕</button>
                <img src={previewPhoto} alt="Applicant photo preview" style={{ maxHeight: 'calc(100vh - 120px)', maxWidth: '100%' }} className="object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
              </div>
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
      <BulkMessageModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        recipients={selectedApplicantEmails}
        companyId={selectedApplicantCompanyId || undefined}
        company={selectedApplicantCompany}
        onSuccess={() => { setShowBulkModal(false); clearSelection(); Swal.fire('Sent', 'Bulk message sent', 'success'); }}
      />
    </div>
  );
}
