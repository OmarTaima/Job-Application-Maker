import React from 'react';

interface ValidationErrorAlertProps {
  error: string | null;
  onDismiss: () => void;
}

/**
 * ValidationErrorAlert Component
 * Displays validation errors from API responses in a formatted, user-friendly way
 */
export const ValidationErrorAlert: React.FC<ValidationErrorAlertProps> = ({
  error,
  onDismiss,
}) => {
  if (!error) return null;

  // Split error by newlines to show each validation error on a separate line
  const errorLines = error.split('\n').filter(line => line.trim());

  return (
    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <svg
              className="w-5 h-5 text-red-600 dark:text-red-400 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              {errorLines.length > 1 ? 'Validation Errors' : 'Validation Error'}
            </p>
          </div>
          <div className="text-sm text-red-600 dark:text-red-400 space-y-1">
            {errorLines.map((line, index) => {
              // Check if the line contains a field name (format: "field: message")
              const colonIndex = line.indexOf(':');
              if (colonIndex > 0 && colonIndex < 50) {
                const field = line.substring(0, colonIndex).trim();
                const message = line.substring(colonIndex + 1).trim();
                return (
                  <div key={index} className="flex items-start">
                    <span className="font-medium mr-1">{field}:</span>
                    <span>{message}</span>
                  </div>
                );
              }
              return <div key={index}>{line}</div>;
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-3 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
          aria-label="Dismiss error"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ValidationErrorAlert;
