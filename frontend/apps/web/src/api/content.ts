import { api } from "./client"

// ─── Types ───
export interface ContentGenerateRequest {
  trendId?: number | null
  outputCount: number
  language: string
  targetPlatforms: string[]
  generateImage: boolean
  mode: "TrendBased" | "PersonaDriven"
  userInstruction?: string
}

export interface ContentItem {
  platform: string
  hook: string
  body: string
  cta: string
  hashtags: string[]
  language: string
  mediaUrl: string | null
  bannerImagePrompt: string | null
  bestTimeToPost: string
}

export interface ContentGenerateResponse {
  items: ContentItem[]
  selectedTrendTitle: string | null
  smartMatchReason: string
}

export interface ContentHistoryItem {
  id: number
  userId: number
  originalTrendId: number | null
  generatedContent: ContentItem[]
  userEditedContent: ContentItem[] | null
  isEdited: boolean
  mediaUrl: string | null
  createdAt: string
}

export interface ContentHistoryResponse {
  totalCount: number
  page: number
  pageSize: number
  items: ContentHistoryItem[]
}

export interface AlignmentCheckRequest {
  draftContent: string
}

export interface AlignmentCheckResponse {
  brandScore: number
  analysis: string
  suggestions: string
  refinedContent: string
}

export interface ContentEditRequest {
  body: string
  hook?: string
  cta?: string
  hashtags?: string[]
}

// ─── API calls ───
export const contentApi = {
  generate: (data: ContentGenerateRequest) =>
    api.post<ContentGenerateResponse>("/content/generate", data),

  getHistory: (page = 1, pageSize = 10) =>
    api.get<ContentHistoryResponse>(`/content/history?page=${page}&pageSize=${pageSize}`),

  editHistory: (id: number, data: ContentEditRequest) =>
    api.put<{ message: string }>(`/content/history/${id}/edit`, data),

  checkAlignment: (data: AlignmentCheckRequest) =>
    api.post<AlignmentCheckResponse>("/content/check-alignment", data),
}
