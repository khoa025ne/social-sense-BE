import { useState } from "react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { Button } from "@workspace/ui/components/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { toast } from "sonner"
import { knowledgeApi } from "@/api/knowledge"
import { useAuthStore } from "@/stores/auth-store"
import { FileUp, Link2, FileText, Loader2, ShieldAlert } from "lucide-react"
import { Navigate } from "react-router-dom"

export default function KnowledgePage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState("file")
  const [loading, setLoading] = useState(false)

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Manual Input State
  const [manualTitle, setManualTitle] = useState("")
  const [manualContent, setManualContent] = useState("")

  // Web Scrape State
  const [scrapeUrl, setScrapeUrl] = useState("")

  // Phân quyền bảo vệ cục bộ (chỉ Admin mới được thao tác)
  const isAdmin = user?.roles?.includes("Admin")
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  // Handle File Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Kích thước file không được vượt quá 10MB!")
        return
      }
      setSelectedFile(file)
    }
  }

  // Handle File Upload Submit
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      toast.error("Vui lòng chọn file cần tải lên!")
      return
    }

    setLoading(true)
    try {
      const res = await knowledgeApi.uploadFile(selectedFile)
      toast.success(res.message || "Tải lên tài liệu và học tri thức thành công!")
      setSelectedFile(null)
      // Reset input
      const fileInput = document.getElementById("file-upload") as HTMLInputElement
      if (fileInput) fileInput.value = ""
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Không thể tải lên file tri thức. File có thể đã tồn tại hoặc định dạng không hỗ trợ!")
    } finally {
      setLoading(false)
    }
  }

  // Handle Manual Ingest Submit
  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualTitle.trim() || !manualContent.trim()) {
      toast.error("Vui lòng điền đầy đủ tiêu đề và nội dung tri thức!")
      return
    }

    setLoading(true)
    try {
      const res = await knowledgeApi.ingestManual({
        title: manualTitle,
        rawContent: manualContent
      })
      toast.success(res.message || "Đã lưu trữ và học tri thức thủ công thành công!")
      setManualTitle("")
      setManualContent("")
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Không thể nạp tri thức thủ công!")
    } finally {
      setLoading(false)
    }
  }

  // Handle Web Scrape Submit
  const handleWebScrape = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scrapeUrl.trim()) {
      toast.error("Vui lòng nhập URL cần cào dữ liệu!")
      return
    }

    // Kiểm tra định dạng URL cơ bản
    try {
      new URL(scrapeUrl)
    } catch {
      toast.error("Định dạng URL không hợp lệ!")
      return
    }

    setLoading(true)
    try {
      const res = await knowledgeApi.scrape(scrapeUrl)
      toast.success(res.message || "Đã cào dữ liệu và nạp tri thức từ website thành công!")
      setScrapeUrl("")
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Không thể nạp tri thức từ website. Tên miền có thể không nằm trong whitelist!")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 flex flex-col gap-8 max-w-4xl mx-auto">
      <PageHeader
        title="Kho Tri thức Thương hiệu"
        description="Huấn luyện AI hiểu sâu về sản phẩm, dịch vụ và phong cách hành văn của doanh nghiệp bạn (Chỉ dành cho Quản trị viên)."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/20 border h-11 p-1 rounded-xl">
          <TabsTrigger value="file" className="rounded-lg gap-2 text-xs md:text-sm font-semibold">
            <FileUp className="size-4" /> Tải lên tài liệu
          </TabsTrigger>
          <TabsTrigger value="manual" className="rounded-lg gap-2 text-xs md:text-sm font-semibold">
            <FileText className="size-4" /> Nhập thủ công
          </TabsTrigger>
          <TabsTrigger value="scrape" className="rounded-lg gap-2 text-xs md:text-sm font-semibold">
            <Link2 className="size-4" /> Cào trang web
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Upload File */}
        <TabsContent value="file" className="mt-6">
          <DoubleBezelCard className="bg-background p-6">
            <form onSubmit={handleFileUpload} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h3 className="font-serif text-lg font-bold">Tải lên tài liệu huấn luyện</h3>
                <p className="text-xs text-muted-foreground">
                  Hệ thống hỗ trợ các định dạng file văn bản: <strong>.pdf, .docx, .txt, .md</strong> (Kích thước tối đa 10MB).
                </p>
              </div>

              <div className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center bg-muted/5 hover:bg-muted/10 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <FileUp className="size-10 text-muted-foreground mb-4 animate-pulse" />
                <span className="text-sm font-semibold">
                  {selectedFile ? selectedFile.name : "Kéo thả file vào đây hoặc bấm để chọn"}
                </span>
                {selectedFile && (
                  <span className="text-xs text-muted-foreground mt-1.5 font-mono">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="submit"
                  disabled={loading || !selectedFile}
                  className="w-full md:w-auto font-bold h-10 gap-2"
                >
                  {loading ? <Loader2 className="animate-spin size-4" /> : null}
                  {loading ? "Đang xử lý tài liệu..." : "Học tri thức từ File"}
                </Button>
              </div>
            </form>
          </DoubleBezelCard>
        </TabsContent>

        {/* Tab 2: Manual Ingest */}
        <TabsContent value="manual" className="mt-6">
          <DoubleBezelCard className="bg-background p-6">
            <form onSubmit={handleManualIngest} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h3 className="font-serif text-lg font-bold">Nạp tri thức thủ công</h3>
                <p className="text-xs text-muted-foreground">Gõ hoặc dán nội dung văn bản sản phẩm, dịch vụ để lưu vào RAG.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Tiêu đề tri thức</label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Ví dụ: Cẩm nang hướng dẫn sử dụng tính năng sinh ảnh"
                  className="p-3 border rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Nội dung tri thức</label>
                <textarea
                  value={manualContent}
                  onChange={(e) => setManualContent(e.target.value)}
                  placeholder="Nhập nội dung chi tiết của tri thức..."
                  rows={8}
                  className="p-3 border rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={loading || !manualTitle.trim() || !manualContent.trim()}
                  className="w-full md:w-auto font-bold h-10 gap-2"
                >
                  {loading ? <Loader2 className="animate-spin size-4" /> : null}
                  {loading ? "Đang học tri thức..." : "Lưu tri thức"}
                </Button>
              </div>
            </form>
          </DoubleBezelCard>
        </TabsContent>

        {/* Tab 3: Web Scrape */}
        <TabsContent value="scrape" className="mt-6">
          <DoubleBezelCard className="bg-background p-6">
            <form onSubmit={handleWebScrape} className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h3 className="font-serif text-lg font-bold">Cào dữ liệu website giới thiệu</h3>
                <p className="text-xs text-muted-foreground">
                  Nhập địa chỉ website sản phẩm của bạn. Hệ thống sẽ cào các thông tin văn bản công khai để học.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Địa chỉ URL</label>
                <div className="relative">
                  <input
                    type="text"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                    placeholder="https://socialsence.vn/ve-chung-toi"
                    className="p-3 pl-10 border rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary w-full"
                  />
                  <Link2 className="size-4 text-muted-foreground absolute left-3.5 top-3.5" />
                </div>
              </div>

              <div className="bg-muted/10 p-4 border border-dashed border-border rounded-xl flex gap-3 text-xs text-muted-foreground leading-relaxed">
                <ShieldAlert className="size-5 text-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground block mb-0.5">Lưu ý Whitelist:</span>
                  Hệ thống chỉ cho phép cào dữ liệu từ một số tên miền đã được cấu hình whitelist ở backend (ví dụ: các tên miền có đuôi `.vn`, các trang tin tức tin cậy hoặc website chính thức của dự án).
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={loading || !scrapeUrl.trim()}
                  className="w-full md:w-auto font-bold h-10 gap-2"
                >
                  {loading ? <Loader2 className="animate-spin size-4" /> : null}
                  {loading ? "Đang cào dữ liệu..." : "Bắt đầu cào & Học tri thức"}
                </Button>
              </div>
            </form>
          </DoubleBezelCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
