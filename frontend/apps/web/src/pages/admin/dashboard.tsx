import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { NumberCounter } from "@workspace/ui/components/number-counter"
import { TierBadge } from "@workspace/ui/components/tier-badge"
import { adminApi, type AdminDashboard } from "@/api/admin"
import { toast } from "sonner"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from "recharts"
import {
  Users,
  FileText,
  Key,
  Calendar,
  CreditCard,
  Crown,
  Zap,
  Sparkles,
  Gift,
  Mail,
  ExternalLink,
  X,
  TrendingUp,
  Image as ImageIcon,
  BookOpen,
  LogIn,
  CheckCircle2,
  Clock,
  Activity
} from "lucide-react"
import { Link } from "react-router-dom"

// Mock Activity Item interface for chart drilldown
interface UserActivityItem {
  id: string
  userId: number
  displayName: string
  email: string
  tier: "Free" | "Pro" | "Ultra" | "Enterprise" | string
  actionType: "LOGIN" | "CREATE_PROMPT" | "IMAGE_GEN" | "UPLOAD_KNOWLEDGE" | "PAYMENT"
  actionLabel: string
  detail: string
  timestamp: string
}

export default function AdminDashboardPage() {
  const [dashboardData, setDashboardData] = useState<AdminDashboard | null>(null)
  const [loadingDashboard, setLoadingDashboard] = useState(true)
  
  // Drilldown Modal States
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedActivities, setSelectedActivities] = useState<UserActivityItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const [grantingBonus, setGrantingBonus] = useState<number | null>(null)

  // Chart 2 Metric Visibility Toggle State
  const [visibleMetrics, setVisibleMetrics] = useState({
    promptCount: true,
    imageCount: true,
    loginCount: true,
    knowledgeCount: true,
    paymentCount: true,
  })

  const toggleMetric = (key: keyof typeof visibleMetrics) => {
    setVisibleMetrics(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Fetch Dashboard Stats
  const fetchDashboardStats = useCallback(async () => {
    try {
      setLoadingDashboard(true)
      const data = await adminApi.getDashboard()
      setDashboardData(data)
    } catch (err: any) {
      console.error("Failed to fetch admin stats", err)
      toast.error(err.message || "Không thể tải số liệu thống kê Admin!")
    } finally {
      setLoadingDashboard(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardStats()
  }, [fetchDashboardStats])

  // Real subscription conversion data based on 7 days from Backend DB
  const subscriptionChartData = dashboardData?.last7DaysContent?.map((item, index) => {
    const dateFormatted = item.date ? new Date(item.date).toLocaleDateString("vi-VN", { day: 'numeric', month: 'short' }) : `Ngày ${index + 1}`
    const proCount = item.proUpgrades || 0
    const ultraCount = item.ultraUpgrades || 0
    const revenue = item.revenue || (proCount * 79000 + ultraCount * 99000)
    const totalUpgrades = proCount + ultraCount
    const conversionRate = item.newUsers > 0 ? Math.round((totalUpgrades / item.newUsers) * 100) : (totalUpgrades > 0 ? 100 : 0)

    return {
      date: item.date,
      dateFormatted,
      proCount,
      ultraCount,
      revenue,
      revenueInK: Math.round(revenue / 1000),
      conversionRate
    }
  }) || []

  // Total metrics calculation based strictly on real DB values
  const totalPro = subscriptionChartData.reduce((acc, curr) => acc + curr.proCount, 0)
  const totalUltra = subscriptionChartData.reduce((acc, curr) => acc + curr.ultraCount, 0)
  const totalRevenue = subscriptionChartData.reduce((acc, curr) => acc + curr.revenue, 0)
  const avgConversionRate = subscriptionChartData.length > 0
    ? Math.round(subscriptionChartData.reduce((acc, curr) => acc + curr.conversionRate, 0) / subscriptionChartData.length)
    : 0

  // Real Activity Timeline Data based on Backend DB metrics
  const activityTimelineData = dashboardData?.last7DaysContent?.map((item, index) => {
    const dateFormatted = item.date ? new Date(item.date).toLocaleDateString("vi-VN", { day: 'numeric', month: 'short' }) : `Ngày ${index + 1}`
    const promptCount = item.contentGenerated || 0
    const imageCount = item.imageGenerated || 0
    const knowledgeCount = item.knowledgeUploaded || 0
    const loginCount = (item.userLogins || 0) + (item.newUsers || 0)
    const paymentCount = item.paymentsCount || (item.proUpgrades || 0) + (item.ultraUpgrades || 0)

    return {
      date: item.date || `2026-08-${10 + index}`,
      dateFormatted,
      promptCount,
      imageCount,
      knowledgeCount,
      loginCount,
      paymentCount,
      totalActions: promptCount + imageCount + knowledgeCount + loginCount + paymentCount
    }
  }) || []

  // Fetch real activity details strictly from DB when chart date node is clicked
  const handleChartClick = async (chartState: any) => {
    if (!chartState || !chartState.activePayload || !chartState.activePayload.length) return

    const payload = chartState.activePayload[0].payload
    const dateLabel = payload.dateFormatted || payload.date || "Mốc thời gian đã chọn"
    const rawDate = payload.date
    
    setSelectedDate(dateLabel)
    setShowModal(true)
    setSelectedActivities([])

    try {
      const res = await adminApi.getActivityDrilldown(rawDate)
      if (res && Array.isArray(res.activities)) {
        setSelectedActivities(res.activities)
      }
    } catch (err) {
      console.warn("Could not load real activities from BE DB", err)
      setSelectedActivities([])
    }
  }

  // Grant Bonus Quota for a user via real Backend API
  const handleGrantBonusQuota = async (userId: number, userName: string) => {
    try {
      setGrantingBonus(userId)
      const res = await adminApi.grantBonusQuota(userId, 5)
      toast.success(res.message || `Đã thưởng thành công +5 lượt dùng cho ${userName}!`)
    } catch (err: any) {
      toast.error(err.message || "Không thể trao bonus Quota.")
    } finally {
      setGrantingBonus(null)
    }
  }

  // Send Support Email
  const handleSendEmail = (email: string, userName: string) => {
    const subject = encodeURIComponent("SocialSence — Hỗ trợ & Thưởng ưu đãi trải nghiệm AI")
    const body = encodeURIComponent(`Xin chào ${userName},\n\nĐội ngũ SocialSence cảm ơn bạn đã tích cực trải nghiệm nền tảng sáng tạo nội dung AI của chúng tôi...\n\nTrân trọng!`)
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank")
    toast.info(`Đã mở giao diện gửi Email tới ${email}`)
  }

  return (
    <div className="p-6 flex flex-col gap-8 max-w-6xl mx-auto">
      <PageHeader 
        title="Admin Realtime Dashboard" 
        description="Tổng quan hệ thống, kiểm soát hạn ngạch, phân tích lưu lượng người dùng thời gian thực và quản lý chuyển đổi PayOS." 
      />

      {/* Top 4 Metrics Cards Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <DoubleBezelCard className="bg-background">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-muted-foreground text-xs font-mono uppercase tracking-wider block">Tổng người dùng</span>
              <div className="mt-3 flex items-baseline gap-2">
                <NumberCounter value={dashboardData?.totalUsers ?? 0} separator="." className="text-3xl font-serif font-bold tracking-tight" />
                <span className="text-muted-foreground text-xs">người</span>
              </div>
            </div>
            <div className="p-2 bg-muted/20 border border-border rounded-lg">
              <Users className="size-5 text-foreground" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-dashed border-border/60">
            {loadingDashboard ? "Đang tải..." : `Đang hoạt động: ${dashboardData?.activeUsers ?? 0}`}
          </p>
        </DoubleBezelCard>

        <DoubleBezelCard className="bg-background">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-muted-foreground text-xs font-mono uppercase tracking-wider block">Bài viết AI đã tạo</span>
              <div className="mt-3 flex items-baseline gap-2">
                <NumberCounter value={dashboardData?.totalContentGenerated ?? 0} separator="." className="text-3xl font-serif font-bold tracking-tight" />
                <span className="text-muted-foreground text-xs">bài viết</span>
              </div>
            </div>
            <div className="p-2 bg-muted/20 border border-border rounded-lg">
              <FileText className="size-5 text-foreground" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-dashed border-border/60">
            {loadingDashboard ? "Đang tải..." : `Tri thức nạp: ${dashboardData?.totalKnowledgeItems ?? 0}`}
          </p>
        </DoubleBezelCard>

        <DoubleBezelCard className="bg-background">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-muted-foreground text-xs font-mono uppercase tracking-wider block">Doanh Thu PayOS</span>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-serif">₫</span>
                <NumberCounter value={totalRevenue} separator="." className="text-3xl font-serif font-bold tracking-tight" />
              </div>
            </div>
            <div className="p-2 bg-muted/20 border border-border rounded-lg">
              <CreditCard className="size-5 text-foreground" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-dashed border-border/60 flex items-center justify-between">
            <span>Tỷ lệ chuyển đổi:</span>
            <span className="font-bold text-foreground font-mono">{avgConversionRate}%</span>
          </p>
        </DoubleBezelCard>

        <DoubleBezelCard className="bg-background">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-muted-foreground text-xs font-mono uppercase tracking-wider block">API Keys Hoạt động</span>
              <div className="mt-3 flex items-baseline gap-2">
                <NumberCounter value={dashboardData?.activeApiKeys ?? 0} className="text-3xl font-serif font-bold tracking-tight" />
                <span className="text-muted-foreground text-xs">keys</span>
              </div>
            </div>
            <div className="p-2 bg-muted/20 border border-border rounded-lg">
              <Key className="size-5 text-foreground" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-dashed border-border/60">
            {loadingDashboard ? "Đang tải..." : `Cooldown: ${dashboardData?.coolingDownApiKeys ?? 0} keys`}
          </p>
        </DoubleBezelCard>
      </div>

      {/* CHART 1: Biểu đồ Chuyển Đổi Gói Cước (Subscription Metrics Chart) */}
      <DoubleBezelCard className="bg-background">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="size-5 text-foreground" />
              <h3 className="font-serif text-xl font-bold">Biểu đồ Chuyển Đổi Gói Cước (7 ngày qua)</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Thống kê chi tiết lượt nâng cấp Gói Pro (79k), Gói Ultra (99k) và Tổng doanh thu PayOS.
            </p>
          </div>
          
          <div className="flex items-center gap-3 text-xs font-mono bg-muted/30 p-2.5 rounded-xl border">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
              <span>Pro: <strong>{totalPro} lượt</strong></span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-violet-600" />
              <span>Ultra: <strong>{totalUltra} lượt</strong></span>
            </div>
          </div>
        </div>

        <div className="h-[320px] w-full">
          {loadingDashboard ? (
            <div className="h-full w-full flex items-center justify-center font-mono text-xs text-muted-foreground">
              Đang tải dữ liệu biểu đồ gói cước...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subscriptionChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="dateFormatted" tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }} stroke="#e4e4e7" />
                <YAxis tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }} stroke="#e4e4e7" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e4e4e7',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                  }}
                  formatter={(value: any, name: any) => {
                    if (name === "Doanh thu (k VNĐ)") return [`₫${(Number(value) * 1000).toLocaleString('vi-VN')}`, "Doanh thu"]
                    return [value, name]
                  }}
                />
                <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px', paddingTop: '12px' }} />
                <Bar name="Gói Pro (79k)" dataKey="proCount" fill="#18181b" radius={[4, 4, 0, 0]} />
                <Bar name="Gói Ultra (99k)" dataKey="ultraCount" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </DoubleBezelCard>

      {/* CHART 2: Biểu đồ Tương Tác Thời Gian Thực (Click-to-Drilldown Timeline) */}
      <DoubleBezelCard className="bg-background">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-foreground" />
              <h3 className="font-serif text-xl font-bold">Biểu đồ Tương Tác Thời Gian Thực & Lưu Lượng</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              👈 <strong>MẸO: Click trực tiếp vào 1 điểm/mốc thời gian trên biểu đồ</strong> để xem chi tiết từng User và hành động cụ thể.
            </p>
          </div>
          
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Click node biểu đồ để xem Drilldown</span>
          </div>
        </div>

        {/* Metric Toggle Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4 bg-muted/20 p-2.5 rounded-xl border border-border/60">
          <span className="text-xs font-mono text-muted-foreground mr-1 flex items-center gap-1">
            <Clock className="size-3.5" /> Bật/tắt hiển thị chỉ số:
          </span>
          
          <button
            type="button"
            onClick={() => toggleMetric("promptCount")}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
              visibleMetrics.promptCount
                ? "bg-zinc-900 text-zinc-100 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                : "bg-muted/40 text-muted-foreground border-border opacity-50 line-through"
            }`}
          >
            <Sparkles className="size-3" />
            Tạo bài viết AI
          </button>

          <button
            type="button"
            onClick={() => toggleMetric("imageCount")}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
              visibleMetrics.imageCount
                ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                : "bg-muted/40 text-muted-foreground border-border opacity-50 line-through"
            }`}
          >
            <ImageIcon className="size-3" />
            Sinh ảnh AI
          </button>

          <button
            type="button"
            onClick={() => toggleMetric("loginCount")}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
              visibleMetrics.loginCount
                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                : "bg-muted/40 text-muted-foreground border-border opacity-50 line-through"
            }`}
          >
            <LogIn className="size-3" />
            Đăng nhập / Đăng ký
          </button>

          <button
            type="button"
            onClick={() => toggleMetric("knowledgeCount")}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
              visibleMetrics.knowledgeCount
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-muted/40 text-muted-foreground border-border opacity-50 line-through"
            }`}
          >
            <BookOpen className="size-3" />
            Nạp tri thức
          </button>

          <button
            type="button"
            onClick={() => toggleMetric("paymentCount")}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
              visibleMetrics.paymentCount
                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                : "bg-muted/40 text-muted-foreground border-border opacity-50 line-through"
            }`}
          >
            <CreditCard className="size-3" />
            Thanh toán gói cước
          </button>
        </div>

        <div className="h-[360px] w-full cursor-pointer">
          {loadingDashboard ? (
            <div className="h-full w-full flex items-center justify-center font-mono text-xs text-muted-foreground">
              Đang tải dữ liệu lưu lượng...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={activityTimelineData}
                onClick={handleChartClick}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradPrompt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#18181b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#18181b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradImage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="dateFormatted" tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }} stroke="#e4e4e7" />
                <YAxis tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }} stroke="#e4e4e7" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e4e4e7',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                  }}
                />
                <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px', paddingTop: '12px' }} />
                {visibleMetrics.promptCount && (
                  <Area name="Tạo bài viết AI" type="monotone" dataKey="promptCount" stroke="#18181b" strokeWidth={2} fillOpacity={1} fill="url(#gradPrompt)" />
                )}
                {visibleMetrics.imageCount && (
                  <Area name="Sinh ảnh AI" type="monotone" dataKey="imageCount" stroke="#0284c7" strokeWidth={1.5} fillOpacity={1} fill="url(#gradImage)" />
                )}
                {visibleMetrics.loginCount && (
                  <Area name="Đăng nhập / Đăng ký" type="monotone" dataKey="loginCount" stroke="#d97706" strokeWidth={1.5} strokeDasharray="3 3" fill="none" />
                )}
                {visibleMetrics.knowledgeCount && (
                  <Area name="Nạp tri thức" type="monotone" dataKey="knowledgeCount" stroke="#059669" strokeWidth={1.5} fill="none" />
                )}
                {visibleMetrics.paymentCount && (
                  <Area name="Thanh toán gói cước" type="monotone" dataKey="paymentCount" stroke="#9333ea" strokeWidth={2} fill="none" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </DoubleBezelCard>

      {/* ACTIVITY DRILLDOWN MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <DoubleBezelCard className="max-w-2xl w-full bg-background p-6 flex flex-col gap-5 shadow-2xl border-primary/20">
            {/* Header */}
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="size-5 text-primary" />
                  <h4 className="text-xl font-bold font-serif">Nhật ký hành động chi tiết User</h4>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  Mốc thời gian: <span className="font-bold text-foreground">{selectedDate}</span> • Thống kê thực tế người dùng tương tác
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* User Activity List */}
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {selectedActivities.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center text-muted-foreground border rounded-xl border-dashed bg-muted/10">
                  <Activity className="size-8 mb-2 opacity-50 text-muted-foreground" />
                  <p className="font-semibold text-sm">Chưa có nhật ký hoạt động được ghi nhận trong ngày này</p>
                  <p className="text-xs text-muted-foreground mt-1">Dữ liệu thời gian thực từ Database sẽ hiển thị tại đây ngay khi có hành động của người dùng.</p>
                </div>
              ) : (
                selectedActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-4 rounded-xl border border-border/80 bg-card hover:bg-muted/10 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="size-10 rounded-full bg-foreground/10 flex items-center justify-center font-bold text-foreground shrink-0 text-sm">
                      {act.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm truncate">{act.displayName}</span>
                        <TierBadge tier={act.tier} />
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {act.timestamp}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{act.email}</p>
                      
                      {/* Action Detail Badge */}
                      <div className="mt-2 text-xs font-mono flex items-center gap-1.5 text-foreground bg-muted/30 px-2.5 py-1 rounded-lg border w-fit">
                        {act.actionType === "PAYMENT" && <CreditCard className="size-3.5 text-emerald-500 shrink-0" />}
                        {act.actionType === "CREATE_PROMPT" && <Sparkles className="size-3.5 text-amber-500 shrink-0" />}
                        {act.actionType === "IMAGE_GEN" && <ImageIcon className="size-3.5 text-sky-500 shrink-0" />}
                        {act.actionType === "UPLOAD_KNOWLEDGE" && <BookOpen className="size-3.5 text-emerald-500 shrink-0" />}
                        {act.actionType === "LOGIN" && <LogIn className="size-3.5 text-muted-foreground shrink-0" />}
                        <span className="font-semibold">{act.actionLabel}:</span>
                        <span className="text-muted-foreground">{act.detail}</span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Admin Actions Hub */}
                  <div className="flex items-center gap-2 shrink-0 sm:self-center w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                    <button
                      onClick={() => handleGrantBonusQuota(act.userId, act.displayName)}
                      disabled={grantingBonus === act.userId}
                      className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold hover:bg-emerald-500/10 hover:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Thưởng +5 lượt sử dụng cho User"
                    >
                      <Gift className="size-3.5" />
                      <span>+5 Quota</span>
                    </button>
                    
                    <button
                      onClick={() => handleSendEmail(act.email, act.displayName)}
                      className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold hover:bg-sky-500/10 hover:border-sky-500/40 text-sky-600 dark:text-sky-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Gửi Email hỗ trợ"
                    >
                      <Mail className="size-3.5" />
                      <span>Mail</span>
                    </button>

                    <Link
                      to="/admin/users"
                      className="p-1.5 rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Xem hồ sơ User"
                    >
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </div>
                </div>
              )))}
            </div>

            {/* Footer */}
            <div className="border-t pt-3 flex justify-between items-center text-xs text-muted-foreground font-mono">
              <span>Đang hiển thị {selectedActivities.length} hành động gần nhất</span>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-foreground text-background font-semibold text-xs hover:opacity-90 transition-opacity"
              >
                Đóng
              </button>
            </div>
          </DoubleBezelCard>
        </div>
      )}
    </div>
  )
}
