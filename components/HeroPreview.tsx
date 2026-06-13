"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { sourceLabel } from "@/lib/shared/source";

interface HeroExplainer {
  id: string;
  title: string;
  url: string;
  panel: { sectionId: string; heading: string; content: string; format: "svg" | "html" } | null;
}

export function HeroPreview() {
  const [items, setItems] = useState<HeroExplainer[]>([]);
  const [cursor, setCursor] = useState(0);
  const [replay, setReplay] = useState(0); // bump to restart animation
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/explainers", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        // Filter to items where the first panel renders as SVG (most visual)
        const svgItems = (data.explainers || []) as HeroExplainer[];
        if (!cancelled) setItems(svgItems.filter((x) => x.panel?.format === "svg"));
      } catch {
        // gallery is decorative — silently no-op
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    timerRef.current = setInterval(() => {
      setCursor((c) => (c + 1) % items.length);
      setReplay((r) => r + 1);
    }, 7500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items.length]);

  if (items.length === 0) return null;
  const item = items[cursor];
  if (!item?.panel) return null;

  return (
    <Link
      href={`/e/${item.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-paper-line bg-surface transition-shadow hover:shadow-[0_4px_20px_rgba(196,122,60,0.08)]"
      aria-label={`Open: ${item.panel.heading || item.title}`}
    >
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-deep">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-pulse" />
          live example
        </span>
      </div>
      <div className="absolute right-4 top-4 z-10 text-[11px] text-ink-faint">
        {sourceLabel(item.url)}
      </div>

      {/* key={replay} remounts the wrapper, which re-fires CSS animations */}
      <div
        key={`${item.id}-${replay}`}
        className="hero-anim panel-svg-wrap force-light bg-white px-6 pb-4 pt-14 sm:px-10 sm:pt-16"
        dangerouslySetInnerHTML={{ __html: item.panel.content }}
      />

      <div className="border-t border-paper-line bg-paper-soft/60 px-6 py-3 text-sm text-ink-soft sm:px-10">
        <span className="font-medium text-ink">
          {item.panel.heading || item.title}
        </span>
        <span className="ml-2 text-ink-muted">
          → see all panels
        </span>
      </div>
    </Link>
  );
}
