import { useMutation } from '@tanstack/react-query';
import axiosInstance from '../../config/axios';

export function useSendEmail() {
  return useMutation({
    mutationFn: (emailData: {
      to: string;
      from: string;
      subject: string;
      html: string;
      metadata?: any;
    }) => {
      // Sanitize `from` by removing surrounding angle brackets, then send.
      const payload = {
        ...emailData,
        from: typeof emailData.from === 'string' ? emailData.from.replace(/[<>]/g, '') : emailData.from,
      } as any;

      return axiosInstance.post('/applicants/mail', payload, {
        transformRequest: [
          (data) => JSON.stringify(data),
        ],
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
  });
}
