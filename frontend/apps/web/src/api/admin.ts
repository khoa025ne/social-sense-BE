import { api } from "./client"

// ─── Types ───
export interface AdminDashboard {
  totalUsers: number
  activeUsers: number
  totalContentGenerated: number
  totalKnowledgeItems: number
  totalTrends: number
  activeApiKeys: number
  coolingDownApiKeys: number
  last7DaysContent: {
    date: string
    contentGenerated: number
    newUsers: number
    imageGenerated?: number
    knowledgeUploaded?: number
    userLogins?: number
    paymentsCount?: number
    proUpgrades?: number
    ultraUpgrades?: number
    revenue?: number
  }[]
}

export interface AdminUser {
  id: number
  email: string
  displayName: string
  isActive: boolean
  hasContext: boolean
  tier: string
  dailyQuotaLimit: number
  remainingQuota: number
  lastQuotaReset: string
  createdAt: string
  roles: string[]
  totalContentGenerated: number
}

export interface AdminUsersResponse {
  total: number
  page: number
  pageSize: number
  totalPages: number
  data: AdminUser[]
}

export interface AdminApiKey {
  id: number
  label: string
  keySuffix: string
  provider: string
  modelOverride: string
  supportsImageGen: boolean
  isActive: boolean
  isEncrypted: boolean
  notes: string
  createdAt: string
  updatedAt: string
  isInCooldown: boolean
  cooldownExpiresAt: string | null
}

export interface StatsCompareResponse {
  periodA: {
    from: string; to: string; label: string
    newUsers: number; activeUsers: number
    totalContentGenerated: number; totalApiCalls: number
    newKnowledgeItems: number; newTrends: number
  }
  periodB: {
    from: string; to: string; label: string
    newUsers: number; activeUsers: number
    totalContentGenerated: number; totalApiCalls: number
    newKnowledgeItems: number; newTrends: number
  }
  diff: Record<string, number>
}

// ─── API calls ───
export const adminApi = {
  getDashboard: () =>
    api.get<AdminDashboard>("/admin/dashboard"),

  getUsers: (params?: { page?: number; pageSize?: number; search?: string; isActive?: boolean }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set("page", String(params.page))
    if (params?.pageSize) query.set("pageSize", String(params.pageSize))
    if (params?.search) query.set("search", params.search)
    if (params?.isActive !== undefined) query.set("isActive", String(params.isActive))
    return api.get<AdminUsersResponse>(`/admin/users?${query.toString()}`)
  },

  getUser: (id: number) =>
    api.get<AdminUser>(`/admin/users/${id}`),

  createUser: (data: { email: string; password: string; displayName: string; dailyQuotaLimit?: number; isAdmin?: boolean }) =>
    api.post<{ message: string; userId: number }>("/admin/users", data),

  updateUser: (id: number, data: { displayName?: string; isActive?: boolean; dailyQuotaLimit?: number; resetQuotaNow?: boolean }) =>
    api.put<{ message: string }>(`/admin/users/${id}`, data),

  deleteUser: (id: number) =>
    api.delete<{ message: string }>(`/admin/users/${id}`),

  restoreUser: (id: number) =>
    api.post<{ message: string }>(`/admin/users/${id}/restore`),

  updateTier: (id: number, data: { tier: string; customDailyQuota?: number }) =>
    api.put<{ message: string; userId: number; tier: string; dailyQuotaLimit: number; isUnlimited: boolean }>(
      `/admin/users/${id}/tier`, data
    ),

  resetQuota: (id: number) =>
    api.post<{ message: string }>(`/admin/users/${id}/reset-quota`),

  getApiKeys: () =>
    api.get<AdminApiKey[]>("/admin/api-keys"),

  addApiKey: (data: { label: string; keyValue: string; provider?: string; modelOverride?: string; supportsImageGen?: boolean; notes?: string }) =>
    api.post<{ message: string }>("/admin/api-keys", data),

  updateApiKey: (id: number, data: Record<string, unknown>) =>
    api.put<{ message: string }>(`/admin/api-keys/${id}`, data),

  deleteApiKey: (id: number) =>
    api.delete<{ message: string }>(`/admin/api-keys/${id}`),

  reloadKeyPool: (clearCooldowns = false) =>
    api.post<{ message: string }>(`/admin/api-keys/reload?clearCooldowns=${clearCooldowns}`),

  compareStats: (data: { period: string; periodA: string; periodB: string }) =>
    api.post<StatsCompareResponse>("/admin/stats/compare", data),

  getActivityDrilldown: (date?: string) =>
    api.get<{ date: string; total: number; activities: any[] }>(`/admin/activities/drilldown${date ? `?date=${date}` : ""}`),

  grantBonusQuota: (userId: number, amount: number = 5) =>
    api.post<{ message: string; userId: number; remainingQuota: number }>(`/admin/users/${userId}/bonus-quota?amount=${amount}`),

  seed: () =>
    api.post<{ message: string }>("/admin/seed"),
}
