import { Link } from "react-router-dom"
import { useAuthStore } from "@/stores/auth-store"
import { useUIStore } from "@/stores/ui-store"
import { QuotaRing } from "@workspace/ui/components/quota-ring"
import { AnimatedThemeToggle } from "@workspace/ui/components/animated-theme-toggle"
import { Search } from "lucide-react"

export function TopBar() {
  const { user, quota } = useAuthStore()
  const { setSidebarCollapsed, sidebarCollapsed } = useUIStore()

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center border-b border-border glass">
      <div className="flex w-full items-center justify-between px-4 md:px-6">
        {/* Left: Toggle + Logo (mobile) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            aria-label="Toggle sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="16" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>

          {/* Search (desktop) */}
          <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground">
            <Search className="size-4" />
            <span>Tìm kiếm...</span>
            <kbd className="ml-4 font-mono text-[10px]">⌘K</kbd>
          </div>
        </div>

        {/* Right: Quota + Avatar + Theme Toggle */}
        <div className="flex items-center gap-3">
          {quota && (
            <div className="hidden md:block">
              <QuotaRing
                remaining={quota.remainingQuota}
                total={quota.dailyQuotaLimit}
                isUnlimited={quota.isUnlimited}
                size={36}
                strokeWidth={3}
              />
            </div>
          )}

          <AnimatedThemeToggle />

          <Link
            to="/"
            className="text-xs font-semibold px-2.5 py-1.5 border border-border rounded-lg bg-background text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Quay về Trang chủ Landing Page"
          >
            Trang chủ
          </Link>

          <Link
            to="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/[0.08] text-sm font-medium transition-transform hover:scale-105"
          >
            {user?.displayName?.charAt(0)?.toUpperCase() || "U"}
          </Link>
        </div>
      </div>
    </header>
  )
}
