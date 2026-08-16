import * as React from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { OTPInput } from "@workspace/ui/components/otp-input"
import { toast } from "sonner"
import { authApi } from "@/api/auth"

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [email, setEmail] = React.useState(searchParams.get("email") || "")
  const [password, setPassword] = React.useState("")
  const [otp, setOtp] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error("Vui lòng điền địa chỉ email!")
      return
    }
    if (otp.length < 6) {
      toast.error("Vui lòng nhập đủ 6 chữ số OTP!")
      return
    }
    if (!password || password.length < 8) {
      toast.error("Mật khẩu mới phải tối thiểu 8 ký tự!")
      return
    }

    setLoading(true)
    try {
      // Gọi API reset password thật của BE
      const res = await authApi.resetPassword({
        email: email.trim(),
        otpCode: otp,
        newPassword: password
      })
      toast.success(res.message || "Đặt lại mật khẩu thành công! Hãy đăng nhập lại.")
      navigate("/auth/login")
    } catch (err: any) {
      console.error("Reset password failed", err)
      toast.error(err.message || "Mã OTP không hợp lệ hoặc đặt lại mật khẩu thất bại!")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <DoubleBezelCard className="bg-background">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="text-center">
            <h2 className="font-serif text-3xl font-bold tracking-tight">Đặt lại mật khẩu</h2>
            <p className="text-sm text-muted-foreground mt-1">Nhập mã OTP 6 số và mật khẩu mới của bạn</p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Địa chỉ Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten@congty.com"
                className="p-3 border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full"
              />
            </div>

            <div className="flex flex-col gap-1.5 items-center">
              <label className="text-xs font-semibold self-start">Mã xác nhận OTP (6 chữ số)</label>
              <OTPInput length={6} onComplete={(val) => setOtp(val)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Mật khẩu mới</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                className="p-3 border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Đang xử lý..." : "Cập nhật mật khẩu"}
          </Button>
        </form>
      </DoubleBezelCard>
    </div>
  )
}
