import { useEffect, useRef } from 'react';
import 'quill/dist/quill.snow.css';
import { Modal } from '../ui/modal';
import DatePicker from '../form/date-picker';
import Label from '../form/Label';
import Input from '../form/input/InputField';
import TextArea from '../form/input/TextArea';
import Select from '../form/Select';

// Simple HTML escape utility
function escapeHtml(str: string) {
  return str.replace(/[&<>"']/g, function (tag) {
    const chars: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return chars[tag] || tag;
  });
}

// Lightweight Quill editor wrapper (local to this modal)
function QuillEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<any>(null);

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
      quillRef.current.on('text-change', () => onChange(quillRef.current.root.innerHTML));
    })();

    return () => {
      mounted = false;
      if (quillRef.current) {
        try { quillRef.current.off && quillRef.current.off('text-change'); } catch (e) { /* ignore */ }
        quillRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (quillRef.current && quillRef.current.root && quillRef.current.root.innerHTML !== value) {
      quillRef.current.root.innerHTML = value || '';
    }
  }, [value]);

  return <div className="border rounded bg-white dark:bg-gray-800" style={{ minHeight: 120 }} ref={containerRef} />;
}

type Props = any;

export default function InterviewScheduleModal(props: Props) {
  const {
    isOpen,
    onClose,
    formResetKey,
    interviewForm,
    setInterviewForm,
    interviewError,
    setInterviewError,
    handleInterviewSubmit,
    fillCompanyAddress,
    notificationChannels,
    setNotificationChannels,
    emailOption,
    setEmailOption,
    customEmail,
    setCustomEmail,
    phoneOption,
    setPhoneOption,
    customPhone,
    setCustomPhone,
    messageTemplate,
    setMessageTemplate,
    interviewEmailSubject,
    setInterviewEmailSubject,
    isSubmittingInterview,
    // setIsSubmittingInterview, // removed unused prop
    setShowPreviewModal,
    setPreviewHtml,
    buildInterviewEmailHtml,
    getJobTitle,
    applicant,
  } = props;

  // Template generation: build a default message depending on chosen notification channel(s)
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
      // Return HTML so Quill renders multiline content correctly
      const esc = escapeHtml;
      const typeLabel = interviewType.charAt(0).toUpperCase() + interviewType.slice(1);
      const detailItems = [
        `<li>Date: ${esc(interviewDate)}</li>`,
        `<li>Time: ${esc(interviewTime)}</li>`,
        `<li>Type: ${esc(typeLabel)}</li>`,
      ];
      if (interviewType === 'video') detailItems.push(`<li>Link: <a href="${esc(link)}">${esc(link)}</a></li>`);
      if (interviewType === 'in-person') detailItems.push(`<li>Location: ${esc(location)}</li>`);

      return (
        `<p>Dear ${esc(applicantName)},</p>` +
        `<p>We are pleased to invite you for an interview for the position you applied for.</p>` +
        `<p><strong>Interview Details:</strong></p><ul>${detailItems.join('')}</ul>` +
        `<p>Please confirm your availability at your earliest convenience.</p>` +
        `<p>Best regards,<br/>HR Team</p>`
      );
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
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[1100px] p-6 lg:p-10" closeOnBackdrop={false}>
      <form key={`interview-form-${formResetKey}`} onSubmit={handleInterviewSubmit} className="flex flex-col px-2">
        <div>
          <h5 className="mb-2 font-semibold text-gray-800 text-xl dark:text-white/90 lg:text-2xl">Schedule Interview</h5>
          <p className="text-sm text-gray-500 dark:text-gray-400">Set up an interview and choose notification preferences</p>
        </div>

        {interviewError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start justify-between">
              <p className="text-sm text-red-600 dark:text-red-400"><strong>Error:</strong> {interviewError}</p>
              <button type="button" onClick={() => setInterviewError('')} className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300">✕</button>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <DatePicker id="interview-date" label="Interview Date" placeholder="Select interview date" onChange={(selectedDates: Date[]) => {
                if (selectedDates.length > 0) {
                  const date = selectedDates[0];
                  const formattedDate = date.toISOString().split('T')[0];
                  setInterviewForm({ ...interviewForm, date: formattedDate });
                }
              }} />
            </div>
            <div>
              <DatePicker id="interview-time" label="Interview Time" mode="time" placeholder="Select interview time" onChange={(selectedDates: Date[]) => {
                if (selectedDates.length > 0) {
                  const date = selectedDates[0];
                  const hours = date.getHours().toString().padStart(2, '0');
                  const minutes = date.getMinutes().toString().padStart(2, '0');
                  setInterviewForm({ ...interviewForm, time: `${hours}:${minutes}` });
                }
              }} />
            </div>
            <div>
              <Label htmlFor="interview-type">Interview Type</Label>
              <Select options={[{ value: 'phone', label: 'Phone' },{ value: 'video', label: 'Video' },{ value: 'in-person', label: 'In-Person' }]} placeholder="Select interview type" onChange={(value: any) => setInterviewForm({ ...interviewForm, type: value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="interview-location">Location (Optional)</Label>
              <Input id="interview-location" type="text" value={interviewForm.location} onChange={(e: any) => setInterviewForm({ ...interviewForm, location: e.target.value })} placeholder="Office address or meeting room" />
              <div className="mt-2"><button type="button" onClick={() => fillCompanyAddress()} className="text-sm text-brand-600 hover:underline">Use company address</button></div>
            </div>
            <div>
              <Label htmlFor="interview-link">Video Link (Optional)</Label>
              <Input id="interview-link" type="url" value={interviewForm.link} onChange={(e: any) => setInterviewForm({ ...interviewForm, link: e.target.value })} placeholder="https://meet.example.com/..." />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="interview-description">Description</Label>
              <TextArea value={interviewForm.description} onChange={(value: any) => setInterviewForm({ ...interviewForm, description: value })} placeholder="e.g., Technical Interview, HR Round" rows={2} />
            </div>
            <div>
              <Label htmlFor="interview-comment">Comment</Label>
              <TextArea value={interviewForm.comment} onChange={(value: any) => setInterviewForm({ ...interviewForm, comment: value })} placeholder="Add notes about this interview" rows={2} />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
            <h3 className="mb-3 text-base font-medium text-gray-800 dark:text-white/90">Notification Settings</h3>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Send notification via:</label>
              <div className="flex flex-wrap gap-3">
                <label className="group relative inline-flex items-center gap-3 cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 transition-all hover:border-brand-400 hover:bg-brand-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-brand-600 dark:hover:bg-brand-900/20">
                  <input type="radio" name="notificationChannel" checked={notificationChannels.email} onChange={() => { setNotificationChannels({ email: true, sms: false, whatsapp: false }); setEmailOption('company'); setMessageTemplate(generateMessageTemplate()); }} className="peer sr-only" />
                  <div className="h-5 w-5 rounded-full border-2 border-gray-300 bg-white transition-all peer-checked:border-brand-600 peer-checked:bg-brand-600 dark:border-gray-600 dark:bg-gray-700 dark:peer-checked:border-brand-500 dark:peer-checked:bg-brand-500 flex items-center justify-center"><div className="h-2 w-2 rounded-full bg-white scale-0 peer-checked:scale-100 transition-transform"></div></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">📧 Email</span>
                </label>
                <label className="group relative inline-flex items-center gap-3 cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 transition-all hover:border-brand-400 hover:bg-brand-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-brand-600 dark:hover:bg-brand-900/20">
                  <input type="radio" name="notificationChannel" checked={notificationChannels.sms} onChange={() => { setNotificationChannels({ email: false, sms: true, whatsapp: false }); setPhoneOption('company'); setMessageTemplate(generateMessageTemplate()); }} className="peer sr-only" />
                  <div className="h-5 w-5 rounded-full border-2 border-gray-300 bg-white transition-all peer-checked:border-brand-600 peer-checked:bg-brand-600 dark:border-gray-600 dark:bg-gray-700 dark:peer-checked:border-brand-500 dark:peer-checked:bg-brand-500 flex items-center justify-center"><div className="h-2 w-2 rounded-full bg-white scale-0 peer-checked:scale-100 transition-transform"></div></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">💬 SMS<span className="ml-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700">Soon</span></span>
                </label>
                <label className="group relative inline-flex items-center gap-3 cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 transition-all hover:border-brand-400 hover:bg-brand-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-brand-600 dark:hover:bg-brand-900/20">
                  <input type="radio" name="notificationChannel" checked={notificationChannels.whatsapp} onChange={() => { setNotificationChannels({ email: false, sms: false, whatsapp: true }); setMessageTemplate(generateMessageTemplate()); }} className="peer sr-only" />
                  <div className="h-5 w-5 rounded-full border-2 border-gray-300 bg-white transition-all peer-checked:border-brand-600 peer-checked:bg-brand-600 dark:border-gray-600 dark:bg-gray-700 dark:peer-checked:border-brand-500 dark:peer-checked:bg-brand-500 flex items-center justify-center"><div className="h-2 w-2 rounded-full bg-white scale-0 peer-checked:scale-100 transition-transform"></div></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">📱 WhatsApp<span className="ml-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700">Soon</span></span>
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {notificationChannels.email && (
                  <div className="space-y-2">
                    <Label htmlFor="email-option">Email Address</Label>
                    <Select options={[{ value: 'company', label: 'Company Email' },{ value: 'user', label: 'My Email' },{ value: 'custom', label: 'Custom Email' }]} value={emailOption} placeholder="Select email option" onChange={(value: any) => setEmailOption(value)} />
                    {emailOption === 'custom' && <Input id="custom-email" type="email" value={customEmail} onChange={(e: any) => setCustomEmail(e.target.value)} placeholder="Enter custom email address" className="mt-2" />}
                  </div>
                )}

                {(notificationChannels.sms || notificationChannels.whatsapp) && (
                  <div className="space-y-2">
                    <Label htmlFor="phone-option">Phone Number</Label>
                    {notificationChannels.sms ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-700/50"><p className="text-sm font-medium text-gray-700 dark:text-gray-300">Company Number (SMS)</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">SMS will be sent from the company number only</p></div>
                    ) : (
                      <>
                        <Select options={[{ value: 'company', label: 'Company Number' },{ value: 'user', label: 'My Phone' },{ value: 'whatsapp', label: 'Current WhatsApp Number' },{ value: 'custom', label: 'Custom Number' }]} value={phoneOption} placeholder="Select phone option" onChange={(value: any) => setPhoneOption(value)} />
                        {phoneOption === 'custom' && <Input id="custom-phone" type="tel" value={customPhone} onChange={(e: any) => setCustomPhone(e.target.value)} placeholder="Enter custom phone number" className="mt-2" />}
                        {phoneOption === 'whatsapp' && <p className="text-xs text-gray-500 dark:text-gray-400">Will use the number currently logged in to WhatsApp Web/Desktop</p>}
                      </>
                    )}
                  </div>
                )}
              </div>

            </div>
            {(notificationChannels.email || notificationChannels.sms || notificationChannels.whatsapp) && (
              <div className="mt-4">
                <Label htmlFor="message-template">Message Template
                  <button type="button" onClick={() => setMessageTemplate(generateMessageTemplate())} className="ml-2 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">🔄 Regenerate</button>
                </Label>
                {notificationChannels.email ? (
                  <>
                    <div className="mt-2"><Label htmlFor="interview-subject">Email Subject</Label><Input id="interview-subject" type="text" value={interviewEmailSubject} onChange={(e: any) => setInterviewEmailSubject(e.target.value)} placeholder="Email subject" /></div>
                    <div className="mt-3"><QuillEditor value={messageTemplate} onChange={(content: string) => setMessageTemplate(content)} /></div>
                  </>
                ) : (
                  <QuillEditor value={messageTemplate} onChange={(content: string) => setMessageTemplate(content)} />
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Templates for: {[notificationChannels.email && 'Email', notificationChannels.whatsapp && 'WhatsApp', notificationChannels.sms && 'SMS'].filter(Boolean).join(', ')}</p>
              </div>
            )}

          </div>
        </div>

        <div className="flex items-center gap-3 mt-6 sm:justify-end">
          <button type="button" onClick={onClose} disabled={isSubmittingInterview} className="flex w-full justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] sm:w-auto">Cancel</button>
          <button type="button" onClick={() => {
            const subject = interviewEmailSubject || 'Interview Invitation';
            const jobTitle = getJobTitle().en || '';
            const preview = buildInterviewEmailHtml({ subject, jobTitle, interview: interviewForm, rawMessage: messageTemplate, applicantName: applicant.fullName });
            setPreviewHtml(preview);
            setShowPreviewModal(true);
          }} className="flex w-full justify-center rounded-lg border border-stroke px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800 sm:w-auto">Preview Email</button>
          <button type="submit" disabled={isSubmittingInterview} className="flex w-full justify-center items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto">{isSubmittingInterview ? (<><svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Scheduling...</span></>) : (<span>Schedule Interview</span>)}</button>
        </div>

      </form>
    </Modal>
  );
}
