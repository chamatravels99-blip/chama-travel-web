"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

export type ScrollRevealVariant =
  | "fade-up"
  | "fade-in"
  | "zoom-in"
  | "slide-left"
  | "slide-right";

export type ScrollRevealProps = {
  children: ReactNode;
  variant?: ScrollRevealVariant;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
};

export default function ScrollReveal({
  children,
  variant = "fade-up",
  delay = 0,
  duration = 650,
  className = "",
  once = true,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const revealLater = () => {
      window.requestAnimationFrame(() => setRevealed(true));
    };

    if (
      typeof window === "undefined" ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      revealLater();
      return;
    }

    // If element is already visible in the initial viewport, reveal smoothly
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.96 && rect.bottom > 0) {
      revealLater();
      if (once) return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setRevealed(false);
          }
        }
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px",
      },
    );

    observer.observe(node);

    // Fallback safety timer so content is never permanently hidden
    const fallbackTimer = window.setTimeout(() => {
      const currentRect = node.getBoundingClientRect();
      if (currentRect.top < window.innerHeight * 1.1) {
        setRevealed(true);
      }
    }, 1800);

    return () => {
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
    };
  }, [once]);

  const style: CSSProperties = {
    transitionDuration: `${duration}ms`,
    transitionDelay: `${delay}ms`,
  };

  return (
    <div
      ref={ref}
      data-variant={variant}
      data-revealed={revealed ? "true" : "false"}
      style={style}
      className={`scroll-reveal ${className}`}
    >
      {children}
    </div>
  );
}
