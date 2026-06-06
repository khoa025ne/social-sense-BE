import apiClient from '@/lib/api';
import type { KnowledgeManualRequest, KnowledgeScrapeRequest, KnowledgeResponse } from '@/types/api';

export async function ingestManual(data: KnowledgeManualRequest): Promise<KnowledgeResponse> {
  const res = await apiClient.post<KnowledgeResponse>('/knowledge/manual', data);
  return res.data;
}

export async function scrapeUrl(data: KnowledgeScrapeRequest): Promise<KnowledgeResponse> {
  const res = await apiClient.post<KnowledgeResponse>('/knowledge/scrape', data);
  return res.data;
}

export async function uploadFile(file: {
  uri: string;
  name: string;
  type: string;
}): Promise<KnowledgeResponse> {
  const formData = new FormData();
  // React Native's FormData.append accepts a file-like object at runtime,
  // but the TypeScript type only accepts string | Blob — cast required.
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);

  const res = await apiClient.post<KnowledgeResponse>('/knowledge/upload-file', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}
