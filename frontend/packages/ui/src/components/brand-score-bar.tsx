import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

interface BrandScoreBarProps {
  /** Score from 0 to 100 */
  score: number
  /** Whether to animate on mount */
  animate?: boolean
  className?: string
}

/**
 * BrandScoreBar — Animated horizontal progress bar for brand alignment score
 * Monochrome color-coded: 0-40 = light, 41-70 = medium, 71-100 = dark
 */
export function BrandScoreBar({
  score,
  animate = true,
  className,
}: BrandScoreBarProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    if (animate) {
      const timeout = setTimeout(() => setMounted(true), 100)
      return () => clearTimeout(timeout)
    }
    setMounted(true)
  }, [animate])

  const fillColor =
    score <= 40
      ? "bg-muted-foreground/40"
      : score <= 70
        ? "bg-muted-foreground/70"
        : "bg-foreground"

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Brand Score</span>
        <span className="text-2xl font-bold tracking-tight">{score}<span className="text-sm text-muted-foreground">/100</span></span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            fillColor
          )}
          style={{
            width: mounted ? `${Math.min(score, 100)}%` : "0%",
            transition: "width 1.2s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        />
      </div>
    </div>
  )
}
