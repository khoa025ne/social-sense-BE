import { motion } from "motion/react"
import * as React from "react"
import { Sun, Moon } from "lucide-react"

interface AnimatedThemeToggleProps {
  className?: string
}

export function AnimatedThemeToggle({ className }: AnimatedThemeToggleProps) {
  const [theme, setTheme] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    // Detect current theme class from document
    const isDark = document.documentElement.classList.contains("dark")
    setTheme(isDark ? "dark" : "light")
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light"
    setTheme(nextTheme)
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className={`relative p-2 rounded-lg border hover:bg-muted/50 transition-colors duration-200 cursor-pointer overflow-hidden ${className || ""}`}
      aria-label="Toggle theme"
    >
      <motion.div
        animate={{ rotate: theme === "dark" ? 180 : 0, scale: theme === "dark" ? 0 : 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="text-primary size-5"
      >
        <Sun className="size-5" />
      </motion.div>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ rotate: theme === "dark" ? 0 : -180, scale: theme === "dark" ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="absolute inset-2 text-primary size-5"
      >
        <Moon className="size-5" />
      </motion.div>
    </button>
  )
}
