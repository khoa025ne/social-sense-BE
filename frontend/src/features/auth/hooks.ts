import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuthStore } from './store';
import {
  login, register, getMe, getQuota, changePassword, updateProfile,
  forgotPassword, resetPassword,
} from './api';
import { saveTokens, clearTokens } from '@/lib/secureStore';
import { queryClient } from '@/lib/queryClient';
import type {
  LoginRequest, RegisterRequest, ChangePasswordRequest, UpdateProfileRequest,
  ForgotPasswordRequest, ResetPasswordRequest,
} from '@/types/api';
import { Config } from '@/constants/config';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const authKeys = {
  me: ['auth', 'me'] as const,
  quota: ['auth', 'quota'] as const,
};

// ─── useLogin ────────────────────────────────────────────────────────────────

export function useLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: LoginRequest) => login(data),
    onSuccess: async (response) => {
      await saveTokens(response.accessToken, response.refreshToken);
      setAuth(response);

      if (!response.hasContext) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    },
  });
}

// ─── useRegister ─────────────────────────────────────────────────────────────

export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterRequest) => register(data),
  });
}

// ─── useLogout ───────────────────────────────────────────────────────────────

export function useLogout() {
  const { clearAuth } = useAuthStore();
  const router = useRouter();

  return async () => {
    await clearTokens();
    clearAuth();
    queryClient.clear();
    router.replace('/(auth)/login');
  };
}

// ─── useMe ───────────────────────────────────────────────────────────────────
// Fetches full user profile (includes tier + roles) and syncs to Zustand store.

export function useMe() {
  const { isAuthenticated, setTier, setRoles } = useAuthStore();

  const query = useQuery({
    queryKey: authKeys.me,
    queryFn: getMe,
    enabled: isAuthenticated,
    staleTime: Config.QUERY.STALE_TIME,
  });

  // Sync tier + roles into Zustand AFTER render (not inside select/render)
  // to avoid triggering a state update loop during the render phase.
  useEffect(() => {
    if (query.data) {
      setTier(query.data.tier);
      setRoles(query.data.roles);
    }
  }, [query.data, setTier, setRoles]);

  return query;
}

// ─── useQuota ────────────────────────────────────────────────────────────────

export function useQuota() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: authKeys.quota,
    queryFn: getQuota,
    enabled: isAuthenticated,
    staleTime: Config.QUERY.QUOTA_STALE_TIME,
  });
}

// ─── useRefreshQuota ─────────────────────────────────────────────────────────

export function useRefreshQuota() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: authKeys.quota });
}

// ─── useChangePassword ────────────────────────────────────────────────────────
// Sau khi đổi mật khẩu thành công, tự logout vì BE đã revoke tất cả refresh tokens.

export function useChangePassword() {
  const { clearAuth } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => changePassword(data),
    onSuccess: async () => {
      await clearTokens();
      clearAuth();
      queryClient.clear();
      router.replace('/(auth)/login');
    },
  });
}

// ─── useUpdateProfile ─────────────────────────────────────────────────────────
// Cập nhật displayName, sau đó invalidate ME query để Profile tự refresh.

export function useUpdateProfile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

// ─── useForgotPassword ────────────────────────────────────────────────────────
// BE luôn trả 200 dù email có tồn tại hay không — không throw error cho case này.

export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: ForgotPasswordRequest) => forgotPassword(data),
  });
}

// ─── useResetPassword ─────────────────────────────────────────────────────────
// Sau khi đặt lại mật khẩu thành công, BE revoke tất cả refresh token
// → phải xóa token local và redirect về Login.

export function useResetPassword() {
  const { clearAuth } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: ResetPasswordRequest) => resetPassword(data),
    onSuccess: async () => {
      // BE đã revoke tất cả refresh token → clear local state
      await clearTokens();
      clearAuth();
      queryClient.clear();
      // Navigate về login — replace để không thể back về reset screen
      router.replace('/(auth)/login');
    },
  });
}
