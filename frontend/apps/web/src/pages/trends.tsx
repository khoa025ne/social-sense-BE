import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { HotLevelBar } from "@workspace/ui/components/hot-level-bar"
import { trendsApi, type TrendItem, type TrendTag } from "@/api/trends"
import { toast } from "sonner"
import { Input } from "@workspace/ui/components/input"
import { useNavigate } from "react-router-dom"
import { 
  Flame, 
  Search, 
  Sparkles, 
  ExternalLink, 
  RefreshCw, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Tag
} from "lucide-react"

export default function TrendsPage() {
  const navigate = useNavigate()
  
  const [trends, setTrends] = useState<TrendItem[]>([])
  const [tags, setTags] = useState<TrendTag[]>([])
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
  const [searchValue, setSearchValue] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(9)
  const [totalItems, setTotalItems] = useState(0)
  const [loadingTrends, setLoadingTrends] = useState(true)
  const [loadingTags, setLoadingTags] = useState(true)

  // Fetch tags
  const fetchTags = useCallback(async () => {
    try {
      setLoadingTags(true)
      const res = await trendsApi.getTags()
      setTags(res)
    } catch (err: any) {
      console.error("Failed to fetch trend tags", err)
    } finally {
      setLoadingTags(false)
    }
  }, [])

  // Fetch trends list
  const fetchTrends = useCallback(async () => {
    try {
      setLoadingTrends(true)
      const res = await trendsApi.getAll({
        page: currentPage,
        pageSize: pageSize,
        tagId: selectedTagId || undefined,
        search: searchValue || undefined
      })
      setTrends(res.items)
      setTotalItems(res.total)
    } catch (err: any) {
      console.error("Failed to fetch trends", err)
      toast.error(err.message || "Không thể tải danh sách xu hướng!")
    } finally {
      setLoadingTrends(false)
    }
  }, [currentPage, pageSize, selectedTagId, searchValue])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  useEffect(() => {
    fetchTrends()
  }, [fetchTrends])

  // Handle Search Input Change with debounce/simple submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchTrends()
  }

  // Handle Select Tag
  const handleSelectTag = (tagId: number | null) => {
    setSelectedTagId(tagId)
    setCurrentPage(1)
  }

  // Handle Create Post from Trend
  const handleCreatePost = (trendId: number) => {
    navigate("/content/generate", { state: { trendId } })
  }

  const totalPages = Math.ceil(totalItems / pageSize)

  return (
    <div className="p-6 flex flex-col gap-8 max-w-6xl mx-auto">
      <PageHeader 
        title="Hot Trends" 
        description="Khám phá các xu hướng đang nóng hổi trên mạng xã hội và sử dụng AI để bắt trend tạo nội dung tức thì." 
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Tag list */}
        <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
          <button
            onClick={() => handleSelectTag(null)}
            className={`px-3 py-1.5 rounded font-mono text-xs uppercase tracking-wider border transition-all ${
              selectedTagId === null
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-transparent text-muted-foreground border-border hover:bg-muted/20"
            }`}
          >
            Tất cả
          </button>
          {loadingTags ? (
            <span className="font-mono text-xs text-muted-foreground animate-pulse">Đang tải tag...</span>
          ) : (
            tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleSelectTag(tag.id)}
                className={`px-3 py-1.5 rounded font-mono text-xs uppercase tracking-wider border transition-all inline-flex items-center gap-1 ${
                  selectedTagId === tag.id
                    ? "bg-foreground text-background border-foreground font-bold"
                    : "bg-transparent text-muted-foreground border-border hover:bg-muted/20"
                }`}
              >
                <Tag className="size-3" /> {tag.name}
              </button>
            ))
          )}
        </div>

        {/* Search Input Form */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Tìm kiếm xu hướng..."
            className="pr-10"
          />
          <button 
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Search className="size-4" />
          </button>
        </form>
      </div>

      {/* Trends Grid */}
      {loadingTrends ? (
        <div className="py-20 flex flex-col items-center justify-center font-mono text-xs text-muted-foreground gap-3">
          <RefreshCw className="size-6 animate-spin text-muted-foreground" />
          <span>Đang tìm kiếm xu hướng thị trường...</span>
        </div>
      ) : trends.length === 0 ? (
        <DoubleBezelCard className="bg-background flex flex-col items-center justify-center py-16 text-center border-dashed">
          <TrendingUp className="size-10 text-muted-foreground/30 mb-4" />
          <h4 className="font-serif text-lg mb-1">Không tìm thấy xu hướng</h4>
          <p className="text-xs text-muted-foreground max-w-sm">
            Hiện không có xu hướng nào khớp với từ khóa tìm kiếm của bạn. Hãy thử từ khóa khác.
          </p>
        </DoubleBezelCard>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trends.map((trend) => (
              <DoubleBezelCard key={trend.id} className="bg-background flex flex-col justify-between h-full">
                <div className="flex flex-col gap-4">
                  {/* Title & HotLevel */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-3">
                      <h4 className="font-serif text-base font-semibold leading-tight line-clamp-2">
                        {trend.title}
                      </h4>
                      <span className="shrink-0 inline-flex items-center gap-0.5 text-rose-500" title="Hot Trend">
                        <Flame className="size-4 fill-current" />
                      </span>
                    </div>
                    
                    {/* HotLevelBar */}
                    <div className="mt-1">
                      <HotLevelBar level={trend.hotLevel} />
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed font-serif">
                    {trend.summary}
                  </p>

                  {/* Tags */}
                  {trend.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {trend.tags.map((t) => (
                        <span 
                          key={t.id} 
                          className="px-2 py-0.5 rounded bg-muted/50 border border-border text-[9px] font-mono text-muted-foreground uppercase"
                        >
                          #{t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 pt-4 mt-4 border-t border-dashed border-border/60">
                  <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <Calendar className="size-3" />
                    {new Date(trend.createdAt).toLocaleDateString("vi-VN")}
                  </span>

                  <div className="flex gap-2">
                    {trend.sourceUrl && (
                      <a 
                        href={trend.sourceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="h-8 px-2.5 rounded border border-border bg-transparent text-foreground hover:bg-muted/20 font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1 transition-all active:scale-95"
                      >
                        Nguồn <ExternalLink className="size-3" />
                      </a>
                    )}
                    <button
                      onClick={() => handleCreatePost(trend.id)}
                      className="h-8 px-3 rounded bg-foreground text-background hover:bg-foreground/90 font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1 transition-all active:scale-95"
                    >
                      Bắt trend <Sparkles className="size-3" />
                    </button>
                  </div>
                </div>
              </DoubleBezelCard>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-dashed border-border">
              <span className="font-mono text-xs text-muted-foreground">
                Trang {currentPage} / {totalPages} (Tổng {totalItems} xu hướng)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="size-8 rounded border border-border flex items-center justify-center hover:bg-muted/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="size-8 rounded border border-border flex items-center justify-center hover:bg-muted/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
