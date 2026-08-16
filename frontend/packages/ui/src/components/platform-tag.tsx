import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

interface PlatformTagProps {
  platform: string
  selected?: boolean
  onClick?: () => void
  className?: string
}

/**
 * PlatformTag — Selectable pill tag for platform selection
 */
export function PlatformTag({
  platform,
  selected = false,
  onClick,
  className,
}: PlatformTagProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium",
        "transition-all duration-200",
        selected
          ? "bg-foreground text-background"
          : "bg-surface-alt text-muted-foreground hover:bg-border hover:text-foreground",
        className
      )}
    >
      {platform}
    </button>
  )
}

interface HashtagPillProps {
  tag: string
  className?: string
}

/**
 * HashtagPill — Display-only hashtag pill
 */
export function HashtagPill({ tag, className }: HashtagPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-surface-alt px-2.5 py-0.5",
        "text-xs text-muted-foreground",
        className
      )}
    >
      #{tag}
    </span>
  )
}
