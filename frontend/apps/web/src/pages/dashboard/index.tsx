import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { NumberCounter, CircularCounter } from "@workspace/ui/components/number-counter"
import { PageHeader } from "@workspace/ui/components/page-header"
import { SegmentedButton } from "@workspace/ui/components/segmented-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { useAuthStore } from "@/stores/auth-store"
import { authApi } from "@/api/auth"
import { contentApi, type ContentHistoryResponse } from "@/api/content"
import { trendsApi } from "@/api/trends"
import { analyticsApi } from "@/api/analytics"
import { Loader2, Plus, ArrowUpRight, MessageSquareCode } from "lucide-react"

export default function DashboardPage() {
  const { user, quota, setQuota } = useAuthStore()
  const [activeTab, setActiveTab] = useState("all")
  const [history, setHistory] = useState<ContentHistoryResponse | null>(null)
  const [tagsCount, setTagsCount] = useState(12) // Default fallback
  const [reachVal, setReachVal] = useState(45200) // Default fallback
  const [reachChange, setReachChange] = useState("+12% ↗") // Default fallback
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        const [quotaRes, historyRes, tagsRes, analyticsRes] = await Promise.allSettled([
          authApi.getQuota(),
          contentApi.getHistory(1, 5),
          trendsApi.getTags(),
          analyticsApi.getHistory(1, 1)
        ])

        if (quotaRes.status === "fulfilled") {
          setQuota(quotaRes.value)
        }
        if (historyRes.status === "fulfilled") {
          setHistory(historyRes.value)
        }
        if (tagsRes.status === "fulfilled") {
          setTagsCount(tagsRes.value.length)
        }
        if (analyticsRes.status === "fulfilled" && analyticsRes.value.data.length > 0) {
          const latestId = analyticsRes.value.data[0].id
          try {
            const detail = await analyticsApi.getReport(latestId)
            const reachMetric = detail.result.metrics.find((m: any) => m.metricKey.toLowerCase() === "reach")
            if (reachMetric && reachMetric.valueAFormatted) {
              const cleanedReach = parseInt(reachMetric.valueAFormatted.replace(/,/g, ""))
              if (!isNaN(cleanedReach)) {
                setReachVal(cleanedReach)
              }
              if (reachMetric.changePercent !== null) {
                setReachChange(`${reachMetric.changePercent >= 0 ? "+" : ""}${reachMetric.changePercent}% ${reachMetric.changePercent >= 0 ? "↗" : "↘"}`)
              }
            }
          } catch (e) {
            console.error("Failed to fetch latest report details", e)
          }
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data", error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const tabOptions = [
    { label: "Tất cả bài viết", value: "all" },
    { label: "Facebook", value: "facebook" },
    { label: "LinkedIn", value: "linkedin" }
  ]

  // Phẳng hóa danh sách bài viết từ lịch sử của BE để phân theo từng platform
  const allPosts = history?.items?.flatMap(item => {
    const contentList = item.userEditedContent || item.generatedContent;
    return contentList.map((c, index) => ({
      id: `${item.id}-${index}`,
      historyId: item.id,
      platform: c.platform,
      createdAt: item.createdAt,
      body: c.body,
      hook: c.hook,
      hashtags: c.hashtags
    }));
  }) || [];

  const filteredPosts = allPosts.filter(post => {
    if (activeTab === "all") return true;
    return post.platform.toLowerCase() === activeTab.toLowerCase();
  });

  const remainingQuota = quota ? quota.remainingQuota : 3
  const dailyQuotaLimit = quota ? quota.dailyQuotaLimit : 5
  const usedToday = quota ? quota.usedToday : 2
  const usagePercent = quota ? quota.usagePercent : 40.0
  const isUnlimited = quota ? quota.isUnlimited : false

  return (
    <div className="p-6 flex flex-col gap-8 max-w-6xl mx-auto">
      <PageHeader
        title={`Chào buổi sáng, ${user?.displayName || user?.email?.split("@")[0] || "Creator"}`}
        description="Theo dõi hiệu suất nội dung mạng xã hội và bắt đầu tạo các bài viết mới."
        action={
          <Link to="/content/generate">
            <Button className="gap-2 cursor-pointer">
              <Plus className="size-4" />
              Tạo nội dung mới
            </Button>
          </Link>
        }
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="animate-spin size-8 text-primary" />
          <span className="text-muted-foreground text-sm font-mono">Đang kết nối hệ thống dữ liệu...</span>
        </div>
      ) : (
        <>
          {/* Stats Counter Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
            <DoubleBezelCard className="bg-background">
              <span className="text-muted-foreground text-xs font-mono uppercase tracking-wider block">Bài viết đã tạo</span>
              <div className="mt-4 flex items-baseline gap-2">
                <NumberCounter value={history?.totalCount || 0} className="text-4xl font-serif font-bold tracking-tight" />
                <span className="text-muted-foreground text-xs">bài</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Lịch sử biên tập và sinh nội dung</p>
            </DoubleBezelCard>

            <DoubleBezelCard className="bg-background">
              <span className="text-muted-foreground text-xs font-mono uppercase tracking-wider block">Reach gần nhất</span>
              <div className="mt-4 flex items-baseline gap-2">
                <NumberCounter value={reachVal} separator="." className="text-4xl font-serif font-bold tracking-tight" />
                <span className={`text-xs font-semibold ${reachChange.includes("↗") ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600"}`}>
                  {reachChange}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Lượt tiếp cận của chu kỳ phân tích</p>
            </DoubleBezelCard>

            <DoubleBezelCard className="bg-background">
              <span className="text-muted-foreground text-xs font-mono uppercase tracking-wider block">Xu hướng đồng bộ</span>
              <div className="mt-4 flex items-baseline gap-2">
                <NumberCounter value={tagsCount} className="text-4xl font-serif font-bold tracking-tight" />
                <span className="text-muted-foreground text-xs">chủ đề</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Chủ đề thịnh hành đang được theo dõi</p>
            </DoubleBezelCard>

            <DoubleBezelCard className="bg-background flex flex-row items-center justify-between p-6">
              <div>
                <span className="text-muted-foreground text-xs font-mono uppercase tracking-wider block">Hạn ngạch hôm nay</span>
                <div className="mt-2 flex items-baseline gap-1">
                  {isUnlimited ? (
                    <span className="text-3xl font-serif font-bold">Vô hạn</span>
                  ) : (
                    <>
                      <span className="text-3xl font-serif font-bold">{remainingQuota}</span>
                      <span className="text-muted-foreground text-xs">/ {dailyQuotaLimit} lượt</span>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Reset lúc 00:00 hàng ngày</p>
              </div>
              <div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help transition-opacity hover:opacity-85">
                        <CircularCounter value={isUnlimited ? 100 : usagePercent} size={64} strokeWidth={6} className="text-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="p-3 max-w-[220px] bg-card text-card-foreground border rounded-xl shadow-lg">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="font-bold">Hạn ngạch tạo nội dung</span>
                        {isUnlimited ? (
                          <span className="text-muted-foreground">Bạn đang sử dụng gói không giới hạn.</span>
                        ) : (
                          <span className="text-muted-foreground">Bạn đã dùng {usedToday} lượt hôm nay. Còn lại {remainingQuota} lượt tạo nội dung chất lượng cao.</span>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </DoubleBezelCard>
          </div>

          {/* Content & History Layout Split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fade-in stagger-item" style={{ "--index": 1 } as any}>
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <h3 className="font-serif text-xl">Nội dung tạo gần đây</h3>
                <SegmentedButton
                  options={tabOptions}
                  selectedValue={activeTab}
                  onChange={setActiveTab}
                />
              </div>

              {filteredPosts.length === 0 ? (
                <DoubleBezelCard className="bg-background/40 py-12 flex flex-col items-center justify-center text-center gap-3 border-dashed">
                  <MessageSquareCode className="size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Chưa có bài viết nào được tạo cho kênh này.</p>
                  <Link to="/content/generate">
                    <Button variant="outline" size="sm" className="mt-2">Bắt đầu tạo ngay</Button>
                  </Link>
                </DoubleBezelCard>
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredPosts.map((post) => (
                    <DoubleBezelCard key={post.id} className="bg-background p-6 flex flex-col gap-4">
                      <div className="border-b pb-3 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 bg-muted border text-foreground text-[10px] uppercase font-mono rounded">
                            {post.platform}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {new Date(post.createdAt).toLocaleDateString("vi-VN")} lúc {new Date(post.createdAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <Link to="/content/history" className="text-xs text-foreground hover:underline font-semibold flex items-center gap-0.5">
                          Chi tiết
                          <ArrowUpRight className="size-3" />
                        </Link>
                      </div>
                      
                      {post.hook && <h4 className="font-bold text-sm text-foreground">{post.hook}</h4>}
                      <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {post.body}
                      </p>
                      {post.hashtags && post.hashtags.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-1">
                          {post.hashtags.map((tag, idx) => (
                            <span key={idx} className="text-xs bg-muted border px-2 py-0.5 rounded font-mono text-muted-foreground">
                              {tag.startsWith("#") ? tag : `#${tag}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </DoubleBezelCard>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Shortcuts */}
            <div className="flex flex-col gap-4">
              <h3 className="font-serif text-xl">Lối tắt thao tác nhanh</h3>
              <div className="grid grid-cols-1 gap-4">
                <Link to="/content/generate">
                  <DoubleBezelCard className="bg-background hover:scale-[1.02] transition-transform cursor-pointer">
                    <div className="flex gap-4 items-center">
                      <div className="p-3 border rounded-xl bg-muted/40">
                        <svg className="size-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Tạo Bài Viết AI</h4>
                        <p className="text-xs text-muted-foreground">Tự động viết nội dung chuẩn SEO đa nền tảng</p>
                      </div>
                    </div>
                  </DoubleBezelCard>
                </Link>

                <Link to="/content/image-wizard">
                  <DoubleBezelCard className="bg-background hover:scale-[1.02] transition-transform cursor-pointer">
                    <div className="flex gap-4 items-center">
                      <div className="p-3 border rounded-xl bg-muted/40">
                        <svg className="size-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Image Wizard</h4>
                        <p className="text-xs text-muted-foreground">Tạo ảnh minh họa bằng AI từ bài viết</p>
                      </div>
                    </div>
                  </DoubleBezelCard>
                </Link>

                <Link to="/content/check-alignment">
                  <DoubleBezelCard className="bg-background hover:scale-[1.02] transition-transform cursor-pointer">
                    <div className="flex gap-4 items-center">
                      <div className="p-3 border rounded-xl bg-muted/40">
                        <svg className="size-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Brand Alignment</h4>
                        <p className="text-xs text-muted-foreground">Đánh giá độ phù hợp thương hiệu</p>
                      </div>
                    </div>
                  </DoubleBezelCard>
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
