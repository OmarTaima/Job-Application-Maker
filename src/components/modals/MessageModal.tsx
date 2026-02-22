import Swal from 'sweetalert2';
import { Modal } from '../ui/modal';
import { useState, useRef, useEffect } from 'react';
import { useSendMessage, useSendEmail, useCompany, useUpdateCompanySettings } from '../../hooks/queries'; // Add useSendEmail
import { getErrorMessage } from '../../utils/errorHandler';
import { companiesService } from '../../services/companiesService';
import Label from '../form/Label';
import Select from '../form/Select';
import Input from '../form/input/InputField';
import TextArea from '../form/input/TextArea';

import 'quill/dist/quill.snow.css';

function QuillEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    if (!containerRef.current) return;
    // dynamic import to avoid bundling issues
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
      quillRef.current.on('text-change', () => onChange(quillRef.current.root.innerHTML));
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

  // keep external value in sync
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

  // Sender selection states
  const [senderOption, setSenderOption] = useState<'company' | 'available' | 'custom'>('company');
  const [customSender, setCustomSender] = useState('');
  const [newLocalEmail, setNewLocalEmail] = useState('');
  const [senderOptions, setSenderOptions] = useState<Array<{ value: string; label: string }>>([]);

  // derive company and available senders from applicant; fallback to cached company by id
  const companyIdForQuery = (applicant && (typeof applicant.companyId === 'string' ? applicant.companyId : applicant.company?._id)) || '';
  const { data: companyFromQuery } = useCompany(companyIdForQuery || '', { enabled: !!companyIdForQuery });

  const company = propCompany || (applicant && (applicant.company || applicant.companyObj)) || companyFromQuery || null;

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

  // Determine company domain from multiple possible shapes. Prefer explicit companyDomain
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

  // update resolvedCompanyDomain when company prop/data changes
  useEffect(() => {
    if (company) {
      const domain = getCompanyDomain();
      if (domain) {
        setResolvedCompanyDomain(domain);
        try { console.debug('MessageModal - resolved company domain:', domain); } catch (e) { /* ignore */ }
      }
    }
  }, [company]);

  const displayDomain =
    resolvedCompanyDomain ||
    companyDomain ||
    extractDomain(company?.mailSettings?.defaultMail) ||
    extractDomain(customSender) ||
    (senderOptions && senderOptions.length > 0 ? extractDomain(senderOptions[0].value) : '');

  // fetch company settings and normalize available senders (copied from BulkMessageModal)
  useEffect(() => {
    let mounted = true;
    if (!isOpen) {
      setSenderOptions([]);
      // don't clear customSender so selected value persists while modal open
    }
    if (!isOpen) return;

    (async () => {
      try {
        let raw = company ?? null;
        let normalized = raw && raw.company && typeof raw.company === 'object' ? raw.company : raw;

        // If settings endpoint returned null/empty, fallback to fetching the company directly
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
          let name = '';
          if (!mitem) return;
          if (typeof mitem === 'string') email = String(mitem).trim();
          else if (typeof mitem === 'object') {
            email = String(mitem.email || mitem.address || mitem.value || mitem.addressEmail || mitem.contact || '').trim();
            name = String(mitem.name || mitem.label || mitem.displayName || '').trim();
          }
          if (!email) return;
          if (seen.has(email)) return;
          seen.add(email);
          deduped.push({ value: email, label: name ? `${name} <${email}>` : email });
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
        let companyName = '';
        if (normalized?.name) {
          if (typeof normalized.name === 'object' && 'en' in normalized.name) {
            companyName = normalized.name.en;
          } else if (typeof normalized.name === 'string') {
            companyName = normalized.name;
          }
        }
        if (fallbackEmail && !seen.has(fallbackEmail)) {
          deduped.push({ value: fallbackEmail, label: `${companyName || 'Company'} <${fallbackEmail}>` });
          seen.add(fallbackEmail);
        }

        // capture domain from normalized settings if available (check various paths)
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
            try { console.debug('MessageModal - found domain in settings:', domainFromSettings); } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }

        setSenderOptions(deduped);
        try { console.debug('MessageModal: resolved company/available senders', { normalized, raw, deduped, companyDomain }); } catch (e) { /* ignore */ }
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
  const sendEmailMutation = useSendEmail(); // New email mutation
  const updateCompanySettings = useUpdateCompanySettings();

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !applicant) return;

    // Validate required fields
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
      // 2. If it's an email, ALSO send via email service
      if (messageForm.type === 'email') {
        const mailDefault = company?.mailSettings?.defaultMail || company?.email || '';
        // determine 'from' address based on selection
        let fromAddr = '';

        // If user entered a new local email (senderOption === 'custom'), create full email and persist it
        if (senderOption === 'custom' && newLocalEmail && newLocalEmail.trim()) {
          const local = newLocalEmail.trim();
          // Use resolved domain (from fetched settings) first, then computed companyDomain
          const domainToUse = resolvedCompanyDomain || companyDomain;

          if (!domainToUse) {
            setMessageError('Company domain not configured. Please select an existing sender or configure company settings first.');
            setIsSubmittingMessage(false);
            return;
          }

          const newEmail = `${local}@${domainToUse}`;
          // Determine target company id (prefer `company._id`, fallback to applicant-derived id)
          const targetCompanyId = (company && (company._id || company.id || company.id === 0 ? (company._id || company.id) : undefined)) || companyIdForQuery || undefined;

          if (targetCompanyId) {
            try {
              // Fetch latest settings to avoid overwriting existing mails
              let latestSettings: any = null;
              try {
                latestSettings = await companiesService.getCompanySettingsByCompany(targetCompanyId) || null;
              } catch (e) {
                // ignore, we'll merge with whatever we have
              }

              const collectExisting = (obj: any): string[] => {
                const out: string[] = [];
                try {
                  if (!obj) return out;
                  const pushIfArray = (a: any) => { if (Array.isArray(a)) out.push(...a.filter(Boolean).map(String)); };
                  pushIfArray(obj?.mailSettings?.availableMails);
                  pushIfArray(obj?.settings?.mailSettings?.availableMails);
                  pushIfArray(obj?.availableMails);
                  pushIfArray(obj?.available_senders);
                  pushIfArray(obj?.availableSenders);
                  pushIfArray(obj?.mail?.availableMails);
                } catch (e) { /* ignore */ }
                return Array.from(new Set(out));
              };

              const existing = collectExisting(latestSettings || company);
              const merged = Array.from(new Set([...(existing || []), newEmail]));

              const findSettingsId = (obj: any): string | undefined => {
                if (!obj || typeof obj !== 'object') return undefined;
                if (obj.settings && obj.settings._id) return obj.settings._id;
                if (obj._id && typeof obj._id === 'string' && obj._id.match(/^[0-9a-fA-F]{24}$/)) return obj._id;
                if (obj.company && obj.company.settings && obj.company.settings._id) return obj.company.settings._id;
                if (obj.company && obj.company._id && typeof obj.company._id === 'string' && obj.company._id.match(/^[0-9a-fA-F]{24}$/)) return obj.company._id;
                if (obj.mailSettings && obj.mailSettings._id) return obj.mailSettings._id;
                for (const k of Object.keys(obj)) {
                  if (k.endsWith('_id') && typeof obj[k] === 'string' && obj[k].match(/^[0-9a-fA-F]{24}$/)) return obj[k];
                }
                return undefined;
              };

              const companySettingsId = (company && company.settings && (company.settings as any)._id) || undefined;
              const generatedSettingsId = companySettingsId ?? findSettingsId(latestSettings || company);
              const idToSend = generatedSettingsId ?? targetCompanyId; // fallback to company id
              try { console.debug('MessageModal.updateCompanySettings', { idToSend, merged, latestSettings, company }); } catch (e) { /* ignore */ }
              await updateCompanySettings.mutateAsync({ id: idToSend, data: { mailSettings: { availableMails: merged } } });

              // update local UI
              setSenderOptions((prev) => {
                if (prev.find(p => p.value === newEmail)) return prev;
                return [{ value: newEmail, label: newEmail }, ...prev];
              });
              setCustomSender(newEmail);
              fromAddr = newEmail;
            } catch (err: any) {
              setMessageError(getErrorMessage(err));
              setIsSubmittingMessage(false);
              return;
            }
          } else {
            fromAddr = newEmail;
          }
        } else if (senderOption === 'available' && customSender) {
          fromAddr = customSender;
        } else {
          fromAddr = mailDefault || '';
        }
        // Always use only the email address in the From header (no company name prefix)
        const companyConfig = typeof fromAddr === 'string' && fromAddr.includes('<') ? fromAddr : `<${fromAddr}>`;

        // Replace your current emailHtml with this:
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${messageForm.subject}</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px; margin: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${messageForm.subject}</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Dear ${applicant.fullName || 'Applicant'},</p>
      
        <div style="font-size: 16px; line-height: 1.6; color: #444;">
          ${messageForm.body || ''}
        </div>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;"/>
      
      <p style="color: #999; font-size: 12px; text-align: center;">
        This is an automated message from our HR system.<br/>
        Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
`;

        // Send email via new service
        // NOTE: disabled temporarily while verifying settings update behavior — re-enable after confirmation
        await sendEmailMutation.mutateAsync({
          to: applicant.email,
          from: companyConfig,
          subject: messageForm.subject,
          html: emailHtml,
        });
        console.debug('MessageModal: sendEmail skipped (testing). email payload would be:', { to: applicant.email, from: companyConfig, subject: messageForm.subject });
      }

      // 3. Save to messages (old functionality)
      // NOTE: disabled temporarily while verifying settings update behavior — re-enable after confirmation
      await sendMessageMutation.mutateAsync({
        id,
        data: {
          type: messageForm.type,
          content: messageForm.body,
        },
      });
      console.debug('MessageModal: saveMessage skipped (testing). message payload would be:', { id, type: messageForm.type });

      // Close and reset
      setMessageForm({ subject: '', body: '', type: 'email' });
      onClose();

      // Success message
      await Swal.fire({
        title: 'Success!',
        text:
          messageForm.type === 'email'
            ? 'Email sent and saved to history.'
            : 'Message sent successfully.',
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
      console.error('Error:', err);
    } finally {
      setIsSubmittingMessage(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
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
                subject: value !== 'email' ? '' : messageForm.subject, // Clear subject if not email
              })
            }
          />
          {messageForm.type === 'email' && (
            <p className="mt-1 text-xs text-green-600">
              ✓ Email will be sent via email service AND saved to message
              history
            </p>
          )}
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
                    // place chosen available sender into customSender so it's used
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

        {messageForm.type === 'email' && senderOptions.length === 0 && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs">
            <div className="font-medium mb-1">Debug: resolved company</div>
            <pre className="whitespace-pre-wrap max-h-40 overflow-auto">{JSON.stringify(company, null, 2)}</pre>
            <div className="font-medium mt-2">Debug: senderOptions</div>
            <pre className="whitespace-pre-wrap max-h-40 overflow-auto">{JSON.stringify(senderOptions, null, 2)}</pre>
          </div>
        )}

        <div>
          <Label htmlFor="message-body">Message *</Label>
          {messageForm.type === 'email' ? (
            <QuillEditor
              value={messageForm.body}
              onChange={(content) => setMessageForm({ ...messageForm, body: content })}
            />
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
            onClick={() => onClose()}
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
  );
};

export default MessageModal;
