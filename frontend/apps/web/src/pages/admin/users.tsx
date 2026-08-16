import { useState, useEffect, useCallback, useMemo } from "react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { AnimatedTable } from "@workspace/ui/components/animated-table"
import type { ColumnDef } from "@workspace/ui/components/animated-table"
import { AnimatedCalendar, type DateRange } from "@workspace/ui/components/calender"
import { adminApi } from "@/api/admin"
import type { AdminUser } from "@/api/admin"
import { toast } from "sonner"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Plus, RotateCcw, UserMinus, UserCheck, Shield, Sparkles, Filter, X } from "lucide-react"

// Mock Data phục vụ test bộ lọc và giao diện theo yêu cầu
const mockUsers: AdminUser[] = [
  {
    id: 1,
    displayName: "Lê Minh Admin",
    email: "admin@socialsence.vn",
    tier: "Enterprise", // hiển thị Ultra
    dailyQuotaLimit: -1, 
    remainingQuota: 9999,
    isActive: true,
    createdAt: "2026-06-01T08:00:00Z",
    roles: ["Admin", "User"],
    hasContext: true,
    lastQuotaReset: "2026-06-17T08:00:00Z",
    totalContentGenerated: 142
  },
  {
    id: 2,
    displayName: "Nguyễn Thu Hà",
    email: "ha.nguyen@gmail.com",
    tier: "Pro",
    dailyQuotaLimit: 50,
    remainingQuota: 42,
    isActive: true,
    createdAt: "2026-06-10T14:30:00Z",
    roles: ["User"],
    hasContext: true,
    lastQuotaReset: "2026-06-17T08:00:00Z",
    totalContentGenerated: 35
  },
  {
    id: 3,
    displayName: "Trần Thanh Bình",
    email: "binh.tran@yahoo.com",
    tier: "Free",
    dailyQuotaLimit: 5,
    remainingQuota: 0,
    isActive: true,
    createdAt: "2026-06-15T09:15:00Z",
    roles: ["User"],
    hasContext: false,
    lastQuotaReset: "2026-06-17T08:00:00Z",
    totalContentGenerated: 2
  },
  {
    id: 4,
    displayName: "Phạm Quốc Hùng",
    email: "hung.pq@outlook.com",
    tier: "Pro",
    dailyQuotaLimit: 50,
    remainingQuota: 50,
    isActive: false, // Banned
    createdAt: "2026-05-20T11:00:00Z",
    roles: ["User"],
    hasContext: true,
    lastQuotaReset: "2026-06-17T08:00:00Z",
    totalContentGenerated: 12
  },
  {
    id: 5,
    displayName: "Đỗ Kim Chi",
    email: "chi.do@socialsence.vn",
    tier: "Enterprise", // hiển thị Ultra
    dailyQuotaLimit: 500,
    remainingQuota: 380,
    isActive: true,
    createdAt: "2026-06-17T03:00:00Z",
    roles: ["User"],
    hasContext: true,
    lastQuotaReset: "2026-06-17T08:00:00Z",
    totalContentGenerated: 89
  }
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [searchValue, setSearchValue] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [useMockData, setUseMockData] = useState(false)

  // Date Filter State
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  // Create User Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newDisplayName, setNewDisplayName] = useState("")
  const [newQuotaLimit, setNewQuotaLimit] = useState(50)
  const [newIsAdmin, setNewIsAdmin] = useState(false)
  const [submittingCreate, setSubmittingCreate] = useState(false)

  // Fetch Users List
  const fetchUsersList = useCallback(async () => {
    if (useMockData) {
      setUsers(mockUsers)
      setTotalItems(mockUsers.length)
      setLoadingUsers(false)
      return
    }

    try {
      setLoadingUsers(true)
      const res = await adminApi.getUsers({
        page: currentPage,
        pageSize: pageSize,
        search: searchValue || undefined
      })
      
      if (res.data && res.data.length > 0) {
        setUsers(res.data)
        setTotalItems(res.total)
      } else {
        // Fallback sang mock data nếu API trống để tiện test UI
        setUsers(mockUsers)
        setTotalItems(mockUsers.length)
        setUseMockData(true)
      }
    } catch (err: any) {
      console.error("Failed to fetch admin users, falling back to mock data", err)
      setUsers(mockUsers)
      setTotalItems(mockUsers.length)
      setUseMockData(true)
    } finally {
      setLoadingUsers(false)
    }
  }, [currentPage, pageSize, searchValue, useMockData])

  useEffect(() => {
    fetchUsersList()
  }, [fetchUsersList])

  // Reset Quota handler
  const handleResetQuota = async (userId: number) => {
    try {
      if (useMockData) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, remainingQuota: u.dailyQuotaLimit === -1 ? 9999 : u.dailyQuotaLimit } : u))
        toast.success("Đã reset hạn ngạch cho người dùng về đầy!")
        return
      }
      await adminApi.resetQuota(userId)
      toast.success("Đã reset hạn ngạch cho người dùng về đầy!")
      fetchUsersList()
    } catch (err: any) {
      toast.error(err.message || "Không thể reset hạn ngạch!")
    }
  }

  // Toggle User Status handler (block/unblock)
  const handleToggleStatus = async (user: AdminUser) => {
    try {
      if (useMockData) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u))
        toast.success(user.isActive ? "Đã khóa người dùng thành công!" : "Đã mở khóa người dùng thành công!")
        return
      }

      if (user.isActive) {
        await adminApi.deleteUser(user.id)
        toast.success("Đã khóa người dùng thành công!")
      } else {
        await adminApi.restoreUser(user.id)
        toast.success("Đã mở khóa người dùng thành công!")
      }
      fetchUsersList()
    } catch (err: any) {
      toast.error(err.message || "Thao tác thất bại!")
    }
  }

  // Thay đổi Tier
  const handlePromoteTier = async (userId: number, currentTier: string) => {
    const tiers = ["Free", "Pro", "Enterprise"]
    const currentIndex = tiers.indexOf(currentTier)
    const nextTier = tiers[(currentIndex + 1) % tiers.length]
    
    try {
      if (useMockData) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier: nextTier, dailyQuotaLimit: nextTier === "Enterprise" ? -1 : nextTier === "Pro" ? 50 : 5 } : u))
        toast.success(`Đã chuyển đổi người dùng sang gói ${nextTier === "Enterprise" ? "Ultra" : nextTier}!`)
        return
      }
      await adminApi.updateTier(userId, { tier: nextTier })
      toast.success(`Đã chuyển đổi người dùng sang gói ${nextTier === "Enterprise" ? "Ultra" : nextTier}!`)
      fetchUsersList()
    } catch (err: any) {
      toast.error(err.message || "Không thể nâng cấp gói cước!")
    }
  }

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || !newPassword || !newDisplayName) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc!")
      return
    }

    try {
      setSubmittingCreate(true)
      if (useMockData) {
        const newUser: AdminUser = {
          id: Date.now(),
          displayName: newDisplayName,
          email: newEmail,
          tier: "Free",
          dailyQuotaLimit: newQuotaLimit,
          remainingQuota: newQuotaLimit,
          isActive: true,
          createdAt: new Date().toISOString(),
          roles: newIsAdmin ? ["Admin", "User"] : ["User"],
          hasContext: false,
          lastQuotaReset: new Date().toISOString(),
          totalContentGenerated: 0
        }
        setUsers(prev => [newUser, ...prev])
        setTotalItems(prev => prev + 1)
        setIsCreateOpen(false)
        toast.success("Đã tạo người dùng mới thành công (chế độ demo)!")
        return
      }

      await adminApi.createUser({
        email: newEmail,
        password: newPassword,
        displayName: newDisplayName,
        dailyQuotaLimit: newQuotaLimit,
        isAdmin: newIsAdmin
      })
      toast.success("Đã tạo người dùng mới thành công!")
      setIsCreateOpen(false)
      // Reset form
      setNewEmail("")
      setNewPassword("")
      setNewDisplayName("")
      setNewQuotaLimit(50)
      setNewIsAdmin(false)
      fetchUsersList()
    } catch (err: any) {
      toast.error(err.message || "Không thể tạo người dùng mới!")
    } finally {
      setSubmittingCreate(false)
    }
  }

  // Frontend filtering by Date Range selected in Calendar
  const filteredUsers = useMemo(() => {
    if (!dateRange || (!dateRange.from && !dateRange.to)) return users

    return users.filter(user => {
      if (!user.createdAt) return false
      const createdTime = new Date(user.createdAt).getTime()
      
      if (dateRange.from && dateRange.to) {
        const start = new Date(dateRange.from).setHours(0, 0, 0, 0)
        const end = new Date(dateRange.to).setHours(23, 59, 59, 999)
        return createdTime >= start && createdTime <= end
      }
      
      if (dateRange.from) {
        const start = new Date(dateRange.from).setHours(0, 0, 0, 0)
        return createdTime >= start
      }

      return true
    })
  }, [users, dateRange])

  const columns: ColumnDef<AdminUser>[] = [
    { 
      id: "displayName", 
      header: "Họ tên", 
      accessorKey: "displayName", 
      sortable: true,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            {row.displayName || "Chưa đặt tên"}
            {row.roles?.includes("Admin") && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-[9px] font-bold tracking-wider uppercase bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                <Shield className="size-2.5 text-violet-500" /> Admin
              </span>
            )}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">ID: {row.id}</span>
        </div>
      )
    },
    { 
      id: "email", 
      header: "Email", 
      accessorKey: "email",
      cell: (row) => <span className="font-mono text-xs text-muted-foreground">{row.email}</span>
    },
    { 
      id: "tier", 
      header: "Gói cước (Bấm đổi)", 
      cell: (row) => {
        const displayTier = row.tier === "Enterprise" ? "Ultra" : row.tier
        return (
          <button
            onClick={() => handlePromoteTier(row.id, row.tier)}
            title="Bấm đổi nhanh: Free -> Pro -> Ultra"
            className={`px-2.5 py-1 rounded text-[10px] uppercase font-mono tracking-wider border text-left transition-all hover:scale-105 active:scale-95 ${
              row.tier === "Enterprise" 
                ? "bg-foreground text-background border-foreground hover:bg-foreground/90 font-bold" 
                : row.tier === "Pro" 
                ? "bg-muted text-foreground border-border hover:bg-muted/80 font-bold" 
                : "bg-transparent text-muted-foreground border-dashed border-border hover:bg-muted/20"
            }`}
          >
            {displayTier}
          </button>
        )
      }
    },
    {
      id: "quota",
      header: "Hạn ngạch ngày",
      cell: (row) => (
        <span className="font-mono text-xs font-semibold">
          {row.dailyQuotaLimit === -1 ? (
            <span className="text-foreground flex items-center gap-0.5">
              <Sparkles className="size-3 text-violet-500" /> Vô hạn
            </span>
          ) : (
            `${row.remainingQuota}/${row.dailyQuotaLimit}`
          )}
        </span>
      )
    },
    { 
      id: "createdAt", 
      header: "Ngày đăng ký", 
      accessorKey: "createdAt",
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString("vi-VN") : "---"}
        </span>
      )
    },
    { 
      id: "status", 
      header: "Trạng thái", 
      cell: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
            row.isActive 
              ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" 
              : "bg-rose-500/15 text-rose-500 border-rose-500/20 line-through"
          }`}
        >
          <span className={`size-1.5 rounded-full ${
            row.isActive ? "bg-emerald-500" : "bg-rose-500"
          }`} />
          {row.isActive ? "Hoạt động" : "Bị khóa"}
        </span>
      )
    },
    {
      id: "actions",
      header: "Thao tác",
      cell: (row) => (
        <div className="flex gap-2">
          {row.dailyQuotaLimit !== -1 && (
            <button
              onClick={() => handleResetQuota(row.id)}
              className="text-[10px] uppercase tracking-wider font-mono border border-border px-2.5 py-1 rounded bg-muted/20 hover:bg-foreground hover:text-background transition-colors active:scale-95 inline-flex items-center gap-1"
              title="Reset số lượt tạo hôm nay về đầy hạn ngạch"
            >
              <RotateCcw className="size-3" /> Reset Quota
            </button>
          )}
          <button
            onClick={() => handleToggleStatus(row)}
            className={`text-[10px] uppercase tracking-wider font-mono border px-2.5 py-1 rounded transition-colors active:scale-95 inline-flex items-center gap-1 ${
              row.isActive 
                ? "border-rose-200/50 hover:bg-rose-500 hover:text-white text-rose-500" 
                : "border-emerald-200/50 hover:bg-foreground hover:text-background text-emerald-500"
            }`}
          >
            {row.isActive ? (
              <>
                <UserMinus className="size-3" /> Khóa
              </>
            ) : (
              <>
                <UserCheck className="size-3" /> Mở khóa
              </>
            )}
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="p-6 flex flex-col gap-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader 
          title="Quản lý Người dùng" 
          description="Xem danh sách, phân quyền, cấu hình gói cước, reset quota và quản lý trạng thái tài khoản." 
        />
        <div className="flex gap-2">
          {useMockData && (
            <button
              onClick={() => {
                setUseMockData(false)
                toast.success("Đã chuyển sang kết nối dữ liệu BE thật!")
              }}
              className="h-10 px-3 rounded border border-dashed border-border bg-transparent text-xs font-mono uppercase hover:bg-muted/20 transition-all"
              title="Click để đồng bộ dữ liệu thật từ Railway"
            >
              Chế độ Demo 🟢
            </button>
          )}

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <button className="h-10 px-4 rounded bg-foreground text-background font-mono text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:bg-foreground/90 transition-colors active:scale-95">
                <Plus className="size-4" /> Tạo người dùng
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border border-border bg-background">
              <form onSubmit={handleCreateUser}>
                <DialogHeader>
                  <DialogTitle className="font-serif text-lg">Tạo Người Dùng Mới</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Điền đầy đủ thông tin để tạo tài khoản mới. Tài khoản sau khi tạo có thể đăng nhập ngay.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="displayName" className="text-xs font-mono uppercase text-muted-foreground">Tên hiển thị</Label>
                    <Input 
                      id="displayName" 
                      value={newDisplayName} 
                      onChange={(e) => setNewDisplayName(e.target.value)} 
                      placeholder="Nguyễn Văn A" 
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-xs font-mono uppercase text-muted-foreground">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={newEmail} 
                      onChange={(e) => setNewEmail(e.target.value)} 
                      placeholder="email@domain.com" 
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password" className="text-xs font-mono uppercase text-muted-foreground">Mật khẩu</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      placeholder="••••••••" 
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="quota" className="text-xs font-mono uppercase text-muted-foreground">Hạn ngạch ngày (-1 là vô hạn)</Label>
                    <Input 
                      id="quota" 
                      type="number" 
                      value={newQuotaLimit} 
                      onChange={(e) => setNewQuotaLimit(Number(e.target.value))} 
                      min="-1"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input 
                      id="isAdmin" 
                      type="checkbox" 
                      checked={newIsAdmin} 
                      onChange={(e) => setNewIsAdmin(e.target.checked)}
                      className="size-4 accent-foreground"
                    />
                    <Label htmlFor="isAdmin" className="text-xs font-mono uppercase text-muted-foreground cursor-pointer select-none">
                      Cấp quyền Administrator
                    </Label>
                  </div>
                </div>
                <DialogFooter>
                  <button 
                    type="button" 
                    onClick={() => setIsCreateOpen(false)}
                    className="h-9 px-4 rounded border border-border bg-transparent text-foreground hover:bg-muted/20 font-mono text-xs uppercase tracking-wider"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingCreate}
                    className="h-9 px-4 rounded bg-foreground text-background hover:bg-foreground/90 font-mono text-xs uppercase tracking-wider disabled:opacity-55"
                  >
                    {submittingCreate ? "Đang tạo..." : "Xác nhận"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Toolbar với Lọc lịch AnimatedCalendar và Tìm kiếm */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/10 p-4 rounded-xl border border-border/40">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Animated Calendar Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-muted-foreground">Lọc đăng ký:</span>
            <AnimatedCalendar 
              mode="range"
              value={dateRange}
              onChange={setDateRange}
              placeholder="Chọn khoảng thời gian"
              showPresets
              className="w-[280px]"
            />
          </div>

          {/* Clear Filter button */}
          {dateRange && (dateRange.from || dateRange.to) && (
            <button
              onClick={() => setDateRange(undefined)}
              className="h-9 px-2.5 rounded border border-border bg-background text-rose-500 hover:bg-rose-50 hover:border-rose-200 font-mono text-xs inline-flex items-center gap-1 transition-all active:scale-95"
              title="Xóa bộ lọc thời gian"
            >
              <X className="size-3.5" /> Xóa lọc
            </button>
          )}
        </div>

        {/* Tìm kiếm */}
        <div className="w-full sm:w-72">
          <Input 
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Tìm theo họ tên hoặc email..."
            className="h-10 text-xs"
          />
        </div>
      </div>

      {/* Main Table Container */}
      <DoubleBezelCard className="bg-background">
        <AnimatedTable
          data={filteredUsers}
          columns={columns}
          searchable={false} // Tự search ở Input toolbar trên để giữ layout cân đối hơn
          loading={loadingUsers}
          searchPlaceholder="Tìm kiếm..."
          pagination={{
            page: currentPage,
            pageSize: pageSize,
            totalItems: totalItems,
            onPageChange: (p) => setCurrentPage(p),
            onPageSizeChange: (s) => {
              setPageSize(s)
              setCurrentPage(1)
            }
          }}
        />
      </DoubleBezelCard>
    </div>
  )
}
