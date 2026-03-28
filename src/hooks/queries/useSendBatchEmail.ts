import { useMutation } from '@tanstack/react-query';
import axiosInstance from '../../config/axios';

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
  });
}

export default useSendBatchEmail;
