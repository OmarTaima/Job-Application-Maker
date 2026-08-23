import { useEffect, useState, useCallback, useMemo } from 'react';
import { Modal } from '../ui/modal';
import DatePicker from '../form/date-picker';
import Label from '../form/Label';
import Input from '../form/input/InputField';
import TextArea from '../form/input/TextArea';
import Select from '../form/Select';
import { toPlainString } from '../../utils/strings';
import { EmailTemplate } from '../../services/companiesService';
import { useAuth } from '../../context/AuthContext';
import { useUsers, useCompanies } from '../../hooks/queries';
import { resolveCompanyAddress } from '../../utils/companyAddress';
import { useLocale } from '../../context/LocaleContext';
import { filterTemplatesByCategory } from '../../utils/mailTemplateCategories';
import RichTextEditor from '../form/RichTextEditor';

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

// Lightweight Quill editor wrapper

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
  setShowPreviewModal,
  setPreviewHtml,
  getJobTitle,
  applicant,
  companyData,
  bulkMode = false,
  bulkCount = 0,
  intervalMinutes = 10,
  setIntervalMinutes,
  recipients = [],
  jobTitleById = {},
} = props;

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const { user } = useAuth();
  const { t, locale } = useLocale();

  const emailTemplates: EmailTemplate[] = useMemo(() => {
    const company = companyData || (applicant && (applicant.company || applicant.companyObj));
    const templates = company?.settings?.mailSettings?.emailTemplates || [];
    // Interview invitations only show "interviews" templates
    return filterTemplatesByCategory(templates, 'interviews');
  }, [companyData, applicant]);

  // Get company ID for fetching users
  const getCompanyIdVal = useCallback(() => {
    const cd = companyData as { _id?: string; id?: string } | null | undefined;
    if (cd?._id) return cd._id;
    if (cd?.id) return cd.id;
    const app = applicant as any;
    const appCompanyId = app?.companyId;
    if (typeof appCompanyId === 'string' && appCompanyId) return appCompanyId;
    if (appCompanyId && typeof appCompanyId === 'object' && appCompanyId._id) return appCompanyId._id;
    const jpCompanyId = app?.jobPositionId?.companyId;
    if (typeof jpCompanyId === 'string' && jpCompanyId) return jpCompanyId;
    if (jpCompanyId && typeof jpCompanyId === 'object' && jpCompanyId._id) return jpCompanyId._id;
    return null;
  }, [companyData, applicant]);

  const companyId = getCompanyIdVal();

  // Also pull the company list (super admin has empty user.companies, so useCompanies()
  // calls the list endpoint which returns the full `address` array).
  const { data: companiesList = [] } = useCompanies();
  const companyFromList = useMemo(() => {
    if (!companyId) return null;
    return (companiesList as any[]).find((c: any) => c?._id === companyId) ?? null;
  }, [companiesList, companyId]);

  // Effective company data: prefer the prop, but merge in the address-bearing list entry
  const effectiveCompanyData = useMemo(() => {
    if (!companyData && !companyFromList) return null;
    const detail: any = companyData || {};
    const list: any = companyFromList || {};
    const merged: any = { ...list, ...detail };
    const detailHasAddress = Array.isArray(detail.address) && detail.address.length > 0;
    const listHasAddress = Array.isArray(list.address) && list.address.length > 0;
    if (detailHasAddress) {
      merged.address = detail.address;
    } else if (listHasAddress) {
      merged.address = list.address;
    } else if (detail.address !== undefined) {
      merged.address = detail.address;
    } else if (list.address !== undefined) {
      merged.address = list.address;
    }
    if (!merged.addresses && list.addresses) merged.addresses = list.addresses;
    if (!merged.settings && list.settings) merged.settings = list.settings;
    return merged;
  }, [companyData, companyFromList]);

  // Fetch users for the company using the correct hook
  const { data: usersData = [], isLoading: isLoadingUsers } = useUsers(
  companyId ? { companies: [companyId] } : {}
);
  // Extract users array from response
  const companyUsers = useMemo(() => {
    if (!usersData) return [];
    if (Array.isArray(usersData)) return usersData;
    if ((usersData as any)?.data && Array.isArray((usersData as any).data)) return (usersData as any).data;
    return [];
  }, [usersData]);

  // Set default conductedBy to current user when modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (user?._id && !interviewForm?.conductedBy) {
      setInterviewForm((prev: any) => ({ ...prev, conductedBy: user._id }));
    }
  }, [isOpen, user, interviewForm?.conductedBy, setInterviewForm]);

  const isUrl = (s?: string): boolean => {
    if (!s) return false;
    const t = String(s).trim();
    if (!t) return false;
    const l = t.toLowerCase();
    return l.startsWith('http://') || l.startsWith('https://') || t.startsWith('//') || l.startsWith('www.');
  };

  const normalizeUrl = (value: string): string => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (!isUrl(raw)) return raw;
    if (raw.startsWith('//')) return `https:${raw}`;
    const lower = raw.toLowerCase();
    if (!lower.startsWith('http://') && !lower.startsWith('https://') && lower.startsWith('www.')) return `https://${raw}`;
    return raw;
  };

  const getCompanyAddressEntries = (): Array<{ label: string; url: string }> => {
    try {
      const fallbackComp =
        (applicant && (applicant.company || applicant.companyObj)) ||
        (applicant as any)?.jobPositionId?.companyId ||
        (applicant as any)?.jobPositionId?.company ||
        null;
      const comp = effectiveCompanyData || companyData || fallbackComp;
      if (!comp) return [];

      const source = (comp as any).address ?? (comp as any).addresses ?? [];
      const list = Array.isArray(source) ? source : [source];
      const seen = new Set<string>();
      const out: Array<{ label: string; url: string }> = [];

      for (const item of list) {
        if (!item) continue;

        if (typeof item === 'string') {
          const url = isUrl(item) ? normalizeUrl(item) : '';
          const key = url || item.trim();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          out.push({ label: url || item.trim(), url: url || item.trim() });
          continue;
        }

        if (typeof item === 'object') {
          const urlRaw =
            (typeof (item as any).location === 'string' && (item as any).location.trim()) ||
            (typeof (item as any).url === 'string' && (item as any).url.trim()) ||
            '';
          const hasUrl = urlRaw && isUrl(urlRaw);
          const url = hasUrl ? normalizeUrl(urlRaw) : '';

          const en = typeof (item as any).en === 'string' ? (item as any).en.trim() : '';
          const ar = typeof (item as any).ar === 'string' ? (item as any).ar.trim() : '';
          const text = en || ar || toPlainString((item as any).address || (item as any).name || '');
          const fallback = text && !isUrl(text) ? text : '';
          const label = fallback || url;

          if (!label) continue;
          const key = url || label;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ label, url: url || label });
        }
      }

      if (out.length === 0) {
        const resolved = resolveCompanyAddress(comp);
        if (resolved && resolved.trim()) {
          out.push({ label: resolved.trim(), url: resolved.trim() });
        }
      }

      return out;
    } catch (e) {
      return [];
    }
  };

  const areSameUrls = (a: string, b: string): boolean => {
    const na = normalizeUrl(a || '');
    const nb = normalizeUrl(b || '');
    if (!na || !nb) return false;
    if (na === nb) return true;
    try {
      return decodeURIComponent(na) === decodeURIComponent(nb);
    } catch {
      return false;
    }
  };

  const formatTime12Hour = (value: string): string => {
    const raw = String(value || '').trim();
    if (!raw) return '[' + t('interviewTime', 'modals') + ']';
    if (raw.startsWith('{{') && raw.endsWith('}}')) return raw;
    if (raw.startsWith('[') && raw.endsWith(']')) return raw;

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

    const parsed = new Date(`1970-01-01T${raw}`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    return raw;
  };

  const handleTemplateSelect = (templateId: string) => {
    if (!templateId) {
      setSelectedTemplateId('');
      return;
    }
    
    const selectedTemplate = emailTemplates.find((t: EmailTemplate) => t._id === templateId);
    if (selectedTemplate) {
      let decodedHtml = selectedTemplate.html;
      try {
        decodedHtml = decodedHtml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      } catch (e) {
        decodedHtml = selectedTemplate.html;
      }
      
      if (notificationChannels.email && selectedTemplate.subject) {
        setInterviewEmailSubject(selectedTemplate.subject);
      }
      
      setMessageTemplate(decodedHtml);
      setSelectedTemplateId(templateId);
    }
  };

  const generateMessageTemplate = (channels: typeof notificationChannels = notificationChannels) => {
    if (!applicant) return '';

    const applicantName = bulkMode
      ? '{{candidateName}}'
      : (applicant.fullName || '').trim() || 'Candidate';
    const positionTitle = (() => {
      try {
        const title = getJobTitle?.();
        if (!title) return '{{jobTitle}}';
        if (typeof title === 'string') return title.trim() || '{{jobTitle}}';
        const en = typeof (title as any).en === 'string' ? (title as any).en.trim() : '';
        const ar = typeof (title as any).ar === 'string' ? (title as any).ar.trim() : '';
        return (en || ar) || '{{jobTitle}}';
      } catch {
        return '{{jobTitle}}';
      }
    })();
    const interviewDate = interviewForm.date
      ? (() => {
          const [year, month, day] = interviewForm.date.split('-');
          const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
          return date.toLocaleDateString(locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
          });
        })()
      : '{{InterviewDate}}';
    const interviewTime = bulkMode
      ? '{{interviewTime}}'
      : formatTime12Hour(interviewForm.time || '[' + t('interviewTime', 'modals') + ']');
    const interviewType = interviewForm.type || 'phone';
    const typeLabel = t(interviewType, 'modals');
    const location = (interviewForm.location || '').trim() || '[' + t('openLocation', 'modals') + ']';
    const link = (interviewForm.link || '').trim();
    const interviewDescription = (interviewForm.description || '').trim();
    const interviewComment = (interviewForm.comment || '').trim();

    const makeLocationHtml = (loc: string) => {
      const esc = escapeHtml;
      if (isUrl(loc)) {
        let href = loc;
        if (href.startsWith('//')) href = 'https:' + href;
        else if (!href.toLowerCase().startsWith('http://') && !href.toLowerCase().startsWith('https://') && href.toLowerCase().startsWith('www.')) href = 'https://' + href;
        const hrefEsc = esc(href);
        const textEsc = esc(loc);
        return `<a href="${hrefEsc}" target="_blank" rel="noopener noreferrer">${textEsc}</a>`;
      }
      return esc(loc);
    };

    const resolveAddressAndUrl = () => {
      const raw = (interviewForm.location || '').trim();
      const normalizedRaw = raw && isUrl(raw) ? normalizeUrl(raw) : raw;
      const entries = getCompanyAddressEntries();

      if (normalizedRaw) {
        const matched = entries.find((entry) => areSameUrls(entry.url, normalizedRaw));
        if (matched) {
          return { addressValue: matched.label, locationUrl: matched.url };
        }
      }

      if (normalizedRaw && isUrl(normalizedRaw)) {
        return { addressValue: '[' + t('addressOptional', 'modals') + ']', locationUrl: normalizedRaw };
      }

      if (normalizedRaw) {
        return { addressValue: normalizedRaw, locationUrl: '' };
      }

      return { addressValue: '[' + t('addressOptional', 'modals') + ']', locationUrl: '' };
    };
    
    const makeLinkHtml = (lnk: string) => {
      const esc = escapeHtml;
      if (!lnk) return '';
      if (isUrl(lnk)) {
        let href = lnk;
        if (href.startsWith('//')) href = 'https:' + href;
        else if (!href.toLowerCase().startsWith('http://') && !href.toLowerCase().startsWith('https://') && href.toLowerCase().startsWith('www.')) href = 'https://' + href;
        const hrefEsc = esc(href);
        const textEsc = esc(lnk);
        return `<a href="${hrefEsc}" target="_blank" rel="noopener noreferrer">${textEsc}</a>`;
      }
      return esc(lnk);
    };

    if (channels.email) {
      const esc = escapeHtml;
      const { addressValue, locationUrl } = resolveAddressAndUrl();
      const locationHtml = locationUrl ? makeLocationHtml(locationUrl) : '';
      const detailLines = [
        `${t('interviewDate', 'modals')}: ${esc(interviewDate)}`,
        `${t('interviewTime', 'modals')}: ${esc(interviewTime)}`,
        `${t('interviewType', 'modals')}: ${esc(typeLabel)}`,
        `${t('addressOptional', 'modals')}: ${esc(addressValue)}`,
      ];
      if (locationHtml) detailLines.push(`${t('openLocation', 'modals')}: ${locationHtml}`);
      if (link) detailLines.push(`${t('videoLinkOptional', 'modals')}: ${makeLinkHtml(link)}`);
      if (interviewDescription) detailLines.push(`${t('description', 'modals')}: ${esc(interviewDescription)}`);
      if (interviewComment) detailLines.push(`${t('comment', 'modals')}: ${esc(interviewComment)}`);
      const detailsBlock = detailLines.map((line) => `<p>${line}</p>`).join('');

      return (
        `<p>Dear ${esc(applicantName)},</p>` +
        `<p>We are pleased to invite you for an interview for the position of ${esc(positionTitle)}.</p>` +
        `<p><strong>Interview Details:</strong></p>${detailsBlock}` +
        `<p>Please confirm your availability at your earliest convenience.</p>` +
        `<p>Best regards,<br/>HR Team</p>`
      );
    } else if (channels.whatsapp) {
      const detailLines = [
        `${t('interviewDate', 'modals')}: ${interviewDate}`,
        `${t('interviewTime', 'modals')}: ${interviewTime}`,
        `${t('interviewType', 'modals')}: ${typeLabel}`,
        `${t('openLocation', 'modals')}: ${location}`,
      ];
      if (link) detailLines.push(`${t('videoLinkOptional', 'modals')}: ${link}`);
      if (interviewDescription) detailLines.push(`${t('description', 'modals')}: ${interviewDescription}`);
      if (interviewComment) detailLines.push(`${t('comment', 'modals')}: ${interviewComment}`);

      return `Hi ${applicantName}! 👋\n\nGreat news! We'd like to invite you for an interview for the position of ${positionTitle}.\n\nInterview details:\n${detailLines.join('\n')}\n\nPlease confirm if you're available. Looking forward to meeting you!`;
    } else if (channels.sms) {
      const detailParts = [`${t('interviewDate', 'modals')}: ${interviewDate}`, `${t('interviewTime', 'modals')}: ${interviewTime}`, `${t('interviewType', 'modals')}: ${typeLabel}`, `${t('openLocation', 'modals')}: ${location}`];
      if (link) detailParts.push(`${t('videoLinkOptional', 'modals')}: ${link}`);
      if (interviewDescription) detailParts.push(`${t('description', 'modals')}: ${interviewDescription}`);

      return `Hi ${applicantName}, you're invited for an interview for ${positionTitle}. Interview details: ${detailParts.join(' | ')}.${
        interviewComment ? ` ${t('comment', 'modals')}: ${interviewComment}.` : ''
      } Please confirm. - HR Team`;
    }

    return '';
  };

  const handleRegenerateTemplate = () => {
    setMessageTemplate(generateMessageTemplate());
  };

  const getAddressLabelFromLocation = (locationUrl: string): string => {
    if (!locationUrl) return '';
    const entries = getCompanyAddressEntries();
    const matched = entries.find((entry) => areSameUrls(entry.url, locationUrl));
    return matched?.label || '';
  };

  const handlePreview = () => {
    const baseInterviewDate = interviewForm.date 
      ? (() => {
          const [year, month, day] = interviewForm.date.split('-');
          const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          return date.toLocaleDateString(locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        })()
      : t('interviewDate', 'modals');
    
    const locationUrl = interviewForm.location || '';
    const addressLabel = getAddressLabelFromLocation(locationUrl);
    
    const createClickableLocation = (url: string, text?: string) => {
      if (!url) return '[' + t('openLocation', 'modals') + ']';
      const displayText = text || url;
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      return `<a href="${normalizedUrl}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${escapeHtml(displayText)}</a>`;
    };
    
    if (bulkMode && recipients && recipients.length > 0) {
      const previewSections = recipients.map((recipient: any, index: number) => {
        const applicantName = (() => {
          const name = recipient.fullName || 
                       recipient.applicantName || 
                       recipient.name || 
                       recipient.candidateName ||
                       (recipient.applicant?.fullName) ||
                       (recipient.applicant?.name) ||
                       recipient.email?.split('@')[0] || 
                       `Candidate ${index + 1}`;
          return name.trim();
        })();
        
        const jobTitle = (() => {
          try {
            const isMap = jobTitleById && typeof jobTitleById.get === 'function';
            
            if (recipient.jobTitle) return recipient.jobTitle;
            if (recipient.position) return recipient.position;
            
            if (typeof recipient.jobPositionId === 'string') {
              if (isMap) {
                const mapped = jobTitleById.get(recipient.jobPositionId);
                if (mapped) return mapped;
              } else if (jobTitleById && recipient.jobPositionId) {
                const mapped = (jobTitleById as any)[recipient.jobPositionId];
                if (mapped) {
                  const title = mapped.title || mapped.name;
                  if (typeof title === 'string') return title;
                  if (title?.en) return title.en;
                  if (title?.ar) return title.ar;
                }
              }
            }
            
            if (recipient.jobPositionId && typeof recipient.jobPositionId === 'object') {
              const title = recipient.jobPositionId.title || recipient.jobPositionId.name;
              if (typeof title === 'string') return title;
              if (title?.en) return title.en;
              if (title?.ar) return title.ar;
            }
            
            if (recipient.jobPosition) {
              if (typeof recipient.jobPosition === 'string') {
                if (isMap) {
                  const mapped = jobTitleById.get(recipient.jobPosition);
                  if (mapped) return mapped;
                } else if (jobTitleById && recipient.jobPosition) {
                  const mapped = (jobTitleById as any)[recipient.jobPosition];
                  if (mapped) {
                    const title = mapped.title || mapped.name;
                    if (typeof title === 'string') return title;
                    if (title?.en) return title.en;
                    if (title?.ar) return title.ar;
                  }
                }
              }
              if (typeof recipient.jobPosition === 'object') {
                const title = recipient.jobPosition.title || recipient.jobPosition.name;
                if (typeof title === 'string') return title;
                if (title?.en) return title.en;
                if (title?.ar) return title.ar;
              }
            }
            
            return '[' + t('interviewType', 'modals') + ']';
          } catch (error) {
            console.error('Error getting job title:', error);
            return '[' + t('interviewType', 'modals') + ']';
          }
        })();

        let interviewTimeDisplay = interviewForm.time || t('interviewTime', 'modals');
        if (bulkMode && intervalMinutes && index > 0 && interviewForm.time) {
          const [hours, minutes] = interviewForm.time.split(':').map(Number);
          const totalMinutes = (hours * 60) + minutes + (index * intervalMinutes);
          const newHours = Math.floor(totalMinutes / 60) % 24;
          const newMinutes = totalMinutes % 60;
          interviewTimeDisplay = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
        }
        
        const formattedTime = interviewTimeDisplay !== t('interviewTime', 'modals') ? formatTime12Hour(interviewTimeDisplay) : t('interviewTime', 'modals');
        
        const interviewType = interviewForm.type || 'phone';
        const typeLabel = t(interviewType, 'modals');
        
        let processedSubject = interviewEmailSubject || t('scheduleInterview', 'modals');
        let processedBody = messageTemplate || '';
        
        const clickableLocation = createClickableLocation(locationUrl, locationUrl);
        
        processedSubject = processedSubject
          .replace(/\{\{\s*candidateName\s*\}\}/gi, applicantName)
          .replace(/\{\{\s*(?:position|jobTitle)\s*\}\}/gi, jobTitle)
          .replace(/\{\{\s*InterviewDate\s*\}\}/gi, baseInterviewDate)
          .replace(/\{\{\s*interviewTime\s*\}\}/gi, formattedTime)
          .replace(/\{\{\s*interviewType\s*\}\}/gi, typeLabel)
          .replace(/\{\{\s*location\s*\}\}/gi, clickableLocation)
          .replace(/\{\{\s*address\s*\}\}/gi, addressLabel || '[' + t('addressOptional', 'modals') + ']');
        
        let bodyWithReplacements = processedBody;
        bodyWithReplacements = bodyWithReplacements
          .replace(/\{\{\s*candidateName\s*\}\}/gi, escapeHtml(applicantName))
          .replace(/\{\{\s*(?:position|jobTitle)\s*\}\}/gi, escapeHtml(jobTitle))
          .replace(/\{\{\s*InterviewDate\s*\}\}/gi, escapeHtml(baseInterviewDate))
          .replace(/\{\{\s*interviewTime\s*\}\}/gi, escapeHtml(formattedTime))
          .replace(/\{\{\s*interviewType\s*\}\}/gi, escapeHtml(typeLabel))
          .replace(/\{\{\s*location\s*\}\}/gi, clickableLocation)
          .replace(/\{\{\s*address\s*\}\}/gi, escapeHtml(addressLabel || '[' + t('addressOptional', 'modals') + ']'));
        
        return `
          <div style="margin-bottom: 40px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; page-break-inside: avoid;">
            <div style="background-color: #f3f4f6; padding: 12px 20px; border-bottom: 1px solid #e5e7eb;">
              <h3 style="margin: 0; font-size: 14px; color: #374151;">
                📧 ${escapeHtml(applicantName)}${jobTitle !== '[' + t('interviewType', 'modals') + ']' ? ` - ${escapeHtml(jobTitle)}` : ''}
              </h3>
              <div style="margin-top: 5px; font-size: 12px; color: #6b7280;">
                Time: ${escapeHtml(formattedTime)} | Date: ${escapeHtml(baseInterviewDate)}
              </div>
            </div>
            <div style="background-color: #ffffff; padding: 20px;">
              <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb;">
                <strong style="font-size: 14px;">Subject:</strong> 
                <span style="font-size: 14px;">${escapeHtml(processedSubject)}</span>
              </div>
              <div style="line-height: 1.6;">
                ${bodyWithReplacements || '<p>No content provided</p>'}
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      const previewHtmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${t('scheduleBulkPreviewTitle', 'modals')} - ${recipients.length} Recipients</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; margin: 0; background-color: #f5f5f5; }
            .container { max-width: 700px; margin: 0 auto; }
            .header { background-color: #ffffff; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .header h1 { color: #111827; margin: 0 0 10px 0; font-size: 24px; }
            .header p { color: #6b7280; margin: 0; font-size: 14px; }
            .preview-count { background-color: #dbeafe; border-radius: 6px; padding: 8px 12px; margin-top: 10px; font-size: 13px; color: #1e40af; }
            a { color: #3b82f6; text-decoration: underline; }
            a:hover { color: #2563eb; }
            @media print {
              body { background-color: white; padding: 0; }
              .header { box-shadow: none; border: 1px solid #e5e7eb; }
              .preview-count { background-color: #f3f4f6; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📧 Bulk Email Preview</h1>
              <p>Sending to ${recipients.length} recipient(s) on ${baseInterviewDate}</p>
              <div class="preview-count">
                ⏰ Time interval: ${intervalMinutes} minute(s) between each interview
              </div>
            </div>
            ${previewSections}
          </div>
        </body>
        </html>
      `;
      
      setPreviewHtml(previewHtmlContent);
      setShowPreviewModal(true);
    } else {
      const jobTitle = (() => {
        try {
          const title = getJobTitle?.();
          if (!title) return '';
          if (typeof title === 'string') return title.trim();
          const en = typeof (title as any).en === 'string' ? (title as any).en.trim() : '';
          const ar = typeof (title as any).ar === 'string' ? (title as any).ar.trim() : '';
          return en || ar || '';
        } catch {
          return '';
        }
      })();
      
      const applicantName = (applicant?.fullName || applicant?.applicantName || applicant?.name || '').trim() || 'Candidate';
      const interviewDate = baseInterviewDate;
      const interviewTime = interviewForm.time 
        ? formatTime12Hour(interviewForm.time)
        : t('interviewTime', 'modals');
      
      const interviewType = interviewForm.type || 'phone';
      const typeLabel = t(interviewType, 'modals');
      
      let processedSubject = interviewEmailSubject || t('scheduleInterview', 'modals');
      let processedBody = messageTemplate || '';
      
      const clickableLocation = createClickableLocation(locationUrl, locationUrl);
      
      processedSubject = processedSubject
        .replace(/\{\{\s*candidateName\s*\}\}/gi, escapeHtml(applicantName))
        .replace(/\{\{\s*(?:position|jobTitle)\s*\}\}/gi, escapeHtml(jobTitle || '[' + t('interviewType', 'modals') + ']'))
        .replace(/\{\{\s*InterviewDate\s*\}\}/gi, escapeHtml(interviewDate))
        .replace(/\{\{\s*interviewTime\s*\}\}/gi, escapeHtml(interviewTime))
        .replace(/\{\{\s*interviewType\s*\}\}/gi, escapeHtml(typeLabel))
        .replace(/\{\{\s*location\s*\}\}/gi, escapeHtml(locationUrl || '[' + t('openLocation', 'modals') + ']'))
        .replace(/\{\{\s*address\s*\}\}/gi, escapeHtml(addressLabel || '[' + t('addressOptional', 'modals') + ']'));
      
      let bodyWithReplacements = processedBody;
      bodyWithReplacements = bodyWithReplacements
        .replace(/\{\{\s*candidateName\s*\}\}/gi, escapeHtml(applicantName))
        .replace(/\{\{\s*(?:position|jobTitle)\s*\}\}/gi, escapeHtml(jobTitle || '[' + t('interviewType', 'modals') + ']'))
        .replace(/\{\{\s*InterviewDate\s*\}\}/gi, escapeHtml(interviewDate))
        .replace(/\{\{\s*interviewTime\s*\}\}/gi, escapeHtml(interviewTime))
        .replace(/\{\{\s*interviewType\s*\}\}/gi, escapeHtml(typeLabel))
        .replace(/\{\{\s*location\s*\}\}/gi, clickableLocation)
        .replace(/\{\{\s*address\s*\}\}/gi, escapeHtml(addressLabel || '[' + t('addressOptional', 'modals') + ']'));
      
      const previewHtmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${t('emailPreview', 'modals')}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; margin: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { background-color: #ffffff; border-bottom: 1px solid #e5e7eb; padding: 24px 30px; text-align: center; }
            .header h1 { color: #111827; margin: 0; font-size: 22px; font-weight: 700; }
            .content { padding: 30px; }
            .content p { margin: 0 0 16px 0; line-height: 1.6; }
            a { color: #3b82f6; text-decoration: underline; }
            a:hover { color: #2563eb; }
            hr { margin: 30px 0; border: none; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${escapeHtml(processedSubject) || 'No Subject'}</h1>
            </div>
            <div class="content">
              ${bodyWithReplacements || '<p>No content provided</p>'}
            </div>
          </div>
        </body>
        </html>
      `;
      
      setPreviewHtml(previewHtmlContent);
      setShowPreviewModal(true);
    }
  };

  // Stable handlers for DatePicker
  const handleDateChange = useCallback((selectedDates: Date[]) => {
    if (selectedDates.length > 0) {
      const date = selectedDates[0];
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      setInterviewForm((prev: any) => ({ ...prev, date: formattedDate }));
    }
  }, [setInterviewForm]);

  const handleTimeChange = useCallback((selectedDates: Date[]) => {
    if (selectedDates.length > 0) {
      const timeDate = selectedDates[0];
      const hours = String(timeDate.getHours()).padStart(2, '0');
      const minutes = String(timeDate.getMinutes()).padStart(2, '0');
      setInterviewForm((prev: any) => ({ ...prev, time: `${hours}:${minutes}` }));
    }
  }, [setInterviewForm]);

  const company = effectiveCompanyData || companyData || (applicant && (applicant.company || applicant.companyObj)) || null;
  const companyCompany = company || (applicant as any)?.jobPositionId?.companyId || (applicant as any)?.jobPositionId?.company || null;

  const senderOptions: Array<{ value: string; label: string }> = [];
  const availableCandidates: any[] = [];
  
  if (companyCompany) {
    const ms = (companyCompany as any).mailSettings || (companyCompany as any).settings?.mailSettings || null;
    if (ms && Array.isArray(ms.availableMails)) availableCandidates.push(...ms.availableMails);
    if (ms && Array.isArray(ms.available_senders)) availableCandidates.push(...ms.available_senders);
    if (ms && Array.isArray(ms.availableSenders)) availableCandidates.push(...ms.availableSenders);

    if (Array.isArray((companyCompany as any).availableMails)) availableCandidates.push(...(companyCompany as any).availableMails);
    if (Array.isArray((companyCompany as any).available_senders)) availableCandidates.push(...(companyCompany as any).available_senders);
  }

  const seen = new Set<string>();
  availableCandidates.forEach((m: any) => {
    let email = '';
    if (!m) return;
    if (typeof m === 'string') {
      email = m;
    } else if (typeof m === 'object') {
      email = m.email || m.address || m.value || '';
    }
    email = String(email || '').trim();
    if (!email) return;
    if (seen.has(email)) return;
    seen.add(email);
    senderOptions.push({ value: email, label: email });
  });

  const fallbackEmail = (companyCompany as any)?.contactEmail || (companyCompany as any)?.email;
  if (fallbackEmail && !senderOptions.find((s) => s.value === fallbackEmail)) {
    senderOptions.push({ value: fallbackEmail, label: fallbackEmail });
  }

  const [newLocalEmail, setNewLocalEmail] = useState('');

  const getCompanyDomain = () => {
    const domainFromResponse =
      (companyCompany as any)?.settings?.mailSettings?.companyDomain ||
      (companyCompany as any)?.mailSettings?.companyDomain ||
      '';

    if (domainFromResponse) {
      return domainFromResponse;
    }

    const defaultMail =
      (companyCompany as any)?.settings?.mailSettings?.defaultMail ||
      (companyCompany as any)?.mailSettings?.defaultMail ||
      (companyCompany as any)?.contactEmail ||
      (companyCompany as any)?.email ||
      '';

    if (defaultMail && defaultMail.includes('@')) {
      const extractedDomain = defaultMail.split('@')[1];
      return extractedDomain;
    }

    const firstAvailableMail =
      (companyCompany as any)?.settings?.mailSettings?.availableMails?.[0] ||
      (companyCompany as any)?.mailSettings?.availableMails?.[0];

    if (firstAvailableMail && firstAvailableMail.includes('@')) {
      const extractedDomain = firstAvailableMail.split('@')[1];
      return extractedDomain;
    }

    return '';
  };

  const companyDomain = getCompanyDomain();
  const domainForDisplay = companyDomain;

  const onSubmit = async (e: any) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    if (notificationChannels.email && emailOption === 'new' && newLocalEmail && newLocalEmail.trim()) {
      const local = newLocalEmail.trim();
      const domain = domainForDisplay;
      if (!domain) {
        setInterviewError(t('companyDomainRequired', 'modals'));
        return;
      }
      
      const newEmail = `${local}@${domain}`;
      
      // Instead of calling updateCompanySettings, just set the custom email
      // The actual addition to availableMails should be handled by the backend when sending
      setCustomEmail(newEmail);
    }

    if (!interviewForm?.date && !bulkMode) {
      setInterviewError(t('requiredDate', 'modals'));
      return;
    }

    if (!interviewForm?.conductedBy && !bulkMode) {
      setInterviewError(t('requiredConductedBy', 'modals'));
      return;
    }

    try {
      await handleInterviewSubmit(e);
    } catch (err: any) {
      const msg = (err && (err.message || err.response?.data?.message)) || t('scheduleError', 'modals');
      setInterviewError(String(msg));
    }
  };
  
  const companyAddressEntries = getCompanyAddressEntries();
  const companyAddressOptions = companyAddressEntries.map((entry) => ({
    value: entry.url,
    label: entry.label,
  }));

  const fallbackAddressInputValue = (() => {
    const raw = String(interviewForm.location || '').trim();
    if (!raw) return '';
    if (isUrl(raw)) return '';
    return raw;
  })();

  const currentLocationHref = (() => {
    const s = (interviewForm.location || '').trim();
    if (!isUrl(s)) return '';
    return normalizeUrl(s);
  })();

  const currentVideoHref = (() => {
    const s = (interviewForm.link || '').trim();
    if (!isUrl(s)) return '';
    return normalizeUrl(s);
  })();

  useEffect(() => {
    if (!isOpen || companyAddressEntries.length === 0) return;
    const current = String(interviewForm.location || '').trim();
    const hasMatch = !!current && companyAddressEntries.some((entry) => areSameUrls(entry.url, current));
    if (hasMatch) return;
    const firstUrl = companyAddressEntries[0]?.url || '';
    if (!firstUrl) return;
    setInterviewForm((prev: any) => ({ ...prev, location: firstUrl }));
  }, [isOpen, companyAddressEntries, interviewForm.location, setInterviewForm]);

  useEffect(() => {
    if (!isOpen || !notificationChannels.email) return;
    if (!messageTemplate) return;
    if (!/Address:\s*(?:\[Address\]|https?:\/\/|www\.)/i.test(messageTemplate)) return;
    const next = generateMessageTemplate(notificationChannels);
    if (next && next !== messageTemplate) {
      setMessageTemplate(next);
    }
  }, [
    isOpen,
    notificationChannels,
    messageTemplate,
    interviewForm.location,
    companyAddressEntries.length,
    setMessageTemplate,
  ]);

  const templateOptions = useMemo(() => {
    return [
      { value: '', label: t('selectTemplate', 'modals') },
      ...emailTemplates.map((tpl: EmailTemplate) => ({ 
        value: tpl._id || '', 
        label: tpl.name 
      }))
    ];
  }, [emailTemplates, t]);



  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[1100px] p-6 lg:p-10" closeOnBackdrop={false}>
      <form key={`interview-form-${formResetKey}`} onSubmit={onSubmit} className="flex flex-col px-2">
        <div>
            <h5 className="mb-2 font-semibold text-gray-800 text-xl dark:text-white/90 lg:text-2xl">
              {bulkMode ? t('scheduleInterviews', 'modals', { count: bulkCount }) : t('scheduleInterview', 'modals')}
            </h5>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {bulkMode
                ? t('scheduleBulkDesc', 'modals')
                : t('scheduleDesc', 'modals')}
            </p>
        </div>

        {interviewError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start justify-between">
              <p className="text-sm text-red-600 dark:text-red-400"><strong>{t('error', 'modals')}:</strong> {interviewError}</p>
              <button type="button" onClick={() => setInterviewError('')} className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300">✕</button>
            </div>
          </div>
        )}

        {/* Template Selector */}
        {emailTemplates.length > 0 && notificationChannels.email && (
          <div className="mt-4">
            <Label htmlFor="template-select">{t('loadEmailTemplate', 'modals')}</Label>
            <Select
              options={templateOptions}
              value={selectedTemplateId}
              onChange={(value) => handleTemplateSelect(value as string)}
              placeholder={t('selectTemplateToLoad', 'modals')}
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('templateAutoFillHtml', 'modals')}
            </p>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div className={`grid grid-cols-1 gap-4 ${bulkMode ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <div>
              <DatePicker id="interview-date" label={t('interviewDate', 'modals')} placeholder={t('selectInterviewDate', 'modals')} onChange={handleDateChange} />
            </div>
            <div>
             <div onClick={(e) => e.stopPropagation()}>
              <DatePicker 
                id="interview-time" 
                label={t('interviewTime', 'modals')} 
                mode="time" 
                placeholder={t('selectInterviewTime', 'modals')} 
                onChange={handleTimeChange} 
              />
            </div>
            </div>
            <div>
              <Label htmlFor="interview-type">{t('interviewType', 'modals')}</Label>
              <Select options={[{ value: 'phone', label: t('phone', 'modals') },{ value: 'video', label: t('video', 'modals') },{ value: 'in-person', label: t('inPerson', 'modals') }]} placeholder={t('interviewType', 'modals')} onChange={(value: any) => setInterviewForm({ ...interviewForm, type: value })} />
            </div>
            {bulkMode && (
              <div>
                <Label htmlFor="interview-interval">{t('intervalMinutes', 'modals')}</Label>
                <Input
                  id="interview-interval"
                  type="number"
                  min="1"
                  value={intervalMinutes}
                  onChange={(e: any) => {
                    if (!setIntervalMinutes) return;
                    const next = Number(e.target.value);
                    setIntervalMinutes(Number.isFinite(next) && next > 0 ? next : 1);
                  }}
                  placeholder="15"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="interview-location-select">{t('addressOptional', 'modals')}</Label>
              {companyAddressOptions.length > 0 ? (
                <>
                  <Select
                    options={companyAddressOptions}
                    value={currentLocationHref || ''}
                    placeholder={t('selectCompanyAddress', 'modals')}
                    onChange={(value: any) => {
                      setInterviewForm({ ...interviewForm, location: value });
                      setInterviewError('');
                    }}
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('addressAutoUse', 'modals')}</p>
                </>
              ) : (
                <>
                  <Input id="interview-location-select" type="text" value={fallbackAddressInputValue} onChange={(e: any) => setInterviewForm({ ...interviewForm, location: e.target.value })} placeholder={t('officeAddressPlaceholder', 'modals')} />
                  <div className="mt-2">
                    <button type="button" onClick={() => {
                      const result = fillCompanyAddress?.();
                      if (result === false) {
                        setInterviewError(t('noCompanyAddress', 'modals'));
                      } else {
                        setInterviewError('');
                      }
                    }} className="text-sm text-brand-600 hover:underline">{t('useCompanyAddress', 'modals')}</button>
                  </div>
                </>
              )}

              {currentLocationHref ? (
                <div className="mt-2">
                  <a href={currentLocationHref} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">{t('openLocation', 'modals')}</a>
                </div>
              ) : null}
            </div>
            {interviewForm.type === 'video' && (
              <div>
                <Label htmlFor="interview-link">{t('videoLinkOptional', 'modals')}</Label>
                <div className="flex items-center gap-3">
                  <Input id="interview-link" type="url" value={interviewForm.link} onChange={(e: any) => setInterviewForm({ ...interviewForm, link: e.target.value })} placeholder={t('videoLinkPlaceholder', 'modals')} />
                  {currentVideoHref ? (
                    <a href={currentVideoHref} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">{t('openVideo', 'modals')}</a>
                  ) : null}
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="interview-conducted-by">{t('conductedBy', 'modals')}</Label>
              <Select
                options={[
                  { value: user?._id || '', label: toPlainString(user?.fullName || user?.name || user?.email || t('conductedBy', 'modals')) },
                  ...companyUsers.filter((u: any) => u._id !== user?._id).map((u: any) => ({ 
                    value: u._id, 
                    label: toPlainString(u.fullName || u.name || u.email || u.username || u._id) 
                  }))
                ]}
                value={interviewForm.conductedBy || user?._id || ''}
                placeholder={t('selectInterviewer', 'modals')}
                onChange={(value: any) => { 
                  setInterviewForm({ ...interviewForm, conductedBy: value }); 
                  setInterviewError(''); 
                }}
              />
              <p className="mt-1 text-xs text-gray-500">{t('requiredConductedBy', 'modals')}</p>
              {isLoadingUsers && <p className="mt-1 text-xs text-gray-400">{t('loadingUsers', 'modals')}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="interview-description">{t('description', 'modals')}</Label>
              <TextArea value={interviewForm.description} onChange={(value: any) => setInterviewForm({ ...interviewForm, description: value })} placeholder={t('descriptionPlaceholder', 'modals')} rows={2} />
            </div>
            <div>
              <Label htmlFor="interview-comment">{t('comment', 'modals')}</Label>
              <TextArea value={interviewForm.comment} onChange={(value: any) => setInterviewForm({ ...interviewForm, comment: value })} placeholder={t('commentPlaceholder2', 'modals')} rows={2} />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
            <h3 className="mb-3 text-base font-medium text-gray-800 dark:text-white/90">{t('notificationSettings', 'modals')}</h3>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">{t('sendNotificationVia', 'modals')}:</label>
              <div className="flex flex-wrap gap-3">
                <label className="group relative inline-flex items-center gap-3 cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 transition-all hover:border-brand-400 hover:bg-brand-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-brand-600 dark:hover:bg-brand-900/20">
                  <input type="checkbox" checked={notificationChannels.email} onChange={() => { const next = { ...notificationChannels, email: !notificationChannels.email }; setNotificationChannels(next); if (!notificationChannels.email) setEmailOption('company'); setMessageTemplate(generateMessageTemplate(next)); setSelectedTemplateId(''); }} className="peer sr-only" />
                  <div className="h-5 w-5 rounded border-2 border-gray-300 bg-white transition-all peer-checked:border-brand-600 peer-checked:bg-brand-600 dark:border-gray-600 dark:bg-gray-700 dark:peer-checked:border-brand-500 dark:peer-checked:bg-brand-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white scale-0 peer-checked:scale-100 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">📧 {t('email', 'modals')}</span>
                </label>
                <label className="group relative inline-flex items-center gap-3 cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 transition-all hover:border-brand-400 hover:bg-brand-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-brand-600 dark:hover:bg-brand-900/20">
                  <input type="checkbox" checked={notificationChannels.sms} onChange={() => { const next = { ...notificationChannels, sms: !notificationChannels.sms }; setNotificationChannels(next); if (!notificationChannels.sms) setPhoneOption('company'); setMessageTemplate(generateMessageTemplate(next)); setSelectedTemplateId(''); }} className="peer sr-only" />
                  <div className="h-5 w-5 rounded border-2 border-gray-300 bg-white transition-all peer-checked:border-brand-600 peer-checked:bg-brand-600 dark:border-gray-600 dark:bg-gray-700 dark:peer-checked:border-brand-500 dark:peer-checked:bg-brand-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white scale-0 peer-checked:scale-100 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">💬 {t('sms', 'modals')}</span>
                </label>
                <label className="group relative inline-flex items-center gap-3 cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 transition-all hover:border-brand-400 hover:bg-brand-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-brand-600 dark:hover:bg-brand-900/20">
                  <input type="checkbox" checked={notificationChannels.whatsapp} onChange={() => { const next = { ...notificationChannels, whatsapp: !notificationChannels.whatsapp }; setNotificationChannels(next); if (!notificationChannels.whatsapp) setPhoneOption('whatsapp'); setMessageTemplate(generateMessageTemplate(next)); setSelectedTemplateId(''); }} className="peer sr-only" />
                  <div className="h-5 w-5 rounded border-2 border-gray-300 bg-white transition-all peer-checked:border-brand-600 peer-checked:bg-brand-600 dark:border-gray-600 dark:bg-gray-700 dark:peer-checked:border-brand-500 dark:peer-checked:bg-brand-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white scale-0 peer-checked:scale-100 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">📱 {t('whatsapp', 'modals')}</span>
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {notificationChannels.email && (
                  <div className="space-y-2">
                    <Label htmlFor="sender-select">{t('senderEmailOption', 'modals')}</Label>
                    <Select
                      options={senderOptions.length > 0 ? senderOptions : [{ value: '', label: t('sender', 'modals') }]}
                      value={customEmail || ''}
                      placeholder={t('sender', 'modals')}
                      onChange={(value: any) => {
                        setCustomEmail(value);
                        setEmailOption('company');
                      }}
                    />
                  </div>
                )}

                {(notificationChannels.sms || notificationChannels.whatsapp) && (
                  <div className="space-y-2">
                    <Label htmlFor="phone-option">{t('sms', 'modals')}</Label>
                    {notificationChannels.sms ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-700/50"><p className="text-sm font-medium text-gray-700 dark:text-gray-300">Company Number (SMS)</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">SMS will be sent from the company number only</p></div>
                    ) : (
                      <>
                        <Select options={[{ value: 'company', label: 'Company Number' },{ value: 'user', label: 'My Phone' },{ value: 'whatsapp', label: 'Current WhatsApp Number' },{ value: 'custom', label: 'Custom Number' }]} value={phoneOption} placeholder="Select phone option" onChange={(value: any) => setPhoneOption(value)} />
                        {phoneOption === 'custom' && <Input id="custom-phone" type="tel" value={customPhone} onChange={(e: any) => setCustomPhone(e.target.value)} placeholder="Enter custom phone number" className="mt-2" />}
                      </>
                    )}
                  </div>
                )}
              </div>

            </div>
            {(notificationChannels.email || notificationChannels.sms || notificationChannels.whatsapp) && (
              <div className="mt-4">
                <Label htmlFor="message-template">Message Template
                  <button type="button" onClick={handleRegenerateTemplate} className="ml-2 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">🔄 {t('loadTemplate', 'modals')}</button>
                </Label>
                {notificationChannels.email ? (
                  <>
                    <div className="mt-2">
                      <Label htmlFor="interview-subject">Email Subject</Label>
                      <Input id="interview-subject" type="text" value={interviewEmailSubject} onChange={(e: any) => setInterviewEmailSubject(e.target.value)} placeholder="Email subject" />
                      <p className="mt-1 text-xs text-gray-500">
  {t('availableVariables', 'modals')}: {'{{candidateName}}'}, {'{{jobTitle}}'}, {'{{InterviewDate}}'}, {'{{interviewTime}}'}, {'{{interviewType}}'}, {'{{location}}'}, {'{{address}}'}
</p>
                    </div>
                    <div className="mt-3">
<RichTextEditor value={messageTemplate} onChange={(content: string) => setMessageTemplate(content)} minHeight={120} />
                      <p className="mt-1 text-xs text-gray-500">
                        {t('availableVariables', 'modals')}: {'{{candidateName}}'}, {'{{jobTitle}}'}, {'{{InterviewDate}}'}, {'{{interviewTime}}'}, {'{{interviewType}}'}
                      </p>
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
  <strong>{t('quickInsert', 'modals')}:</strong>{' '}
  <button type="button" onClick={() => setMessageTemplate(messageTemplate + '{{candidateName}}')} className="text-blue-600 hover:underline mx-1">{'{{candidateName}}'}</button>
  <button type="button" onClick={() => setMessageTemplate(messageTemplate + '{{jobTitle}}')} className="text-blue-600 hover:underline mx-1">{'{{jobTitle}}'}</button>
  <button type="button" onClick={() => setMessageTemplate(messageTemplate + '{{InterviewDate}}')} className="text-blue-600 hover:underline mx-1">{'{{InterviewDate}}'}</button>
  <button type="button" onClick={() => setMessageTemplate(messageTemplate + '{{interviewTime}}')} className="text-blue-600 hover:underline mx-1">{'{{interviewTime}}'}</button>
  <button type="button" onClick={() => setMessageTemplate(messageTemplate + '{{interviewType}}')} className="text-blue-600 hover:underline mx-1">{'{{interviewType}}'}</button>
  <button type="button" onClick={() => setMessageTemplate(messageTemplate + '{{location}}')} className="text-blue-600 hover:underline mx-1">{'{{location}}'}</button>
  <button type="button" onClick={() => setMessageTemplate(messageTemplate + '{{address}}')} className="text-blue-600 hover:underline mx-1">{'{{address}}'}</button>
</div>
                    </div>
                  </>
                ) : (
                  <>
                    <RichTextEditor value={messageTemplate} onChange={(content: string) => setMessageTemplate(content)} minHeight={120} />
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                      <strong>{t('quickInsert', 'modals')}:</strong>{' '}
                      <button type="button" onClick={() => setMessageTemplate(messageTemplate + '{{candidateName}}')} className="text-blue-600 hover:underline mx-1">{'{{candidateName}}'}</button>
                      <button type="button" onClick={() => setMessageTemplate(messageTemplate + '{{jobTitle}}')} className="text-blue-600 hover:underline mx-1">{'{{jobTitle}}'}</button>
                      <button type="button" onClick={() => setMessageTemplate(messageTemplate + '{{InterviewDate}}')} className="text-blue-600 hover:underline mx-1">{'{{InterviewDate}}'}</button>
                      <button type="button" onClick={() => setMessageTemplate(messageTemplate + '{{interviewTime}}')} className="text-blue-600 hover:underline mx-1">{'{{interviewTime}}'}</button>
                      <button type="button" onClick={() => setMessageTemplate(messageTemplate + '{{interviewType}}')} className="text-blue-600 hover:underline mx-1">{'{{interviewType}}'}</button>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>

        <div className="flex items-center gap-3 mt-6 sm:justify-end">
          <button type="button" onClick={onClose} disabled={isSubmittingInterview} className="flex w-full justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] sm:w-auto">{t('cancel', 'modals')}</button>
          {(notificationChannels.email || notificationChannels.sms || notificationChannels.whatsapp) && (
            <button 
              type="button" 
              onClick={handlePreview}
              className="flex w-full justify-center rounded-lg border border-stroke px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800 sm:w-auto"
            >
              {bulkMode ? t('scheduleBulkPreviewTitle', 'modals') : t('previewEmail', 'modals')}
            </button>
          )}
          <button type="submit" disabled={isSubmittingInterview} className="flex w-full justify-center items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto">
            {isSubmittingInterview ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{t('scheduleInterview', 'modals')}...</span>
              </>
            ) : (
              <span>{t('scheduleInterview', 'modals')}</span>
            )}
          </button>
        </div>

      </form>
    </Modal>
  );
}