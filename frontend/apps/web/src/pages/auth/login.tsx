import { useState } from "react"
import { useNavigate, Link, useSearchParams } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { useAuthStore } from "@/stores/auth-store"
import { toast } from "sonner"
import { authApi } from "@/api/auth"

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planParam = searchParams.get("plan")
  const setAuth = useAuthStore((state) => state.setAuth)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error("Vui lòng điền đầy đủ email và mật khẩu!")
      return
    }

    try {
      const res = await authApi.login({ email, password })
      
      setAuth({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: {
          id: res.userId,
          email: res.email,
          displayName: res.displayName,
          hasContext: res.hasContext,
          tier: "Free",
          dailyQuotaLimit: 5,
          remainingQuota: 5,
          isUnlimited: false,
          roles: ["User"]
        }
      })

      // Fetch profile chi tiết từ BE
      const userProfile = await authApi.getMe()
      useAuthStore.getState().setUser(userProfile)

      // Fetch quota thực tế
      try {
        const quotaInfo = await authApi.getQuota()
        useAuthStore.getState().setQuota(quotaInfo)
      } catch (qErr) {
        console.error("Failed to load quota during login", qErr)
      }

      toast.success("Đăng nhập thành công!")
      if (planParam && (planParam === "Pro" || planParam === "Ultra" || planParam === "Enterprise")) {
        navigate(`/settings/subscription?plan=${planParam}`)
      } else {
        navigate("/dashboard")
      }
    } catch (error: any) {
      console.error("Login failed", error)
      const errorMsg = error.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại email/mật khẩu!"
      toast.error(errorMsg)
    }
  }

  return (
    <div className="w-full max-w-md">
      <DoubleBezelCard className="bg-background">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="text-center">
            <h2 className="font-serif text-3xl font-bold tracking-tight">Chào mừng quay lại</h2>
            <p className="text-sm text-muted-foreground mt-1">Đăng nhập vào SocialSence Workspace</p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Địa chỉ Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten@congty.com"
                className="p-3 border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold">Mật khẩu</label>
                <Link to="/auth/forgot-password" className="text-xs text-muted-foreground hover:underline">Quên mật khẩu?</Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="p-3 border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <Button type="submit" className="w-full">Đăng nhập</Button>

          <div className="text-center text-xs text-muted-foreground mt-2">
            Chưa có tài khoản?{" "}
            <Link to="/auth/register" className="text-primary font-semibold hover:underline">Đăng ký ngay</Link>
          </div>
        </form>
      </DoubleBezelCard>
    </div>
  )
}
