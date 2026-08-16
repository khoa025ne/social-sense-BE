"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

interface MagneticTextProps {
  text: string;
  hoverText?: string;
  className?: string;
}

export function MagneticText({
  text = "CREATIVE",
  hoverText = "EXPLORE",
  className,
}: MagneticTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const innerTextRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const mousePos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    const lerp = (start: number, end: number, factor: number) =>
      start + (end - start) * factor;

    const animate = () => {
      currentPos.current.x = lerp(
        currentPos.current.x,
        mousePos.current.x,
        0.15,
      );
      currentPos.current.y = lerp(
        currentPos.current.y,
        mousePos.current.y,
        0.15,
      );

      if (circleRef.current) {
        circleRef.current.style.transform = `translate(${currentPos.current.x}px, ${currentPos.current.y}px) translate(-50%, -50%)`;
      }

      if (innerTextRef.current) {
        innerTextRef.current.style.transform = `translate(${-currentPos.current.x}px, ${-currentPos.current.y}px)`;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mousePos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mousePos.current = { x, y };
    currentPos.current = { x, y };
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      ref={containerRef}
      className={cn(
        "relative inline-flex cursor-none select-none items-center justify-center",
        className,
      )}
    >
      <span className="font-bold text-5xl text-foreground tracking-wide">
        {text}
      </span>

      <div
        ref={circleRef}
        className="pointer-events-none absolute top-0 left-0 overflow-hidden rounded-full bg-foreground"
        style={{
          width: isHovered ? 150 : 0,
          height: isHovered ? 150 : 0,
          transition:
            "width 0.5s cubic-bezier(0.33, 1, 0.68, 1), height 0.5s cubic-bezier(0.33, 1, 0.68, 1)",
          willChange: "transform, width, height",
        }}
      >
        <div
          ref={innerTextRef}
          className="absolute flex items-center justify-center"
          style={{
            width: containerSize.width,
            height: containerSize.height,
            top: "50%",
            left: "50%",
            willChange: "transform",
          }}
        >
          <span className="whitespace-nowrap font-bold text-5xl text-background tracking-wide">
            {hoverText}
          </span>
        </div>
      </div>
    </div>
  );
}

// Advanced Canvas-Based Morphing Cursor with smooth trailing dots
export function MorphingCursor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mousePos = useRef({ x: -100, y: -100 });
  const isHovered = useRef(false);
  
  // Array to hold history of points for trailing effect
  const trailPoints = useRef<Array<{ x: number; y: number }>>([]);
  const maxTrailPoints = 12; // Length of the tail

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    // Track mouse coordinates
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Track interactive hovers
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.closest("a") ||
        target.closest("button") ||
        target.classList.contains("cursor-pointer") ||
        target.closest(".cursor-pointer")
      ) {
        isHovered.current = true;
      } else {
        isHovered.current = false;
      }
    };
    window.addEventListener("mouseover", handleMouseOver);

    // Initial trail setup
    for (let i = 0; i < maxTrailPoints; i++) {
      trailPoints.current.push({ x: -100, y: -100 });
    }

    let animationId: number;
    const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;

    // Animation Loop
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Update first point in trail towards mouse pos
      const firstPoint = trailPoints.current[0];
      if (firstPoint) {
        // Main pointer uses fast interpolation
        firstPoint.x = lerp(firstPoint.x, mousePos.current.x, 0.3);
        firstPoint.y = lerp(firstPoint.y, mousePos.current.y, 0.3);
      }

      // 2. Update all other points to follow the previous point with lag
      for (let i = 1; i < maxTrailPoints; i++) {
        const prev = trailPoints.current[i - 1];
        const curr = trailPoints.current[i];
        if (prev && curr) {
          curr.x = lerp(curr.x, prev.x, 0.35);
          curr.y = lerp(curr.y, prev.y, 0.35);
        }
      }

      // 3. Draw trail dots
      for (let i = maxTrailPoints - 1; i >= 0; i--) {
        const point = trailPoints.current[i];
        if (!point) continue;

        // Skip drawing off-screen coordinates
        if (point.x < 0 || point.y < 0) continue;

        const ratio = 1 - i / maxTrailPoints; // 1 at head, 0 at tail
        
        ctx.save();
        ctx.globalCompositeOperation = "difference";

        // Head changes size when hovering buttons/links
        let radius = 4;
        if (i === 0) {
          radius = isHovered.current ? 16 : 6;
        } else {
          radius = (isHovered.current ? 6 : 3) * ratio;
        }

        // Draw shadow glow for first 3 items
        if (i < 3) {
          ctx.shadowBlur = i === 0 ? 12 : 6;
          ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
        }

        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[999999] hidden md:block"
      style={{ mixBlendMode: "difference", willChange: "transform" }}
    />
  );
}
