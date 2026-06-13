"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Class name applied to the wrapper once it enters the viewport. */
  active: string;
  /** Optional class always present on the wrapper. */
  className?: string;
  /** Tag to render. Defaults to span so it doesn't fight inline contexts. */
  as?: "span" | "div";
  /** Optional handler if the parent also wants to know about the toggle. */
  onShown?: () => void;
  children: React.ReactNode;
}

/**
 * Adds `active` (e.g. "flow-in", "hl-in", "knot draw") to its wrapper the
 * first time it scrolls into view. CSS keyframes scoped to that class then
 * play exactly when the user can see them — no more "missed" animations
 * that fired on page load behind the hero. Single-shot per mount.
 */
export function InViewClass({
  active,
  className = "",
  as = "span",
  onShown,
  children,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      onShown?.();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            onShown?.();
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onShown]);

  const cls = `${className} ${shown ? active : ""}`.trim();

  if (as === "div") {
    return (
      <div ref={ref as React.RefObject<HTMLDivElement>} className={cls}>
        {children}
      </div>
    );
  }
  return (
    <span ref={ref as React.RefObject<HTMLSpanElement>} className={cls}>
      {children}
    </span>
  );
}
