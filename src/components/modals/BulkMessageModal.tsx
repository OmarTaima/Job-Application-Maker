import Swal from 'sweetalert2';
import { Modal } from '../ui/modal';
import { useState, useRef, useEffect } from 'react';
import useSendBatchEmail from '../../hooks/queries/useSendBatchEmail';
import { getErrorMessage } from '../../utils/errorHandler';
import { companiesService } from '../../services/companiesService';
import Label from '../form/Label';
import Select from '../form/Select';
import Input from '../form/input/InputField';

import 'quill/dist/quill.snow.css';
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
        modules: { toolbar: [['bold','italic','underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link']] },
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
  recipients: string[];
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

  const sendBatch = useSendBatchEmail();

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
        // If parent provided the company object, use it directly to avoid refetch
        let s = company ?? await companiesService.getCompanySettingsByCompany(companyId);
        if (!mounted) return;
        // normalize wrapper shapes like { company: { ... } }
        let raw = s || null;
        let normalized = raw && raw.company && typeof raw.company === 'object' ? raw.company : raw;

        // If settings endpoint returned null/empty, fallback to fetching the company directly
        if (!normalized && companyId) {
          try {
            const comp = await companiesService.getCompanyById(companyId);
            if (comp) {
              raw = comp as any;
              normalized = comp as any;
            }
          } catch (innerErr) {
            // ignore - we'll handle null below
          }
        }

        setCompanySettings(normalized || raw || null);
        // normalize available senders similarly to InterviewScheduleModal
        const availableCandidates: any[] = [];
        try {
          if (Array.isArray(normalized?.mailSettings?.availableMails)) { availableCandidates.push(...normalized.mailSettings.availableMails); }
          if (
            normalized &&
            typeof normalized === 'object' &&
            normalized.mailSettings &&
            Array.isArray((normalized.mailSettings as any)?.available_senders)
          ) {
            availableCandidates.push(...(normalized.mailSettings as any).available_senders);
          }
          // Fix: availableSenders may not exist, so check with type guard
          if (
            normalized?.mailSettings &&
            typeof normalized.mailSettings === 'object' &&
            Array.isArray((normalized.mailSettings as any).availableSenders)
          ) {
            availableCandidates.push(...(normalized.mailSettings as any).availableSenders);
          }
          if (
            normalized &&
            typeof normalized === 'object' &&
            'settings' in normalized &&
            normalized.settings &&
            typeof normalized.settings === 'object' &&
            'mailSettings' in normalized.settings &&
            normalized.settings.mailSettings &&
            typeof normalized.settings.mailSettings === 'object' &&
            Array.isArray((normalized.settings.mailSettings as any)?.availableMails)
          ) {
            availableCandidates.push(...(normalized.settings.mailSettings as any).availableMails);
          }
          if (
            normalized &&
            typeof normalized === 'object' &&
            'availableMails' in normalized &&
            Array.isArray((normalized as any).availableMails)
          ) {
            availableCandidates.push(...(normalized as any).availableMails);
          }
          if (
            normalized &&
            typeof normalized === 'object' &&
            'available_senders' in normalized &&
            Array.isArray((normalized as any).available_senders)
          ) {
            availableCandidates.push(...(normalized as any).available_senders);
          }
          // Removed: Property 'mail' does not exist on type 'CompanySettings'.
          // if (Array.isArray(normalized?.mail?.availableMails)) { availableCandidates.push(...normalized.mail.availableMails); rawFetched.push(...normalized.mail.availableMails); }
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

        // also check nested 'company' wrapper which some responses include (if we normalized earlier this may be unnecessary)
        try {
          const c = raw && (raw.company || raw);
          if (c && typeof c === 'object') {
            if (
              'settings' in c &&
              c.settings &&
              typeof c.settings === 'object' &&
              'mailSettings' in c.settings &&
              c.settings.mailSettings &&
              typeof c.settings.mailSettings === 'object' &&
              Array.isArray((c.settings.mailSettings as any)?.availableMails)
            ) {
              ((c.settings.mailSettings as any)?.availableMails ?? []).forEach((em: any) => { if (!seen.has(em)) { seen.add(em); deduped.push({ value: em, label: em }); } });
            }
            if (
              'mailSettings' in c &&
              c.mailSettings &&
              typeof c.mailSettings === 'object' &&
              Array.isArray(c.mailSettings.availableMails)
            ) {
              c.mailSettings.availableMails.forEach((em: any) => { if (!seen.has(em)) { seen.add(em); deduped.push({ value: em, label: em }); } });
            }
            if ('availableMails' in c && Array.isArray(c.availableMails)) {
              c.availableMails.forEach((em: any) => { if (!seen.has(em)) { seen.add(em); deduped.push({ value: em, label: em }); } });
            }
          }
        } catch (e) { /* ignore */ }

        // fallback to company contactEmail/defaultMail if present
        const fallbackEmail = normalized?.mailSettings?.defaultMail || normalized?.defaultMail || normalized?.contactEmail || normalized?.email || '';
        
        if (fallbackEmail && !seen.has(fallbackEmail)) {
          deduped.push({ value: fallbackEmail, label: fallbackEmail });
          seen.add(fallbackEmail);
        }

        setSenderOptions(deduped);
        // default selected email
        const defaultMail = normalized?.mailSettings?.defaultMail || normalized?.settings?.mailSettings?.defaultMail || normalized?.defaultMail || '';
        setCustomEmail(defaultMail || (deduped[0] && deduped[0].value) || '');
        // choose initial email option depending on available senders
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
      // If user chose 'new' email, add it to company availableMails first
      let fromAddress = `<no-reply@${companyDomain || 'company.com'}>`;
      if (emailOption === 'new' && newLocalEmail && newLocalEmail.trim()) {
        const local = newLocalEmail.trim();
        const domain = companyDomain || (companySettings && companySettings.mailSettings && companySettings.mailSettings.defaultMail ? companySettings.mailSettings.defaultMail.split('@')[1] : '') || 'company.com';
        const newEmail = `${local}@${domain}`;
            if (companyId) {
          try {
            // Fetch latest settings from server to avoid stale data overwriting existing mails
            let latestSettings = companySettings;
            try {
              latestSettings = await companiesService.getCompanySettingsByCompany(companyId) || latestSettings;
            } catch (e) {
              // ignore - we'll merge with whatever we have locally
            }

            // Collect existing available mails from possible shapes returned by the server
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
            // Resolve a settings id similar to CompanySettings page logic
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
            const idToSend = generatedSettingsId ?? companyId; // fall back to company id
            // Debug: log which id and mails we're sending to help diagnose overwrites
            try { console.debug('BulkMessageModal.updateCompanySettings', { idToSend, merged, latestSettings, companySettings }); } catch (e) { /* ignore */ }
            await companiesService.updateCompanySettings(idToSend, { mailSettings: { availableMails: merged } });
            // update local state
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

      // Build simple HTML email similar to MessageModal
      const batch = recipients.map((to) => ({
        to,
        from: (typeof fromAddress === 'string' && fromAddress.includes('<')) ? fromAddress.replace(/.*<\s*([^>]+)\s*>.*/, '$1') : String(fromAddress).replace(/[<>]/g, ''),
        subject: form.subject,
        html: `<!doctype html><html><body>${form.body}</body></html>`,
      }));

      // Send the batch payload as an array to the server (server expects an array, not a wrapper).
      await sendBatch.mutateAsync(batch);

      await Swal.fire({ title: 'Success', text: `Email queued for ${recipients.length} recipient(s)`, icon: 'success', timer: 2000, showConfirmButton: false });
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
          <button type="submit" className="rounded-lg bg-purple-600 px-6 py-2 text-white" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : `Send to ${recipients.length}`}</button>
        </div>
      </form>
    </Modal>
  );
};

export default BulkMessageModal;
