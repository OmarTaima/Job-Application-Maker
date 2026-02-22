import { useMutation } from '@tanstack/react-query';
import axiosInstance from '../../config/axios';

export function useSendBatchEmail() {
  return useMutation({
    mutationFn: (payload: any) => {
      // Normalize payload to { batch: [...] }.
      let body: any;
      if (payload && typeof payload === 'object' && Array.isArray(payload.batch)) {
        body = payload;
      } else if (Array.isArray(payload)) {
        body = { batch: payload };
      } else {
        body = { batch: [payload] };
      }

      // Strip surrounding angle brackets from `from` addresses (e.g. "<a@b.com>")
      body.batch = body.batch.map((item: any) => ({
        ...item,
        from: typeof item.from === 'string' ? item.from.replace(/[<>]/g, '') : item.from,
      }));

      return axiosInstance.post('/applicants/mail', body, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
  });
}

export default useSendBatchEmail;
