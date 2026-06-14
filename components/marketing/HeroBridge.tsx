"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hand-drawn bridge between the input card and the post mockup. Tiny accent
 * dot + "Readopp" wordmark over a curved arrow that draws in once the SVG
 * scrolls into view. Re-uses .flow-arrows (the same dashed-stroke setup as
 * the source-pill arrows above) so the two animations share visual language.
 */
export function HeroBridge() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = svgRef.current;
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
      { rootMargin: "0px 0px -10% 0px", threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center px-2">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-accent" />
        <span className="font-display text-sm font-medium tracking-tight text-ink">
          Readopp
        </span>
      </div>
      <svg
        ref={svgRef}
        aria-hidden
        viewBox="0 0 120 32"
        className={`flow-arrows mt-3 h-9 w-28 text-ink-soft ${shown ? "flow-in" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          pathLength={1}
          d="M6 20 C 30 6, 70 30, 100 16 M92 9 L 102 16 L 92 23"
        />
      </svg>
    </div>
  );
}
