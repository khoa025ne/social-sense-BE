import { useState, useRef, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { PageHeader } from "@workspace/ui/components/page-header"
import { AnimatedBeam } from "@workspace/ui/components/animated-beam"
import { LiquidMetalButton } from "@workspace/ui/components/liquid-metal-button"
import { ImageComparison } from "@workspace/ui/components/image-comparison"
import { toast } from "sonner"
import { imageApi, type ImageAnalyzeResponse, type ImageGenerateResponse } from "@/api/image"
import { Loader2 } from "lucide-react"

export default function ImageWizardPage() {
  const location = useLocation()
  const [inputText, setInputText] = useState("")

  useEffect(() => {
    const state = location.state as { prompt?: string } | null
    if (state?.prompt) {
      setInputText(state.prompt)
    }
  }, [location.state])
  const [selectedPlatform, setSelectedPlatform] = useState("Facebook")
  const [loading, setLoading] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [step, setStep] = useState(1)

  const [analyzeData, setAnalyzeData] = useState<ImageAnalyzeResponse | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [generateData, setGenerateData] = useState<ImageGenerateResponse | null>(null)

  // Refs for AnimatedBeam
  const containerRef = useRef<HTMLDivElement>(null)
  const fromRef = useRef<HTMLDivElement>(null)
  const toRef = useRef<HTMLDivElement>(null)
  const aiRef = useRef<HTMLDivElement>(null)

  const handleStartAnalyze = async () => {
    if (!inputText.trim()) {
      toast.error("Vui lòng nhập văn bản bài đăng!")
      return
    }

    setLoading(true)
    try {
      const res = await imageApi.analyze({
        contentText: inputText,
        platform: selectedPlatform
      })
      setAnalyzeData(res)

      // Khởi tạo các giá trị câu trả lời mặc định
      const initialAnswers: Record<string, string> = {}
      res.clarifyingQuestions?.forEach(q => {
        if (q.type === "yesno") {
          initialAnswers[q.id] = "no"
        } else if (q.type === "choice" && q.options && q.options.length > 0) {
          initialAnswers[q.id] = q.options[0]
        } else {
          initialAnswers[q.id] = ""
        }
      })
      setAnswers(initialAnswers)

      setStep(2)
      toast.success("AI đã phân tích và gợi ý prompt ảnh thành công!")
    } catch (err: any) {
      console.error("Failed to analyze content", err)
      toast.error(err.message || "Phân tích thất bại. Vui lòng thử lại!")
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateImage = async () => {
    if (!analyzeData) return

    setGeneratingImage(true)
    setImageLoaded(false)
    toast.info("Đang gọi AI sinh ảnh và tối ưu hóa chi tiết...")
    try {
      const res = await imageApi.generate({
        platform: selectedPlatform,
        draftPrompt: analyzeData.draftPrompt,
        detectedIndustry: analyzeData.detectedIndustry,
        answers: answers,
        contentText: inputText,
        contentHistoryId: (location.state as any)?.contentHistoryId || undefined
      })
      setGenerateData(res)
      if (res.isGenerated && res.imageUrl) {
        // Tải trước ảnh để xác định khi nào load xong nhằm ẩn loading spinner
        const img = new Image()
        img.src = res.imageUrl
        img.onload = () => {
          setImageLoaded(true)
        }
        toast.success("Đã sinh ảnh nghệ thuật thành công!")
      } else {
        toast.info("AI đã tối ưu prompt. Bạn có thể copy prompt để tự sinh ảnh.")
      }
    } catch (err: any) {
      console.error("Failed to generate image", err)
      toast.error(err.message || "Sinh ảnh thất bại. Vui lòng thử lại!")
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleAnswerChange = (qId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: value
    }))
  }

  return (
    <div className="p-6 flex flex-col gap-8 max-w-4xl mx-auto">
      <PageHeader
        title="Image Wizard — Dựng ảnh AI"
        description="Dựng hình ảnh minh họa bài viết chuẩn thiết kế bằng cách sử dụng luồng gợi ý từ AI."
      />

      {/* Step 1: Input text & Platform */}
      {step === 1 && (
        <DoubleBezelCard className="bg-background p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">1. Chọn nền tảng hiển thị ảnh</label>
            <div className="flex gap-2">
              {["Facebook", "LinkedIn", "Instagram", "TikTok"].map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => setSelectedPlatform(platform)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                    selectedPlatform === platform
                      ? "bg-foreground text-background border-foreground font-bold"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/40"
                  }`}
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">2. Dán nội dung bài viết vào đây</label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Dán nội dung bài viết mà bạn muốn tạo ảnh minh họa..."
              className="min-h-36 p-3 border rounded-xl bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end">
            <LiquidMetalButton
              label={loading ? "Đang phân tích..." : "Bắt đầu"}
              onClick={handleStartAnalyze}
            />
          </div>
        </DoubleBezelCard>
      )}

      {/* Step 2: Show flow analysis & form choices */}
      {step === 2 && analyzeData && (
        <div className="flex flex-col gap-8">
          {/* Animated Beam Node Map Container */}
          <div
            ref={containerRef}
            className="relative flex w-full max-w-lg mx-auto items-center justify-between overflow-hidden rounded-xl border bg-background/50 p-10 shadow-sm"
          >
            <div className="flex flex-col gap-6">
              {/* Left Node: Input Article */}
              <div
                ref={fromRef}
                className="z-10 flex size-12 items-center justify-center rounded-full border bg-background shadow-md"
              >
                <svg className="size-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              {/* Left Node 2: Tri thức học được */}
              <div
                ref={toRef}
                className="z-10 flex size-12 items-center justify-center rounded-full border bg-background shadow-md"
              >
                <svg className="size-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
            </div>

            {/* Middle Node: AI core processor */}
            <div
              ref={aiRef}
              className="z-10 flex size-16 items-center justify-center rounded-full border-2 border-foreground bg-background shadow-lg"
            >
              <svg className="size-6 text-foreground animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>

            {/* Right Node: Output image prompt */}
            <div className="flex flex-col gap-6">
              <div className="z-10 flex size-12 items-center justify-center rounded-full border bg-background shadow-md">
                <svg className="size-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>

            {/* Beams linking nodes */}
            <AnimatedBeam
              containerRef={containerRef}
              fromRef={fromRef}
              toRef={aiRef}
              duration={3}
            />
            <AnimatedBeam
              containerRef={containerRef}
              fromRef={toRef}
              toRef={aiRef}
              duration={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Options configuration panel */}
            <DoubleBezelCard className="bg-background p-6 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-sm">Đọc hiểu & Phân tích của AI</h4>
                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                  {analyzeData.imageSummary}
                </p>
                <div className="text-[10px] font-mono text-muted-foreground mt-1">
                  Ngành hàng: <span className="text-foreground font-semibold">{analyzeData.detectedIndustry}</span> | Kích thước: <span className="text-foreground font-semibold">{analyzeData.bannerSpecs?.dimensions} ({analyzeData.bannerSpecs?.aspectRatio})</span>
                </div>

                {/* Gợi ý Prompt */}
                <div className="border-t pt-4 mt-4">
                  <h5 className="text-xs font-semibold mb-2 font-mono uppercase tracking-wider text-muted-foreground">Prompt đề xuất sinh ảnh:</h5>
                  <div className="p-3 border rounded bg-muted/40 font-mono text-[10px] text-muted-foreground break-all">
                    {analyzeData.draftPrompt}
                  </div>
                </div>

                {/* Form khảo sát bổ sung được ẩn đi để tối giản hóa trải nghiệm, sử dụng giá trị mặc định chạy ngầm */}
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button variant="outline" size="sm" onClick={() => { setStep(1); setGenerateData(null); }} className="w-full sm:flex-1">
                  Quay lại bước 1
                </Button>
                <div className="w-full sm:flex-1 flex justify-center">
                  <LiquidMetalButton
                    label={generatingImage ? "Đang xử lý..." : "Bắt đầu"}
                    onClick={handleGenerateImage}
                  />
                </div>
              </div>
            </DoubleBezelCard>

            {/* Results Image Display Panel */}
            <DoubleBezelCard className="bg-background overflow-hidden relative min-h-[350px] flex items-center justify-center p-4">
              {generateData ? (
                <div className="w-full h-full flex flex-col gap-4">
                  {generateData.isGenerated && generateData.imageUrl ? (
                    <div className="flex flex-col gap-2 relative">
                      <div className="text-[10px] font-mono text-muted-foreground uppercase text-center mb-1">
                        Kéo trượt để so sánh (Ảnh phác thảo & AI Render)
                      </div>
                      
                      {!imageLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-xl min-h-[240px] z-20">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin size-6 text-primary" />
                            <span className="text-[10px] text-muted-foreground font-mono">Đang tải ảnh từ Pollinations...</span>
                          </div>
                        </div>
                      )}

                      <ImageComparison
                        beforeImage="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=600&auto=format&fit=crop"
                        afterImage={generateData.imageUrl}
                        beforeLabel="Ảnh phác thảo"
                        afterLabel="AI Studio Render"
                        className="w-full h-64 border rounded-xl object-cover"
                      />
                      
                      <div className="flex justify-between items-center mt-2 border-t pt-3">
                        <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]" title={generateData.finalPrompt}>
                          Prompt: {generateData.finalPrompt}
                        </span>
                        <a 
                          href={generateData.imageUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-xs font-semibold font-mono border px-3 py-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/80 transition-colors"
                        >
                          Tải ảnh ↗
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 p-4 justify-center h-full">
                      <div className="text-xs text-rose-500 font-semibold font-mono flex items-center gap-1">
                        ⚠️ Không thể tự sinh ảnh tự động (API Cooldown).
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Backend khuyên dùng copy prompt tối ưu hóa dưới đây để tự tạo trên AI Studio:
                      </p>
                      <textarea
                        readOnly
                        value={generateData.finalPrompt}
                        className="p-3 border rounded-xl bg-muted/20 font-mono text-xs text-muted-foreground min-h-28 resize-none focus:outline-none"
                      />
                      <Button 
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(generateData.finalPrompt)
                          toast.success("Đã copy Prompt tối ưu vào bộ nhớ tạm!")
                        }}
                      >
                        Copy Prompt tối ưu hóa
                      </Button>
                      {generateData.promptUsageTip && (
                        <div className="text-[10px] text-muted-foreground italic leading-relaxed bg-muted/10 p-2.5 rounded-lg border">
                          💡 Hướng dẫn: {generateData.promptUsageTip}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full bg-muted/20 flex flex-col items-center justify-center text-center p-6 gap-2 w-full min-h-[260px] rounded-xl">
                  {generatingImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="animate-spin size-8 text-primary" />
                      <span className="text-xs text-muted-foreground font-mono">AI đang render hình vẽ và màu sắc...</span>
                      <span className="text-[9px] text-muted-foreground/60 max-w-xs leading-relaxed">
                        (Quá trình này mất khoảng 5 đến 15 giây đối với render lần đầu)
                      </span>
                    </div>
                  ) : (
                    <>
                      <svg className="size-8 text-muted-foreground animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-muted-foreground font-mono">Hình ảnh preview sẽ hiển thị tại đây</span>
                      <span className="text-[10px] text-muted-foreground/60 max-w-xs leading-relaxed mt-2">
                        (Bấm nút sinh ảnh ở thẻ cấu hình để khởi tạo hình ảnh thực tế)
                      </span>
                    </>
                  )}
                </div>
              )}
            </DoubleBezelCard>
          </div>
        </div>
      )}
    </div>
  )
}
