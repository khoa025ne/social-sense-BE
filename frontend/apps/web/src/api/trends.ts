import { api } from "./client"

// ─── Types ───
export interface TrendTag {
  id: number
  name: string
  slug: string
}

export interface TrendItem {
  id: number
  title: string
  summary: string
  sourceUrl: string
  hotLevel: number
  createdAt: string
  tags: TrendTag[]
}

export interface TrendsResponse {
  page: number
  pageSize: number
  total: number
  totalPages: number
  items: TrendItem[]
}

// ─── API calls ───
export const trendsApi = {
  getAll: (params?: { page?: number; pageSize?: number; tagId?: number; search?: string }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set("page", String(params.page))
    if (params?.pageSize) query.set("pageSize", String(params.pageSize))
    if (params?.tagId) query.set("tagId", String(params.tagId))
    if (params?.search) query.set("search", params.search)
    return api.get<TrendsResponse>(`/trends?${query.toString()}`)
  },

  getTags: () =>
    api.get<TrendTag[]>("/trends/tags"),
}
