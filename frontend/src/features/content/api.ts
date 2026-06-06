import apiClient from '@/lib/api';
import type {
  GenerateContentRequest,
  GenerateContentResponse,
  CheckAlignmentRequest,
  CheckAlignmentResponse,
  PaginatedHistoryResponse,
  EditHistoryRequest,
  ImageAnalyzeRequest,
  ImageAnalyzeResponse,
  ImageGenerateRequest,
  ImageGenerateResponse,
} from '@/types/api';

export async function generateContent(
  data: GenerateContentRequest
): Promise<GenerateContentResponse> {
  const res = await apiClient.post<GenerateContentResponse>('/content/generate', data);
  return res.data;
}

export async function checkAlignment(
  data: CheckAlignmentRequest
): Promise<CheckAlignmentResponse> {
  const res = await apiClient.post<CheckAlignmentResponse>('/content/check-alignment', data);
  return res.data;
}

export async function getHistory(
  page: number,
  pageSize: number
): Promise<PaginatedHistoryResponse> {
  const res = await apiClient.get<PaginatedHistoryResponse>('/content/history', {
    params: { page, pageSize },
  });
  return res.data;
}

export async function editHistory(
  id: number,
  data: EditHistoryRequest
): Promise<{ message: string }> {
  const res = await apiClient.put<{ message: string }>(`/content/history/${id}/edit`, data);
  return res.data;
}

// ─── Image Generation ─────────────────────────────────────────────────────────

export async function analyzeImageContent(
  data: ImageAnalyzeRequest
): Promise<ImageAnalyzeResponse> {
  const res = await apiClient.post<ImageAnalyzeResponse>('/content/image/analyze', data);
  return res.data;
}

export async function generateImage(
  data: ImageGenerateRequest
): Promise<ImageGenerateResponse> {
  // Image generation qua Pollinations/HuggingFace có thể mất 60-90s
  const res = await apiClient.post<ImageGenerateResponse>('/content/image/generate', data, {
    timeout: 90000,
  });
  return res.data;
}
