import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../../../config/axios';
import DOMPurify from 'dompurify';
import PersonalInfo from './components/ApplicantData/PersonalInfo';
import { StickyTopBar, Stickysidebar } from './components/common/StickyLayout';
import ActivityFeed from './components/ActivityFeed';
import CustomResponses from './components/ApplicantData/CustomResponses';
import JobSpec from './components/ApplicantData/JobSpec';
import InterviewQuestions from './components/InterviewData/InterviewQuestions';
import History from './components/history/History';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import Swal from '../../../utils/swal';
import { useAuth } from '../../../context/AuthContext';
import {
  useApplicant,
  useUpdateApplicant,
  useUpdateApplicantStatus,
  useAddComment,
  useDeleteApplicant,
  useJobPosition,
  useCompany,
  useCompanies,
  useScheduleInterview,
  useUpdateInterviewStatus,
  useSendEmail,
  useSendMessage,
} from '../../../hooks/queries';
import { resolveCompanyAddress } from '../../../utils/companyAddress';
import type {
  Applicant,
  ResponseSection,
  Interview,
  Activity,
  ScheduleInterviewRequest,
} from '../../../types/applicants';
import StatusChangeModal from '../../../components/modals/StatusChangeModal';
import CommentModal from '../../../components/modals/commentmodal';
import MessageModal from '../../../components/modals/MessageModal';
import InterviewSettingsModal from '../../../components/modals/InterviewSettingsModal';
import InterviewScheduleModal from '../../../components/modals/InterviewScheduleModal';
import JobOfferModal from '../../../components/modals/JobOffersModal/JobOffersModal';
import JobContractModal from '../../../components/modals/ContractModal/ContractModal';
import { Modal } from '../../../components/ui/modal';
import { useLocale } from '../../../context/LocaleContext';
import { paths } from '../../../router/Paths';
import { getErrorMessage } from '../../../utils/errorHandler';
import { generateApplicantPdf } from '../../../utils/applicantPdfGenerator';
import {
  buildCustomResponseSections,
  extractCustomFieldsFromJobPosition,
} from './utils/customResponseUtils';
import { buildActivities } from './utils/activityUtils';
import { buildJobSpecItems } from './utils/jobSpecUtils';
import { getPreviousStatus } from './utils/statusUtils';
import type { JobSpecItem } from '../../../types/applicants';

const resolveId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = resolveId(item);
      if (resolved) return resolved;
    }
    return undefined;
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as { _id?: string; id?: string };
    if (typeof obj._id === 'string') return obj._id;
    if (typeof obj.id === 'string') return obj.id;
  }
  return undefined;
};

const resolveSenderEmail = (
  company:
    | (Record<string, unknown> & {
        settings?: { mailSettings?: { defaultMail?: string; availableMails?: string[] } };
        mailSettings?: { defaultMail?: string; availableMails?: string[] };
        contactEmail?: string;
        email?: string;
        availableMails?: string[];
      })
    | null,
  customEmail: string,
): string => {
  const mailSettings = company?.settings?.mailSettings || company?.mailSettings || null;
  const availableMails: string[] = [
    ...(mailSettings?.availableMails || []),
    ...(company?.availableMails || []),
  ].filter((m): m is string => typeof m === 'string' && m.trim().length > 0);
  const firstAvailable = availableMails[0];
  const mailDefault =
    mailSettings?.defaultMail || company?.contactEmail || company?.email || firstAvailable || '';
  return (customEmail || mailDefault || '').trim();
};

const escapeHtml = (s: string): string =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatTime12Hour = (value: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmmMatch) {
    const hours = Number(hhmmMatch[1]);
    const minutes = Number(hhmmMatch[2]);
    if (!Number.isNaN(hours) && !Number.isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 === 0 ? 12 : hours % 12;
      return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
    }
  }
  return raw;
};

const ApplicantDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, dir } = useLocale();
  const { user } = useAuth();
  const { data: applicant, isLoading: isApplicantLoading, isFetching: isApplicantFetching, isError, error, refetch } = useApplicant(id || '');
  const updateApplicant = useUpdateApplicant();
  const updateStatus = useUpdateApplicantStatus();
  const addComment = useAddComment();
  const deleteApplicant = useDeleteApplicant();
  const scheduleInterviewMutation = useScheduleInterview();
  const updateInterviewStatusMutation = useUpdateInterviewStatus();
  const sendEmailMutation = useSendEmail();
  const sendMessageMutation = useSendMessage();

  const applicantJobPositionId = useMemo(() => {
    if (!applicant) return '';
    const jpId = (applicant as unknown as { jobPositionId?: unknown }).jobPositionId;
    if (typeof jpId === 'string') return jpId;
    if (jpId && typeof jpId === 'object') {
      const obj = jpId as { _id?: string; id?: string };
      return obj?._id || obj?.id || '';
    }
    return '';
  }, [applicant]);

  const applicantCompanyId = useMemo(() => {
    if (!applicant) return '';
    const cId = (applicant as unknown as { companyId?: unknown }).companyId;
    if (typeof cId === 'string') return cId;
    if (cId && typeof cId === 'object') {
      const obj = cId as { _id?: string; id?: string };
      return obj?._id || obj?.id || '';
    }
    return '';
  }, [applicant]);

  const { data: fetchedJobPosition, isLoading: isJobPositionLoading, isFetching: isJobPositionFetching } = useJobPosition(applicantJobPositionId, {
    enabled: !!applicantJobPositionId,
    useInitialData: false,
  });

  const jobPosCompanyId = useMemo(() => {
    const fromApplicant = (() => {
      if (!applicant) return '';
      const jpId = (applicant as unknown as { jobPositionId?: unknown }).jobPositionId;
      if (jpId && typeof jpId === 'object') {
        const cId = (jpId as { companyId?: unknown }).companyId;
        if (typeof cId === 'string' && cId) return cId;
        if (cId && typeof cId === 'object') {
          const obj = cId as { _id?: string; id?: string };
          return obj?._id || obj?.id || '';
        }
      }
      return '';
    })();
    if (fromApplicant) return fromApplicant;
    const jp = fetchedJobPosition as { companyId?: unknown } | null | undefined;
    const cId = jp?.companyId;
    if (typeof cId === 'string' && cId) return cId;
    if (cId && typeof cId === 'object') {
      const obj = cId as { _id?: string; id?: string };
      return obj?._id || obj?.id || '';
    }
    return '';
  }, [applicant, fetchedJobPosition]);

  const jobCustomFields = useMemo<unknown[]>(
    () => extractCustomFieldsFromJobPosition(fetchedJobPosition),
    [fetchedJobPosition],
  );

  const { data: fetchedCompany, isLoading: isCompanyLoading, isFetching: isCompanyFetching } = useCompany(jobPosCompanyId || applicantCompanyId, {
    enabled: !!(jobPosCompanyId || applicantCompanyId),
  });

  const { data: companiesList = [] } = useCompanies();
  const companyFromList = useMemo(() => {
    if (!applicantCompanyId) return null;
    return companiesList.find((c: any) => c?._id === applicantCompanyId) ?? null;
  }, [companiesList, applicantCompanyId]);

  const companyWithAddress = useMemo(() => {
    if (!fetchedCompany && !companyFromList) return null;
    const detail: any = fetchedCompany || {};
    const list: any = companyFromList || {};
    const merged: any = { ...list, ...detail };
    const detailHasAddress = Array.isArray(detail.address) && detail.address.length > 0;
    const listHasAddress = Array.isArray(list.address) && list.address.length > 0;
    if (detailHasAddress) merged.address = detail.address;
    else if (listHasAddress) merged.address = list.address;
    else if (detail.address !== undefined) merged.address = detail.address;
    else if (list.address !== undefined) merged.address = list.address;
    if (!merged.addresses && list.addresses) merged.addresses = list.addresses;
    const detailHasMailSettings =
      detail.settings?.mailSettings &&
      (Array.isArray(detail.settings.mailSettings.emailTemplates) ||
        detail.settings.mailSettings.defaultMail ||
        Array.isArray(detail.settings.mailSettings.availableMails) ||
        detail.settings.mailSettings.companyDomain);
    const listHasMailSettings =
      list.settings?.mailSettings &&
      (Array.isArray(list.settings.mailSettings.emailTemplates) ||
        list.settings.mailSettings.defaultMail ||
        Array.isArray(list.settings.mailSettings.availableMails) ||
        list.settings.mailSettings.companyDomain);
    if (detailHasMailSettings) merged.settings = detail.settings;
    else if (listHasMailSettings) merged.settings = list.settings;
    else if (!merged.settings || Object.keys(merged.settings || {}).length === 0) {
      if (list.settings) merged.settings = list.settings;
    }
    if (!merged.location && list.location) merged.location = list.location;
    if (!merged.locations && list.locations) merged.locations = list.locations;
    if (!merged.officeAddress && list.officeAddress) merged.officeAddress = list.officeAddress;
    return merged;
  }, [fetchedCompany, companyFromList]);

  const [comment, setComment] = useState('');
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [commentForm, setCommentForm] = useState({ text: '' });
  const [commentError, setCommentError] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'interview' | 'history'>('details');
  const [visitedTabs, setVisitedTabs] = useState<Set<'details' | 'interview' | 'history'>>(
    () => new Set(['details']),
  );
  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  useEffect(() => {
    const textarea = commentTextareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [comment]);

  const [isEditing, setIsEditing] = useState(false);
  const [editedApplicant, setEditedApplicant] = useState<Partial<Applicant> | null>(null);
  const [editedSections, setEditedSections] = useState<ResponseSection[]>([]);
  const [editedSpecAnswers, setEditedSpecAnswers] = useState<Record<string, boolean>>({});
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusForm, setStatusForm] = useState<{ status: string; notes?: string; reasons?: string[] }>({ status: '', notes: '', reasons: [] });
  const [statusError, setStatusError] = useState('');
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showInterviewSettingsModal, setShowInterviewSettingsModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [autoSelectInterviewId, setAutoSelectInterviewId] = useState<string | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [interviewForm, setInterviewForm] = useState<{
    date: string; time: string; description: string; comment: string;
    location: string; link: string; type: 'phone' | 'video' | 'in-person'; conductedBy?: string;
  }>({ date: '', time: '', description: '', comment: '', location: '', link: '', type: 'phone' });
  const [interviewError, setInterviewError] = useState('');
  const [isSubmittingInterview, setIsSubmittingInterview] = useState(false);
  const [notificationChannels, setNotificationChannels] = useState({ email: false, sms: false, whatsapp: false });
  const [emailOption, setEmailOption] = useState<'company' | 'user' | 'custom' | 'new'>('company');
  const [customEmail, setCustomEmail] = useState('');
  const [phoneOption, setPhoneOption] = useState<'company' | 'user' | 'whatsapp' | 'custom'>('company');
  const [customPhone, setCustomPhone] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [interviewEmailSubject, setInterviewEmailSubject] = useState('Interview Invitation');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showJobOfferModal, setShowJobOfferModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);

  useEffect(() => {
    if (showStatusModal && applicant) {
      setStatusForm({ status: applicant.status || '', notes: '', reasons: [] });
      setStatusError('');
    }
  }, [showStatusModal, applicant]);

  const getJobTitle = useCallback((): { en: string } => {
    if (!applicant) return { en: '' };
    const jobPos =
      fetchedJobPosition ||
      (typeof applicant.jobPositionId === 'object'
        ? (applicant.jobPositionId as unknown as { _id?: string; title?: unknown })
        : null);
    if (jobPos && (jobPos as { title?: unknown }).title) {
      const title = (jobPos as { title?: unknown }).title;
      if (typeof title === 'string') return { en: title };
      if (typeof title === 'object' && (title as { en?: string })?.en) {
        return { en: (title as { en?: string }).en || '' };
      }
    }
    return { en: '' };
  }, [applicant, fetchedJobPosition]);

  const fillCompanyAddress = (): boolean => {
    try {
      const resolved = resolveCompanyAddress(companyWithAddress);
      if (resolved && resolved.trim()) {
        setInterviewForm((prev) => ({ ...prev, location: resolved.trim() }));
        return true;
      }
      return false;
    } catch (e) { void e; return false; }
  };

  const buildInterviewEmailHtml = useCallback((opts: {
    subject: string; jobTitle: string; rawMessage: string; applicantName?: string;
    interviewDate?: string; interviewTime?: string; interviewType?: string;
    interviewLocation?: string; interviewAddress?: string;
  }): string => {
    const { subject, rawMessage, applicantName, jobTitle, interviewDate, interviewTime, interviewType, interviewLocation, interviewAddress } = opts;
    const replacements: Record<string, string> = {
      '{{candidateName}}': applicantName || 'Candidate',
      '{{jobTitle}}': jobTitle || '',
      '{{InterviewDate}}': interviewDate || '',
      '{{interviewTime}}': interviewTime || '',
      '{{interviewType}}': interviewType || '',
      '{{location}}': interviewLocation || '',
      '{{address}}': interviewAddress || '',
    };
    const tokens = Object.keys(replacements);
    let processedSubject = subject;
    let processedBody = rawMessage || '';
    tokens.forEach((token) => {
      const value = replacements[token];
      const variants = [token, token.toLowerCase(), token.charAt(0).toUpperCase() + token.slice(1).toLowerCase(), token.toLowerCase().replace(/\s/g, '')];
      variants.forEach((v) => {
        const regex = new RegExp(v.replace(/[{}]/g, '\\$&'), 'gi');
        processedSubject = processedSubject.replace(regex, value);
        processedBody = processedBody.replace(regex, value);
      });
    });
    const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
    processedBody = processedBody.replace(urlRegex, (url) => {
      const href = url.toLowerCase().startsWith('http') ? url : `https://${url}`;
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color:#3b82f6;text-decoration:underline;">${escapeHtml(url)}</a>`;
    });
    const hasHtml = processedBody.indexOf('<') !== -1;
    const bodyHtml = hasHtml
      ? processedBody
      : processedBody.split(/\r?\n/).map((p) => p.trim()).filter((p) => p.length > 0)
          .map((p) => `<p style="margin:0 0 12px;color:#444;">${escapeHtml(p)}</p>`).join('');
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeHtml(processedSubject)}</title></head>
<body style="font-family: Arial, sans-serif; padding: 20px; margin: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #ffffff; border-bottom: 1px solid #e5e7eb; padding: 24px 30px; text-align: center;">
      <h1 style="color: #111827; margin: 0; font-size: 22px; font-weight: 700;">${escapeHtml(processedSubject)}</h1>
    </div>
    <div style="padding: 30px;"><div style="font-size: 16px; line-height: 1.6; color: #444;">${bodyHtml}</div></div>
  </div>
</body></html>`;
  }, []);

  const sendInterviewNotification = useCallback(
    async (snapshot: {
      subject: string; template: string; customEmail: string;
      interviewDate?: string; interviewTime?: string; interviewType?: string;
      interviewLocation?: string; interviewAddress?: string;
    }) => {
      if (!applicant || !id) return;
      const toEmail = (applicant as { email?: string }).email;
      if (!toEmail) {
        await Swal.fire({ title: t('emailSkippedNoEmail', 'applicants'), icon: 'warning', confirmButtonColor: '#3085d6' });
        return;
      }
      const fromEmail = resolveSenderEmail(companyWithAddress as never, snapshot.customEmail);
      if (!fromEmail) {
        await Swal.fire({ title: t('emailSkippedNoSender', 'applicants'), icon: 'warning', confirmButtonColor: '#3085d6' });
        return;
      }
      const jobTitle = getJobTitle().en || '';
      const applicantName = (applicant as { fullName?: string }).fullName || t('candidate', 'applicantDetails');
      const typeLabel = (snapshot.interviewType || '') === 'in-person' ? t('inPerson', 'applicantDetails')
        : (snapshot.interviewType || '').charAt(0).toUpperCase() + (snapshot.interviewType || '').slice(1);
      const subjectBase = snapshot.subject || t('interviewInvitation', 'applicantDetails');
      const processedSubject = subjectBase
        .replace(/\{\{\s*candidateName\s*\}\}/gi, applicantName)
        .replace(/\{\{\s*(?:position|jobTitle)\s*\}\}/gi, jobTitle)
        .replace(/\{\{\s*InterviewDate\s*\}\}/gi, snapshot.interviewDate || '')
        .replace(/\{\{\s*interviewTime\s*\}\}/gi, snapshot.interviewTime || '')
        .replace(/\{\{\s*interviewType\s*\}\}/gi, typeLabel)
        .replace(/\{\{\s*location\s*\}\}/gi, snapshot.interviewLocation || '')
        .replace(/\{\{\s*address\s*\}\}/gi, snapshot.interviewAddress || '');
      const emailHtml = buildInterviewEmailHtml({
        subject: subjectBase, jobTitle, rawMessage: snapshot.template || '', applicantName,
        interviewDate: snapshot.interviewDate, interviewTime: snapshot.interviewTime,
        interviewType: typeLabel, interviewLocation: snapshot.interviewLocation, interviewAddress: snapshot.interviewAddress,
      });
      const jobPositionId = resolveId((applicant as { jobPositionId?: unknown }).jobPositionId) || resolveId((applicant as { jobPosition?: unknown }).jobPosition);
      const resolvedCompanyId = (companyWithAddress as { _id?: string } | null)?._id || jobPosCompanyId || applicantCompanyId || resolveId((applicant as { companyId?: unknown }).companyId);
      try {
        await sendEmailMutation.mutateAsync({ company: resolvedCompanyId, jobPosition: jobPositionId, applicant: applicant._id, to: toEmail, from: fromEmail, subject: processedSubject, html: emailHtml });
        try { await sendMessageMutation.mutateAsync({ id, data: { type: 'email', content: snapshot.template || '' } }); } catch { /* non-critical */ }
      } catch (mailErr) {
        const msg = getErrorMessage(mailErr);
        await Swal.fire({ title: t('success', 'applicants'), text: t('interviewScheduledEmailFailed', 'applicants').replace('{msg}', msg), icon: 'warning', confirmButtonColor: '#3085d6' });
        setInterviewError(t('interviewScheduledEmailFailed', 'applicants').replace('{msg}', msg));
      }
    },
    [applicant, id, companyWithAddress, jobPosCompanyId, applicantCompanyId, getJobTitle, buildInterviewEmailHtml, sendEmailMutation, sendMessageMutation, t],
  );

  const handleScheduleInterviewSubmit = async () => {
    if (!id || !applicant) return;
    setIsSubmittingInterview(true);
    const emailSnapshot = {
      subject: interviewEmailSubject, template: messageTemplate, customEmail,
      interviewDate: interviewForm.date || '',
      interviewTime: interviewForm.time ? formatTime12Hour(interviewForm.time) : '',
      interviewType: interviewForm.type || 'phone',
      interviewLocation: interviewForm.link || '',
      interviewAddress: interviewForm.location || '',
    };
    try {
      let scheduledAt: string | undefined;
      if (interviewForm.date && interviewForm.time) {
        const [year, month, day] = interviewForm.date.split('-').map(Number);
        const [hours, minutes] = interviewForm.time.split(':').map(Number);
        const pad = (n: number) => String(n).padStart(2, '0');
        scheduledAt = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;
      } else if (interviewForm.date) {
        scheduledAt = `${interviewForm.date}T00:00:00`;
      }
      const interviewData: ScheduleInterviewRequest = {
        scheduledAt, description: interviewForm.description || undefined, type: interviewForm.type || undefined,
        location: interviewForm.location || undefined, videoLink: interviewForm.link || undefined,
        notes: interviewForm.comment || undefined, conductedBy: interviewForm.conductedBy || undefined,
        status: 'scheduled',
        scheduledBy: user?._id || user?.id || undefined,
        notifications: {
          channels: { email: notificationChannels.email, sms: notificationChannels.sms, whatsapp: notificationChannels.whatsapp },
          emailOption, customEmail: customEmail || undefined, phoneOption, customPhone: customPhone || undefined,
        },
      };
      const result = await scheduleInterviewMutation.mutateAsync({ id, data: interviewData });
      const res = result as {
        succeeded?: Array<{ applicantId?: string; interviews?: Interview[] }>;
        interviews?: Interview[];
      };
      const interviews: Interview[] = res.succeeded?.[0]?.interviews ?? res.interviews ?? [];
      const created = interviews.slice().sort((a, b) => {
        const aTime = new Date(a.createdAt || a.scheduledAt || 0).getTime();
        const bTime = new Date(b.createdAt || b.scheduledAt || 0).getTime();
        return bTime - aTime;
      })[0];
      setInterviewForm({ date: '', time: '', description: '', comment: '', location: '', link: '', type: 'phone' });
      setNotificationChannels({ email: false, sms: false, whatsapp: false });
      setEmailOption('company'); setCustomEmail(''); setPhoneOption('company'); setCustomPhone('');
      setMessageTemplate(''); setInterviewEmailSubject('Interview Invitation');
      setFormResetKey((prev) => prev + 1);
      setShowScheduleModal(false);
      setActiveTab('interview');
      if (created && (created._id || created.id)) setAutoSelectInterviewId(String(created._id || created.id));
      if (notificationChannels.email) await sendInterviewNotification(emailSnapshot);
    } catch (err) {
      setInterviewError(getErrorMessage(err));
    } finally {
      setIsSubmittingInterview(false);
    }
  };

  const handleStartInterview = async () => {
    if (!id || !applicant) return;
    try {
      const conductedById = user?._id ? String(user._id) : user?.id ? String(user.id) : '';
      const interviewData: ScheduleInterviewRequest = {
        status: 'in_progress',
        scheduledAt: new Date().toISOString(),
        type: 'in-person',
        ...(conductedById ? { conductedBy: conductedById } : {}),
      };
      const result = await scheduleInterviewMutation.mutateAsync({ id, data: interviewData });
      const res = result as {
        succeeded?: Array<{ applicantId?: string; interviews?: Interview[] }>;
        interviews?: Interview[];
      };

      const interviews: Interview[] =
        res.succeeded?.[0]?.interviews ?? res.interviews ?? [];

      let interviewId = '';

      const inProgress = interviews.find((iv) => iv.status === 'in_progress');
      if (inProgress) {
        interviewId = String(inProgress._id || inProgress.id || '');
      } else if (interviews.length) {
        const sorted = interviews.slice().sort((a, b) => {
          const aTime = new Date(a.createdAt || a.scheduledAt || 0).getTime();
          const bTime = new Date(b.createdAt || b.scheduledAt || 0).getTime();
          return bTime - aTime;
        });
        interviewId = String(sorted[0]?._id || sorted[0]?.id || '');
      }

      if (interviewId) {
        await updateInterviewStatusMutation.mutateAsync({
          applicantId: id,
          interviewId,
          data: { startedAt: new Date().toISOString(), status: 'in_progress' },
        });
        navigate(paths.applicants.interview(id, interviewId));
      }
    } catch (err) {
      setInterviewError(getErrorMessage(err));
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !statusForm.status) { setStatusError(t('selectStatus', 'applicants')); return; }
    try {
      const payload: { status: string; notes?: string; reasons?: string[] } = { status: statusForm.status };
      if (statusForm.notes && statusForm.notes.trim()) payload.notes = statusForm.notes.trim();
      if (statusForm.status === 'rejected' && statusForm.reasons && statusForm.reasons.length) payload.reasons = statusForm.reasons;
      await updateStatus.mutateAsync({ id, data: payload });
      setShowStatusModal(false);
    } catch { /* toast handled by mutation */ }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentForm.text.trim() || !id) { setCommentError(t('enterComment', 'applicantDetails')); return; }
    try {
      await addComment.mutateAsync({ id, data: { comment: commentForm.text.trim() } });
      setCommentForm({ text: '' }); setCommentError(''); setShowCommentModal(false);
    } catch { /* toast handled by mutation */ }
  };

  useEffect(() => {
    if (applicant) {
      setEditedApplicant({ fullName: applicant.fullName, firstName: applicant.firstName, lastName: applicant.lastName, email: applicant.email, phone: applicant.phone, address: applicant.address });
      setEditedSections(buildCustomResponseSections(applicant, jobCustomFields, t));
      const specs = buildJobSpecItems(applicant, fetchedJobPosition);
      const initial: Record<string, boolean> = {};
      specs.forEach((s) => { initial[s.id] = s.answer; });
      setEditedSpecAnswers(initial);
    }
  }, [applicant, jobCustomFields, fetchedJobPosition]);

  const companyIdForMail = jobPosCompanyId || applicantCompanyId;
  const { data: mailApiResponse } = useQuery({
    queryKey: ['mail-logs', companyIdForMail || 'none'],
    queryFn: async () => {
      if (!companyIdForMail) return { data: [] };
      const res = await axiosInstance.get('/mail', { params: { PageCount: 'all', company: companyIdForMail } });
      return res.data as { data: Array<{ createdAt: string; html: string; applicant: string | { _id: string } | null }> };
    },
    enabled: !!companyIdForMail,
    staleTime: 5 * 60 * 1000,
  });

  const applicantMailRecords = useMemo(() => {
    if (!mailApiResponse?.data || !applicant?._id) return [];
    const applicantId = applicant._id;
    return mailApiResponse.data
      .filter((mail) => {
        const mailApplicantId = typeof mail.applicant === 'string' ? mail.applicant : mail.applicant?._id;
        return mailApplicantId === applicantId;
      })
      .map((mail) => ({ createdAt: mail.createdAt, html: mail.html }));
  }, [mailApiResponse, applicant]);

  const activities = useMemo<Activity[]>(() => buildActivities(applicant, t), [applicant, t]);
  const sections = useMemo<ResponseSection[]>(
    () => (isEditing ? editedSections : buildCustomResponseSections(applicant, jobCustomFields, t)),
    [isEditing, editedSections, applicant, jobCustomFields, t]
  );
  const jobSpecItems = useMemo<JobSpecItem[]>(() => {
    const base = buildJobSpecItems(applicant, fetchedJobPosition);
    if (!isEditing) return base;
    return base.map((item) =>
      Object.prototype.hasOwnProperty.call(editedSpecAnswers, item.id) ? { ...item, answer: editedSpecAnswers[item.id] } : item,
    );
  }, [applicant, fetchedJobPosition, isEditing, editedSpecAnswers]);

  const handleSpecAnswerChange = (specId: string, answer: boolean) => {
    setEditedSpecAnswers((prev) => ({ ...prev, [specId]: answer }));
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !id) return;
    try {
      await addComment.mutateAsync({ id, data: { comment: comment.trim() } });
      setComment('');
    } catch { /* mutation already shows toast */ }
  };

  const handleEdit = () => {
    if (isEditing && id && applicant) { handleSave(); return; }
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!id || !applicant) return;
    try {
      const payload: Record<string, unknown> = {
        fullName: editedApplicant?.fullName ?? applicant.fullName,
        firstName: editedApplicant?.firstName ?? applicant.firstName,
        lastName: editedApplicant?.lastName ?? applicant.lastName,
        email: editedApplicant?.email ?? applicant.email,
        phone: editedApplicant?.phone ?? applicant.phone,
        address: editedApplicant?.address ?? applicant.address,
      };
      if (Object.keys(editedApplicant || {}).length > 0) Object.assign(payload, editedApplicant);
      const readLeafValue = (q: { type?: string; value?: unknown; selectedValue?: unknown; checked?: unknown; values?: unknown }): unknown => {
        switch (q.type) {
          case 'dropdown': case 'radio': return q.selectedValue ?? '';
          case 'checkbox': return Boolean(q.checked);
          case 'tags': return Array.isArray(q.values) ? q.values : [];
          default: return q.value ?? '';
        }
      };
      const customResponses: Record<string, unknown> = {};
      editedSections.forEach((section) => {
        const groups = new Map<string, Record<string, unknown>[]>();
        section.questions.forEach((q) => {
          if (!q) return;
          if (q.type === 'group' && 'groupId' in q && typeof (q as { groupId?: string }).groupId === 'string') {
            const group = q as { groupId: string; questions?: Array<{ id: string; type?: string; value?: unknown; selectedValue?: unknown; checked?: unknown; values?: unknown }> };
            const groupKey = group.groupId.replace(/_\d+$/, '');
            const entry: Record<string, unknown> = {};
            (group.questions || []).forEach((sq) => {
              const subKey = sq.id.startsWith(group.groupId + '_') ? sq.id.slice(group.groupId.length + 1) : sq.id;
              entry[subKey] = readLeafValue(sq);
            });
            const arr = groups.get(groupKey) ?? [];
            arr.push(entry);
            groups.set(groupKey, arr);
            return;
          }
          const leaf = q as { id: string; type?: string; value?: unknown; selectedValue?: unknown; checked?: unknown; values?: unknown };
          if (!leaf.id) return;
          customResponses[leaf.id] = readLeafValue(leaf);
        });
        groups.forEach((entries, key) => { customResponses[key] = entries.length === 1 ? entries[0] : entries; });
      });
      if (Object.keys(customResponses).length > 0) payload.customResponses = customResponses;
      const jobSpecsResponses = Object.entries(editedSpecAnswers).map(([jobSpecId, answer]) => ({ jobSpecId, answer }));
      if (jobSpecsResponses.length > 0) payload.jobSpecsResponses = jobSpecsResponses;
      await updateApplicant.mutateAsync({ id, data: payload as Parameters<typeof updateApplicant.mutateAsync>[0]['data'] });
      setEditedApplicant(null); setEditedSpecAnswers({}); setIsEditing(false);
    } catch { /* toast handled by mutation */ }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (applicant) {
      setEditedApplicant({ fullName: applicant.fullName, firstName: applicant.firstName, lastName: applicant.lastName, email: applicant.email, phone: applicant.phone, address: applicant.address });
      setEditedSections(buildCustomResponseSections(applicant, jobCustomFields, t));
      const specs = buildJobSpecItems(applicant, fetchedJobPosition);
      const reset: Record<string, boolean> = {};
      specs.forEach((s) => { reset[s.id] = s.answer; });
      setEditedSpecAnswers(reset);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const result = await Swal.fire({
      title: t('deleteApplicantTitle', 'applicants'),
      text: t('deleteApplicantsText', 'applicants').replace('{count}', '1'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: t('delete', 'applicants'),
      cancelButtonText: t('cancel', 'modals'),
    });
    if (!result.isConfirmed) return;
    try { await deleteApplicant.mutateAsync(id); navigate(paths.applicants.root); } catch { /* toast handled by mutation */ }
  };

  const handlePrint = useCallback(async () => {
    if (!applicant) return;
    Swal.fire({ title: t('generatingPdfTitle', 'applicants'), text: t('generatingPdfText', 'applicants'), allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
    try {
      await generateApplicantPdf(applicant, sections, jobSpecItems, fetchedJobPosition, companyWithAddress);
      Swal.close();
    } catch {
      Swal.close();
      await Swal.fire({ title: t('error', 'applicants'), text: t('pdfGenerationFailed', 'applicants'), icon: 'error', confirmButtonColor: '#3085d6' });
    }
  }, [applicant, sections, jobSpecItems, fetchedJobPosition, companyWithAddress, t]);

  const handleRestore = useCallback(async () => {
    if (!id || !applicant) return;
    const previousStatus = getPreviousStatus(applicant);
    const result = await Swal.fire({
      title: t('restoreTitle', 'applicants'),
      text: t('restoreText', 'applicants').replace('{status}', previousStatus),
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6b7280',
      confirmButtonText: t('restore', 'applicants'),
      cancelButtonText: t('cancel', 'modals'),
    });
    if (!result.isConfirmed) return;
    try {
      await updateStatus.mutateAsync({ id, data: { status: previousStatus } });
    } catch { /* toast handled by mutation */ }
  }, [id, applicant, updateStatus, t]);

  const isInitialPageLoad =
    (isApplicantLoading && !applicant) ||
    (!!applicantJobPositionId && isJobPositionLoading && !fetchedJobPosition) ||
    (!!applicantCompanyId && isCompanyLoading && !fetchedCompany);

  void isApplicantFetching;
  void isJobPositionFetching;
  void isCompanyFetching;

  if (isInitialPageLoad) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !applicant) {
    return (
      <div className="bg-gray-50 min-h-screen p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">{t('applicantNotFound', 'applicantDetails')}</h2>
          <p className="text-sm text-gray-500 mb-4">
            {(error as { message?: string } | null | undefined)?.message || t('couldNotLoadApplicant', 'applicantDetails')}
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={() => refetch()} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">{t('retry', 'applicantDetails')}</button>
            <button onClick={() => navigate(paths.applicants.root)} className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700">{t('backToList', 'applicantDetails')}</button>
          </div>
        </div>
      </div>
    );
  }

  const tabBar = (
    <div className="flex overflow-x-auto overflow-y-hidden">
      <button onClick={() => setActiveTab('details')} className={`px-4 lg:px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t('detailsTab', 'applicantDetails')}</button>
      <button onClick={() => setActiveTab('history')} className={`px-4 lg:px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t('historyTab', 'applicantDetails')}</button>
      <button onClick={() => setActiveTab('interview')} className={`px-4 lg:px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === 'interview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t('interviewQuestionsTab', 'applicantDetails')}</button>
    </div>
  );

  const sharedSidebar = (
    <Stickysidebar>
      <PersonalInfo
        applicant={applicant}
        isEditing={false}
        onChangeStatus={() => setShowStatusModal(true)}
        onScheduleInterview={() => setShowScheduleModal(true)}
        onSendMessage={() => setShowMessageModal(true)}
        onPrint={handlePrint}
        onRestore={handleRestore}
        onCreateJobOffer={() => setShowJobOfferModal(true)}
        onCreateContract={() => setShowContractModal(true)}
      />
    </Stickysidebar>
  );

  return (
    <div className="bg-gray-50">
      <div className="max-w-8xl mx-auto p-6">
        <StickyTopBar>
          <div className="flex flex-wrap items-center justify-between py-3 gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span onClick={() => navigate(paths.applicants.root)} className="hover:text-gray-700 cursor-pointer">{t('pageTitle', 'applicants')}</span>
              <span>-›</span>
              <span className="text-gray-800">{applicant.fullName || t('applicantDetails', 'applicantDetails')}</span>
            </div>
            <div className="flex flex-wrap gap-2 ml-auto">
              <button onClick={() => setShowStatusModal(true)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">{t('changeStatus', 'applicants')}</button>
              <button onClick={handleEdit} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">{isEditing ? t('save', 'applicantDetails') : t('edit', 'applicantDetails')}</button>
              {isEditing && <button onClick={handleCancel} className="px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors">{t('cancel', 'modals')}</button>}
              <button onClick={handleDelete} className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors">{t('delete', 'applicants')}</button>
            </div>
          </div>
        </StickyTopBar>



    {/* ── DETAILS TAB ── */}
<div hidden={activeTab !== 'details'}>
  <div className="flex flex-col lg:flex-row gap-6 mb-6">
    <Stickysidebar>
      <PersonalInfo
        applicant={applicant}
        isEditing={isEditing}
        editedApplicant={editedApplicant}
        onChange={setEditedApplicant}
        onChangeStatus={() => setShowStatusModal(true)}
        onScheduleInterview={() => setShowScheduleModal(true)}
        onSendMessage={() => setShowMessageModal(true)}
        onPrint={handlePrint}
        onRestore={handleRestore}
        onCreateJobOffer={() => setShowJobOfferModal(true)}
        onCreateContract={() => setShowContractModal(true)}
      />
    </Stickysidebar>
    
    {/* Main content - make it a flex column that fills height */}
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-gray-200 mb-2 flex-shrink-0">
        {tabBar}
      </div>
      
      {/* Comment textarea - fixed height */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 transition-all duration-200 flex-shrink-0">
        <div className="relative">
          <textarea
            ref={commentTextareaRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('writeCommentPlaceholder', 'applicantDetails')}
            className={`w-full block px-4 py-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none transition-all duration-200 placeholder:text-gray-400 min-h-[44px] ${dir === 'ltr' ? 'pr-12' : 'pl-12'}`}
            rows={1}
            style={{ height: 'auto', overflow: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && comment.trim()) { e.preventDefault(); handleAddComment(); } }}
          />
          <button onClick={handleAddComment} disabled={addComment.isPending || !comment.trim()} className={`absolute ${dir === 'ltr' ? 'right-3' : 'left-3'} inset-y-0 my-auto p-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed h-fit`} aria-label={t('addComment', 'modals')}>
            {addComment.isPending ? (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"></path></svg>
            )}
          </button>
        </div>
      </div>
      
      {/* JobSpec - fixed height */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex-shrink-0">
        <JobSpec specs={jobSpecItems} jobPosition={fetchedJobPosition} editable={isEditing} onSpecChange={handleSpecAnswerChange} />
      </div>
      
      {/* ActivityFeed - fixed height */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex-shrink-0">
        <ActivityFeed activities={activities} mailRecords={applicantMailRecords} interviews={applicant?.interviews} company={companyWithAddress} />
      </div>
      
      {/* CustomResponses - grows to fill remaining space */}
      <div data-custom-responses className="bg-white rounded-lg shadow-sm border border-gray-100 flex-1 flex flex-col">
        <div className="px-5 pt-4 pb-2 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">{t('applicationResponses', 'personalInfo')}</h3>
        </div>
        <CustomResponses isEditable={isEditing} sections={sections} onSectionsChange={setEditedSections} />
      </div>
    </div>
  </div>
</div>

        {/* ── INTERVIEW TAB ── */}
        {visitedTabs.has('interview') && (
          <div hidden={activeTab !== 'interview'}>
            <div className="flex flex-col lg:flex-row gap-6 mb-6">
              {sharedSidebar}
              <div className="flex-1 min-w-0 space-y-6">
                <div className="flex items-center justify-between border-b border-gray-200 mb-6">{tabBar}</div>
                <InterviewQuestions applicantId={id} onRequestScheduleInterview={() => setShowScheduleModal(true)} onRequestStartInterview={handleStartInterview} autoSelectInterviewId={autoSelectInterviewId} applicantData={applicant} authUser={user} />
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {visitedTabs.has('history') && (
          <div hidden={activeTab !== 'history'}>
            <div className="flex flex-col lg:flex-row gap-6 mb-6">
              {sharedSidebar}
              <div className="flex-1 min-w-0 space-y-6">
                <div className="flex items-center justify-between border-b border-gray-200 mb-6">{tabBar}</div>
                <History applicant={applicant} loading={isApplicantLoading} />
              </div>
            </div>
          </div>
        )}
      </div>

      <StatusChangeModal
        isOpen={showStatusModal}
        onClose={() => { if (updateStatus.isPending) return; setShowStatusModal(false); setStatusError(''); }}
        statusForm={statusForm} setStatusForm={setStatusForm} statusError={statusError} setStatusError={setStatusError}
        handleStatusChange={handleStatusSubmit} isSubmittingStatus={updateStatus.isPending}
        companyId={applicantCompanyId} companySettings={companyWithAddress}
        jobIds={applicantJobPositionId ? [applicantJobPositionId] : []}
        jobs={fetchedJobPosition ? [fetchedJobPosition] : []}
      />
      <CommentModal
        isOpen={showCommentModal}
        onClose={() => { if (addComment.isPending) return; setShowCommentModal(false); setCommentError(''); }}
        commentForm={commentForm} setCommentForm={setCommentForm} commentError={commentError}
        setCommentError={setCommentError} handleCommentSubmit={handleCommentSubmit} isSubmittingComment={addComment.isPending}
      />
      <MessageModal isOpen={showMessageModal} onClose={() => setShowMessageModal(false)} applicant={applicant} id={id || ''} company={companyWithAddress} />
      <InterviewScheduleModal
        isOpen={showScheduleModal}
        onClose={() => { if (isSubmittingInterview) return; setShowScheduleModal(false); }}
        formResetKey={formResetKey} interviewForm={interviewForm} setInterviewForm={setInterviewForm}
        interviewError={interviewError} setInterviewError={setInterviewError}
        handleInterviewSubmit={handleScheduleInterviewSubmit} fillCompanyAddress={fillCompanyAddress}
        notificationChannels={notificationChannels} setNotificationChannels={setNotificationChannels}
        emailOption={emailOption} setEmailOption={setEmailOption} customEmail={customEmail} setCustomEmail={setCustomEmail}
        phoneOption={phoneOption} setPhoneOption={setPhoneOption} customPhone={customPhone} setCustomPhone={setCustomPhone}
        messageTemplate={messageTemplate} setMessageTemplate={setMessageTemplate}
        interviewEmailSubject={interviewEmailSubject} setInterviewEmailSubject={setInterviewEmailSubject}
        isSubmittingInterview={isSubmittingInterview} setIsSubmittingInterview={setIsSubmittingInterview}
        setShowPreviewModal={setShowPreviewModal} setPreviewHtml={setPreviewHtml}
        buildInterviewEmailHtml={buildInterviewEmailHtml} getJobTitle={getJobTitle}
        applicant={applicant} companyData={companyWithAddress}
      />
      <Modal isOpen={showPreviewModal} onClose={() => { setShowPreviewModal(false); setPreviewHtml(''); }} className="max-w-2xl p-6 ">
        <div className="space-y-4 ">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('emailPreview', 'applicantDetails')}</h2>
          <div className="border rounded p-4 bg-white dark:bg-gray-800" style={{ maxHeight: '70vh', overflow: 'auto' }}>
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }} />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => { setShowPreviewModal(false); setPreviewHtml(''); }} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300">{t('close', 'modals')}</button>
          </div>
        </div>
      </Modal>
      <InterviewSettingsModal
        isOpen={showInterviewSettingsModal}
        onClose={() => { setShowInterviewSettingsModal(false); setSelectedInterview(null); }}
        applicant={applicant} selectedInterview={selectedInterview} setSelectedInterview={setSelectedInterview}
        setShowInterviewSettingsModal={setShowInterviewSettingsModal} updateInterviewMutation={updateInterviewStatusMutation}
      />
      <JobOfferModal
        isOpen={showJobOfferModal}
        onClose={() => setShowJobOfferModal(false)}
        mode="offer"
        companyId={applicantCompanyId || jobPosCompanyId || ''}
        applicantId={id || null}
        jobPositionId={applicantJobPositionId || null}
      />
      <JobContractModal
        isOpen={showContractModal}
        onClose={() => setShowContractModal(false)}
        mode="contract"
        companyId={applicantCompanyId || jobPosCompanyId || ''}
        applicantId={id || null}
        jobPositionId={applicantJobPositionId || null}
      />
    </div>
  );
};

export default ApplicantDetails;