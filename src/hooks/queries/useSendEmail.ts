import { useMutation } from '@tanstack/react-query';
import axiosInstance from '../../config/axios';
import Swal from 'sweetalert2';

export function useSendEmail() {
  return useMutation({
    mutationFn: (emailData: {
      company?: string;
      to: string;
      from: string;
      subject: string;
      html: string;
      attachments?: any[];
      metadata?: any;
      applicant?: { _id?: string } | string;
      jobPosition?: string;
    }) => {
      const { text: _ignoredText, ...restEmailData } = emailData as any;

      // Sanitize `from` by removing surrounding angle brackets, then send.
      const payload = {
        ...restEmailData,
        from: typeof emailData.from === 'string' ? emailData.from.replace(/[<>]/g, '') : emailData.from,
        applicant:
          emailData?.applicant &&
          typeof emailData.applicant === 'object' &&
          '_id' in emailData.applicant
            ? emailData.applicant._id
            : emailData?.applicant,
      } as any;

      return axiosInstance.post('/mail', payload);
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
      }
      
      // Check for other errors
      if (error?.response?.status === 400) {
        const errorMessage = error?.response?.data?.message || 'Invalid email request. Please check your email settings.';
        
        Swal.fire({
          title: 'Email Error',
          text: errorMessage,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'OK',
        });
      }
    },
  });
}