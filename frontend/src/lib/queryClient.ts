import { QueryClient } from '@tanstack/react-query';
import { Config } from '@/constants/config';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Config.QUERY.STALE_TIME,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
    },
  },
});
