export const Config = {
  API_URL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5280',
  TOKEN_KEYS: {
    ACCESS: 'accessToken',
    REFRESH: 'refreshToken',
  },
  QUERY: {
    STALE_TIME: 5 * 60 * 1000,       // 5 phút
    QUOTA_STALE_TIME: 0,              // luôn fresh
    PAYMENT_POLL_INTERVAL: 3000,      // 3 giây
    PAYMENT_POLL_TIMEOUT: 10 * 60 * 1000, // 10 phút
  },
  PAGINATION: {
    TRENDS_PAGE_SIZE: 12,
    HISTORY_PAGE_SIZE: 10,
    ADMIN_USERS_PAGE_SIZE: 20,
  },
} as const;
