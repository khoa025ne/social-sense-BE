export const Colors = {
  primary: {
    DEFAULT: '#111827',
    50: '#F9FAFB',
    100: '#F3F4F6',
    500: '#111827',
    600: '#1F2937',
    700: '#374151',
  },
  tier: {
    free: '#6B7280',
    pro: '#111827',
    enterprise: '#F59E0B',
  },
  quota: {
    high: '#10B981',   // >50%
    medium: '#F59E0B', // 20-50%
    low: '#EF4444',    // <20%
  },
  background: {
    DEFAULT: '#FFFFFF',
    secondary: '#F9FAFB',
    card: '#F3F4F6',
  },
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    inverse: '#FFFFFF',
  },
  border: '#E5E7EB',
  dark: {
    background: '#111827',
    card: '#1F2937',
    text: '#F9FAFB',
    border: '#374151',
  },
} as const;
