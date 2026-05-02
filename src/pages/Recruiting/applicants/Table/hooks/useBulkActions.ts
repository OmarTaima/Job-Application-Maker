// hooks/useBulkActions.ts
import { useState, useCallback } from 'react';
import Swal from '../../../../../utils/swal';
import {
  useScheduleBulkInterviews,
  useBatchUpdateApplicantStatus,
} from '../../../../../hooks/queries/useApplicants';
import type {
  BulkStatusForm,
  BulkInterviewForm,
  BulkNotificationChannels,
  UseBulkActionsProps,
  UseBulkActionsReturn,
} from '../../../../../types/applicants';

const getErrorMessage = (err: any): string => {
  if (err.response?.data?.details && Array.isArray(err.response.data.details)) {
    return err.response.data.details
      .map((detail: any) => {
        const field = detail.path?.[0] || '';
        const message = detail.message || '';
        return field ? `${field}: ${message}` : message;
      })
      .join(', ');
  }
  if (err.response?.data?.errors) {
    const { errors } = err.response.data;
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

export function useBulkActions({
  selectedApplicantIds,
  selectedApplicantsForInterview,
  selectedApplicantCompanyId,
  selectedApplicantCompany,
  refetchApplicants,
  queryClient,
  onClearSelection,
}: UseBulkActionsProps): UseBulkActionsReturn {
  const batchUpdateStatusMutation = useBatchUpdateApplicantStatus();
  const scheduleBulkInterviewsMutation = useScheduleBulkInterviews();

  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmittingBulkInterview, setIsSubmittingBulkInterview] = useState(false);
  const [isSubmittingBulkStatus, setIsSubmittingBulkStatus] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showBulkInterviewModal, setShowBulkInterviewModal] = useState(false);
  const [showBulkInterviewPreviewModal, setShowBulkInterviewPreviewModal] = useState(false);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [showBulkPreviewFallbackModal, setShowBulkPreviewFallbackModal] = useState(false);
  const [bulkFormResetKey] = useState(0);
  const [bulkInterviewError, setBulkInterviewError] = useState('');
  const [bulkStatusError, setBulkStatusError] = useState('');
  const [bulkDeleteError, setBulkDeleteError] = useState('');
  const [bulkAction, setBulkAction] = useState('');
  const [bulkInterviewIntervalMinutes, setBulkInterviewIntervalMinutes] = useState(15);
  const [bulkInterviewForm, setBulkInterviewForm] = useState<BulkInterviewForm>({
    date: '',
    time: '',
    description: '',
    comment: '',
    location: '',
    link: '',
    type: 'phone',
  });
  const [bulkNotificationChannels, setBulkNotificationChannels] = useState<BulkNotificationChannels>({
    email: true,
    sms: false,
    whatsapp: false,
  });
  const [bulkEmailOption, setBulkEmailOption] = useState<'company' | 'new'>('company');
  const [bulkCustomEmail, setBulkCustomEmail] = useState('');
  const [bulkPhoneOption, setBulkPhoneOption] = useState<'company' | 'user' | 'whatsapp' | 'custom'>('company');
  const [bulkCustomPhone, setBulkCustomPhone] = useState('');
  const [bulkMessageTemplate, setBulkMessageTemplate] = useState('');
  const [bulkInterviewEmailSubject, setBulkInterviewEmailSubject] = useState('Interview Invitation');
  const [bulkPreviewHtml, setBulkPreviewHtml] = useState('');
  const [bulkInterviewPreviewItems, setBulkInterviewPreviewItems] = useState<any[]>([]);
  const [bulkStatusForm, setBulkStatusForm] = useState<BulkStatusForm>({
    status: '',
    reasons: [],
    notes: '',
  });

  const clearSelection = useCallback(() => {
    if (onClearSelection) {
      onClearSelection();
    }
  }, [onClearSelection]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedApplicantIds.length === 0) return;

    const result = await Swal.fire({
      title: 'Delete Applicants?',
      text: `Are you sure you want to delete ${selectedApplicantIds.length} applicant(s)? They will be moved to trash.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete them!',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) return;

    const updates = selectedApplicantIds.map((applicantId) => ({
      applicantId: applicantId,
      status: 'trashed',
      notes: `Moved to trash on ${new Date().toLocaleDateString()}`,
    }));

    try {
      setIsDeleting(true);
      await batchUpdateStatusMutation.mutateAsync(updates);

      await Swal.fire({
        title: 'Success!',
        text: `${selectedApplicantIds.length} applicant(s) moved to trash.`,
        icon: 'success',
        position: 'center',
        timer: 2000,
        showConfirmButton: false,
      });

      clearSelection();
      await refetchApplicants();
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
    } catch (err: any) {
      console.error('Error deleting applicants:', err);
      setBulkDeleteError(err.message || 'Failed to delete applicants');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedApplicantIds, batchUpdateStatusMutation, refetchApplicants, queryClient, clearSelection]);

  const handleBulkStatusChange = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedApplicantIds.length === 0) return;

      if (!bulkStatusForm.status || bulkStatusForm.status.trim() === '') {
        setBulkStatusError('Please select a status before submitting.');
        return;
      }

      const updates = selectedApplicantIds.map((applicantId) => {
        const update: any = {
          applicantId: applicantId,
          status: bulkStatusForm.status,
        };

        if (bulkStatusForm.notes && bulkStatusForm.notes.trim()) {
          update.notes = bulkStatusForm.notes.trim();
        }

        if (Array.isArray(bulkStatusForm.reasons) && bulkStatusForm.reasons.length) {
          update.reasons = bulkStatusForm.reasons.map((r) => String(r ?? '').trim()).filter(Boolean);
        }

        return update;
      });

      try {
        setIsSubmittingBulkStatus(true);
        setBulkStatusError('');

        await batchUpdateStatusMutation.mutateAsync(updates);

        await Swal.fire({
          title: 'Success!',
          text: `Status updated for ${selectedApplicantIds.length} applicant(s).`,
          icon: 'success',
          position: 'center',
          timer: 2000,
          showConfirmButton: false,
        });

        clearSelection();
        setBulkAction('');
        setShowBulkStatusModal(false);
        setBulkStatusForm({ status: '', reasons: [], notes: '' });
        await refetchApplicants();
        queryClient.invalidateQueries({ queryKey: ['applicants'] });
      } catch (err: any) {
        console.error('Error bulk changing status:', err);
        setBulkStatusError(err.message || 'Failed to update statuses');
      } finally {
        setIsSubmittingBulkStatus(false);
      }
    },
    [selectedApplicantIds, bulkStatusForm, batchUpdateStatusMutation, refetchApplicants, queryClient, clearSelection]
  );

  const handleBulkChangeStatus = useCallback(
    async (action: string) => {
      if (selectedApplicantIds.length === 0 || !action) return;

      if (action === 'rejected') {
        setBulkStatusForm({ status: 'rejected', reasons: [], notes: '' });
        setBulkStatusError('');
        setShowBulkStatusModal(true);
        return;
      }

      const result = await Swal.fire({
        title: 'Change Status?',
        text: `Are you sure you want to change the status of ${selectedApplicantIds.length} applicant(s) to ${action}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, change it!',
      });

      if (!result.isConfirmed) return;

      try {
        setIsProcessing(true);
        
        const updates = selectedApplicantIds.map((applicantId) => ({
          applicantId: applicantId,
          status: action,
          notes: `Bulk status change to ${action} on ${new Date().toLocaleDateString()}`,
        }));
        
        await batchUpdateStatusMutation.mutateAsync(updates);

        await Swal.fire({
          title: 'Success!',
          text: `Status updated for ${selectedApplicantIds.length} applicant(s).`,
          icon: 'success',
          position: 'center',
          timer: 2000,
          showConfirmButton: false,
        });

        clearSelection();
        setBulkAction('');
        await refetchApplicants();
        queryClient.invalidateQueries({ queryKey: ['applicants'] });
      } catch (err: any) {
        console.error('Error changing status:', err);
        setBulkStatusError(getErrorMessage(err));
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedApplicantIds, batchUpdateStatusMutation, refetchApplicants, queryClient, clearSelection]
  );

  const getSelectedCompanyAddress = useCallback((): string => {
    const c: any = selectedApplicantCompany || {};
    const isInvalidAddressString = (value: string) => {
      const s = String(value || '').trim();
      if (!s) return true;
      if (/^[a-f0-9]{24}$/i.test(s)) return true;
      if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) return true;
      return false;
    };
    
    const candidates = [
      c.address,
      c.location,
      c.officeAddress,
      c.contactAddress,
      c.settings?.address,
      c.settings?.companyAddress,
    ];

    for (const value of candidates) {
      const plain = String(value || '').trim();
      if (plain && plain.trim() && !isInvalidAddressString(plain)) {
        return plain.trim();
      }
    }

    for (const [key, value] of Object.entries(c)) {
      if (!/address|location/i.test(key)) continue;
      const plain = String(value || '').trim();
      if (plain && plain.trim() && !isInvalidAddressString(plain)) {
        return plain.trim();
      }
    }

    return '';
  }, [selectedApplicantCompany]);

  const fillBulkCompanyAddress = useCallback((): boolean => {
    const address = getSelectedCompanyAddress();
    if (!address) return false;
    setBulkInterviewForm((prev) => ({ ...prev, location: address }));
    return true;
  }, [getSelectedCompanyAddress]);

  const resetBulkInterviewModal = useCallback(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const defaultDate = `${year}-${month}-${day}`;
    
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    const hours = String(nextHour.getHours()).padStart(2, '0');
    const minutes = '00';
    const defaultTime = `${hours}:${minutes}`;
    
    setBulkInterviewForm({
      date: defaultDate,
      time: defaultTime,
      type: 'phone',
      location: '',
      link: '',
      description: '',
      comment: '',
    });
    setBulkInterviewError('');
    setBulkInterviewIntervalMinutes(15);
    setBulkNotificationChannels({ email: true, sms: false, whatsapp: false });
    setBulkEmailOption('company');
    setBulkCustomEmail('');
    setBulkPhoneOption('company');
    setBulkCustomPhone('');
    setBulkMessageTemplate('');
    setBulkInterviewEmailSubject('Interview Invitation');
  }, []);

  const openBulkInterviewModal = useCallback(async () => {
    if (selectedApplicantsForInterview.length === 0) return;

    if (!selectedApplicantCompanyId) {
      await Swal.fire({
        title: 'Single Company Required',
        text: 'Please select applicants from one company to schedule interviews together.',
        icon: 'warning',
      });
      return;
    }

    resetBulkInterviewModal();
    
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const defaultDate = `${year}-${month}-${day}`;
    
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    const hours = String(nextHour.getHours()).padStart(2, '0');
    const minutes = '00';
    const defaultTime = `${hours}:${minutes}`;
    
    let defaultLocation = '';
    if (selectedApplicantCompany) {
      const addresses = selectedApplicantCompany?.address || selectedApplicantCompany?.addresses || [];
      if (addresses.length > 0) {
        const firstAddress = addresses[0];
        if (typeof firstAddress === 'string') {
          defaultLocation = firstAddress;
        } else if (firstAddress?.location) {
          defaultLocation = firstAddress.location;
        } else if (firstAddress?.en) {
          defaultLocation = firstAddress.en;
        }
      }
    }
    
    setBulkInterviewForm({
      date: defaultDate,
      time: defaultTime,
      type: 'phone',
      location: defaultLocation,
      link: '',
      description: '',
      comment: '',
    });
    
    setShowBulkInterviewModal(true);
  }, [selectedApplicantsForInterview, selectedApplicantCompanyId, selectedApplicantCompany, resetBulkInterviewModal]);

  const buildBulkInterviewPreview = useCallback(() => {
    if (selectedApplicantsForInterview.length === 0) {
      return { error: 'Please select at least one applicant.', items: [] };
    }

    const baseDate = new Date();
    const items = selectedApplicantsForInterview.map((candidate, index) => {
      const scheduled = new Date(baseDate.getTime() + index * bulkInterviewIntervalMinutes * 60000);
      
      const interviewDate = scheduled.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      
      const interviewTime = scheduled.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      return {
        applicantId: candidate.applicantId,
        applicantName: candidate.applicantName,
        applicantNo: candidate.applicantNo?.toString() || '-',
        to: candidate.email,
        companyId: candidate.companyId,
        jobPositionId: candidate.jobPositionId,
        scheduledAt: scheduled.toISOString(),
        scheduledLabel: `${interviewDate} at ${interviewTime}`,
        subject: bulkInterviewEmailSubject,
        html: '',
        status: candidate.status,
      };
    });

    return { error: '', items };
  }, [selectedApplicantsForInterview, bulkInterviewIntervalMinutes, bulkInterviewEmailSubject]);

  const handlePreviewBulkInterviews = useCallback(() => {
    setBulkInterviewError('');
    const built = buildBulkInterviewPreview();
    if (built.error) {
      setBulkInterviewError(built.error);
      return;
    }
    setBulkInterviewPreviewItems(built.items);
    setShowBulkInterviewPreviewModal(true);
  }, [buildBulkInterviewPreview]);

  const handleBulkInterviewSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBulkInterviewError('');

      const built = buildBulkInterviewPreview();
      if (built.error) {
        setBulkInterviewError(built.error);
        return;
      }

      const previewItems = built.items;
      const missingEmails = previewItems.filter((item: any) => !item.to);

      try {
        setIsSubmittingBulkInterview(true);

        const bulkInterviewPayload = previewItems.map((item: any) => ({
          applicantId: item.applicantId,
          scheduledAt: item.scheduledAt,
          conductedBy: undefined,
          description: bulkInterviewForm.description || undefined,
          type: bulkInterviewForm.type,
          location: bulkInterviewForm.location || undefined,
          address: bulkInterviewForm.location || undefined,
          videoLink: bulkInterviewForm.link || undefined,
          notes: bulkInterviewForm.comment || undefined,
          status: 'scheduled' as const,
        }));

        await scheduleBulkInterviewsMutation.mutateAsync(bulkInterviewPayload);

        const statusUpdates = previewItems
          .filter((item: any) => item.status !== 'interview')
          .map((item: any) => ({
            applicantId: item.applicantId,
            status: 'interview',
            notes: `Status updated to interview on ${new Date().toLocaleDateString()} (bulk interview scheduling)`,
          }));
        
        if (statusUpdates.length > 0) {
          await batchUpdateStatusMutation.mutateAsync(statusUpdates);
        }

        let emailResultNote = '';
        if (bulkNotificationChannels.email) {
          const emailableItems = previewItems.filter((item: any) => Boolean(item.to));
          if (emailableItems.length > 0) {
            if (missingEmails.length > 0) {
              emailResultNote = `Email sent to ${emailableItems.length} applicant(s); ${missingEmails.length} without email were skipped.`;
            }
          }
        }

        const successMessageBase = `Interviews scheduled for ${previewItems.length} applicant(s).`;
        const successText = emailResultNote ? `${successMessageBase} ${emailResultNote}` : successMessageBase;

        await Swal.fire({
          title: 'Success!',
          text: successText,
          icon: 'success',
          position: 'center',
          timer: 2000,
          showConfirmButton: false,
        });

        clearSelection();
        setShowBulkInterviewModal(false);
        setShowBulkInterviewPreviewModal(false);
        resetBulkInterviewModal();
        await refetchApplicants();
      } catch (err: any) {
        console.error('Error scheduling bulk interviews:', err);
        setBulkInterviewError(getErrorMessage(err));
      } finally {
        setIsSubmittingBulkInterview(false);
      }
    },
    [
      buildBulkInterviewPreview,
      bulkInterviewForm,
      bulkNotificationChannels,
      scheduleBulkInterviewsMutation,
      batchUpdateStatusMutation,
      clearSelection,
      resetBulkInterviewModal,
      refetchApplicants,
    ]
  );

  return {
    isDeleting,
    isProcessing,
    isSubmittingBulkInterview,
    isSubmittingBulkStatus,
    showBulkModal,
    showBulkInterviewModal,
    showBulkInterviewPreviewModal,
    showBulkStatusModal,
    showBulkPreviewFallbackModal,
    bulkFormResetKey,
    bulkInterviewError,
    bulkStatusError,
    bulkDeleteError,
    bulkInterviewIntervalMinutes,
    bulkInterviewForm,
    bulkNotificationChannels,
    bulkEmailOption,
    bulkCustomEmail,
    bulkPhoneOption,
    bulkCustomPhone,
    bulkMessageTemplate,
    bulkInterviewEmailSubject,
    bulkPreviewHtml,
    bulkInterviewPreviewItems,
    bulkStatusForm,
    bulkAction,
    setShowBulkModal,
    setShowBulkInterviewModal,
    setShowBulkInterviewPreviewModal,
    setShowBulkStatusModal,
    setShowBulkPreviewFallbackModal,
    setBulkInterviewError,
    setBulkStatusError,
    setBulkDeleteError,
    setBulkInterviewIntervalMinutes,
    setBulkInterviewForm,
    setBulkNotificationChannels,
    setBulkEmailOption,
    setBulkCustomEmail,
    setBulkPhoneOption,
    setBulkCustomPhone,
    setBulkMessageTemplate,
    setBulkInterviewEmailSubject,
    setBulkPreviewHtml,
    setBulkInterviewPreviewItems,
    setBulkStatusForm,
    setBulkAction,
    setIsProcessing,
    handleBulkDelete,
    handleBulkStatusChange,
    handleBulkInterviewSubmit,
    handlePreviewBulkInterviews,
    handleBulkChangeStatus,
    openBulkInterviewModal,
    resetBulkInterviewModal,
    fillBulkCompanyAddress,
    getSelectedCompanyAddress,
  };
}