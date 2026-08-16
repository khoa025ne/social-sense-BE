import * as React from "react"
import { Outlet, Link } from "react-router-dom"
import { AnimatedThemeToggle } from "@workspace/ui/components/animated-theme-toggle"
import logoUrl from "@/assets/logo.svg"
import { Dock, DockItem, DockIcon, DockLabel, DockSeparator } from "@workspace/ui/components/dock"
import { Shield, HelpCircle, FileText } from "lucide-react"
import { toast } from "sonner"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@workspace/ui/components/dialog"
import { ScrollArea } from "@workspace/ui/components/scroll-area"

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
)

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
)

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
)

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
)

export function PublicLayout() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Floating Nav */}
      <FloatingNav />

      {/* Content */}
      <main className="pb-24">
        <Outlet />
      </main>

      {/* Footer replacing traditional footer with Joly UI Dock */}
      <FooterWithDock />
    </div>
  )
}

function FloatingNav() {
  return (
    <header className="fixed top-6 left-1/2 z-50 -translate-x-1/2 w-full max-w-5xl px-4">
      <nav className="glass hairline flex items-center justify-between px-6 py-3 rounded-full shadow-sm">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt="SocialSence Logo" className="h-10 w-auto dark:invert shrink-0" />
          <span className="hidden text-base font-semibold tracking-tight sm:block font-serif">
            SocialSence
          </span>
        </Link>

        {/* Links */}
        <div className="hidden items-center gap-8 text-sm md:flex">
          <a href="#features" className="text-muted-foreground transition-colors hover:text-foreground">
            Tính năng
          </a>
          <a href="#pricing" className="text-muted-foreground transition-colors hover:text-foreground">
            Giá cả
          </a>
          <a href="#faq" className="text-muted-foreground transition-colors hover:text-foreground">
            FAQ
          </a>
        </div>

        {/* CTA & Theme Toggle */}
        <div className="flex items-center gap-3">
          <Link
            to="/auth/login"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/[0.04]"
          >
            Đăng nhập
          </Link>
          <Link
            to="/auth/register"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Bắt đầu
          </Link>
          <AnimatedThemeToggle />
        </div>
      </nav>
    </header>
  )
}

function FooterWithDock() {
  const [modalOpen, setModalOpen] = React.useState(false)
  const [modalTitle, setModalTitle] = React.useState("")
  const [modalContent, setModalContent] = React.useState<React.ReactNode>(null)

  const showContent = (type: "privacy" | "prestige" | "support") => {
    if (type === "privacy") {
      setModalTitle("Điều khoản Bảo mật & Quy định Sử dụng Dịch vụ")
      setModalContent(
        <div className="space-y-4 text-xs md:text-sm leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">1. Quy định chung về bảo mật thông tin</p>
          <p>
            SocialSence tôn trọng và cam kết bảo vệ quyền riêng tư của tất cả người dùng hệ thống. 
            Chính sách bảo mật này mô tả cách thức chúng tôi thu thập, sử dụng, lưu trữ và bảo mật dữ liệu 
            đối với các thông tin mà người dùng cung cấp khi trải nghiệm dịch vụ.
          </p>
          <p className="font-semibold text-foreground">2. Phạm vi và mục đích thu thập dữ liệu</p>
          <p>
            Chúng tôi thu thập các thông tin cơ bản phục vụ cho việc vận hành tài khoản cá nhân, bao gồm: 
            Email, Tên hiển thị, các cấu hình Persona Tiếp thị (Tệp người xem hướng tới), lịch sử bài đăng 
            do AI tạo ra và thông tin thanh toán (nếu có). Mục đích duy nhất là để cải thiện chất lượng 
            bài viết, tối ưu hóa các gợi ý prompt và tinh chỉnh chất lượng hình ảnh nghệ thuật cho thương hiệu của bạn.
          </p>
          <p className="font-semibold text-foreground">3. Bảo mật dữ liệu AI & API Keys</p>
          <p>
            Tất cả các khóa API cá nhân (Gemini, OpenAI...) được nạp vào hệ thống để vận hành tài khoản sẽ được 
            <strong> mã hóa hoàn toàn ở mức cơ sở dữ liệu bằng tiêu chuẩn mã hóa AES-256 cao cấp nhất</strong>. 
            Chúng tôi cam kết tuyệt đối không bao giờ chia sẻ, bán hoặc cung cấp dữ liệu huấn luyện, API Key hay thông tin 
            thương hiệu nội bộ của bạn cho bất kỳ bên thứ ba nào vì mục đích thương mại.
          </p>
          <p className="font-semibold text-foreground">4. Quyền kiểm soát dữ liệu của người dùng</p>
          <p>
            Bạn có toàn quyền kiểm soát thông tin tài khoản của mình. Bạn có thể tự do chỉnh sửa cấu hình tệp người xem, 
            sao chép lịch sử bài đăng hoặc yêu cầu xóa vĩnh viễn tài khoản cùng toàn bộ dữ liệu lịch sử bài viết 
            và hình ảnh liên quan khỏi hệ thống máy chủ của chúng tôi bất kỳ lúc nào thông qua bộ phận hỗ trợ khách hàng.
          </p>
          <p className="font-semibold text-foreground">5. Các thay đổi đối với Điều khoản bảo mật</p>
          <p>
            Chúng tôi có thể cập nhật các điều khoản này theo thời gian nhằm đáp ứng các thay đổi về công nghệ 
            hoặc quy định pháp luật. Mọi cập nhật quan trọng ảnh hưởng đến quyền lợi người dùng sẽ được gửi thông báo 
            trực tiếp qua email đăng ký hoặc hiển thị nổi bật trên giao diện Dashboard tối thiểu 7 ngày trước khi áp dụng.
          </p>
          <p className="font-semibold text-foreground">6. Quyền sở hữu trí tuệ đối với tác phẩm AI</p>
          <p>
            Toàn bộ các tác phẩm bao gồm bài viết, kịch bản nội dung và hình ảnh nghệ thuật do AI của SocialSence 
            sinh ra dựa trên yêu cầu của bạn sẽ thuộc quyền sở hữu trí tuệ và quyền thương mại hóa hoàn toàn của bạn. 
            SocialSence không yêu cầu bất kỳ khoản phí bản quyền hay giữ bất kỳ quyền phân phối nào đối với sản phẩm đầu ra này.
          </p>
        </div>
      )
    } else if (type === "prestige") {
      setModalTitle("Cam kết Uy tín & Quy chuẩn Chất lượng Dịch vụ")
      setModalContent(
        <div className="space-y-4 text-xs md:text-sm leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">1. Chất lượng AI hàng đầu thế giới</p>
          <p>
            SocialSence cam kết chỉ sử dụng các mô hình ngôn ngữ lớn (LLM) và các mô hình xử lý hình ảnh AI 
            tiên tiến nhất thời điểm hiện tại. Hệ thống liên tục được cập nhật các thuật toán tối ưu hóa Prompt 
            để đảm bảo chất lượng bài đăng chuẩn SEO, văn phong mạch lạc, đúng tone giọng thương hiệu của doanh nghiệp.
          </p>
          <p className="font-semibold text-foreground">2. Cam kết về tính ổn định hệ thống (SLA)</p>
          <p>
            Chúng tôi hiểu rằng nội dung mạng xã hội cần sự liên tục và đúng thời điểm. SocialSence cam kết duy trì 
            tổng thời gian hoạt động ổn định của máy chủ và API (Uptime SLA) đạt tối thiểu <strong>99.9%</strong>. 
            Mọi sự cố gián đoạn dịch vụ ngoài ý muốn sẽ được khắc phục trong thời gian ngắn nhất bởi đội ngũ kỹ sư túc trực 24/7.
          </p>
          <p className="font-semibold text-foreground">3. Minh bạch tuyệt đối về biểu phí</p>
          <p>
            Mọi gói dịch vụ (Free, Pro, Ultra) trên SocialSence đều được áp dụng biểu phí công khai, minh bạch. 
            Chúng tôi cam kết không áp dụng bất kỳ khoản phụ phí ẩn nào đối với người dùng trong suốt quá trình 
            trải nghiệm. Quy trình nâng cấp gói, hạ cấp hoặc yêu cầu hoàn phí giao dịch lỗi luôn được thực hiện rõ ràng, nhanh chóng.
          </p>
          <p className="font-semibold text-foreground">4. Bảo đảm an toàn giao dịch thanh toán</p>
          <p>
            Mọi giao dịch đăng ký gói cước trên website của chúng tôi đều được xử lý qua cổng thanh toán bảo mật 
            tiêu chuẩn quốc tế, bảo đảm an toàn 100% cho thông tin thẻ tín dụng cũng như tài khoản ngân hàng của bạn.
          </p>
          <p className="font-semibold text-foreground">5. Lắng nghe đóng góp từ cộng đồng người dùng</p>
          <p>
            Chúng tôi coi trọng từng ý kiến phản hồi của bạn. Widget góp ý tích hợp sẵn trên giao diện là kênh kết nối 
            trực tiếp giúp đội ngũ phát triển lắng nghe các đề xuất cải tiến tính năng, từ đó không ngừng nâng cấp 
            giao diện và tối ưu trải nghiệm sử dụng hàng ngày của bạn.
          </p>
        </div>
      )
    } else if (type === "support") {
      setModalTitle("Chính sách Hỗ trợ Kỹ thuật & Khách hàng Chuyên nghiệp")
      setModalContent(
        <div className="space-y-4 text-xs md:text-sm leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">1. Đa dạng các kênh tiếp nhận hỗ trợ</p>
          <p>
            Đội ngũ chăm sóc khách hàng của SocialSence luôn sẵn sàng phục vụ bạn qua các kênh liên lạc chính thức: 
            Email hỗ trợ support@socialsence.vn, kênh trò chuyện trực tuyến tích hợp ngay trên Dashboard, 
            và trang Fanpage chính thức trên Facebook để giải quyết nhanh mọi thắc mắc của bạn.
          </p>
          <p className="font-semibold text-foreground">2. Thời gian phản hồi cam kết (SLA Support)</p>
          <p>
            Chúng tôi phân loại thời gian phản hồi hỗ trợ dựa trên gói cước bạn đang sử dụng để tối ưu hiệu suất công việc:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Gói Ultra (Enterprise):</strong> Cam kết phản hồi và cử kỹ sư xử lý sự cố trong vòng tối đa <strong>2 giờ</strong> kể từ lúc nhận yêu cầu.</li>
            <li><strong>Gói Pro:</strong> Cam kết hỗ trợ phản hồi và khắc phục trong vòng tối đa <strong>12 giờ</strong>.</li>
            <li><strong>Gói Free:</strong> Tiếp nhận và hỗ trợ giải quyết thắc mắc trong vòng tối đa <strong>24 - 48 giờ</strong>.</li>
          </ul>
          <p className="font-semibold text-foreground">3. Phạm vi hỗ trợ kỹ thuật</p>
          <p>
            Hỗ trợ khách hàng của chúng tôi bao gồm: Xử lý sự cố đăng nhập tài khoản, giải đáp lỗi nạp quota, hướng dẫn 
            cấu hình API Key trong trang quản trị, tư vấn cách viết prompt hiệu quả để tối ưu kết quả sinh ảnh AI, 
            và hỗ trợ khắc phục các lỗi liên quan đến cổng thanh toán/giao dịch.
          </p>
          <p className="font-semibold text-foreground">4. Đội ngũ chuyên viên giàu kinh nghiệm</p>
          <p>
            Bạn sẽ được tư vấn trực tiếp bởi đội ngũ am hiểu sâu về công nghệ trí tuệ nhân tạo và có nhiều năm 
            kinh nghiệm trong lĩnh vực Digital Marketing. Chúng tôi không chỉ sửa lỗi kỹ thuật mà còn đồng hành 
            giúp bạn tinh chỉnh các thông số tệp người xem hướng tới để đạt được hiệu quả tiếp cận tốt nhất.
          </p>
        </div>
      )
    }
    setModalOpen(true)
  }

  return (
    <footer className="border-t border-border bg-muted/10 py-12 flex flex-col items-center gap-6">
      <div className="text-center max-w-sm px-4">
        <h4 className="font-serif text-lg font-bold">SocialSence</h4>
        <p className="text-xs text-muted-foreground mt-1">Đồng hành cùng hành trình sáng tạo nội dung số chất lượng cao của bạn.</p>
      </div>

      {/* Joly UI Dock (Basic Usage) for Social & Legal Links */}
      <Dock iconSize={40} magnification={50} className="h-14">
        <DockItem onClick={() => window.open("https://www.facebook.com/share/1Hydax52ho/?mibextid=wwXIfr", "_blank")}>
          <DockIcon><FacebookIcon className="size-5" /></DockIcon>
          <DockLabel>Facebook</DockLabel>
        </DockItem>
        
        <DockSeparator />

        <DockItem onClick={() => showContent("privacy")}>
          <DockIcon><FileText className="size-5" /></DockIcon>
          <DockLabel>Điều khoản bảo mật</DockLabel>
        </DockItem>
        <DockItem onClick={() => showContent("prestige")}>
          <DockIcon><Shield className="size-5" /></DockIcon>
          <DockLabel>Uy tín</DockLabel>
        </DockItem>
        <DockItem onClick={() => showContent("support")}>
          <DockIcon><HelpCircle className="size-5" /></DockIcon>
          <DockLabel>Hỗ trợ chuyên nghiệp</DockLabel>
        </DockItem>
      </Dock>

      <div className="text-center text-[10px] text-muted-foreground font-mono mt-2">
        &copy; {new Date().getFullYear()} SocialSence. Built with Joly UI.
      </div>

      {/* Trang nội dung mở ở giữa màn hình (Dialog Modal) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-6 rounded-2xl bg-background border border-border shadow-xl">
          <DialogHeader className="border-b pb-4 mb-4 shrink-0">
            <DialogTitle className="font-serif text-lg md:text-xl font-bold text-foreground">
              {modalTitle}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 overflow-y-auto pr-2">
            {modalContent}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </footer>
  )
}
