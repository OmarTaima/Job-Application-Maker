import { useState, useMemo, useEffect } from 'react';
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
  useJobPosition,
  useCompaniesWithApplicants,
  useCompany,
  useUpdateApplicantStatus,
  useScheduleInterview,
  useUpdateInterviewStatus,
  useAddComment,
  useSendMessage,
} from '../../../hooks/queries';
import type {
  Applicant,
  UpdateStatusRequest,
} from '../../../services/applicantsService';
import { toPlainString } from '../../../utils/strings';

const ApplicantData = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Get applicant data from location state if available (passed from Applicants page)
  const stateApplicant = location.state?.applicant as Applicant | undefined;

  // State for expanded custom responses
  const [expandedResponses, setExpandedResponses] = useState<Record<string, Set<number>>>({});
  const [expandedText, setExpandedText] = useState<Record<string, boolean>>({});
  // Track expanded fields for repeatable-group items: { fieldKey: { itemIndex: Set<fieldNames> } }
  const [expandedItemFields, setExpandedItemFields] = useState<Record<string, Record<number, Set<string>>>>({});
  // State for expanded cover letter textareas

  // Helper to detect Arabic text and apply RTL
  const isArabic = (text?: any) => {
    if (!text || typeof text !== 'string') return false;
    return /[\u0600-\u06FF]/.test(text);
  };
  
  // State for activity timeline tab
  const [activityTab, setActivityTab] = useState<'all' | 'status' | 'actions' | 'interview'>('all');

  // React Query hooks - only fetch if we don't have state data
  // If we have state data, the query will still run but we use the state data immediately
  const { data: fetchedApplicant, isLoading: loading, error } = useApplicant(id || '', {
    // Use initialData if we have it from navigation state
    initialData: stateApplicant,
  });
  
  // Prefer the fetched data, but fall back to navigation state if the fetch returns undefined
  const applicant: any = (fetchedApplicant ?? stateApplicant) as any;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!applicant) {
    return (
      <div className="space-y-6">
        <PageMeta
          title="Applicant Not Found | Job Application Maker"
          description="The requested applicant could not be found"
        />
        <PageBreadcrumb pageTitle="Applicant Not Found" />
        <ComponentCard title="Applicant Not Found">
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Applicant Not Found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">The applicant you're looking for doesn't exist or has been deleted.</p>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
            >
              Back
            </button>
          </div>
        </ComponentCard>
      </div>
    );
  }

  // Compute full CV download URL (prefix API base URL for relative paths)
  const cvUrl = useMemo(() => {
    if (!applicant?.cvFilePath) return null;
    const path = applicant.cvFilePath;
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    return base ? `${base}/${path.replace(/^\//, '')}` : path;
  }, [applicant?.cvFilePath]);

  const openCv = () => {
    if (!applicant?.cvFilePath) {
      Swal.fire('No CV', 'No CV file available for this applicant', 'info');
      return;
    }
    // Navigate to internal preview page and pass the CV URL in location state.
    const url = cvUrl ?? applicant.cvFilePath;
    // Disable direct download for now by using an internal preview route without a download control.
    navigate(`/applicant/${id}/cv`, { state: { cvUrl: url } });
  };
  
  const { data: jobPositions = [] } = useJobPositions();
  const jobPosIdString = applicant && typeof applicant.jobPositionId === 'string' ? applicant.jobPositionId : '';
  const { data: jobPositionDetail } = useJobPosition(jobPosIdString, { enabled: !!jobPosIdString });
  // If job position detail provides a company id, fetch that company record to resolve names reliably
  const jpCompanyId = jobPositionDetail && ((jobPositionDetail as any).companyId ? (typeof (jobPositionDetail as any).companyId === 'string' ? (jobPositionDetail as any).companyId : (jobPositionDetail as any).companyId?._id) : '');
  const { data: jobPosCompany } = useCompany(jpCompanyId || '', { enabled: !!jpCompanyId });
  // Fetch only companies that have applicants (in this case, just the current applicant's company)
  const { data: companies = [] } = useCompaniesWithApplicants(
    applicant ? [applicant] : undefined
  );

  // Derive a single companyId to fetch the canonical company record when needed
  const resolvedCompanyId = useMemo(() => {
    if (!applicant) return '';
    if (typeof applicant.jobPositionId === 'object') {
      const jobPos = applicant.jobPositionId as any;
      if (typeof jobPos.companyId === 'string') return jobPos.companyId;
      if (typeof jobPos.companyId === 'object' && jobPos.companyId?._id) return jobPos.companyId._id;
    }
    if (typeof applicant.companyId === 'string') return applicant.companyId;
    if (typeof applicant.companyId === 'object' && (applicant.companyId as any)?._id) return (applicant.companyId as any)._id;
    return '';
  }, [applicant]);

  // Fetch canonical company from server when we have its id (fallback if not present in `companies` list)
  const { data: fetchedCompany } = useCompany(resolvedCompanyId || '', { enabled: !!resolvedCompanyId });

  

  // Mutations
  const updateStatusMutation = useUpdateApplicantStatus();
  const scheduleInterviewMutation = useScheduleInterview();
  const updateInterviewMutation = useUpdateInterviewStatus();
  const addCommentMutation = useAddComment();
  const sendMessageMutation = useSendMessage();

  // Interview update state
  const [updatingInterviewId] = useState<string | null>(null);

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
    const found = jobPositions.find((j: any) => j._id === jobPosId);
    return { en: found?.title?.en || '' };
  };

  const getCompanyName = () => {
    if (!applicant) return '';
    // Company info is nested in jobPositionId when populated
    // If jobPosition is populated object, use its company
    if (typeof applicant.jobPositionId === 'object') {
      const jobPos = applicant.jobPositionId as any;
      if (typeof jobPos.companyId === 'object' && jobPos.companyId?.name) {
        return toPlainString(jobPos.companyId.name);
      }
      const compId = typeof jobPos.companyId === 'string' ? jobPos.companyId : jobPos.companyId?._id;
      const found = companies.find((c) => c._id === compId);
      if (found) return toPlainString((found as any).name);
    }
    // If we have fetched the job position detail for a string id, use it
    if (jobPositionDetail && (jobPositionDetail as any).companyId) {
      const jp = jobPositionDetail as any;
      if (jobPosCompany && (jobPosCompany as any)._id) return toPlainString((jobPosCompany as any).name || '');
      if (typeof jp.companyId === 'object' && jp.companyId?.name) return toPlainString(jp.companyId.name);
      const compId = typeof jp.companyId === 'string' ? jp.companyId : jp.companyId?._id;
      const found = companies.find((c) => c._id === compId);
      if (found) return toPlainString((found as any).name);
    }
    // Fallback to direct companyId if exists
    if (
      typeof applicant.companyId === 'object' &&
      (applicant.companyId as any)?.name
    ) {
      return toPlainString((applicant.companyId as any).name);
    }
    const compId =
      typeof applicant.companyId === 'string'
        ? applicant.companyId
        : (applicant.companyId as any)?._id;
    const foundCompany = companies.find((c) => c._id === compId);
    return foundCompany ? toPlainString((foundCompany as any).name) : '';
  };

  const getDepartmentName = () => {
    if (!applicant) return '';
    // Department info is nested in jobPositionId when populated
    if (typeof applicant.jobPositionId === 'object') {
      const jobPos = applicant.jobPositionId as any;
      if (typeof jobPos.departmentId === 'object' && jobPos.departmentId?.name) {
        return toPlainString(jobPos.departmentId.name);
      }
    }
    if (jobPositionDetail && (jobPositionDetail as any).departmentId) {
      const jp = jobPositionDetail as any;
      if (jobPosCompany && (jobPosCompany as any).departments) {
        const deps = (jobPosCompany as any).departments || [];
        const depId = typeof jp.departmentId === 'string' ? jp.departmentId : jp.departmentId?._id;
        const found = deps.find((d: any) => d._id === depId || d === depId || String(d._id) === String(depId));
        if (found) return toPlainString(found.name || found);
      }
      if (typeof jp.departmentId === 'object' && jp.departmentId?.name) return toPlainString(jp.departmentId.name);
      // departmentId might be string id; try to find in fetched companies list (departments may be nested there)
      const depId = typeof jp.departmentId === 'string' ? jp.departmentId : jp.departmentId?._id;
      if (depId) {
        for (const c of companies) {
          const deps = (c as any).departments || [];
          const found = deps.find((d: any) => d._id === depId || d === depId || String(d._id) === String(depId));
          if (found) return toPlainString(found.name || found);
        }
      }
    }
    // Fallback to direct departmentId if exists
    if (
      typeof applicant.departmentId === 'object' &&
      (applicant.departmentId as any)?.name
    ) {
      return toPlainString((applicant.departmentId as any).name);
    }
    return '';
  };

  const getCompanyAddress = () => {
    if (!applicant) return '';

    // Resolve company object (prefer populated jobPosition -> company, then applicant.companyId, then lookup from companies list)
    let company: any = null;
    // Prefer freshly fetched canonical company when available
    if ((fetchedCompany as any) && (fetchedCompany as any)?._id) {
      company = fetchedCompany as any;
    }
    if (typeof applicant.jobPositionId === 'object') {
      const jobPos = applicant.jobPositionId as any;
      if (typeof jobPos.companyId === 'object' && jobPos.companyId?._id) company = jobPos.companyId;
      else {
        const compId = typeof jobPos.companyId === 'string' ? jobPos.companyId : jobPos.companyId?._id;
        if (compId) company = companies.find((c) => c._id === compId) || null;
      }
    }

    if (!company) {
      if (typeof applicant.companyId === 'object' && (applicant.companyId as any)?._id) company = applicant.companyId;
      else {
        const compId = typeof applicant.companyId === 'string' ? applicant.companyId : (applicant.companyId as any)?._id;
        if (compId) company = companies.find((c) => c._id === compId) || null;
      }
    }

    if (!company) return '';

    // Try common address fields
    const addrCandidates: any = company.address ?? company.addresses ?? company.location ?? company.locations ?? company.officeAddress ?? null;
    let addr: any = null;

    if (addrCandidates) {
      addr = Array.isArray(addrCandidates) ? addrCandidates[0] : addrCandidates;
    }

    // If still nothing, search for any key containing address/location
    if (!addr) {
      for (const key of Object.keys(company)) {
        if (/address|location/i.test(key)) {
          const v = (company as any)[key];
          if (!v) continue;
          addr = Array.isArray(v) ? v[0] : v;
          break;
        }
      }
    }

    const resolved = addr
      ? (typeof addr === 'string' ? addr : toPlainString(addr.en ? addr.en : addr) || addr.location || '')
      : '';

    console.debug('ApplicantData.getCompanyAddress', { companyId: company._id, resolved });
    return resolved || '';
  };

  // Try to fill interviewForm.location using the best available company object
  const fillCompanyAddress = (): boolean => {
    try {
      const comp = (fetchedCompany as any && (fetchedCompany as any)?._id) ? (fetchedCompany as any) : companyObj;
      if (!comp) {
        console.debug('fillCompanyAddress: no company available', { fetchedCompany, companyObj });
        return false;
      }

      console.debug('fillCompanyAddress: company found', { companyId: comp._id, comp });

      const addrCandidates: any = comp.address ?? comp.addresses ?? comp.location ?? comp.locations ?? comp.officeAddress ?? null;
      let addr: any = null;
      if (addrCandidates) {
        addr = Array.isArray(addrCandidates) ? addrCandidates[0] : addrCandidates;
        console.debug('fillCompanyAddress: address candidate', { addrCandidates, addr });
      }

      // fallback: search any key containing address/location
      if (!addr) {
        for (const key of Object.keys(comp)) {
          if (/address|location/i.test(key)) {
            const v = (comp as any)[key];
            if (!v) continue;
            addr = Array.isArray(v) ? v[0] : v;
            console.debug('fillCompanyAddress: found via fallback', { key, addr });
            break;
          }
        }
      }

      let resolved = '';
      if (addr) {
        if (typeof addr === 'string') {
          resolved = addr;
        } else if (addr.en && typeof addr.en === 'string') {
          resolved = addr.en;
        } else if (addr.ar && typeof addr.ar === 'string') {
          resolved = addr.ar;
        } else if (addr.location && typeof addr.location === 'string') {
          resolved = addr.location;
        } else {
          resolved = toPlainString(addr) || '';
        }
      }

      console.debug('fillCompanyAddress: resolved', { companyId: comp._id, resolved });
      if (resolved && resolved.trim()) {
        setInterviewForm((prev) => ({ ...prev, location: resolved }));
        return true;
      }
      return false;
    } catch (e) {
      console.error('fillCompanyAddress error', e);
      return false;
    }
  };

  // Resolve the single company object for this applicant (prefer populated jobPosition -> company, then applicant.companyId, then lookup from companies list)
  const companyObj = (() => {
    if (!applicant) return null as any;
    // If we fetched the canonical company from server, prefer it
    if ((fetchedCompany as any) && (fetchedCompany as any)?._id) return fetchedCompany as any;
    // If we fetched job position detail (for string jobPositionId), prefer company from it
    if (jobPositionDetail && (jobPositionDetail as any).companyId) {
      const jp = jobPositionDetail as any;
      if (typeof jp.companyId === 'object' && jp.companyId?._id) return jp.companyId;
      const compId = typeof jp.companyId === 'string' ? jp.companyId : jp.companyId?._id;
      if (compId) {
        const found = companies.find((c) => c._id === compId);
        if (found) return found as any;
      }
    }
    // If jobPositionId is populated with company info
    if (typeof applicant.jobPositionId === 'object') {
      const jobPos = applicant.jobPositionId as any;
      if (typeof jobPos.companyId === 'object' && jobPos.companyId?._id) return jobPos.companyId;
      const compId = typeof jobPos.companyId === 'string' ? jobPos.companyId : jobPos.companyId?._id;
      if (compId) {
        const found = companies.find((c) => c._id === compId);
        if (found) return found as any;
      }
    }

    // Fallback to direct applicant.companyId
    if (typeof applicant.companyId === 'object' && (applicant.companyId as any)?._id) {
      return applicant.companyId as any;
    }
    const compId = typeof applicant.companyId === 'string' ? applicant.companyId : (applicant.companyId as any)?._id;
    if (compId) {
      const found = companies.find((c) => c._id === compId);
      if (found) return found as any;
    }

    return null as any;
  })();

  const jobTitle = getJobTitle();
  const companyName = getCompanyName();
  const departmentName = getDepartmentName();

  // Modal states
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showInterviewSettingsModal, setShowInterviewSettingsModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);

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
  // If the canonical company arrives after opening the modal, prefill the location field
  useEffect(() => {
    if (!showInterviewModal) return;
    if (interviewForm.location && interviewForm.location.trim() !== '') return;
    try {
      const addr = getCompanyAddress();
      if (addr) setInterviewForm((prev) => ({ ...prev, location: addr }));
    } catch (e) {
      // ignore resolution errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedCompany, showInterviewModal]);
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
    // Close modal immediately when request is sent
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
        // Include the applicant's company id if resolved so backend can associate notifications/settings
        companyId: companyObj?._id,
        // Include notifications preferences
        notifications: {
          channels: {
            email: notificationChannels.email,
            sms: notificationChannels.sms,
            whatsapp: notificationChannels.whatsapp,
          },
          emailOption: emailOption || undefined,
          customEmail: emailOption === 'custom' ? customEmail || undefined : undefined,
          phoneOption: phoneOption || undefined,
          customPhone: phoneOption === 'custom' ? customPhone || undefined : undefined,
        },
      };

      // First: Update applicant status to "interview" if not already
      if (applicant && applicant.status !== 'interview') {
        await updateStatusMutation.mutateAsync({
          id: id!,
          data: {
            status: 'interview',
            notes: `Status automatically updated to interview upon scheduling an interview on ${new Date().toLocaleDateString()}`,
          } as UpdateStatusRequest,
        });
      }

      // Second: Create the interview (returns updated applicant with the new interview)
      const updatedApplicant = await scheduleInterviewMutation.mutateAsync({
        id: id!,
        data: interviewData,
      });

      // Third: Get the newly created interview ID and set its status to 'scheduled'
      const createdInterview =
        updatedApplicant?.interviews && updatedApplicant.interviews.length
          ? updatedApplicant.interviews[updatedApplicant.interviews.length - 1]
          : null;

      if (createdInterview && createdInterview._id) {
        await updateInterviewMutation.mutateAsync({
          applicantId: id!,
          interviewId: createdInterview._id,
          data: { status: 'scheduled' },
        });
      }

      // Success: keep modal closed and show confirmation

      await Swal.fire({
        title: 'Success!',
        text: 'Interview scheduled successfully.',
        icon: 'success',
        position: 'center',
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
      await Swal.fire({
        title: 'Error',
        text: String(errorMsg),
        icon: 'error',
      });
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
        position: 'center',
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
        position: 'center',
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
        position: 'center',
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => navigate('/applicants')}
            className="text-sm font-medium text-primary hover:text-primary/80 self-start"
          >
            ← Back to Applicants
          </button>
          <div className="flex flex-wrap gap-2 sm:gap-3 sm:ml-auto">
            <button
              onClick={() => setShowStatusModal(true)}
              className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-green-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-green-700"
            >
              <span className="hidden sm:inline">Change</span> Status
            </button>
            <button
              onClick={() => {
                setFormResetKey(prev => prev + 1); // Reset DatePickers
                // Prefill location with company address when opening the modal
                fillCompanyAddress();
                setShowInterviewModal(true);
              }}
              className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-blue-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700"
            >
              <PlusIcon className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Schedule</span> Interview
            </button>
            <button
              onClick={() => {
                setSelectedInterview(applicant.interviews?.[0] || null);
                setShowInterviewSettingsModal(true);
              }}
              className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-indigo-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <svg className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Interview Settings
            </button>
            <button
              onClick={() => setShowMessageModal(true)}
              className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-purple-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-purple-700"
            >
              <PlusIcon className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Send</span> Message
            </button>
            <button
              onClick={() => setShowCommentModal(true)}
              className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-gray-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-gray-700"
            >
              <PlusIcon className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Add</span> Comment
            </button>
          </div>
        </div>

        {/* Personal Information */}
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
  {/* Decorative background */}
  <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-purple-500/5 to-blue-500/5 dark:from-brand-500/10 dark:via-purple-500/10 dark:to-blue-500/10"></div>
  <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-500/10 dark:bg-brand-500/5 rounded-full blur-3xl"></div>
  <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl"></div>
  
  <div className="relative p-8">
    <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 p-3 bg-gradient-to-br from-brand-500 to-brand-600 dark:from-brand-600 dark:to-brand-700 rounded-2xl shadow-lg">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-2xl font-extrabold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">Personal Information</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Applicant profile and contact details</p>
        </div>
      </div>
      
      {/* Profile Photo in header */}
      <div className="flex-shrink-0">
        {applicant.profilePhoto ? (
          <button
            type="button"
            onClick={() => setShowPhotoModal(true)}
            className="relative block rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="View profile photo"
          >
            <img
              src={applicant.profilePhoto}
              alt={applicant.fullName}
              className="h-24 w-24 sm:h-28 sm:w-28 object-cover"
            />
          </button>
        ) : (
          <div className="flex items-center justify-center h-24 w-24 sm:h-28 sm:w-28 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 shadow-lg text-2xl font-bold text-gray-800 dark:text-white">
            {applicant.fullName ? applicant.fullName.split(' ').map((n: string) => n.charAt(0)).slice(0,2).join('').toUpperCase() : 'NA'}
          </div>
        )}
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Full Name */}
        <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-brand-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
          <div className="flex items-baseline gap-4">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-brand-100 dark:bg-brand-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Full Name</Label>
            <div dir={isArabic(applicant.fullName) ? 'rtl' : undefined} className={`text-base font-bold text-gray-900 dark:text-white ${isArabic(applicant.fullName) ? 'text-right' : ''}`}>
              {applicant.fullName}
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-blue-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
          <div className="flex items-baseline gap-4">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Email</Label>
            <p className="text-sm text-gray-900 dark:text-white break-words">{applicant.email}</p>
          </div>
        </div>

        {/* Phone */}
        <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-green-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
          <div className="flex items-baseline gap-4">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Phone</Label>
            <p className="text-sm text-gray-900 dark:text-white">{applicant.phone}</p>
          </div>
        </div>

        {/* Job Position */}
        <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-purple-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
          <div className="flex items-baseline gap-4">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Job Position</Label>
            <p dir={isArabic(jobTitle.en) ? 'rtl' : undefined} className={`text-sm font-semibold text-gray-900 dark:text-white break-words ${isArabic(jobTitle.en) ? 'text-right' : ''}`}>{jobTitle.en}</p>
          </div>
        </div>

        {/* Company */}
        <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-orange-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
          <div className="flex items-baseline gap-4">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Company</Label>
            <p dir={isArabic(companyName) ? 'rtl' : undefined} className={`text-sm text-gray-900 dark:text-white break-words ${isArabic(companyName) ? 'text-right' : ''}`}>{companyName}</p>
          </div>
        </div>

        {/* Department */}
        <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-pink-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
          <div className="flex items-baseline gap-4">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-pink-100 dark:bg-pink-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-pink-600 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Department</Label>
            <p dir={isArabic(departmentName) ? 'rtl' : undefined} className={`text-sm text-gray-900 dark:text-white break-words ${isArabic(departmentName) ? 'text-right' : ''}`}>{departmentName}</p>
          </div>
        </div>

        {/* Address */}
        <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-teal-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded-lg group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Address</Label>
            </div>
            <p dir={isArabic(applicant.address) ? 'rtl' : undefined} className={`text-sm text-gray-900 dark:text-white break-words ${isArabic(applicant.address) ? 'text-right' : ''}`}>{applicant.address}</p>
          </div>
        </div>

        {/* Status */}
        <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-yellow-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
          <div className="flex items-baseline gap-4">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-yellow-100 dark:bg-yellow-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Status</Label>
            <span className={`inline-block rounded-full px-4 py-2 text-xs font-bold ${getStatusColor(applicant.status)}`}>
              {applicant.status.charAt(0).toUpperCase() + applicant.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Submitted */}
        <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-indigo-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
          <div className="flex items-baseline gap-4">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Submitted</Label>
            <p className="text-sm text-gray-900 dark:text-white">{formatDate(applicant.submittedAt)}</p>
          </div>
        </div>

        {/* Resume */}
        {applicant.cvFilePath && (
          <div className="group relative pl-5 pr-5 py-5 bg-gradient-to-br from-brand-500 to-brand-600 dark:from-brand-600 dark:to-brand-700 backdrop-blur-sm rounded-xl border-l-4 border-brand-700 hover:shadow-2xl transition-all duration-200">
            <div className="flex items-baseline gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <Label className="text-xs text-white/80 font-bold uppercase">Resume</Label>
              <button
                type="button"
                onClick={openCv}
                className="inline-flex items-center gap-2 text-sm font-bold text-white hover:text-white/90 transition-colors"
              >
                Download CV
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
</div>

        {/* Custom Responses */}
        {applicant.customResponses &&
          Object.keys(applicant.customResponses).length > 0 && (
            <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 border-2 border-blue-200 dark:border-blue-900/50 shadow-lg">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-8 py-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-white">Application Responses</h3>
                    <p className="text-sm text-blue-100 mt-0.5">Custom field responses and additional information</p>
                  </div>
                </div>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-5">
                {Object.entries(applicant.customResponses).map(
                  ([key, value]) => {
                    // Helper function to toggle expansion for a specific item
                    const toggleExpand = (index: number) => {
                      setExpandedResponses(prev => {
                        const newState = { ...prev };
                        if (!newState[key]) {
                          newState[key] = new Set();
                        }
                        const currentSet = new Set(newState[key]);
                        if (currentSet.has(index)) {
                          currentSet.delete(index);
                        } else {
                          currentSet.add(index);
                        }
                        newState[key] = currentSet;
                        return newState;
                      });
                    };

                    // Helper function to render value properly
                    const renderValue = () => {
                      if (Array.isArray(value)) {
                        // Check if array contains objects
                        if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
                          // Render each object as an expandable tag
                          return (
                            <div className="flex flex-wrap gap-2">
                              {value.map((item, idx) => {
                                const isExpanded = expandedResponses[key]?.has(idx) || false;
                                // Get a summary for the tag (e.g., first field value or index)
                                const firstKey = Object.keys(item)[0];
                                const summary = item[firstKey] || `Item ${idx + 1}`;
                                const summaryText = String(summary);
                                const summaryIsArabic = isArabic(summaryText);
                                const displaySummary = summaryIsArabic
                                  ? (summaryText.length > 30 ? '...' + summaryText.slice(-30) : summaryText)
                                  : (summaryText.length > 30 ? summaryText.substring(0, 30) + '...' : summaryText);
                                return (
                                  <div key={idx} className="w-full">
                                    <button
                                      onClick={() => toggleExpand(idx)}
                                      className={
                                        (() => {
                                          const normalizedKey = key.replace(/\s|_/g, '').toLowerCase();
                                          const isGrayTag = ['workexperience', 'certifications'].includes(normalizedKey);
                                          return `inline-flex items-center justify-between w-full gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${isGrayTag ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800/30 dark:text-gray-300 dark:hover:bg-gray-800/50' : 'bg-brand-100 text-brand-700 hover:bg-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50'}`;
                                        })()
                                      }
                                    >
                                      <span dir={summaryIsArabic ? 'rtl' : undefined} className={summaryIsArabic ? 'text-right w-full' : ''}>
                                        {displaySummary}
                                      </span>
                                      <svg
                                        className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                    {isExpanded && (
                                        <div className="mt-3">
                                        {/* Summary pill/header */}
                                        <div className="mb-3 flex flex-wrap items-center gap-2">
                                        
                                        </div>

                                        {/* Details card */}
                                        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                          {(() => {
                                            const entries = Object.entries(item).filter(([_, v]) => {
                                              if (v === null || v === undefined) return false;
                                              const s = typeof v === "string" ? v : String(v);
                                              return s.trim() !== "";
                                            });

                                            const formatValue = (v: any) => {
                                              if (typeof v === "boolean") return v ? "Yes" : "No";
                                              if (v === null || v === undefined) return "-";
                                              if (Array.isArray(v)) return v.join(", ");
                                              if (typeof v === "object") return JSON.stringify(v, null, 2);
                                              return String(v);
                                            };

                                            return (
                                                <div className="space-y-3">
                                                  {entries.map(([itemKey, itemValue]) => {
                                                  const label = itemKey
                                                    .replace(/_/g, " ")
                                                    .replace(/\b\w/g, (c) => c.toUpperCase());

                                                  const valueStr = formatValue(itemValue);
                                                  const valueIsArabic =
                                                    typeof valueStr === "string" && isArabic(valueStr);

                                                  // Determine row direction from label or value (Arabic -> RTL)
                                                  const rowIsArabic = valueIsArabic || isArabic(label);
                                                  const rowDir = rowIsArabic ? "rtl" : "ltr";

                                                  // Field-level expansion state
                                                  const isFieldExpanded = (expandedItemFields[key] && expandedItemFields[key][idx] && expandedItemFields[key][idx].has(itemKey)) || false;
                                                  const needsTruncate = typeof valueStr === 'string' && valueStr.length > 20;

                                                  const toggleField = (fieldName: string) => {
                                                    setExpandedItemFields(prev => {
                                                      const newState = { ...prev };
                                                      if (!newState[key]) newState[key] = {};
                                                      if (!newState[key][idx]) newState[key][idx] = new Set<string>();
                                                      if (newState[key][idx].has(fieldName)) {
                                                        newState[key][idx].delete(fieldName);
                                                      } else {
                                                        newState[key][idx].add(fieldName);
                                                      }
                                                      return { ...newState };
                                                    });
                                                  };

                                                  return (
                                                    <div
                                                      key={itemKey}
                                                      dir={rowDir}
                                                      className={`
                                                        rounded-xl border border-gray-100 bg-gray-50 px-3 py-2
                                                        dark:border-gray-700/60 dark:bg-gray-900/30
                                                        transition
                                                      `}
                                                    >
                                                      <div
                                                        className={`
                                                          grid grid-cols-1 gap-1
                                                          ${rowIsArabic ? 'sm:grid-cols-[170px_1fr] sm:gap-4' : 'sm:grid-cols-[170px_1fr] sm:gap-4'}
                                                        `}
                                                      >
                                                        {/* Label */}
                                                        <div
                                                          className={`
                                                            text-xs font-semibold uppercase tracking-wide
                                                            text-gray-500 dark:text-gray-400
                                                            ${rowIsArabic ? "text-right" : "text-left"}
                                                          `}
                                                        >
                                                          {label} :
                                                        </div>

                                                        {/* Value */}
                                                        <div
                                                          className={`
                                                            text-sm font-medium -mr-15 text-gray-900 dark:text-white
                                                            whitespace-pre-wrap break-words leading-relaxed
                                                            ${rowIsArabic ? "text-right" : "text-left"}
                                                          `}
                                                        >
                                                          {needsTruncate && !isFieldExpanded ? (
                                                            <span className="inline-flex items-center gap-2">
                                                              <span>{valueStr.slice(0, 20)}</span>
                                                              <button
                                                                type="button"
                                                                onClick={() => toggleField(itemKey)}
                                                                className="text-xs text-brand-600 hover:text-brand-700"
                                                                aria-label={`Expand ${label}`}
                                                              >
                                                                ⋯
                                                              </button>
                                                            </span>
                                                          ) : (
                                                            <span>
                                                              {valueStr}
                                                            </span>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        // Simple array of primitives - detect Arabic elements
                        const joined = value.join(', ');
                        if (value.some((v: any) => isArabic(String(v)))) {
                          return (
                            <div dir="rtl" className="text-right text-gray-900 dark:text-white">
                              {joined}
                            </div>
                          );
                        }
                        return joined;
                      }
                      // Simple value - handle Arabic direction and multiline text
                      if (typeof value === 'string') {
                        const containsNewline = value.includes('\n');
                        if (isArabic(value)) {
                          return (
                            <div dir="rtl" className="text-right text-gray-900 dark:text-white">
                              {containsNewline ? (
                                <div className="whitespace-pre-wrap">{value}</div>
                              ) : (
                                value
                              )}
                            </div>
                          );
                        }
                        if (containsNewline) {
                          return (
                            <div className="whitespace-pre-wrap text-gray-900 dark:text-white">
                              {value}
                            </div>
                          );
                        }
                        return String(value);
                      }
                      return String(value);
                    };

                    const valueIsArabicOverall = (() => {
                      if (Array.isArray(value)) {
                        // primitives or objects
                        if (value.length === 0) return false;
                        return value.some((v: any) => {
                          if (typeof v === 'string') return isArabic(String(v));
                          if (typeof v === 'object' && v !== null) {
                            return Object.values(v).some((x) => typeof x === 'string' && isArabic(x));
                          }
                          return false;
                        });
                      }
                      if (typeof value === 'string') return isArabic(value);
                      if (typeof value === 'object' && value !== null) {
                        return Object.values(value).some((v) => typeof v === 'string' && isArabic(v));
                      }
                      return false;
                    })();

                    const normalizedKey = key.replace(/\s|_/g, '').toLowerCase();
                    const isCoverText = typeof value === 'string' && /cover/.test(normalizedKey);

                    return (
                      <div key={key} className={`group p-4 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all duration-200 border-l-4 border-blue-500`}>
                        <div className="flex items-center gap-4">
                          <span className={`text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider whitespace-nowrap`}>
                            {key
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (c) => c.toUpperCase())}:
                          </span>

                          {isCoverText ? (
                            <button
                              type="button"
                              onClick={() => setExpandedText(prev => ({ ...prev, [key]: !prev[key] }))}
                              className="inline-flex items-center gap-2 px-2 py-1 text-xs font-medium rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                            >
                              {expandedText[key] ? 'Collapse' : 'Expand'}
                              <svg className={`w-3 h-3 text-blue-600 dark:text-blue-300 transition-transform ${expandedText[key] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          ) : (
                            <div className={`text-sm text-gray-900 dark:text-white leading-relaxed ${valueIsArabicOverall ? 'flex-none max-w-[60%] min-w-0 break-words text-right' : 'flex-1'}`}>
                              {renderValue()}
                            </div>
                          )}
                        </div>

                        {isCoverText && expandedText[key] && (
                          <div className={`mt-3 p-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 whitespace-pre-wrap ${valueIsArabicOverall ? 'text-right' : ''} max-h-40 overflow-auto`} dir={typeof value === 'string' && isArabic(value) ? 'rtl' : undefined}>
                            {value}
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

        {/* Status History */}
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
              // Combine all activities into a single timeline
              const activities: Array<{
                type: 'status' | 'message' | 'comment' | 'interview';
                date: string;
                data: any;
              }> = [];

              // Add status history
              applicant.statusHistory?.forEach((history: any) => {
                activities.push({
                  type: 'status',
                  date: history.changedAt,
                  data: history,
                });
              });

              // Add messages
              applicant.messages?.forEach((message: any) => {
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
              applicant.comments?.forEach((comment: any) => {
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
              applicant.interviews?.forEach((interview: any) => {
                activities.push({
                  type: 'interview',
                  date:
                    interview.scheduledAt ||
                    interview.createdAt ||
                    (interview as any).issuedAt ||
                    new Date().toISOString(),
                  data: interview,
                });
              });

              // Sort by date (newest first)
              activities.sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime()
              );

              // Filter activities based on selected tab
              const filteredActivities = activities.filter((activity) => {
                if (activityTab === 'all') return true;
                if (activityTab === 'status') return activity.type === 'status';
                if (activityTab === 'actions') return activity.type === 'message' || activity.type === 'comment';
                if (activityTab === 'interview') {
                  // Show only interviews, not status changes
                  return activity.type === 'interview';
                }
                return false;
              });

              return filteredActivities.map((activity, index) => {
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
                      {(() => {
                        // Try to show the real user who triggered this change when possible.
                        let actorName: string | null = null;

                        // If changedBy is a non-system string, use it directly
                        if (
                          history.changedBy &&
                          typeof history.changedBy === 'string' &&
                          history.changedBy.toLowerCase() !== 'system'
                        ) {
                          actorName = history.changedBy;
                        }

                        // If changedBy is an object, try to read fullName/email
                        if (!actorName && history.changedBy && typeof history.changedBy === 'object') {
                          actorName = (history.changedBy as any).fullName || (history.changedBy as any).email || null;
                        }

                        // If actor is still unknown or labeled 'system', try to infer from nearby activities
                        if (!actorName) {
                          const histTime = history.changedAt ? new Date(history.changedAt).getTime() : null;
                          const withinWindow = (time?: string) => {
                            if (!histTime || !time) return false;
                            const t = new Date(time).getTime();
                            return Math.abs(t - histTime) <= 2 * 60 * 1000; // 2 minutes
                          };

                          // Search messages
                          if (!actorName && applicant.messages) {
                            const match = applicant.messages.find((m: any) => (withinWindow(m.sentAt) || withinWindow((m as any).createdAt)) && (m.sentBy || (m as any).sentBy));
                            if (match) actorName = typeof match.sentBy === 'string' ? match.sentBy : (match.sentBy?.fullName || match.sentBy?.email || null);
                          }

                          // Search comments
                          if (!actorName && applicant.comments) {
                            const match = applicant.comments.find((c: any) => (withinWindow(c.changedAt) || withinWindow((c as any).commentedAt) || withinWindow((c as any).createdAt)) && (c.changedBy || c.author));
                            if (match) actorName = typeof match.changedBy === 'string' ? match.changedBy : (match.changedBy?.fullName || match.changedBy?.email || match.author || null);
                          }

                          // Search interviews
                          if (!actorName && applicant.interviews) {
                            const match = applicant.interviews.find((iv: any) => (withinWindow(iv.scheduledAt) || withinWindow(iv.createdAt) || withinWindow((iv as any).issuedAt)) && (iv.issuedBy));
                            if (match) actorName = typeof match.issuedBy === 'string' ? match.issuedBy : (match.issuedBy?.fullName || match.issuedBy?.email || null);
                          }
                        }

                        // If still unknown, show the currently logged in user
                        const currentUserLabel = (user?.fullName || user?.email) ? (user?.fullName || user?.email) : 'Current User';
                        return (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            By: {actorName || (typeof history.changedBy === 'string' && history.changedBy.toLowerCase() !== 'system' ? history.changedBy : (history.changedBy as any)?.fullName || (history.changedBy as any)?.email || currentUserLabel)}
                          </p>
                        );
                      })()}
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
                        (message.content || message.body || (message as any).message) && (
                          <div className="mt-3 border-t border-stroke pt-3 dark:border-strokedark">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {message.content || message.body || (message as any).message}
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
                              (typeof author.name === 'object' ? toPlainString(author.name) : author.name) ||
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
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              interview.status?.toLowerCase() === 'completed'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : interview.status?.toLowerCase() === 'cancelled'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : interview.status?.toLowerCase() === 'rescheduled'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}
                          >
                            📅 Interview {interview.status ? `- ${interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}` : 'Scheduled'}
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
                        {formatDate(interview.createdAt || interview.scheduledAt || (interview as any).issuedAt || new Date().toISOString())}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        By:{' '}
                        {typeof interview.issuedBy === 'string'
                          ? interview.issuedBy
                          : (interview.issuedBy as any)?.fullName ||
                            (interview.issuedBy as any)?.email ||
                            user?.fullName ||
                            user?.email ||
                            'System'}
                      </p>
                      {(interview as any).scheduledAt && (
                        <p className="mt-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                          📅 Scheduled: {formatDate((interview as any).scheduledAt)}
                        </p>
                      )}
                      {interview.status && (
                        <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                          Status: <span className="capitalize">{interview.status}</span>
                        </p>
                      )}
                      {expandedHistory === `interview-${index}` && (
                        <div className="mt-3 space-y-2 border-t border-stroke pt-3 dark:border-strokedark">
                          {(interview as any).scheduledAt && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">Scheduled:</span>
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {new Date((interview as any).scheduledAt).toLocaleString('en-US', {
                                  weekday: 'short',
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          )}
                          {interview.type && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">Type:</span>
                              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{interview.type}</span>
                            </div>
                          )}
                          {(interview as any).location && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">Location:</span>
                              <span className="text-sm text-gray-700 dark:text-gray-300">{(interview as any).location}</span>
                            </div>
                          )}
                          {(interview as any).videoLink && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">Video Link:</span>
                              <a href={(interview as any).videoLink} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline dark:text-brand-400">
                                {(interview as any).videoLink}
                              </a>
                            </div>
                          )}
                          {interview.description && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">Description:</span>
                              <span className="text-sm text-gray-700 dark:text-gray-300">{interview.description}</span>
                            </div>
                          )}
                          {((interview as any).notes || interview.comment) && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">Notes:</span>
                              <span className="text-sm text-gray-700 dark:text-gray-300">{(interview as any).notes || interview.comment}</span>
                            </div>
                          )}
                          {(interview as any).createdAt && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">Created:</span>
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {new Date((interview as any).createdAt).toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              });
            })())}
          </div>
        </ComponentCard>
      </div>

      {/* Photo Preview Modal */}
      <Modal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        className="max-w-3xl p-4"
        isFullscreen={false}
      >
        <div className="flex items-center justify-center">
          <img
            src={applicant?.profilePhoto}
            alt={applicant?.fullName}
            className="max-h-[75vh] w-full object-contain rounded-lg"
          />
        </div>
      </Modal>
      <Modal
        isOpen={showInterviewModal}
        onClose={() => {
          setShowInterviewModal(false);
          setInterviewError('');
          // Reset form and increment key when closing
          setInterviewForm({
            date: '',
            time: '',
            description: '',
            comment: '',
            location: '',
            link: '',
            type: 'phone',
          });
          setFormResetKey(prev => prev + 1);
        }}
        className="max-w-[1100px] p-6 lg:p-10"
        closeOnBackdrop={false}
      >
        <form
          key={`interview-form-${formResetKey}`}
          onSubmit={handleInterviewSubmit}
          className="flex flex-col px-2"
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
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => fillCompanyAddress()}
                    className="text-sm text-brand-600 hover:underline"
                  >
                    Use company address
                  </button>
                </div>
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
                <Label htmlFor="interview-comment">Comment</Label>
                <TextArea
                  value={interviewForm.comment}
                  onChange={(value) =>
                    setInterviewForm({ ...interviewForm, comment: value })
                  }
                  placeholder="Add notes about this interview"
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

      {/* Interview Settings Modal */}
      <Modal
        isOpen={showInterviewSettingsModal}
        onClose={() => {
          setShowInterviewSettingsModal(false);
          setSelectedInterview(null);
        }}
        className="max-w-md p-6"
        closeOnBackdrop={false}
      >
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Interview Settings
          </h2>

          {applicant.interviews && applicant.interviews.length > 0 && (
            <div>
              <Label>Select Interview to Manage</Label>
              <Select
                placeholder="Choose an interview..."
                value={selectedInterview?._id}
                options={applicant.interviews.map((iv: any) => ({
                  value: iv._id,
                  label: `${iv.type ? iv.type.charAt(0).toUpperCase() + iv.type.slice(1) : 'Interview'} - ${iv.scheduledAt ? new Date(iv.scheduledAt).toLocaleString() : 'No date'}${iv.status ? ` - ${iv.status}` : ''}`,
                }))}
                onChange={(val) => {
                  const found = applicant.interviews?.find((it: any) => it._id === val) || null;
                  setSelectedInterview(found);
                }}
              />
            </div>
          )}

          {selectedInterview && (
            <div className="space-y-4">
              {/* Current Interview Info */}
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Current Interview
                </h3>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Date:</span>{' '}
                    {selectedInterview.scheduledAt
                      ? new Date(selectedInterview.scheduledAt).toLocaleString()
                      : 'Not scheduled'}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Type:</span>{' '}
                    {selectedInterview.type || 'N/A'}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Status:</span>{' '}
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize
                      {selectedInterview.status === 'completed'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : selectedInterview.status === 'cancelled'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}
                    ">
                      {selectedInterview.status || 'scheduled'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Status Update Buttons */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Update Status
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {(!selectedInterview.status || selectedInterview.status !== 'scheduled') && (
                    <button
                      onClick={async () => {
                        // Optimistically update local state
                        setSelectedInterview({ ...selectedInterview, status: 'scheduled' });
                        try {
                          // Close modal immediately when request is sent
                          setShowInterviewSettingsModal(false);
                          setSelectedInterview(null);
                          await updateInterviewMutation.mutateAsync({
                            applicantId: applicant._id,
                            interviewId: selectedInterview._id,
                            data: { status: 'scheduled' },
                          });
                          await Swal.fire({
                            title: 'Success!',
                            text: 'Interview status updated to scheduled.',
                            icon: 'success',
                            position: 'center',
                            timer: 2000,
                            showConfirmButton: false,
                            customClass: { container: '!mt-16' },
                          });
                        } catch (error) {
                          console.error('Error updating interview:', error);
                          Swal.fire({
                            title: 'Error',
                            text: 'Failed to update interview status.',
                            icon: 'error',
                          });
                        }
                      }}
                      disabled={updatingInterviewId === selectedInterview._id}
                      className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      📅 Scheduled
                    </button>
                  )}
                  {(!selectedInterview.status || selectedInterview.status !== 'completed') && (
                    <button
                      onClick={async () => {
                        // Optimistically update local state
                        setSelectedInterview({ ...selectedInterview, status: 'completed' });
                        try {
                          // Close modal immediately when request is sent
                          setShowInterviewSettingsModal(false);
                          setSelectedInterview(null);
                          await updateInterviewMutation.mutateAsync({
                            applicantId: applicant._id,
                            interviewId: selectedInterview._id,
                            data: { status: 'completed' },
                          });
                          await Swal.fire({
                            title: 'Success!',
                            text: 'Interview marked as completed.',
                            icon: 'success',
                            position: 'center',
                            timer: 2000,
                            showConfirmButton: false,
                            customClass: { container: '!mt-16' },
                          });
                        } catch (error) {
                          console.error('Error updating interview:', error);
                          Swal.fire({
                            title: 'Error',
                            text: 'Failed to update interview status.',
                            icon: 'error',
                          });
                        }
                      }}
                      disabled={updatingInterviewId === selectedInterview._id}
                      className="rounded-lg bg-green-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ✓ Completed
                    </button>
                  )}
                  {(!selectedInterview.status || selectedInterview.status !== 'cancelled') && (
                    <button
                      onClick={async () => {
                        // Optimistically update local state
                        setSelectedInterview({ ...selectedInterview, status: 'cancelled' });
                        try {
                          // Close modal immediately when request is sent
                          setShowInterviewSettingsModal(false);
                          setSelectedInterview(null);
                          await updateInterviewMutation.mutateAsync({
                            applicantId: applicant._id,
                            interviewId: selectedInterview._id,
                            data: { status: 'cancelled' },
                          });
                          await Swal.fire({
                            title: 'Success!',
                            text: 'Interview cancelled.',
                            icon: 'success',
                            position: 'center',
                            timer: 2000,
                            showConfirmButton: false,
                            customClass: { container: '!mt-16' },
                          });
                        } catch (error) {
                          console.error('Error updating interview:', error);
                          Swal.fire({
                            title: 'Error',
                            text: 'Failed to update interview status.',
                            icon: 'error',
                          });
                        }
                      }}
                      disabled={updatingInterviewId === selectedInterview._id}
                      className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ✕ Cancelled
                    </button>
                  )}
                  
                </div>
              </div>

              {/* Add Comment */}
              <div className="space-y-2">
                <Label>Add Comment (Optional)</Label>
                <TextArea
                  placeholder="Add notes about this status change..."
                  rows={3}
                  className="w-full"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setShowInterviewSettingsModal(false);
                setSelectedInterview(null);
              }}
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
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
