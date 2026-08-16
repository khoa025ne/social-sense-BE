import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

interface FauxOSWindowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  /** Title shown in the title bar */
  title?: string
}

/**
 * FauxOSWindow — Minimalist macOS-style window chrome wrapper
 * White top bar with three small gray circles + content area
 */
export function FauxOSWindow({
  children,
  className,
  title,
  ...props
}: FauxOSWindowProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className
      )}
      {...props}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-border bg-surface-alt px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-border" />
          <span className="h-3 w-3 rounded-full bg-border" />
          <span className="h-3 w-3 rounded-full bg-border" />
        </div>
        {title && (
          <span className="ml-2 text-xs text-muted-foreground">{title}</span>
        )}
      </div>

      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  )
}
