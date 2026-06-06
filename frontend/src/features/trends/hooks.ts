import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getTrends, getTrendTags } from './api';
import { Config } from '@/constants/config';

export const trendKeys = {
  all: ['trends'] as const,
  list: (tagId?: number) => ['trends', 'list', tagId] as const,
  tags: ['trends', 'tags'] as const,
};

export function useTrends(tagId?: number) {
  return useInfiniteQuery({
    queryKey: trendKeys.list(tagId),
    queryFn: ({ pageParam = 1 }) =>
      getTrends({
        page: pageParam as number,
        pageSize: Config.PAGINATION.TRENDS_PAGE_SIZE,
        tagId,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.pageSize);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    staleTime: Config.QUERY.STALE_TIME,
  });
}

export function useTrendTags() {
  return useQuery({
    queryKey: trendKeys.tags,
    queryFn: getTrendTags,
    staleTime: Config.QUERY.STALE_TIME,
  });
}
