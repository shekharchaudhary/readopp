"use client";

import { useEffect, useState } from "react";

/**
 * Drives a synthetic demo loop. Returns the current time-in-cycle in ms,
 * cycling from 0 to cycleMs forever. With prefers-reduced-motion the tick
 * is pinned to ~70% of the cycle so the demo stays in a "settled" frame
 * (everything visible) rather than animating.
 */
export function useDemoTick(cycleMs: number, tickMs = 100): number {
  const [t, setT] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) {
      setT(Math.floor(cycleMs * 0.7));
      return;
    }
    const start = performance.now();
    const id = setInterval(() => {
      setT((performance.now() - start) % cycleMs);
    }, tickMs);
    return () => clearInterval(id);
  }, [reduced, cycleMs, tickMs]);

  return t;
}

export function DemoFrame({
  children,
  label,
  aspect = "auto",
}: {
  children: React.ReactNode;
  label?: string;
  /** Tailwind aspect-* override; default is auto height */
  aspect?: "auto" | string;
}) {
  return (
    <div
      className={
        "relative w-full overflow-hidden rounded-xl border border-paper-line bg-paper shadow-[0_1px_0_rgba(232,93,42,0.06)] " +
        (aspect !== "auto" ? aspect : "")
      }
      aria-hidden
    >
      {label && (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-faint backdrop-blur">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

export function Fade({
  show,
  children,
  className,
  durationMs = 280,
}: {
  show: boolean;
  children: React.ReactNode;
  className?: string;
  durationMs?: number;
}) {
  return (
    <div
      className={
        "transition-all ease-out " +
        (show
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-1 opacity-0") +
        " " +
        (className ?? "")
      }
      style={{ transitionDuration: `${durationMs}ms` }}
    >
      {children}
    </div>
  );
}

/** True if t is inside [from, to). */
export function between(t: number, from: number, to: number): boolean {
  return t >= from && t < to;
}
