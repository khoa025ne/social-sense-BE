import { useState } from "react"
import { useNavigate, Link, useSearchParams } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { useAuthStore } from "@/stores/auth-store"
import { toast } from "sonner"
import { authApi } from "@/api/auth"

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planParam = searchParams.get("plan")
  const setAuth = useAuthStore((state) => state.setAuth)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !name) {
      toast.error("Vui lòng điền đầy đủ thông tin!")
      return
    }

    try {
      // 1. Đăng ký trên Backend
      await authApi.register({ email, password, displayName: name })
      toast.success("Đăng ký tài khoản thành công! Đang tự động đăng nhập...")

      // 2. Tự động đăng nhập
      try {
        const loginRes = await authApi.login({ email, password })
        
        setAuth({
          accessToken: loginRes.accessToken,
          refreshToken: loginRes.refreshToken,
          user: {
            id: loginRes.userId,
            email: loginRes.email,
            displayName: loginRes.displayName,
            hasContext: loginRes.hasContext,
            tier: "Free",
            dailyQuotaLimit: 5,
            remainingQuota: 5,
            isUnlimited: false,
            roles: ["User"]
          }
        })

        // Lấy thông tin user đầy đủ
        const userProfile = await authApi.getMe()
        useAuthStore.getState().setUser(userProfile)

        // Lấy quota thực
        try {
          const quotaInfo = await authApi.getQuota()
          useAuthStore.getState().setQuota(quotaInfo)
        } catch (qErr) {
          console.error("Failed to load quota after auto-login", qErr)
        }

        if (planParam && (planParam === "Pro" || planParam === "Ultra" || planParam === "Enterprise")) {
          navigate(`/settings/subscription?plan=${planParam}`)
        } else {
          navigate("/onboarding")
        }
      } catch (loginErr) {
        console.error("Auto-login failed after register", loginErr)
        toast.info("Đăng ký thành công! Vui lòng đăng nhập lại thủ công.")
        navigate(planParam ? `/auth/login?plan=${planParam}` : "/auth/login")
      }
    } catch (error: any) {
      console.error("Registration failed", error)
      const errorMsg = error.message || "Đăng ký thất bại. Email có thể đã tồn tại!"
      toast.error(errorMsg)
    }
  }

  return (
    <div className="w-full max-w-md">
      <DoubleBezelCard className="bg-background">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="text-center">
            <h2 className="font-serif text-3xl font-bold tracking-tight">Tạo tài khoản</h2>
            <p className="text-sm text-muted-foreground mt-1">Khám phá sức mạnh AI sáng tạo cùng SocialSence</p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Tên của bạn</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="p-3 border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

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
              <label className="text-xs font-semibold">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                className="p-3 border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <Button type="submit" className="w-full">Đăng ký tài khoản</Button>

          <div className="text-center text-xs text-muted-foreground mt-2">
            Đã có tài khoản?{" "}
            <Link to="/auth/login" className="text-primary font-semibold hover:underline">Đăng nhập</Link>
          </div>
        </form>
      </DoubleBezelCard>
    </div>
  )
}
