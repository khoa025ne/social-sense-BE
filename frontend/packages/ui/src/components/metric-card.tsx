import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

interface MetricCardProps {
  /** Metric label */
  label: string
  /** Formatted current value */
  value: string
  /** Formatted previous value (optional, for comparison) */
  previousValue?: string
  /** Change percentage (positive = growth) */
  changePercent?: number | null
  /** Simple explanation */
  description?: string
  /** Whether higher values are better */
  higherIsBetter?: boolean
  className?: string
}

/**
 * MetricCard — Analytics metric display with change indicator
 */
export function MetricCard({
  label,
  value,
  previousValue,
  changePercent,
  description,
  higherIsBetter = true,
  className,
}: MetricCardProps) {
  const isPositive =
    changePercent !== null &&
    changePercent !== undefined &&
    ((higherIsBetter && changePercent > 0) || (!higherIsBetter && changePercent < 0))

  const isNegative =
    changePercent !== null &&
    changePercent !== undefined &&
    ((higherIsBetter && changePercent < 0) || (!higherIsBetter && changePercent > 0))

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5",
        "transition-all duration-300",
        "hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:-translate-y-0.5",
        className
      )}
    >
      <p className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight">{value}</span>
        {changePercent !== null && changePercent !== undefined && (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              isPositive && "bg-success text-success-foreground",
              isNegative && "bg-destructive/10 text-destructive",
              !isPositive && !isNegative && "bg-muted text-muted-foreground"
            )}
          >
            {changePercent > 0 ? "+" : ""}
            {changePercent.toFixed(1)}%
            <span className="ml-0.5">
              {changePercent > 0 ? "↑" : changePercent < 0 ? "↓" : "→"}
            </span>
          </span>
        )}
      </div>
      {previousValue && (
        <p className="mt-1 text-xs text-muted-foreground">
          Trước: {previousValue}
        </p>
      )}
      {description && (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{description}</p>
      )}
    </div>
  )
}
