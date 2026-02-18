import React from 'react';
import { Modal } from '../ui/modal';
import Label from '../form/Label';
import TextArea from '../form/input/TextArea';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  commentForm: any;
  setCommentForm: (v: any) => void;
  commentError: string;
  setCommentError: (v: string) => void;
  handleCommentSubmit: (e: React.FormEvent) => void;
  isSubmittingComment: boolean;
};

export default function CommentModal({
  isOpen,
  onClose,
  commentForm,
  setCommentForm,
  commentError,
  setCommentError,
  handleCommentSubmit,
  isSubmittingComment,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); setCommentError(''); }} className="max-w-2xl p-6" closeOnBackdrop={false}>
      <form onSubmit={handleCommentSubmit} className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add Comment</h2>

        {commentError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start justify-between">
              <p className="text-sm text-red-600 dark:text-red-400"><strong>Error:</strong> {commentError}</p>
              <button type="button" onClick={() => setCommentError('')} className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300">✕</button>
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="comment-text">Comment</Label>
          <TextArea value={commentForm.text} onChange={(value: any) => setCommentForm({ text: value })} placeholder="Enter your internal comment about this applicant" rows={5} />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800" disabled={isSubmittingComment}>Cancel</button>
          <button type="submit" className="rounded-lg bg-gray-600 px-6 py-2 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" disabled={isSubmittingComment}>
            {isSubmittingComment ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Adding...</span>
              </>
            ) : (
              <span>Add Comment</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
