"use client";

import { useEffect, useRef, useState } from "react";

export interface UseInViewOptions {
  /** Fraction of the element that must be visible to trigger. */
  threshold?: number;
  /** Margin around the root, e.g. "0px 0px -10% 0px" to trigger a bit early. */
  rootMargin?: string;
  /** Keep the element revealed after it first enters the viewport. */
  once?: boolean;
}

/**
 * Lightweight IntersectionObserver hook. Returns a ref to attach to the
 * observed element and a boolean that flips to `true` once it enters view.
 *
 * Falls back to "always visible" when IntersectionObserver is unavailable
 * (older browsers, SSR hydration) so content never stays hidden.
 */
export function useInView<T extends Element = HTMLDivElement>({
  threshold = 0.15,
  rootMargin = "0px 0px -10% 0px",
  once = true,
}: UseInViewOptions = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, inView };
}
