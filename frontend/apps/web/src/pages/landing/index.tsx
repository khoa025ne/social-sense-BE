import { useState, useRef, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/auth-store"
import { paymentApi } from "@/api/payment"
import { Button } from "@workspace/ui/components/button"
import { CharacterMorph } from "@workspace/ui/components/character-morph"
import { DoubleBezelCard } from "@workspace/ui/components/double-bezel-card"
import { EyebrowBadge } from "@workspace/ui/components/eyebrow-badge"
import SphereImageGrid from "@workspace/ui/components/image-sphere"
import { LiquidMetalButton } from "@workspace/ui/components/liquid-metal-button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { AnimatedBeam, BeamNode } from "@workspace/ui/components/animated-beam"
import { Cpu, Zap, Crown, Sparkles, TrendingUp, Database, ArrowRight, Check, ShieldAlert, Download } from "lucide-react"

// Custom SVG Icons
const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
)

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
)

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
)

const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
)


// 12 Premium B&W Images for SphereImageGrid
const sampleImages = [
  { id: "1", src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=300", alt: "SocialSence AI", title: "Sinh nội dung tự động", description: "AI thông minh hiểu sâu sắc sản phẩm của bạn." },
  { id: "2", src: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=300", alt: "SocialSence Analytics", title: "Phân tích đa chiều", description: "Đo lường hiệu suất tương tác mượt mà." },
  { id: "3", src: "https://images.unsplash.com/photo-1618005198143-d528bee3824f?q=80&w=300", alt: "SocialSence Design", title: "Thiết kế tối giản", description: "Hệ thống thiết kế B&W Monochrome chuẩn mực cao." },
  { id: "4", src: "https://images.unsplash.com/photo-1600132806370-bf17e65e942f?q=80&w=300", alt: "SocialSence Platform", title: "Đồng bộ đa kênh", description: "Facebook, LinkedIn, TikTok trong một giao diện." },
  { id: "5", src: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=300", alt: "SocialSence Art", title: "Dựng ảnh thông minh", description: "Phân tích ngữ cảnh và sinh ảnh nghệ thuật chất lượng cao." },
  { id: "6", src: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=300", alt: "SocialSence Strategy", title: "Theo sát Trend", description: "Liên tục cập nhật hashtag thịnh hành thời gian thực." },
  { id: "7", src: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=300", alt: "SocialSence Tech", title: "AI Core Processing", description: "Đo lường thời gian thực với độ trễ tối thiểu." },
  { id: "8", src: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=300", alt: "SocialSence Network", title: "API Tốc độ cao", description: "Kết nối ổn định đến các cụm máy chủ xử lý ngôn ngữ." },
  { id: "9", src: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=300", alt: "SocialSence Security", title: "Bảo mật tuyệt đối", description: "Dữ liệu huấn luyện của bạn được mã hóa hoàn toàn." },
  { id: "10", src: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=300", alt: "SocialSence Logic", title: "Xử lý logic tự động", description: "Giảm tải 90% khối lượng công việc quản lý nội dung." },
  { id: "11", src: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=300", alt: "SocialSence Hardware", title: "Tối ưu hóa tài nguyên", description: "Phù hợp với ngân sách của các doanh nghiệp vừa và nhỏ." },
  { id: "12", src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=300", alt: "SocialSence Interface", title: "Giao diện cao cấp", description: "Mang lại cảm giác thao tác mượt mà và trực quan." }
]

// Animated Beam Node Connector component for Bento Card
function MultiChannelBeam() {
  const containerRef = useRef<HTMLDivElement>(null)
  const centralRef = useRef<HTMLDivElement>(null)
  const fbRef = useRef<HTMLDivElement>(null)
  const liRef = useRef<HTMLDivElement>(null)
  const igRef = useRef<HTMLDivElement>(null)
  const ttRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={containerRef} className="relative flex w-full max-w-md mx-auto items-center justify-between p-6 bg-muted/10 border border-border/40 rounded-2xl overflow-hidden h-[180px]">
      <div className="flex flex-col gap-3">
        <BeamNode ref={fbRef} className="size-9 p-0 border flex items-center justify-center rounded-lg shadow-sm bg-background">
          <FacebookIcon className="size-4 text-muted-foreground" />
        </BeamNode>
        <BeamNode ref={liRef} className="size-9 p-0 border flex items-center justify-center rounded-lg shadow-sm bg-background">
          <LinkedinIcon className="size-4 text-muted-foreground" />
        </BeamNode>
      </div>

      <BeamNode ref={centralRef} className="size-12 p-0 border-2 border-foreground flex items-center justify-center rounded-xl shadow-md bg-background">
        <Cpu className="size-5 text-foreground animate-pulse" />
      </BeamNode>

      <div className="flex flex-col gap-3">
        <BeamNode ref={igRef} className="size-9 p-0 border flex items-center justify-center rounded-lg shadow-sm bg-background">
          <InstagramIcon className="size-4 text-muted-foreground" />
        </BeamNode>
        <BeamNode ref={ttRef} className="size-9 p-0 border flex items-center justify-center rounded-lg shadow-sm bg-background">
          <TikTokIcon className="size-4 text-muted-foreground" />
        </BeamNode>
      </div>

      <AnimatedBeam containerRef={containerRef} fromRef={centralRef} toRef={fbRef} curvature={-30} duration={3} />
      <AnimatedBeam containerRef={containerRef} fromRef={centralRef} toRef={liRef} curvature={-10} duration={3.5} />
      <AnimatedBeam containerRef={containerRef} fromRef={centralRef} toRef={igRef} curvature={30} duration={3.2} />
      <AnimatedBeam containerRef={containerRef} fromRef={centralRef} toRef={ttRef} curvature={10} duration={2.8} />
    </div>
  )
}

// iPhone Custom Vector Mockup with interactive image generation preview
function PhoneCardPreview() {
  const [hovered, setHovered] = useState(false)

  return (
    <div 
      onMouseEnter={() => setHovered(true)} 
      onMouseLeave={() => setHovered(false)}
      className="border-2 border-foreground rounded-[2rem] w-[150px] h-[240px] relative overflow-hidden bg-background shadow-md mx-auto transition-transform duration-300 hover:scale-[1.03] cursor-pointer"
    >
      {/* Dynamic Island */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-2.5 bg-foreground rounded-full z-20" />
      
      {/* Screen Content */}
      <div className="absolute inset-1 rounded-[1.7rem] overflow-hidden bg-muted/20 flex flex-col p-2 pt-5 justify-between">
        {/* Shimmer/Scanner bar */}
        <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-foreground/50 to-transparent top-0 animate-bounce" style={{ animationDuration: hovered ? "1.2s" : "2.4s" }} />

        {/* Image Preview Container */}
        <div className="relative w-full h-[120px] border rounded-lg overflow-hidden bg-card">
          {/* Draft Image */}
          <div 
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-500 flex items-center justify-center text-[8px] font-mono text-muted-foreground/60"
            style={{ 
              backgroundImage: "url('https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=200&auto=format&fit=crop')",
              opacity: hovered ? 0 : 1 
            }}
          >
            [ PHÁC THẢO ]
          </div>
          {/* AI Rendered Image */}
          <div 
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-500 flex items-center justify-center"
            style={{ 
              backgroundImage: "url('https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=200&auto=format&fit=crop')",
              opacity: hovered ? 1 : 0 
            }}
          >
            <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-background text-[6px] font-bold tracking-widest uppercase rounded">AI RENDER</span>
          </div>
        </div>

        {/* Text prompt simulated */}
        <div className="flex flex-col gap-1 mt-1 text-left">
          <div className="h-1 w-12 bg-foreground rounded" />
          <div className="h-1 w-8 bg-muted-foreground/50 rounded" />
          <div className="mt-1 p-1 border rounded bg-background text-[6px] font-mono text-muted-foreground leading-tight overflow-hidden h-12">
            {hovered ? "> prompt: tech studio setup, double bezel, monochrome" : "> status: analysis complete. hover to render..."}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [planPrices, setPlanPrices] = useState<Record<string, number>>({
    Free: 0,
    Pro: 79000,
    Ultra: 99000,
  })

  const handlePlanSelect = (plan: string) => {
    if (user) {
      navigate(`/settings/subscription?plan=${plan}`)
    } else {
      navigate(`/auth/register?plan=${plan}`)
    }
  }

  useEffect(() => {
    paymentApi.getPlans().then((res: any) => {
      const rawPlans = res?.plans || res
      if (Array.isArray(rawPlans)) {
        const map: Record<string, number> = {}
        rawPlans.forEach((p: any) => {
          if (p.tier) map[p.tier] = p.price
        })
        setPlanPrices(prev => ({ ...prev, ...map }))
      }
    }).catch(() => {})
  }, [])

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Ambient Drift Background */}
      <div className="ambient-blob top-10 left-10" />
      <div className="ambient-blob bottom-20 right-10" />

      {/* Hero Section - Refactored into balanced 2-column layout */}
      <section className="content-width pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full">
          {/* Text Content Area */}
          <div className="lg:col-span-7 text-left flex flex-col items-start">
            <EyebrowBadge>Nền tảng AI Nội dung số 1 Việt Nam</EyebrowBadge>
            
            <h1 className="mt-8 font-serif text-5xl md:text-7xl tracking-tight leading-[1.05] animate-fade-up">
              Biến ý tưởng thành<br />
              <CharacterMorph
                words={["hình ảnh AI", "nội dung số", "kịch bản video", "bài viết trend"]}
                className="text-foreground font-bold underline decoration-1"
                interval={2800}
              />
              <br />
              trong vài giây.
            </h1>

            <p className="mt-6 text-muted-foreground text-base md:text-lg max-w-xl leading-relaxed animate-fade-up stagger-item" style={{ "--index": 1 } as any}>
              SocialSence tự động hóa toàn bộ quy trình sản xuất nội dung mạng xã hội chuẩn hóa theo nhận diện thương hiệu của bạn và tối ưu theo xu hướng hot trend thời gian thực.
            </p>

            <div className="mt-10 flex flex-wrap gap-4 items-center animate-fade-up stagger-item" style={{ "--index": 2 } as any}>
              <Link to="/auth/register">
                <LiquidMetalButton label="Bắt đầu miễn phí" textColor="#ffffff" />
              </Link>
              <a
                href="https://drive.google.com/file/d/1EwBGinY8MtlwQySNBqC5biu4eumdzQdc/view?usp=drive_link"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative rounded-xl bg-foreground text-background px-6 py-3 text-sm font-semibold overflow-hidden shadow-lg hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2 border border-white/10"
              >
                <div className="absolute inset-0 bg-linear-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <span className="relative z-10 flex items-center gap-1.5">
                  <Download className="size-3.5 animate-bounce" />
                  Tải App di động (APK)
                </span>
              </a>
              <a href="#features" className="rounded-xl border border-border px-6 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors">
                Tìm hiểu thêm
              </a>
            </div>
          </div>

          {/* 3D Image Sphere Visual Area */}
          <div className="lg:col-span-5 flex justify-center items-center animate-fade-up stagger-item" style={{ "--index": 3 } as any}>
            <div className="flex flex-col items-center justify-center overflow-hidden w-full max-w-[420px] h-[440px] relative bg-transparent">
              <div className="text-[9px] font-mono text-muted-foreground mb-4 uppercase tracking-widest">Kéo chuột để xoay 3D • Click để xem</div>
              <SphereImageGrid 
                images={sampleImages} 
                containerSize={360} 
                sphereRadius={150} 
                autoRotate={true}
                autoRotateSpeed={0.3}
                className="mx-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Marquee Partner Logos (Inline Custom Marquee) */}
      <section className="border-y bg-muted/20 py-8 overflow-hidden select-none">
        <div className="flex w-max gap-16 animate-marquee" style={{ animationDuration: "35s", animationTimingFunction: "linear", animationIterationCount: "infinite" }}>
          <div className="flex gap-16 text-muted-foreground font-semibold tracking-wider text-xs items-center uppercase">
            <span>FACEBOOK GRAPH API</span>
            <span>LINKEDIN PARTNER</span>
            <span>INSTAGRAM CREATORS</span>
            <span>TIKTOK FOR BUSINESS</span>
            <span>OPENAI PARTNER</span>
            <span>GEMINI PRO INTEGRATION</span>
          </div>
          <div className="flex gap-16 text-muted-foreground font-semibold tracking-wider text-xs items-center uppercase">
            <span>FACEBOOK GRAPH API</span>
            <span>LINKEDIN PARTNER</span>
            <span>INSTAGRAM CREATORS</span>
            <span>TIKTOK FOR BUSINESS</span>
            <span>OPENAI PARTNER</span>
            <span>GEMINI PRO INTEGRATION</span>
          </div>
        </div>
      </section>

      {/* Features Section - Apple-Style Bento Grid */}
      <section id="features" className="content-width section-pad">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <EyebrowBadge>Tính năng</EyebrowBadge>
          <h2 className="mt-4 font-serif text-3xl md:text-5xl">Mọi thứ bạn cần để chinh phục mạng xã hội</h2>
          <p className="mt-4 text-muted-foreground">Tích hợp đa công cụ mạnh mẽ giúp bạn tạo ra những nội dung vượt trội, giữ chân người dùng.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          {/* Card 1: Multi-channel Beam Flow (col-span-8) */}
          <div className="md:col-span-8">
            <DoubleBezelCard className="h-full flex flex-col justify-between p-8 bg-card/20 border-border/60">
              <div className="flex flex-col gap-2">
                <div className="p-2 border rounded-lg bg-background w-fit">
                  <Sparkles className="size-5 text-foreground" />
                </div>
                <h3 className="text-xl font-bold mt-2">Tạo Nội dung AI Đa kênh</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  Chỉ cần nhập một ý tưởng đơn giản, AI sẽ sinh ra các phiên bản bài viết tương ứng tối ưu cho Facebook, LinkedIn, Instagram, hoặc kịch bản TikTok với văn phong tùy chỉnh.
                </p>
              </div>
              <div className="mt-8">
                <MultiChannelBeam />
              </div>
            </DoubleBezelCard>
          </div>

          {/* Card 2: Image Wizard Phone Mockup (col-span-4) */}
          <div className="md:col-span-4">
            <DoubleBezelCard className="h-full flex flex-col justify-between p-8 bg-card/20 border-border/60">
              <div className="flex flex-col gap-2">
                <div className="p-2 border rounded-lg bg-background w-fit">
                  <Zap className="size-5 text-foreground" />
                </div>
                <h3 className="text-xl font-bold mt-2">Image Wizard</h3>
                <p className="text-muted-foreground text-sm">
                  Dựng ảnh minh họa bằng AI qua 2 bước thông minh: phân tích bài viết và đề xuất prompt ảnh cực chuẩn.
                </p>
              </div>
              <div className="mt-8">
                <PhoneCardPreview />
              </div>
            </DoubleBezelCard>
          </div>

          {/* Card 3: Trends (col-span-4) */}
          <div className="md:col-span-4">
            <DoubleBezelCard className="h-full flex flex-col justify-between p-8 bg-card/20 border-border/60">
              <div className="flex flex-col gap-2">
                <div className="p-2 border rounded-lg bg-background w-fit">
                  <TrendingUp className="size-5 text-foreground" />
                </div>
                <h3 className="text-xl font-bold mt-2">Xu hướng thực tế</h3>
                <p className="text-muted-foreground text-sm">
                  Theo dõi các hashtag và chủ đề đang thịnh hành (hot trend) tại thị trường Việt Nam để đưa vào bài viết ngay lập tức.
                </p>
              </div>
              <div className="mt-8 flex flex-col gap-2">
                <div className="flex items-center justify-between p-2 border rounded-lg bg-background/50 text-xs font-mono">
                  <span>#AITrending</span>
                  <span className="text-muted-foreground">9.4k bài viết</span>
                </div>
                <div className="flex items-center justify-between p-2 border rounded-lg bg-background/50 text-xs font-mono">
                  <span>#Automation2026</span>
                  <span className="text-muted-foreground">4.2k bài viết</span>
                </div>
              </div>
            </DoubleBezelCard>
          </div>

          {/* Card 4: Knowledge Base (col-span-8) */}
          <div className="md:col-span-8">
            <DoubleBezelCard className="h-full flex flex-col justify-between p-8 bg-card/20 border-border/60">
              <div className="flex flex-col gap-2">
                <div className="p-2 border rounded-lg bg-background w-fit">
                  <Database className="size-5 text-foreground" />
                </div>
                <h3 className="text-xl font-bold mt-2">Kho Tri thức Thương hiệu</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  Tải lên tài liệu PDF, nhập link website hoặc văn bản để huấn luyện AI hiểu sâu về sản phẩm, dịch vụ và phong cách hành văn của doanh nghiệp bạn.
                </p>
              </div>
              <div className="mt-8 border rounded-xl overflow-hidden text-xs bg-background/50">
                <div className="bg-muted px-4 py-2 border-b font-mono font-semibold">Tài liệu đã học</div>
                <div className="p-4 font-mono text-muted-foreground flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-foreground" />
                    <span>SanPhamGuide_v2.pdf (124 KB)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-foreground" />
                    <span>https://socialsence.vn/ve-chung-toi</span>
                  </div>
                </div>
              </div>
            </DoubleBezelCard>
          </div>
        </div>
      </section>

      {/* Mobile App Section - Premium Android Mockup & Large APK Download Button */}
      <section id="mobile-app" className="border-t bg-muted/10 py-20 overflow-hidden relative">
        <div className="content-width grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Mockup phone area */}
          <div className="lg:col-span-5 order-2 lg:order-1 flex justify-center">
            <div className="relative w-[280px] h-[560px] rounded-[40px] border-8 border-foreground bg-background p-4 shadow-2xl flex flex-col justify-between overflow-hidden">
              {/* Speaker / Camera bar */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-4 rounded-full bg-foreground z-20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/30 mr-2" />
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              
              {/* Screen Content */}
              <div className="w-full h-full flex flex-col pt-6 justify-between relative bg-black text-white p-4 font-sans rounded-[28px] overflow-hidden select-none">
                {/* Background glow in phone */}
                <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl" />
                <div className="absolute -bottom-20 -right-20 w-48 h-48 rounded-full bg-fuchsia-500/10 blur-3xl" />
                
                {/* Header */}
                <div className="flex justify-between items-center z-10">
                  <span className="text-[10px] font-mono font-bold text-white/90">SocialSence</span>
                  <div className="size-2 rounded-full bg-emerald-500" />
                </div>

                {/* Body inside phone */}
                <div className="my-auto flex flex-col gap-4 text-center z-10">
                  <div className="size-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto shadow-lg">
                    <span className="font-serif text-3xl font-bold">S</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold tracking-tight">SocialSence Mobile</h4>
                    <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px] mx-auto">Tạo bài viết AI & xem báo cáo phân tích thời gian thực mọi lúc, mọi nơi.</p>
                  </div>
                  
                  {/* Quota ring preview */}
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-left">
                    <div>
                      <div className="text-[9px] text-muted-foreground font-mono">QUOTA ĐÃ DÙNG</div>
                      <div className="text-xs font-bold font-mono">148 / 500 bài</div>
                    </div>
                    <div className="size-8 rounded-full border-4 border-white/10 border-t-white flex items-center justify-center text-[8px] font-mono">30%</div>
                  </div>
                </div>

                {/* Footer in phone */}
                <div className="h-10 border-t border-white/10 flex items-center justify-around text-xs text-muted-foreground z-10 font-mono">
                  <span>Trang chủ</span>
                  <span>AI</span>
                  <span>Báo cáo</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Text Content area */}
          <div className="lg:col-span-7 order-1 lg:order-2 flex flex-col items-start justify-center">
            <EyebrowBadge>Ứng dụng di động</EyebrowBadge>
            <h2 className="mt-6 font-serif text-3xl md:text-5xl tracking-tight leading-tight">
              Quản trị hiệu suất<br />mạng xã hội trong tầm tay
            </h2>
            <p className="mt-4 text-muted-foreground text-sm md:text-base max-w-lg leading-relaxed">
              Trải nghiệm ứng dụng di động SocialSence dành riêng cho Android. Đưa toàn bộ quy trình sản xuất nội dung bằng AI, cập nhật trend nóng hổi và báo cáo so sánh chỉ số của bạn lên giao diện di động trực quan, tốc độ cao.
            </p>
            
            <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <a
                href="https://drive.google.com/file/d/1EwBGinY8MtlwQySNBqC5biu4eumdzQdc/view?usp=drive_link"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative rounded-2xl bg-foreground text-background px-8 py-5 text-base font-bold shadow-2xl hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:scale-105 active:scale-98 transition-all duration-300 flex items-center justify-center gap-3 border border-white/10"
              >
                {/* Shimmer light effect inside button */}
                <div className="absolute inset-0 bg-linear-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <Download className="size-5 animate-bounce" />
                <div className="text-left font-sans">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-background/60">Tải ứng dụng di động</div>
                  <div className="text-sm font-bold">SocialSence v1.0.0 (APK)</div>
                </div>
              </a>
              
              <div className="flex flex-col justify-center text-xs text-muted-foreground font-mono bg-muted/40 px-4 py-3 rounded-xl border border-dashed">
                <span>• Hỗ trợ: Android 8.0 trở lên</span>
                <span>• Kích thước file: ~18 MB</span>
                <span>• Bản phát hành chính thức trực tiếp</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section (Bảng giá) - Clean iconography, Crown icon for Pro plan */}
      <section id="pricing" className="content-width section-pad border-t">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <EyebrowBadge>Bảng giá</EyebrowBadge>
          <h2 className="mt-4 font-serif text-3xl md:text-5xl">Bảng giá linh hoạt cho mọi nhu cầu</h2>
          <p className="mt-4 text-muted-foreground">Bắt đầu hoàn toàn miễn phí, nâng cấp khi bạn phát triển quy mô.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Free Plan */}
          <DoubleBezelCard className="flex flex-col justify-between p-8 bg-background border border-border">
            <div>
              <h3 className="text-lg font-bold text-muted-foreground">Gói Free</h3>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-bold">₫0</span>
                <span className="text-muted-foreground text-sm ml-2">/ tháng</span>
              </div>
              <p className="mt-2 text-muted-foreground text-xs">Dành cho cá nhân mới bắt đầu sáng tạo nội dung.</p>
              <ul className="mt-8 space-y-3.5 text-sm">
                <li className="flex items-center gap-2.5">
                  <Check className="text-foreground size-4" />
                  <span>5 lượt tạo nội dung / ngày</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="text-foreground size-4" />
                  <span>1 Kênh xã hội (Facebook)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="text-foreground size-4" />
                  <span>1 Persona thương hiệu</span>
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <Button variant="outline" className="w-full cursor-pointer" onClick={() => handlePlanSelect("Free")}>Bắt đầu ngay</Button>
            </div>
          </DoubleBezelCard>

          {/* Pro Plan - Clean typography */}
          <DoubleBezelCard className="flex flex-col justify-between p-8 bg-background border border-border">
            <div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Crown className="size-4 text-muted-foreground" />
                  <h3 className="text-lg font-bold text-muted-foreground">Gói Pro</h3>
                </div>
                <span className="px-2 py-0.5 border text-muted-foreground text-[10px] uppercase font-mono tracking-wider rounded">Phổ biến</span>
              </div>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-bold">₫{(planPrices.Pro || 79000).toLocaleString('vi-VN')}</span>
                <span className="text-muted-foreground text-sm ml-2">/ tháng</span>
              </div>
              <p className="mt-2 text-muted-foreground text-xs">Đầy đủ tính năng cao cấp cho nhà sáng tạo thực thụ.</p>
              <ul className="mt-8 space-y-3.5 text-sm">
                <li className="flex items-center gap-2.5">
                  <Check className="text-foreground size-4" />
                  <span>50 lượt tạo nội dung / ngày</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="text-foreground size-4" />
                  <span>Đa kênh: FB, LinkedIn, TikTok, IG</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="text-foreground size-4" />
                  <span>Tạo ảnh AI không giới hạn</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="text-foreground size-4" />
                  <span>Huấn luyện tri thức thương hiệu</span>
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <Button variant="outline" className="w-full cursor-pointer" onClick={() => handlePlanSelect("Pro")}>Đăng ký gói Pro</Button>
            </div>
          </DoubleBezelCard>

          {/* Ultra Plan - Super Premium Shimmer & Ring, Maximum Value */}
          <div className="bezel-outer ring-2 ring-foreground rounded-[2.2rem] shadow-lg shadow-foreground/5 animate-pulse-slow">
            <div className="bezel-inner flex flex-col justify-between h-full bg-background p-8 rounded-[2.1rem]">
              <div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-foreground animate-bounce" />
                    <h3 className="text-lg font-bold text-foreground">Gói Ultra</h3>
                  </div>
                  <span className="px-2.5 py-0.5 bg-foreground text-background text-[10px] uppercase font-mono tracking-widest font-bold rounded">Tối ưu nhất</span>
                </div>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-bold">₫{(planPrices.Ultra || planPrices.Enterprise || 99000).toLocaleString('vi-VN')}</span>
                  <span className="text-muted-foreground text-sm ml-2">/ tháng</span>
                </div>
                <p className="mt-2 text-muted-foreground text-xs">Dành cho Agency, các đội nhóm marketing lớn cần hiệu suất tối đa.</p>
                <ul className="mt-8 space-y-3.5 text-sm">
                  <li className="flex items-center gap-2.5">
                    <Check className="text-foreground size-4" />
                    <span className="font-semibold text-foreground">500 lượt tạo nội dung / ngày</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="text-foreground size-4" />
                    <span>Huấn luyện Tri thức không giới hạn</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="text-foreground size-4" />
                    <span>Tích hợp API tốc độ cao riêng biệt</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="text-foreground size-4" />
                    <span>Tự động đăng bài đa nền tảng</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="text-foreground size-4" />
                    <span className="text-foreground font-semibold">Hỗ trợ chuyên gia Marketing 24/7 (SLA 2h)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="text-foreground size-4" />
                    <span>Ưu tiên xử lý trên hạ tầng GPU riêng</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <Button variant="shimmer" className="w-full text-base font-bold h-11 cursor-pointer" onClick={() => handlePlanSelect("Ultra")}>Đăng ký gói Ultra</Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ & Tooltips Section - standard Accordion implementation, status tooltips */}
      <section id="faq" className="content-width section-pad border-t">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <EyebrowBadge>Hỏi đáp</EyebrowBadge>
          <h2 className="mt-4 font-serif text-3xl md:text-5xl">Câu hỏi thường gặp</h2>
        </div>

        <div className="max-w-3xl mx-auto">
          {/* standard Joly UI Accordion components */}
          <Accordion type="single" collapsible className="w-full border-t">
            <AccordionItem value="item-1">
              <AccordionTrigger className="font-semibold text-left">
                SocialSence học tri thức của tôi bằng cách nào?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                Bạn có thể tải tài liệu PDF, nhập link website hoặc gõ văn bản trực tiếp. Hệ thống AI của chúng tôi sẽ phân tích, lưu trữ cục bộ một cách bảo mật và lấy ra làm ngữ cảnh huấn luyện cho văn phong tạo bài viết tiếp theo.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2">
              <AccordionTrigger className="font-semibold text-left flex items-center gap-2">
                Gói cước Pro có thực sự tạo được ảnh AI?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                Đúng vậy! Gói Pro của chúng tôi tích hợp sẵn API sinh ảnh AI chất lượng cao từ các mô hình hàng đầu hiện nay mà không bắt buộc bạn phải trả thêm phụ phí nào khác.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3">
              <AccordionTrigger className="font-semibold text-left">
                Tôi có thể hủy gói nâng cấp bất cứ lúc nào?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                Bạn hoàn toàn có thể tự hủy hoặc nâng cấp/hạ cấp gói cước ngay trong phần Cài đặt tài khoản. Lịch sử thanh toán và Tri thức thương hiệu của bạn vẫn sẽ được bảo lưu.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Status Tooltips explanation section for terminology */}
        <div className="max-w-md mx-auto mt-16 p-4 border border-dashed border-border/80 rounded-xl text-center text-xs text-muted-foreground bg-muted/5 flex items-center justify-center gap-2">
          <ShieldAlert className="size-4 shrink-0" />
          <span>
            Rà soát thuật ngữ: Hover vào các khái niệm {" "}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="underline decoration-dotted cursor-help text-foreground font-semibold">Persona thương hiệu</span>
                </TooltipTrigger>
                <TooltipContent className="bg-card text-card-foreground p-2 border rounded-lg shadow">
                  Hồ sơ tính cách, văn phong đại diện của thương hiệu khi viết bài.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {" "} và {" "}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="underline decoration-dotted cursor-help text-foreground font-semibold">Tri thức thương hiệu</span>
                </TooltipTrigger>
                <TooltipContent className="bg-card text-card-foreground p-2 border rounded-lg shadow">
                  Tài liệu sản phẩm được AI nạp vào làm ngữ cảnh huấn luyện.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {" "} để giải nghĩa.
          </span>
        </div>
      </section>
    </div>
  )
}
