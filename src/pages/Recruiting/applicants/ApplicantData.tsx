import { useState } from 'react';
import Swal from 'sweetalert2';
import { useParams, useNavigate, useLocation } from 'react-router';
import ComponentCard from '../../../components/common/ComponentCard';
import PageBreadcrumb from '../../../components/common/PageBreadCrumb';
import PageMeta from '../../../components/common/PageMeta';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import Label from '../../../components/form/Label';
import Input from '../../../components/form/input/InputField';
import TextArea from '../../../components/form/input/TextArea';
import Select from '../../../components/form/Select';
import DatePicker from '../../../components/form/date-picker';
import { Modal } from '../../../components/ui/modal';
import { PlusIcon } from '../../../icons';
import { useAuth } from '../../../context/AuthContext';
import {
  useApplicant,
  useJobPositions,
  useCompaniesWithApplicants,
  useUpdateApplicantStatus,
  useScheduleInterview,
  useAddComment,
  useSendMessage,
} from '../../../hooks/queries';
import type {
  Applicant,
  UpdateStatusRequest,
} from '../../../store/slices/applicantsSlice';

const ApplicantData = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const {} = useAuth();

  // Get applicant data from location state if available (passed from Applicants page)
  const stateApplicant = location.state?.applicant as Applicant | undefined;

  // React Query hooks - only fetch if we don't have state data
  // If we have state data, the query will still run but we use the state data immediately
  const { data: fetchedApplicant, isLoading: loading, error } = useApplicant(id || '', {
    // Use initialData if we have it from navigation state
    initialData: stateApplicant,
  });
  
  // Use state applicant if available, otherwise use fetched data
  const applicant = stateApplicant || fetchedApplicant;
  
  const { data: jobPositions = [] } = useJobPositions();
  // Fetch only companies that have applicants (in this case, just the current applicant's company)
  const { data: companies = [] } = useCompaniesWithApplicants(
    applicant ? [applicant] : undefined
  );

  // Mutations
  const updateStatusMutation = useUpdateApplicantStatus();
  const scheduleInterviewMutation = useScheduleInterview();
  const addCommentMutation = useAddComment();
  const sendMessageMutation = useSendMessage();

  // Derived data - handle both string IDs and populated objects
  const getJobTitle = (): { en: string } => {
    if (!applicant) return { en: '' };
    // If jobPositionId is populated object, use its title directly
    if (
      typeof applicant.jobPositionId === 'object' &&
      (applicant.jobPositionId as any)?.title
    ) {
      const title = (applicant.jobPositionId as any).title;
      if (typeof title === 'string') return { en: title };
      if (typeof title === 'object' && title?.en) return { en: title.en };
      return { en: '' };
    }
    // Otherwise look it up
    const jobPosId =
      typeof applicant.jobPositionId === 'string'
        ? applicant.jobPositionId
        : (applicant.jobPositionId as any)?._id;
    const found = jobPositions.find((j) => j._id === jobPosId);
    return { en: found?.title?.en || '' };
  };

  const getCompanyName = () => {
    if (!applicant) return '';
    // Company info is nested in jobPositionId when populated
    if (typeof applicant.jobPositionId === 'object') {
      const jobPos = applicant.jobPositionId as any;
      if (typeof jobPos.companyId === 'object' && jobPos.companyId?.name) {
        return jobPos.companyId.name;
      }
      // Try to look up using the ID from jobPosition
      const compId =
        typeof jobPos.companyId === 'string'
          ? jobPos.companyId
          : jobPos.companyId?._id;
      const found = companies.find((c) => c._id === compId);
      if (found) return found.name;
    }
    // Fallback to direct companyId if exists
    if (
      typeof applicant.companyId === 'object' &&
      (applicant.companyId as any)?.name
    ) {
      return (applicant.companyId as any).name;
    }
    const compId =
      typeof applicant.companyId === 'string'
        ? applicant.companyId
        : (applicant.companyId as any)?._id;
    return companies.find((c) => c._id === compId)?.name || '';
  };

  const getDepartmentName = () => {
    if (!applicant) return '';
    // Department info is nested in jobPositionId when populated
    if (typeof applicant.jobPositionId === 'object') {
      const jobPos = applicant.jobPositionId as any;
      if (
        typeof jobPos.departmentId === 'object' &&
        jobPos.departmentId?.name
      ) {
        return jobPos.departmentId.name;
      }
    }
    // Fallback to direct departmentId if exists
    if (
      typeof applicant.departmentId === 'object' &&
      (applicant.departmentId as any)?.name
    ) {
      return (applicant.departmentId as any).name;
    }
    return '';
  };

  const jobTitle = getJobTitle();
  const companyName = getCompanyName();
  const departmentName = getDepartmentName();
  console.log('jobPosId', jobTitle);

  // Modal states
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  // Form states
  const [interviewForm, setInterviewForm] = useState({
    date: '',
    time: '',
    description: '',
    comment: '',
    location: '',
    link: '',
    type: 'phone' as 'phone' | 'video' | 'in-person',
  });
  const [notificationChannels, setNotificationChannels] = useState({
    email: true,
    sms: false,
    whatsapp: false,
  });
  const [emailOption, setEmailOption] = useState<'company' | 'user' | 'custom'>(
    'company'
  );
  const [customEmail, setCustomEmail] = useState('');
  const [phoneOption, setPhoneOption] = useState<
    'company' | 'user' | 'whatsapp' | 'custom'
  >('company');
  const [customPhone, setCustomPhone] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [isSubmittingInterview, setIsSubmittingInterview] = useState(false);
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [messageForm, setMessageForm] = useState({
    subject: '',
    body: '',
    type: 'email' as 'email' | 'sms' | 'whatsapp' | 'internal',
  });
  const [commentForm, setCommentForm] = useState({
    text: '',
  });
  const [statusForm, setStatusForm] = useState({
    status: '' as Applicant['status'] | '',
    notes: '',
  });
  const [interviewError, setInterviewError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [commentError, setCommentError] = useState('');
  const [statusError, setStatusError] = useState('');

  // Generate message template based on selected notification channels
  const generateMessageTemplate = () => {
    if (!applicant) return '';

    const applicantName = applicant.fullName;
    const interviewDate = interviewForm.date
      ? new Date(interviewForm.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '[Interview Date]';
    const interviewTime = interviewForm.time || '[Interview Time]';
    const interviewType = interviewForm.type;
    const location = interviewForm.location || 'our office';
    const link = interviewForm.link || '[Video Link]';

    // Only one channel can be active at a time
    if (notificationChannels.email) {
      return `Dear ${applicantName},\n\nWe are pleased to invite you for an interview for the position you applied for.\n\nInterview Details:\n• Date: ${interviewDate}\n• Time: ${interviewTime}\n• Type: ${
        interviewType.charAt(0).toUpperCase() + interviewType.slice(1)
      }\n${
        interviewType === 'video'
          ? `• Link: ${link}`
          : interviewType === 'in-person'
          ? `• Location: ${location}`
          : `• Mode: Phone Call`
      }\n\nPlease confirm your availability at your earliest convenience.\n\nBest regards,\nHR Team`;
    } else if (notificationChannels.whatsapp) {
      return `Hi ${applicantName}! 👋\n\nGreat news! We'd like to invite you for an interview:\n\n📅 ${interviewDate}\n⏰ ${interviewTime}\n${
        interviewType === 'video'
          ? `🎥 ${link}`
          : interviewType === 'in-person'
          ? `📍 ${location}`
          : `📞 Phone Interview`
      }\n\nPlease confirm if you're available. Looking forward to meeting you!`;
    } else if (notificationChannels.sms) {
      return `Hi ${applicantName}, You're invited for a ${interviewType} interview on ${interviewDate} at ${interviewTime}. ${
        interviewType === 'in-person' ? `Location: ${location}` : ''
      }Please confirm. - HR Team`;
    }

    return '';
  };

  // Helper function to extract detailed error messages
  const getErrorMessage = (err: any): string => {
    // Check for validation errors in 'details' array (new format)
    if (
      err.response?.data?.details &&
      Array.isArray(err.response.data.details)
    ) {
      return err.response.data.details
        .map((detail: any) => {
          const field = detail.path?.[0] || '';
          const message = detail.message || '';
          return field ? `${field}: ${message}` : message;
        })
        .join(', ');
    }
    // Check for validation errors in 'errors' array (old format)
    if (err.response?.data?.errors) {
      const errors = err.response.data.errors;
      if (Array.isArray(errors)) {
        return errors.map((e: any) => e.msg || e.message).join(', ');
      }
      if (typeof errors === 'object') {
        return Object.entries(errors)
          .map(([field, msg]) => `${field}: ${msg}`)
          .join(', ');
      }
    }
    if (err.response?.data?.message) return err.response.data.message;
    if (err.message) return err.message;
    return 'An unexpected error occurred';
  };

  // React Query automatically handles data fetching, no useEffect needed

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'interview', label: 'Interview' },
    { value: 'interviewed', label: 'Interviewed' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ];

  const handleInterviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !applicant) return;

    // Validate required comment field
    if (!interviewForm.comment || !interviewForm.comment.trim()) {
      setInterviewError('Comment is required when scheduling an interview');
      return;
    }

    // Validate notification options
    if (emailOption === 'custom' && !customEmail.trim()) {
      setInterviewError('Please provide a custom email address');
      return;
    }
    if (
      (notificationChannels.sms || notificationChannels.whatsapp) &&
      phoneOption === 'custom' &&
      !customPhone.trim()
    ) {
      setInterviewError('Please provide a custom phone number');
      return;
    }

    setIsSubmittingInterview(true);
    try {
      // Combine date and time into scheduledAt
      let scheduledAt: string | undefined;
      if (interviewForm.date && interviewForm.time) {
        scheduledAt = `${interviewForm.date}T${interviewForm.time}:00`;
      } else if (interviewForm.date) {
        scheduledAt = `${interviewForm.date}T00:00:00`;
      }

      // Build payload matching backend scheduleInterviewSchema
      const interviewData: any = {
        scheduledAt,
        description: interviewForm.description || undefined,
        type: interviewForm.type || undefined,
        location: interviewForm.location || undefined,
        videoLink: interviewForm.link || undefined,
        notes: interviewForm.comment || undefined,
      };

      // Schedule interview
      // Optimistic update - add to UI immediately
      // Close modal and reset form immediately
      setInterviewForm({
        date: '',
        time: '',
        description: '',
        comment: '',
        location: '',
        link: '',
        type: 'phone',
      });
      setNotificationChannels({ email: true, sms: false, whatsapp: false });
      setEmailOption('company');
      setCustomEmail('');
      setPhoneOption('company');
      setCustomPhone('');
      setShowInterviewModal(false);

      // API calls
      await scheduleInterviewMutation.mutateAsync({
        id: id!,
        data: interviewData,
      });

      // Automatically update status to "interview" if not already
      if (applicant && applicant.status !== 'interview') {
        await updateStatusMutation.mutateAsync({
          id: id!,
          data: {
            status: 'interview',
            notes: `Status automatically updated to interview upon scheduling an interview on ${new Date().toLocaleDateString()}`,
          } as UpdateStatusRequest,
        });
      }

      await Swal.fire({
        title: 'Success!',
        text: 'Interview scheduled successfully.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: '!mt-16',
        },
      });
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      setInterviewError(errorMsg);
      console.error('Error scheduling interview:', err);
    } finally {
      setIsSubmittingInterview(false);
    }
  };

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !applicant) return;

    // Validate required fields - subject only for email
    if (
      messageForm.type === 'email' &&
      (!messageForm.subject || !messageForm.subject.trim())
    ) {
      setMessageError('Subject is required when sending an email');
      return;
    }
    if (!messageForm.body || !messageForm.body.trim()) {
      setMessageError('Message body is required when sending a message');
      return;
    }

    setIsSubmittingMessage(true);
    try {
      const messageData: any = {
        content: messageForm.body,
        type: messageForm.type,
      };

      // Close modal and reset form immediately
      setMessageForm({ subject: '', body: '', type: 'email' });
      setShowMessageModal(false);

      // API call
      await sendMessageMutation.mutateAsync({ id: id!, data: messageData });

      await Swal.fire({
        title: 'Success!',
        text: 'Message sent successfully.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: '!mt-16',
        },
      });
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      setMessageError(errorMsg);
      console.error('Error sending message:', err);
    } finally {
      setIsSubmittingMessage(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !applicant) return;

    setIsSubmittingComment(true);
    try {
      const commentData = {
        comment: commentForm.text,
        isInternal: true,
      };

      // Close modal and reset form immediately
      setCommentForm({ text: '' });
      setShowCommentModal(false);

      // API call
      await addCommentMutation.mutateAsync({ id: id!, data: commentData });

      await Swal.fire({
        title: 'Success!',
        text: 'Comment added successfully.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: '!mt-16',
        },
      });
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      setCommentError(errorMsg);
      console.error('Error adding comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !applicant || !statusForm.status) return;

    setIsSubmittingStatus(true);
    try {
      const statusData: UpdateStatusRequest = {
        status: statusForm.status as UpdateStatusRequest['status'],
        notes: statusForm.notes || undefined,
      };

      // Close modal and reset form immediately
      setStatusForm({ status: '', notes: '' });
      setShowStatusModal(false);

      // Update status via React Query mutation
      await updateStatusMutation.mutateAsync({ id: id!, data: statusData });

      await Swal.fire({
        title: 'Success!',
        text: 'Status updated successfully.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: '!mt-16',
        },
      });
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      setStatusError(errorMsg);
      console.error('Error updating status:', err);
    } finally {
      setIsSubmittingStatus(false);
    }
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

  if (loading) {
    return (
      <div className="space-y-6">
        <PageMeta
          title="Applicant Details - Loading"
          description="Loading applicant data"
        />
        <PageBreadcrumb pageTitle="Applicant Details" />
        <LoadingSpinner fullPage message="Loading applicant data..." />
      </div>
    );
  }

  if (error || !applicant) {
    return (
      <>
        <PageMeta
          title="Applicant Details - Error"
          description="Error loading applicant"
        />
        <div className="p-12 text-center">
          <div className="mb-4 text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : 'Applicant not found'}
          </div>
          <button
            onClick={() => navigate('/applicants')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Applicants
          </button>
        </div>
      </>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <PageMeta
        title={`Applicant - ${applicant.fullName}`}
        description={`${jobTitle.en} - ${companyName}`}
      />
      <PageBreadcrumb pageTitle={applicant.fullName} />

      <div className="grid gap-6">
        {/* Back Button and Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/applicants')}
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            ← Back to Applicants
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setShowInterviewModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <PlusIcon className="h-4 w-4" />
              Schedule Interview
            </button>
            <button
              onClick={() => setShowMessageModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              <PlusIcon className="h-4 w-4" />
              Send Message
            </button>
            <button
              onClick={() => setShowCommentModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            >
              <PlusIcon className="h-4 w-4" />
              Add Comment
            </button>
            <button
              onClick={() => setShowStatusModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Change Status
            </button>
          </div>
        </div>

        {/* Personal Information */}
        <ComponentCard title="Personal Information" desc="Applicant details">
          <div className="flex gap-6">
            {/* Profile Photo */}
            {applicant.profilePhoto && (
              <div className="flex-shrink-0">
                <img
                  src={applicant.profilePhoto}
                  alt={applicant.fullName}
                  className="h-32 w-32 rounded-full object-cover ring-4 ring-gray-200 dark:ring-gray-700"
                />
              </div>
            )}

            <div className="grid flex-1 grid-cols-2 gap-6">
              <div>
                <Label>Full Name</Label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {applicant.fullName}
                </p>
              </div>
              <div>
                <Label>Email</Label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {applicant.email}
                </p>
              </div>
              <div>
                <Label>Phone</Label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {applicant.phone}
                </p>
              </div>
              <div>
                <Label>Address</Label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {applicant.address}
                </p>
              </div>
              <div>
                <Label>Job Position</Label>
                <p className="mt-1 text-gray-900 dark:text-white">{jobTitle.en}</p>
              </div>
              <div>
                <Label>Company</Label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {companyName}
                </p>
              </div>
              <div>
                <Label>Department</Label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {departmentName}
                </p>
              </div>
              <div>
                <Label>Status</Label>
                <span
                  className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(
                    applicant.status
                  )}`}
                >
                  {applicant.status.charAt(0).toUpperCase() +
                    applicant.status.slice(1)}
                </span>
              </div>
              <div>
                <Label>Submitted At</Label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {formatDate(applicant.submittedAt)}
                </p>
              </div>
              {applicant.cvFilePath && (
                <div>
                  <Label>CV / Resume</Label>
                  <a
                    href={applicant.cvFilePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-primary hover:text-primary/80"
                  >
                    Download CV
                  </a>
                </div>
              )}
            </div>
          </div>
        </ComponentCard>

        {/* Custom Responses */}
        {applicant.customResponses &&
          Object.keys(applicant.customResponses).length > 0 && (
            <ComponentCard
              title="Application Responses"
              desc="Custom field responses"
            >
              <div className="grid grid-cols-2 gap-6">
                {Object.entries(applicant.customResponses).map(
                  ([key, value]) => (
                    <div key={key}>
                      <Label>
                        {key
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                      </Label>
                      <p className="mt-1 text-gray-900 dark:text-white">
                        {Array.isArray(value) ? value.join(', ') : value}
                      </p>
                    </div>
                  )
                )}
              </div>
            </ComponentCard>
          )}

        {/* Status History */}
        <ComponentCard
          title="Activity Timeline"
          desc="Track all activities, status changes, messages, and comments"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(() => {
              // Combine all activities into a single timeline
              const activities: Array<{
                type: 'status' | 'message' | 'comment' | 'interview';
                date: string;
                data: any;
              }> = [];

              // Add status history
              applicant.statusHistory?.forEach((history) => {
                activities.push({
                  type: 'status',
                  date: history.changedAt,
                  data: history,
                });
              });

              // Add messages
              applicant.messages?.forEach((message) => {
                activities.push({
                  type: 'message',
                  date:
                    message.sentAt ||
                    (message as any).createdAt ||
                    new Date().toISOString(),
                  data: message,
                });
              });

              // Add comments
              applicant.comments?.forEach((comment) => {
                activities.push({
                  type: 'comment',
                  date:
                    (comment as any).commentedAt ||
                    comment.changedAt ||
                    (comment as any).createdAt ||
                    new Date().toISOString(),
                  data: comment,
                });
              });

              // Add interviews
              applicant.interviews?.forEach((interview) => {
                activities.push({
                  type: 'interview',
                  date:
                    interview.scheduledAt ||
                    (interview as any).issuedAt ||
                    new Date().toISOString(),
                  data: interview,
                });
              });

              // Sort by date (oldest first)
              activities.sort(
                (a, b) =>
                  new Date(a.date).getTime() - new Date(b.date).getTime()
              );

              return activities.map((activity, index) => {
                if (activity.type === 'status') {
                  const history = activity.data;
                  return (
                    <div
                      key={`status-${index}`}
                      onClick={() =>
                        setExpandedHistory(
                          expandedHistory === `status-${index}`
                            ? null
                            : `status-${index}`
                        )
                      }
                      className="cursor-pointer rounded-lg border border-stroke p-4 transition hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(
                              history.status
                            )}`}
                          >
                            {history.status.charAt(0).toUpperCase() +
                              history.status.slice(1)}
                          </span>
                          {/* Notification Icons */}
                          <div className="flex items-center gap-1">
                            <span
                              title="Email"
                              className={`text-sm ${
                                (history as any).notifications?.channels?.email
                                  ? 'opacity-100'
                                  : 'opacity-30 grayscale'
                              }`}
                            >
                              📧
                            </span>
                            <span
                              title="SMS"
                              className={`text-sm ${
                                (history as any).notifications?.channels?.sms
                                  ? 'opacity-100'
                                  : 'opacity-30 grayscale'
                              }`}
                            >
                              💬
                            </span>
                            <span
                              title="WhatsApp"
                              className={`text-sm ${
                                (history as any).notifications?.channels
                                  ?.whatsapp
                                  ? 'opacity-100'
                                  : 'opacity-30 grayscale'
                              }`}
                            >
                              📱
                            </span>
                          </div>
                        </div>
                        <svg
                          className={`h-4 w-4 transition-transform ${
                            expandedHistory === `status-${index}`
                              ? 'rotate-180'
                              : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(history.changedAt)}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        By:{' '}
                        {typeof history.changedBy === 'string'
                          ? history.changedBy
                          : (history.changedBy as any)?.fullName ||
                            (history.changedBy as any)?.email ||
                            'Unknown'}
                      </p>
                      {expandedHistory === `status-${index}` &&
                        history.notes && (
                          <div className="mt-3 border-t border-stroke pt-3 dark:border-strokedark">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {history.notes}
                            </p>
                          </div>
                        )}
                    </div>
                  );
                } else if (activity.type === 'message') {
                  const message = activity.data;
                  return (
                    <div
                      key={`message-${index}`}
                      onClick={() =>
                        setExpandedHistory(
                          expandedHistory === `message-${index}`
                            ? null
                            : `message-${index}`
                        )
                      }
                      className="cursor-pointer rounded-lg border border-stroke p-4 transition hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          💌 Message
                        </span>
                        <svg
                          className={`h-4 w-4 transition-transform ${
                            expandedHistory === `message-${index}`
                              ? 'rotate-180'
                              : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(message.sentAt)}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        By:{' '}
                        {typeof message.sentBy === 'string'
                          ? message.sentBy
                          : (message.sentBy as any)?.fullName ||
                            (message.sentBy as any)?.email ||
                            'Unknown'}
                      </p>
                      {message.subject && (
                        <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                          {message.subject}
                        </p>
                      )}
                      {expandedHistory === `message-${index}` &&
                        message.body && (
                          <div className="mt-3 border-t border-stroke pt-3 dark:border-strokedark">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {message.body}
                            </p>
                          </div>
                        )}
                    </div>
                  );
                } else if (activity.type === 'comment') {
                  const comment = activity.data;
                  return (
                    <div
                      key={`comment-${index}`}
                      onClick={() =>
                        setExpandedHistory(
                          expandedHistory === `comment-${index}`
                            ? null
                            : `comment-${index}`
                        )
                      }
                      className="cursor-pointer rounded-lg border border-stroke p-4 transition hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                          💬 Comment
                        </span>
                        <svg
                          className={`h-4 w-4 transition-transform ${
                            expandedHistory === `comment-${index}`
                              ? 'rotate-180'
                              : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(
                          (comment as any).commentedAt ||
                            comment.changedAt ||
                            (comment as any).createdAt ||
                            new Date().toISOString()
                        )}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        By:{' '}
                        {(() => {
                          const author =
                            (comment as any).commentedBy ||
                            comment.changedBy ||
                            (comment as any).author ||
                            (comment as any).createdBy;
                          if (typeof author === 'string') {
                            return author;
                          }
                          if (author && typeof author === 'object') {
                            return (
                              author.fullName ||
                              author.name ||
                              author.email ||
                              author.username ||
                              'User'
                            );
                          }
                          return 'Unknown';
                        })()}
                      </p>
                      {expandedHistory === `comment-${index}` &&
                        (comment.comment || comment.text) && (
                          <div className="mt-3 border-t border-stroke pt-3 dark:border-strokedark">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {comment.comment || comment.text}
                            </p>
                          </div>
                        )}
                    </div>
                  );
                } else if (activity.type === 'interview') {
                  const interview = activity.data;
                  return (
                    <div
                      key={`interview-${index}`}
                      onClick={() =>
                        setExpandedHistory(
                          expandedHistory === `interview-${index}`
                            ? null
                            : `interview-${index}`
                        )
                      }
                      className="cursor-pointer rounded-lg border border-stroke p-4 transition hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            📅 Interview Scheduled
                          </span>
                          {/* Notification Icons */}
                          <div className="flex items-center gap-1">
                            <span
                              title="Email"
                              className={`text-sm ${
                                (interview as any).notifications?.channels
                                  ?.email
                                  ? 'opacity-100'
                                  : 'opacity-30 grayscale'
                              }`}
                            >
                              📧
                            </span>
                            <span
                              title="SMS"
                              className={`text-sm ${
                                (interview as any).notifications?.channels?.sms
                                  ? 'opacity-100'
                                  : 'opacity-30 grayscale'
                              }`}
                            >
                              💬
                            </span>
                            <span
                              title="WhatsApp"
                              className={`text-sm ${
                                (interview as any).notifications?.channels
                                  ?.whatsapp
                                  ? 'opacity-100'
                                  : 'opacity-30 grayscale'
                              }`}
                            >
                              📱
                            </span>
                          </div>
                        </div>
                        <svg
                          className={`h-4 w-4 transition-transform ${
                            expandedHistory === `interview-${index}`
                              ? 'rotate-180'
                              : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(interview.issuedAt)}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        By:{' '}
                        {typeof interview.issuedBy === 'string'
                          ? interview.issuedBy
                          : (interview.issuedBy as any)?.fullName ||
                            (interview.issuedBy as any)?.email ||
                            'Unknown'}
                      </p>
                      {(interview as any).scheduledAt && (
                        <p className="mt-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                          📅 {formatDate((interview as any).scheduledAt)}
                        </p>
                      )}
                      {expandedHistory === `interview-${index}` && (
                        <div className="mt-3 border-t border-stroke pt-3 dark:border-strokedark">
                          {interview.description && (
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {interview.description}
                            </p>
                          )}
                          {interview.comment && (
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                              {interview.comment}
                            </p>
                          )}
                          {interview.type && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                              Type: {interview.type}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              });
            })()}
          </div>
        </ComponentCard>
      </div>

      {/* Interview Modal */}
      <Modal
        isOpen={showInterviewModal}
        onClose={() => {
          setShowInterviewModal(false);
          setInterviewError('');
        }}
        className="max-w-[1100px] p-6 lg:p-10"
        closeOnBackdrop={false}
      >
        <form
          onSubmit={handleInterviewSubmit}
          className="flex flex-col px-2 overflow-y-auto custom-scrollbar"
        >
          <div>
            <h5 className="mb-2 font-semibold text-gray-800 text-xl dark:text-white/90 lg:text-2xl">
              Schedule Interview
            </h5>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Set up an interview and choose notification preferences
            </p>
          </div>

          {interviewError && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start justify-between">
                <p className="text-sm text-red-600 dark:text-red-400">
                  <strong>Error:</strong> {interviewError}
                </p>
                <button
                  type="button"
                  onClick={() => setInterviewError('')}
                  className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-4">
            {/* Date, Time, and Type Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <DatePicker
                  id="interview-date"
                  label="Interview Date"
                  placeholder="Select interview date"
                  defaultDate={interviewForm.date || undefined}
                  onChange={(selectedDates) => {
                    if (selectedDates.length > 0) {
                      const date = selectedDates[0];
                      const formattedDate = date.toISOString().split('T')[0];
                      setInterviewForm({
                        ...interviewForm,
                        date: formattedDate,
                      });
                    }
                  }}
                />
              </div>

              <div>
                <DatePicker
                  id="interview-time"
                  label="Interview Time"
                  mode="time"
                  placeholder="Select interview time"
                  defaultDate={interviewForm.time || undefined}
                  onChange={(selectedDates) => {
                    if (selectedDates.length > 0) {
                      const date = selectedDates[0];
                      const hours = date.getHours().toString().padStart(2, '0');
                      const minutes = date
                        .getMinutes()
                        .toString()
                        .padStart(2, '0');
                      setInterviewForm({
                        ...interviewForm,
                        time: `${hours}:${minutes}`,
                      });
                    }
                  }}
                />
              </div>

              <div>
                <Label htmlFor="interview-type">Interview Type</Label>
                <Select
                  options={[
                    { value: 'phone', label: 'Phone' },
                    { value: 'video', label: 'Video' },
                    { value: 'in-person', label: 'In-Person' },
                  ]}
                  placeholder="Select interview type"
                  onChange={(value) =>
                    setInterviewForm({
                      ...interviewForm,
                      type: value as 'phone' | 'video' | 'in-person',
                    })
                  }
                />
              </div>
            </div>

            {/* Location and Video Link Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="interview-location">Location (Optional)</Label>
                <Input
                  id="interview-location"
                  type="text"
                  value={interviewForm.location}
                  onChange={(e) =>
                    setInterviewForm({
                      ...interviewForm,
                      location: e.target.value,
                    })
                  }
                  placeholder="Office address or meeting room"
                />
              </div>

              <div>
                <Label htmlFor="interview-link">Video Link (Optional)</Label>
                <Input
                  id="interview-link"
                  type="url"
                  value={interviewForm.link}
                  onChange={(e) =>
                    setInterviewForm({ ...interviewForm, link: e.target.value })
                  }
                  placeholder="https://meet.example.com/..."
                />
              </div>
            </div>

            {/* Description and Comment Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="interview-description">Description</Label>
                <TextArea
                  value={interviewForm.description}
                  onChange={(value) =>
                    setInterviewForm({ ...interviewForm, description: value })
                  }
                  placeholder="e.g., Technical Interview, HR Round"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="interview-comment">Comment *</Label>
                <TextArea
                  value={interviewForm.comment}
                  onChange={(value) =>
                    setInterviewForm({ ...interviewForm, comment: value })
                  }
                  placeholder="Add notes about this interview (required)"
                  rows={2}
                />
              </div>
            </div>

            {/* Notification Options */}
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
              <h3 className="mb-3 text-base font-medium text-gray-800 dark:text-white/90">
                Notification Settings
              </h3>

              {/* Notification Channels */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">
                  Send notification via:
                </label>
                <div className="flex flex-wrap gap-3">
                  <label className="group relative inline-flex items-center gap-3 cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 transition-all hover:border-brand-400 hover:bg-brand-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-brand-600 dark:hover:bg-brand-900/20">
                    <input
                      type="radio"
                      name="notificationChannel"
                      checked={notificationChannels.email}
                      onChange={() => {
                        setNotificationChannels({
                          email: true,
                          sms: false,
                          whatsapp: false,
                        });
                        setEmailOption('company');
                        setMessageTemplate(generateMessageTemplate());
                      }}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-5 rounded-full border-2 border-gray-300 bg-white transition-all peer-checked:border-brand-600 peer-checked:bg-brand-600 dark:border-gray-600 dark:bg-gray-700 dark:peer-checked:border-brand-500 dark:peer-checked:bg-brand-500 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-white scale-0 peer-checked:scale-100 transition-transform"></div>
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      📧 Email
                    </span>
                  </label>
                  <label className="group relative inline-flex items-center gap-3 cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 transition-all hover:border-brand-400 hover:bg-brand-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-brand-600 dark:hover:bg-brand-900/20">
                    <input
                      type="radio"
                      name="notificationChannel"
                      checked={notificationChannels.sms}
                      onChange={() => {
                        setNotificationChannels({
                          email: false,
                          sms: true,
                          whatsapp: false,
                        });
                        setPhoneOption('company');
                        setMessageTemplate(generateMessageTemplate());
                      }}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-5 rounded-full border-2 border-gray-300 bg-white transition-all peer-checked:border-brand-600 peer-checked:bg-brand-600 dark:border-gray-600 dark:bg-gray-700 dark:peer-checked:border-brand-500 dark:peer-checked:bg-brand-500 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-white scale-0 peer-checked:scale-100 transition-transform"></div>
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      💬 SMS
                    </span>
                  </label>
                  <label className="group relative inline-flex items-center gap-3 cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 transition-all hover:border-brand-400 hover:bg-brand-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-brand-600 dark:hover:bg-brand-900/20">
                    <input
                      type="radio"
                      name="notificationChannel"
                      checked={notificationChannels.whatsapp}
                      onChange={() => {
                        setNotificationChannels({
                          email: false,
                          sms: false,
                          whatsapp: true,
                        });
                        setMessageTemplate(generateMessageTemplate());
                      }}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-5 rounded-full border-2 border-gray-300 bg-white transition-all peer-checked:border-brand-600 peer-checked:bg-brand-600 dark:border-gray-600 dark:bg-gray-700 dark:peer-checked:border-brand-500 dark:peer-checked:bg-brand-500 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-white scale-0 peer-checked:scale-100 transition-transform"></div>
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      📱 WhatsApp
                    </span>
                  </label>
                </div>
                {/* Email and Phone Options Grid */}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Email Options */}
                  {notificationChannels.email && (
                    <div className="space-y-2">
                      <Label htmlFor="email-option">Email Address</Label>
                      <Select
                        options={[
                          { value: 'company', label: 'Company Email' },
                          { value: 'user', label: 'My Email' },
                          { value: 'custom', label: 'Custom Email' },
                        ]}
                        value={emailOption}
                        placeholder="Select email option"
                        onChange={(value) =>
                          setEmailOption(value as 'company' | 'user' | 'custom')
                        }
                      />
                      {emailOption === 'custom' && (
                        <Input
                          id="custom-email"
                          type="email"
                          value={customEmail}
                          onChange={(e) => setCustomEmail(e.target.value)}
                          placeholder="Enter custom email address"
                          className="mt-2"
                        />
                      )}
                    </div>
                  )}

                  {/* Phone Options for SMS/WhatsApp */}
                  {(notificationChannels.sms ||
                    notificationChannels.whatsapp) && (
                    <div className="space-y-2">
                      <Label htmlFor="phone-option">Phone Number</Label>
                      {notificationChannels.sms ? (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-700/50">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Company Number (SMS)
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            SMS will be sent from the company number only
                          </p>
                        </div>
                      ) : (
                        <>
                          <Select
                            options={[
                              { value: 'company', label: 'Company Number' },
                              { value: 'user', label: 'My Phone' },
                              {
                                value: 'whatsapp',
                                label: 'Current WhatsApp Number',
                              },
                              { value: 'custom', label: 'Custom Number' },
                            ]}
                            value={phoneOption}
                            placeholder="Select phone option"
                            onChange={(value) =>
                              setPhoneOption(
                                value as
                                  | 'company'
                                  | 'user'
                                  | 'whatsapp'
                                  | 'custom'
                              )
                            }
                          />
                          {phoneOption === 'custom' && (
                            <Input
                              id="custom-phone"
                              type="tel"
                              value={customPhone}
                              onChange={(e) => setCustomPhone(e.target.value)}
                              placeholder="Enter custom phone number"
                              className="mt-2"
                            />
                          )}
                          {phoneOption === 'whatsapp' && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Will use the number currently logged in to
                              WhatsApp Web/Desktop
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* Message Template */}
              {(notificationChannels.email ||
                notificationChannels.sms ||
                notificationChannels.whatsapp) && (
                <div className="mt-4">
                  <Label htmlFor="message-template">
                    Message Template
                    <button
                      type="button"
                      onClick={() =>
                        setMessageTemplate(generateMessageTemplate())
                      }
                      className="ml-2 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                    >
                      🔄 Regenerate
                    </button>
                  </Label>
                  <TextArea
                    value={messageTemplate}
                    onChange={(value) => setMessageTemplate(value)}
                    placeholder="Message content will appear here..."
                    rows={8}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Templates for:{' '}
                    {[
                      notificationChannels.email && 'Email',
                      notificationChannels.whatsapp && 'WhatsApp',
                      notificationChannels.sms && 'SMS',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6 sm:justify-end">
            <button
              type="button"
              onClick={() => setShowInterviewModal(false)}
              disabled={isSubmittingInterview}
              className="flex w-full justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingInterview}
              className="flex w-full justify-center items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
            >
              {isSubmittingInterview ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Scheduling...</span>
                </>
              ) : (
                <span>Schedule Interview</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Message Modal */}
      <Modal
        isOpen={showMessageModal}
        onClose={() => {
          setShowMessageModal(false);
          setMessageError('');
        }}
        className="max-w-2xl p-6"
        closeOnBackdrop={false}
      >
        <form onSubmit={handleMessageSubmit} className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Send Message
          </h2>

          {messageError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start justify-between">
                <p className="text-sm text-red-600 dark:text-red-400">
                  <strong>Error:</strong> {messageError}
                </p>
                <button
                  type="button"
                  onClick={() => setMessageError('')}
                  className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="message-type">Message Type</Label>
            <Select
              options={[
                { value: 'email', label: '📧 Email' },
                { value: 'sms', label: '💬 SMS' },
                { value: 'whatsapp', label: '📱 WhatsApp' },
              ]}
              value={messageForm.type}
              placeholder="Select message type"
              onChange={(value) =>
                setMessageForm({
                  ...messageForm,
                  type: value as 'email' | 'sms' | 'whatsapp',
                })
              }
            />
          </div>

          {/* Subject field - only for email */}
          {messageForm.type === 'email' && (
            <div>
              <Label htmlFor="message-subject">Subject *</Label>
              <Input
                id="message-subject"
                type="text"
                value={messageForm.subject}
                onChange={(e) =>
                  setMessageForm({ ...messageForm, subject: e.target.value })
                }
                placeholder="Message subject"
                required
              />
            </div>
          )}

          <div>
            <Label htmlFor="message-body">Message *</Label>
            <TextArea
              value={messageForm.body}
              onChange={(value) =>
                setMessageForm({ ...messageForm, body: value })
              }
              placeholder="Enter your message to the applicant"
              rows={5}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowMessageModal(false)}
              className="rounded-lg border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
              disabled={isSubmittingMessage}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-purple-600 px-6 py-2 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isSubmittingMessage}
            >
              {isSubmittingMessage ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Sending...</span>
                </>
              ) : (
                <span>Send Message</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Comment Modal */}
      <Modal
        isOpen={showCommentModal}
        onClose={() => {
          setShowCommentModal(false);
          setCommentError('');
        }}
        className="max-w-2xl p-6"
        closeOnBackdrop={false}
      >
        <form onSubmit={handleCommentSubmit} className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Add Comment
          </h2>

          {commentError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start justify-between">
                <p className="text-sm text-red-600 dark:text-red-400">
                  <strong>Error:</strong> {commentError}
                </p>
                <button
                  type="button"
                  onClick={() => setCommentError('')}
                  className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="comment-text">Comment</Label>
            <TextArea
              value={commentForm.text}
              onChange={(value) => setCommentForm({ text: value })}
              placeholder="Enter your internal comment about this applicant"
              rows={5}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowCommentModal(false)}
              className="rounded-lg border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
              disabled={isSubmittingComment}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-gray-600 px-6 py-2 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isSubmittingComment}
            >
              {isSubmittingComment ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Adding...</span>
                </>
              ) : (
                <span>Add Comment</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Status Change Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setStatusError('');
        }}
        className="max-w-2xl p-6"
        closeOnBackdrop={false}
      >
        <form onSubmit={handleStatusChange} className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Change Status
          </h2>

          {statusError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start justify-between">
                <p className="text-sm text-red-600 dark:text-red-400">
                  <strong>Error:</strong> {statusError}
                </p>
                <button
                  type="button"
                  onClick={() => setStatusError('')}
                  className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="status-select">New Status</Label>
            <Select
              options={statusOptions}
              placeholder="Select new status"
              onChange={(value) =>
                setStatusForm({
                  ...statusForm,
                  status: value as Applicant['status'],
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="status-notes">Notes (Optional)</Label>
            <TextArea
              value={statusForm.notes}
              onChange={(value) =>
                setStatusForm({ ...statusForm, notes: value })
              }
              placeholder="Add notes about this status change"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowStatusModal(false)}
              className="rounded-lg border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
              disabled={isSubmittingStatus}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isSubmittingStatus}
            >
              {isSubmittingStatus ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update Status</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default ApplicantData;
