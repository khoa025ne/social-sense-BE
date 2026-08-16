import { api } from "./client"

// ─── Types ───
export interface KnowledgeIngestResponse {
  message: string
  itemId: number
  title?: string
  fileName?: string
  sourceUrl?: string
}

// ─── API calls ───
export const knowledgeApi = {
  ingestManual: (data: { title: string; rawContent: string }) =>
    api.post<KnowledgeIngestResponse>("/knowledge/manual", data),

  scrape: (targetUrl: string) =>
    api.post<KnowledgeIngestResponse>("/knowledge/scrape", { targetUrl }),

  uploadFile: (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return api.upload<KnowledgeIngestResponse>("/knowledge/upload-file", formData)
  },
}
