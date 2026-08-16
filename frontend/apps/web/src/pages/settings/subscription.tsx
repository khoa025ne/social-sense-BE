import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { EyebrowBadge } from "@workspace/ui/components/eyebrow-badge"
import { PageHeader } from "@workspace/ui/components/page-header"
import { useAuthStore } from "@/stores/auth-store"
import { paymentApi, type CreatePaymentResponse, type SubscriptionInfo } from "@/api/payment"
import { authApi } from "@/api/auth"
import { toast } from "sonner"
import { Loader2, ExternalLink, QrCode, ShieldCheck, Check, Zap } from "lucide-react"

export default function SubscriptionPage() {
  const [searchParams] = useSearchParams()
  const targetPlanParam = searchParams.get("plan")
  const hasAutoTriggered = useRef(false)

  const { user } = useAuthStore()
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null)
  const [loadingSub, setLoadingSub] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [paymentData, setPaymentData] = useState<CreatePaymentResponse | null>(null)
  const [creatingPayment, setCreatingPayment] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [planPrices, setPlanPrices] = useState<Record<string, number>>({
    Pro: 79000,
    Ultra: 99000,
  })
  const pollingInterval = useRef<any>(null)

  // Fetch subscription info & dynamic plan prices & sync global store
  const fetchSubInfo = async () => {
    try {
      setLoadingSub(true)
      const data = await paymentApi.getSubscription()
      setSubInfo(data)

      // Sync latest user profile and quota to global store
      const [profile, quotaInfo] = await Promise.all([
        authApi.getMe(),
        authApi.getQuota()
      ])
      if (profile) useAuthStore.getState().setUser(profile)
      if (quotaInfo) useAuthStore.getState().setQuota(quotaInfo)
    } catch (error) {
      console.error("Failed to fetch subscription", error)
    } finally {
      setLoadingSub(false)
    }
  }

  useEffect(() => {
    fetchSubInfo()
    paymentApi.getPlans().then((res: any) => {
      const rawPlans = res?.plans || res
      if (Array.isArray(rawPlans)) {
        const map: Record<string, number> = {}
        rawPlans.forEach((p: any) => {
          if (p.tier) map[p.tier] = p.price
        })
        setPlanPrices(prev => ({ ...prev, ...map }))
      }
    }).catch(() => {})

    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current)
    }
  }, [])

  // Auto trigger plan payment if URL parameter ?plan=Pro or ?plan=Ultra is provided
  useEffect(() => {
    if (targetPlanParam && (targetPlanParam === "Pro" || targetPlanParam === "Ultra" || targetPlanParam === "Enterprise") && !hasAutoTriggered.current) {
      hasAutoTriggered.current = true
      handleSelectPlan(targetPlanParam)
    }
  }, [targetPlanParam])

  // Start polling order status
  const startPolling = (orderCode: number) => {
    if (pollingInterval.current) clearInterval(pollingInterval.current)

    pollingInterval.current = setInterval(async () => {
      try {
        const res = await paymentApi.getOrderStatus(orderCode)
        if (res.status === "Paid") {
          if (pollingInterval.current) clearInterval(pollingInterval.current)
          toast.success("Thanh toán thành công! Gói cước của bạn đã được nâng cấp.")
          setShowQR(false)
          fetchSubInfo()
        } else if (res.status === "Cancelled" || res.status === "Expired") {
          if (pollingInterval.current) clearInterval(pollingInterval.current)
          toast.error("Đơn hàng đã bị hủy hoặc hết hạn.")
          setShowQR(false)
        }
      } catch (error) {
        console.error("Error polling order status", error)
      }
    }, 3000)
  }

  const handleSelectPlan = async (plan: string) => {
    try {
      setCreatingPayment(true)
      setSelectedPlan(plan)
      
      const returnUrl = window.location.origin + "/settings/subscription"
      const cancelUrl = window.location.origin + "/settings/subscription"
      
      const res = await paymentApi.createPayment(plan, returnUrl, cancelUrl)
      setPaymentData(res)
      setShowQR(true)
      startPolling(res.orderCode)
    } catch (error: any) {
      toast.error(error.message || "Không thể tạo đơn thanh toán.")
    } finally {
      setCreatingPayment(false)
    }
  }

  const breadcrumbs = [
    { label: "Cài đặt", href: "/settings" },
    { label: "Gói cước & Thanh toán" }
  ]

  return (
    <div className="relative p-6 flex flex-col gap-8 max-w-5xl mx-auto">
      <PageHeader
        title="Gói cước & Nâng cấp"
        description="Quản lý gói cước hiện tại của bạn và nâng cấp tính năng thông minh."
        breadcrumbs={breadcrumbs}
      />

      {/* Current Subscription Status */}
      <DoubleBezelCard className="bg-background border-primary/10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          {loadingSub ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin size-4 text-primary" />
              <span>Đang tải thông tin gói cước...</span>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-sm">Gói hiện tại</span>
                  <EyebrowBadge>
                    {subInfo?.isActive && subInfo.tier ? `${(subInfo.tier === "Enterprise" ? "Ultra" : subInfo.tier).toUpperCase()} PLAN` : "FREE PLAN"}
                  </EyebrowBadge>
                </div>
                <h3 className="text-2xl font-bold mt-2">
                  {subInfo?.isActive && subInfo.tier === "Pro" 
                    ? "Gói Chuyên Nghiệp (Pro)" 
                    : subInfo?.isActive && (subInfo.tier === "Enterprise" || subInfo.tier === "Ultra")
                    ? "Gói Đội Nhóm (Ultra)" 
                    : "Miễn phí trọn đời"}
                </h3>
                <p className="text-muted-foreground text-xs mt-1">
                  {subInfo?.isActive && subInfo.expiresAt 
                    ? `Hết hạn ngày: ${new Date(subInfo.expiresAt).toLocaleDateString("vi-VN")} (Còn lại ${subInfo.daysRemaining} ngày)`
                    : "Hạn mức sử dụng cơ bản hàng ngày."}
                </p>
              </div>
              <div className="flex items-center gap-3 border px-4 py-3 rounded-xl bg-muted/20 text-sm font-mono">
                {subInfo?.isActive && subInfo.tier === "Pro" ? (
                  <span>Hạn mức: 50 lượt tạo / ngày</span>
                ) : subInfo?.isActive && (subInfo.tier === "Enterprise" || subInfo.tier === "Ultra") ? (
                  <span>Hạn mức: 500 lượt tạo / ngày</span>
                ) : (
                  <span>Hạn mức: 5 lượt tạo / ngày</span>
                )}
              </div>
            </>
          )}
        </div>
      </DoubleBezelCard>

      {/* Plans Selection Area */}
      <div>
        <h3 className="font-serif text-2xl mb-6 text-center">Lựa chọn gói cước phù hợp</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Pro Plan Card */}
          <DoubleBezelCard className="flex flex-col justify-between p-8 bg-background border border-border">
            <div>
              <div className="flex justify-between items-center">
                <h4 className="text-xl font-bold text-muted-foreground">Gói Pro</h4>
                <span className="px-2 py-0.5 border text-[10px] uppercase font-mono tracking-wider rounded text-muted-foreground">Phổ biến</span>
              </div>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-bold">₫{(planPrices.Pro || 79000).toLocaleString('vi-VN')}</span>
                <span className="text-muted-foreground text-sm ml-2">/ tháng</span>
              </div>
              <p className="mt-2 text-muted-foreground text-xs">Phù hợp cho cá nhân làm nội dung chuyên nghiệp.</p>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="text-muted-foreground size-4 shrink-0" />
                  <span>50 lượt tạo nội dung / ngày</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-muted-foreground size-4 shrink-0" />
                  <span>Đa kênh: FB, LinkedIn, Instagram, TikTok</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-muted-foreground size-4 shrink-0" />
                  <span>Tạo hình ảnh AI miễn phí</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-muted-foreground size-4 shrink-0" />
                  <span>Nạp kho tri thức thương hiệu</span>
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <Button
                variant="outline"
                className="w-full text-base font-bold h-12"
                onClick={() => handleSelectPlan("Pro")}
                disabled={creatingPayment || (subInfo?.tier === "Pro" && subInfo?.isActive)}
              >
                {creatingPayment && selectedPlan === "Pro" ? (
                  <Loader2 className="animate-spin size-4 mr-2 inline" />
                ) : null}
                {subInfo?.tier === "Pro" && subInfo?.isActive ? "Đang sử dụng" : "Chọn gói Pro"}
              </Button>
            </div>
          </DoubleBezelCard>

          {/* Ultra Plan Card */}
          <div className="bezel-outer ring-2 ring-primary rounded-[2.2rem] shadow-lg shadow-primary/5">
            <div className="bezel-inner flex flex-col justify-between h-full bg-background p-8 rounded-[2.1rem]">
              <div>
                <div className="flex justify-between items-center">
                  <h4 className="text-xl font-bold text-primary flex items-center gap-1">
                    <Zap className="size-4 animate-bounce animate-pulse" />
                    Gói Ultra
                  </h4>
                  <span className="px-2.5 py-0.5 bg-primary text-primary-foreground text-[10px] uppercase font-mono tracking-widest font-bold rounded">Tối ưu nhất</span>
                </div>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-bold">₫{(planPrices.Ultra || planPrices.Enterprise || 99000).toLocaleString('vi-VN')}</span>
                  <span className="text-muted-foreground text-sm ml-2">/ tháng</span>
                </div>
                <p className="mt-2 text-muted-foreground text-xs">Dành cho Agency, đội nhóm marketing lớn cần hiệu suất tối đa.</p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="text-primary size-4 shrink-0" />
                    <span className="font-semibold text-foreground">500 lượt tạo nội dung / ngày</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="text-primary size-4 shrink-0" />
                    <span>Huấn luyện Tri thức không giới hạn</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="text-primary size-4 shrink-0" />
                    <span>Tích hợp API tốc độ cao riêng biệt</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="text-primary size-4 shrink-0" />
                    <span>Tự động đăng bài đa nền tảng</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="text-primary size-4 shrink-0" />
                    <span className="text-foreground font-semibold">Hỗ trợ chuyên gia Marketing 24/7 (SLA 2h)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="text-primary size-4 shrink-0" />
                    <span>Ưu tiên xử lý trên hạ tầng GPU riêng</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <Button
                  variant="shimmer"
                  className="w-full text-base font-bold h-12"
                  onClick={() => handleSelectPlan("Ultra")}
                  disabled={creatingPayment || ((subInfo?.tier === "Enterprise" || subInfo?.tier === "Ultra") && subInfo?.isActive)}
                >
                  {creatingPayment && selectedPlan === "Ultra" ? (
                    <Loader2 className="animate-spin size-4 mr-2 inline" />
                  ) : null}
                  {(subInfo?.tier === "Enterprise" || subInfo?.tier === "Ultra") && subInfo?.isActive ? "Đang sử dụng" : "Nâng cấp Ultra"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment QR Modal */}
      {showQR && paymentData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <DoubleBezelCard className="max-w-md w-full bg-background p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h4 className="text-lg font-bold font-serif flex items-center gap-2">
                <QrCode className="size-5 text-primary" />
                Thanh toán qua PayOS
              </h4>
              <button 
                onClick={() => {
                  setShowQR(false)
                  if (pollingInterval.current) clearInterval(pollingInterval.current)
                }} 
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                Đóng
              </button>
            </div>
            
            <div className="flex flex-col items-center text-center gap-3 py-2 overflow-y-auto max-h-[75vh]">
              <p className="text-sm">Bạn đang mua gói <span className="font-bold">{selectedPlan}</span>.</p>
              
              <div className="border-2 border-primary/20 p-2 bg-white rounded-xl shadow-md my-2">
                {/* Real QR Code Image */}
                <img 
                  src={paymentData.qrCodeUrl} 
                  alt="VietQR PayOS" 
                  className="size-48 object-contain"
                />
              </div>

              <p className="text-[11px] text-muted-foreground">
                Quét mã QR bằng ứng dụng ngân hàng để thanh toán tự động, hoặc chuyển khoản thủ công theo thông tin bên dưới:
              </p>

              <div className="text-xs font-mono bg-muted/40 p-3 rounded-xl border w-full text-left flex flex-col gap-1.5">
                <div className="flex justify-between border-b pb-1 border-border/60">
                  <span className="text-muted-foreground">Ngân hàng:</span>
                  <span className="font-bold">{paymentData.bankTransfer.bankName}</span>
                </div>
                <div className="flex justify-between border-b pb-1 border-border/60">
                  <span className="text-muted-foreground">Số tài khoản:</span>
                  <span className="font-bold select-all">{paymentData.bankTransfer.accountNumber}</span>
                </div>
                <div className="flex justify-between border-b pb-1 border-border/60">
                  <span className="text-muted-foreground">Tên tài khoản:</span>
                  <span className="font-bold">{paymentData.bankTransfer.accountName}</span>
                </div>
                <div className="flex justify-between border-b pb-1 border-border/60">
                  <span className="text-muted-foreground">Số tiền:</span>
                  <span className="font-bold text-primary">{paymentData.bankTransfer.amount.toLocaleString("vi-VN")} VND</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nội dung chuyển khoản:</span>
                  <span className="font-bold text-red-600 bg-red-100 dark:bg-red-950/40 px-1 rounded select-all">{paymentData.bankTransfer.description}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full mt-3">
                <Button 
                  onClick={() => window.open(paymentData.checkoutUrl, "_blank")} 
                  className="w-full flex items-center justify-center gap-2 h-11"
                >
                  Thanh toán qua cổng Web (PayOS)
                  <ExternalLink className="size-4" />
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                  <Loader2 className="animate-spin size-3 text-primary" />
                  <span>Đang lắng nghe giao dịch tự động...</span>
                </div>
              </div>
            </div>
          </DoubleBezelCard>
        </div>
      )}
    </div>
  )
}
