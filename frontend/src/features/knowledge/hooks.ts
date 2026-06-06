import { useMutation } from '@tanstack/react-query';
import { ingestManual, scrapeUrl, uploadFile } from './api';
import type { KnowledgeManualRequest, KnowledgeScrapeRequest } from '@/types/api';

export function useIngestManual() {
  return useMutation({
    mutationFn: (data: KnowledgeManualRequest) => ingestManual(data),
  });
}

export function useScrapeUrl() {
  return useMutation({
    mutationFn: (data: KnowledgeScrapeRequest) => scrapeUrl(data),
  });
}

export function useUploadFile() {
  return useMutation({
    mutationFn: (file: { uri: string; name: string; type: string }) => uploadFile(file),
  });
}
