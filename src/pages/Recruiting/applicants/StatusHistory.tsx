import { Fragment, useState } from 'react';
import ComponentCard from '../../../components/common/ComponentCard';
import { useAuth } from '../../../context/AuthContext';
import { toPlainString } from '../../../utils/strings';

type Props = {
  applicant: any;
  loading?: boolean;
};

// Local helpers (copied from ApplicantData originally)
const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getReadableMessageText = (value?: string) => {
  if (!value) return '';

  // Some messages are saved as escaped HTML (&lt;p&gt;...); decode first.
  const rawValue = String(value);
  const decoded = typeof document !== 'undefined'
    ? (() => {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = rawValue;
      return textarea.value;
    })()
    : rawValue;

  const withLineBreaks = decoded
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>\s*<\s*p\s*>/gi, '\n\n')
    .replace(/<\s*\/div\s*>\s*<\s*div\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '');

  return withLineBreaks
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'interview':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'interviewed':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'approved':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'rejected':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
  }
};

export default function StatusHistory({ applicant, loading = false }: Props) {
  const { user } = useAuth();
  const [activityTab, setActivityTab] = useState<'all' | 'status' | 'actions' | 'interview'>('all');
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  return (
    <div>
      <ComponentCard
        title="Activity Timeline"
        desc="Track all activities, status changes, messages, and comments"
      >
        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActivityTab('all')}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition ${
                activityTab === 'all'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActivityTab('status')}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition ${
                activityTab === 'status'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Status
            </button>
            <button
              onClick={() => setActivityTab('actions')}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition ${
                activityTab === 'actions'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Actions
            </button>
            <button
              onClick={() => setActivityTab('interview')}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition ${
                activityTab === 'interview'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Interview
            </button>
          </nav>
        </div>

        <div className="w-full">
          {loading ? (
            <div className="overflow-x-auto rounded-lg border border-stroke dark:border-strokedark">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Summary</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Channels</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-14 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            (() => {
              const activities: Array<{
                type: 'status' | 'message' | 'comment' | 'interview';
                date: string;
                data: any;
              }> = [];

              // Add status history
              applicant?.statusHistory?.forEach((history: any) => {
                activities.push({ type: 'status', date: history.changedAt, data: history });
              });

              // Add messages
              applicant?.messages?.forEach((message: any) => {
                activities.push({
                  type: 'message',
                  date: message.sentAt || message.createdAt || new Date().toISOString(),
                  data: message,
                });
              });

              // Add comments
              applicant?.comments?.forEach((comment: any) => {
                activities.push({
                  type: 'comment',
                  date: comment.commentedAt || comment.changedAt || comment.createdAt || new Date().toISOString(),
                  data: comment,
                });
              });

              // Add interviews
              applicant?.interviews?.forEach((interview: any) => {
                activities.push({
                  type: 'interview',
                  date: interview.scheduledAt || interview.createdAt || interview.issuedAt || new Date().toISOString(),
                  data: interview,
                });
              });

              // Sort by date (newest first)
              activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              // Filter activities based on selected tab
              const filteredActivities = activities.filter((activity) => {
                if (activityTab === 'all') return true;
                if (activityTab === 'status') return activity.type === 'status';
                if (activityTab === 'actions') return activity.type === 'message' || activity.type === 'comment';
                if (activityTab === 'interview') return activity.type === 'interview';
                return false;
              });

              if (filteredActivities.length === 0) {
                return (
                  <div className="rounded-lg border border-dashed border-stroke p-6 text-center text-sm text-gray-500 dark:border-strokedark dark:text-gray-400">
                    No activity records found for this tab.
                  </div>
                );
              }

              const getChannels = (activity: any) => {
                if (activity.type === 'status' || activity.type === 'interview') {
                  return activity.data?.notifications?.channels;
                }
                return null;
              };

              const getActorName = (activity: any): string => {
                if (activity.type === 'status') {
                  const history = activity.data;
                  let actorName: string | null = null;

                  if (history.changedBy && typeof history.changedBy === 'string' && history.changedBy.toLowerCase() !== 'system') {
                    actorName = history.changedBy;
                  }

                  if (!actorName && history.changedBy && typeof history.changedBy === 'object') {
                    actorName = history.changedBy.fullName || history.changedBy.email || null;
                  }

                  if (!actorName) {
                    const histTime = history.changedAt ? new Date(history.changedAt).getTime() : null;
                    const withinWindow = (time?: string) => {
                      if (!histTime || !time) return false;
                      const t = new Date(time).getTime();
                      return Math.abs(t - histTime) <= 2 * 60 * 1000;
                    };

                    if (!actorName && applicant?.messages) {
                      const match = applicant.messages.find((m: any) => (withinWindow(m.sentAt) || withinWindow(m.createdAt)) && m.sentBy);
                      if (match) {
                        actorName = typeof match.sentBy === 'string' ? match.sentBy : (match.sentBy?.fullName || match.sentBy?.email || null);
                      }
                    }

                    if (!actorName && applicant?.comments) {
                      const match = applicant.comments.find((c: any) => (withinWindow(c.changedAt) || withinWindow(c.commentedAt) || withinWindow(c.createdAt)) && (c.changedBy || c.author));
                      if (match) {
                        actorName = typeof match.changedBy === 'string' ? match.changedBy : (match.changedBy?.fullName || match.changedBy?.email || match.author || null);
                      }
                    }

                    if (!actorName && applicant?.interviews) {
                      const match = applicant.interviews.find((iv: any) => (withinWindow(iv.scheduledAt) || withinWindow(iv.createdAt) || withinWindow(iv.issuedAt)) && iv.issuedBy);
                      if (match) {
                        actorName = typeof match.issuedBy === 'string' ? match.issuedBy : (match.issuedBy?.fullName || match.issuedBy?.email || null);
                      }
                    }
                  }

                  const currentUserLabel = user?.fullName || user?.email || 'Current User';
                  return (
                    actorName ||
                    (typeof history.changedBy === 'string' && history.changedBy.toLowerCase() !== 'system'
                      ? history.changedBy
                      : (history.changedBy as any)?.fullName || (history.changedBy as any)?.email || currentUserLabel)
                  );
                }

                if (activity.type === 'message') {
                  const sentBy = activity.data?.sentBy;
                  if (typeof sentBy === 'string') return sentBy;
                  return sentBy?.fullName || sentBy?.email || 'Unknown';
                }

                if (activity.type === 'comment') {
                  const comment = activity.data;
                  const author = comment.commentedBy || comment.changedBy || comment.author || comment.createdBy;
                  if (typeof author === 'string') return author;
                  if (author && typeof author === 'object') {
                    return author.fullName || (typeof author.name === 'object' ? toPlainString(author.name) : author.name) || author.email || author.username || 'User';
                  }
                  return 'Unknown';
                }

                if (activity.type === 'interview') {
                  const issuedBy = activity.data?.issuedBy;
                  if (typeof issuedBy === 'string') return issuedBy;
                  return issuedBy?.fullName || issuedBy?.email || user?.fullName || user?.email || 'System';
                }

                return '-';
              };

              const getTypeBadge = (activity: any) => {
                if (activity.type === 'status') {
                  const status = activity.data?.status || 'status';
                  return {
                    label: status.charAt(0).toUpperCase() + status.slice(1),
                    className: getStatusColor(status),
                  };
                }

                if (activity.type === 'message') {
                  return {
                    label: 'Message',
                    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                  };
                }

                if (activity.type === 'comment') {
                  return {
                    label: 'Comment',
                    className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
                  };
                }

                const interviewStatus = String(activity.data?.status || '').toLowerCase();
                if (interviewStatus === 'completed') {
                  return {
                    label: 'Interview (Completed)',
                    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  };
                }
                if (interviewStatus === 'cancelled') {
                  return {
                    label: 'Interview (Cancelled)',
                    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                  };
                }
                if (interviewStatus === 'rescheduled') {
                  return {
                    label: 'Interview (Rescheduled)',
                    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                  };
                }
                return {
                  label: 'Interview',
                  className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                };
              };

              const getSummary = (activity: any): string => {
                if (activity.type === 'status') {
                  return activity.data?.notes || 'Status updated.';
                }
                if (activity.type === 'message') {
                  const message = activity.data;
                  const content = getReadableMessageText(message.content || message.body || message.message);
                  return message.subject || content || 'Message sent.';
                }
                if (activity.type === 'comment') {
                  return activity.data?.comment || activity.data?.text || 'Comment added.';
                }
                const interview = activity.data;
                if (interview?.scheduledAt) {
                  return `Scheduled for ${formatDate(interview.scheduledAt)}`;
                }
                return interview?.notes || interview?.comment || 'Interview activity.';
              };

              const renderDetails = (activity: any) => {
                if (activity.type === 'status') {
                  const history = activity.data;
                  return (
                    <div className="space-y-2">
                      {history.notes ? (
                        <p className="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{history.notes}</p>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No additional notes.</p>
                      )}
                    </div>
                  );
                }

                if (activity.type === 'message') {
                  const message = activity.data;
                  const messageContent = getReadableMessageText(message.content || message.body || message.message);
                  return (
                    <div className="space-y-2">
                      {message.subject && (
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Subject: {message.subject}</p>
                      )}
                      {messageContent ? (
                        <p className="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{messageContent}</p>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No message body available.</p>
                      )}
                    </div>
                  );
                }

                if (activity.type === 'comment') {
                  const comment = activity.data;
                  return (
                    <p className="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{comment.comment || comment.text || 'No comment text available.'}</p>
                  );
                }

                const interview = activity.data;
                return (
                  <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 dark:text-gray-300 md:grid-cols-2">
                    {interview.scheduledAt && (
                      <div>
                        <span className="font-semibold text-gray-500 dark:text-gray-400">Scheduled:</span>{' '}
                        {new Date(interview.scheduledAt).toLocaleString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    )}
                    {interview.type && (
                      <div>
                        <span className="font-semibold text-gray-500 dark:text-gray-400">Type:</span> {interview.type}
                      </div>
                    )}
                    {interview.location && (
                      <div>
                        <span className="font-semibold text-gray-500 dark:text-gray-400">Location:</span> {interview.location}
                      </div>
                    )}
                    {interview.videoLink && (
                      <div>
                        <span className="font-semibold text-gray-500 dark:text-gray-400">Video:</span>{' '}
                        <a href={interview.videoLink} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-400">
                          {interview.videoLink}
                        </a>
                      </div>
                    )}
                    {(interview.notes || interview.comment) && (
                      <div className="md:col-span-2">
                        <span className="font-semibold text-gray-500 dark:text-gray-400">Notes:</span>{' '}
                        <span className="whitespace-pre-line">{interview.notes || interview.comment}</span>
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div className="overflow-x-auto rounded-lg border border-stroke dark:border-strokedark">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800/60">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">By</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Summary</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Channels</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {filteredActivities.map((activity, index) => {
                        const rowKey = `${activity.type}-${activity.data?._id || activity.date}-${index}`;
                        const isExpanded = expandedHistory === rowKey;
                        const typeBadge = getTypeBadge(activity);
                        const channels = getChannels(activity);

                        return (
                          <Fragment key={rowKey}>
                            <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                              <td className="px-4 py-3 align-top">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${typeBadge.className}`}>
                                  {typeBadge.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-top text-sm text-gray-600 dark:text-gray-400">
                                {formatDate(activity.date)}
                              </td>
                              <td className="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-300">
                                {getActorName(activity)}
                              </td>
                              <td className="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-300">
                                <p className="max-w-[420px] truncate">{getSummary(activity)}</p>
                              </td>
                              <td className="px-4 py-3 align-top text-sm text-gray-600 dark:text-gray-400">
                                {channels ? (
                                  <div className="flex items-center gap-1">
                                    <span title="Email" className={`${channels.email ? 'opacity-100' : 'opacity-30 grayscale'}`}>📧</span>
                                    <span title="SMS" className={`${channels.sms ? 'opacity-100' : 'opacity-30 grayscale'}`}>💬</span>
                                    <span title="WhatsApp" className={`${channels.whatsapp ? 'opacity-100' : 'opacity-30 grayscale'}`}>📱</span>
                                  </div>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="px-4 py-3 align-top">
                                <button
                                  type="button"
                                  onClick={() => setExpandedHistory(isExpanded ? null : rowKey)}
                                  className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                                >
                                  {isExpanded ? 'Hide' : 'View'}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-gray-50/60 dark:bg-gray-800/40">
                                <td colSpan={6} className="px-4 py-4">
                                  {renderDetails(activity)}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()
          )}
        </div>
      </ComponentCard>
    </div>
  );
}
