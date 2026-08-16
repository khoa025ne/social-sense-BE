import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuthStore } from "@/stores/auth-store"

/**
 * ProtectedRoute — Requires authentication
 * Redirects to /auth/login if not authenticated
 */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

/**
 * GuestRoute — Only accessible when NOT authenticated
 * Redirects to /dashboard if already logged in
 */
export function GuestRoute() {
  const { isAuthenticated } = useAuthStore()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

/**
 * AdminRoute — Requires Admin role
 * Redirects to /dashboard if user is not Admin
 */
export function AdminRoute() {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  const isAdmin = user?.roles?.includes("Admin")
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

/**
 * OnboardingGuard — Requires auth but checks hasContext
 * Redirects to /onboarding if user hasn't completed persona setup
 */
export function OnboardingGuard() {
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
