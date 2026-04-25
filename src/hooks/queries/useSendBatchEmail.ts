import { useMutation } from '@tanstack/react-query';
import axiosInstance from '../../config/axios';
import Swal from 'sweetalert2';

export function useSendBatchEmail() {
  return useMutation({
    mutationFn: (payload: { company?: string; batch?: any } | any) => {
      // Normalize payload to { company, batch: [...] }.
      let body: any;
      if (payload && typeof payload === 'object' && Array.isArray(payload.batch)) {
        body = { company: payload.company, batch: payload.batch };
      } else if (Array.isArray(payload)) {
        body = { batch: payload };
      } else {
        body = { batch: [payload] };
      }

      if (!body.company) {
        throw new Error('Company is required for batch email');
      }

      // Strip surrounding angle brackets from `from` addresses (e.g. "<a@b.com>")
      body.batch = body.batch.map((item: any) => {
        const { text: _ignoredText, ...rest } = item || {};
        return {
          ...rest,
          from: typeof item.from === 'string' ? item.from.replace(/[<>]/g, '') : item.from,
          applicant:
            item?.applicant && typeof item.applicant === 'object' && '_id' in item.applicant
              ? item.applicant._id
              : item?.applicant,
        };
      });

      return axiosInstance.post('/mail', body, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onError: (error: any) => {
      // Check for rate limit error (429 status code)
      if (error?.response?.status === 429) {
        const errorMessage = error?.response?.data?.message || 
          error?.response?.data?.error ||
          'You have reached the email sending limit. Please try again later.';
        
        Swal.fire({
          title: 'Email Limit Reached',
          text: errorMessage,
          icon: 'warning',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'OK',
        });
        return;
      }
      
      // Check for authentication/authorization errors
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        Swal.fire({
          title: 'Authentication Error',
          text: 'You are not authorized to send emails. Please check your email settings.',
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'OK',
        });
        return;
      }
      
      // Check for other client errors
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        const errorMessage = error?.response?.data?.message || 
          error?.response?.data?.error ||
          'Invalid email request. Please check your email settings.';
        
        Swal.fire({
          title: 'Email Error',
          text: errorMessage,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'OK',
        });
        return;
      }
      
      // Server errors
      if (error?.response?.status >= 500) {
        Swal.fire({
          title: 'Server Error',
          text: 'An error occurred while sending emails. Please try again later.',
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'OK',
        });
        return;
      }
      
      // Network or other errors
      if (error?.code === 'ERR_NETWORK') {
        Swal.fire({
          title: 'Network Error',
          text: 'Unable to connect to the server. Please check your internet connection.',
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'OK',
        });
        return;
      }
      
      // Fallback for any other errors
      Swal.fire({
        title: 'Email Error',
        text: error?.message || 'An unexpected error occurred while sending emails.',
        icon: 'error',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK',
      });
    },
  });
}

export default useSendBatchEmail;