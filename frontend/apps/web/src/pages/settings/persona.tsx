import { useState, useEffect } from "react"
import { contextApi, type Persona } from "@/api/context"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { toast } from "sonner"
import { Loader2, Sparkles, Plus, X, Globe, User, MessageSquare, ListFilter, ShieldAlert } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

// Định nghĩa danh sách nền tảng để người dùng chọn
const AVAILABLE_PLATFORMS = [
  { id: "Facebook", name: "Facebook" },
  { id: "TikTok", name: "TikTok" },
  { id: "LinkedIn", name: "LinkedIn" },
  { id: "Instagram", name: "Instagram" },
  { id: "Threads", name: "Threads" },
]

// Các tông giọng mẫu
const SUGGESTED_TONES = [
  "Chuyên nghiệp & Tin cậy",
  "Thân thiện & Gần gũi",
  "Hài hước & Dí dỏm",
  "Trực diện & Thực tế",
  "Chuyên sâu & Học thuật",
  "Kể chuyện & Truyền cảm hứng",
]

export default function PersonaPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form States
  const [jobTitle, setJobTitle] = useState("")
  const [language, setLanguage] = useState("vi")
  const [toneOfVoice, setToneOfVoice] = useState("")
  const [platformPreferences, setPlatformPreferences] = useState<string[]>([])
  
  // Tag input states
  const [targetAudience, setTargetAudience] = useState<string[]>([])
  const [newAudience, setNewAudience] = useState("")

  const [contentFormats, setContentFormats] = useState<string[]>([])
  const [newFormat, setNewFormat] = useState("")

  const [negativeConstraints, setNegativeConstraints] = useState<string[]>([])
  const [newConstraint, setNewConstraint] = useState("")

  // Fetch Persona Data
  useEffect(() => {
    const fetchPersona = async () => {
      try {
        setLoading(true)
        const data = await contextApi.getPersona()
        if (data) {
          setJobTitle(data.jobTitle || "")
          setLanguage(data.language || "vi")
          setToneOfVoice(data.toneOfVoice || "")
          setPlatformPreferences(data.platformPreferences || [])
          setTargetAudience(data.targetAudience || [])
          setContentFormats(data.contentFormats || [])
          setNegativeConstraints(data.negativeConstraints || [])
        }
      } catch (err: any) {
        console.error("Failed to fetch persona context", err)
        // Nếu chưa có onboarding trước đó, API có thể lỗi 404 hoặc trống, ta tự khởi tạo rỗng
        toast.info("Vui lòng thiết lập cấu hình Persona của bạn lần đầu tiên.")
      } finally {
        setLoading(false)
      }
    }
    fetchPersona()
  }, [])

  // Xử lý thêm Tag
  const handleAddTag = (
    value: string, 
    setValue: (val: string) => void, 
    tags: string[], 
    setTags: (tags: string[]) => void
  ) => {
    const trimmed = value.trim()
    if (!trimmed) return
    if (tags.includes(trimmed)) {
      toast.warning("Tag này đã tồn tại.")
      return
    }
    setTags([...tags, trimmed])
    setValue("")
  }

  // Xử lý xóa Tag
  const handleRemoveTag = (tagToRemove: string, tags: string[], setTags: (tags: string[]) => void) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  // Xử lý chọn/bỏ chọn nền tảng
  const togglePlatform = (platformId: string) => {
    if (platformPreferences.includes(platformId)) {
      setPlatformPreferences(platformPreferences.filter(p => p !== platformId))
    } else {
      setPlatformPreferences([...platformPreferences, platformId])
    }
  }

  // Submit form cập nhật
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!jobTitle.trim()) {
      toast.error("Vui lòng điền vai trò/ngành nghề kinh doanh.")
      return
    }
    if (!toneOfVoice.trim()) {
      toast.error("Vui lòng điền tông giọng thương hiệu.")
      return
    }
    if (platformPreferences.length === 0) {
      toast.error("Vui lòng chọn ít nhất một nền tảng ưu tiên.")
      return
    }

    try {
      setSaving(true)
      await contextApi.updatePersona({
        jobTitle,
        toneOfVoice,
        platformPreferences,
        targetAudience,
        contentFormats,
        negativeConstraints
      })
      toast.success("Cấu hình tệp người xem hướng tới đã được cập nhật thành công!")
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi cập nhật Persona.")
    } finally {
      setSaving(false)
    }
  }

  const breadcrumbs = [
    { label: "Cài đặt", href: "/settings" },
    { label: "Tệp người xem hướng tới" }
  ]

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-8 max-w-4xl mx-auto items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-primary size-10" />
        <span className="text-sm text-muted-foreground">Đang tải cấu hình Persona...</span>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-8 max-w-4xl mx-auto">
      <PageHeader
        title="Tệp người xem hướng tới"
        description="Định hình cá tính, tông giọng và định hướng khán giả của bạn để AI tự động tối ưu hóa nội dung tiếp thị."
        breadcrumbs={breadcrumbs}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        {/* Core Profile */}
        <DoubleBezelCard className="bg-background">
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
                <User className="size-5 text-primary" />
                Thông tin Cơ bản & Ngôn ngữ
              </h3>
              <p className="text-sm text-muted-foreground">
                Mô tả sơ qua vai trò công việc và ngôn ngữ AI cần sử dụng để tạo nội dung.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 grid gap-1.5">
                <Label htmlFor="jobTitle" className="text-xs font-mono uppercase tracking-wider">
                  Nghề nghiệp / Lĩnh vực hoạt động
                </Label>
                <Input
                  id="jobTitle"
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Ví dụ: Beauty Blogger, Chuyên gia Bất động sản, Tech Startup Founder..."
                  className="bg-background border-border"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="language" className="text-xs font-mono uppercase tracking-wider">
                  Ngôn ngữ ưu tiên
                </Label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled // Hiện tại BE lưu cố định hoặc qua onboarding
                  className="h-10 rounded-md border border-input bg-background/50 text-muted-foreground px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-not-allowed"
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">Tiếng Anh</option>
                </select>
              </div>
            </div>
          </div>
        </DoubleBezelCard>

        {/* Tone & Platforms */}
        <DoubleBezelCard className="bg-background">
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
                <MessageSquare className="size-5 text-primary" />
                Giọng điệu & Kênh phát hành
              </h3>
              <p className="text-sm text-muted-foreground">
                Cách AI giao tiếp và các mạng xã hội bạn tập trung xuất bản nội dung.
              </p>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="toneOfVoice" className="text-xs font-mono uppercase tracking-wider">
                  Giọng điệu & Phong cách truyền thông
                </Label>
                <Input
                  id="toneOfVoice"
                  type="text"
                  value={toneOfVoice}
                  onChange={(e) => setToneOfVoice(e.target.value)}
                  placeholder="Mô tả phong cách truyền thông hoặc chọn gợi ý bên dưới..."
                  className="bg-background border-border"
                />
                
                <div className="flex flex-wrap gap-2 mt-1">
                  {SUGGESTED_TONES.map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setToneOfVoice(tone)}
                      className={`px-3 py-1 rounded-full text-xs border transition-all duration-200 ${
                        toneOfVoice === tone
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/30 text-muted-foreground hover:bg-muted/70 border-border"
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 mt-2">
                <Label className="text-xs font-mono uppercase tracking-wider">Nền tảng mạng xã hội ưu tiên</Label>
                <div className="flex flex-wrap gap-3">
                  {AVAILABLE_PLATFORMS.map((platform) => {
                    const isSelected = platformPreferences.includes(platform.id)
                    return (
                      <button
                        key={platform.id}
                        type="button"
                        onClick={() => togglePlatform(platform.id)}
                        className={`flex items-center justify-center px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-300 ${
                          isSelected
                            ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 border-transparent shadow-sm"
                            : "bg-background text-foreground border-border hover:bg-muted/50"
                        }`}
                      >
                        {platform.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </DoubleBezelCard>

        {/* Dynamic Tag Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Target Audience */}
          <DoubleBezelCard className="bg-background">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold mb-0.5">Khán giả mục tiêu</h3>
                <p className="text-xs text-muted-foreground">Những nhóm khách hàng bạn muốn tiếp cận chính.</p>
              </div>

              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newAudience}
                  onChange={(e) => setNewAudience(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddTag(newAudience, setNewAudience, targetAudience, setTargetAudience)
                    }
                  }}
                  placeholder="Thêm nhóm đối tượng..."
                  className="bg-background border-border h-9 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleAddTag(newAudience, setNewAudience, targetAudience, setTargetAudience)}
                  className="h-9 w-9 p-0 bg-secondary hover:bg-secondary/80 border border-border"
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 mt-1 min-h-[40px]">
                <AnimatePresence>
                  {targetAudience.map((tag) => (
                    <motion.span
                      key={tag}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted/60 text-foreground text-xs border border-border"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag, targetAudience, setTargetAudience)}
                        className="hover:text-red-500 text-muted-foreground/80 focus:outline-none"
                      >
                        <X className="size-3" />
                      </button>
                    </motion.span>
                  ))}
                  {targetAudience.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">Chưa cấu hình khán giả mục tiêu.</span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </DoubleBezelCard>

          {/* Content Formats */}
          <DoubleBezelCard className="bg-background">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold mb-0.5">Định dạng nội dung</h3>
                <p className="text-xs text-muted-foreground">Các định dạng bài viết yêu thích của bạn.</p>
              </div>

              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newFormat}
                  onChange={(e) => setNewFormat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddTag(newFormat, setNewFormat, contentFormats, setContentFormats)
                    }
                  }}
                  placeholder="Thêm định dạng..."
                  className="bg-background border-border h-9 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleAddTag(newFormat, setNewFormat, contentFormats, setContentFormats)}
                  className="h-9 w-9 p-0 bg-secondary hover:bg-secondary/80 border border-border"
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 mt-1 min-h-[40px]">
                <AnimatePresence>
                  {contentFormats.map((tag) => (
                    <motion.span
                      key={tag}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted/60 text-foreground text-xs border border-border"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag, contentFormats, setContentFormats)}
                        className="hover:text-red-500 text-muted-foreground/80 focus:outline-none"
                      >
                        <X className="size-3" />
                      </button>
                    </motion.span>
                  ))}
                  {contentFormats.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">Chưa cấu hình định dạng nội dung.</span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </DoubleBezelCard>
        </div>

        {/* Negative Constraints */}
        <DoubleBezelCard className="bg-background border-red-500/10 dark:border-red-500/25">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-1.5 text-red-500 mb-0.5">
                <ShieldAlert className="size-4" />
                Chủ đề & Từ ngữ cần tránh
              </h3>
              <p className="text-xs text-muted-foreground">Những quy định, từ ngữ hoặc hành vi AI tuyệt đối tránh sử dụng.</p>
            </div>

            <div className="flex gap-2">
              <Input
                type="text"
                value={newConstraint}
                onChange={(e) => setNewConstraint(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddTag(newConstraint, setNewConstraint, negativeConstraints, setNegativeConstraints)
                  }
                }}
                placeholder="Ví dụ: Giật gân clickbait, Quảng cáo trực diện, Tránh so sánh giá..."
                className="bg-background border-border h-9 text-sm"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => handleAddTag(newConstraint, setNewConstraint, negativeConstraints, setNegativeConstraints)}
                className="h-9 w-9 p-0 bg-secondary hover:bg-secondary/80 border border-border"
              >
                <Plus className="size-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 mt-1 min-h-[40px]">
              <AnimatePresence>
                {negativeConstraints.map((tag) => (
                  <motion.span
                    key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/5 text-red-500 dark:text-red-400 text-xs border border-red-500/20"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag, negativeConstraints, setNegativeConstraints)}
                      className="hover:text-red-600 focus:outline-none"
                    >
                      <X className="size-3" />
                    </button>
                  </motion.span>
                ))}
                {negativeConstraints.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">Chưa cấu hình ràng buộc tránh.</span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </DoubleBezelCard>

        {/* Submit Bar */}
        <div className="flex justify-end items-center gap-4 mt-2">
          <Button
            type="submit"
            disabled={saving}
            className="w-full md:w-auto bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white font-medium px-8 py-3 rounded-xl transition-all duration-300 shadow-md shadow-violet-500/10 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin size-4" />
                Đang cập nhật...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Cập nhật Persona
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
