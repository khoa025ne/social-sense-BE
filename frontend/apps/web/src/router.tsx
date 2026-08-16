import { createBrowserRouter } from "react-router-dom"
import { ProtectedRoute, GuestRoute, AdminRoute, OnboardingGuard } from "@/guards/route-guards"
import { PublicLayout } from "@/layouts/public-layout"
import { AuthLayout } from "@/layouts/auth-layout"
import { AppLayout } from "@/layouts/app-layout"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/auth-store"

function LogoutPage() {
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  useEffect(() => {
    logout()
    navigate("/auth/login")
  }, [logout, navigate])

  return null
}

// ─── Lazy-loaded pages ───
import { lazy } from "react"

const LandingPage = lazy(() => import("@/pages/landing"))
const LoginPage = lazy(() => import("@/pages/auth/login"))
const RegisterPage = lazy(() => import("@/pages/auth/register"))
const ForgotPasswordPage = lazy(() => import("@/pages/auth/forgot-password"))
const ResetPasswordPage = lazy(() => import("@/pages/auth/reset-password"))
const OnboardingPage = lazy(() => import("@/pages/onboarding"))
const DashboardPage = lazy(() => import("@/pages/dashboard"))
const ContentGeneratePage = lazy(() => import("@/pages/content/generate"))
const ContentHistoryPage = lazy(() => import("@/pages/content/history"))
const ImageWizardPage = lazy(() => import("@/pages/content/image-wizard"))
const CheckAlignmentPage = lazy(() => import("@/pages/content/check-alignment"))
const AnalyticsPage = lazy(() => import("@/pages/analytics/index"))
const AnalyticsUploadPage = lazy(() => import("@/pages/analytics/upload"))
const AnalyticsReportPage = lazy(() => import("@/pages/analytics/report"))
const TrendsPage = lazy(() => import("@/pages/trends"))
const KnowledgePage = lazy(() => import("@/pages/knowledge"))
const SettingsPage = lazy(() => import("@/pages/settings/index"))
const PersonaPage = lazy(() => import("@/pages/settings/persona"))
const SubscriptionPage = lazy(() => import("@/pages/settings/subscription"))
const BillingPage = lazy(() => import("@/pages/settings/billing"))
const AdminDashboardPage = lazy(() => import("@/pages/admin/dashboard"))
const AdminUsersPage = lazy(() => import("@/pages/admin/users"))
const AdminApiKeysPage = lazy(() => import("@/pages/admin/api-keys"))
const AdminStatsPage = lazy(() => import("@/pages/admin/stats"))

export const router = createBrowserRouter([
  {
    path: "/logout",
    element: <LogoutPage />,
  },
  {
    path: "/auth/logout",
    element: <LogoutPage />,
  },
  // ─── Public routes ───
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <LandingPage /> },
    ],
  },

  // ─── Auth routes (guest only) ───
  {
    element: <GuestRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "/auth/login", element: <LoginPage /> },
          { path: "/auth/register", element: <RegisterPage /> },
          { path: "/auth/forgot-password", element: <ForgotPasswordPage /> },
          { path: "/auth/reset-password", element: <ResetPasswordPage /> },
        ],
      },
    ],
  },

  // ─── Onboarding (auth required, no context) ───
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/onboarding", element: <OnboardingPage /> },
    ],
  },

  // ─── App routes (auth + context required) ───
  {
    element: <OnboardingGuard />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/dashboard", element: <DashboardPage /> },

          // Content
          { path: "/content/generate", element: <ContentGeneratePage /> },
          { path: "/content/history", element: <ContentHistoryPage /> },
          { path: "/content/image-wizard", element: <ImageWizardPage /> },
          { path: "/content/check-alignment", element: <CheckAlignmentPage /> },

          // Analytics
          { path: "/analytics", element: <AnalyticsPage /> },
          { path: "/analytics/upload", element: <AnalyticsUploadPage /> },
          { path: "/analytics/report/:id", element: <AnalyticsReportPage /> },

          // Trends & Knowledge
          { path: "/trends", element: <TrendsPage /> },

          // Settings
          { path: "/settings", element: <SettingsPage /> },
          { path: "/settings/persona", element: <PersonaPage /> },
          { path: "/settings/subscription", element: <SubscriptionPage /> },
          { path: "/settings/billing", element: <BillingPage /> },
        ],
      },
    ],
  },

  // ─── Admin routes ───
  {
    element: <AdminRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/admin/dashboard", element: <AdminDashboardPage /> },
          { path: "/admin/users", element: <AdminUsersPage /> },
          { path: "/admin/api-keys", element: <AdminApiKeysPage /> },
          { path: "/admin/stats", element: <AdminStatsPage /> },
          { path: "/knowledge", element: <KnowledgePage /> },
        ],
      },
    ],
  },
])
