import React from 'react';
import { Modal } from '../ui/modal';
import Label from '../form/Label';
import Select from '../form/Select';
import TextArea from '../form/input/TextArea';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  statusForm: any;
  setStatusForm: (v: any) => void;
  statusError: string;
  setStatusError: (v: string) => void;
  handleStatusChange: (e: React.FormEvent) => void;
  isSubmittingStatus: boolean;
  statusOptions: any[];
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
  statusOptions,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); setStatusError(''); }} className="max-w-2xl p-6" closeOnBackdrop={false}>
      <form onSubmit={handleStatusChange} className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Change Status</h2>

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
          <Select options={statusOptions} placeholder="Select new status" onChange={(value: any) => setStatusForm({ ...statusForm, status: value })} />
        </div>

        <div>
          <Label htmlFor="status-notes">Notes (Optional)</Label>
          <TextArea value={statusForm.notes} onChange={(value: any) => setStatusForm({ ...statusForm, notes: value })} placeholder="Add notes about this status change" rows={3} />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800" disabled={isSubmittingStatus}>Cancel</button>
          <button type="submit" className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" disabled={isSubmittingStatus}>
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
