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
  });
}
