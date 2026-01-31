import { useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import DatePicker from "../../components/form/date-picker";
import { useAuth } from "../../context/AuthContext";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchApplicants } from "../../store/slices/applicantsSlice";
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
  { key: "applied", label: "Applied" },
  { key: "pending", label: "Pending" },
  { key: "interview", label: "Interview" },
  { key: "interviewed", label: "Interviewed" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "trashed", label: "Trashed" },
];

function getApplicantDate(a: Applicant) {
  return a.submittedAt || a.createdAt || "";
}

export default function Home() {
  // local transient state not required; using store loading
  const [range, setRange] = useState<Date[] | null>(null);
  const [openStatus, setOpenStatus] = useState<string | null>(null);
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const applicants = useAppSelector((s) => s.applicants.applicants);
  const loading = useAppSelector((s) => s.applicants.loading);
  const isFetched = useAppSelector((s) => s.applicants.isFetched);
  const lastFetchedCompanyIds = useAppSelector(
    (s) => s.applicants.lastFetchedCompanyIds
  );

  useEffect(() => {
    // determine companyIds based on user role; super admin should fetch all
    const roleName = user?.roleId?.name?.toLowerCase();
    let companyIds: string[] | undefined = undefined;

    if (user && roleName !== "super admin") {
      const userCompanyIds =
        user.companies?.map((c) =>
          typeof c.companyId === "string" ? c.companyId : c.companyId._id
        ) || [];
      if (userCompanyIds.length > 0) companyIds = userCompanyIds;
    }

    // Only fetch if not already fetched for the same companyIds to avoid unnecessary requests
    const sameCompanyIds = (() => {
      if (!isFetched) return false;
      const a = lastFetchedCompanyIds || [];
      const b = companyIds || [];
      if (a.length !== b.length) return false;
      const sortedA = [...a].sort();
      const sortedB = [...b].sort();
      return sortedA.every((v, i) => v === sortedB[i]);
    })();

    if (!isFetched || !sameCompanyIds) {
      dispatch(fetchApplicants(companyIds));
    }
  }, [user, dispatch, isFetched]);

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
    const c: Record<string, number> = {};
    STATUSES.forEach((s) => (c[s.key] = 0));
    filtered.forEach((a) => {
      c[a.status] = (c[a.status] || 0) + 1;
    });
    return c;
  }, [filtered]);

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
                {loading ? "Loading..." : `${filtered.length} applicants`}
              </div>
              <div className="text-sm text-gray-400">(from total {applicants.length})</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Total card */}
          <div
            role="button"
            onClick={() => toggleOpen('total')}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">Total Applicants</div>
              <div className="text-gray-400">
                {TotalIcon && <TotalIcon className="size-5" />}
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-800">{loading ? (
              <span className="inline-block h-6 w-14 rounded bg-gray-200 animate-pulse" />
            ) : filtered.length}</div>
            {openStatus === 'total' && (
              <div className="mt-4 border-t pt-3 space-y-2 max-h-56 overflow-auto">
                {filtered.length === 0 ? (
                  <div className="text-sm text-gray-500">No applicants</div>
                ) : (
                  filtered.map((a) => (
                    <div key={a._id} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-800">{a.fullName}</div>
                        <div className="text-xs text-gray-500">{a.email}</div>
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

            return (
              <div key={key}>
                <div
                  role="button"
                  onClick={() => toggleOpen(key)}
                  className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] cursor-pointer"
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
                  <div className="mt-2 p-3 rounded-lg bg-white/60 border border-gray-100 max-h-56 overflow-auto">
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
                            <div className="text-sm font-medium text-gray-800">{a.fullName}</div>
                            <div className="text-xs text-gray-500">{a.email}</div>
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
