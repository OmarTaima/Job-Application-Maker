import { useQuery } from '@tanstack/react-query';
import { usersService } from '../../services/usersService';

interface UseMyInterviewsParams {
  direction?: 'future' | 'past';
  status?: string;
  page?: number;
  limit?: number;
}

export const myInterviewsKeys = {
  all: ['my-interviews'] as const,
  list: (params: UseMyInterviewsParams) =>
    [...myInterviewsKeys.all, params] as const,
};

export function useMyInterviews(params: UseMyInterviewsParams = {}) {
  const { direction = 'future', status, page = 1, limit = 20 } = params;

  return useQuery({
    queryKey: myInterviewsKeys.list({ direction, status, page, limit }),
    queryFn: () =>
      usersService.getMyInterviews({ direction, status, page, limit }),
    staleTime: 2 * 60 * 1000,
  });
}
