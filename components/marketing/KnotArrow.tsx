"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hand-drawn rope-knot arrow used in the closer. Three strokes pencil in
 * once when the SVG scrolls into view:
 *   1. Descender — the rope hanging straight down. Drawn first so the
 *      knot loop can pass in front of it at the bottom.
 *   2. Loop — closes around the descender with a small gap at the top,
 *      where the descender visually crosses in front. The gap + the
 *      loop-over-descender crossing at the bottom give the over-under
 *      illusion of an overhand knot.
 *   3. Arrowhead — pops in last so the eye lands on the action point.
 *
 * IntersectionObserver gates the animation so the user actually sees it
 * play instead of finding it pre-finished after a scroll.
 */
export function KnotArrow() {
  const ref = useRef<SVGSVGElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true);
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
    <svg
      ref={ref}
      aria-hidden
      viewBox="0 0 120 160"
      className={`mx-auto h-32 w-24 knot text-mint ${seen ? "draw" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Loop's BACK arc — drawn first so the descender covers it at the
          lower crossing, putting the rope behind the descender there. */}
      <path
        className="knot-loop-back"
        pathLength={1}
        d="M28 48 C 30 78, 90 78, 92 48"
      />
      {/* Descender — slight bezier wobble (vs straight L) for the
          hand-drawn rope feel the user asked for. Drawn second: it
          covers the back arc and is itself covered by the front arc. */}
      <path
        className="knot-descender"
        pathLength={1}
        d="M60 5 C 62 22, 58 38, 60 54 C 62 76, 59 102, 60 134"
      />
      {/* Loop's FRONT arc — drawn last, covers the descender at the
          upper crossing so the rope appears to pass in front there.
          Together with the back arc, the rope weaves over-under-over
          through the descender — an overhand knot. */}
      <path
        className="knot-loop-front"
        pathLength={1}
        d="M92 48 C 94 20, 30 20, 28 48"
      />
      <path
        className="knot-arrow"
        pathLength={1}
        d="M44 118 L 60 140 L 76 118"
      />
    </svg>
  );
}
