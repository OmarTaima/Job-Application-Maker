import React, { useMemo, useEffect} from 'react';
import { Modal } from '../ui/modal';
import Label from '../form/Label';
import Select from '../form/Select';
import TextArea from '../form/input/TextArea';
import MultiSelect from '../form/MultiSelect';
import { useCompanySettings } from '../../hooks/queries/useCompanies';
import { useStatusSettings } from '../../utils/useStatusSettings';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  statusForm: any;
  setStatusForm: (v: any) => void;
  statusError: string;
  setStatusError: (v: string) => void;
  handleStatusChange: (e: React.FormEvent) => void;
  isSubmittingStatus: boolean;
  companyId?: string;
};

export default function StatusChangeModal({
  isOpen,
  onClose,
  statusForm,
  setStatusForm,
  statusError,
  setStatusError,
  handleStatusChange,
  isSubmittingStatus,
  companyId,
}: Props) {
  const { data: companySettings } = useCompanySettings(companyId, { enabled: !!companyId });
  
  // Get statuses from the hook using company settings
  const { statusOptions, getColor, getTextColor, getDescription } = useStatusSettings(companySettings);

  // Debug: Log when statusForm changes
  useEffect(() => {
    console.log('StatusForm changed:', statusForm);
    console.log('Current status value:', statusForm?.status);
    console.log('Is rejected?', statusForm?.status?.toLowerCase() === 'rejected');
  }, [statusForm]);

  const reasonOptions = useMemo(() => {
    const fromRoot = (companySettings as any)?.rejectReasons;
    const fromNested = (companySettings as any)?.settings?.rejectReasons;
    const list = Array.isArray(fromRoot) && fromRoot.length ? fromRoot : Array.isArray(fromNested) ? fromNested : [];
    return list.map((r: any) => ({ value: String(r ?? ''), text: String(r ?? '') }));
  }, [companySettings]);

  // Check if selected status is rejected (case-insensitive)
  const isRejected = useMemo(() => {
    return statusForm?.status && statusForm.status.toLowerCase() === 'rejected';
  }, [statusForm?.status]);

  // Get the color for the selected status badge
  const selectedStatusColor = statusForm?.status ? getColor(statusForm.status) : '#94a3b8';
  const selectedStatusTextColor = statusForm?.status ? getTextColor(statusForm.status) : '#111827';
  const selectedStatusDescription = statusForm?.status ? getDescription(statusForm.status) : '';

  // Modal class - taller when rejected reasons are shown
  const modalClass = isRejected 
    ? 'max-w-2xl p-6 max-h-[90vh] overflow-y-auto' 
    : 'max-w-2xl p-6';

  // Handle status change with proper logging
  const handleStatusSelect = (value: any) => {
    // If the Select component returns an object with a value property
    const selectedValue = typeof value === 'object' ? value.value : value;
    console.log('Status selected:', selectedValue);
    
    const isRejectedStatus = selectedValue && selectedValue.toLowerCase() === 'rejected';
    
    setStatusForm({
      ...statusForm,
      status: selectedValue,
      // Clear reasons if not rejected
      ...(!isRejectedStatus ? { reasons: [] } : {}),
    });
  };

  // Validate before submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if status is selected
    if (!statusForm?.status || statusForm.status.trim() === '') {
      setStatusError('Please select a status before submitting.');
      return;
    }
    
    // If rejected, check if reasons are provided (optional - you can remove this validation)
    // if (isRejected && (!statusForm.reasons || statusForm.reasons.length === 0)) {
    //   setStatusError('Please provide at least one reason for rejection.');
    //   return;
    // }
    
    // Call the parent's handleStatusChange
    handleStatusChange(e);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={() => { 
        onClose(); 
        setStatusError(''); 
      }} 
      className={modalClass} 
      closeOnBackdrop={false}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 pb-4 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Change Status</h2>
        
        </div>

        {statusError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start justify-between">
              <p className="text-sm text-red-600 dark:text-red-400"><strong>Error:</strong> {statusError}</p>
              <button type="button" onClick={() => setStatusError('')} className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300">✕</button>
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="status-select">New Status</Label>
          <Select
            options={statusOptions}
            placeholder="Select new status"
            value={statusForm?.status || ''}
            onChange={handleStatusSelect}
          />
          {/* Show status description if available */}
          {selectedStatusDescription && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {selectedStatusDescription}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="status-notes">Notes (Optional)</Label>
          <TextArea 
            value={statusForm.notes || ''} 
            onChange={(value: any) => setStatusForm({ ...statusForm, notes: value })} 
            placeholder="Add notes about this status change" 
            rows={3} 
          />
        </div>
        
        {/* Show reasons section when status is rejected (case-insensitive) */}
        {isRejected && (
          <div className="rejected-reasons-section p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
            <Label>Reasons for Rejection</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Please select or type the reasons for rejection
            </p>
            <MultiSelect
  options={reasonOptions}
  value={statusForm.reasons ?? []}
  onChange={(selected: string[]) => setStatusForm({ ...statusForm, reasons: selected })}
  placeholder="Select or type a reason"
  disabled={isSubmittingStatus}
  maxHeightClass="max-h-48" // Changed from max-h-64 to max-h-48 (192px)
  allowCustomValues
  customInputPlaceholder="Type a reason and press Enter"
/>
          </div>
        )}
        
        <div className="flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-gray-900 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
          <button 
            type="button" 
            onClick={onClose} 
            className="rounded-lg border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800" 
            disabled={isSubmittingStatus}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" 
            disabled={isSubmittingStatus}
          >
            {isSubmittingStatus ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Updating...</span>
              </>
            ) : (
              <span>Update Status</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}