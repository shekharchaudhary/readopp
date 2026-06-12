"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
  /** Stroke color; defaults to the accent. */
  className?: string;
}

/**
 * Wraps a word/phrase and draws a hand-style marker squiggle beneath it
 * the first time it scrolls into view. The path uses pathLength=1 so the
 * dash-draw animation in globals.css works at any rendered width.
 */
export function Squiggle({ children, className }: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span
      ref={ref}
      className={`relative inline-block whitespace-nowrap ${shown ? "squiggle-in" : ""} ${className ?? ""}`}
    >
      {children}
      <svg
        aria-hidden
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        className="absolute -bottom-[0.18em] left-0 h-[0.22em] w-full text-accent"
        fill="none"
      >
        <path
          className="squiggle-path"
          pathLength={1}
          d="M2 7 C 14 2, 22 9, 34 5 C 46 1, 54 9, 66 5 C 78 1, 88 8, 98 4"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}
