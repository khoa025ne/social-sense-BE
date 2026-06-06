import apiClient from '@/lib/api';
import type { TrendListResponse, TagItem } from '@/types/api';

export interface GetTrendsParams {
  page: number;
  pageSize: number;
  tagId?: number;
}

export async function getTrends(params: GetTrendsParams): Promise<TrendListResponse> {
  const res = await apiClient.get<TrendListResponse>('/trends', { params });
  return res.data;
}

export async function getTrendTags(): Promise<TagItem[]> {
  const res = await apiClient.get<TagItem[]>('/trends/tags');
  return res.data;
}
