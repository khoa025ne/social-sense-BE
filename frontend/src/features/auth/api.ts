import apiClient from '@/lib/api';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  UserProfile,
  QuotaResponse,
  RefreshTokenRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
  UpdateProfileResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from '@/types/api';

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>('/auth/login', data);
  return res.data;
}

export async function register(data: RegisterRequest): Promise<{ message: string; userId: number }> {
  const res = await apiClient.post<{ message: string; userId: number }>('/auth/register', data);
  return res.data;
}

export async function refreshToken(data: RefreshTokenRequest): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>('/auth/refresh', data);
  return res.data;
}

export async function getMe(): Promise<UserProfile> {
  const res = await apiClient.get<UserProfile>('/auth/me');
  return res.data;
}

export async function getQuota(): Promise<QuotaResponse> {
  const res = await apiClient.get<QuotaResponse>('/auth/quota');
  return res.data;
}

export async function changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
  const res = await apiClient.put<{ message: string }>('/auth/change-password', data);
  return res.data;
}

export async function updateProfile(data: UpdateProfileRequest): Promise<UpdateProfileResponse> {
  const res = await apiClient.put<UpdateProfileResponse>('/auth/profile', data);
  return res.data;
}

// ─── Forgot / Reset Password ──────────────────────────────────────────────────

/**
 * Gửi OTP về email. BE luôn trả 200 dù email có tồn tại hay không
 * (tránh email enumeration attack).
 */
export async function forgotPassword(
  data: ForgotPasswordRequest
): Promise<ForgotPasswordResponse> {
  const res = await apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', data);
  return res.data;
}

/**
 * Xác nhận OTP + đặt lại mật khẩu mới.
 * Sau khi thành công, BE revoke tất cả refresh token → FE phải logout.
 */
export async function resetPassword(
  data: ResetPasswordRequest
): Promise<ResetPasswordResponse> {
  const res = await apiClient.post<ResetPasswordResponse>('/auth/reset-password', data);
  return res.data;
}
