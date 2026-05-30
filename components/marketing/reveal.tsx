"use client";

import * as React from "react";
import { useInView } from "@/lib/hooks/use-in-view";
import { cn } from "@/lib/utils";

export interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stagger delay in ms, applied via inline transition-delay. */
  delay?: number;
}

/**
 * Wraps content so it fades and slides up the first time it scrolls into view.
 * Uses a CSS transition (no animation libraries) and respects
 * prefers-reduced-motion via the `motion-reduce` utilities.
 */
export function Reveal({
  delay = 0,
  className,
  style,
  children,
  ...props
}: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms", ...style }}
      className={cn(
        "transition-all duration-700 ease-out will-change-transform motion-reduce:transition-none",
        inView
          ? "translate-y-0 opacity-100 blur-0"
          : "translate-y-6 opacity-0 blur-[2px] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:blur-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
