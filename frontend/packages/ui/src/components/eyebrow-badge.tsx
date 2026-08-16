import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

interface EyebrowBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
}

/**
 * EyebrowBadge — Microscopic pill-shaped tag preceding section headings
 * Per minimalist-ui skill: rounded-full, text-[10px], uppercase, wide tracking
 */
export function EyebrowBadge({ children, className, ...props }: EyebrowBadgeProps) {
  return (
    <span
      className={cn(
        "text-eyebrow inline-flex items-center rounded-full px-3 py-1",
        "border border-border bg-surface-alt text-muted-foreground",
        "select-none",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
