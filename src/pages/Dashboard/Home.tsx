import { useMemo, useState, useEffect } from "react";
import PageMeta from "../../components/common/PageMeta";
import DatePicker from "../../components/form/date-picker";
import { useAuth } from "../../context/AuthContext";
import { getApplicantStatuses } from "../../hooks/queries/useApplicantStatuses";
import type { Applicant } from "../../store/slices/applicantsSlice";
import {
  PaperPlaneIcon,
  EyeIcon,
  TimeIcon,
  ChatIcon,
  CheckCircleIcon,
  CheckLineIcon,
  CloseLineIcon,
  TrashBinIcon,
  UserIcon,
} from "../../icons";

const STATUSES: { key: Applicant['status']; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "interview", label: "Interview" },
  { key: "interviewed", label: "Interviewed" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "trashed", label: "Trashed" },
];

function getApplicantDate(a: any) {
  return (a && (a.submittedAt || a.createdAt)) || "";
}

export default function Home() {
  const [range, setRange] = useState<Date[] | null>(null);
  const [openStatus, setOpenStatus] = useState<string | null>(null);
  const { user } = useAuth();

  // Determine companyId based on user role; super admin fetches all
  const companyId = useMemo(() => {
    const roleName = user?.roleId?.name?.toLowerCase();
    if (!user || roleName === "super admin") {
      return undefined; // Fetch all
    }
    
    const usercompanyId =
      user.companies?.map((c) =>
        typeof c.companyId === "string" ? c.companyId : c.companyId._id
      ) || [];
    
    return usercompanyId.length > 0 ? usercompanyId : undefined;
  }, [user]);

  // Use React Query hook - server may return either minimal applicant objects (id, status, dates)
  // or a counts object { pending, interview, ... , total } from the lightweight endpoint.
  const { data: applicantsData = [], isLoading: loading, refetch, isFetching } = getApplicantStatuses(companyId as any, undefined);

  // normalize: if server returned counts object, treat accordingly
  const countsFromServer = applicantsData && !Array.isArray(applicantsData) ? applicantsData : null;
  const applicants = Array.isArray(applicantsData) ? applicantsData : [];

  const [lastRefetch, setLastRefetch] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState<string | null>(null);

  // When initial load finishes, start the timer from that moment
  useEffect(() => {
    if (!loading && lastRefetch === null) {
      setLastRefetch(new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Tick elapsed timer when lastRefetch is set
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
    // update every 30 seconds (relative times don't need per-second precision)
    const id = setInterval(update, 30 * 1000);
    return () => clearInterval(id);
  }, [lastRefetch]);

  const filtered = useMemo(() => {
    if (!range || range.length === 0) return applicants;
    if (range.length === 1) {
      const d = range[0];
      return applicants.filter((a) => {
        const ad = new Date(getApplicantDate(a));
        return (
          ad.getFullYear() === d.getFullYear() &&
          ad.getMonth() === d.getMonth() &&
          ad.getDate() === d.getDate()
        );
      });
    }

    const [start, end] = range;
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;
    if (!s || !e) return applicants;
    // normalize start to start of day, end to end of day
    s.setHours(0, 0, 0, 0);
    e.setHours(23, 59, 59, 999);
    return applicants.filter((a) => {
      const ad = new Date(getApplicantDate(a));
      return ad >= s && ad <= e;
    });
  }, [applicants, range]);

  const counts = useMemo(() => {
    // If server provided aggregated counts, use them (ensure keys exist)
    if (countsFromServer) {
      const c: Record<string, number> = {} as any;
      STATUSES.forEach((s) => (c[s.key] = Number(countsFromServer[s.key] ?? 0)));
      // keep trashed hidden
      c['trashed'] = 0;
      return c;
    }

    const c: Record<string, number> = {};
    STATUSES.forEach((s) => (c[s.key] = 0));
    applicants.forEach((a: any) => {
      if (a.status && a.status !== 'trashed') {
        c[a.status] = (c[a.status] || 0) + 1;
      }
    });
    c['trashed'] = 0;
    return c;
  }, [applicants, filtered, countsFromServer]);

  // Exclude trashed applicants for total calculations
  const filteredNonTrashed = useMemo(() => filtered.filter((a) => a.status !== 'trashed'), [filtered]);
  const applicantsNonTrashed = useMemo(() => applicants.filter((a) => a.status !== 'trashed'), [applicants]);

  const STATUS_ICON: Record<Applicant['status'] | 'total', any> = {
    total: UserIcon,
    applied: PaperPlaneIcon,
    under_review: EyeIcon,
    pending: TimeIcon,
    interview: ChatIcon,
    interviewed: CheckCircleIcon,
    accepted: CheckLineIcon,
    approved: CheckCircleIcon,
    rejected: CloseLineIcon,
    trashed: TrashBinIcon,
  };

  const TotalIcon = STATUS_ICON['total'];

  const STATUS_BG: Record<string, string> = {
    total: 'bg-indigo-50',
    applied: 'bg-indigo-50',
    under_review: 'bg-slate-50',
    pending: 'bg-yellow-50',
    interview: 'bg-blue-50',
    interviewed: 'bg-emerald-50',
    accepted: 'bg-emerald-50',
    approved: 'bg-emerald-50',
    rejected: 'bg-red-50',
    trashed: 'bg-gray-50',
  };

  function toggleOpen(key: string | 'total') {
    setOpenStatus((prev) => (prev === key ? null : key));
  }

  return (
    <>
      <PageMeta title="Dashboard | Applicants Overview" description="Applicants summary and filters" />

      <div className="space-y-6">
        <div className="grid grid-cols-12 gap-4 md:gap-6 items-end">
          <div className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3">
            <DatePicker
              id="applicant-range"
              label="Filter by date range"
              mode="range"
              placeholder="Select date range"
              onChange={(selectedDates) => setRange(selectedDates as Date[])}
            />
          </div>
          <div className="col-span-12 sm:col-span-6 md:col-span-8 lg:col-span-9">
            <div className="flex items-center gap-3 ml-4">
              <div className="text-sm text-gray-500">Showing</div>
              <div className="font-semibold text-gray-800">
                {loading ? "Loading..." : `${filteredNonTrashed.length} applicants`}
              </div>
              <div className="lg:ml-130">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await refetch();
                      setLastRefetch(new Date());
                    } catch (e) {
                      // ignore - errors handled by react-query
                    }
                  }}
                  disabled={isFetching}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
                >
                  {isFetching ? "Updating Data" : "Update Data"}
                </button>
              </div>
              <div className="ml-3 text-sm text-gray-500">
                {elapsed ? `Last Update: ${elapsed}` : "Not updated yet"}
              </div>
              <div className="text-sm text-gray-400">(from total {applicantsNonTrashed.length})</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Total card */}
          <div
            role="button"
            onClick={() => toggleOpen('total')}
            className={`rounded-2xl border border-gray-200 ${STATUS_BG['total']} p-5 dark:border-gray-800 dark:bg-white/[0.03] cursor-pointer`}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">Total Applicants</div>
              <div className="text-gray-400">
                {TotalIcon && <TotalIcon className="size-5" />}
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-800">{loading ? (
              <span className="inline-block h-6 w-14 rounded bg-gray-200 animate-pulse" />
            ) : countsFromServer.total}</div>
              
            {openStatus === 'total' && (
              <div className={`mt-4 border-t pt-3 space-y-2 max-h-56 overflow-auto`}>
                {filteredNonTrashed.length === 0 ? (
                  <div className="text-sm text-gray-500">No applicants</div>
                ) : (
                  filteredNonTrashed.map((a) => (
                    <div key={a._id} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-800">Applicant ID: {a._id}</div>
                      </div>
                      <div className="text-xs text-gray-400">{new Date(getApplicantDate(a)).toLocaleDateString()}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {STATUSES.map((s) => {
            const Icon = STATUS_ICON[s.key];
            const key = s.key;
            const applicantsOfStatus = filtered.filter((a) => a.status === key);
            const bgClass = STATUS_BG[key] || 'bg-gray-50';
            const expandedBg = bgClass.replace('-50', '-50/60');

            return (
              <div key={key}>
                <div
                  role="button"
                  onClick={() => toggleOpen(key)}
                  className={`rounded-2xl border border-gray-200 ${bgClass} p-5 dark:border-gray-800 dark:bg-white/[0.03] cursor-pointer`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">{s.label}</div>
                    <div className="text-gray-400">{Icon && <Icon className="size-5" />}</div>
                  </div>

                  <div className="mt-2 text-2xl font-bold text-gray-800">{loading ? (
                    <span className="inline-block h-6 w-8 rounded bg-gray-200 animate-pulse" />
                  ) : counts[key]}</div>
                </div>

                {openStatus === key && (
                  <div className={`mt-2 p-3 rounded-lg ${expandedBg} border border-gray-100 max-h-56 overflow-auto`}>
                    {loading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
                            <div className="flex-1">
                              <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : applicantsOfStatus.length === 0 ? (
                      <div className="text-sm text-gray-500">No applicants in this status</div>
                    ) : (
                      applicantsOfStatus.map((a) => (
                        <div key={a._id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                          <div>
                            <div className="text-sm font-medium text-gray-800">Applicant ID: {a._id}</div>
                          </div>
                          <div className="text-xs text-gray-400">{new Date(getApplicantDate(a)).toLocaleDateString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
