import Swal from 'sweetalert2';
import { Modal } from '../ui/modal';
import { useState, useRef, useEffect } from 'react';
import { useSendMessage, useSendEmail } from '../../hooks/queries'; // Add useSendEmail
import { getErrorMessage } from '../../utils/errorHandler';
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
}: {
  isOpen: boolean;
  onClose: () => void;
  applicant: any;
  id: string;
}) => {
  const [messageForm, setMessageForm] = useState({
    subject: '',
    body: '',
    type: 'email' as 'email' | 'sms' | 'whatsapp' | 'internal',
  });
  const [messageError, setMessageError] = useState('');
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);

  const sendMessageMutation = useSendMessage();
  const sendEmailMutation = useSendEmail(); // New email mutation

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
        const companyConfig = 'Valora HR <hr@valora-rs.com>';

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
        await sendEmailMutation.mutateAsync({
          to: applicant.email,
          from: companyConfig,
          subject: messageForm.subject,
          html: emailHtml,
        });
      }

      // 3. Save to messages (old functionality)
      await sendMessageMutation.mutateAsync({
        id,
        data: {
          type: messageForm.type,
          content: messageForm.body,
        },
      });

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

        {/* Preview for email */}
        {messageForm.type === 'email' && messageForm.body && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-xs font-medium text-gray-500 mb-2">
              Email Preview:
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              To: {applicant?.email}
              <br />
              Subject: {messageForm.subject}
              <br />
              <span className="text-xs text-gray-500">
                Body will be formatted as HTML email
              </span>
            </p>
          </div>
        )}

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
