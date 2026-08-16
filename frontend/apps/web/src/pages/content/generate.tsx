import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { PageHeader } from "@workspace/ui/components/page-header"
import { PlatformTag } from "@workspace/ui/components/platform-tag"
import { EyebrowBadge } from "@workspace/ui/components/eyebrow-badge"
import { AIPromptBox } from "@workspace/ui/components/ai-prompt-box"
import { LiquidMetalButton } from "@workspace/ui/components/liquid-metal-button"
import { toast } from "sonner"
import { contentApi, type ContentItem } from "@/api/content"
import { useAuthStore } from "@/stores/auth-store"
import { authApi } from "@/api/auth"

export default function ContentGeneratePage() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState("")
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [generatedItems, setGeneratedItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(false)
  const { setQuota } = useAuthStore()

  const handleTogglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Vui lòng nhập chủ đề bài viết!")
      return
    }
    if (selectedPlatforms.length === 0) {
      toast.error("Vui lòng chọn ít nhất một nền tảng!")
      return
    }

    setLoading(true)
    setGeneratedItems([])

    try {
      // Gọi API sinh nội dung thật từ Backend
      const res = await contentApi.generate({
        trendId: null,
        outputCount: 1,
        language: "vi",
        targetPlatforms: selectedPlatforms,
        generateImage: false,
        mode: "PersonaDriven",
        userInstruction: prompt
      })

      setGeneratedItems(res.items)
      toast.success("Đã sinh nội dung bằng AI thành công!")

      // Đồng bộ lại quota mới nhất của user
      try {
        const quotaInfo = await authApi.getQuota()
        setQuota(quotaInfo)
      } catch (qErr) {
        console.error("Failed to sync quota after content generation", qErr)
      }
    } catch (err: any) {
      console.error("Generation failed", err)
      toast.error(err.message || "Không thể sinh nội dung. Vui lòng thử lại!")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 flex flex-col gap-8 max-w-4xl mx-auto">
      <PageHeader
        title="Tạo bài viết AI"
        description="Nhập ý tưởng của bạn và để trí tuệ nhân tạo sinh nội dung tối ưu đa kênh."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Form Settings */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <DoubleBezelCard className="bg-background p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold">1. Bạn muốn viết về chủ đề gì?</label>
              {/* Premium Joly UI Prompt Box */}
              <AIPromptBox
                value={prompt}
                onChange={setPrompt}
                onSubmit={handleGenerate}
                loading={loading}
                placeholder="Ví dụ: Giới thiệu tính năng sinh ảnh bằng AI của phần mềm SocialSence giúp marketer tiết kiệm thời gian..."
              />
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold">2. Chọn nền tảng đăng bài</label>
              <div className="flex flex-wrap gap-2">
                {["Facebook", "LinkedIn", "Instagram", "TikTok"].map((platform) => (
                  <PlatformTag
                    key={platform}
                    platform={platform}
                    selected={selectedPlatforms.includes(platform)}
                    onClick={() => handleTogglePlatform(platform)}
                  />
                ))}
              </div>
            </div>

            {/* Joly UI Liquid Metal Button for Generate function */}
            <div className="mt-4 flex justify-end">
              <LiquidMetalButton
                label={loading ? "Đang sinh nội dung..." : "Bắt đầu"}
                onClick={handleGenerate}
              />
            </div>
          </DoubleBezelCard>
        </div>

        {/* Info Column */}
        <div className="flex flex-col gap-6">
          <DoubleBezelCard className="bg-background p-6">
            <h4 className="font-bold text-sm mb-4">Gợi ý cách viết Prompt tốt</h4>
            <ul className="text-xs text-muted-foreground space-y-3">
              <li className="flex gap-2 items-start">
                <svg className="text-foreground size-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Nêu rõ sản phẩm hoặc dịch vụ bạn muốn quảng cáo.</span>
              </li>
              <li className="flex gap-2 items-start">
                <svg className="text-foreground size-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Chỉ ra nhóm đối tượng khách hàng mục tiêu cần hướng tới.</span>
              </li>
              <li className="flex gap-2 items-start">
                <svg className="text-foreground size-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Nêu rõ các ưu đãi đặc biệt nếu có.</span>
              </li>
            </ul>
          </DoubleBezelCard>
        </div>
      </div>

      {/* Result Display Area */}
      {generatedItems.length > 0 && (
        <div className="mt-8 flex flex-col gap-6">
          <h3 className="font-serif text-2xl font-bold">Kết quả nội dung được tạo</h3>
          <div className="flex flex-col gap-6">
            {generatedItems.map((item, idx) => (
              <DoubleBezelCard key={idx} className="bg-background p-6 flex flex-col gap-4 border-foreground/20">
                <div className="flex justify-between items-center border-b pb-3 text-xs">
                  <span className="px-2.5 py-0.5 bg-muted border text-foreground text-[10px] uppercase font-mono rounded-md font-bold">
                    {item.platform}
                  </span>
                  <span className="text-muted-foreground font-mono">Thời gian đề xuất: {item.bestTimeToPost || "Bất kỳ"}</span>
                </div>
                
                {item.hook && (
                  <div className="bg-foreground/[0.02] p-3 rounded-lg border border-dashed border-border">
                    <span className="text-[10px] text-muted-foreground uppercase font-mono block mb-1">Tiêu đề / Hook</span>
                    <p className="font-bold text-sm text-foreground">{item.hook}</p>
                  </div>
                )}
                
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground bg-muted/10 p-4 rounded-xl border border-dashed">
                  {item.body}
                </div>

                {item.cta && (
                  <div className="text-xs text-muted-foreground bg-muted/20 px-3 py-2 rounded-lg font-mono">
                    <span className="text-[9px] uppercase font-bold block text-muted-foreground/60 mb-0.5">Lời kêu gọi hành động (CTA)</span>
                    {item.cta}
                  </div>
                )}

                {item.hashtags && item.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.hashtags.map((tag, tIdx) => (
                      <span key={tIdx} className="text-xs bg-muted border px-2 py-0.5 rounded font-mono text-muted-foreground">
                        {tag.startsWith("#") ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    navigate("/content/image-wizard", {
                      state: { prompt: item.bannerImagePrompt || item.hook || item.body.substring(0, 100) }
                    })
                  }} className="gap-1 text-xs border-dashed">
                    Tạo ảnh AI
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    const fullText = `${item.hook ? item.hook + "\n\n" : ""}${item.body}${item.cta ? "\n\n" + item.cta : ""}${item.hashtags && item.hashtags.length > 0 ? "\n\n" + item.hashtags.map(t => t.startsWith("#") ? t : `#${t}`).join(" ") : ""}`
                    navigator.clipboard.writeText(fullText)
                    toast.success("Đã copy toàn bộ bài viết vào bộ nhớ tạm!")
                  }}>
                    Sao chép bài viết
                  </Button>
                </div>
              </DoubleBezelCard>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
