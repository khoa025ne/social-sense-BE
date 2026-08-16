import { Link, useLocation } from "react-router-dom"
import { useAuthStore } from "@/stores/auth-store"
import { useUIStore } from "@/stores/ui-store"
import { authApi } from "@/api/auth"
import { QuotaRing } from "@workspace/ui/components/quota-ring"
import { TierBadge } from "@workspace/ui/components/tier-badge"
import { cn } from "@workspace/ui/lib/utils"
import logoUrl from "@/assets/logo.svg"

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    label: "Nội dung",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z" />
      </svg>
    ),
    children: [
      { label: "Tạo mới", href: "/content/generate" },
      { label: "Lịch sử", href: "/content/history" },
      { label: "Ảnh AI", href: "/content/image-wizard" },
    ],
  },
  {
    label: "Phân tích",
    href: "/analytics",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m7 11 4-4 4 4 5-5" />
      </svg>
    ),
    children: [
      { label: "Tổng quan", href: "/analytics" },
      { label: "Upload", href: "/analytics/upload" },
    ],
  },
  {
    label: "Xu hướng",
    href: "/trends",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    ),
  },
  {
    label: "Tri thức",
    href: "/knowledge",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      </svg>
    ),
  },
  {
    label: "Quản trị",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    children: [
      { label: "Tổng quan", href: "/admin/dashboard" },
      { label: "Người dùng", href: "/admin/users" },
      { label: "Khóa API", href: "/admin/api-keys" },
      { label: "Thống kê", href: "/admin/stats" },
    ],
  },
  {
    label: "Cài đặt",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    children: [
      { label: "Tài khoản", href: "/settings" },
      { label: "Tệp người xem hướng tới", href: "/settings/persona" },
      { label: "Gói cước", href: "/settings/subscription" },
      { label: "Thanh toán", href: "/settings/billing" },
    ],
  },
]

export function Sidebar() {
  const location = useLocation()
  const { user, quota } = useAuthStore()
  const { sidebarCollapsed } = useUIStore()
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set())
  const [beOnline, setBeOnline] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "https://truthful-youth-production-d00b.up.railway.app"
        const res = await fetch(`${apiUrl}/payment/plans`)
        if (res.ok) setBeOnline(true)
        else setBeOnline(false)
      } catch {
        setBeOnline(false)
      }
    }

    const syncUserData = async () => {
      try {
        const [profile, quotaInfo] = await Promise.all([
          authApi.getMe(),
          authApi.getQuota()
        ])
        if (profile) useAuthStore.getState().setUser(profile)
        if (quotaInfo) useAuthStore.getState().setQuota(quotaInfo)
      } catch {
        // ignore if not logged in
      }
    }

    checkConnection()
    syncUserData()
  }, [])

  // Auto-expand group containing current path
  React.useEffect(() => {
    navItems.forEach((item) => {
      if (item.children?.some((child) => location.pathname.startsWith(child.href))) {
        setExpandedGroups((prev) => new Set(prev).add(item.label))
      }
    })
  }, [location.pathname])

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const isActive = (href: string) => location.pathname === href

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar",
        "transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-[280px]"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-4">
        <Link to="/dashboard" className="flex items-center gap-2 overflow-hidden w-full">
          <img src={logoUrl} alt="SocialSence Logo" className="h-10 w-auto dark:invert shrink-0" />
          {!sidebarCollapsed && (
            <span className="text-lg font-semibold tracking-tight truncate" style={{ fontFamily: "var(--font-serif)" }}>
              SocialSence
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems
            .filter((item) => {
              if (item.label === "Tri thức" || item.label === "Quản trị") {
                return user?.roles?.includes("Admin")
              }
              return true
            })
            .map((item) => (
              <li key={item.label}>
                {item.href && !item.children ? (
                  <Link
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive(item.href)
                      ? "bg-foreground/[0.05] font-medium text-foreground"
                      : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground"
                  )}
                >
                  {isActive(item.href) && (
                    <div className="absolute left-0 h-6 w-[3px] rounded-r-full bg-foreground" />
                  )}
                  {item.icon}
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => toggleGroup(item.label)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      item.children?.some((c) => isActive(c.href))
                        ? "font-medium text-foreground"
                        : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground"
                    )}
                  >
                    {item.icon}
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className={cn(
                            "transition-transform duration-200",
                            expandedGroups.has(item.label) && "rotate-90"
                          )}
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </>
                    )}
                  </button>
                  {!sidebarCollapsed && expandedGroups.has(item.label) && item.children && (
                    <ul className="ml-8 mt-1 space-y-0.5">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            to={child.href}
                            className={cn(
                              "block rounded-md px-3 py-1.5 text-sm transition-colors",
                              isActive(child.href)
                                ? "bg-foreground/[0.05] font-medium text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom: Quota + User */}
      {!sidebarCollapsed && (
        <div className="border-t border-border p-4 space-y-3">
          {quota && (
            <div className="flex items-center gap-3">
              <QuotaRing
                remaining={quota.remainingQuota}
                total={quota.dailyQuotaLimit}
                isUnlimited={quota.isUnlimited}
                size={40}
                strokeWidth={3}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">Quota hôm nay</p>
                <p className="text-xs text-muted-foreground">
                  {quota.isUnlimited ? "Unlimited" : `${quota.remainingQuota}/${quota.dailyQuotaLimit} lượt`}
                </p>
              </div>
            </div>
          )}
          {user && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.08] text-sm font-medium">
                  {user.displayName?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.displayName}</p>
                  <div className="flex items-center gap-1.5">
                    <Link to="/settings/subscription" title="Nâng cấp gói cước" className="inline-flex">
                      <TierBadge tier={quota?.tier || user.tier} />
                    </Link>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  useAuthStore.getState().logout()
                  window.location.href = "/auth/login"
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground transition-colors shrink-0"
                title="Đăng xuất"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          )}
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground font-mono">
            {beOnline === true ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="truncate">BE: Connected (Railway)</span>
              </>
            ) : beOnline === false ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                </span>
                <span className="truncate text-rose-500 font-semibold">BE: Disconnected</span>
              </>
            ) : (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                </span>
                <span className="truncate">BE: Connecting...</span>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}

import React from "react"
