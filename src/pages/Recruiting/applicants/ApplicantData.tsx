// Core React imports
import { useState, useMemo, useEffect } from 'react';
// UI helpers and third-party utilities
import Swal from 'sweetalert2';
import { useParams, useNavigate, useLocation } from 'react-router';
import PageBreadcrumb from '../../../components/common/PageBreadCrumb';
import PageMeta from '../../../components/common/PageMeta';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import Label from '../../../components/form/Label';
import { Modal } from '../../../components/ui/modal';
import { PlusIcon } from '../../../icons';
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
  useSendEmail,
} from '../../../hooks/queries';
import type {
  Applicant,
  UpdateStatusRequest,
} from '../../../services/applicantsService';
import { toPlainString } from '../../../utils/strings';
import MessageModal from '../../../components/modals/MessageModal';
import InterviewScheduleModal from '../../../components/modals/InterviewScheduleModal';
import CommentModal from '../../../components/modals/commentmodal';
import InterviewSettingsModal from '../../../components/modals/InterviewSettingsModal';
import StatusChangeModal from '../../../components/modals/StatusChangeModal';
import StatusHistory from './statusHistory';
import CustomResponses from './CustomResponses';

// Simple Quill editor integration (dynamic import to avoid react-quill)
import 'quill/dist/quill.snow.css';

// Lightweight Quill editor wrapper
// Dynamically imports Quill to avoid bundling react-quill and to enable server-safe loading.


// Main page component
// Renders applicant details, activity timeline, and provides actions (schedule interview, send messages, comments, status updates)
const ApplicantData = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation / incoming state
  // If the previous route passed applicant data via location.state we can use it for instant rendering
  const stateApplicant = location.state?.applicant as Applicant | undefined;

  
  // Helper: detect Arabic characters in a string
  // Used to apply RTL layout where appropriate
  const isArabic = (text?: any) => {
    if (!text || typeof text !== 'string') return false;
    return /[\u0600-\u06FF]/.test(text);
  };
  
  // UI state: active tab in the Activity Timeline

  // Data fetching (react-query hooks)
  // Fetch applicant and related entities; initialData uses navigation state when available for instant UI
  const { data: fetchedApplicant, isLoading: loading, error, isFetched: isApplicantFetched } = useApplicant(id || '', {
    initialData: stateApplicant,
  });
  
  // Prefer the fetched data, but fall back to navigation state if the fetch returns undefined
  const applicant: any = (fetchedApplicant ?? stateApplicant) as any;

  // Related data hooks (job positions, company details)
  // Declared here to preserve hook order for React
  const { data: jobPositions = [],  isFetched: isJobPositionsFetched } = useJobPositions();
  const jobPosIdString = applicant && typeof applicant.jobPositionId === 'string' ? applicant.jobPositionId : '';
  const { data: jobPositionDetail, isFetched: isJobPositionDetailFetched } = useJobPosition(jobPosIdString, { enabled: !!jobPosIdString });
  const jpCompanyId = jobPositionDetail && ((jobPositionDetail as any).companyId ? (typeof (jobPositionDetail as any).companyId === 'string' ? (jobPositionDetail as any).companyId : (jobPositionDetail as any).companyId?._id) : '');
  const { data: jobPosCompany, isFetched: isJobPosCompanyFetched } = useCompany(jpCompanyId || '', { enabled: !!jpCompanyId });
  const { data: companies = [],  isFetched: isCompaniesWithApplicantsFetched } = useCompaniesWithApplicants(
    applicant ? [applicant] : undefined
  );

  const [lastRefetch, setLastRefetch] = useState<Date | null>(null);

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

  const { data: fetchedCompany } = useCompany(resolvedCompanyId || '', { enabled: !!resolvedCompanyId });

  // Mutations: react-query mutation hooks for creating/updating comments, interviews, status and sending emails

  // Utility: compute full CV download URL (handles relative paths and data URLs)
  const cvUrl = useMemo(() => {
    if (!applicant?.cvFilePath) return null;
    const path = applicant.cvFilePath;
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    return base ? `${base}/${path.replace(/^\//, '')}` : path;
  }, [applicant?.cvFilePath]);

  

  // (internal preview removed) -- use the previewWithoutAttachment button to open inline

  // Utility: Build Cloudinary URL that forces attachment download with a friendly filename
  const buildCloudinaryDownloadUrl = (u: string) => {
    try {
      if (!u) return null;
      const urlParts = u.split('/upload/');
      if (urlParts.length !== 2) return null;
      const fileName = `CV_${(applicant?.applicantNo ?? applicant?._id ?? 'cv')}`;
      const transformations = `f_auto/fl_attachment:${fileName}`;
      const downloadUrl = `${urlParts[0]}/upload/${transformations}/${urlParts[1]}`;
      return downloadUrl;
    } catch (e) {
      return null;
    }
  };

  // Action: download CV with fallbacks (Cloudinary trick, fetch->blob, open in new tab)
  const downloadCv = async () => {
    if (!applicant?.cvFilePath) {
      Swal.fire('No CV', 'No CV file available for this applicant', 'info');
      return;
    }
    const url = cvUrl ?? applicant.cvFilePath;

    const downloadViaFetch = async (u: string, filename?: string) => {
      try {
        const res = await fetch(u, { mode: 'cors' });
        if (!res.ok) throw new Error('Network response not ok');
        const blob = await res.blob();
        const a = document.createElement('a');
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.download = filename || (u.split('/').pop() || 'download');
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        return true;
      } catch (err) {
        return false;
      }
    };

    const cloudUrl = buildCloudinaryDownloadUrl(url);
    if (cloudUrl) {
      window.open(cloudUrl, '_blank');
      return;
    }

    const ok = await downloadViaFetch(url, undefined);
    if (ok) return;
    window.open(url, '_blank');
  };

  // (preview helper removed)

  // Mutation hooks
  const updateStatusMutation = useUpdateApplicantStatus();
  const scheduleInterviewMutation = useScheduleInterview();
  const updateInterviewMutation = useUpdateInterviewStatus();
  const addCommentMutation = useAddComment();
  const sendEmailMutation = useSendEmail();

  // Interview-related UI state and form helpers

  // Derived data helpers: resolve job title, company name, department and address
  // These helpers handle both string IDs and populated objects returned by the API
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

  // Fallback helpers: prefer top-level applicant fields, then customResponses
  const getBirthDateValue = () => {
    if (!applicant) return null;
    return (
      applicant.birthDate ||
      (applicant as any).birthdate ||
      applicant.customResponses?.birthdate ||
      applicant.customResponses?.birthDate ||
      // Arabic keys fallback
      applicant.customResponses?.['تاريخ_الميلاد'] ||
      applicant.customResponses?.['تاريخ الميلاد'] ||
      (applicant as any)['تاريخ_الميلاد'] ||
      (applicant as any)['تاريخ الميلاد'] ||
      null
    );
  };

  const getGenderValue = () => {
    if (!applicant) return null;
    return (
      applicant.gender ||
      applicant.customResponses?.gender ||
      // Arabic keys fallback
      applicant.customResponses?.['النوع'] ||
      applicant.customResponses?.['gender'] ||
      (applicant as any)['النوع'] ||
      null
    );
  };

  const normalizeGenderLocal = (raw: any) => {
    if (raw === null || raw === undefined) return '';
    const s = String(raw).trim();
    if (!s) return '';
    const lower = s.toLowerCase();
    const arabicMale = ['ذكر', 'ذَكر', 'ذكرً'];
    const arabicFemale = ['انثى', 'أنثى', 'انثي', 'انسه', 'أنسه', 'انثا'];
    if (arabicMale.includes(s) || arabicMale.includes(lower)) return 'Male';
    if (arabicFemale.includes(s) || arabicFemale.includes(lower)) return 'Female';
    if (lower === 'male' || lower === 'm') return 'Male';
    if (lower === 'female' || lower === 'f') return 'Female';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // Resolve and normalize an address string for the applicant's company
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

  // Prefill interview form location from the best available company address
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

  // Resolve canonical company object for the current applicant
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

  // Modal visibility and selected item state
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showInterviewSettingsModal, setShowInterviewSettingsModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  const [formResetKey, setFormResetKey] = useState(0);

  // Interview form state and related flags
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

  useEffect(() => {
    if (!lastRefetch && (isApplicantFetched || isJobPositionsFetched || isJobPositionDetailFetched || isJobPosCompanyFetched || isCompaniesWithApplicantsFetched)) {
      setLastRefetch(new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApplicantFetched, isJobPositionsFetched, isJobPositionDetailFetched, isJobPosCompanyFetched, isCompaniesWithApplicantsFetched]);

 
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
  const [interviewEmailSubject, setInterviewEmailSubject] = useState('Interview Invitation');
  const [isSubmittingInterview, setIsSubmittingInterview] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [commentForm, setCommentForm] = useState({
    text: '',
  });
  const [statusForm, setStatusForm] = useState({
    status: '' as Applicant['status'] | '',
    notes: '',
  });
  const [interviewError, setInterviewError] = useState('');
  const [commentError, setCommentError] = useState('');
  const [statusError, setStatusError] = useState('');

  

  // Email helper: add inline styles to Quill-produced HTML for better email client rendering
  const inlineStyleHtml = (html: string) => {
    if (!html) return '';
    let out = String(html);
    out = out.replace(/<p(?![^>]*style)/g, '<p style="margin:0 0 12px;color:#444;">');
    out = out.replace(/<ul(?![^>]*style)/g, '<ul style="margin:0 0 12px 18px;padding-left:18px;">');
    out = out.replace(/<ol(?![^>]*style)/g, '<ol style="margin:0 0 12px 18px;padding-left:18px;">');
    out = out.replace(/<li(?![^>]*style)/g, '<li style="margin-bottom:6px;">');
    return out;
  };

  // HTML utility: escape content for safe HTML embedding
  const escapeHtml = (s: string) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  // Sanitize message template: remove quoted blocks and normalize whitespace
  const sanitizeMessageTemplate = (htmlOrText: string) => {
    if (!htmlOrText) return '';
    let out = String(htmlOrText);

    // Remove blockquotes which often contain quoted/repeated content
    out = out.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '');

    // Remove any leading quote-lines in plain text (lines starting with >)
    out = out.replace(/(^|\n)\s*>.*(?=\n|$)/g, '');
    // Remove HTML-encoded greater-than quote markers
    out = out.replace(/(^|\n)\s*&gt;+\s*/gi, '$1');

    // Remove any leading '>' or '&gt;' inside HTML paragraphs (e.g. <p>&gt;Dear...</p> -> <p>Dear...</p>)
    out = out.replace(/<p([^>]*)>\s*(?:&gt;|>)+\s*/gi, '<p$1>');

    // Remove a leading greeting like "Dear Name," if it's the very first content — avoids duplicate greetings
    out = out.replace(/^\s*(?:<p[^>]*>\s*)?(Dear\s+[A-Za-z0-9\-\s,.]{1,80}[,:]?)(?:<\/p>\s*)?/i, '');

    // Normalize multiple blank lines and trim
    out = out.replace(/(\r?\n){2,}/g, '\n\n').trim();
    return out;
  };

  // Build the full HTML email wrapper for interview invitations
  const buildInterviewEmailHtml = (opts: { subject: string; jobTitle: string; interview: any; rawMessage: string; applicantName?: string }) => {
    const { subject, rawMessage } = opts;
    const sanitizedBody = sanitizeMessageTemplate(rawMessage || '');

    // If sanitizedBody is HTML (contains tags) keep it; otherwise convert plaintext newlines to paragraphs.
    let bodyHtml = '';
    if (sanitizedBody.indexOf('<') !== -1) {
      bodyHtml = inlineStyleHtml(sanitizedBody);
    } else {
      const parts = sanitizedBody.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
      bodyHtml = parts.map(p => `<p style="margin:0 0 12px;color:#444;">${escapeHtml(p)}</p>`).join('');
    }

    // Do not inject any greeting/intro/signature — use exactly what user wrote in Quill (sanitized above)
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; background-color: #f5f5f5; margin:0; padding:0; }
    .container { max-width:600px; margin:24px auto; background:#fff; border-radius:8px; overflow:hidden; }
    .header { padding:28px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); text-align:center; }
    .header h1 { color:#fff; margin:0; font-size:20px; font-weight:600; }
    .content { padding:28px 30px; color:#222; }
    .footer { padding:18px 30px; color:#999; font-size:12px; text-align:center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${subject}</h1></div>
      <div class="content">
      <div style="margin-top:12px;margin-bottom:18px;">${bodyHtml}</div>
    </div>
    <div class="footer">This is an automated message from our HR system. Please do not reply to this email.</div>
  </div>
</body>
</html>`;
  };

  // Error helper: extract readable messages from API/network errors
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

  // UI options and form handlers
  // Status options used in the change-status flow
  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'interview', label: 'Interview' },
    { value: 'interviewed', label: 'Interviewed' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ];

  // Form handler: submit interview scheduling data, create interview and optionally send notifications
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
    // snapshot interview form before we reset UI state
    const interviewSnapshot = { ...interviewForm };
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
      // Combine date and time into scheduledAt using the snapshot
      let scheduledAt: string | undefined;
      if (interviewSnapshot.date && interviewSnapshot.time) {
        scheduledAt = `${interviewSnapshot.date}T${interviewSnapshot.time}:00`;
      } else if (interviewSnapshot.date) {
        scheduledAt = `${interviewSnapshot.date}T00:00:00`;
      }

      // Build payload matching backend scheduleInterviewSchema (from snapshot)
      const interviewData: any = {
        scheduledAt,
        description: interviewSnapshot.description || undefined,
        type: interviewSnapshot.type || undefined,
        location: interviewSnapshot.location || undefined,
        videoLink: interviewSnapshot.link || undefined,
        notes: interviewSnapshot.comment || undefined,
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

      // First: Optimistically update applicant status to "interview" if not already
      if (applicant && applicant.status !== 'interview') {
        updateStatusMutation.mutate({
          id: id!,
          data: {
            status: 'interview',
            notes: `Status automatically updated to interview upon scheduling an interview on ${new Date().toLocaleDateString()}`,
          } as UpdateStatusRequest,
        });
      }

      // Use a temp id so we can optimistically update interview status as well
      const tempInterviewId = `temp-${Date.now()}`;
      interviewData._id = tempInterviewId;

      // Second: create the interview on server and wait for result
      const updatedApplicant = await scheduleInterviewMutation.mutateAsync({ id: id!, data: interviewData });

      // Attempt to find the created interview id returned from server
      let createdInterviewId: string | undefined;
      try {
        const interviews = (updatedApplicant as any)?.interviews || [];
        createdInterviewId = interviews.find((iv: any) => {
          if (!iv) return false;
          // match by scheduledAt, type and notes as best-effort
          return (
            (iv.scheduledAt === interviewData.scheduledAt) &&
            (iv.type === interviewData.type) &&
            ((iv.notes || '') === (interviewData.notes || ''))
          );
        })?._id;
      } catch (e) {
        // ignore
      }

      // Third: set the interview status to 'scheduled' on the created interview (wait for server) if we found it
      if (createdInterviewId) {
        await updateInterviewMutation.mutateAsync({
          applicantId: id!,
          interviewId: createdInterviewId,
          data: { status: 'scheduled' },
        });
      }

      // Notifications: if email channel selected, send email and save message
      if (notificationChannels.email) {
        try {
          // Ensure Quill HTML has basic inline styles for email clients
          const inlineStyleHtml = (html: string) => {
            if (!html) return '';
            let out = String(html);
            // style paragraphs
            out = out.replace(/<p(?![^>]*style)/g, '<p style="margin:0 0 12px;color:#444;">');
            // style unordered lists
            out = out.replace(/<ul(?![^>]*style)/g, '<ul style="margin:0 0 12px 18px;padding-left:18px;">');
            // style ordered lists
            out = out.replace(/<ol(?![^>]*style)/g, '<ol style="margin:0 0 12px 18px;padding-left:18px;">');
            // style list items
            out = out.replace(/<li(?![^>]*style)/g, '<li style="margin-bottom:6px;">');
            return out;
          };

          // Remove interview details that may be duplicated inside the message template
          const sanitizeMessageTemplate = (htmlOrText: string) => {
            if (!htmlOrText) return '';
            let out = String(htmlOrText);

            // Remove any blockquote sections
            out = out.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '');

            // If it's HTML, try removing a paragraph titled 'Interview Details' and following list
            if (out.indexOf('<') !== -1) {
              // Remove <p>Interview Details</p> plus following <ul> or <ol>
              out = out.replace(/<p[^>]*>\s*Interview Details\s*<\/p>\s*(?:<ul[\s\S]*?<\/ul>|<ol[\s\S]*?<\/ol>)/i, '');
              // Remove any remaining list items that contain Date:, Time:, Type:, Location:, Link:
              out = out.replace(/<li[^>]*>\s*(?:Date|Time|Type|Location|Link):[\s\S]*?<\/li>/gi, '');
              // Also remove standalone paragraphs that start with 'Interview Details' or bullets
              out = out.replace(/<p[^>]*>\s*(?:Interview Details|•|\-|\*)[\s\S]*?<\/p>/gi, '');

              // Remove leading encoded or literal '>' inside paragraph starts (e.g. <p>&gt;Text</p> or <p>>Text</p>)
              out = out.replace(/(<(p|div|li|span)[^>]*>)\s*(?:&gt;|>)+\s*/gi, '$1');
            } else {
              // Plain text: remove 'Interview Details' block and following lines starting with bullets or labels
              out = out.replace(/Interview Details[\s\S]*?(?=\n\s*\n|$)/i, '');
              out = out.replace(/(^|\n)\s*[•\-*]\s*(Date|Time|Type|Location|Link):.*(?=\n|$)/gi, '');
            }

            // Remove any leading quote-lines in plain text (lines starting with >)
            out = out.replace(/(^|\n)\s*>+\s*/g, '$1');
            // Remove HTML encoded greater-than markers at line starts
            out = out.replace(/(^|\n)\s*&gt;+\s*/gi, '$1');

            // Remove a leading greeting like "Dear Name," if it's the very first content — avoids duplicate greetings
            out = out.replace(/^\s*(?:<p[^>]*>\s*)?(Dear\s+[A-Za-z0-9\-\s,.]{1,80}[,:]?)(?:<\/p>\s*)?/i, '');

            return out.trim();
          };

          const toEmail = emailOption === 'custom' ? customEmail || applicant.email : applicant.email;
          const fromEmail = companyObj?.email ? `${companyObj?.name || 'Company'} <${companyObj?.email}>` : 'Valora HR <hr@valora-rs.com>';
          const subject = interviewEmailSubject || `Interview Invitation`;

              const sanitizedBody = sanitizeMessageTemplate(messageTemplate || '');


            const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px; margin: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${subject}</h1>
    </div>
    <div style="padding: 30px;">
      <div style="font-size: 16px; line-height: 1.6; color: #444;">
        ${inlineStyleHtml(sanitizedBody || '')}
      </div>
    </div>
  </div>
</body>
</html>
`;

          // Send email via mutation
          await sendEmailMutation.mutateAsync({
            to: toEmail,
            from: fromEmail,
            subject,
            html: emailHtml,
          });
        } catch (err: any) {
          const errMsg = getErrorMessage(err);
          console.error('Error sending interview notification:', err);
          setInterviewError(errMsg);
          await Swal.fire({
            title: 'Notification Error',
            text: String(errMsg),
            icon: 'error',
          });
        }
      }

      // Show success (scheduled and notifications handled)
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

  
    

  // Form handler: add an internal comment to the applicant
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

      // API call (optimistic)
      addCommentMutation.mutate({ id: id!, data: commentData });

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

  // Form handler: change applicant status
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

      // Update status via React Query mutation (optimistic)
      updateStatusMutation.mutate({ id: id!, data: statusData });

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

  // UI helper: map applicant status to Tailwind color classes for badges
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

  // Render loading state while applicant data is being fetched
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

  // Render an error state when applicant cannot be loaded
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

  // Small utility to format dates for display in the UI
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
        {/* Top actions: back button, status/change actions, schedule/send/add comment buttons */}
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
            {/* <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const promises: Promise<any>[] = [];
                    if (isApplicantFetched && refetchApplicant) promises.push(refetchApplicant());
                    if (isJobPositionsFetched && refetchJobPositions) promises.push(refetchJobPositions());
                    if (isJobPositionDetailFetched && refetchJobPositionDetail) promises.push(refetchJobPositionDetail());
                    if (isJobPosCompanyFetched && refetchJobPosCompany) promises.push(refetchJobPosCompany());
                    if (isCompaniesWithApplicantsFetched && refetchCompaniesWithApplicants) promises.push(refetchCompaniesWithApplicants());
                    if (promises.length === 0) return;
                    await Promise.all(promises);
                    setLastRefetch(new Date());
                  } catch (e) {
                    // ignore
                  }
                }}
                disabled={isApplicantFetching || isJobPositionsFetching || isJobPositionDetailFetching || isJobPosCompanyFetching || isCompaniesWithApplicantsFetching}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
              >
                {(isApplicantFetching || isJobPositionsFetching || isJobPositionDetailFetching || isJobPosCompanyFetching || isCompaniesWithApplicantsFetching) ? 'Updating Data' : 'Update Data'}
              </button>
              <div className="ml-2 text-sm text-gray-500">{elapsed ? `Last Update: ${elapsed}` : 'Not updated yet'}</div>
            </div> */}
            <button
              onClick={() => setShowCommentModal(true)}
              className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-gray-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-gray-700"
            >
              <PlusIcon className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Add</span> Comment
            </button>
          </div>
        </div>

        {/* Personal Information Card
          Renders profile header, photo, name, contact details, job/company/department, address, status, submission date and resume actions */}
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
        {/* Full Name: applicant full name, supports RTL for Arabic */}
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

        {/* Email: clickable mailto link when available */}
        <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-blue-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
          <div className="flex items-baseline gap-4">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Email</Label>
            {applicant.email ? (
              <a
                href={`mailto:${applicant.email}?subject=${encodeURIComponent('Regarding your application')}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Send email to ${applicant.email}`}
                className="text-sm text-gray-900 dark:text-white break-words"
              >
                {applicant.email}
              </a>
            ) : (
              <p className="text-sm text-gray-900 dark:text-white">-</p>
            )}
          </div>
        </div>

        {/* Phone: clickable WhatsApp link when available */}
        <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-green-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
          <div className="flex items-baseline gap-4">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Phone</Label>
            {applicant.phone ? (
              <a
                href={`https://wa.me/${(applicant.phone || '').toString().replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open WhatsApp chat with ${applicant.phone}`}
                className="text-sm text-gray-900 dark:text-white"
              >
                {applicant.phone}
              </a>
            ) : (
              <p className="text-sm text-gray-900 dark:text-white">-</p>
            )}
          </div>
        </div>

          {/* Birth Date: applicant birth date */}
          <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-teal-400 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
            <div className="flex items-baseline gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded-lg group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Birth Date</Label>
              <p className="text-sm text-gray-900 dark:text-white">{(() => {
                const bd = getBirthDateValue();
                return bd ? new Date(bd).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
              })()}</p>
            </div>
          </div>

          {/* Gender: applicant gender */}
          <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-pink-400 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
            <div className="flex items-baseline gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-pink-100 dark:bg-pink-900/30 rounded-lg group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-pink-600 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
                </svg>
              </div>
              <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Gender</Label>
              <p className="text-sm text-gray-900 dark:text-white">{(() => {
                const g = getGenderValue();
                return g ? normalizeGenderLocal(g) : '-';
              })()}</p>
            </div>
          </div>

          {/* Job Position: resolved title from job position or lookup */}
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

        {/* Company: resolved company name from job position, applicant or lookup */}
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

        {/* Department: resolved department name if available */}
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

        {/* Address: applicant-provided address */}
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

        {/* Status: shows current applicant status badge */}
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

        {/* Submitted: timestamp when application was submitted */}
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

        {/* Resume: download CV and related actions */}
        {applicant.cvFilePath && (
          <div className="group relative pl-5 pr-5 py-5 bg-gradient-to-br from-brand-500 to-brand-600 dark:from-brand-600 dark:to-brand-700 backdrop-blur-sm rounded-xl border-l-4 border-brand-700 hover:shadow-2xl transition-all duration-200">
            <div className="flex items-baseline gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <Label className="text-xs text-white/80 font-bold uppercase">Resume</Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={downloadCv}
                  className="inline-flex items-center gap-2 text-sm font-bold text-white hover:text-white/90 transition-colors"
                >
                  Download CV
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
</div>

        <CustomResponses applicant={applicant} />

        
        

      {/* Activity timeline (status, messages, comments, interviews) */}
      <StatusHistory applicant={applicant} loading={loading} />

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
      
            {/* Interview Schedule Modal (moved to separate component) */}
            <InterviewScheduleModal
              isOpen={showInterviewModal}
              onClose={() => {
                setShowInterviewModal(false);
                setInterviewError('');
                setInterviewForm({ date: '', time: '', description: '', comment: '', location: '', link: '', type: 'phone' });
                setFormResetKey(prev => prev + 1);
              }}
              formResetKey={formResetKey}
              interviewForm={interviewForm}
              setInterviewForm={setInterviewForm}
              interviewError={interviewError}
              setInterviewError={setInterviewError}
              handleInterviewSubmit={handleInterviewSubmit}
              fillCompanyAddress={fillCompanyAddress}
              notificationChannels={notificationChannels}
              setNotificationChannels={setNotificationChannels}
              emailOption={emailOption}
              setEmailOption={setEmailOption}
              customEmail={customEmail}
              setCustomEmail={setCustomEmail}
              phoneOption={phoneOption}
              setPhoneOption={setPhoneOption}
              customPhone={customPhone}
              setCustomPhone={setCustomPhone}
              messageTemplate={messageTemplate}
              setMessageTemplate={setMessageTemplate}
              interviewEmailSubject={interviewEmailSubject}
              setInterviewEmailSubject={setInterviewEmailSubject}
              isSubmittingInterview={isSubmittingInterview}
              setIsSubmittingInterview={setIsSubmittingInterview}
              setShowPreviewModal={setShowPreviewModal}
              setPreviewHtml={setPreviewHtml}
              buildInterviewEmailHtml={buildInterviewEmailHtml}
              getJobTitle={getJobTitle}
              applicant={applicant}
            />

      <InterviewSettingsModal
        isOpen={showInterviewSettingsModal}
        onClose={() => {
          setShowInterviewSettingsModal(false);
          setSelectedInterview(null);
        }}
        applicant={applicant}
        selectedInterview={selectedInterview}
        setSelectedInterview={setSelectedInterview}
        setShowInterviewSettingsModal={setShowInterviewSettingsModal}
        updateInterviewMutation={updateInterviewMutation}
      />
      {/* Preview Email Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => {
          setShowPreviewModal(false);
          setPreviewHtml('');
        }}
        className="max-w-2xl p-6"
      >
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Email Preview</h2>
          <div className="border rounded p-4 bg-white dark:bg-gray-800" style={{ maxHeight: '70vh', overflow: 'auto' }}>
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowPreviewModal(false)}
              className="rounded-lg border border-stroke px-4 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
      <MessageModal isOpen={showMessageModal} onClose={() => setShowMessageModal(false)} applicant={applicant} id={applicant._id} />
      <CommentModal
        isOpen={showCommentModal}
        onClose={() => {
          setShowCommentModal(false);
          setCommentError('');
        }}
        commentForm={commentForm}
        setCommentForm={setCommentForm}
        commentError={commentError}
        setCommentError={setCommentError}
        handleCommentSubmit={handleCommentSubmit}
        isSubmittingComment={isSubmittingComment}
      />

      <StatusChangeModal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setStatusError('');
        }}
        statusForm={statusForm}
        setStatusForm={setStatusForm}
        statusError={statusError}
        setStatusError={setStatusError}
        handleStatusChange={handleStatusChange}
        isSubmittingStatus={isSubmittingStatus}
        statusOptions={statusOptions}
      />
    </>
  );
};

export default ApplicantData;
