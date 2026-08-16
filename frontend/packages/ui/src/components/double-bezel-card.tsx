import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

interface DoubleBezelCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Inner padding override */
  innerPadding?: string
  /** Whether to highlight (stronger border) */
  highlighted?: boolean
}

/**
 * DoubleBezelCard — Premium card with nested architecture
 * Outer shell (subtle tinted bg + hairline border) wraps inner content core.
 * Inspired by high-end-visual-design skill's "Doppelrand" technique.
 */
export function DoubleBezelCard({
  children,
  className,
  innerPadding = "p-6 md:p-8",
  highlighted = false,
  ...props
}: DoubleBezelCardProps) {
  return (
    <div
      className={cn(
        "bezel-outer transition-all duration-500",
        highlighted && "ring-foreground/20",
        className
      )}
      {...props}
    >
      <div className={cn("bezel-inner", innerPadding)}>
        {children}
      </div>
    </div>
  )
}
