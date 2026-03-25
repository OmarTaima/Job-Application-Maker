import { useMutation } from '@tanstack/react-query';
import axiosInstance from '../../config/axios';

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
    }) => {
      // Sanitize `from` by removing surrounding angle brackets, then send.
      const payload = {
        ...emailData,
        from: typeof emailData.from === 'string' ? emailData.from.replace(/[<>]/g, '') : emailData.from,
      } as any;

      return axiosInstance.post('/applicants/mail', payload);
    },
  });
}
