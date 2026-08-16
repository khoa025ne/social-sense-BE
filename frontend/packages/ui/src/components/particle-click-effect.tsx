import * as React from "react"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  color: string
  size: number
  decay: number
}

export function ParticleClickEffect() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const particlesRef = React.useRef<Particle[]>([])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Resize canvas to fill viewport
    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener("resize", handleResize)
    handleResize()

    // Animation Loop
    let animationId: number
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      const particles = particlesRef.current
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.05 // Gravity factor
        p.alpha -= p.decay
        
        if (p.alpha <= 0) {
          particles.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        
        // Glow effect
        ctx.shadowBlur = p.size * 2
        ctx.shadowColor = p.color
        
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      animationId = requestAnimationFrame(animate)
    }
    animate()

    // Click Handler
    const handleClick = (e: MouseEvent) => {
      const x = e.clientX
      const y = e.clientY
      const count = 12 + Math.floor(Math.random() * 8)
      
      const newParticles: Particle[] = []
      const colors = [
        "rgba(17, 17, 17, 0.8)", // Black/Charcoal
        "rgba(120, 119, 116, 0.8)", // Muted Gray
        "rgba(224, 224, 224, 0.8)", // Off-White
        "rgba(255, 255, 255, 0.9)" // Pure White
      ]

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 1.5 + Math.random() * 3
        const size = 1.5 + Math.random() * 2
        const decay = 0.015 + Math.random() * 0.02

        newParticles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color: colors[Math.floor(Math.random() * colors.length)],
          size,
          decay
        })
      }

      particlesRef.current.push(...newParticles)
    }

    window.addEventListener("click", handleClick)

    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("click", handleClick)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ mixBlendMode: "difference" }}
    />
  )
}
