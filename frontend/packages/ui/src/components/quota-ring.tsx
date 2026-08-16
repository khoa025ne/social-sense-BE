import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

interface QuotaRingProps {
  /** Current remaining quota */
  remaining: number
  /** Total quota limit */
  total: number
  /** Size of the ring in pixels */
  size?: number
  /** Stroke width */
  strokeWidth?: number
  /** Whether quota is unlimited */
  isUnlimited?: boolean
  className?: string
}

/**
 * QuotaRing — SVG circular progress ring showing quota usage
 */
export function QuotaRing({
  remaining,
  total,
  size = 64,
  strokeWidth = 5,
  isUnlimited = false,
  className,
}: QuotaRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const usedPercent = isUnlimited ? 0 : Math.min(((total - remaining) / total) * 100, 100)
  const dashOffset = circumference - (usedPercent / 100) * circumference

  const isLow = !isUnlimited && total > 0 && (remaining / total) <= 0.2;

  return (
    <div 
      className={cn("relative inline-flex items-center justify-center select-none", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90 block">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          className="opacity-45"
        />
        {/* Progress circle */}
        {!isUnlimited && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className={cn(
              "transition-all duration-700",
              isLow ? "text-rose-500" : "text-foreground"
            )}
            style={{
              transition: "stroke-dashoffset 1s cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={cn(
          "text-xs font-mono font-bold leading-none tracking-tight",
          isLow ? "text-rose-600" : "text-foreground"
        )}>
          {isUnlimited ? "∞" : remaining}
        </span>
        {!isUnlimited && (
          <span className="mt-0.5 text-[8px] font-mono text-muted-foreground leading-none">
            /{total}
          </span>
        )}
      </div>
    </div>
  )
}
