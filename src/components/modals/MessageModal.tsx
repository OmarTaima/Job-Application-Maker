import Swal from '../../utils/swal';
import { Modal } from '../ui/modal';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useSendMessage, useSendEmail, useCompany, useJobPositions } from '../../hooks/queries';
import { getErrorMessage } from '../../utils/errorHandler';
import { companiesService } from '../../services/companiesService';
import Label from '../form/Label';
import Select from '../form/Select';
import Input from '../form/input/InputField';
import TextArea from '../form/input/TextArea';
import { EmailTemplate } from '../../services/emailTemplatesService';

import 'quill/dist/quill.snow.css';

function QuillEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<any>(null);
  const onChangeRef = useRef<(v: string) => void>(onChange);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    let mounted = true;
    if (!containerRef.current) return;
    (async () => {
      const QuillModule = await import('quill');
      const Quill = (QuillModule as any).default ?? QuillModule;
      if (!mounted || !containerRef.current) return;
      quillRef.current = new Quill(containerRef.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link'],
          ],
        },
      });
      quillRef.current.root.innerHTML = value || '';
      const handleChange = () => onChangeRef.current(quillRef.current.root.innerHTML);
      quillRef.current.on('text-change', handleChange);
    })();

    return () => {
      mounted = false;
      if (quillRef.current) {
        try {
          quillRef.current.off && quillRef.current.off('text-change');
        } catch (e) {
          /* ignore */
        }
        quillRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (quillRef.current && quillRef.current.root && quillRef.current.root.innerHTML !== value) {
      quillRef.current.root.innerHTML = value || '';
    }
  }, [value]);

  return <div className="border rounded bg-white dark:bg-gray-800" style={{ minHeight: 120 }} ref={containerRef} />;
}

const MessageModal = ({
  isOpen,
  onClose,
  applicant,
  id,
  company: propCompany,
}: {
  isOpen: boolean;
  onClose: () => void;
  applicant: any;
  id: string;
  company?: any;
}) => {
  const [messageForm, setMessageForm] = useState({
    subject: '',
    body: '',
    type: 'email' as 'email' | 'sms' | 'whatsapp' | 'internal',
  });
  const [messageError, setMessageError] = useState('');
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Sender selection states
  const [senderOption, setSenderOption] = useState<'company' | 'available' | 'custom'>('company');
  const [customSender, setCustomSender] = useState('');
  const [newLocalEmail, setNewLocalEmail] = useState('');
  const [senderOptions, setSenderOptions] = useState<Array<{ value: string; label: string }>>([]);

  const companyIdForQuery = (applicant && (typeof applicant.companyId === 'string' ? applicant.companyId : applicant.company?._id)) || '';
  const { data: companyFromQuery } = useCompany(companyIdForQuery || '', { enabled: !!companyIdForQuery });

  const company = propCompany || (applicant && (applicant.company || applicant.companyObj)) || companyFromQuery || null;

  // Get email templates directly from the company object
  const emailTemplates: EmailTemplate[] = useMemo(() => {
    // Extract templates from company.settings.mailSettings.emailTemplates
    const templates = company?.settings?.mailSettings?.emailTemplates || [];
    return templates;
  }, [company]);

  const { data: jobPositions = [] } = useJobPositions(companyIdForQuery ? [companyIdForQuery] : undefined as any);
  const jobTitleById = useMemo(() => {
    const map = new Map<string, string>();
    (jobPositions || []).forEach((j: any) => {
      const id = (j && (j._id || j.id)) || undefined;
      if (!id) return;
      map.set(id, toDisplayText((j as any)?.title || (j as any)?.name, ''));
    });
    return map;
  }, [jobPositions]);

  const extractDomain = (email?: string | null) => {
    if (!email) return '';
    const parts = String(email).split('@');
    return parts.length > 1 ? parts.slice(1).join('@') : '';
  };

  useEffect(() => {
    if (company) {
      try {
        console.debug('MessageModal - company structure:', JSON.stringify(company, null, 2));
      } catch (e) {
        /* ignore */
      }
    }
  }, [company]);

  const getCompanyDomain = () => {
    if (!company) return '';
    if (company?.settings?.mailSettings?.companyDomain) return company.settings.mailSettings.companyDomain;
    if (company?.company?.settings?.mailSettings?.companyDomain) return company.company.settings.mailSettings.companyDomain;
    if (company?.mailSettings?.companyDomain) return company.mailSettings.companyDomain;

    const defaultMail =
      company?.settings?.mailSettings?.defaultMail ||
      company?.company?.settings?.mailSettings?.defaultMail ||
      company?.mailSettings?.defaultMail ||
      company?.defaultMail ||
      company?.contactEmail ||
      company?.email ||
      '';
    if (defaultMail && defaultMail.includes('@')) return defaultMail.split('@')[1];

    const firstAvailableMail =
      company?.settings?.mailSettings?.availableMails?.[0] ||
      company?.company?.settings?.mailSettings?.availableMails?.[0] ||
      company?.mailSettings?.availableMails?.[0] ||
      '';
    if (firstAvailableMail && firstAvailableMail.includes('@')) return firstAvailableMail.split('@')[1];

    return '';
  };

  const companyDomain = getCompanyDomain();
  const [resolvedCompanyDomain, setResolvedCompanyDomain] = useState('');

  useEffect(() => {
    if (company) {
      const domain = getCompanyDomain();
      if (domain) {
        setResolvedCompanyDomain(domain);
      }
    }
  }, [company]);

  const displayDomain =
    resolvedCompanyDomain ||
    companyDomain ||
    extractDomain(company?.mailSettings?.defaultMail) ||
    extractDomain(customSender) ||
    (senderOptions && senderOptions.length > 0 ? extractDomain(senderOptions[0].value) : '');

  // Handle template selection - this populates subject and body
 // Replace your handleTemplateSelect function with this optimized version
const handleTemplateSelect = (templateId: string) => {
  if (!templateId) {
    setSelectedTemplateId('');
    return;
  }
  
  const selectedTemplate = emailTemplates.find((t: EmailTemplate) => t._id === templateId);
  if (selectedTemplate) {
    // Decode HTML entities if needed
    let decodedHtml = selectedTemplate.html;
    try {
      decodedHtml = decodedHtml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    } catch (e) {
      decodedHtml = selectedTemplate.html;
    }
    
    // Update both fields at once to prevent multiple re-renders
    setMessageForm(prev => ({
      ...prev,
      subject: selectedTemplate.subject,
      body: decodedHtml,
    }));
    setSelectedTemplateId(templateId);
    
    // Remove the Swal notification to avoid extra re-renders
    // Just show a subtle indication instead
  }
};

  useEffect(() => {
    let mounted = true;
    if (!isOpen) {
      setSenderOptions([]);
    }
    if (!isOpen) return;

    (async () => {
      try {
        let raw = company ?? null;
        let normalized = raw && raw.company && typeof raw.company === 'object' ? raw.company : raw;

        if (!normalized && companyIdForQuery) {
          try {
            const comp = await companiesService.getCompanySettingsByCompany(companyIdForQuery);
            if (comp) {
              raw = comp as any;
              normalized = comp as any;
            }
          } catch (innerErr) {
            // ignore
          }
        }

        const availableCandidates: any[] = [];
        try {
          if (Array.isArray(normalized?.mailSettings?.availableMails)) { availableCandidates.push(...normalized.mailSettings.availableMails); }
          if (normalized && typeof normalized === 'object' && normalized.mailSettings && Array.isArray((normalized.mailSettings as any)?.available_senders)) {
            availableCandidates.push(...(normalized.mailSettings as any).available_senders);
          }
          if (normalized?.mailSettings && typeof normalized.mailSettings === 'object' && Array.isArray((normalized.mailSettings as any).availableSenders)) {
            availableCandidates.push(...(normalized.mailSettings as any).availableSenders);
          }
          if (normalized && typeof normalized === 'object' && 'settings' in normalized && normalized.settings && typeof normalized.settings === 'object' && 'mailSettings' in normalized.settings && normalized.settings.mailSettings && typeof normalized.settings.mailSettings === 'object' && Array.isArray((normalized.settings.mailSettings as any)?.availableMails)) {
            availableCandidates.push(...(normalized.settings.mailSettings as any).availableMails);
          }
          if (normalized && typeof normalized === 'object' && 'availableMails' in normalized && Array.isArray((normalized as any).availableMails)) {
            availableCandidates.push(...(normalized as any).availableMails);
          }
          if (normalized && typeof normalized === 'object' && 'available_senders' in normalized && Array.isArray((normalized as any).available_senders)) {
            availableCandidates.push(...(normalized as any).available_senders);
          }
        } catch (e) { /* ignore */ }

        const deduped: Array<{ value: string; label: string }> = [];
        const seen = new Set<string>();
        availableCandidates.forEach((mitem: any) => {
          let email = '';
          if (!mitem) return;
          if (typeof mitem === 'string') email = String(mitem).trim();
          else if (typeof mitem === 'object') {
            email = String(mitem.email || mitem.address || mitem.value || mitem.addressEmail || mitem.contact || '').trim();
          }
          if (!email) return;
          if (seen.has(email)) return;
          seen.add(email);
          deduped.push({ value: email, label: email });
        });

        try {
          const c = raw && (raw.company || raw);
          if (c && typeof c === 'object') {
            if ('settings' in c && c.settings && typeof c.settings === 'object' && 'mailSettings' in c.settings && c.settings.mailSettings && typeof c.settings.mailSettings === 'object' && Array.isArray((c.settings.mailSettings as any)?.availableMails)) {
              ((c.settings.mailSettings as any)?.availableMails ?? []).forEach((em: any) => { if (!seen.has(em)) { seen.add(em); deduped.push({ value: em, label: em }); } });
            }
            if ('mailSettings' in c && c.mailSettings && typeof c.mailSettings === 'object' && Array.isArray(c.mailSettings.availableMails)) {
              c.mailSettings.availableMails.forEach((em: any) => { if (!seen.has(em)) { seen.add(em); deduped.push({ value: em, label: em }); } });
            }
            if ('availableMails' in c && Array.isArray(c.availableMails)) {
              c.availableMails.forEach((em: any) => { if (!seen.has(em)) { seen.add(em); deduped.push({ value: em, label: em }); } });
            }
          }
        } catch (e) { /* ignore */ }

        const fallbackEmail = normalized?.mailSettings?.defaultMail || normalized?.defaultMail || normalized?.contactEmail || normalized?.email || '';
        
        if (fallbackEmail && !seen.has(fallbackEmail)) {
          deduped.push({ value: fallbackEmail, label: fallbackEmail });
          seen.add(fallbackEmail);
        }

        try {
          const domainFromSettings =
            normalized?.settings?.mailSettings?.companyDomain ||
            normalized?.mailSettings?.companyDomain ||
            normalized?.company?.settings?.mailSettings?.companyDomain ||
            extractDomain(normalized?.settings?.mailSettings?.defaultMail) ||
            extractDomain(normalized?.mailSettings?.defaultMail) ||
            '';
          if (domainFromSettings) {
            setResolvedCompanyDomain(domainFromSettings);
          }
        } catch (e) { /* ignore */ }

        setSenderOptions(deduped);
        const defaultMail = normalized?.mailSettings?.defaultMail || normalized?.settings?.mailSettings?.defaultMail || normalized?.defaultMail || '';
        setCustomSender(defaultMail || (deduped[0] && deduped[0].value) || '');
        if (deduped.length > 0) setSenderOption('available');
        else setSenderOption('company');
      } catch (e) {
        if (!mounted) return;
        setSenderOptions([]);
        setCustomSender('');
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, companyIdForQuery, company]);

  const sendMessageMutation = useSendMessage();
  const sendEmailMutation = useSendEmail();

  const buildEmailHtml = (subject: string, body: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px; margin: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #ffffff; border-bottom: 1px solid #e5e7eb; padding: 24px 30px; text-align: center;">
      <h1 style="color: #111827; margin: 0; font-size: 22px; font-weight: 700;">${escapeHtml(subject)}</h1>
    </div>
    <div style="padding: 30px;">
      <div style="font-size: 16px; line-height: 1.6; color: #444;">
        ${body || ''}
      </div>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;"/>
    </div>
  </div>
</body>
</html>
`;

  const escapeHtml = (str: string) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  function toDisplayText(value: unknown, fallback = ''): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || fallback;
    }
    if (value && typeof value === 'object') {
      const localized = value as { en?: unknown; ar?: unknown; name?: unknown; title?: unknown };
      const candidates = [localized.en, localized.ar, localized.name, localized.title];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      }
    }
    return fallback;
  }

  const getCandidateName = () => {
    if (!applicant) return 'Candidate';
    const rawName =
      (applicant.fullName && String(applicant.fullName).trim()) ||
      (applicant.applicantName && String(applicant.applicantName).trim()) ||
      (applicant.name && String(applicant.name).trim()) ||
      ((String(applicant.firstName || '') + ' ' + String(applicant.lastName || '')).trim()) ||
      (applicant.email && String(applicant.email).split('@')[0]) ||
      'Candidate';
    return String(rawName).trim() || 'Candidate';
  };

  const getJobTitleFromApplicant = (): string => {
    if (!applicant) return '';
    try {
      const jp = (applicant as any)?.jobPositionId || (applicant as any)?.jobPosition;
      if (jp) {
        if (typeof jp === 'string' && jp.trim()) {
          const mapped = jobTitleById.get(jp.trim());
          if (mapped) return mapped;
        }
        if (typeof jp === 'object') {
          const id = jp._id || jp.id;
          if (id) {
            const mapped = jobTitleById.get(id as string);
            if (mapped) return mapped;
          }
        }
      }
    } catch (e) {
      /* ignore */
    }

    const titleFromJobPositionId = toDisplayText((applicant as any)?.jobPositionId?.title || (applicant as any)?.jobPositionId?.name, '');
    if (titleFromJobPositionId) return titleFromJobPositionId;
    const titleFromJobPosition = toDisplayText((applicant as any)?.jobPosition?.title || (applicant as any)?.jobPosition?.name, '');
    if (titleFromJobPosition) return titleFromJobPosition;
    return '';
  };

  const escapeRegex = (s: string) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const buildInterleavedRegex = (token: string) => {
    const chars = String(token || '').split('');
    const part = chars.map((ch) => escapeRegex(ch) + '(?:<[^>]+>|\\s|&nbsp;|&#160;)*').join('');
    return new RegExp('\\{\\{\\s*' + part + '\\s*\\}\\}', 'gi');
  };

  const applyTemplateToHtml = (html: string) => {
    if (!html) return '';
    const nameEsc = escapeHtml(getCandidateName());
    const jobEsc = escapeHtml(getJobTitleFromApplicant());
    let out = String(html);
    out = out.replace(buildInterleavedRegex('candidateName'), nameEsc);
    out = out.replace(buildInterleavedRegex('position'), jobEsc);
    out = out.replace(buildInterleavedRegex('jobTitle'), jobEsc);
    return out;
  };

  const applyTemplateToPlain = (plain: string) => {
    if (!plain) return '';
    return String(plain)
      .replace(/\{\{\s*candidateName\s*\}\}/gi, getCandidateName())
      .replace(/\{\{\s*(?:position|jobTitle)\s*\}\}/gi, getJobTitleFromApplicant());
  };

  const handlePreviewEmail = () => {
    if (messageForm.type !== 'email') return;
    if (!messageForm.body?.trim()) {
      setMessageError('Message body is required to preview email');
      return;
    }

    const subjectForPreview = messageForm.subject?.trim() || 'No Subject';
    const substitutedSubject = applyTemplateToPlain(subjectForPreview);
    const substitutedBody = applyTemplateToHtml(messageForm.body || '');
    const html = buildEmailHtml(substitutedSubject, substitutedBody);
    setPreviewHtml(html);
    setShowEmailPreview(true);
  };

  const handleCloseMessageModal = () => {
    onClose();
    setMessageError('');
    setShowEmailPreview(false);
    setPreviewHtml('');
    setSelectedTemplateId('');
    setMessageForm({ subject: '', body: '', type: 'email' });
  };

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !applicant) return;

    if (messageForm.type === 'email' && !messageForm.subject?.trim()) {
      setMessageError('Subject is required when sending an email');
      return;
    }
    if (!messageForm.body?.trim()) {
      setMessageError('Message body is required');
      return;
    }

    setIsSubmittingMessage(true);

    try {
      if (messageForm.type === 'email') {
        const candidateName = getCandidateName();
        const jobTitle = getJobTitleFromApplicant();

        let substitutedSubject = messageForm.subject || '';
        substitutedSubject = substitutedSubject
          .replace(/\{\{\s*candidateName\s*\}\}/gi, candidateName)
          .replace(/\{\{\s*(?:position|jobTitle)\s*\}\}/gi, jobTitle);
        
        let substitutedBody = messageForm.body || '';
        substitutedBody = substitutedBody
          .replace(/\{\{\s*candidateName\s*\}\}/gi, candidateName)
          .replace(/\{\{\s*(?:position|jobTitle)\s*\}\}/gi, jobTitle);
        
        const emailHtml = buildEmailHtml(substitutedSubject, substitutedBody);
        
        const mailDefault = company?.mailSettings?.defaultMail || company?.email || '';
        let fromAddr = '';

        if (senderOption === 'custom' && newLocalEmail && newLocalEmail.trim()) {
          const local = newLocalEmail.trim();
          const domainToUse = resolvedCompanyDomain || companyDomain;
          if (!domainToUse) {
            setMessageError('Company domain not configured');
            setIsSubmittingMessage(false);
            return;
          }
          fromAddr = `${local}@${domainToUse}`;
        } else if (senderOption === 'available' && customSender) {
          fromAddr = customSender;
        } else {
          fromAddr = mailDefault || '';
        }
        
        const companyConfig = (typeof fromAddr === 'string' && fromAddr.includes('<')) 
          ? fromAddr.replace(/.*<\s*([^>]+)\s*>.*/, '$1') 
          : String(fromAddr).replace(/[<>]/g, '');

        const companyToSend = (company && (company._id || (company as any).id)) || companyIdForQuery || undefined;
        let jobPositionId = applicant?.jobPositionId || (applicant?.jobPosition && typeof applicant.jobPosition === 'object' ? applicant.jobPosition._id : applicant?.jobPosition);
        
        if (jobPositionId && typeof jobPositionId === 'object') {
          jobPositionId = jobPositionId._id || jobPositionId.id || String(jobPositionId);
        }

        await sendEmailMutation.mutateAsync({
          company: companyToSend,
          applicant: applicant?._id,
          to: applicant.email,
          from: companyConfig,
          subject: substitutedSubject,
          html: emailHtml,
          jobPosition: typeof jobPositionId === 'string' ? jobPositionId : undefined,
        } as any);
        
        await sendMessageMutation.mutateAsync({
          id,
          data: {
            type: messageForm.type,
            content: substitutedBody,
          },
        });

        setMessageForm({ subject: '', body: '', type: 'email' });
        onClose();

        await Swal.fire({
          title: 'Success!',
          text: 'Email sent and saved to history.',
          icon: 'success',
          position: 'center',
          timer: 2000,
          showConfirmButton: false,
          customClass: {
            container: '!mt-16',
          },
        });
      }
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      setMessageError(errorMsg);
      console.error('Error:', err);
    } finally {
      setIsSubmittingMessage(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleCloseMessageModal}
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
                { value: 'email', label: '📧 Email (Will be sent & saved)' },
                { value: 'sms', label: '💬 SMS (Soon)' },
                { value: 'whatsapp', label: '📱 WhatsApp (Soon)' },
              ]}
              value={messageForm.type}
              placeholder="Select message type"
              onChange={(value) =>
                setMessageForm({
                  ...messageForm,
                  type: value as 'email' | 'sms' | 'whatsapp',
                  subject: value !== 'email' ? '' : messageForm.subject,
                })
              }
            />
            {messageForm.type === 'email' && (
              <p className="mt-1 text-xs text-green-600">
                ✓ Email will be sent via email service AND saved to message history
              </p>
            )}
          </div>

          {/* Template Selector - Only for email */}
          {messageForm.type === 'email' && emailTemplates.length > 0 && (
            <div>
              <Label htmlFor="template-select">Load Template</Label>
              <Select
                options={[
                  { value: '', label: '-- Select a template --' },
                  ...emailTemplates.map((t: EmailTemplate) => ({ 
                    value: t._id || '', 
                    label: t.name 
                  }))
                ]}
                value={selectedTemplateId}
                onChange={(value) => handleTemplateSelect(value as string)}
                placeholder="Select a template to load"
              />
              <p className="mt-1 text-xs text-gray-500">
                Select a template to automatically fill the subject and body
              </p>
            </div>
          )}

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
              <p className="mt-1 text-xs text-gray-500">
                Available variables: {'{{candidateName}}'}, {'{{position}}'} or {'{{jobTitle}}'}
              </p>
            </div>
          )}

          {messageForm.type === 'email' && (
            <div>
              <Label>Sender</Label>
              <div className="space-y-2">
                <Select
                  options={[
                    { value: 'available', label: 'Company mails' },
                    { value: 'custom', label: 'New Mail' },
                  ]}
                  value={senderOption}
                  onChange={(v: any) => setSenderOption(v)}
                  placeholder="Select sender option"
                />

                {senderOption === 'available' && (
                  <Select
                    options={senderOptions.length > 0 ? senderOptions : [{ value: '', label: 'No available senders' }]}
                    value={customSender || (senderOptions[0] && senderOptions[0].value) || ''}
                    onChange={(v: any) => {
                      setCustomSender(v);
                    }}
                    placeholder="Select sender"
                  />
                )}

                {senderOption === 'custom' && (
                  <div className="flex items-center gap-2">
                    <Input value={newLocalEmail} onChange={(e) => setNewLocalEmail(e.target.value)} placeholder="your-name" />
                    <div className="text-sm text-gray-600">@{displayDomain}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {messageForm.type === 'email' && (
            <div>
              <Label>Selected Sender</Label>
              <Input
                value={
                  senderOption === 'custom' && newLocalEmail
                    ? `${newLocalEmail}@${(resolvedCompanyDomain || companyDomain) || displayDomain}`
                    : customSender || ''
                }
                readOnly
                placeholder="No sender selected"
                className={!resolvedCompanyDomain && !companyDomain ? 'border-amber-300' : ''}
              />
              {!resolvedCompanyDomain && !companyDomain && senderOption === 'custom' && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ No company domain configured. Please add a sender from Company Settings first.
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="message-body">Message *</Label>
            {messageForm.type === 'email' ? (
              <>
                <QuillEditor
                  value={messageForm.body}
                  onChange={(content) => setMessageForm({ ...messageForm, body: content })}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Available variables: {'{{candidateName}}'}, {'{{position}}'} or {'{{jobTitle}}'}
                </p>
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                  <strong>Quick Insert:</strong>{' '}
                  <button 
                    type="button"
                    onClick={() => setMessageForm({ ...messageForm, body: messageForm.body + '{{candidateName}}' })}
                    className="text-blue-600 hover:underline mx-1"
                  >
                    {'{{candidateName}}'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setMessageForm({ ...messageForm, body: messageForm.body + '{{position}}' })}
                    className="text-blue-600 hover:underline mx-1"
                  >
                    {'{{position}}'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setMessageForm({ ...messageForm, body: messageForm.body + '{{jobTitle}}' })}
                    className="text-blue-600 hover:underline mx-1"
                  >
                    {'{{jobTitle}}'}
                  </button>
                </div>
              </>
            ) : (
              <TextArea
                value={messageForm.body}
                onChange={(value) =>
                  setMessageForm({ ...messageForm, body: value })
                }
                placeholder="Enter your message to the applicant"
                rows={5}
              />
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCloseMessageModal}
              className="rounded-lg border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
              disabled={isSubmittingMessage}
            >
              Cancel
            </button>
            {messageForm.type === 'email' && (
              <button
                type="button"
                onClick={handlePreviewEmail}
                className="rounded-lg border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
                disabled={isSubmittingMessage}
              >
                Preview Email
              </button>
            )}
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
                <span>
                  {messageForm.type === 'email'
                    ? 'Send Email & Save'
                    : 'Send Message'}
                </span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showEmailPreview}
        onClose={() => {
          setShowEmailPreview(false);
        }}
        className="max-w-3xl p-6"
      >
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Email Preview</h2>
          <div className="border rounded p-2 bg-white dark:bg-gray-800" style={{ maxHeight: '70vh', overflow: 'auto' }}>
            <iframe
              srcDoc={previewHtml}
              title="Message Email Preview"
              className="w-full min-h-[560px] rounded border-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowEmailPreview(false)}
              className="rounded-lg border border-stroke px-4 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default MessageModal;