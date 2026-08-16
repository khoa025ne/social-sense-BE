"use client";

import { motion, AnimatePresence } from "motion/react";
import * as React from "react";
import { cn } from "../lib/utils";

interface CharacterMorphProps {
  words: string[];
  className?: string;
  interval?: number;
}

export function CharacterMorph({ words, className, interval = 3000 }: CharacterMorphProps) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, interval);
    return () => clearInterval(timer);
  }, [words.length, interval]);

  const currentWord = words[index] || "";
  const letters = currentWord.split("");

  return (
    <span className={cn("relative inline-flex overflow-hidden pb-1 selection:bg-neutral-800", className)}>
      {/* SVG filter for the liquid/gooey morph feel */}
      <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <span style={{ filter: "url(#goo)" }} className="inline-flex flex-wrap justify-center">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={index}
            className="inline-flex"
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {letters.map((letter, i) => (
              <motion.span
                key={`${index}-${i}-${letter}`}
                initial={{ y: 25, opacity: 0, scale: 0.7, filter: "blur(4px)" }}
                animate={{ y: 0, opacity: 1, scale: 1, filter: "blur(0.01px)" }}
                exit={{ y: -25, opacity: 0, scale: 0.7, filter: "blur(4px)" }}
                transition={{
                  duration: 0.45,
                  delay: i * 0.03,
                  type: "spring",
                  stiffness: 280,
                  damping: 18,
                }}
                className="inline-block whitespace-pre select-none font-bold text-foreground"
              >
                {letter}
              </motion.span>
            ))}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
export default CharacterMorph;
