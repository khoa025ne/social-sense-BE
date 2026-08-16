import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { UserProfile, QuotaInfo } from "@/api/auth"

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserProfile | null
  quota: QuotaInfo | null
  isAuthenticated: boolean

  // Actions
  setAuth: (data: {
    accessToken: string
    refreshToken: string
    user?: Partial<UserProfile>
  }) => void
  setUser: (user: UserProfile) => void
  setQuota: (quota: QuotaInfo) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      quota: null,
      isAuthenticated: false,

      setAuth: ({ accessToken, refreshToken, user }) =>
        set((state) => ({
          accessToken,
          refreshToken,
          isAuthenticated: true,
          user: user
            ? { ...state.user, ...user } as UserProfile
            : state.user,
        })),

      setUser: (user) =>
        set({ user }),

      setQuota: (quota) =>
        set({ quota }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          quota: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
