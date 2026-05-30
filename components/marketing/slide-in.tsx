"use client";

import * as React from "react";
import { useInView } from "@/lib/hooks/use-in-view";
import { cn } from "@/lib/utils";

export interface SlideInProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Direction the content slides in from when it enters the viewport. */
  from?: "left" | "right";
  /** Stagger delay in ms, applied via inline transition-delay. */
  delay?: number;
}

/**
 * Horizontal counterpart to <Reveal />. Content slides in from the left or
 * right the first time it scrolls into view, so alternating rows can enter
 * from opposite sides and reinforce a zigzag rhythm.
 *
 * Reuses the existing useInView hook (no new dependencies) and respects
 * prefers-reduced-motion via motion-reduce utilities.
 */
export function SlideIn({
  from = "left",
  delay = 0,
  className,
  style,
  children,
  ...props
}: SlideInProps) {
  const { ref, inView } = useInView<HTMLDivElement>();

  const hidden =
    from === "left" ? "-translate-x-10 opacity-0" : "translate-x-10 opacity-0";

  return (
    <div
      ref={ref}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms", ...style }}
      className={cn(
        "transition-all duration-700 ease-out will-change-transform motion-reduce:transition-none",
        inView
          ? "translate-x-0 opacity-100"
          : cn(hidden, "motion-reduce:translate-x-0 motion-reduce:opacity-100"),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
