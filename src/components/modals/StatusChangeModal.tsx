import React, { useMemo, useEffect, useState, useRef } from 'react';
import Label from '../form/Label';
import Select from '../form/Select';
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
  const { statusOptions, getDescription } = useStatusSettings(companySettings);

  // State for search input and custom values
  const [customReasons, setCustomReasons] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const reasonOptions = useMemo(() => {
    const fromRoot = (companySettings as any)?.rejectReasons;
    const fromNested = (companySettings as any)?.settings?.rejectReasons;
    const list = Array.isArray(fromRoot) && fromRoot.length ? fromRoot : Array.isArray(fromNested) ? fromNested : [];
    const allReasons = [...new Set([...list, ...customReasons])];
    return allReasons.map((r: any) => ({ value: String(r ?? ''), text: String(r ?? '') }));
  }, [companySettings, customReasons]);

  // Check if selected status is rejected (case-insensitive)
  const isRejected = useMemo(() => {
    return statusForm?.status && statusForm.status.toLowerCase() === 'rejected';
  }, [statusForm?.status]);

  const selectedStatusDescription = statusForm?.status ? getDescription(statusForm.status) : '';

  // Filter options based on search query
  const getFilteredOptions = (query: string) => {
    if (!query.trim()) return reasonOptions;
    
    const searchTerm = query.toLowerCase().trim();
    const matched = reasonOptions.filter(option => 
      option.text.toLowerCase().includes(searchTerm)
    );
    
    matched.sort((a, b) => {
      const aIndex = a.text.toLowerCase().indexOf(searchTerm);
      const bIndex = b.text.toLowerCase().indexOf(searchTerm);
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a.text.length - b.text.length;
    });
    
    return matched;
  };

  const filteredOptions = getFilteredOptions(searchQuery);
  const hasExactMatch = filteredOptions.some(opt => 
    opt.text.toLowerCase() === searchQuery.trim().toLowerCase()
  );

  const handleStatusSelect = (value: any) => {
    const selectedValue = typeof value === 'object' ? value.value : value;
    const isRejectedStatus = selectedValue && selectedValue.toLowerCase() === 'rejected';
    
    setStatusForm({
      ...statusForm,
      status: selectedValue,
      ...(!isRejectedStatus ? { reasons: [] } : {}),
    });
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const handleReasonsChange = (selected: string[]) => {
    const originalOptions = reasonOptions.map(opt => opt.value);
    const newCustomReasons = selected.filter(reason => !originalOptions.includes(reason));
    
    if (newCustomReasons.length > 0) {
      setCustomReasons(prev => [...new Set([...prev, ...newCustomReasons])]);
    }
    
    setStatusForm({ ...statusForm, reasons: selected });
  };

  const handleCustomReasonAdd = (value: string) => {
    if (value && value.trim()) {
      const trimmedValue = value.trim();
      const currentReasons = statusForm.reasons || [];
      
      if (currentReasons.includes(trimmedValue)) {
        setSearchQuery('');
        setIsDropdownOpen(false);
        return;
      }
      
      if (!reasonOptions.some(opt => opt.value === trimmedValue)) {
        setCustomReasons(prev => [...prev, trimmedValue]);
      }
      
      setStatusForm({ 
        ...statusForm, 
        reasons: [...currentReasons, trimmedValue] 
      });
      
      setSearchQuery('');
      setIsDropdownOpen(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!statusForm?.status || statusForm.status.trim() === '') {
      setStatusError('Please select a status before submitting.');
      return;
    }
    
    handleStatusChange(e);
  };

  const handleSelect = (value: string) => {
    const selectedValues = statusForm.reasons || [];
    let newSelected;
    if (selectedValues.includes(value)) {
      newSelected = selectedValues.filter((v: string) => v !== value);
    } else {
      newSelected = [...selectedValues, value];
    }
    
    const originalOptions = reasonOptions.map(opt => opt.value);
    if (!originalOptions.includes(value)) {
      setCustomReasons(prev => [...new Set([...prev, value])]);
    }
    
    handleReasonsChange(newSelected);
    // Close dropdown after selection
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  const handleRemove = (value: string) => {
    const selectedValues = statusForm.reasons || [];
    const newSelected = selectedValues.filter((v: string) => v !== value);
    handleReasonsChange(newSelected);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      
      const trimmedValue = searchQuery.trim();
      const exactMatch = reasonOptions.find(opt => 
        opt.text.toLowerCase() === trimmedValue.toLowerCase()
      );
      
      if (exactMatch) {
        const selectedValues = statusForm.reasons || [];
        if (!selectedValues.includes(exactMatch.value)) {
          handleSelect(exactMatch.value);
        }
      } else {
        handleCustomReasonAdd(trimmedValue);
        setIsDropdownOpen(false);
      }
      
      setSearchQuery('');
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };
void handleKeyDown;
  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle click outside dropdown to close it
  useEffect(() => {
    const handleClickOutsideDropdown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutsideDropdown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutsideDropdown);
    };
  }, [isDropdownOpen]);

  const selectedValues = statusForm.reasons || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div 
        ref={modalRef}
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-2xl w-full mx-4"
        style={{ maxHeight: 'none', height: 'auto', overflow: 'visible' }}
      >
        <div className="p-6" style={{ maxHeight: 'none', height: 'auto', overflow: 'visible' }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Change Status</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
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
              {selectedStatusDescription && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {selectedStatusDescription}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="status-notes">Notes (Optional)</Label>
              <textarea 
                value={statusForm.notes || ''} 
                onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })} 
                placeholder="Add notes about this status change" 
                rows={3}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            
            {/* Show reasons section when status is rejected */}
            {isRejected && (
              <div className="rejected-reasons-section p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                <Label>Reasons for Rejection</Label>
                
                {/* Selected reasons display */}
                <div className="flex flex-wrap gap-2 mt-2 mb-3 p-2 border border-gray-300 dark:border-gray-600 rounded-lg min-h-[42px] bg-white dark:bg-gray-800">
                  {selectedValues.length === 0 ? (
                    <span className="text-gray-400 text-sm">No reasons selected</span>
                  ) : (
                    selectedValues.map((reason: string, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-sm"
                      >
                        {reason}
                        <button
                          type="button"
                          onClick={() => handleRemove(reason)}
                          className="hover:text-red-500 ml-1 text-base font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Search input */}
                <div className="relative" ref={dropdownRef}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onClick={() => setIsDropdownOpen(true)}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Type to search or add new reason..."
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
                    disabled={isSubmittingStatus}
                  />
                  
                  {/* Dropdown options */}
                  {isDropdownOpen && reasonOptions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                      {filteredOptions.map((option, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            handleSelect(option.value);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors ${
                            selectedValues.includes(option.value) 
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                              : ''
                          }`}
                        >
                          {option.text}
                          {selectedValues.includes(option.value) && (
                            <span className="float-right text-blue-500">✓</span>
                          )}
                        </button>
                      ))}
                      
                      {searchQuery.trim() && !hasExactMatch && (
                        <button
                          type="button"
                          onClick={() => {
                            handleCustomReasonAdd(searchQuery.trim());
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-blue-600 dark:text-blue-400 border-t border-gray-200 dark:border-gray-700"
                        >
                          + Add "{searchQuery.trim()}" as new reason
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {reasonOptions.length} total reasons • Type to filter • Press Enter to add new reason • Click to select
                </p>
                
                {selectedValues.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {selectedValues.length} reason{selectedValues.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}
            
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
        </div>
      </div>
    </div>
  );
}