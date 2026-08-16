import { useState } from "react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { analyticsApi } from "@/api/analytics"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  RefreshCw, 
  ArrowLeft,
  Sparkles,
  AlertCircle
} from "lucide-react"

export default function AnalyticsUploadPage() {
  const navigate = useNavigate()
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  // Download template Excel
  const handleDownloadTemplate = async () => {
    const toastId = toast.loading("Đang tạo file biểu mẫu...")
    try {
      const blob = await analyticsApi.downloadTemplate()
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", "SocialSence_Analytics_Template.xlsx")
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      toast.success("Đã tải xuống file biểu mẫu thành công!", { id: toastId })
    } catch (err: any) {
      console.error("Failed to download template", err)
      toast.error("Không thể tải xuống file biểu mẫu!", { id: toastId })
    }
  }

  // Handle Drag Events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.name.endsWith(".xlsx")) {
        setFile(droppedFile)
      } else {
        toast.error("Chỉ hỗ trợ tệp tin định dạng Excel (.xlsx)!")
      }
    }
  }

  // Handle File Input Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      if (selectedFile.name.endsWith(".xlsx")) {
        setFile(selectedFile)
      } else {
        toast.error("Chỉ hỗ trợ tệp tin định dạng Excel (.xlsx)!")
      }
    }
  }

  // Upload and start AI analysis
  const handleAnalyze = async () => {
    if (!file) {
      toast.error("Vui lòng chọn hoặc kéo thả tệp Excel trước!")
      return
    }

    const toastId = toast.loading("AI đang phân tích số liệu của bạn...")
    try {
      setAnalyzing(true)
      const res = await analyticsApi.uploadAndCompare(file)
      toast.success("AI đã hoàn thành phân tích số liệu đối chiếu!", { id: toastId })
      // Chuyển hướng sang trang report chi tiết sử dụng ID của báo cáo vừa sinh ra
      navigate(`/analytics/report/${res.id}`)
    } catch (err: any) {
      console.error("Analytics upload & compare failed", err)
      toast.error(err.message || "Không thể phân tích dữ liệu! Vui lòng kiểm tra lại định dạng tệp Excel.", { id: toastId })
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="p-6 flex flex-col gap-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate("/analytics")}
          className="size-8 rounded border border-border flex items-center justify-center hover:bg-muted/20 transition-all active:scale-95"
          title="Quay lại danh sách"
        >
          <ArrowLeft className="size-4" />
        </button>
        <PageHeader 
          title="Tải lên số liệu" 
          description="Tải lên tệp Excel chứa dữ liệu hiệu suất của bạn để AI phân tích và đưa ra đề xuất." 
        />
      </div>

      <div className="flex flex-col gap-6">
        {/* Step 1: Download Template */}
        <DoubleBezelCard className="bg-background">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="font-serif text-base font-semibold">1. Tải file biểu mẫu chuẩn</h3>
              <p className="text-xs text-muted-foreground">
                Để AI đọc dữ liệu chính xác nhất, vui lòng sử dụng file Excel mẫu do SocialSence cung cấp.
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="h-9 px-4 rounded border border-border bg-transparent text-foreground font-mono text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:bg-muted/20 transition-all active:scale-95 shrink-0"
            >
              <Download className="size-3.5" /> Tải Biểu Mẫu
            </button>
          </div>
        </DoubleBezelCard>

        {/* Step 2: Drag and Drop Excel */}
        <DoubleBezelCard className="bg-background p-0 overflow-hidden">
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
              dragOver 
                ? "border-foreground bg-muted/25" 
                : "border-border hover:border-foreground/50 bg-transparent"
            }`}
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            <input 
              id="fileInput"
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="hidden"
              disabled={analyzing}
            />

            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="size-12 text-foreground mb-2" />
                <span className="font-serif text-sm font-semibold">{file.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground uppercase">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                <span className="text-xs text-muted-foreground mt-2 underline hover:text-foreground">
                  Nhấp để thay đổi tệp khác
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="size-10 text-muted-foreground mb-2" />
                <span className="font-serif text-sm">Kéo thả file Excel của bạn vào đây</span>
                <span className="text-xs text-muted-foreground">hoặc nhấp để chọn tệp từ máy tính</span>
                <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest mt-2">
                  Định dạng hỗ trợ: .XLSX (Tối đa 5MB)
                </span>
              </div>
            )}
          </div>
        </DoubleBezelCard>

        {/* Action Button */}
        {file && (
          <div className="flex flex-col gap-4">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full h-11 rounded bg-foreground text-background font-mono text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:bg-foreground/90 transition-all active:scale-95 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="size-4 animate-spin" /> AI đang tính toán & phân tích...
                </>
              ) : (
                <>
                  Bắt đầu phân tích AI <Sparkles className="size-4" />
                </>
              )}
            </button>

            <div className="flex items-start gap-2 text-[11px] text-muted-foreground italic bg-muted/20 p-3 rounded border border-border/40 font-mono">
              <AlertCircle className="size-3.5 shrink-0 text-foreground mt-0.5" />
              <span>
                Lưu ý: Quá trình phân tích so sánh AI sẽ tiêu tốn <strong>1 lượt quota tạo nội dung</strong> trong hạn ngạch hàng ngày của tài khoản.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
