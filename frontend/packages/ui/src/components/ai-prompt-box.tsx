import * as React from "react"
import { Sparkles, CornerDownLeft } from "lucide-react"

interface AIPromptBoxProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  onSubmit?: () => void
  loading?: boolean
  className?: string
}

export function AIPromptBox({
  value,
  onChange,
  placeholder = "Nhập ý tưởng viết bài hoặc phác thảo nội dung tại đây...",
  onSubmit,
  loading = false,
  className
}: AIPromptBoxProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (onSubmit && !loading) {
        onSubmit()
      }
    }
  }

  return (
    <div className={`relative flex flex-col w-full border rounded-2xl bg-background/50 p-2 focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all ${className || ""}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-transparent px-3 py-2 text-sm resize-none focus:outline-none placeholder:text-muted-foreground leading-relaxed text-foreground min-h-[80px]"
      />
      <div className="flex justify-between items-center border-t pt-2 mt-2 px-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <Sparkles className="size-3.5 text-purple-500" />
          <span>Nhấn Enter để gửi AI</span>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !value.trim()}
          className="flex items-center justify-center p-2 rounded-xl bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <CornerDownLeft className="size-4" />
        </button>
      </div>
    </div>
  )
}
