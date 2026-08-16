import * as React from "react"
import { motion } from "motion/react"

interface Option {
  label: string
  value: string
}

interface SegmentedButtonProps {
  options: Option[]
  selectedValue: string
  onChange: (value: string) => void
  className?: string
}

export function SegmentedButton({
  options,
  selectedValue,
  onChange,
  className
}: SegmentedButtonProps) {
  return (
    <div className={`inline-flex p-1 bg-muted/50 border rounded-xl relative ${className || ""}`}>
      {options.map((option) => {
        const isSelected = selectedValue === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`px-4 py-1.5 text-xs font-semibold relative rounded-lg cursor-pointer transition-colors z-10 ${
              isSelected ? "text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isSelected && (
              <motion.div
                layoutId="segmented-active"
                className="absolute inset-0 bg-foreground rounded-lg -z-10"
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
              />
            )}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
