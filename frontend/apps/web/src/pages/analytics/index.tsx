import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { analyticsApi, type AnalyticsHistoryItem } from "@/api/analytics"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { 
  BarChart2, 
  Plus, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Eye,
  TrendingUp,
  TrendingDown
} from "lucide-react"

export default function AnalyticsIndexPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<AnalyticsHistoryItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      const res = await analyticsApi.getHistory(currentPage, pageSize)
      setHistory(res.data)
      // Thường backend trả về dữ liệu phân trang, nếu thiếu totalPages thì ta tính toán hoặc mặc định là 1.
      // Dựa vào kiểu AnalyticsHistoryResponse: { page, pageSize, data }
      // Ta tạm thời check và set total pages. Giả sử có tổng số bản ghi là 100 hoặc res chứa tổng số.
      // Vì API trả về data là mảng, nếu số lượng phần tử < pageSize thì trang hiện tại chính là trang cuối.
      if (res.data.length < pageSize && currentPage === 1) {
        setTotalPages(1)
      } else {
        // Tạm tính toán trang
        setTotalPages(res.data.length === 0 ? currentPage : currentPage + 1)
      }
    } catch (err: any) {
      console.error("Failed to fetch analytics history", err)
      toast.error(err.message || "Không thể tải lịch sử phân tích số liệu!")
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Trực quan hóa xu hướng chung
  const renderTrendIcon = (trend: string) => {
    const t = trend.toLowerCase()
    if (t.includes("tăng") || t.includes("up") || t.includes("positive") || t.includes("tốt")) {
      return <span className="inline-flex items-center gap-1 text-xs text-foreground bg-muted px-2 py-0.5 rounded font-mono font-bold"><TrendingUp className="size-3" /> {trend}</span>
    }
    if (t.includes("giảm") || t.includes("down") || t.includes("negative") || t.includes("xấu")) {
      return <span className="inline-flex items-center gap-1 text-xs text-rose-500 bg-rose-50 px-2 py-0.5 rounded font-mono font-bold"><TrendingDown className="size-3" /> {trend}</span>
    }
    return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/20 px-2 py-0.5 rounded font-mono">{trend}</span>
  }

  return (
    <div className="p-6 flex flex-col gap-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader 
          title="Phân tích Số liệu" 
          description="Đánh giá hiệu suất các kênh truyền thông xã hội dựa trên dữ liệu thật và đề xuất tối ưu từ AI." 
        />
        <button 
          onClick={() => navigate("/analytics/upload")}
          className="h-10 px-4 rounded bg-foreground text-background font-mono text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:bg-foreground/90 transition-all active:scale-95 shrink-0"
        >
          <Plus className="size-4" /> Báo cáo mới
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center font-mono text-xs text-muted-foreground gap-3">
          <RefreshCw className="size-6 animate-spin text-muted-foreground" />
          <span>Đang tải danh sách báo cáo...</span>
        </div>
      ) : history.length === 0 ? (
        <DoubleBezelCard className="bg-background flex flex-col items-center justify-center py-16 text-center border-dashed">
          <BarChart2 className="size-10 text-muted-foreground/30 mb-4" />
          <h4 className="font-serif text-lg mb-1">Chưa có báo cáo phân tích</h4>
          <p className="text-xs text-muted-foreground max-w-sm mb-6">
            Tải lên tệp số liệu Excel của bạn để AI tiến hành phân tích hiệu suất và đề xuất tối ưu hóa.
          </p>
          <button 
            onClick={() => navigate("/analytics/upload")}
            className="px-4 py-2 border border-border rounded bg-foreground text-background font-mono text-xs uppercase tracking-wider hover:bg-foreground/90 transition-all active:scale-95"
          >
            Tải lên số liệu ngay
          </button>
        </DoubleBezelCard>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {history.map((item) => (
              <DoubleBezelCard key={item.id} className="bg-background flex flex-col justify-between h-full">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="font-serif text-lg font-semibold">{item.platform}</span>
                      <span className="text-[10px] text-muted-foreground font-mono uppercase mt-0.5">
                        Loại: {item.reportType === "compare" ? "So sánh đối chiếu" : "Báo cáo đơn kỳ"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-muted-foreground font-mono uppercase">Điểm tổng quan</span>
                      <span className="font-mono text-lg font-bold">{item.overallScore}/100</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 py-3 border-y border-dashed border-border/60">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground font-serif">Chu kỳ A:</span>
                      <span className="font-mono text-foreground">{item.periodALabel}</span>
                    </div>
                    {item.periodBLabel && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground font-serif">Chu kỳ B:</span>
                        <span className="font-mono text-foreground">{item.periodBLabel}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                    {renderTrendIcon(item.overallTrend)}
                  </div>
                </div>

                <div className="flex justify-end mt-4 pt-3 border-t border-dashed border-border/40">
                  <button
                    onClick={() => navigate(`/analytics/report/${item.id}`)}
                    className="h-8 px-3 rounded border border-border bg-transparent text-foreground hover:bg-muted/20 font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1 transition-all active:scale-95"
                  >
                    Xem chi tiết <Eye className="size-3" />
                  </button>
                </div>
              </DoubleBezelCard>
            ))}
          </div>

          {/* Simple pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-dashed border-border">
            <span className="font-mono text-xs text-muted-foreground">
              Trang {currentPage}
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
                onClick={() => {
                  // Đơn giản cho việc phân trang khi không có tổng số lượng cụ thể
                  if (history.length === pageSize) {
                    setCurrentPage(p => p + 1)
                  }
                }}
                disabled={history.length < pageSize}
                className="size-8 rounded border border-border flex items-center justify-center hover:bg-muted/20 disabled:opacity-50 transition-all active:scale-95"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
