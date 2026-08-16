import { useEffect } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { Sidebar } from "./sidebar"
import { TopBar } from "./top-bar"
import { FeedbackWidget } from "@workspace/ui/components/feedback-widget"
import { cn } from "@workspace/ui/lib/utils"
import { useAuthStore } from "@/stores/auth-store"
import { authApi } from "@/api/auth"

/**
 * AppLayout — Main authenticated layout with sidebar + topbar
 */
export function AppLayout() {
  const { accessToken, setQuota, logout } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!accessToken) {
      navigate("/auth/login")
      return
    }

    const loadQuota = async () => {
      try {
        const q = await authApi.getQuota()
        setQuota(q)
      } catch (error: any) {
        console.error("Failed to load quota", error)
        if (error.status === 401) {
          logout()
          navigate("/auth/login")
        }
      }
    }

    loadQuota()
    const interval = setInterval(loadQuota, 60000)
    return () => clearInterval(interval)
  }, [accessToken, setQuota, navigate, logout])

  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      {/* Sidebar — hidden on mobile, shown on desktop */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main
          className={cn(
            "flex-1 overflow-y-auto",
            "px-4 py-6 md:px-8 md:py-8"
          )}
        >
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Joly UI Floating Feedback Widget */}
      <FeedbackWidget />
    </div>
  )
}
