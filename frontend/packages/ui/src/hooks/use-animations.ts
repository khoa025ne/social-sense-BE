import { useEffect, useRef, useState, useCallback } from "react"

/**
 * useScrollReveal — IntersectionObserver-based fade-in animation
 * Elements fade in as they enter the viewport with a gentle translate + blur.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit & { once?: boolean }
) {
  const ref = useRef<T>(null)
  const [isVisible, setIsVisible] = useState(false)
  const { once = true, threshold = 0.1, rootMargin = "0px 0px -40px 0px" } = options ?? {}

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) observer.unobserve(el)
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [once, threshold, rootMargin])

  return { ref, isVisible }
}

/**
 * useStaggerReveal — Staggered reveal for lists/grids
 * Returns a ref for the container and visibility state.
 */
export function useStaggerReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit & { staggerMs?: number }
) {
  const containerRef = useRef<T>(null)
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set())
  const { staggerMs = 80, threshold = 0.05, rootMargin = "0px 0px -20px 0px" } = options ?? {}

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const children = Array.from(container.children)
          children.forEach((_, index) => {
            setTimeout(() => {
              setVisibleIndices((prev) => new Set(prev).add(index))
            }, index * staggerMs)
          })
          observer.unobserve(container)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [staggerMs, threshold, rootMargin])

  const isItemVisible = useCallback(
    (index: number) => visibleIndices.has(index),
    [visibleIndices]
  )

  return { containerRef, isItemVisible, visibleIndices }
}

/**
 * useCountUp — Animated number counting
 */
export function useCountUp(
  end: number,
  options?: {
    duration?: number
    start?: number
    enabled?: boolean
    decimals?: number
  }
) {
  const { duration = 1200, start = 0, enabled = true, decimals = 0 } = options ?? {}
  const [value, setValue] = useState(start)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) {
      setValue(start)
      return
    }

    const startTime = performance.now()
    const diff = end - start

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = start + diff * eased

      setValue(Number(current.toFixed(decimals)))

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [end, start, duration, enabled, decimals])

  return value
}
