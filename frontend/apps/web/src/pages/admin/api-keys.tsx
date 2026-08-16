import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { adminApi, type AdminApiKey } from "@/api/admin"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { 
  Key, 
  Plus, 
  RefreshCw, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  Check, 
  AlertTriangle, 
  Flame, 
  Cpu,
  Image as ImageIcon
} from "lucide-react"

export default function AdminApiKeysPage() {
  const [keys, setKeys] = useState<AdminApiKey[]>([])
  const [loading, setLoading] = useState(true)
  
  // Add Key Form State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [keyValue, setKeyValue] = useState("")
  const [provider, setProvider] = useState("Gemini")
  const [modelOverride, setModelOverride] = useState("")
  const [supportsImageGen, setSupportsImageGen] = useState(false)
  const [notes, setNotes] = useState("")
  const [submittingAdd, setSubmittingAdd] = useState(false)
  const [reloadingPool, setReloadingPool] = useState(false)

  // Fetch API Keys
  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true)
      const data = await adminApi.getApiKeys()
      setKeys(data)
    } catch (err: any) {
      console.error("Failed to fetch API keys", err)
      toast.error(err.message || "Không thể tải danh sách API Keys!")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  // Toggle Key Status
  const handleToggleActive = async (keyItem: AdminApiKey) => {
    try {
      await adminApi.updateApiKey(keyItem.id, { isActive: !keyItem.isActive })
      toast.success(`Đã ${!keyItem.isActive ? "kích hoạt" : "hủy kích hoạt"} API Key thành công!`)
      fetchKeys()
    } catch (err: any) {
      toast.error(err.message || "Thao tác thất bại!")
    }
  }

  // Delete Key
  const handleDeleteKey = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn xóa API Key này không? Hành động này không thể hoàn tác!")) {
      return
    }
    try {
      await adminApi.deleteApiKey(id)
      toast.success("Đã xóa API Key thành công!")
      fetchKeys()
    } catch (err: any) {
      toast.error(err.message || "Không thể xóa API Key!")
    }
  }

  // Reload Key Pool
  const handleReloadPool = async (clearCooldowns = false) => {
    try {
      setReloadingPool(true)
      const res = await adminApi.reloadKeyPool(clearCooldowns)
      toast.success(res.message || "Đã tải lại danh sách API Key Pool thành công!")
      fetchKeys()
    } catch (err: any) {
      toast.error(err.message || "Không thể tải lại API Key Pool!")
    } finally {
      setReloadingPool(false)
    }
  }

  // Add Key
  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label || !keyValue) {
      toast.error("Vui lòng nhập nhãn và giá trị API Key!")
      return
    }

    try {
      setSubmittingAdd(true)
      await adminApi.addApiKey({
        label,
        keyValue,
        provider,
        modelOverride: modelOverride || undefined,
        supportsImageGen,
        notes
      })
      toast.success("Đã thêm API Key mới thành công!")
      setIsAddOpen(false)
      // Reset form
      setLabel("")
      setKeyValue("")
      setProvider("Gemini")
      setModelOverride("")
      setSupportsImageGen(false)
      setNotes("")
      fetchKeys()
    } catch (err: any) {
      toast.error(err.message || "Không thể thêm API Key!")
    } finally {
      setSubmittingAdd(false)
    }
  }

  return (
    <div className="p-6 flex flex-col gap-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader 
          title="API Keys Pool" 
          description="Quản lý kho khóa API dự phòng cho các dịch vụ AI (Gemini, OpenAI, v.v.). Tự động phân phối và cooldown." 
        />
        
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => handleReloadPool(false)}
            disabled={reloadingPool || loading}
            className="h-10 px-4 rounded border border-border bg-transparent text-foreground font-mono text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:bg-muted/20 transition-all active:scale-95 disabled:opacity-50"
            title="Đồng bộ lại cache và trạng thái Key Pool"
          >
            <RefreshCw className={`size-4 ${reloadingPool ? 'animate-spin' : ''}`} /> Tải lại Pool
          </button>
          
          <button 
            onClick={() => handleReloadPool(true)}
            disabled={reloadingPool || loading}
            className="h-10 px-4 rounded border border-border bg-transparent text-foreground font-mono text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:bg-muted/20 transition-all active:scale-95 disabled:opacity-50"
            title="Reset cooldown của tất cả các key bị hạ nhiệt và đồng bộ lại pool"
          >
            <Flame className="size-4" /> Reset Cooldowns
          </button>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <button className="h-10 px-4 rounded bg-foreground text-background font-mono text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:bg-foreground/90 transition-all active:scale-95">
                <Plus className="size-4" /> Thêm API Key
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] border border-border bg-background">
              <form onSubmit={handleAddKey}>
                <DialogHeader>
                  <DialogTitle className="font-serif text-lg">Thêm API Key mới</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Thêm một khóa API mới vào hệ thống. Khóa này sẽ tự động được xếp vào pool để sử dụng luân phiên.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="label" className="text-xs font-mono uppercase text-muted-foreground">Tên nhãn gợi nhớ</Label>
                    <Input 
                      id="label" 
                      value={label} 
                      onChange={(e) => setLabel(e.target.value)} 
                      placeholder="Ví dụ: Gemini Pro - Account 1" 
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="keyValue" className="text-xs font-mono uppercase text-muted-foreground">Giá trị API Key</Label>
                    <Input 
                      id="keyValue" 
                      type="password"
                      value={keyValue} 
                      onChange={(e) => setKeyValue(e.target.value)} 
                      placeholder="AIzaSy..." 
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="provider" className="text-xs font-mono uppercase text-muted-foreground">Nhà cung cấp</Label>
                      <select 
                        id="provider"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        className="h-9 px-3 border border-border rounded bg-background font-mono text-xs uppercase focus:outline-none"
                      >
                        <option value="Gemini">Gemini</option>
                        <option value="OpenAI">OpenAI</option>
                        <option value="Anthropic">Anthropic</option>
                        <option value="Groq">Groq</option>
                        <option value="TogetherAI">TogetherAI</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="modelOverride" className="text-xs font-mono uppercase text-muted-foreground">Model Override (Tùy chọn)</Label>
                      <Input 
                        id="modelOverride" 
                        value={modelOverride} 
                        onChange={(e) => setModelOverride(e.target.value)} 
                        placeholder="Ví dụ: gemini-1.5-pro" 
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input 
                      id="supportsImageGen" 
                      type="checkbox" 
                      checked={supportsImageGen} 
                      onChange={(e) => setSupportsImageGen(e.target.checked)}
                      className="size-4 accent-foreground"
                    />
                    <Label htmlFor="supportsImageGen" className="text-xs font-mono uppercase text-muted-foreground cursor-pointer select-none">
                      Hỗ trợ sinh hình ảnh (Image Gen)
                    </Label>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes" className="text-xs font-mono uppercase text-muted-foreground">Ghi chú thêm</Label>
                    <textarea 
                      id="notes" 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                      placeholder="Hạn mức thẻ, thông tin tài khoản phụ..." 
                      className="min-h-[60px] px-3 py-2 border border-border rounded bg-background text-xs focus:outline-none"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <button 
                    type="button" 
                    onClick={() => setIsAddOpen(false)}
                    className="h-9 px-4 rounded border border-border bg-transparent text-foreground hover:bg-muted/20 font-mono text-xs uppercase tracking-wider"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingAdd}
                    className="h-9 px-4 rounded bg-foreground text-background hover:bg-foreground/90 font-mono text-xs uppercase tracking-wider disabled:opacity-55"
                  >
                    {submittingAdd ? "Đang lưu..." : "Xác nhận"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center font-mono text-xs text-muted-foreground gap-3">
          <RefreshCw className="size-6 animate-spin text-muted-foreground" />
          <span>Đang tải danh sách API Keys...</span>
        </div>
      ) : keys.length === 0 ? (
        <DoubleBezelCard className="bg-background flex flex-col items-center justify-center py-16 text-center border-dashed">
          <Key className="size-10 text-muted-foreground/40 mb-4" />
          <h4 className="font-serif text-lg mb-1">Key Pool đang trống</h4>
          <p className="text-xs text-muted-foreground max-w-sm mb-6">
            Hệ thống cần ít nhất một API Key hoạt động để xử lý các yêu cầu tạo nội dung AI.
          </p>
          <button 
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 border border-border rounded bg-foreground text-background font-mono text-xs uppercase tracking-wider hover:bg-foreground/90 transition-colors active:scale-95"
          >
            Thêm API Key đầu tiên
          </button>
        </DoubleBezelCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {keys.map((keyItem) => (
            <DoubleBezelCard 
              key={keyItem.id} 
              className={`bg-background border transition-all ${
                !keyItem.isActive 
                  ? 'border-dashed border-border opacity-65' 
                  : keyItem.isInCooldown
                  ? 'border-yellow-200/50'
                  : 'border-border'
              }`}
            >
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-foreground text-base flex items-center gap-1.5">
                      <Key className="size-4 text-muted-foreground" />
                      {keyItem.label}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      Suffix: <span className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-semibold tracking-wider">••••••••{keyItem.keySuffix}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Status Toggle */}
                    <button
                      onClick={() => handleToggleActive(keyItem)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title={keyItem.isActive ? "Tạm dừng hoạt động" : "Kích hoạt hoạt động"}
                    >
                      {keyItem.isActive ? (
                        <ToggleRight className="size-8 text-foreground" />
                      ) : (
                        <ToggleLeft className="size-8 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-border">
                  {/* Provider badge */}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/40 border border-border text-[10px] font-mono uppercase text-foreground">
                    <Cpu className="size-3" /> {keyItem.provider}
                  </span>

                  {/* Model override badge */}
                  {keyItem.modelOverride && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/40 border border-border text-[10px] font-mono text-muted-foreground">
                      Model: {keyItem.modelOverride}
                    </span>
                  )}

                  {/* Supports Image Gen */}
                  {keyItem.supportsImageGen && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-foreground text-background text-[10px] font-mono uppercase font-bold">
                      <ImageIcon className="size-3" /> Image Gen
                    </span>
                  )}

                  {/* Cooldown Status */}
                  {keyItem.isInCooldown ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-200/50 text-[10px] font-mono uppercase font-bold">
                      <AlertTriangle className="size-3" /> Cooldown đến: {keyItem.cooldownExpiresAt ? new Date(keyItem.cooldownExpiresAt).toLocaleTimeString("vi-VN") : "---"}
                    </span>
                  ) : keyItem.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/50 text-[10px] font-mono uppercase font-bold">
                      <Check className="size-3" /> Sẵn sàng
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono uppercase">
                      Disabled
                    </span>
                  )}
                </div>

                {keyItem.notes && (
                  <p className="text-xs text-muted-foreground italic bg-muted/20 p-2 rounded font-mono border-l-2 border-border">
                    {keyItem.notes}
                  </p>
                )}

                <div className="flex justify-end pt-2 border-t border-dashed border-border/60">
                  <button 
                    onClick={() => handleDeleteKey(keyItem.id)}
                    className="text-[10px] uppercase font-mono tracking-wider text-rose-500 hover:bg-rose-500 hover:text-white px-2.5 py-1.5 border border-rose-200/30 rounded inline-flex items-center gap-1 transition-colors active:scale-95"
                    title="Xóa API Key khỏi Pool"
                  >
                    <Trash2 className="size-3.5" /> Xóa Key
                  </button>
                </div>
              </div>
            </DoubleBezelCard>
          ))}
        </div>
      )}
    </div>
  )
}
