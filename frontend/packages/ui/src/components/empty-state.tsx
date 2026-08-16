import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

interface EmptyStateProps {
  title: string
  description?: string
  /** Icon or illustration */
  icon?: React.ReactNode
  /** Action button */
  action?: React.ReactNode
  className?: string
}

/**
 * EmptyState — Illustrated message for empty lists/states
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-alt text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
