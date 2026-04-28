// components/dashboard/InterviewScheduleWidget.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyInterviews } from '../../hooks/queries';
import {
  ChatIcon,
  CheckCircleIcon,
  TimeIcon,
} from '../../icons';

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  scheduled:   { dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',   label: 'Scheduled'   },
  in_progress: { dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', label: 'In Progress' },
  completed:   { dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300', label: 'Completed'   },
  cancelled:   { dot: 'bg-red-400',    badge: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300',         label: 'Cancelled'   },
};

const getStatusStyle = (s: string) =>
  STATUS_STYLES[s] ?? { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600', label: s };

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    dayName:  d.toLocaleDateString('en-US', { weekday: 'short' }),
    day:      d.getDate(),
    month:    d.toLocaleDateString('en-US', { month: 'short' }),
    time:     d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    full:     d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  };
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function isTomorrow(dateStr: string) {
  const d = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.toDateString() === tomorrow.toDateString();
}

function getRelativeDay(dateStr: string) {
  if (isToday(dateStr)) return 'Today';
  if (isTomorrow(dateStr)) return 'Tomorrow';
  return null;
}

// ─── Timeline card (future) ──────────────────────────────────────────────────

function TimelineCard({ interview }: { interview: any }) {
  const navigate = useNavigate();
  const d = formatDate(interview.scheduledAt);
  const style = getStatusStyle(interview.status);
  const relDay = getRelativeDay(interview.scheduledAt);

  return (
    <div
      onClick={() => navigate(`/applicant-details/${interview.applicant._id}`)}
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
                {interview.applicant.fullName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                #{interview.applicant.applicantNo}
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
                {interview.type}
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
                🔗 Join call
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Past interviews table row ───────────────────────────────────────────────

function PastRow({ interview }: { interview: any }) {
  const navigate = useNavigate();
  const d = formatDate(interview.scheduledAt);
  const style = getStatusStyle(interview.status);

  return (
    <tr
      onClick={() => navigate(`/applicants/${interview.applicant._id}`)}
      className="group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
    >
      <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {d.full}
      </td>
      <td className="py-3 px-4">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{interview.applicant.fullName}</p>
        <p className="text-xs text-gray-400">#{interview.applicant.applicantNo}</p>
      </td>
      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
        {interview.jobPosition?.name ?? '—'}
      </td>
      <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
        {interview.type ?? '—'}
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

export default function InterviewScheduleWidget() {
  const [direction, setDirection] = useState<'future' | 'past'>('future');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useMyInterviews({ direction, page });

  const interviews = data?.interviews ?? [];
  const counts = data?.counts ?? {};
  const pagination = data?.pagination;

  const isEmpty = !isLoading && interviews.length === 0;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            My Interview Schedule
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {direction === 'future'
              ? `${counts.total ?? 0} upcoming interview${counts.total !== 1 ? 's' : ''}`
              : `${counts.total ?? 0} past interview${counts.total !== 1 ? 's' : ''}`}
          </p>
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
              {d === 'future' ? 'Upcoming' : 'Past'}
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
              const style = getStatusStyle(status);
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
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {direction === 'future' ? 'No upcoming interviews' : 'No past interviews'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {direction === 'future' ? 'You\'re all clear!' : 'Nothing to show here yet.'}
            </p>
          </div>
        ) : direction === 'future' ? (
          // Timeline
          <div className="p-5">
            {interviews.map((interview: any) => (
              <TimelineCard key={interview.interviewId} interview={interview} />
            ))}
          </div>
        ) : (
          // Past table
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    {['Date', 'Applicant', 'Position', 'Type', 'Status'].map((h) => (
                      <th key={h} className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {interviews.map((interview: any) => (
                    <PastRow key={interview.interviewId} interview={interview} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500">
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700
                      disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700
                      disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Next
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