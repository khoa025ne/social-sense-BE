import { api } from "./client"

// ─── Types ───
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  userId: number
  accessToken: string
  refreshToken: string
  email: string
  displayName: string
  hasContext: boolean
}

export interface RegisterRequest {
  email: string
  password: string
  displayName: string
}

export interface RegisterResponse {
  message: string
  userId: number
}

export interface UserProfile {
  id: number
  email: string
  displayName: string
  hasContext: boolean
  tier: string
  dailyQuotaLimit: number
  remainingQuota: number
  isUnlimited: boolean
  roles: string[]
}

export interface QuotaInfo {
  userId: number
  tier: string
  dailyQuotaLimit: number
  remainingQuota: number
  usedToday: number
  isUnlimited: boolean
  usagePercent: number
  lastQuotaReset: string
  nextResetAt: string
  tierBenefits: {
    free: string
    pro: string
    enterprise: string
  }
}

// ─── API calls ───
export const authApi = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>("/auth/login", data),

  register: (data: RegisterRequest) =>
    api.post<RegisterResponse>("/auth/register", data),

  getMe: () =>
    api.get<UserProfile>("/auth/me"),

  getQuota: () =>
    api.get<QuotaInfo>("/auth/quota"),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>("/auth/forgot-password", { email }),

  resetPassword: (data: { email: string; otpCode: string; newPassword: string }) =>
    api.post<{ message: string }>("/auth/reset-password", data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put<{ message: string }>("/auth/change-password", data),

  updateProfile: (data: { displayName: string }) =>
    api.put<{ message: string; displayName: string; email: string }>("/auth/profile", data),
}
