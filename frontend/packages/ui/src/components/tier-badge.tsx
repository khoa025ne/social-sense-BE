import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

interface TierBadgeProps {
  tier: "Free" | "Pro" | "Ultra" | "Enterprise" | string
  className?: string
  clickable?: boolean
}

/**
 * TierBadge — Pill-shaped tier indicator with optional upgrade hover effect
 */
export function TierBadge({ tier, className, clickable = true }: TierBadgeProps) {
  const displayTier = tier === "Enterprise" ? "Ultra" : tier
  const variant =
    tier === "Free"
      ? "bg-muted text-muted-foreground hover:bg-foreground/10"
      : tier === "Pro"
        ? "bg-foreground text-background hover:opacity-90"
        : "bg-foreground text-background hover:opacity-90"

  return (
    <span
      className={cn(
        "text-eyebrow inline-flex items-center rounded-full px-2.5 py-0.5 transition-all duration-200",
        clickable && "cursor-pointer hover:scale-105 active:scale-95 shadow-xs",
        variant,
        className
      )}
    >
      {displayTier}
    </span>
  )
}
