// components/dashboard/InterviewScheduleWidget.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  companyInterviewsKeys,
  myInterviewsKeys,
  useCompanyInterviews,
  useMyInterviews,
} from '../../hooks/queries';
import {
  ChatIcon,
  CheckCircleIcon,
  TimeIcon,
} from '../../icons';
import { useQueryClient } from '@tanstack/react-query';
import { usersService } from '../../services/usersService';
import { companiesService } from '../../services/companiesService';
import { paths } from '../../router/Paths';
import { useLocale } from '../../context/LocaleContext';
import { useCompanyFilter } from '../../context/CompanyFilterContext';

// ─── helpers ────────────────────────────────────────────────────────────────

interface InterviewLike {
  interviewId?: string;
  scheduledAt?: string;
  status?: string;
  type?: string;
  location?: string;
  videoLink?: string;
  companyId?: string;
  company?: string | { _id?: string; id?: string };
  scheduledBy?: string | { _id?: string; id?: string; fullName?: string; name?: string };
  conductedBy?: string | { _id?: string; id?: string; fullName?: string; name?: string };
  applicant?: {
    _id?: string;
    id?: string;
    fullName?: string;
    applicantNo?: string | number;
    companyId?: string;
    company?: string | { _id?: string; id?: string };
  };
  jobPosition?: {
    _id?: string;
    id?: string;
    name?: string;
    companyId?: string;
    company?: string | { _id?: string; id?: string };
  };
}

const toUserLabel = (value?: InterviewLike['scheduledBy']): string => {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return value.fullName ?? value.name ?? (value._id ?? value.id ?? '—');
};

const getStatusLabel = (status: string | undefined, t: (key: string, ns?: string) => string) => {
  const map: Record<string, string> = {
    scheduled: t('scheduled', 'interview'),
    in_progress: t('inProgress', 'interview'),
    completed: t('completed', 'interview'),
    cancelled: t('cancelled', 'interview'),
  };
  return status ? (map[status] ?? status) : '—';
};

const getStatusStyle = (s: string | undefined, t: (key: string, ns?: string) => string) => {
  const base: Record<string, { dot: string; badge: string }> = {
    scheduled:   { dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    in_progress: { dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    completed:   { dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    cancelled:   { dot: 'bg-red-400',    badge: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300' },
  };
  const style = (s && base[s]) ?? { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' };
  return { ...style, label: getStatusLabel(s, t) };
};

function formatDate(dateStr: string | undefined, locale: string) {
  const d = dateStr ? new Date(dateStr) : null;
  if (!d || isNaN(d.getTime())) {
    return {
      dayName: '—',
      day: '—',
      month: '—',
      time: '—',
      full: '—',
    };
  }
  return {
    dayName:  d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }),
    day:      d.getDate(),
    month:    d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short' }),
    time:     d.toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
    full:     d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  };
}

function isToday(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function isTomorrow(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.toDateString() === tomorrow.toDateString();
}

function getRelativeDay(dateStr: string | undefined, t: (key: string, ns?: string) => string) {
  if (isToday(dateStr)) return t('today', 'interview');
  if (isTomorrow(dateStr)) return t('tomorrow', 'interview');
  return null;
}

// ─── Timeline card (future) ──────────────────────────────────────────────────

function TimelineCard({ interview, t, locale }: { interview: InterviewLike; t: (key: string, ns?: string) => string; locale: string }) {
  const navigate = useNavigate();
  const d = formatDate(interview.scheduledAt, locale);
  const style = getStatusStyle(interview.status, t);
  const relDay = getRelativeDay(interview.scheduledAt, t);

  return (
    <div
      onClick={() => navigate(paths.applicants.details(String(interview.applicant?._id ?? '')))}
      className="group flex gap-4 cursor-pointer"
    >
      {/* Date column */}
      <div className="flex flex-col items-center w-16 shrink-0">
        <div
          className={`flex flex-col items-center justify-center rounded-xl w-16 h-16 border-2 transition-all
            ${isToday(interview.scheduledAt)
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
              : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
            }`}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
            {relDay ?? d.month}
          </span>
          <span className={`text-xl font-bold leading-none ${isToday(interview.scheduledAt) ? 'text-brand-600' : 'text-gray-800 dark:text-gray-100'}`}>
            {relDay ? d.time.split(':')[0] : d.day}
          </span>
          {!relDay && (
            <span className="text-[10px] text-gray-400">{d.dayName}</span>
          )}
        </div>
        {/* Connector line */}
        <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 mt-2" />
      </div>

      {/* Card */}
      <div className="flex-1 pb-4">
        <div
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800
            p-4 shadow-sm group-hover:shadow-md group-hover:border-brand-300 dark:group-hover:border-brand-600
            transition-all"
        >
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                {interview.applicant?.fullName ?? '—'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {interview.applicant?.applicantNo != null && `#${interview.applicant.applicantNo}`}
                {interview.jobPosition?.name && (
                  <> · {interview.jobPosition.name}</>
                )}
              </p>
            </div>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
              {style.label}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <TimeIcon className="size-3.5" />
              {d.full} · {d.time}
            </span>
            {interview.type && (
              <span className="flex items-center gap-1">
                <ChatIcon className="size-3.5" />
                {t(interview.type === 'in-person' ? 'inPerson' : interview.type, 'modals')}
              </span>
            )}
            {interview.location && (
              <span className="truncate max-w-[180px]">📍 {interview.location}</span>
            )}
            {interview.videoLink && (
              <a
                href={interview.videoLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-brand-500 hover:underline"
              >
                🔗 {t('joinCall', 'interview')}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Past interviews table row ───────────────────────────────────────────────

function PastRow({ interview, t, locale, showPeople }: { interview: InterviewLike; t: (key: string, ns?: string) => string; locale: string; showPeople?: boolean }) {
  const navigate = useNavigate();
  const d = formatDate(interview.scheduledAt, locale);
  const style = getStatusStyle(interview.status, t);

  return (
    <tr
      onClick={() => navigate(paths.applicants.details(String(interview.applicant?._id ?? '')))}
      className="group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
    >
      <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {d.full}
      </td>
      <td className="py-3 px-4">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{interview.applicant?.fullName ?? '—'}</p>
        <p className="text-xs text-gray-400">{interview.applicant?.applicantNo != null && `#${interview.applicant.applicantNo}`}</p>
      </td>
      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
        {interview.jobPosition?.name ?? '—'}
      </td>
      {showPeople && (
        <>
          <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {toUserLabel(interview.scheduledBy)}
          </td>
          <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {toUserLabel(interview.conductedBy)}
          </td>
        </>
      )}
      <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
        {t(interview.type === 'in-person' ? 'inPerson' : interview.type || '', 'modals')}
      </td>
      <td className="py-3 px-4">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
          {style.label}
        </span>
      </td>
    </tr>
  );
}

// ─── Main widget ─────────────────────────────────────────────────────────────

export default function InterviewScheduleWidget({ companyId }: { companyId?: string | null }) {
  const { t, dir, locale } = useLocale();
  const { selectedCompanyId } = useCompanyFilter();
  const [tab, setTab] = useState<'mine' | 'company'>('mine');
  const [direction, setDirection] = useState<'future' | 'past'>('future');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const effectiveCompanyId = companyId ?? selectedCompanyId ?? null;

  const myInterviewsQuery = useMyInterviews({
    direction,
    page,
    enabled: tab === 'mine',
  });
  const companyInterviewsQuery = useCompanyInterviews(effectiveCompanyId, {
    direction,
    page,
    enabled: tab === 'company',
  });

  const { data, isLoading, isFetching } = tab === 'company'
    ? companyInterviewsQuery
    : myInterviewsQuery;

  const interviews = useMemo(
    () => (data?.interviews ?? []) as InterviewLike[],
    [data]
  );
  const counts = data?.counts ?? {};
  const pagination = data?.pagination;

  // Prefetch next page whenever we're in past mode
  useEffect(() => {
    if (direction !== 'past') return;
    if (pagination && page >= pagination.totalPages) return; // no next page exists

    const nextPage = page + 1;
    if (tab === 'company' && effectiveCompanyId) {
      queryClient.prefetchQuery({
        queryKey: companyInterviewsKeys.list(effectiveCompanyId, {
          direction: 'past',
          page: nextPage,
          limit: 20,
        }),
        queryFn: () =>
          companiesService.getCompanyInterviews(effectiveCompanyId, {
            direction: 'past',
            page: nextPage,
            limit: 20,
          }),
        staleTime: 2 * 60 * 1000, // same staleTime as the hook so it won't re-fetch unnecessarily
      });
    } else {
      queryClient.prefetchQuery({
        queryKey: myInterviewsKeys.list({
          direction: 'past',
          page: nextPage,
          limit: 20,
        }),
        queryFn: () =>
          usersService.getMyInterviews({
            direction: 'past',
            page: nextPage,
            limit: 20,
          }),
        staleTime: 2 * 60 * 1000, // same staleTime as the hook so it won't re-fetch unnecessarily
      });
    }
  }, [direction, page, pagination, queryClient, effectiveCompanyId, tab]);

  // When switching to past, page 1 loads normally and this prefetches page 2 immediately
  // When on page 1 → prefetches page 2
  // When user clicks next (now on page 2, already cached) → prefetches page 3
  // ...and so on

  const isEmpty = !isLoading && interviews.length === 0;

  const handleNextPage = () =>
    setPage((p) => Math.min(pagination!.totalPages, p + 1));
  const handlePrevPage = () => setPage((p) => Math.max(1, p - 1));

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t('title', 'interview')}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {direction === 'future'
                ? t('upcomingCount' + (counts.total !== 1 ? '_plural' : ''), 'interview', { count: counts.total ?? 0 })
                : t('pastCount' + (counts.total !== 1 ? '_plural' : ''), 'interview', { count: counts.total ?? 0 })}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
            {(['mine', 'company'] as const).map((tb) => (
              <button
                key={tb}
                onClick={() => { setTab(tb); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  tab === tb
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tb === 'mine' ? t('myInterviews', 'interview') : t('companyInterviews', 'interview')}
              </button>
            ))}
          </div>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
          {(['future', 'past'] as const).map((d) => (
            <button
              key={d}
              onClick={() => { setDirection(d); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                direction === d
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {d === 'future' ? t('upcoming', 'interview') : t('past', 'interview')}
            </button>
          ))}
        </div>
      </div>

      {/* Summary pills */}
      {!isLoading && Object.keys(counts).length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          {Object.entries(counts)
            .filter(([key]) => key !== 'total')
              .map(([status, count]) => {
                const style = getStatusStyle(status, t);
                return (
                <span key={status} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${style.badge}`}>
                  <span className={`size-1.5 rounded-full ${style.dot}`} />
                  {style.label}: {String(count)}
                </span>
              );
            })}
        </div>
      )}

      {/* Body */}
      <div className={`${isFetching ? 'opacity-60' : ''} transition-opacity`}>
        {isLoading ? (
          // Skeleton
          <div className="p-5 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse shrink-0" />
                <div className="flex-1 h-20 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="size-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <CheckCircleIcon className="size-6 text-gray-400" />
            </div>
            {tab === 'company' && !effectiveCompanyId ? (
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('noCompanySelected', 'interview')}
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {direction === 'future' ? t('noUpcoming', 'interview') : t('noPast', 'interview')}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {direction === 'future' ? t('allClear', 'interview') : t('nothingToShow', 'interview')}
                </p>
              </>
            )}
          </div>
        ) : direction === 'future' ? (
          // Timeline
          <div className="p-5">
            {interviews.map((interview: InterviewLike) => (
              <TimelineCard key={interview.interviewId} interview={interview} t={t} locale={locale} />
            ))}
          </div>
        ) : (
          // Past table
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-start" dir={dir}>
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    {['date', 'applicant', 'position']
                      .concat(tab === 'company' ? ['scheduledBy', 'conductedBy'] : [])
                      .concat(['type', 'status'])
                      .map((h) => (
                        <th key={h} className="py-2.5 px-4 text-start text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {t(h, 'interview')}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {interviews.map((interview: InterviewLike) => (
                    <PastRow key={interview.interviewId} interview={interview} t={t} locale={locale} showPeople={tab === 'company'} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500">
                  {t('pageInfo', 'interview', { page: pagination.page, totalPages: pagination.totalPages, total: pagination.total })}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePrevPage()}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700
                      disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {t('previous', 'interview')}
                  </button>
                  <button
                    onClick={() => handleNextPage()}
                    disabled={page === pagination.totalPages}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700
                      disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {t('next', 'interview')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}