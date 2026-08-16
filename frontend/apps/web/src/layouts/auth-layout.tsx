import { Outlet } from "react-router-dom"
import logoUrl from "@/assets/logo.svg"

/**
 * AuthLayout — Centered card layout for login/register/reset password
 * Features ambient gradient blob and Double-Bezel card styling
 */
export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {/* Ambient blob */}
      <div className="ambient-blob -top-20 -right-20" />
      <div className="ambient-blob -bottom-20 -left-20" style={{ animationDelay: "-10s" }} />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <a href="/" className="inline-flex items-center gap-2">
            <img src={logoUrl} alt="SocialSence Logo" className="h-14 w-auto dark:invert shrink-0" />
            <span className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
              SocialSence
            </span>
          </a>
        </div>

        {/* Card with Double-Bezel */}
        <div className="bezel-outer">
          <div className="bezel-inner p-8">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
