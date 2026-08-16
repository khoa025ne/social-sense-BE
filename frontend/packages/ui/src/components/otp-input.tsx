import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

interface OTPInputProps {
  /** Number of OTP digits */
  length?: number
  /** Callback when all digits are entered */
  onComplete?: (otp: string) => void
  /** Error state */
  error?: boolean
  className?: string
}

/**
 * OTPInput — Individual digit boxes for 6-digit OTP entry
 * Supports auto-advance, backspace navigation, and paste
 */
export function OTPInput({
  length = 6,
  onComplete,
  error = false,
  className,
}: OTPInputProps) {
  const [values, setValues] = React.useState<string[]>(Array(length).fill(""))
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])

  const focusInput = (index: number) => {
    if (index >= 0 && index < length) {
      inputRefs.current[index]?.focus()
    }
  }

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return

    const newValues = [...values]
    newValues[index] = value
    setValues(newValues)

    if (value && index < length - 1) {
      focusInput(index + 1)
    }

    const otp = newValues.join("")
    if (otp.length === length && onComplete) {
      onComplete(otp)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !values[index] && index > 0) {
      focusInput(index - 1)
    }
    if (e.key === "ArrowLeft") focusInput(index - 1)
    if (e.key === "ArrowRight") focusInput(index + 1)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)
    if (!pastedData) return

    const newValues = [...values]
    pastedData.split("").forEach((char, i) => {
      newValues[i] = char
    })
    setValues(newValues)
    focusInput(Math.min(pastedData.length, length - 1))

    if (pastedData.length === length && onComplete) {
      onComplete(pastedData)
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {values.map((value, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className={cn(
            "flex h-14 w-12 items-center justify-center rounded-lg border text-center font-mono text-2xl font-semibold",
            "transition-colors duration-200",
            "focus:border-foreground focus:ring-2 focus:ring-foreground/20 focus:outline-none",
            error
              ? "border-destructive bg-destructive/5"
              : "border-border bg-card hover:border-foreground/20"
          )}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  )
}
