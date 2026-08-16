import * as React from "react"
import { MessageSquare, Send, Check } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "./button"
import { DoubleBezelCard } from "./double-bezel-card"
import { toast } from "sonner"

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [feedback, setFeedback] = React.useState("")
  const [submitted, setSubmitted] = React.useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedback.trim()) return

    setSubmitted(true)
    setTimeout(() => {
      setIsOpen(false)
      setSubmitted(false)
      setFeedback("")
      toast.success("Cảm ơn bạn đã gửi phản hồi cho chúng tôi!")
    }, 1500)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-80 shadow-2xl"
          >
            <DoubleBezelCard className="bg-background p-4 flex flex-col gap-4 border">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-serif font-bold text-sm">Gửi phản hồi cho SocialSence</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold"
                >
                  Đóng
                </button>
              </div>

              {submitted ? (
                <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                  <div className="size-10 bg-success text-success-foreground rounded-full flex items-center justify-center">
                    <Check className="size-5" />
                  </div>
                  <span className="text-sm font-semibold">Đã gửi phản hồi!</span>
                  <span className="text-xs text-muted-foreground">Chúng tôi chân thành cảm ơn ý kiến đóng góp của bạn.</span>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Cho chúng tôi biết cảm nhận hoặc lỗi bạn gặp phải..."
                    rows={4}
                    className="w-full p-2.5 border rounded-xl bg-background text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button
                    type="submit"
                    disabled={!feedback.trim()}
                    className="w-full gap-2 text-xs h-9"
                  >
                    <Send className="size-3.5" /> Gửi ý kiến
                  </Button>
                </form>
              )}
            </DoubleBezelCard>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex size-12 items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90 transition-transform shadow-lg cursor-pointer hover:scale-105 active:scale-95"
        aria-label="Feedback"
      >
        <MessageSquare className="size-5" />
      </button>
    </div>
  )
}
