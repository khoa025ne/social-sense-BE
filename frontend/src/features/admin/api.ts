import apiClient from '@/lib/api';
import type {
  AdminDashboard,
  AdminUsersResponse,
  AdminUser,
  ApiKeyItem,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  SupportedModelsResponse,
  StatsCompareRequest,
  StatsCompareResponse,
} from '@/types/api';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const res = await apiClient.get<AdminDashboard>('/admin/dashboard');
  return res.data;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getAdminUsers(
  page: number,
  pageSize: number,
  search?: string
): Promise<AdminUsersResponse> {
  const res = await apiClient.get<AdminUsersResponse>('/admin/users', {
    params: { page, pageSize, search: search || undefined },
  });
  return res.data;
}

export async function getAdminUser(id: number): Promise<AdminUser> {
  const res = await apiClient.get<AdminUser>(`/admin/users/${id}`);
  return res.data;
}

export async function updateUserTier(
  id: number,
  tier: string
): Promise<{ message: string }> {
  const res = await apiClient.put<{ message: string }>(`/admin/users/${id}/tier`, { tier });
  return res.data;
}

export async function resetUserQuota(id: number): Promise<{ message: string }> {
  const res = await apiClient.post<{ message: string }>(`/admin/users/${id}/reset-quota`);
  return res.data;
}

export async function deactivateUser(id: number): Promise<{ message: string }> {
  const res = await apiClient.delete<{ message: string }>(`/admin/users/${id}`);
  return res.data;
}

export async function restoreUser(id: number): Promise<{ message: string }> {
  const res = await apiClient.post<{ message: string }>(`/admin/users/${id}/restore`);
  return res.data;
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export async function getApiKeys(): Promise<ApiKeyItem[]> {
  const res = await apiClient.get<ApiKeyItem[]>('/admin/api-keys');
  return res.data;
}

export async function createApiKey(data: CreateApiKeyRequest): Promise<{ message: string; id: number }> {
  const res = await apiClient.post<{ message: string; id: number }>('/admin/api-keys', data);
  return res.data;
}

export async function updateApiKey(
  id: number,
  data: UpdateApiKeyRequest
): Promise<{ message: string }> {
  const res = await apiClient.put<{ message: string }>(`/admin/api-keys/${id}`, data);
  return res.data;
}

export async function deleteApiKey(id: number): Promise<{ message: string }> {
  const res = await apiClient.delete<{ message: string }>(`/admin/api-keys/${id}`);
  return res.data;
}

export async function reloadApiKeyPool(clearCooldowns = false): Promise<{ message: string }> {
  const res = await apiClient.post<{ message: string }>(
    `/admin/api-keys/reload${clearCooldowns ? '?clearCooldowns=true' : ''}`
  );
  return res.data;
}

export async function clearApiKeyCooldowns(): Promise<{ message: string; totalKeys: number }> {
  const res = await apiClient.post<{ message: string; totalKeys: number }>(
    '/admin/api-keys/clear-cooldown'
  );
  return res.data;
}

export async function getSupportedModels(): Promise<SupportedModelsResponse> {
  const res = await apiClient.get<SupportedModelsResponse>('/admin/models');
  return res.data;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function compareStats(data: StatsCompareRequest): Promise<StatsCompareResponse> {
  const res = await apiClient.post<StatsCompareResponse>('/admin/stats/compare', data);
  return res.data;
}
