import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { generateContent, checkAlignment, getHistory, editHistory, analyzeImageContent, generateImage } from './api';
import { useContentStore } from './store';
import { useAuthStore } from '@/features/auth/store';
import { authKeys } from '@/features/auth/hooks';
import { Config } from '@/constants/config';
import type {
  GenerateContentRequest,
  CheckAlignmentRequest,
  EditHistoryRequest,
  ImageAnalyzeRequest,
  ImageGenerateRequest,
} from '@/types/api';

export const contentKeys = {
  history: ['content', 'history'] as const,
};

// ─── useGenerateContent ───────────────────────────────────────────────────────

export function useGenerateContent() {
  const { setResult, setGenerating, clearResult } = useContentStore();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: GenerateContentRequest) => generateContent(data),
    onMutate: () => setGenerating(true),
    onSuccess: (response) => {
      setResult(
        response.items,
        response.selectedTrendTitle,
        response.smartMatchReason
      );
      // Refresh quota sau khi generate thành công
      qc.invalidateQueries({ queryKey: authKeys.quota });
    },
    onError: () => {
      // Reset generating flag và clear any stale params on error
      setGenerating(false);
      clearResult();
    },
  });
}

// ─── useCheckAlignment ────────────────────────────────────────────────────────

export function useCheckAlignment() {
  return useMutation({
    mutationFn: (data: CheckAlignmentRequest) => checkAlignment(data),
  });
}

// ─── useContentHistory ────────────────────────────────────────────────────────

export function useContentHistory() {
  const { isAuthenticated } = useAuthStore();

  return useInfiniteQuery({
    queryKey: contentKeys.history,
    queryFn: ({ pageParam = 1 }) =>
      getHistory(pageParam as number, Config.PAGINATION.HISTORY_PAGE_SIZE),
    initialPageParam: 1,
    enabled: isAuthenticated,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.totalCount / lastPage.pageSize);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
  });
}

// ─── useEditHistory ───────────────────────────────────────────────────────────

export function useEditHistory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: EditHistoryRequest }) =>
      editHistory(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentKeys.history });
    },
  });
}

// ─── useAnalyzeImage ──────────────────────────────────────────────────────────

export function useAnalyzeImage() {
  return useMutation({
    mutationFn: (data: ImageAnalyzeRequest) => analyzeImageContent(data),
  });
}

// ─── useGenerateImage ─────────────────────────────────────────────────────────

export function useGenerateImage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: ImageGenerateRequest) => generateImage(data),
    onSuccess: () => {
      // Tốn 1 quota — refresh quota bar sau khi generate thành công
      qc.invalidateQueries({ queryKey: authKeys.quota });
    },
  });
}
