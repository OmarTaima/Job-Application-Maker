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
      // Ensure the from field is sent as-is without encoding
      return axiosInstance.post('/applicants/mail', emailData, {
        // This prevents axios from automatically encoding the data
        transformRequest: [
          (data) => {
            // Return the data as-is, don't transform
            return JSON.stringify(data);
          },
        ],
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
  });
}
