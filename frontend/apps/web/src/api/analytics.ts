import { api } from "./client"

// ─── Types ───
export interface AnalyticsMetrics {
  platform: string
  periodLabel: string
  reach: number
  impressions: number
  totalEngagement: number
  likes: number
  comments: number
  shares: number
  clicks: number
  newFollowers: number
  profileVisits: number
  engagementRate: number
  completionRate: number | null
  avgViewDurationSeconds: number | null
  conversionRate: number
  clickThroughRate: number
  postsCount: number
}

export interface AnalyticsUploadResponse {
  message: string
  periodA: AnalyticsMetrics
  periodB: AnalyticsMetrics
}

export interface AnalyticsMetricItem {
  metricKey: string
  metricName: string
  valueAFormatted: string
  valueBFormatted: string | null
  changePercent: number | null
  status: string
  simpleExplain: string
  detail: string
  higherIsBetter: boolean
}

export interface AnalyticsReportSummary {
  highlights: string[]
  warnings: string[]
  overallScore: number
  overallTrend: string
  topRecommendation: string
}

export interface AnalyticsReport {
  platform: string
  reportType: "single" | "compare"
  periodALabel: string
  periodBLabel: string | null
  metrics: AnalyticsMetricItem[]
  summary: AnalyticsReportSummary
  aiNarrative: string
}

export interface AnalyticsReportResponse {
  id: number
  platform: string
  reportType: string
  periodALabel: string
  periodBLabel: string | null
  result: AnalyticsReport
  createdAt: string
}

export interface AnalyticsHistoryItem {
  id: number
  platform: string
  reportType: string
  periodALabel: string
  periodBLabel: string | null
  overallScore: number
  overallTrend: string
  createdAt: string
}

export interface AnalyticsHistoryResponse {
  page: number
  pageSize: number
  data: AnalyticsHistoryItem[]
}

// ─── API calls ───
export const analyticsApi = {
  downloadTemplate: () =>
    api.get<Blob>("/analytics/template"),

  upload: (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return api.upload<AnalyticsUploadResponse>("/analytics/upload", formData)
  },

  analyze: (metrics: AnalyticsMetrics) =>
    api.post<AnalyticsReport>("/analytics/analyze", { metrics }),

  compare: (periodA: AnalyticsMetrics, periodB: AnalyticsMetrics) =>
    api.post<AnalyticsReportResponse>("/analytics/compare", { periodA, periodB }),

  uploadAndCompare: (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return api.upload<AnalyticsReportResponse>("/analytics/upload-and-compare", formData)
  },

  getHistory: (page = 1, pageSize = 10) =>
    api.get<AnalyticsHistoryResponse>(`/analytics/history?page=${page}&pageSize=${pageSize}`),

  getReport: (id: number) =>
    api.get<AnalyticsReportResponse>(`/analytics/history/${id}`),
}
