"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hero visual: a LinkedIn-style post mockup with a real Readopp carousel
 * panel rendered inside. Anchors the new positioning ("visual posts from
 * anything you read") with something the viewer recognizes — a post.
 *
 * Fetches /api/explainers and rotates through any SVG examples. Falls back
 * to a hand-crafted iceberg panel when none are available, so the hero
 * never renders empty on a fresh install.
 */

interface PanelLite {
  sectionId: string;
  heading: string;
  content: string;
  format: "svg" | "html";
}
interface ExampleItem {
  id: string;
  title: string;
  url: string;
  panel: PanelLite | null;
  /** The /api/explainers route also exposes panel[1]; we prefer it here
   *  because panel[0] is usually a hero stat callout. */
  secondPanel?: PanelLite | null;
}

// Hand-crafted fallback — used when there are no SVG examples in the gallery
// yet. Matches the metaphor templates so first-paint quality is consistent.
const FALLBACK_PANEL = {
  title: "What it really takes to ship",
  heading: "What users see vs what it took to build",
  source: "stripe.com",
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 480" role="img" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"><title>Iceberg</title><desc>The 10 percent users see vs the 90 percent it took to build</desc><rect x="0" y="200" width="680" height="280" fill="#E6F1FB" opacity="0.55"/><line x1="0" y1="200" x2="680" y2="200" stroke="#185FA5" stroke-width="1" opacity="0.4"/><line x1="0" y1="208" x2="680" y2="208" stroke="#185FA5" stroke-width="1" opacity="0.18"/><path d="M 300 200 L 330 108 L 366 156 L 396 200 Z" fill="#ffffff" stroke="#185FA5" stroke-width="1.5"/><path d="M 272 200 L 232 252 L 218 322 L 240 400 L 312 432 L 396 422 L 444 380 L 458 290 L 430 220 L 410 200 Z" fill="#ffffff" stroke="#185FA5" stroke-width="1.5" opacity="0.92"/><text x="338" y="316" font-size="56" font-weight="500" fill="#185FA5" text-anchor="middle" opacity="0.18">90%</text><line x1="384" y1="135" x2="490" y2="105" stroke="#6B6B6B" stroke-width="1"/><circle cx="384" cy="135" r="2.5" fill="#6B6B6B"/><text x="500" y="100" font-size="14" font-weight="500" fill="#0C447C">The 10% users see</text><text x="500" y="118" font-size="12" fill="#3a3a3a">Polished UI, the demo,</text><text x="500" y="134" font-size="12" fill="#3a3a3a">the launch tweet</text><line x1="290" y1="340" x2="160" y2="380" stroke="#6B6B6B" stroke-width="1"/><circle cx="290" cy="340" r="2.5" fill="#6B6B6B"/><text x="40" y="376" font-size="14" font-weight="500" fill="#0C447C">The 90% that built it</text><text x="40" y="394" font-size="12" fill="#3a3a3a">Research, infra, ten</text><text x="40" y="410" font-size="12" fill="#3a3a3a">attempts that didn't ship</text></svg>`,
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

export function HeroPostMockup() {
  const [items, setItems] = useState<ExampleItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/explainers", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.explainers) return;
        // Keep only explainers whose SECOND panel is SVG (the one we'll
        // actually display in the mockup). Falls back gracefully when the
        // explainer only has one panel.
        const svgItems = (data.explainers as ExampleItem[]).filter((x) => {
          const display = x.secondPanel ?? x.panel;
          return display?.format === "svg";
        });
        setItems(svgItems);
      })
      .catch(() => {
        // Hero is decorative — silent failure, falls back to baked SVG.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCursor((c) => (c + 1) % items.length);
    }, 10_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items.length]);

  const live = items[cursor];
  // Prefer the explainer's SECOND panel — first is almost always a hero
  // stat callout (one big number) which doesn't show Readopp's range.
  // Fall back to the first panel when there's only one.
  const displayPanel = live?.secondPanel ?? live?.panel ?? null;
  const usingFallback = !live || !displayPanel;
  const headingText = usingFallback
    ? FALLBACK_PANEL.heading
    : displayPanel!.heading || live!.title;
  const titleText = usingFallback
    ? FALLBACK_PANEL.title
    : live!.title || displayPanel!.heading;
  const sourceText = usingFallback
    ? FALLBACK_PANEL.source
    : safeHost(live!.url);
  const svgContent = usingFallback
    ? FALLBACK_PANEL.svg
    : displayPanel!.content;
  // Post caption follows what's actually displayed, so when the carousel
  // rotates the persona's "voice" stays in sync with the source piece.
  const captionText = `Just finished “${truncate(titleText, 56)}”. Made a quick visual breakdown — what do you think?`;

  return (
    <div className="overflow-hidden rounded-2xl border border-paper-line bg-white shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
      {/* Header: avatar + name + timestamp + more */}
      <div className="flex items-start gap-3 px-4 pt-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-deep text-sm font-semibold text-white">
          SB
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-ink">
            Sarah Bennett
          </div>
          <div className="truncate text-[11px] text-ink-muted">
            Indie founder · writes weekly · 2h
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 text-ink-muted">
          <span className="text-base leading-none">···</span>
        </div>
      </div>

      {/* Caption — derived from the currently displayed example so the
          persona's voice tracks whichever carousel is rotated in. */}
      <p className="px-4 pb-3 pt-2 text-[13px] leading-relaxed text-ink-soft">
        {captionText}
      </p>

      {/* Carousel area */}
      <div className="relative border-t border-paper-line bg-paper">
        <div className="relative aspect-square w-full p-6">
          <div
            key={`${live?.id ?? "fallback"}`}
            className="hero-post-fade flex h-full w-full items-center justify-center"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
          {/* Page indicator — second slide because the panel shown above is
              the explainer's second panel (skipping the stat-callout hero). */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/85 px-2.5 py-1 text-[10px] font-medium text-paper backdrop-blur">
            2 / 5
          </div>
        </div>
        {/* Slim caption / heading under the carousel */}
        <div className="border-t border-paper-line bg-paper-soft/60 px-4 py-2.5">
          <div className="truncate text-[12px] font-medium text-ink">
            {headingText}
          </div>
          <div className="truncate text-[10px] text-ink-muted">
            from {sourceText}
          </div>
        </div>
      </div>

      {/* Engagement row */}
      <div className="flex items-center gap-4 border-t border-paper-line px-4 py-3 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <Heart /> 127
        </span>
        <span className="inline-flex items-center gap-1">
          <Bubble /> 14
        </span>
        <span className="inline-flex items-center gap-1">
          <Repost /> 23
        </span>
      </div>

      {/* Attribution footer */}
      <div className="border-t border-paper-line bg-paper-soft/30 px-4 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-ink-faint">
        Made with Readopp
      </div>

      <style jsx>{`
        :global(.hero-post-fade) {
          animation: heroPostFade 600ms ease-out;
        }
        :global(.hero-post-fade svg) {
          width: 100%;
          height: 100%;
        }
        @keyframes heroPostFade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function safeHost(url: string): string {
  if (url.startsWith("upload://")) {
    return url.slice("upload://".length) || "upload";
  }
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Heart() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 14s-5-3.2-5-7a3 3 0 0 1 5-2 3 3 0 0 1 5 2c0 3.8-5 7-5 7Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Bubble() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7l-3 2v-2H4a1 1 0 0 1-1-1V4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Repost() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 6l2-2 2 2M5 4v6a2 2 0 0 0 2 2h5M13 10l-2 2-2-2M11 12V6a2 2 0 0 0-2-2H4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
