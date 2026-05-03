import Swal from '../../utils/swal';
import { Modal } from '../ui/modal';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useSendBatchEmail } from '../../hooks/queries';
import { useJobPositions, useSendMessage } from '../../hooks/queries';
import { getErrorMessage } from '../../utils/errorHandler';
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
  const [senderOptions, setSenderOptions] = useState<Array<{value:string;label:string}>>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const sendBatch = useSendBatchEmail();
  const sendMessageMutation = useSendMessage();

  // Email templates from company object (from /auth/me data)
  const emailTemplates: any[] = useMemo(() => {
    return company?.settings?.mailSettings?.emailTemplates || [];
  }, [company]);

  useEffect(() => {
    if (!isOpen) {
      setForm({ subject: '', body: '', type: 'email' });
      setError('');
      setSelectedTemplateId('');
    }
  }, [isOpen]);

  const handleTemplateSelect = (templateId: string) => {
    if (!templateId) {
      setSelectedTemplateId('');
      return;
    }
    
    const selectedTemplate = emailTemplates.find((t: any) => t._id === templateId);
    if (selectedTemplate) {
      let decodedHtml = selectedTemplate.html;
      try {
        decodedHtml = decodedHtml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      } catch (e) {
        decodedHtml = selectedTemplate.html;
      }
      
      setForm(prev => ({
        ...prev,
        subject: selectedTemplate.subject,
        body: decodedHtml,
      }));
      setSelectedTemplateId(templateId);
    }
  };

  const buildEmailHtml = (subject: string, body: string, recipient?: any) => {
    let processedSubject = subject;
    let processedBody = body;
    
    if (recipient) {
      processedSubject = applyTemplateToPlainForRecipient(subject, recipient);
      processedBody = applyTemplateToHtmlForRecipient(body, recipient);
    }
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(processedSubject)}</title>
    </head>
    <body style="font-family: Arial, sans-serif; padding: 20px; margin: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #ffffff; border-bottom: 1px solid #e5e7eb; padding: 24px 30px; text-align: center;">
          <h1 style="color: #111827; margin: 0; font-size: 22px; font-weight: 700;">${escapeHtml(processedSubject) || 'No Subject'}</h1>
        </div>
        <div style="padding: 30px;">
          <div style="font-size: 16px; line-height: 1.6; color: #444;">
            ${processedBody || ''}
          </div>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;"/>
        </div>
      </div>
    </body>
    </html>
    `;
  };

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

  const { data: jobPositions = [] } = useJobPositions(companyId ? [companyId] : undefined as any, false);
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
        <h1 style="color: #111827; margin: 0; font-size: 22px; font-weight: 700;">${escapeHtml(subject)}</h1>
      </div>
      <div style="padding: 30px;">
        <div style="font-size: 16px; line-height: 1.6; color: #444;">
          ${body || ''}
        </div>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;"/>
      </div>
    </div>`;

  const companyDomain = company?.settings?.mailSettings?.companyDomain || 
    company?.mailSettings?.companyDomain || 
    (company?.settings?.mailSettings?.defaultMail?.split('@')[1]) || 
    '';

  // Get sender options from company object directly (from /auth/me data)
  useEffect(() => {
    if (!isOpen) return;
    
    if (!company && !companyId) {
      setSenderOptions([]);
      setCustomEmail('');
      return;
    }
    
    const companyData = company || null;
    
    const availableCandidates: any[] = [];
    let defaultMail = '';
    
    try {
      // Get available mails from company settings
      const companyMailSettings = companyData?.settings?.mailSettings || companyData?.mailSettings;
      if (companyMailSettings) {
        if (Array.isArray(companyMailSettings.availableMails)) {
          availableCandidates.push(...companyMailSettings.availableMails);
        }
        if (Array.isArray(companyMailSettings.available_senders)) {
          availableCandidates.push(...companyMailSettings.available_senders);
        }
        if (Array.isArray(companyMailSettings.availableSenders)) {
          availableCandidates.push(...companyMailSettings.availableSenders);
        }
        defaultMail = companyMailSettings.defaultMail || '';
      }
      
      // Also check root level
      if (Array.isArray(companyData?.availableMails)) {
        availableCandidates.push(...companyData.availableMails);
      }
      if (Array.isArray(companyData?.available_senders)) {
        availableCandidates.push(...companyData.available_senders);
      }
      
      // Fallback default mail
      if (!defaultMail) {
        defaultMail = companyData?.contactEmail || companyData?.email || '';
      }
    } catch (e) {
      /* ignore */
    }

    const deduped: Array<{ value: string; label: string }> = [];
    const seen = new Set<string>();
    
    availableCandidates.forEach((mitem: any) => {
      let email = '';
      if (!mitem) return;
      if (typeof mitem === 'string') {
        email = String(mitem).trim();
      } else if (typeof mitem === 'object') {
        email = String(mitem.email || mitem.address || mitem.value || '').trim();
      }
      if (!email) return;
      if (seen.has(email)) return;
      seen.add(email);
      deduped.push({ value: email, label: email });
    });

    // Add default mail if available and not already added
    if (defaultMail && !seen.has(defaultMail)) {
      deduped.push({ value: defaultMail, label: defaultMail });
    }

    setSenderOptions(deduped);
    setCustomEmail(deduped[0]?.value || defaultMail || '');
    if (deduped.length > 0) {
      setEmailOption('available');
    } else {
      setEmailOption('company');
    }
  }, [isOpen, company, companyId]);

  const handlePreview = () => {
    if (!form.body?.trim()) {
      setError('Body is required to preview email');
      return;
    }

    const normalizedRecipients = recipients
      .map((item) => {
        if (typeof item === 'string') {
          return { to: item, applicant: undefined, jobPositionId: undefined, raw: { email: item } };
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
          raw: {
            email: String(item?.email || '').trim(),
            applicantName: item?.applicantName || item?.name || item?.fullName,
            fullName: item?.fullName || item?.applicantName || item?.name,
            name: item?.name || item?.applicantName || item?.fullName,
            jobPositionId: jobPositionId,
            jobPosition: item?.jobPosition,
            ...item
          },
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
      const html = buildEmailHtml(substitutedSubject, substitutedBody);
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
      let fromAddress = emailOption === 'new' && newLocalEmail
        ? `${newLocalEmail}@${companyDomain || 'company.com'}`
        : customEmail || company?.settings?.mailSettings?.defaultMail || '';

      // Normalize recipients
      const normalizedRecipients = recipients
        .map((item) => {
          if (typeof item === 'string') {
            return { 
              to: item.trim(), 
              applicant: undefined, 
              jobPositionId: undefined,
              raw: { email: item.trim() }
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
            raw: rawForSubstitution,
          };
        })
        .filter((item) => item.to);

      const batch = normalizedRecipients.map(({ to, applicant, jobPositionId, raw }) => {
        const subSubject = applyTemplateToPlainForRecipient(form.subject, raw);
        const subBody = applyTemplateToHtmlForRecipient(form.body, raw);
        
        return {
          to,
          from: fromAddress,
          subject: subSubject,
          html: buildEmailHtml(subSubject, subBody, raw),
          applicant,
          jobPosition: jobPositionId,
        };
      });

      const companyToSend = companyId || company?._id;

      if (!companyToSend) {
        setError('Company is required to send batch email');
        setIsSubmitting(false);
        return;
      }

      await sendBatch.mutateAsync({ company: String(companyToSend), batch });

      const messagePromises = batch.map(async (email) => {
        if (email.applicant) {
          try {
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
          }
        }
      });

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

  const templateOptions = useMemo(() => {
    return [
      { value: '', label: '-- Select a template --' },
      ...emailTemplates.map((t: any) => ({ 
        value: t._id || '', 
        label: t.name 
      }))
    ];
  }, [emailTemplates]);

  // Helper to get company name for display
  const getCompanyName = () => {
    if (company?.name) {
      if (typeof company.name === 'string') return company.name;
      return company.name.en || company.name.ar || 'Company';
    }
    return 'Company';
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

          {/* Template Selector */}
          {emailTemplates.length > 0 && (
            <div>
              <Label htmlFor="template-select">Load Template</Label>
              <Select
                options={templateOptions}
                value={selectedTemplateId}
                onChange={(value) => handleTemplateSelect(value as string)}
                placeholder="Select a template to load"
              />
              <p className="mt-1 text-xs text-gray-500">
                Select a template to automatically fill the subject and body
              </p>
            </div>
          )}

          <div>
            <Label>Subject *</Label>
            <p className="mt-1 text-xs text-gray-500 mb-2">
              Available variables: {'{{candidateName}}'}, {'{{position}}'} or {'{{jobTitle}}'}
            </p>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject" />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
            <h3 className="mb-2 text-base font-medium text-gray-800 dark:text-white/90">Sender</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="email-option">Email From</Label>
                <Select
                  options={[{ value: 'company', label: `${getCompanyName()} Email` }, { value: 'new', label: 'New Email' }]}
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
                    : customEmail || company?.settings?.mailSettings?.defaultMail || ''
                } readOnly />
              </div>
            </div>
          </div>

          <div>
            <Label>Body *</Label>
            <p className="mt-1 text-xs text-gray-500 mb-2">
              Available variables: {'{{candidateName}}'}, {'{{position}}'} or {'{{jobTitle}}'}
            </p>
            <QuillEditor value={form.body} onChange={(v) => setForm({ ...form, body: v })} />
            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
              <strong>Quick Insert:</strong>{' '}
              <button 
                type="button"
                onClick={() => setForm({ ...form, body: form.body + '{{candidateName}}' })}
                className="text-blue-600 hover:underline mx-1"
              >
                {'{{candidateName}}'}
              </button>
              <button 
                type="button"
                onClick={() => setForm({ ...form, body: form.body + '{{position}}' })}
                className="text-blue-600 hover:underline mx-1"
              >
                {'{{position}}'}
              </button>
              <button 
                type="button"
                onClick={() => setForm({ ...form, body: form.body + '{{jobTitle}}' })}
                className="text-blue-600 hover:underline mx-1"
              >
                {'{{jobTitle}}'}
              </button>
            </div>
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