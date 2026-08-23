import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CalenderIcon, ChatIcon, DownloadIcon,  } from '../../../../../icons';
import type { Applicant, ApplicantView, PersonalInfoProps } from '../../../../../types/applicants';
import { toPlainString } from '../../../../../utils/strings';
import { useLocale } from '../../../../../context/LocaleContext';

const buildResumeUrl = (raw?: string): string | null => {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (/^(https?:)?\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return `/${trimmed}`;
};

const formatDate = (value: string | undefined, locale: string): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
};

const getInitials = (name: string): string => {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const PersonalInfo: React.FC<PersonalInfoProps> = ({
  applicant,
  isEditing = false,
  editedApplicant,
  onChange,
  onChangeStatus,
  onScheduleInterview,
  onSendMessage,
  onPrint,
  onRestore,
  onCreateJobOffer,
  onCreateContract,
}) => {
  const { t, locale } = useLocale();
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);

  const data: ApplicantView = {
    ...(applicant as ApplicantView),
    ...(editedApplicant || {}),
  };

  const fullName = String(
    data.fullName ||
      `${data.firstName || ''} ${data.lastName || ''}`.trim() ||
      t('applicant', 'personalInfo')
  );
  const resumeUrl = buildResumeUrl(data.cvFilePath || data.resume);
  const submittedAt = data.submittedAt || data.createdAt;

  const handleField =
    (field: keyof Applicant) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (!onChange) return;
      onChange({ ...(editedApplicant || {}), [field]: event.target.value });
    };

  const [phoneMenuOpen, setPhoneMenuOpen] = useState(false);
  const phoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (phoneRef.current && !phoneRef.current.contains(e.target as Node)) {
        setPhoneMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cleanPhone = (phone: string) => phone.replace(/[^\d+]/g, '');
  const digitsOnly = (phone: string) => phone.replace(/\D/g, '');
  const whatsappNumber = (phone: string) => {
    const digits = digitsOnly(phone);
    if (digits.startsWith('20')) return digits;
    return `20${digits.replace(/^0+/, '')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5">
        <div className="flex flex-col items-center text-center mb-5 mt-8">
          {data.profilePhoto ? (
            <>
              <button
                type="button"
                onClick={() => setPhotoPreviewOpen(true)}
                className="focus:outline-none"
              >
                <img
                  src={data.profilePhoto}
                  alt={fullName}
                  className="w-32 h-32 rounded-full object-cover mb-3 shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                />
              </button>
              {photoPreviewOpen && createPortal(
                <div
                  className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
                  onClick={() => setPhotoPreviewOpen(false)}
                >
                  <div className="relative max-w-[90vw] max-h-[90vh]">
                    <img
                      src={data.profilePhoto}
                      alt={fullName}
                      className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoPreviewOpen(false)}
                      className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-gray-600 hover:text-gray-900 text-lg font-bold"
                    >
                      ×
                    </button>
                  </div>
                </div>,
                document.body
              )}
            </>
          ) : (
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-3 shadow-md">
              <span className="text-white text-2xl font-bold">{getInitials(fullName)}</span>
            </div>
          )}

          {isEditing ? (
            <input
              type="text"
              value={data.fullName || ''}
              onChange={handleField('fullName')}
              placeholder={t('fullName', 'personalInfo')}
              className="w-full text-center text-lg font-bold text-gray-800 border-b border-gray-200 focus:border-blue-400 focus:outline-none mb-1"
            />
          ) : (
            <h2 className="text-lg font-bold text-gray-800 mb-0.5">{fullName}</h2>
          )}

          <p className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors mt-2">
            {(typeof data.jobPositionId === 'object'
              ? toPlainString(data.jobPositionId?.title)
              : null) || t('positionAppliedFor', 'personalInfo')}
          </p>

          <div className="grid grid-cols-3 gap-3 mt-3 mb-3 sm:flex sm:items-center sm:justify-center sm:gap-3">
            <button
              type="button"
              title={t('scheduleInterview', 'personalInfo')}
              onClick={onScheduleInterview}
              className="flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors mx-auto"
            >
              <CalenderIcon className="w-4 h-4" />
            </button>
           
            <button
              type="button"
              title={t('sendMessage', 'personalInfo')}
              onClick={onSendMessage}
              className="flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors mx-auto"
            >
              <ChatIcon className="w-4 h-4" />
            </button>

            <button
              type="button"
              title={t('print', 'personalInfo')}
              onClick={onPrint}
              className="flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors mx-auto"
            >
              <DownloadIcon className="w-4 h-4" />
            </button>
          </div>

          {onCreateJobOffer && onCreateContract && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <button
                type="button"
                onClick={onCreateJobOffer}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
              >
                {t('sendOffer', 'applicants')}
              </button>
              <button
                type="button"
                onClick={onCreateContract}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-100 text-teal-700 hover:bg-teal-200 transition-colors"
              >
                {t('sendContract', 'applicants')}
              </button>
            </div>
          )}
         </div>

        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-gray-800">{t('details', 'personalInfo')}</span>
          <div className="flex items-center gap-2">
            {data.status === 'trashed' && onRestore && (
              <button
                type="button"
                onClick={onRestore}
                className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
              >
                {t('restore', 'applicants')}
              </button>
            )}
            <button
              type="button"
              onClick={onChangeStatus}
              className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
            >
              {data.status || t('status', 'applicants')}
            </button>
          </div>
        </div>

        <div className="border-t border-gray-200 mb-5 mt-5" />

        <div className="space-y-4">
          <div ref={phoneRef} className="relative">
            <div className="text-sm font-semibold text-gray-800 -mb-1">{t('phone', 'personalInfo')}</div>
            {isEditing ? (
              <input
                type="tel"
                value={data.phone || ''}
                onChange={handleField('phone')}
                className="w-full text-sm border-b border-gray-200 focus:border-blue-400 focus:outline-none"
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPhoneMenuOpen((prev) => !prev)}
                  className="text-sm text-gray-600 hover:text-gray-800 transition-colors break-all text-left"
                >
                  {data.phone || '-'}
                </button>
                {phoneMenuOpen && data.phone && (
                  <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[150px]">
                    <a
                      href={`tel:${cleanPhone(data.phone)}`}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setPhoneMenuOpen(false)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Call
                    </a>
                    <a
                      href={`sms:${cleanPhone(data.phone)}`}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setPhoneMenuOpen(false)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      SMS
                    </a>
                    <a
                      href={`https://wa.me/${whatsappNumber(data.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setPhoneMenuOpen(false)}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800 -mb-1">{t('dateOfBirth', 'personalInfo')}</div>
            {isEditing ? (
              <input
                type="text"
                value={data.birthDate || ''}
                onChange={handleField('birthDate')}
                className="w-full text-sm border-b border-gray-200 focus:border-blue-400 focus:outline-none"
              />
            ) : (
              <div className="text-sm text-gray-600">{formatDate(data.birthDate, locale)}</div>
            )}
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-800 -mb-1">{t('email', 'personalInfo')}</div>
            {isEditing ? (
              <input
                type="email"
                value={data.email || ''}
                onChange={handleField('email')}
                className="w-full text-sm border-b border-gray-200 focus:border-blue-400 focus:outline-none"
              />
            ) : (
              <a
                href={data.email ? `mailto:${data.email}` : '#'}
                className="text-sm text-gray-600 hover:text-gray-800 transition-colors break-all"
              >
                {data.email || '-'}
              </a>
            )}
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-800 -mb-1">{t('gender', 'personalInfo')}</div>
            {isEditing ? (
              <select
                value={data.gender || ''}
                onChange={handleField('gender')}
                className="w-full text-sm border-b border-gray-200 focus:border-blue-400 focus:outline-none"
              >
                <option value="">{t('selectGender', 'personalInfo')}</option>
                <option value="Male">{t('male', 'personalInfo')}</option>
                <option value="Female">{t('female', 'personalInfo')}</option>
              </select>
            ) : (
              <div className="text-sm text-gray-600">{data.gender || '-'}</div>
            )}
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-800 -mb-1">{t('address', 'personalInfo')}</div>
            {isEditing ? (
              <textarea
                value={data.address || ''}
                onChange={handleField('address')}
                rows={2}
                className="w-full text-sm border-b border-gray-200 focus:border-blue-400 focus:outline-none resize-none"
              />
            ) : (
              <div className="text-sm text-gray-600 leading-relaxed">{data.address || '-'}</div>
            )}
          </div>

          <div className="text-sm font-semibold text-gray-800 -mb-0.5">{t('expectedSalary', 'personalInfo')}</div>
          {isEditing ? (
            <input
              type="text"
              value={data.expectedSalary || ''}
              onChange={handleField('expectedSalary')}
              className="w-full text-sm border-b border-gray-200 focus:border-blue-400 focus:outline-none"
            />
          ) : (
            <div className="text-sm text-gray-600">{data.expectedSalary || '-'}</div>
          )}

          <div>
            <div className="text-sm font-semibold text-gray-800 mb-1">{t('resumeCv', 'personalInfo')}</div>
            {resumeUrl ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const response = await fetch(resumeUrl);
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = '';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch {
                    window.open(resumeUrl, '_blank', 'noopener');
                  }
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>{t('downloadCv', 'personalInfo')}</span>
              </button>
            ) : (
              <span className="text-sm text-gray-400">{t('noResumeAttached', 'personalInfo')}</span>
            )}
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-800 -mb-1">{t('submittedAt', 'personalInfo')}</div>
            <div className="text-sm text-gray-600">{formatDate(submittedAt, locale)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalInfo;
