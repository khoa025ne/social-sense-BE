import { api } from "./client"

// ─── Types ───
export interface ImageAnalyzeRequest {
  contentHistoryId?: number
  contentText?: string
  platform: string
}

export interface ClarifyingQuestion {
  id: string
  question: string
  type: "yesno" | "choice" | "text_optional"
  options?: string[]
}

export interface ImageAnalyzeResponse {
  imageSummary: string
  draftPrompt: string
  detectedIndustry: string
  clarifyingQuestions: ClarifyingQuestion[]
  bannerSpecs: {
    platform: string
    dimensions: string
    aspectRatio: string
    recommendedStyle: string
  }
}

export interface ImageGenerateRequest {
  contentHistoryId?: number
  contentText?: string
  platform: string
  draftPrompt: string
  detectedIndustry: string
  answers: Record<string, string>
}

export interface ImageGenerateResponse {
  imageUrl: string | null
  finalPrompt: string
  bannerSpecs: {
    platform: string
    dimensions: string
    aspectRatio: string
    recommendedStyle: string
  }
  isGenerated: boolean
  promptUsageTip: string | null
}

// ─── API calls ───
export const imageApi = {
  analyze: (data: ImageAnalyzeRequest) =>
    api.post<ImageAnalyzeResponse>("/content/image/analyze", data),

  generate: (data: ImageGenerateRequest) =>
    api.post<ImageGenerateResponse>("/content/image/generate", data),
}
