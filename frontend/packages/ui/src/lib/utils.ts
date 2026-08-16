import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number with locale-aware separators
 */
export function formatNumber(value: number, locale = "vi-VN"): string {
  return new Intl.NumberFormat(locale).format(value)
}

/**
 * Format a currency amount in VND
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Truncate text to a max length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + "..."
}

/**
 * Generate CSS variable style for stagger animation delay
 */
export function staggerDelay(index: number): React.CSSProperties {
  return { "--index": index } as React.CSSProperties
}
