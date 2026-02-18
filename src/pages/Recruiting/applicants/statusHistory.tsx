import { useState } from 'react';
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

        <div className="flex flex-wrap gap-4">
          {loading ? (
            <div className="w-full space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="cursor-pointer rounded-lg border border-stroke p-4 transition hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800/50"
                >
                  <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <div className="mt-3 h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
              ))}
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

              return filteredActivities.map((activity, index) => {
                if (activity.type === 'status') {
                  const history = activity.data;
                  return (
                    <div
                      key={`status-${index}`}
                      onClick={() => setExpandedHistory(expandedHistory === `status-${index}` ? null : `status-${index}`)}
                      className="cursor-pointer rounded-lg border border-stroke p-4 transition hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(history.status)}`}>
                            {history.status?.charAt(0).toUpperCase() + history.status?.slice(1)}
                          </span>
                          <div className="flex items-center gap-1">
                            <span title="Email" className={`text-sm ${(history as any).notifications?.channels?.email ? 'opacity-100' : 'opacity-30 grayscale'}`}>📧</span>
                            <span title="SMS" className={`text-sm ${(history as any).notifications?.channels?.sms ? 'opacity-100' : 'opacity-30 grayscale'}`}>💬</span>
                            <span title="WhatsApp" className={`text-sm ${(history as any).notifications?.channels?.whatsapp ? 'opacity-100' : 'opacity-30 grayscale'}`}>📱</span>
                          </div>
                        </div>
                        <svg className={`h-4 w-4 transition-transform ${expandedHistory === `status-${index}` ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{formatDate(history.changedAt)}</p>
                      {(() => {
                        let actorName: string | null = null;
                        if (history.changedBy && typeof history.changedBy === 'string' && history.changedBy.toLowerCase() !== 'system') actorName = history.changedBy;
                        if (!actorName && history.changedBy && typeof history.changedBy === 'object') actorName = history.changedBy.fullName || history.changedBy.email || null;

                        if (!actorName) {
                          const histTime = history.changedAt ? new Date(history.changedAt).getTime() : null;
                          const withinWindow = (time?: string) => { if (!histTime || !time) return false; const t = new Date(time).getTime(); return Math.abs(t - histTime) <= 2 * 60 * 1000; };

                          if (!actorName && applicant?.messages) {
                            const match = applicant.messages.find((m: any) => (withinWindow(m.sentAt) || withinWindow(m.createdAt)) && (m.sentBy));
                            if (match) actorName = typeof match.sentBy === 'string' ? match.sentBy : (match.sentBy?.fullName || match.sentBy?.email || null);
                          }

                          if (!actorName && applicant?.comments) {
                            const match = applicant.comments.find((c: any) => (withinWindow(c.changedAt) || withinWindow(c.commentedAt) || withinWindow(c.createdAt)) && (c.changedBy || c.author));
                            if (match) actorName = typeof match.changedBy === 'string' ? match.changedBy : (match.changedBy?.fullName || match.changedBy?.email || match.author || null);
                          }

                          if (!actorName && applicant?.interviews) {
                            const match = applicant.interviews.find((iv: any) => (withinWindow(iv.scheduledAt) || withinWindow(iv.createdAt) || withinWindow(iv.issuedAt)) && (iv.issuedBy));
                            if (match) actorName = typeof match.issuedBy === 'string' ? match.issuedBy : (match.issuedBy?.fullName || match.issuedBy?.email || null);
                          }
                        }

                        const currentUserLabel = (user?.fullName || user?.email) ? (user?.fullName || user?.email) : 'Current User';
                        return <p className="text-sm text-gray-600 dark:text-gray-400">By: {actorName || (typeof history.changedBy === 'string' && history.changedBy.toLowerCase() !== 'system' ? history.changedBy : (history.changedBy as any)?.fullName || (history.changedBy as any)?.email || currentUserLabel)}</p>;
                      })()}

                      {expandedHistory === `status-${index}` && history.notes && (
                        <div className="mt-3 border-t border-stroke pt-3 dark:border-strokedark">
                          <p className="text-sm text-gray-700 dark:text-gray-300">{history.notes}</p>
                        </div>
                      )}
                    </div>
                  );
                } else if (activity.type === 'message') {
                  const message = activity.data;
                  return (
                    <div key={`message-${index}`} onClick={() => setExpandedHistory(expandedHistory === `message-${index}` ? null : `message-${index}`)} className="cursor-pointer rounded-lg border border-stroke p-4 transition hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800/50">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">💌 Message</span>
                        <svg className={`h-4 w-4 transition-transform ${expandedHistory === `message-${index}` ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{formatDate(message.sentAt)}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">By: {typeof message.sentBy === 'string' ? message.sentBy : message.sentBy?.fullName || message.sentBy?.email || 'Unknown'}</p>
                      {message.subject && <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">{message.subject}</p>}
                      {expandedHistory === `message-${index}` && (message.content || message.body || message.message) && (
                        <div className="mt-3 border-t border-stroke pt-3 dark:border-strokedark"><p className="text-sm text-gray-700 dark:text-gray-300">{message.content || message.body || message.message}</p></div>
                      )}
                    </div>
                  );
                } else if (activity.type === 'comment') {
                  const comment = activity.data;
                  return (
                    <div key={`comment-${index}`} onClick={() => setExpandedHistory(expandedHistory === `comment-${index}` ? null : `comment-${index}`)} className="cursor-pointer rounded-lg border border-stroke p-4 transition hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800/50">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">💬 Comment</span>
                        <svg className={`h-4 w-4 transition-transform ${expandedHistory === `comment-${index}` ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{formatDate(comment.commentedAt || comment.changedAt || comment.createdAt || new Date().toISOString())}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">By: {(() => {
                        const author = comment.commentedBy || comment.changedBy || comment.author || comment.createdBy;
                        if (typeof author === 'string') return author;
                        if (author && typeof author === 'object') return author.fullName || (typeof author.name === 'object' ? toPlainString(author.name) : author.name) || author.email || author.username || 'User';
                        return 'Unknown';
                      })()}</p>
                      {expandedHistory === `comment-${index}` && (comment.comment || comment.text) && (
                        <div className="mt-3 border-t border-stroke pt-3 dark:border-strokedark"><p className="text-sm text-gray-700 dark:text-gray-300">{comment.comment || comment.text}</p></div>
                      )}
                    </div>
                  );
                } else if (activity.type === 'interview') {
                  const interview = activity.data;
                  return (
                    <div key={`interview-${index}`} onClick={() => setExpandedHistory(expandedHistory === `interview-${index}` ? null : `interview-${index}`)} className="cursor-pointer rounded-lg border border-stroke p-4 transition hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${interview.status?.toLowerCase() === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : interview.status?.toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : interview.status?.toLowerCase() === 'rescheduled' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>📅 Interview {interview.status ? `- ${interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}` : 'Scheduled'}</span>
                          <div className="flex items-center gap-1">
                            <span title="Email" className={`text-sm ${(interview as any).notifications?.channels?.email ? 'opacity-100' : 'opacity-30 grayscale'}`}>📧</span>
                            <span title="SMS" className={`text-sm ${(interview as any).notifications?.channels?.sms ? 'opacity-100' : 'opacity-30 grayscale'}`}>💬</span>
                            <span title="WhatsApp" className={`text-sm ${(interview as any).notifications?.channels?.whatsapp ? 'opacity-100' : 'opacity-30 grayscale'}`}>📱</span>
                          </div>
                        </div>
                        <svg className={`h-4 w-4 transition-transform ${expandedHistory === `interview-${index}` ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{formatDate(interview.createdAt || interview.scheduledAt || interview.issuedAt || new Date().toISOString())}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">By: {typeof interview.issuedBy === 'string' ? interview.issuedBy : interview.issuedBy?.fullName || interview.issuedBy?.email || user?.fullName || user?.email || 'System'}</p>
                      {interview.scheduledAt && <p className="mt-1 text-sm font-medium text-blue-600 dark:text-blue-400">📅 Scheduled: {formatDate(interview.scheduledAt)}</p>}
                      {interview.status && <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">Status: <span className="capitalize">{interview.status}</span></p>}

                      {expandedHistory === `interview-${index}` && (
                        <div className="mt-3 space-y-2 border-t border-stroke pt-3 dark:border-strokedark">
                          {interview.scheduledAt && (
                            <div className="flex items-start gap-2"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">Scheduled:</span><span className="text-sm text-gray-700 dark:text-gray-300">{new Date(interview.scheduledAt).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                          )}
                          {interview.type && (<div className="flex items-start gap-2"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">Type:</span><span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{interview.type}</span></div>)}
                          {interview.location && (<div className="flex items-start gap-2"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">Location:</span><span className="text-sm text-gray-700 dark:text-gray-300">{interview.location}</span></div>)}
                          {interview.videoLink && (<div className="flex items-start gap-2"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">Video Link:</span><a href={interview.videoLink} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline dark:text-brand-400">{interview.videoLink}</a></div>)}
                          {interview.description && (<div className="flex items-start gap-2"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">Description:</span><span className="text-sm text-gray-700 dark:text-gray-300">{interview.description}</span></div>)}
                          {(interview.notes || interview.comment) && (<div className="flex items-start gap-2"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">Notes:</span><span className="text-sm text-gray-700 dark:text-gray-300">{interview.notes || interview.comment}</span></div>)}
                          {interview.createdAt && (<div className="flex items-start gap-2"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">Created:</span><span className="text-sm text-gray-700 dark:text-gray-300">{new Date(interview.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>)}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              });
            })()
          )}
        </div>
      </ComponentCard>
    </div>
  );
}
