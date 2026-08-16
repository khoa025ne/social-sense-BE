import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

interface HotLevelBarProps {
  /** Hot level from 1 to 10 */
  level: number
  /** Total segments */
  total?: number
  className?: string
}

/**
 * HotLevelBar — 10-segment trend heat indicator
 */
export function HotLevelBar({
  level,
  total = 10,
  className,
}: HotLevelBarProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-3 w-2 rounded-sm transition-colors duration-300",
            i < level ? "bg-foreground" : "bg-border"
          )}
          style={{ animationDelay: `${i * 50}ms` }}
        />
      ))}
      <span className="ml-2 text-xs font-medium text-muted-foreground">
        {level}/{total}
      </span>
    </div>
  )
}
