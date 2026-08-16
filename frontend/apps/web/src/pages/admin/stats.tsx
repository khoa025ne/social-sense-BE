import { useState } from "react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { adminApi, type StatsCompareResponse } from "@/api/admin"
import { toast } from "sonner"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  CartesianGrid
} from "recharts"
import { 
  BarChart, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  FileText, 
  Database, 
  Compass, 
  ArrowRight,
  RefreshCw
} from "lucide-react"

export default function AdminStatsPage() {
  const [period, setPeriod] = useState("day")
  const [periodA, setPeriodA] = useState("")
  const [periodB, setPeriodB] = useState("")
  const [loading, setLoading] = useState(false)
  const [compareData, setCompareData] = useState<StatsCompareResponse | null>(null)

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!periodA || !periodB) {
      toast.error("Vui lòng chọn cả hai chu kỳ thời gian!")
      return
    }

    try {
      setLoading(true)
      const res = await adminApi.compareStats({
        period,
        periodA,
        periodB
      })
      setCompareData(res)
      toast.success("Đã đối chiếu số liệu hệ thống thành công!")
    } catch (err: any) {
      console.error("Failed to compare stats", err)
      toast.error(err.message || "Không thể so sánh số liệu. Kiểm tra lại định dạng!")
    } finally {
      setLoading(false)
    }
  }

  // Helper render chênh lệch phần trăm
  const renderDiff = (diffVal: number, percent: number | null | undefined) => {
    const isPositive = diffVal > 0
    const isZero = diffVal === 0
    const percentFormatted = percent !== null && percent !== undefined ? `${Math.abs(percent)}%` : ""
    
    if (isZero) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">
          Không thay đổi (0%)
        </span>
      )
    }
    
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded ${
        isPositive ? 'text-foreground bg-muted' : 'text-rose-600 bg-rose-50'
      }`}>
        {isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
        {isPositive ? `+` : `-`}{Math.abs(diffVal)} ({percentFormatted})
      </span>
    )
  }

  // Tạo dữ liệu cho biểu đồ cột Recharts
  const getChartData = () => {
    if (!compareData) return []
    return [
      {
        name: "Người dùng mới",
        [compareData.periodA.label]: compareData.periodA.newUsers,
        [compareData.periodB.label]: compareData.periodB.newUsers,
      },
      {
        name: "Bài viết AI",
        [compareData.periodA.label]: compareData.periodA.totalContentGenerated,
        [compareData.periodB.label]: compareData.periodB.totalContentGenerated,
      },
      {
        name: "Tri thức đã nạp",
        [compareData.periodA.label]: compareData.periodA.newKnowledgeItems,
        [compareData.periodB.label]: compareData.periodB.newKnowledgeItems,
      },
      {
        name: "Xu hướng mới",
        [compareData.periodA.label]: compareData.periodA.newTrends,
        [compareData.periodB.label]: compareData.periodB.newTrends,
      }
    ]
  }

  return (
    <div className="p-6 flex flex-col gap-8 max-w-6xl mx-auto">
      <PageHeader 
        title="Thống kê Đối chiếu" 
        description="Phân tích, so sánh hoạt động của hệ thống SocialSence giữa hai mốc chu kỳ thời gian (Ngày, Tháng, Quý, Năm)." 
      />

      <DoubleBezelCard className="bg-background">
        <form onSubmit={handleCompare} className="flex flex-col md:flex-row items-end gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 w-full">
            <div className="grid gap-2">
              <Label htmlFor="period" className="text-xs font-mono uppercase text-muted-foreground">Loại chu kỳ</Label>
              <select
                id="period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-10 px-3 border border-border rounded bg-background font-mono text-xs uppercase focus:outline-none"
              >
                <option value="day">Hàng Ngày (Day)</option>
                <option value="month">Hàng Tháng (Month)</option>
                <option value="quarter">Hàng Quý (Quarter)</option>
                <option value="year">Hàng Năm (Year)</option>
              </select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="periodA" className="text-xs font-mono uppercase text-muted-foreground">Chu kỳ A (Mốc cũ)</Label>
              <Input 
                id="periodA"
                type="date"
                value={periodA}
                onChange={(e) => setPeriodA(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="periodB" className="text-xs font-mono uppercase text-muted-foreground">Chu kỳ B (Mốc mới)</Label>
              <Input 
                id="periodB"
                type="date"
                value={periodB}
                onChange={(e) => setPeriodB(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full md:w-auto h-10 px-6 rounded bg-foreground text-background font-mono text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:bg-foreground/90 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="size-4 animate-spin" /> Đang tính toán...
              </>
            ) : (
              <>
                Đối chiếu <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </form>
      </DoubleBezelCard>

      {compareData ? (
        <div className="flex flex-col gap-8">
          {/* So sánh tổng quan dạng bảng metric */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* New Users */}
            <DoubleBezelCard className="bg-background">
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <Users className="size-4" />
                <span className="text-xs font-mono uppercase">Người dùng mới</span>
              </div>
              <div className="flex items-center justify-between gap-4 font-mono">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{compareData.periodA.label}</span>
                  <span className="text-xl font-bold">{compareData.periodA.newUsers}</span>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
                <div className="flex flex-col items-end">
                  <span className="text-xs text-muted-foreground">{compareData.periodB.label}</span>
                  <span className="text-xl font-bold">{compareData.periodB.newUsers}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-dashed border-border flex justify-end">
                {renderDiff(compareData.diff.newUsersDiff, compareData.diff.newUsersChangePercent)}
              </div>
            </DoubleBezelCard>

            {/* Content Generated */}
            <DoubleBezelCard className="bg-background">
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <FileText className="size-4" />
                <span className="text-xs font-mono uppercase">Bài viết AI</span>
              </div>
              <div className="flex items-center justify-between gap-4 font-mono">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{compareData.periodA.label}</span>
                  <span className="text-xl font-bold">{compareData.periodA.totalContentGenerated}</span>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
                <div className="flex flex-col items-end">
                  <span className="text-xs text-muted-foreground">{compareData.periodB.label}</span>
                  <span className="text-xl font-bold">{compareData.periodB.totalContentGenerated}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-dashed border-border flex justify-end">
                {renderDiff(compareData.diff.contentGeneratedDiff, compareData.diff.contentGeneratedChangePercent)}
              </div>
            </DoubleBezelCard>

            {/* Knowledge Items */}
            <DoubleBezelCard className="bg-background">
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <Database className="size-4" />
                <span className="text-xs font-mono uppercase">Tri thức mới</span>
              </div>
              <div className="flex items-center justify-between gap-4 font-mono">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{compareData.periodA.label}</span>
                  <span className="text-xl font-bold">{compareData.periodA.newKnowledgeItems}</span>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
                <div className="flex flex-col items-end">
                  <span className="text-xs text-muted-foreground">{compareData.periodB.label}</span>
                  <span className="text-xl font-bold">{compareData.periodB.newKnowledgeItems}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-dashed border-border flex justify-end">
                {renderDiff(compareData.diff.newKnowledgeDiff, compareData.diff.newKnowledgeChangePercent)}
              </div>
            </DoubleBezelCard>

            {/* Trends */}
            <DoubleBezelCard className="bg-background">
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <Compass className="size-4" />
                <span className="text-xs font-mono uppercase">Xu hướng</span>
              </div>
              <div className="flex items-center justify-between gap-4 font-mono">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{compareData.periodA.label}</span>
                  <span className="text-xl font-bold">{compareData.periodA.newTrends}</span>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
                <div className="flex flex-col items-end">
                  <span className="text-xs text-muted-foreground">{compareData.periodB.label}</span>
                  <span className="text-xl font-bold">{compareData.periodB.newTrends}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-dashed border-border flex justify-end">
                {renderDiff(compareData.diff.newTrendsDiff, compareData.diff.newTrendsChangePercent)}
              </div>
            </DoubleBezelCard>
          </div>

          {/* Biểu đồ so sánh trực quan */}
          <div className="grid grid-cols-1 gap-6">
            <DoubleBezelCard className="bg-background">
              <h3 className="font-serif text-lg mb-6 flex items-center gap-2">
                <BarChart className="size-4" /> Trực quan hóa so sánh side-by-side
              </h3>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart
                    data={getChartData()}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#71717a', fontSize: 11, fontFamily: 'monospace' }}
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
                        fontSize: '11px',
                        paddingTop: '15px'
                      }} 
                    />
                    <Bar 
                      name={compareData.periodA.label} 
                      dataKey={compareData.periodA.label} 
                      fill="#71717a" 
                      radius={[0, 0, 0, 0]} 
                    />
                    <Bar 
                      name={compareData.periodB.label} 
                      dataKey={compareData.periodB.label} 
                      fill="#000000" 
                      radius={[0, 0, 0, 0]} 
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </DoubleBezelCard>
          </div>
        </div>
      ) : (
        <DoubleBezelCard className="bg-background flex flex-col items-center justify-center py-16 text-center border-dashed">
          <BarChart className="size-10 text-muted-foreground/30 mb-4" />
          <h4 className="font-serif text-lg mb-1">Chưa có dữ liệu so sánh</h4>
          <p className="text-xs text-muted-foreground max-w-sm">
            Chọn các chu kỳ thời gian ở phía trên và nhấn nút <strong>Đối chiếu</strong> để tiến hành phân tích số liệu hệ thống.
          </p>
        </DoubleBezelCard>
      )}
    </div>
  )
}
