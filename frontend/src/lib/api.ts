import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Config } from '@/constants/config';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './secureStore';

// Extend config để track retry
interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const apiClient = axios.create({
  baseURL: Config.API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: inject JWT
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: auto-refresh on 401, log 5xx
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig;

    // Log 5xx server errors
    if (error.response?.status && error.response.status >= 500) {
      console.error(
        `[API] Server error ${error.response.status}:`,
        error.config?.url,
        error.response.data
      );
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) {
          await clearTokens();
          // Redirect sẽ được handle bởi auth store
          return Promise.reject(error);
        }

        const response = await axios.post(`${Config.API_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        await saveTokens(accessToken, newRefreshToken);

        // Retry original request với token mới
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch {
        await clearTokens();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
