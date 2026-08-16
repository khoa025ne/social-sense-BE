import { motion, AnimatePresence } from "motion/react"
import * as React from "react"
import { cn } from "../lib/utils"

interface FallingTextProps {
  words: string[]
  className?: string
  interval?: number
}

export function FallingText({ words, className, interval = 2500 }: FallingTextProps) {
  const [index, setIndex] = React.useState(0)

  React.useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length)
    }, interval)
    return () => clearInterval(timer)
  }, [words.length, interval])

  const currentWord = words[index]
  const letters = currentWord.split("")

  return (
    <span className={cn("relative inline-flex overflow-hidden pb-1", className)}>
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          className="inline-flex flex-wrap justify-center"
        >
          {letters.map((letter, i) => (
            <motion.span
              key={`${index}-${i}`}
              initial={{ y: -40, opacity: 0, filter: "blur(4px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: 40, opacity: 0, filter: "blur(4px)" }}
              transition={{
                duration: 0.4,
                delay: i * 0.04,
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
              className="inline-block whitespace-pre"
            >
              {letter}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
