import Swal from '../../utils/swal';
import { Modal } from '../ui/modal';
import { useState, useRef, useEffect, useMemo } from 'react';
import useSendBatchEmail from '../../hooks/queries/useSendBatchEmail';
import { useJobPositions, useSendMessage } from '../../hooks/queries';
import { getErrorMessage } from '../../utils/errorHandler';
import { companiesService } from '../../services/companiesService';
import Label from '../form/Label';
import Select from '../form/Select';
import Input from '../form/input/InputField';

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
        modules: { toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link']] },
      });
      quillRef.current.root.innerHTML = value || '';
      const handleChange = () => onChangeRef.current(quillRef.current.root.innerHTML);
      quillRef.current.on('text-change', handleChange);
    })();

    return () => {
      mounted = false;
      if (quillRef.current) {
        try { quillRef.current.off && quillRef.current.off('text-change'); } catch (e) {}
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

const BulkMessageModal = ({
  isOpen,
  onClose,
  recipients,
  companyId,
  company,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  recipients: Array<string | { email?: string; applicant?: string; _id?: string; id?: string; jobPositionId?: string; jobPosition?: any; applicantName?: string; name?: string; fullName?: string }>;
  companyId?: string | null;
  company?: any;
  onSuccess?: () => void;
}) => {
  const [form, setForm] = useState({ subject: '', body: '', type: 'email' as 'email' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailOption, setEmailOption] = useState<'company' | 'new' | 'available'>('company');
  const [customEmail, setCustomEmail] = useState('');
  const [newLocalEmail, setNewLocalEmail] = useState('');
  const [companySettings, setCompanySettings] = useState<any | null>(null);
  const [senderOptions, setSenderOptions] = useState<Array<{value:string;label:string}>>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  const sendBatch = useSendBatchEmail();
  const sendMessageMutation = useSendMessage(); // Add this mutation to save messages to database

  useEffect(() => {
    if (!isOpen) {
      setForm({ subject: '', body: '', type: 'email' });
      setError('');
    }
  }, [isOpen]);

  const extractDomain = (email?: string | null) => {
    if (!email) return '';
    const parts = String(email).split('@');
    return parts.length > 1 ? parts.slice(1).join('@') : '';
  };

  const buildEmailHtml = (subject: string, body: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
  </head>
  <body style="font-family: Arial, sans-serif; padding: 20px; margin: 0; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #ffffff; border-bottom: 1px solid #e5e7eb; padding: 24px 30px; text-align: center;">
        <h1 style="color: #111827; margin: 0; font-size: 22px; font-weight: 700;">${subject || 'No Subject'}</h1>
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

  const escapeRegex = (s: string) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const buildInterleavedRegex = (token: string) => {
    const chars = String(token || '').split('');
    const part = chars.map((ch) => escapeRegex(ch) + '(?:<[^>]+>|\\s|&nbsp;|&#160;)*').join('');
    return new RegExp('\\{\\{\\s*' + part + '\\s*\\}\\}', 'gi');
  };

  const toDisplayText = (value: unknown, fallback = ''): string => {
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
  };

  const getCandidateNameForRecipient = (item: any) => {
    if (!item) return 'Candidate';
    if (typeof item === 'string') {
      const email = String(item || '').trim();
      if (!email) return 'Candidate';
      const local = email.split('@')[0] || email;
      return local || 'Candidate';
    }
    return (
      String(item.applicantName || item.fullName || item.name || item.email || '').trim() ||
      'Candidate'
    );
  };

  const getRecipientId = (item: any): string | undefined => {
    if (!item) return undefined;
    if (typeof item === 'string') return undefined;
    return item.applicant || item._id || item.id;
  };

  const { data: jobPositions = [] } = useJobPositions(companyId ? [companyId] : undefined as any);
  const jobTitleById = useMemo(() => {
    const map = new Map<string, string>();
    (jobPositions || []).forEach((j: any) => {
      const id = (j && (j._id || j.id)) || undefined;
      if (!id) return;
      map.set(id, toDisplayText((j as any)?.title || (j as any)?.name, ''));
    });
    return map;
  }, [jobPositions]);

  const getJobTitleForRecipient = (item: any) => {
    if (!item) return '';
    try {
      const jp = item.jobPositionId || item.jobPosition;
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

    const titleFromJobPositionId = toDisplayText((item as any)?.jobPositionId?.title || (item as any)?.jobPositionId?.name, '');
    if (titleFromJobPositionId) return titleFromJobPositionId;
    const titleFromJobPosition = toDisplayText((item as any)?.jobPosition?.title || (item as any)?.jobPosition?.name, '');
    if (titleFromJobPosition) return titleFromJobPosition;
    return '';
  };

  const applyTemplateToHtmlForRecipient = (html: string, item: any) => {
    if (!html) return '';
    const nameEsc = escapeHtml(getCandidateNameForRecipient(item));
    const jobEsc = escapeHtml(getJobTitleForRecipient(item));
    let out = String(html);
    out = out.replace(buildInterleavedRegex('candidateName'), nameEsc);
    out = out.replace(buildInterleavedRegex('position'), jobEsc);
    out = out.replace(buildInterleavedRegex('jobTitle'), jobEsc);
    return out;
  };

  const applyTemplateToPlainForRecipient = (plain: string, item: any) => {
    if (!plain) return '';
    return String(plain)
      .replace(/\{\{\s*candidateName\s*\}\}/gi, getCandidateNameForRecipient(item))
      .replace(/\{\{\s*(?:position|jobTitle)\s*\}\}/gi, getJobTitleForRecipient(item));
  };

  const buildEmailSection = (subject: string, body: string) => `
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border:1px solid #e5e7eb; margin-bottom: 24px;">
      <div style="background-color: #ffffff; border-bottom: 1px solid #e5e7eb; padding: 24px 30px; text-align: center;">
        <h1 style="color: #111827; margin: 0; font-size: 22px; font-weight: 700;">${subject}</h1>
      </div>
      <div style="padding: 30px;">
        <div style="font-size: 16px; line-height: 1.6; color: #444;">
          ${body || ''}
        </div>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;"/>
      </div>
    </div>`;

  const companyDomain =
    companySettings?.mailSettings?.companyDomain ||
    companySettings?.settings?.mailSettings?.companyDomain ||
    extractDomain(companySettings?.mailSettings?.defaultMail) ||
    extractDomain(companySettings?.settings?.mailSettings?.defaultMail) ||
    extractDomain(companySettings?.email) ||
    '';

  // fetch company settings when modal opens and companyId provided
  useEffect(() => {
    let mounted = true;
    if (!isOpen) return;
    if (!companyId) {
      setCompanySettings(null);
      setSenderOptions([]);
      setCustomEmail('');
      return;
    }
    (async () => {
      try {
        let s = company ?? await companiesService.getCompanySettingsByCompany(companyId);
        if (!mounted) return;
        let raw = s || null;
        let normalized = raw && raw.company && typeof raw.company === 'object' ? raw.company : raw;

        if (!normalized && companyId) {
          try {
            const comp = await companiesService.getCompanyById(companyId);
            if (comp) {
              raw = comp as any;
              normalized = comp as any;
            }
          } catch (innerErr) {
            // ignore
          }
        }

        setCompanySettings(normalized || raw || null);

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

        // also check nested 'company' wrapper
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

        setSenderOptions(deduped);
        const defaultMail = normalized?.mailSettings?.defaultMail || normalized?.settings?.mailSettings?.defaultMail || normalized?.defaultMail || '';
        setCustomEmail(defaultMail || (deduped[0] && deduped[0].value) || '');
        if (deduped.length > 0) setEmailOption('available');
        else setEmailOption('company');
      } catch (e) {
        if (!mounted) return;
        setCompanySettings(null);
        setSenderOptions([]);
        setCustomEmail('');
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, companyId]);

  const handlePreview = () => {
    if (!form.body?.trim()) {
      setError('Body is required to preview email');
      return;
    }

    const normalizedRecipients = recipients
      .map((item) => {
        if (typeof item === 'string') {
          return { to: item, applicant: undefined, jobPositionId: undefined, raw: item };
        }
        let jobPositionId = item.jobPositionId || (item.jobPosition && typeof item.jobPosition === 'object' ? item.jobPosition._id : item.jobPosition);
        if (jobPositionId && typeof jobPositionId === 'object') {
          jobPositionId = jobPositionId._id || jobPositionId.id || String(jobPositionId);
        }
        return {
          to: String(item?.email || '').trim(),
          applicant: item?.applicant || item?._id || item?.id,
          jobPositionId: typeof jobPositionId === 'string' ? jobPositionId : undefined,
          applicantName: item?.applicantName || item?.name || item?.fullName,
          raw: item,
        };
      })
      .filter((item) => item.to);

    if (normalizedRecipients.length === 0) {
      setError('No valid recipients to preview');
      return;
    }

    if (normalizedRecipients.length === 1) {
      const r = normalizedRecipients[0].raw;
      const substitutedSubject = applyTemplateToPlainForRecipient(form.subject, r);
      const substitutedBody = applyTemplateToHtmlForRecipient(form.body, r);
      const html = buildEmailHtml(escapeHtml(substitutedSubject), substitutedBody);
      setPreviewHtml(html);
      setShowPreview(true);
      return;
    }

    const sections = normalizedRecipients.map((nr) => {
      const r = nr.raw;
      const subSubject = applyTemplateToPlainForRecipient(form.subject, r);
      const subBody = applyTemplateToHtmlForRecipient(form.body, r);
      return buildEmailSection(escapeHtml(subSubject), subBody);
    });

    const previewDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family: Arial, sans-serif; padding:20px; margin:0; background-color:#f5f5f5;">${sections.join('\n')}<div style="text-align:center;color:#666;font-size:12px;margin-top:12px;">Preview for ${normalizedRecipients.length} recipients</div></body></html>`;
    setPreviewHtml(previewDoc);
    setShowPreview(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!recipients || recipients.length === 0) {
      setError('No recipients selected');
      return;
    }
    if (!form.subject?.trim()) {
      setError('Subject is required');
      return;
    }
    if (!form.body?.trim()) {
      setError('Body is required');
      return;
    }

    setIsSubmitting(true);
    try {
      let fromAddress = `<no-reply@${companyDomain || 'company.com'}>`;
      if (emailOption === 'new' && newLocalEmail && newLocalEmail.trim()) {
        const local = newLocalEmail.trim();
        const domain = companyDomain || (companySettings && companySettings.mailSettings && companySettings.mailSettings.defaultMail ? companySettings.mailSettings.defaultMail.split('@')[1] : '') || 'company.com';
        const newEmail = `${local}@${domain}`;
        if (companyId) {
          try {
            let latestSettings = companySettings;
            try {
              latestSettings = await companiesService.getCompanySettingsByCompany(companyId) || latestSettings;
            } catch (e) {
              // ignore
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
            const existing = collectExisting(latestSettings || companySettings || company);
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
            const generatedSettingsId = companySettingsId ?? findSettingsId(latestSettings || companySettings);
            const idToSend = generatedSettingsId ?? companyId;
            
            await companiesService.updateCompanySettings(idToSend, { mailSettings: { availableMails: merged } });
            
            setSenderOptions((prev) => {
              if (prev.find(p => p.value === newEmail)) return prev;
              return [{ value: newEmail, label: newEmail }, ...prev];
            });
            setCustomEmail(newEmail);
            fromAddress = `${newEmail}`;
          } catch (err: any) {
            setError(getErrorMessage(err));
            setIsSubmitting(false);
            return;
          }
        } else {
          fromAddress = `${newEmail}`;
        }
      } else if (emailOption === 'available' && customEmail) {
        fromAddress = customEmail;
      } else if (companySettings?.mailSettings?.defaultMail) {
        fromAddress = companySettings.mailSettings.defaultMail;
      }

      // Normalize recipients with the full object for substitution
      const normalizedRecipients = recipients
        .map((item) => {
          if (typeof item === 'string') {
            const email = item.trim();
            return { 
              to: email, 
              applicant: undefined, 
              jobPositionId: undefined,
              raw: { email }
            };
          }
          let jobPositionId = item.jobPositionId || (item.jobPosition && typeof item.jobPosition === 'object' ? item.jobPosition._id : item.jobPosition);
          if (jobPositionId && typeof jobPositionId === 'object') {
            jobPositionId = jobPositionId._id || jobPositionId.id || String(jobPositionId);
          }
          const rawForSubstitution = {
            email: String(item?.email || '').trim(),
            applicantName: item?.applicantName || item?.name || item?.fullName,
            fullName: item?.fullName || item?.applicantName || item?.name,
            name: item?.name || item?.applicantName || item?.fullName,
            jobPositionId: jobPositionId,
            jobPosition: item?.jobPosition,
            ...item
          };
          return {
            to: String(item?.email || '').trim(),
            applicant: item?.applicant || item?._id || item?.id,
            jobPositionId: typeof jobPositionId === 'string' ? jobPositionId : undefined,
            applicantName: item?.applicantName || item?.name || item?.fullName,
            raw: rawForSubstitution,
          };
        })
        .filter((item) => item.to);

      // Build batch with proper substitution for each recipient
      const batch = normalizedRecipients.map(({ to, applicant, jobPositionId, raw }) => {
        const subSubject = applyTemplateToPlainForRecipient(form.subject, raw);
        const subBody = applyTemplateToHtmlForRecipient(form.body, raw);
        
        return {
          to,
          from: (typeof fromAddress === 'string' && fromAddress.includes('<')) 
            ? fromAddress.replace(/.*<\s*([^>]+)\s*>.*/, '$1') 
            : String(fromAddress).replace(/[<>]/g, ''),
          subject: subSubject,
          html: buildEmailHtml(escapeHtml(subSubject), subBody),
          applicant,
          jobPosition: jobPositionId,
        };
      });

      const companyToSend = companyId ||
        (company && (company._id || company.id)) ||
        (companySettings && (companySettings._id || companySettings.id));

      if (!companyToSend) {
        setError('Company is required to send batch email');
        setIsSubmitting(false);
        return;
      }

      // Send emails
     // Send emails
await sendBatch.mutateAsync({ company: String(companyToSend), batch });

// Save each email as a message in the database for the applicant's history
const messagePromises = batch.map(async (email) => {
  if (email.applicant) {
    try {
      // Include subject in the content since subject field is not allowed
      const contentWithSubject = `<h2 style="color:#333; margin-bottom:10px;">Subject: ${escapeHtml(email.subject)}</h2><hr style="margin:10px 0;"/>${email.html}`;
      
      await sendMessageMutation.mutateAsync({
        id: email.applicant,
        data: {
          type: 'email',
          content: contentWithSubject,
        },
      });
    } catch (err) {
      console.error(`Failed to save message for applicant ${email.applicant}:`, err);
      // Don't fail the whole operation if saving message fails
    }
  }
});

await Promise.allSettled(messagePromises);

      await Promise.allSettled(messagePromises);

      await Swal.fire({ 
        title: 'Success', 
        text: `Email sent to ${recipients.length} recipient(s) and saved to message history`, 
        icon: 'success', 
        timer: 2000, 
        showConfirmButton: false 
      });
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Bulk send error', err);
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={() => { onClose(); setError(''); }} className="max-w-2xl p-6" closeOnBackdrop={false}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Send Email To {recipients.length} recipient(s)</h2>
        
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start justify-between">
                <p className="text-sm text-red-600 dark:text-red-400"><strong>Error:</strong> {error}</p>
                <button type="button" onClick={() => setError('')} className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300">✕</button>
              </div>
            </div>
          )}

          <div>
            <Label>Subject *</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject" />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
            <h3 className="mb-2 text-base font-medium text-gray-800 dark:text-white/90">Sender</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="email-option">Email From</Label>
                <Select
                  options={[{ value: 'company', label: 'Company Email' }, { value: 'new', label: 'New Email' }]}
                  value={emailOption}
                  onChange={(v: any) => {
                    setEmailOption(v);
                    if (v !== 'new') setNewLocalEmail('');
                  }}
                  placeholder="Select sender option"
                />
              </div>

              {emailOption === 'new' && (
                <div className="flex items-center gap-2">
                  <Input value={newLocalEmail} onChange={(e: any) => setNewLocalEmail(e.target.value)} placeholder="your-name" />
                  <div className="text-sm text-gray-600">@{companyDomain || 'company.com'}</div>
                </div>
              )}

              {emailOption !== 'new' && (
                <div>
                  <Label>Available Sender Addresses</Label>
                  <Select
                    options={senderOptions.length > 0 ? senderOptions : [{ value: '', label: 'No available senders' }]}
                    value={customEmail || ''}
                    onChange={(v: any) => { setCustomEmail(v); setEmailOption('available'); }}
                    placeholder="Select sender"
                  />
                </div>
              )}

              <div>
                <Label>Selected Sender</Label>
                <Input value={
                  emailOption === 'new' && newLocalEmail
                    ? `${newLocalEmail}@${companyDomain || 'company.com'}`
                    : customEmail || (companySettings && companySettings.mailSettings && companySettings.mailSettings.defaultMail) || ''
                } readOnly />
              </div>
            </div>
          </div>

          <div>
            <Label>Body *</Label>
            <QuillEditor value={form.body} onChange={(v) => setForm({ ...form, body: v })} />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => onClose()} className="rounded-lg border border-stroke px-6 py-2" disabled={isSubmitting}>Cancel</button>

            <button
                type="button"
                onClick={handlePreview}
                className="rounded-lg border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
                disabled={isSubmitting}
              >
                Preview Email
            </button>

            <button type="submit" className="rounded-lg bg-purple-600 px-6 py-2 text-white" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : `Send to ${recipients.length}`}</button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
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
              onClick={() => setShowPreview(false)}
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

export default BulkMessageModal;