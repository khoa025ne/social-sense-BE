import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { analyticsApi, type AnalyticsReportResponse, type AnalyticsMetricItem } from "@/api/analytics"
import { toast } from "sonner"
import { useParams, useNavigate } from "react-router-dom"
import { 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from "recharts"
import { 
  ArrowLeft, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Lightbulb, 
  Compass, 
  BookOpen, 
  BarChart3,
  Calendar,
  Sparkles
} from "lucide-react"

export default function AnalyticsReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [reportData, setReportData] = useState<AnalyticsReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState<AnalyticsMetricItem | null>(null)

  const fetchReport = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const res = await analyticsApi.getReport(Number(id))
      setReportData(res)
      // Chọn metric đầu tiên làm mặc định để hiển thị giải thích chi tiết
      if (res.result?.metrics?.length > 0) {
        setSelectedMetric(res.result.metrics[0])
      }
    } catch (err: any) {
      console.error("Failed to fetch analytics report", err)
      toast.error(err.message || "Không thể tải báo cáo phân tích!")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[400px] font-mono text-xs text-muted-foreground gap-3">
        <RefreshCw className="size-6 animate-spin text-muted-foreground" />
        <span>AI đang tải báo cáo phân tích...</span>
      </div>
    )
  }

  if (!reportData || !reportData.result) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[400px] text-center gap-4">
        <AlertTriangle className="size-10 text-rose-500" />
        <h4 className="font-serif text-lg">Không tìm thấy báo cáo</h4>
        <p className="text-xs text-muted-foreground max-w-sm">
          Báo cáo này không tồn tại hoặc bạn không có quyền xem.
        </p>
        <button 
          onClick={() => navigate("/analytics")}
          className="px-4 py-2 border border-border rounded bg-foreground text-background font-mono text-xs uppercase"
        >
          Quay lại danh sách
        </button>
      </div>
    )
  }

  const { result } = reportData
  const { summary, metrics, aiNarrative } = result

  // Render xu hướng chung
  const renderTrendBadge = (trend: string) => {
    const t = trend.toLowerCase()
    const isGrowing = t.includes("growing") || t.includes("tăng") || t.includes("positive")
    const isDeclining = t.includes("declining") || t.includes("giảm") || t.includes("negative")

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase border ${
        isGrowing 
          ? "bg-muted text-foreground border-foreground" 
          : isDeclining 
          ? "bg-rose-50 text-rose-600 border-rose-200" 
          : "bg-transparent text-muted-foreground border-border border-dashed"
      }`}>
        {isGrowing ? (
          <TrendingUp className="size-3.5" />
        ) : isDeclining ? (
          <TrendingDown className="size-3.5" />
        ) : (
          <Compass className="size-3.5" />
        )}
        Xu hướng: {trend === "growing" ? "Tăng trưởng" : trend === "declining" ? "Suy giảm" : trend === "stable" ? "Ổn định" : trend}
      </span>
    )
  }

  // Render badge chênh lệch của từng metric với màu xanh (tích cực) và đỏ (tiêu cực) kèm mũi tên
  const renderMetricDiff = (item: AnalyticsMetricItem) => {
    if (item.changePercent === null || item.changePercent === undefined) {
      return <span className="text-muted-foreground font-mono text-xs">---</span>
    }
    
    const isPositive = item.changePercent > 0
    const isZero = item.changePercent === 0
    
    if (isZero) {
      return <span className="text-muted-foreground font-mono text-xs">0%</span>
    }

    const isGood = (isPositive && item.higherIsBetter) || (!isPositive && !item.higherIsBetter)

    return (
      <span className={`font-mono text-xs font-bold flex items-center gap-0.5 ${
        isGood ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500"
      }`}>
        {isGood ? "▲" : "▼"} {isPositive ? "+" : ""}{item.changePercent}%
      </span>
    )
  }

  // Chuẩn hóa dữ liệu vẽ biểu đồ Recharts (Lọc ra các metric dạng số để so sánh trực quan)
  const chartMetrics = metrics
    .filter(m => m.changePercent !== null && m.valueAFormatted && m.valueBFormatted)
    // Lấy các metrics phổ biến để biểu đồ không bị rối
    .filter(m => ["reach", "impressions", "engagement", "likes", "comments", "shares", "clicks", "followers"].some(k => m.metricKey.toLowerCase().includes(k)))
    .slice(0, 5)

  const chartData = chartMetrics.map(m => {
    // Parse value từ format string (bỏ dấu phẩy, dấu chấm nếu có)
    const valA = parseFloat(m.valueAFormatted.replace(/,/g, "").replace(/[^0-9.]/g, "")) || 0
    const valB = m.valueBFormatted ? parseFloat(m.valueBFormatted.replace(/,/g, "").replace(/[^0-9.]/g, "")) || 0 : 0
    return {
      name: m.metricName,
      [reportData.periodALabel]: valA,
      [reportData.periodBLabel || "Kỳ B"]: valB
    }
  })

  return (
    <div className="p-6 flex flex-col gap-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate("/analytics")}
          className="size-8 rounded border border-border flex items-center justify-center hover:bg-muted/20 transition-all active:scale-95 shrink-0"
          title="Quay lại danh sách"
        >
          <ArrowLeft className="size-4" />
        </button>
        <PageHeader 
          title={`Báo cáo ${reportData.platform}`} 
          description={`Phân tích đối chiếu: ${reportData.periodALabel} so với ${reportData.periodBLabel || "Không có"}`} 
        />
      </div>

      {/* Overview Score & Trend & Recommendation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DoubleBezelCard className="bg-background flex flex-col justify-between md:col-span-1">
          <div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">Điểm sức khỏe kênh</span>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-5xl font-serif font-bold">{summary.overallScore}</span>
              <span className="text-muted-foreground text-sm">/ 100</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-dashed border-border/80">
            {renderTrendBadge(summary.overallTrend)}
          </div>
        </DoubleBezelCard>

        <DoubleBezelCard className="bg-background md:col-span-2 flex flex-col justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <Lightbulb className="size-3.5" /> Khuyến nghị hàng đầu
            </span>
            <p className="text-sm font-serif leading-relaxed text-foreground mt-2 font-semibold">
              {summary.topRecommendation}
            </p>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-4 flex items-center gap-1">
            <Calendar className="size-3" />
            <span>Ngày lập báo cáo: {new Date(reportData.createdAt).toLocaleDateString("vi-VN")}</span>
          </div>
        </DoubleBezelCard>
      </div>

      {/* Highlights and Warnings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DoubleBezelCard className="bg-background border-border">
          <h4 className="font-serif text-sm font-semibold flex items-center gap-1.5 mb-4 text-foreground">
            <CheckCircle className="size-4" /> Điểm sáng / Tăng trưởng
          </h4>
          <ul className="flex flex-col gap-2.5">
            {summary.highlights?.length > 0 ? (
              summary.highlights.map((h, i) => (
                <li key={i} className="text-xs font-serif leading-relaxed text-muted-foreground list-disc ml-4">
                  {h}
                </li>
              ))
            ) : (
              <li className="text-xs font-mono text-muted-foreground italic">Không có điểm sáng nổi bật.</li>
            )}
          </ul>
        </DoubleBezelCard>

        <DoubleBezelCard className="bg-background border-border">
          <h4 className="font-serif text-sm font-semibold flex items-center gap-1.5 mb-4 text-rose-500">
            <AlertTriangle className="size-4" /> Cảnh báo / Hạn chế
          </h4>
          <ul className="flex flex-col gap-2.5">
            {summary.warnings?.length > 0 ? (
              summary.warnings.map((w, i) => (
                <li key={i} className="text-xs font-serif leading-relaxed text-rose-500/80 list-disc ml-4">
                  {w}
                </li>
              ))
            ) : (
              <li className="text-xs font-mono text-muted-foreground italic">Không phát hiện cảnh báo nghiêm trọng.</li>
            )}
          </ul>
        </DoubleBezelCard>
      </div>

      {/* AI Narrative Section */}
      {aiNarrative && (
        <DoubleBezelCard className="bg-background">
          <h4 className="font-serif text-sm font-semibold flex items-center gap-1.5 mb-4">
            <BookOpen className="size-4" /> Nhận định chuyên sâu của AI
          </h4>
          <p className="text-xs font-serif leading-relaxed text-foreground whitespace-pre-wrap pl-4 border-l-2 border-foreground/30 py-1">
            {aiNarrative}
          </p>
        </DoubleBezelCard>
      )}

      {/* Visual 2-column comparison cards */}
      {metrics?.length > 0 && (() => {
        const parseVal = (str: string | null) => {
          if (!str) return 0;
          return parseFloat(str.replace(/,/g, "").replace(/[^0-9.]/g, "")) || 0
        };
        const importantMetrics = metrics.filter(m => 
          ["reach", "impressions", "engagement", "likes", "clicks", "followers"].some(k => m.metricKey.toLowerCase().includes(k))
        ).slice(0, 4);

        if (importantMetrics.length === 0) return null;

        return (
          <div className="flex flex-col gap-4">
            <h4 className="font-serif text-sm font-semibold flex items-center gap-1.5">
              <BarChart3 className="size-4" /> Đối chiếu hiệu suất 2 kỳ trực quan
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {importantMetrics.map((item) => {
                const valA = parseVal(item.valueAFormatted)
                const valB = parseVal(item.valueBFormatted)
                const maxVal = Math.max(valA, valB, 1)
                const heightA = `${(valA / maxVal) * 100}%`
                const heightB = `${(valB / maxVal) * 100}%`

                return (
                  <DoubleBezelCard key={item.metricKey} className="bg-background flex justify-between items-center p-5">
                    <div className="flex flex-col justify-between h-full gap-3 flex-1 min-w-0 pr-2">
                      <div>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase truncate block">{item.metricName}</span>
                        <div className="mt-1">
                          {renderMetricDiff(item)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                        <div className="flex justify-between gap-1">
                          <span className="truncate">Kỳ A ({reportData.periodALabel}):</span>
                          <span className="font-mono font-medium text-foreground shrink-0">{item.valueAFormatted}</span>
                        </div>
                        <div className="flex justify-between gap-1">
                          <span className="truncate">Kỳ B ({reportData.periodBLabel || "Kỳ B"}):</span>
                          <span className="font-mono font-medium text-foreground shrink-0">{item.valueBFormatted || "---"}</span>
                        </div>
                      </div>
                    </div>

                    {/* 2-column bar CSS visual */}
                    <div className="flex items-end gap-2 h-16 w-14 bg-muted/20 p-2 rounded-lg border border-border/40 shrink-0 justify-center">
                      <div className="flex flex-col items-center justify-end h-full">
                        <div 
                          style={{ height: heightA }} 
                          className="w-2.5 bg-zinc-300 dark:bg-zinc-700 rounded-t-sm transition-all duration-500" 
                          title={`${reportData.periodALabel}: ${item.valueAFormatted}`}
                        />
                        <span className="text-[8px] text-muted-foreground font-mono mt-0.5 scale-75">Kỳ A</span>
                      </div>
                      <div className="flex flex-col items-center justify-end h-full">
                        <div 
                          style={{ height: heightB }} 
                          className="w-2.5 bg-zinc-950 dark:bg-zinc-100 rounded-t-sm transition-all duration-500" 
                          title={`${reportData.periodBLabel || "Kỳ B"}: ${item.valueBFormatted || "---"}`}
                        />
                        <span className="text-[8px] text-muted-foreground font-mono mt-0.5 scale-75">Kỳ B</span>
                      </div>
                    </div>
                  </DoubleBezelCard>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Recharts Chart for key metrics */}
      {chartData.length > 0 && (
        <DoubleBezelCard className="bg-background">
          <h4 className="font-serif text-sm font-semibold flex items-center gap-1.5 mb-6">
            <BarChart3 className="size-4" /> Biểu đồ so sánh chỉ số chính
          </h4>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                  stroke="#e4e4e7"
                />
                <YAxis 
                  tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                  stroke="#e4e4e7"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    border: '1px solid #e4e4e7',
                    borderRadius: '0px',
                    fontFamily: 'monospace',
                    fontSize: '11px'
                  }} 
                />
                <Legend 
                  wrapperStyle={{ 
                    fontFamily: 'monospace', 
                    fontSize: '10px',
                    paddingTop: '15px'
                  }} 
                />
                <Bar 
                  name={reportData.periodALabel} 
                  dataKey={reportData.periodALabel} 
                  fill="#71717a" 
                  radius={[0, 0, 0, 0]} 
                />
                <Bar 
                  name={reportData.periodBLabel || "Kỳ B"} 
                  dataKey={reportData.periodBLabel || "Kỳ B"} 
                  fill="#000000" 
                  radius={[0, 0, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DoubleBezelCard>
      )}

      {/* Detailed Metrics Table & Explain */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Table of metrics */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <h4 className="font-serif text-sm font-semibold">Bảng đối chiếu chỉ số</h4>
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full font-mono text-xs text-left">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider">
                  <th className="p-3">Chỉ số</th>
                  <th className="p-3 text-right">{reportData.periodALabel}</th>
                  <th className="p-3 text-right">{reportData.periodBLabel}</th>
                  <th className="p-3 text-right">Biến động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {metrics.map((item) => (
                  <tr 
                    key={item.metricKey}
                    onClick={() => setSelectedMetric(item)}
                    className={`hover:bg-muted/20 cursor-pointer transition-colors ${
                      selectedMetric?.metricKey === item.metricKey ? 'bg-muted/40 font-bold' : ''
                    }`}
                  >
                    <td className="p-3 font-serif font-semibold">{item.metricName}</td>
                    <td className="p-3 text-right text-muted-foreground">{item.valueAFormatted || "---"}</td>
                    <td className="p-3 text-right text-foreground">{item.valueBFormatted || "---"}</td>
                    <td className="p-3 text-right">{renderMetricDiff(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Metric Explanation detail */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h4 className="font-serif text-sm font-semibold">Phân tích chi tiết chỉ số</h4>
          {selectedMetric ? (
            <DoubleBezelCard className="bg-background h-full flex flex-col gap-4 border-foreground/20">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase">Tên chỉ số</span>
                <span className="font-serif text-base font-semibold">{selectedMetric.metricName}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase">Giải thích dễ hiểu</span>
                <p className="text-xs font-serif leading-relaxed text-foreground italic bg-muted/20 p-2.5 rounded border border-border/40">
                  {selectedMetric.simpleExplain}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1">
                  <Sparkles className="size-3 text-foreground" /> Phân tích chuyên sâu từ AI
                </span>
                <p className="text-xs font-serif leading-relaxed text-muted-foreground">
                  {selectedMetric.detail}
                </p>
              </div>
            </DoubleBezelCard>
          ) : (
            <DoubleBezelCard className="bg-background h-full flex items-center justify-center text-center py-10 border-dashed text-xs text-muted-foreground font-mono">
              Bấm vào một hàng trong bảng để xem phân tích chi tiết.
            </DoubleBezelCard>
          )}
        </div>
      </div>
    </div>
  )
}
