import * as React from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { toast } from "sonner"
import { authApi } from "@/api/auth"

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error("Vui lòng nhập email!")
      return
    }

    setLoading(true)
    try {
      // Gọi API yêu cầu gửi OTP khôi phục mật khẩu
      const res = await authApi.forgotPassword(email)
      toast.success(res.message || "Mã OTP khôi phục mật khẩu đã được gửi đến email của bạn!")
      navigate(`/auth/reset-password?email=${encodeURIComponent(email)}`)
    } catch (err: any) {
      console.error("Forgot password request failed", err)
      toast.error(err.message || "Không thể yêu cầu đặt lại mật khẩu. Vui lòng thử lại!")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <DoubleBezelCard className="bg-background">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="text-center">
            <h2 className="font-serif text-3xl font-bold tracking-tight">Quên mật khẩu?</h2>
            <p className="text-sm text-muted-foreground mt-1">Nhập email của bạn để nhận mã OTP đặt lại mật khẩu</p>
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
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Đang gửi..." : "Gửi mã OTP"}
          </Button>

          <div className="text-center text-xs text-muted-foreground mt-2">
            Quay lại{" "}
            <Link to="/auth/login" className="text-primary font-semibold hover:underline">Đăng nhập</Link>
          </div>
        </form>
      </DoubleBezelCard>
    </div>
  )
}
