import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAdminDashboard,
  getAdminUsers,
  getAdminUser,
  updateUserTier,
  resetUserQuota,
  deactivateUser,
  restoreUser,
  getApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  reloadApiKeyPool,
  clearApiKeyCooldowns,
  getSupportedModels,
  compareStats,
} from './api';
import { Config } from '@/constants/config';
import type { CreateApiKeyRequest, UpdateApiKeyRequest, StatsCompareRequest } from '@/types/api';

export const adminKeys = {
  dashboard: ['admin', 'dashboard'] as const,
  users: (search?: string) => ['admin', 'users', search] as const,
  user: (id: number) => ['admin', 'user', id] as const,
  apiKeys: ['admin', 'api-keys'] as const,
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useAdminDashboard() {
  return useQuery({
    queryKey: adminKeys.dashboard,
    queryFn: getAdminDashboard,
    staleTime: Config.QUERY.STALE_TIME,
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function useAdminUsers(search?: string) {
  return useInfiniteQuery({
    queryKey: adminKeys.users(search),
    queryFn: ({ pageParam = 1 }) =>
      getAdminUsers(pageParam as number, Config.PAGINATION.ADMIN_USERS_PAGE_SIZE, search),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined;
    },
  });
}

export function useAdminUser(id: number) {
  return useQuery({
    queryKey: adminKeys.user(id),
    queryFn: () => getAdminUser(id),
    staleTime: Config.QUERY.STALE_TIME,
  });
}

export function useUpdateUserTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tier }: { id: number; tier: string }) => updateUserTier(id, tier),
    onSuccess: (_, { id }) => {
      // Invalidate user list and the specific user detail
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: adminKeys.user(id) });
    },
  });
}

export function useResetUserQuota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => resetUserQuota(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: adminKeys.user(id) });
    },
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deactivateUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useRestoreUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => restoreUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export function useApiKeys() {
  return useQuery({
    queryKey: adminKeys.apiKeys,
    queryFn: getApiKeys,
    staleTime: Config.QUERY.STALE_TIME,
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateApiKeyRequest) => createApiKey(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.apiKeys }),
  });
}

export function useUpdateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateApiKeyRequest }) =>
      updateApiKey(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.apiKeys }),
  });
}

export function useDeleteApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.apiKeys }),
  });
}

export function useReloadApiKeyPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clearCooldowns?: boolean) => reloadApiKeyPool(clearCooldowns),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.apiKeys }),
  });
}

export function useClearApiKeyCooldowns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => clearApiKeyCooldowns(),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.apiKeys }),
  });
}

export function useAdminModels() {
  return useQuery({
    queryKey: ['admin', 'models'] as const,
    queryFn: getSupportedModels,
    staleTime: 10 * 60 * 1000, // 10 phút — danh sách models ít thay đổi
  });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function useCompareStats() {
  return useMutation({
    mutationFn: (data: StatsCompareRequest) => compareStats(data),
  });
}
