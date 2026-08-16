import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useAuthStore } from "@/stores/auth-store"
import { authApi } from "@/api/auth"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { EyebrowBadge } from "@workspace/ui/components/eyebrow-badge"
import { TierBadge } from "@workspace/ui/components/tier-badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { toast } from "sonner"
import { Loader2, User, Lock, Mail, ShieldAlert } from "lucide-react"

export default function SettingsIndexPage() {
  const { user, setUser } = useAuthStore()

  // Profile Form States
  const [displayName, setDisplayName] = useState("")
  const [updatingProfile, setUpdatingProfile] = useState(false)

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [updatingPassword, setUpdatingPassword] = useState(false)

  // Load initial data
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "")
    }
  }, [user])

  // Sync profile again from API
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const profile = await authApi.getMe()
        setUser(profile)
        setDisplayName(profile.displayName || "")
      } catch (err) {
        console.error("Failed to sync current profile", err)
      }
    }
    fetchMe()
  }, [])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      toast.error("Tên hiển thị không được để trống.")
      return
    }

    try {
      setUpdatingProfile(true)
      const res = await authApi.updateProfile({ displayName })
      
      // Update local state
      if (user) {
        setUser({
          ...user,
          displayName: res.displayName || displayName
        })
      }
      toast.success("Cập nhật thông tin cá nhân thành công.")
    } catch (err: any) {
      toast.error(err.message || "Không thể cập nhật profile.")
    } finally {
      setUpdatingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) {
      toast.error("Vui lòng nhập mật khẩu hiện tại.")
      return
    }
    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải từ 6 ký tự trở lên.")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Xác nhận mật khẩu mới không trùng khớp.")
      return
    }

    try {
      setUpdatingPassword(true)
      await authApi.changePassword({ currentPassword, newPassword })
      toast.success("Thay đổi mật khẩu thành công.")
      
      // Reset form
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      toast.error(err.message || "Không thể đổi mật khẩu. Vui lòng thử lại.")
    } finally {
      setUpdatingPassword(false)
    }
  }

  const breadcrumbs = [
    { label: "Cài đặt", href: "/settings" },
    { label: "Tài khoản" }
  ]

  return (
    <div className="p-6 flex flex-col gap-8 max-w-4xl mx-auto">
      <PageHeader
        title="Quản lý Tài khoản"
        description="Cập nhật thông tin cá nhân của bạn và thay đổi cấu hình bảo mật."
        breadcrumbs={breadcrumbs}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column - Summary Card */}
        <div className="md:col-span-1 flex flex-col gap-6">
          <DoubleBezelCard className="bg-background/40">
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <div className="h-20 w-20 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-4">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : "?"}
              </div>
              <h4 className="text-lg font-bold text-foreground truncate max-w-full">
                {user?.displayName || "Đang tải..."}
              </h4>
              <p className="text-sm text-muted-foreground truncate max-w-full mb-3 flex items-center gap-1.5 justify-center">
                <Mail className="size-3.5" />
                {user?.email}
              </p>
              
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                <Link to="/settings/subscription" title="Nâng cấp gói cước" className="inline-flex">
                  <TierBadge tier={user?.tier || "Free"} />
                </Link>
                {user?.roles?.includes("Admin") && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                    <ShieldAlert className="size-3" />
                    Admin
                  </span>
                )}
              </div>
            </div>
          </DoubleBezelCard>
        </div>

        {/* Right Column - Forms */}
        <div className="md:col-span-2 flex flex-col gap-8">
          {/* Profile Form Card */}
          <DoubleBezelCard className="bg-background">
            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-5">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
                  <User className="size-5 text-primary" />
                  Thông tin cá nhân
                </h3>
                <p className="text-sm text-muted-foreground">
                  Thay đổi tên hiển thị của bạn trên hệ thống SocialSence.
                </p>
              </div>

              <div className="grid gap-4 mt-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="email" className="text-xs font-mono uppercase tracking-wider">Email đăng nhập</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted/50 text-muted-foreground border-border cursor-not-allowed"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="displayName" className="text-xs font-mono uppercase tracking-wider">Tên hiển thị</Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nhập tên hiển thị của bạn..."
                    className="bg-background border-border"
                  />
                </div>
              </div>

              <div className="flex justify-end mt-2">
                <Button 
                  type="submit" 
                  disabled={updatingProfile}
                  className="bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white font-medium px-6 py-2.5 rounded-xl transition-all duration-300"
                >
                  {updatingProfile ? (
                    <>
                      <Loader2 className="animate-spin size-4 mr-2" />
                      Đang lưu...
                    </>
                  ) : (
                    "Lưu thay đổi"
                  )}
                </Button>
              </div>
            </form>
          </DoubleBezelCard>

          {/* Password Form Card */}
          <DoubleBezelCard className="bg-background">
            <form onSubmit={handleChangePassword} className="flex flex-col gap-5">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
                  <Lock className="size-5 text-primary" />
                  Đổi mật khẩu
                </h3>
                <p className="text-sm text-muted-foreground">
                  Đảm bảo tài khoản của bạn luôn an toàn bằng mật khẩu bảo mật cao.
                </p>
              </div>

              <div className="grid gap-4 mt-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="currentPassword" className="text-xs font-mono uppercase tracking-wider">Mật khẩu hiện tại</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-background border-border"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="newPassword" className="text-xs font-mono uppercase tracking-wider">Mật khẩu mới</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-background border-border"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-mono uppercase tracking-wider">Xác nhận mật khẩu mới</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-background border-border"
                  />
                </div>
              </div>

              <div className="flex justify-end mt-2">
                <Button 
                  type="submit" 
                  disabled={updatingPassword}
                  className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-white font-medium px-6 py-2.5 rounded-xl transition-all duration-300"
                >
                  {updatingPassword ? (
                    <>
                      <Loader2 className="animate-spin size-4 mr-2" />
                      Đang cập nhật...
                    </>
                  ) : (
                    "Cập nhật mật khẩu"
                  )}
                </Button>
              </div>
            </form>
          </DoubleBezelCard>
        </div>
      </div>
    </div>
  )
}
