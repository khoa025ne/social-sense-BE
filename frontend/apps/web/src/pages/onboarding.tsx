import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { useAuthStore } from "@/stores/auth-store"
import { toast } from "sonner"
import { contextApi } from "@/api/context"
import { authApi } from "@/api/auth"

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { setAuth, accessToken, refreshToken } = useAuthStore()
  const [step, setStep] = useState(1)
  const [jobTitle, setJobTitle] = useState("")
  const [businessDesc, setBusinessDesc] = useState("")
  const [targetAudience, setTargetAudience] = useState("")

  const handleNext = async () => {
    if (step === 1 && !jobTitle) {
      toast.error("Vui lòng điền vai trò của bạn!")
      return
    }
    if (step === 2 && !businessDesc) {
      toast.error("Vui lòng mô tả sản phẩm của bạn!")
      return
    }

    if (step < 3) {
      setStep(prev => prev + 1)
    } else {
      if (!targetAudience) {
        toast.error("Vui lòng mô tả khách hàng mục tiêu!")
        return
      }

      try {
        // Gọi API onboarding thật của BE
        await contextApi.onboarding({
          language: "vi",
          answers: [jobTitle, businessDesc, targetAudience]
        })

        // Fetch lại thông tin profile để đồng bộ hasContext = true
        const userProfile = await authApi.getMe()
        useAuthStore.getState().setUser(userProfile)

        toast.success("Khởi tạo tệp người xem hướng tới thành công!")
        navigate("/dashboard")
      } catch (err: any) {
        console.error("Onboarding failed", err)
        toast.error(err.message || "Không thể lưu thông tin tệp người xem hướng tới. Vui lòng thử lại!")
      }
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <div className="flex justify-between items-center text-xs font-mono text-muted-foreground">
          <span>SOCIALSENCE ONBOARDING</span>
          <span>BƯỚC {step} / 3</span>
        </div>

        {/* Progress Bar */}
        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <DoubleBezelCard className="bg-background p-8">
          {step === 1 && (
            <div className="flex flex-col gap-6 animate-fade-up">
              <h2 className="font-serif text-3xl font-bold tracking-tight">Vai trò chính của bạn là gì?</h2>
              <p className="text-sm text-muted-foreground">Điều này giúp AI chọn đúng giọng văn chuyên môn phù hợp với vị trí của bạn.</p>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Ví dụ: Content Creator, Marketing Manager, Shop Owner..."
                className="p-3 border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-6 animate-fade-up">
              <h2 className="font-serif text-3xl font-bold tracking-tight">Bạn đang kinh doanh sản phẩm hoặc dịch vụ gì?</h2>
              <p className="text-sm text-muted-foreground">Mô tả ngắn gọn để AI huấn luyện tri thức cơ bản về sản phẩm.</p>
              <textarea
                value={businessDesc}
                onChange={(e) => setBusinessDesc(e.target.value)}
                placeholder="Ví dụ: Cửa hàng thời trang nam phong cách thanh lịch tối giản, chất liệu cotton organic..."
                className="min-h-24 p-3 border rounded-xl bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-6 animate-fade-up">
              <h2 className="font-serif text-3xl font-bold tracking-tight">Khách hàng mục tiêu của bạn là ai?</h2>
              <p className="text-sm text-muted-foreground">Chỉ ra phân khúc đối tượng mà bạn muốn nội dung AI nhắm đến.</p>
              <textarea
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Ví dụ: Nam giới độ tuổi 22-35, công sở, thích phong cách đơn giản lịch thiệp, thu nhập khá..."
                className="min-h-24 p-3 border rounded-xl bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div className="mt-8 flex justify-between gap-4">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(prev => prev - 1)}>Quay lại</Button>
            ) : (
              <div />
            )}
            <Button onClick={handleNext}>{step === 3 ? "Hoàn tất thiết lập ✓" : "Tiếp theo →"}</Button>
          </div>
        </DoubleBezelCard>
      </div>
    </div>
  )
}
