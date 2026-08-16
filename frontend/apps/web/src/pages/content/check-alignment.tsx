import { useState } from "react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { Button } from "@workspace/ui/components/button"
import { LiquidMetalButton } from "@workspace/ui/components/liquid-metal-button"
import { toast } from "sonner"
import { contentApi, type AlignmentCheckResponse } from "@/api/content"
import { Loader2 } from "lucide-react"

export default function CheckAlignmentPage() {
  const [draftContent, setDraftContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AlignmentCheckResponse | null>(null)

  const handleCheck = async () => {
    if (!draftContent.trim()) {
      toast.error("Vui lòng nhập nội dung bài đăng cần kiểm tra!")
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const res = await contentApi.checkAlignment({ draftContent })
      setResult(res)
      toast.success("Kiểm tra mức độ phù hợp thương hiệu thành công!")
    } catch (err: any) {
      console.error("Failed to check alignment", err)
      toast.error(err.message || "Kiểm tra thất bại. Vui lòng thử lại!")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 flex flex-col gap-8 max-w-4xl mx-auto">
      <PageHeader
        title="Brand Alignment Check"
        description="Đánh giá mức độ phù hợp của nội dung bài đăng với Persona thương hiệu và tối ưu hóa từ AI."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Input Form */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <DoubleBezelCard className="bg-background p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold">Nội dung bài đăng bản nháp</label>
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                placeholder="Dán nội dung bài viết của bạn vào đây để AI đánh giá..."
                className="min-h-48 p-3 border rounded-xl bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end">
              <LiquidMetalButton
                label={loading ? "Đang đánh giá..." : "Bắt đầu"}
                onClick={handleCheck}
              />
            </div>
          </DoubleBezelCard>
        </div>

        {/* Info Box */}
        <div className="flex flex-col gap-6">
          <DoubleBezelCard className="bg-background p-6">
            <h4 className="font-bold text-sm mb-4">Tính năng này là gì?</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI sẽ phân tích nội dung của bạn dựa trên <strong>Persona</strong> thương hiệu hiện tại mà bạn đã cấu hình, từ đó chấm điểm và đưa ra bản tối ưu hóa chuẩn tone giọng nhất.
            </p>
          </DoubleBezelCard>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="animate-spin size-8 text-primary" />
          <span className="text-sm text-muted-foreground font-mono">AI đang phân tích và chấm điểm thương hiệu...</span>
        </div>
      )}

      {/* Result Panel */}
      {result && (
        <div className="flex flex-col gap-6 animate-fade-up">
          <h3 className="font-serif text-2xl font-bold">Kết quả đánh giá</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* Score Card */}
            <DoubleBezelCard className="bg-background p-6 flex flex-col justify-between">
              <div>
                <span className="text-muted-foreground text-xs font-mono uppercase tracking-wider block">Điểm thương hiệu</span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-serif font-bold tracking-tight">{result.brandScore}</span>
                  <span className="text-muted-foreground text-sm">/ 100</span>
                </div>
                {/* Score Bar */}
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden mt-4">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      result.brandScore >= 80 ? "bg-emerald-500" : result.brandScore >= 50 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${result.brandScore}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed italic">
                {result.brandScore >= 80 
                  ? "✓ Nội dung rất phù hợp với định hướng giọng điệu thương hiệu của bạn." 
                  : result.brandScore >= 50 
                  ? "⚠ Phù hợp trung bình. Nên tối ưu hóa các điểm chưa đồng nhất." 
                  : "✗ Nội dung lệch tone giọng thương hiệu. Hãy sử dụng bản chỉnh sửa của AI."
                }
              </p>
            </DoubleBezelCard>

            {/* Analysis Card */}
            <DoubleBezelCard className="bg-background p-6 md:col-span-2">
              <h4 className="font-bold text-sm border-b pb-2 mb-3">Phân tích & Đề xuất tối ưu</h4>
              <div className="flex flex-col gap-4">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Nhận xét chi tiết:</span>
                  <p className="text-xs leading-relaxed text-foreground mt-1 whitespace-pre-wrap">{result.analysis}</p>
                </div>
                <div className="border-t pt-3">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Gợi ý chỉnh sửa:</span>
                  <p className="text-xs leading-relaxed text-foreground mt-1 whitespace-pre-wrap">{result.suggestions}</p>
                </div>
              </div>
            </DoubleBezelCard>
          </div>

          {/* Refined Content Card */}
          <DoubleBezelCard className="bg-background p-6 border-foreground/20">
            <div className="flex justify-between items-center border-b pb-3 text-xs mb-4">
              <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-mono rounded-md font-bold">
                Bản tinh chỉnh đề xuất từ AI (Refined)
              </span>
            </div>
            
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground bg-muted/10 p-4 rounded-xl border border-dashed">
              {result.refinedContent}
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" size="sm" onClick={() => {
                navigator.clipboard.writeText(result.refinedContent)
                toast.success("Đã copy bản tinh chỉnh vào bộ nhớ tạm!")
              }}>
                Sao chép bản tinh chỉnh
              </Button>
            </div>
          </DoubleBezelCard>
        </div>
      )}
    </div>
  )
}
