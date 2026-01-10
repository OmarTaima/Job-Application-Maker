/**
 * Centralized error handling utility
 * Extracts detailed validation errors from API responses
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ErrorResponse {
  message: string;
  validationErrors?: ValidationError[];
}

/**
 * Extract detailed error message from API error response
 * Supports multiple backend error formats
 */
export const getErrorMessage = (err: any): string => {
  // Check for validation errors in 'details' array (Joi validation format)
  if (err.response?.data?.details && Array.isArray(err.response.data.details)) {
    return err.response.data.details
      .map((detail: any) => {
        const field = detail.path?.join('.') || detail.context?.key || '';
        const message = detail.message || '';
        return field ? `${field}: ${message}` : message;
      })
      .join('\n');
  }

  // Check for validation errors in 'errors' array (express-validator format)
  if (err.response?.data?.errors) {
    const errors = err.response.data.errors;
    if (Array.isArray(errors)) {
      return errors
        .map((e: any) => {
          const field = e.param || e.path || '';
          const message = e.msg || e.message || '';
          return field ? `${field}: ${message}` : message;
        })
        .join('\n');
    }
    if (typeof errors === 'object') {
      return Object.entries(errors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join('\n');
    }
  }

  // Check for error object with message and error fields
  if (err.response?.data?.error && err.response?.data?.message) {
    return `${err.response.data.message}\n${err.response.data.error}`;
  }

  // Standard error message
  if (err.response?.data?.message) {
    return err.response.data.message;
  }

  // Axios error message
  if (err.message) {
    return err.message;
  }

  return 'An unexpected error occurred';
};

/**
 * Extract validation errors as structured array
 */
export const getValidationErrors = (err: any): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Joi validation format
  if (err.response?.data?.details && Array.isArray(err.response.data.details)) {
    err.response.data.details.forEach((detail: any) => {
      errors.push({
        field: detail.path?.join('.') || detail.context?.key || 'unknown',
        message: detail.message || 'Validation failed',
      });
    });
  }

  // express-validator format
  if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
    err.response.data.errors.forEach((e: any) => {
      errors.push({
        field: e.param || e.path || 'unknown',
        message: e.msg || e.message || 'Validation failed',
      });
    });
  }

  return errors;
};

/**
 * Get error response for display
 */
export const getErrorResponse = (err: any): ErrorResponse => {
  return {
    message: getErrorMessage(err),
    validationErrors: getValidationErrors(err),
  };
};

/**
 * Format validation errors for display in forms
 * Returns object with field names as keys and error messages as values
 */
export const formatValidationErrors = (err: any): Record<string, string> => {
  const validationErrors = getValidationErrors(err);
  const formatted: Record<string, string> = {};

  validationErrors.forEach(({ field, message }) => {
    formatted[field] = message;
  });

  return formatted;
};
