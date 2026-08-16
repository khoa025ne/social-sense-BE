import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { contentApi, type ContentHistoryItem, type ContentItem } from "@/api/content"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@workspace/ui/components/tabs"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@workspace/ui/components/dialog"
import { Textarea } from "@workspace/ui/components/textarea"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useNavigate } from "react-router-dom"
import { 
  History, 
  Copy, 
  Edit3, 
  Sparkles, 
  Calendar, 
  Clock, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileEdit,
  Eye
} from "lucide-react"

export default function ContentHistoryPage() {
  const navigate = useNavigate()
  const [historyItems, setHistoryItems] = useState<ContentHistoryItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)

  // Edit Form State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ContentHistoryItem | null>(null)
  const [editingPlatformIndex, setEditingPlatformIndex] = useState(0)
  const [editBody, setEditBody] = useState("")
  const [editHook, setEditHook] = useState("")
  const [editCta, setEditCta] = useState("")
  const [editHashtags, setEditHashtags] = useState("")
  const [submittingEdit, setSubmittingEdit] = useState(false)

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      const res = await contentApi.getHistory(currentPage, pageSize)
      setHistoryItems(res.items)
      setTotalCount(res.totalCount)
    } catch (err: any) {
      console.error("Failed to fetch content history", err)
      toast.error(err.message || "Không thể tải lịch sử bài viết!")
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Copy Content
  const handleCopyContent = (content: ContentItem) => {
    const formattedText = `${content.hook ? content.hook + '\n\n' : ''}${content.body}${content.cta ? '\n\n' : ''}${content.cta ? content.cta : ''}${content.hashtags?.length ? '\n\n' + content.hashtags.map(t => `#${t.replace('#', '')}`).join(' ') : ''}`
    
    navigator.clipboard.writeText(formattedText)
    toast.success(`Đã sao chép nội dung bài viết (${content.platform})!`)
  }

  // Open Edit Dialog
  const handleOpenEdit = (item: ContentHistoryItem, platformIndex: number) => {
    const content = (item.userEditedContent || item.generatedContent)[platformIndex]
    if (!content) return
    
    setEditingItem(item)
    setEditingPlatformIndex(platformIndex)
    setEditBody(content.body || "")
    setEditHook(content.hook || "")
    setEditCta(content.cta || "")
    setEditHashtags(content.hashtags?.join(", ") || "")
    setIsEditDialogOpen(true)
  }

  // Submit Edit Content
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return

    try {
      setSubmittingEdit(true)
      const hashtagsArray = editHashtags
        .split(",")
        .map(tag => tag.trim().replace("#", ""))
        .filter(tag => tag.length > 0)

      await contentApi.editHistory(editingItem.id, {
        body: editBody,
        hook: editHook || undefined,
        cta: editCta || undefined,
        hashtags: hashtagsArray.length ? hashtagsArray : undefined
      })

      toast.success("Đã cập nhật bài viết thành công!")
      setIsEditDialogOpen(false)
      fetchHistory()
    } catch (err: any) {
      toast.error(err.message || "Không thể cập nhật bài viết!")
    } finally {
      setSubmittingEdit(false)
    }
  }

  // Go to Image Gen Page with Prompt
  const handleGenerateImage = (prompt: string | null, historyId?: number) => {
    if (!prompt) {
      toast.error("Không tìm thấy mô tả ảnh của bài viết này!")
      return
    }
    navigate("/content/image-wizard", { state: { prompt, contentHistoryId: historyId } })
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="p-6 flex flex-col gap-8 max-w-4xl mx-auto">
      <PageHeader 
        title="Lịch sử Bài viết" 
        description="Quản lý, sao chép và tinh chỉnh các bài viết đã được tạo trước đây bởi hệ thống SocialSence." 
      />

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center font-mono text-xs text-muted-foreground gap-3">
          <RefreshCw className="size-6 animate-spin text-muted-foreground" />
          <span>Đang tải lịch sử bài viết...</span>
        </div>
      ) : historyItems.length === 0 ? (
        <DoubleBezelCard className="bg-background flex flex-col items-center justify-center py-16 text-center border-dashed">
          <History className="size-10 text-muted-foreground/30 mb-4" />
          <h4 className="font-serif text-lg mb-1">Chưa có bài viết nào</h4>
          <p className="text-xs text-muted-foreground max-w-sm mb-6">
            Hãy bắt đầu tạo những nội dung đột phá đầu tiên bằng AI của bạn.
          </p>
          <button 
            onClick={() => navigate("/content/generate")}
            className="px-4 py-2 border border-border rounded bg-foreground text-background font-mono text-xs uppercase tracking-wider hover:bg-foreground/90 transition-all active:scale-95"
          >
            Tạo bài viết ngay
          </button>
        </DoubleBezelCard>
      ) : (
        <div className="flex flex-col gap-6">
          {historyItems.map((item) => {
            const hasEdited = item.isEdited
            const contents = item.userEditedContent || item.generatedContent
            const originalContents = item.generatedContent

            return (
              <DoubleBezelCard key={item.id} className="bg-background">
                <div className="flex flex-col gap-4">
                  {/* Header info */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-dashed border-border/80">
                    <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
                      <Calendar className="size-3.5" />
                      <span>{new Date(item.createdAt).toLocaleDateString("vi-VN")}</span>
                      <span>{new Date(item.createdAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}</span>
                      {hasEdited && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase font-bold text-foreground inline-flex items-center gap-0.5">
                          <FileEdit className="size-2.5" /> Đã chỉnh sửa
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">ID: #{item.id}</span>
                  </div>

                  {/* Platform tabs */}
                  <Tabs defaultValue={contents[0]?.platform} className="w-full">
                    <div className="flex justify-between items-center mb-3">
                      <TabsList className="bg-muted/30 border border-border/60 p-0.5 rounded">
                        {contents.map((c, idx) => (
                          <TabsTrigger 
                            key={idx} 
                            value={c.platform}
                            className="font-mono text-xs uppercase px-3 py-1 rounded"
                          >
                            {c.platform}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>

                    {contents.map((c, idx) => {
                      const isOriginalEmpty = !originalContents[idx]
                      const originalC = originalContents[idx]
                      
                      return (
                        <TabsContent key={idx} value={c.platform} className="mt-0">
                          <div className="flex flex-col gap-4">
                            {/* Hook */}
                            {c.hook && (
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-mono text-muted-foreground uppercase">Phần mở đầu (Hook)</span>
                                <p className="text-xs font-semibold text-foreground italic border-l-2 border-foreground pl-3 py-0.5">
                                  {c.hook}
                                </p>
                              </div>
                            )}

                            {/* Body */}
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-mono text-muted-foreground uppercase">Nội dung bài viết (Body)</span>
                              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed bg-muted/10 p-3 rounded border border-border/40 font-serif">
                                {c.body}
                              </p>
                            </div>

                            {/* CTA & Hashtags */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {c.cta && (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Kêu gọi hành động (CTA)</span>
                                  <p className="text-xs text-foreground font-semibold font-mono bg-muted/20 px-2.5 py-1.5 rounded">
                                    {c.cta}
                                  </p>
                                </div>
                              )}
                              
                              {c.hashtags?.length > 0 && (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Hashtags</span>
                                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                                    {c.hashtags.map((tag, tIdx) => (
                                      <span key={tIdx} className="text-xs font-mono text-muted-foreground">
                                        #{tag.replace("#", "")}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Details footer (time to post, images, etc.) */}
                            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-dashed border-border/50">
                              <div className="flex items-center gap-1 text-muted-foreground font-mono text-[10px] uppercase">
                                <Clock className="size-3" />
                                <span>Giờ vàng đăng bài: <strong>{c.bestTimeToPost || "---"}</strong></span>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCopyContent(c)}
                                  className="h-8 px-2.5 rounded border border-border bg-transparent text-foreground hover:bg-muted/20 font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1 transition-all active:scale-95"
                                  title="Sao chép toàn bộ bài viết này"
                                >
                                  <Copy className="size-3" /> Sao chép
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(item, idx)}
                                  className="h-8 px-2.5 rounded border border-border bg-transparent text-foreground hover:bg-muted/20 font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1 transition-all active:scale-95"
                                  title="Chỉnh sửa nội dung này"
                                >
                                  <Edit3 className="size-3" /> Sửa
                                </button>
                                {c.bannerImagePrompt && (
                                  <button
                                    onClick={() => handleGenerateImage(c.bannerImagePrompt, item.id)}
                                    className="h-8 px-2.5 rounded bg-foreground text-background hover:bg-foreground/90 font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1 transition-all active:scale-95"
                                    title="Tạo hình ảnh minh họa bằng AI từ mô tả gợi ý"
                                  >
                                    <Sparkles className="size-3" /> Tạo ảnh AI
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      )
                    })}
                  </Tabs>
                </div>
              </DoubleBezelCard>
            )
          })}

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-dashed border-border">
              <span className="font-mono text-xs text-muted-foreground">
                Trang {currentPage} / {totalPages} (Tổng {totalCount} bản ghi)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="size-8 rounded border border-border flex items-center justify-center hover:bg-muted/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="size-8 rounded border border-border flex items-center justify-center hover:bg-muted/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] border border-border bg-background">
          <form onSubmit={handleSubmitEdit}>
            <DialogHeader>
              <DialogTitle className="font-serif text-lg">Chỉnh sửa bài viết</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Tinh chỉnh nội dung bài viết trước khi đăng tải lên mạng xã hội. Thay đổi này sẽ được lưu lại lịch sử.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="editHook" className="text-xs font-mono uppercase text-muted-foreground">Phần mở đầu (Hook - Tùy chọn)</Label>
                <Input 
                  id="editHook"
                  value={editHook}
                  onChange={(e) => setEditHook(e.target.value)}
                  placeholder="Gây ấn tượng từ câu đầu tiên..."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="editBody" className="text-xs font-mono uppercase text-muted-foreground">Nội dung chính (Body)</Label>
                <Textarea 
                  id="editBody"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={8}
                  placeholder="Nội dung bài viết..."
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="editCta" className="text-xs font-mono uppercase text-muted-foreground">Kêu gọi hành động (CTA - Tùy chọn)</Label>
                <Input 
                  id="editCta"
                  value={editCta}
                  onChange={(e) => setEditCta(e.target.value)}
                  placeholder="Bấm vào link bên dưới để..."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="editHashtags" className="text-xs font-mono uppercase text-muted-foreground">Hashtags (Phân cách bằng dấu phẩy)</Label>
                <Input 
                  id="editHashtags"
                  value={editHashtags}
                  onChange={(e) => setEditHashtags(e.target.value)}
                  placeholder="marketing, AI, socialsence"
                />
              </div>
            </div>

            <DialogFooter>
              <button 
                type="button" 
                onClick={() => setIsEditDialogOpen(false)}
                className="h-9 px-4 rounded border border-border bg-transparent text-foreground hover:bg-muted/20 font-mono text-xs uppercase tracking-wider"
              >
                Hủy
              </button>
              <button 
                type="submit" 
                disabled={submittingEdit}
                className="h-9 px-4 rounded bg-foreground text-background hover:bg-foreground/90 font-mono text-xs uppercase tracking-wider disabled:opacity-55"
              >
                {submittingEdit ? "Đang lưu..." : "Cập nhật"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
