import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"

// Tự động reload trang khi gặp lỗi tải module động do phiên bản build mới thay đổi hash file
window.addEventListener("error", (event) => {
  const errorMessage = event.message || "";
  if (
    errorMessage.includes("Failed to fetch dynamically imported module") ||
    errorMessage.includes("Importing a module script failed")
  ) {
    console.warn("Lỗi tải module động phát hiện. Đang tải lại trang để cập nhật phiên bản mới nhất...");
    window.location.reload();
  }
}, true);

// Bắt lỗi unhandledrejection của Promise (lazy component import)
window.addEventListener("unhandledrejection", (event) => {
  const errorReason = event.reason?.toString() || "";
  if (
    errorReason.includes("Failed to fetch dynamically imported module") ||
    errorReason.includes("Importing a module script failed")
  ) {
    console.warn("Lỗi Promise unhandled rejection tải module. Đang tải lại trang...");
    window.location.reload();
  }
});

import "@workspace/ui/globals.css"
import { router } from "./router.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
