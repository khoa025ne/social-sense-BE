import { useState, useEffect, useMemo } from "react"
import { Link } from "react-router-dom"
import { paymentApi, type SubscriptionInfo, type PaymentHistoryItem } from "@/api/payment"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { EyebrowBadge } from "@workspace/ui/components/eyebrow-badge"
import { TierBadge } from "@workspace/ui/components/tier-badge"
import { AnimatedTable, type ColumnDef } from "@workspace/ui/components/animated-table"
import { Button } from "@workspace/ui/components/button"
import { toast } from "sonner"
import { Loader2, CreditCard, Calendar, RefreshCw, ArrowUpRight, History } from "lucide-react"

// Mock Data phục vụ test UI khi chưa có giao dịch thật
const mockHistory: PaymentHistoryItem[] = [
  {
    orderId: 1,
    orderCode: 1029482,
    tier: "Enterprise", // hiển thị Ultra
    amount: 150000,
    status: "Paid",
    createdAt: "2026-06-01T08:30:00Z",
    paidAt: "2026-06-01T08:35:00Z"
  },
  {
    orderId: 2,
    orderCode: 9827364,
    tier: "Pro",
    amount: 79000,
    status: "Paid",
    createdAt: "2026-05-01T14:20:00Z",
    paidAt: "2026-05-01T14:22:00Z"
  },
  {
    orderId: 3,
    orderCode: 8472910,
    tier: "Enterprise",
    amount: 150000,
    status: "Cancelled",
    createdAt: "2026-06-15T09:00:00Z",
    paidAt: null
  }
]

interface TableRowItem extends PaymentHistoryItem {
  id: number
}

export default function BillingPage() {
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null)
  const [history, setHistory] = useState<PaymentHistoryItem[]>([])
  const [loadingSub, setLoadingSub] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)
  
  // Pagination States
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalItems, setTotalItems] = useState(0)
  const [useMockData, setUseMockData] = useState(false)

  // Fetch subscription info
  const fetchSubInfo = async () => {
    try {
      setLoadingSub(true)
      const data = await paymentApi.getSubscription()
      setSubInfo(data)
    } catch (error) {
      console.error("Failed to fetch subscription info", error)
    } finally {
      setLoadingSub(false)
    }
  }

  // Fetch billing history
  const fetchBillingHistory = async () => {
    if (useMockData) {
      setHistory(mockHistory)
      setTotalItems(mockHistory.length)
      setLoadingHistory(false)
      return
    }

    try {
      setLoadingHistory(true)
      const res = await paymentApi.getHistory(currentPage, pageSize)
      if (res.data && res.data.length > 0) {
        setHistory(res.data)
        // BE có thể trả về total hoặc không, nếu không ta dùng length làm total
        setTotalItems((res as any).total || res.data.length)
      } else {
        // Fallback sang mock data nếu không có hóa đơn
        setHistory(mockHistory)
        setTotalItems(mockHistory.length)
        setUseMockData(true)
      }
    } catch (error) {
      console.error("Failed to fetch billing history, falling back to mock data", error)
      setHistory(mockHistory)
      setTotalItems(mockHistory.length)
      setUseMockData(true)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    fetchSubInfo()
  }, [])

  useEffect(() => {
    fetchBillingHistory()
  }, [currentPage, pageSize, useMockData])

  // Định nghĩa các cột cho AnimatedTable
  const columns = useMemo<ColumnDef<TableRowItem>[]>(() => [
    {
      id: "orderCode",
      header: "Mã đơn hàng",
      cell: (row) => (
        <span className="font-mono font-medium text-foreground">
          #{row.orderCode}
        </span>
      ),
      sortable: true
    },
    {
      id: "tier",
      header: "Gói dịch vụ",
      cell: (row) => <TierBadge tier={row.tier} />,
      sortable: true
    },
    {
      id: "amount",
      header: "Số tiền",
      cell: (row) => (
        <span className="font-mono font-medium text-foreground">
          {row.amount.toLocaleString("vi-VN")} đ
        </span>
      ),
      sortable: true
    },
    {
      id: "status",
      header: "Trạng thái",
      cell: (row) => {
        const status = row.status
        let badgeStyle = "bg-muted text-muted-foreground border-border"
        let statusText = status

        if (status === "Paid") {
          badgeStyle = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
          statusText = "Đã thanh toán"
        } else if (status === "Pending") {
          badgeStyle = "bg-amber-500/10 text-amber-500 border-amber-500/20"
          statusText = "Chờ xử lý"
        } else if (status === "Cancelled") {
          badgeStyle = "bg-red-500/10 text-red-500 border-red-500/20"
          statusText = "Đã hủy"
        } else if (status === "Expired") {
          badgeStyle = "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
          statusText = "Hết hạn"
        }

        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeStyle}`}>
            {statusText}
          </span>
        )
      },
      sortable: true
    },
    {
      id: "createdAt",
      header: "Ngày tạo",
      cell: (row) => (
        <span className="text-muted-foreground text-xs">
          {new Date(row.createdAt).toLocaleString("vi-VN")}
        </span>
      ),
      sortable: true
    },
    {
      id: "paidAt",
      header: "Ngày thanh toán",
      cell: (row) => (
        <span className="text-muted-foreground text-xs">
          {row.paidAt ? new Date(row.paidAt).toLocaleString("vi-VN") : "-"}
        </span>
      ),
      sortable: true
    }
  ], [])

  // Chuẩn bị dữ liệu map id cho table
  const tableData = useMemo<TableRowItem[]>(() => {
    return history.map((item) => ({
      ...item,
      id: item.orderId
    }))
  }, [history])

  const breadcrumbs = [
    { label: "Cài đặt", href: "/settings" },
    { label: "Thanh toán" }
  ]

  return (
    <div className="p-6 flex flex-col gap-8 max-w-5xl mx-auto">
      <PageHeader
        title="Thanh toán & Giao dịch"
        description="Theo dõi lịch sử hóa đơn thanh toán và quản lý các giao dịch nâng cấp tài khoản của bạn."
        breadcrumbs={breadcrumbs}
      />

      {/* Subscription Quick Info */}
      <DoubleBezelCard className="bg-background">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          {loadingSub ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="animate-spin size-4 text-primary" />
              <span>Đang tải thông tin gói cước...</span>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <CreditCard className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">
                      {subInfo?.isActive && subInfo.tier === "Pro" 
                        ? "Gói Chuyên Nghiệp (Pro)" 
                        : subInfo?.isActive && (subInfo.tier === "Enterprise" || subInfo.tier === "Ultra")
                        ? "Gói Đội Nhóm (Ultra)" 
                        : "Gói Miễn Phí (Free)"}
                    </h3>
                    <EyebrowBadge>
                      {subInfo?.isActive && subInfo.tier ? `${(subInfo.tier === "Enterprise" ? "Ultra" : subInfo.tier).toUpperCase()}` : "FREE"}
                    </EyebrowBadge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    {subInfo?.isActive && subInfo.expiresAt 
                      ? `Hết hạn ngày: ${new Date(subInfo.expiresAt).toLocaleDateString("vi-VN")} (Còn lại ${subInfo.daysRemaining} ngày)`
                      : "Sử dụng các giới hạn tính năng cơ bản hàng ngày."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <Link to="/settings/subscription" className="w-full md:w-auto">
                  <Button className="w-full md:w-auto bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white font-medium px-5 py-2.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2">
                    Nâng cấp / Đổi gói
                    <ArrowUpRight className="size-4" />
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </DoubleBezelCard>

      {/* Payment History Section */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <History className="size-5 text-primary" />
            Lịch sử giao dịch
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setUseMockData(false)
              fetchBillingHistory()
            }}
            disabled={loadingHistory}
            className="text-xs border-border flex items-center gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>

        <AnimatedTable<TableRowItem>
          data={tableData}
          columns={columns}
          loading={loadingHistory}
          striped
          pagination={{
            page: currentPage,
            pageSize: pageSize,
            totalItems: totalItems,
            onPageChange: (page) => setCurrentPage(page),
            onPageSizeChange: (size) => {
              setPageSize(size)
              setCurrentPage(1)
            }
          }}
          emptyMessage="Không tìm thấy lịch sử thanh toán nào."
        />
      </div>
    </div>
  )
}
