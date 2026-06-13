"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hero visual: a LinkedIn-style post mockup with a Readopp carousel panel
 * rendered inside. Slides are hand-crafted to the design system (instead of
 * live pipeline output) so the first impression is always on-brand: no
 * off-palette colors, no half-empty frames.
 */

const SERIF = "ui-serif, Georgia, 'Times New Roman', serif";
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface Slide {
  id: string;
  title: string;
  heading: string;
  source: string;
  page: string;
  svg: string;
}

const SLIDES: Slide[] = [
  {
    id: "layers",
    title: "Securing RAG Systems: Enterprise Architecture & Defense",
    heading: "Layered defense: data access control",
    source: "hackernoon.com",
    page: "2 / 5",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" font-family="${SANS}"><title>Layered defense</title>
<rect width="600" height="600" fill="#FFFDF8"/>
<rect x="64" y="70" width="30" height="5" rx="2.5" fill="#E85D2A"/>
<text x="64" y="118" font-size="34" font-weight="600" fill="#171717" font-family="${SERIF}">Layered defense</text>
<text x="64" y="146" font-size="15" fill="#857E72">Four checks between a prompt and your data</text>
<text x="76" y="234" font-size="14" fill="#ABA395" font-family="${MONO}">4</text>
<rect x="100" y="188" width="436" height="80" rx="12" fill="#FFFDF8" stroke="#D8CEC0" stroke-width="1.5"/>
<text x="128" y="223" font-size="17" font-weight="600" fill="#171717">Client interface</text>
<text x="128" y="246" font-size="13" fill="#857E72">User-facing controls</text>
<text x="76" y="328" font-size="14" fill="#ABA395" font-family="${MONO}">3</text>
<rect x="100" y="282" width="436" height="80" rx="12" fill="#F9E5D9" stroke="#ECA77F" stroke-width="1.5"/>
<text x="128" y="317" font-size="17" font-weight="600" fill="#171717">API gateway</text>
<text x="128" y="340" font-size="13" fill="#8F3210">Authentication and rate limiting</text>
<text x="76" y="422" font-size="14" fill="#ABA395" font-family="${MONO}">2</text>
<rect x="100" y="376" width="436" height="80" rx="12" fill="#ECA77F" stroke="#E85D2A" stroke-width="1.5"/>
<text x="128" y="411" font-size="17" font-weight="600" fill="#171717">Application logic</text>
<text x="128" y="434" font-size="13" fill="#8F3210">Business rules and validation</text>
<text x="76" y="516" font-size="14" fill="#ABA395" font-family="${MONO}">1</text>
<rect x="100" y="470" width="436" height="80" rx="12" fill="#101010"/>
<text x="128" y="505" font-size="17" font-weight="600" fill="#F7F3EA">Data layer security</text>
<text x="128" y="528" font-size="13" fill="#ABA395">Row-level access enforced by the database</text>
</svg>`,
  },
  {
    id: "donut",
    title: "Why nobody reads your best writing",
    heading: "Most readers never finish",
    source: "every.to",
    page: "3 / 6",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" font-family="${SANS}"><title>Audience split</title>
<rect width="600" height="600" fill="#FFFDF8"/>
<rect x="64" y="70" width="30" height="5" rx="2.5" fill="#E85D2A"/>
<text x="64" y="118" font-size="34" font-weight="600" fill="#171717" font-family="${SERIF}">Most readers never finish</text>
<text x="64" y="146" font-size="15" fill="#857E72">What happens after the click</text>
<g transform="rotate(-90 210 380)">
<circle cx="210" cy="380" r="110" fill="none" stroke="#F9E5D9" stroke-width="52"/>
<circle cx="210" cy="380" r="110" fill="none" stroke="#ECA77F" stroke-width="52" stroke-dasharray="165.9 691.2" stroke-dashoffset="-428.5"/>
<circle cx="210" cy="380" r="110" fill="none" stroke="#E85D2A" stroke-width="52" stroke-dasharray="428.5 691.2"/>
</g>
<text x="210" y="392" font-size="52" font-weight="600" fill="#171717" text-anchor="middle" font-family="${SERIF}">62%</text>
<text x="210" y="422" font-size="14" fill="#857E72" text-anchor="middle">read to the end</text>
<rect x="396" y="306" width="18" height="18" rx="4" fill="#E85D2A"/>
<text x="426" y="320" font-size="17" font-weight="600" fill="#171717">Read it all</text>
<text x="426" y="340" font-size="13" fill="#857E72">62 percent</text>
<rect x="396" y="372" width="18" height="18" rx="4" fill="#ECA77F"/>
<text x="426" y="386" font-size="17" font-weight="600" fill="#171717">Skimmed</text>
<text x="426" y="406" font-size="13" fill="#857E72">24 percent</text>
<rect x="396" y="438" width="18" height="18" rx="4" fill="#F9E5D9" stroke="#D8CEC0"/>
<text x="426" y="452" font-size="17" font-weight="600" fill="#171717">Bounced</text>
<text x="426" y="472" font-size="13" fill="#857E72">14 percent</text>
</svg>`,
  },
  {
    id: "stat",
    title: "What it really takes to ship",
    heading: "3.2× faster than writing it by hand",
    source: "stripe.com",
    page: "1 / 5",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" font-family="${SANS}"><title>Stat callout</title>
<rect width="600" height="600" fill="#101010"/>
<circle cx="520" cy="60" r="180" fill="#E85D2A" opacity="0.15"/>
<circle cx="40" cy="560" r="120" fill="#B23F14" opacity="0.1"/>
<rect x="64" y="150" width="34" height="6" rx="3" fill="#E85D2A"/>
<text x="60" y="340" font-size="150" font-weight="500" fill="#F7F3EA" font-family="${SERIF}">3.2&#215;</text>
<text x="64" y="392" font-size="20" fill="#ABA395">faster than writing the post by hand</text>
<line x1="64" y1="476" x2="536" y2="476" stroke="#2E2E2E" stroke-width="1.5"/>
<text x="64" y="512" font-size="14" fill="#857E72" font-family="${MONO}">from a 14-minute read &#183; 5 panels</text>
</svg>`,
  },
];

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

// One-shot intro demo: plays once on load, then hands off to the post.
const DEMO_MS = 8200;
const DEMO_END_MS = 8900;

export function HeroPostMockup() {
  const [t, setT] = useState(0);
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [armed, setArmed] = useState(false);

  // Don't start the intro reel until the mockup is on screen, so users
  // who scroll straight back here from elsewhere still see it play.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setArmed(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setArmed(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!armed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(DEMO_END_MS);
      return;
    }
    const start = performance.now();
    const id = setInterval(() => {
      const elapsed = performance.now() - start;
      setT(elapsed);
      if (elapsed >= DEMO_END_MS) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [armed]);

  const postVisible = t >= DEMO_MS;
  const demoMounted = t < DEMO_END_MS;

  // Manual navigation pauses the auto-rotation briefly so the reader can
  // actually look at the panel they picked.
  const pausedUntil = useRef(0);

  // Carousel rotation starts only after the intro hand-off, so the first
  // slide the viewer sees is the one the demo just "generated".
  useEffect(() => {
    if (!postVisible) return;
    const id = setInterval(() => {
      if (performance.now() < pausedUntil.current) return;
      setCursor((c) => (c + 1) % SLIDES.length);
    }, 8000);
    return () => clearInterval(id);
  }, [postVisible]);

  const go = (delta: number) => {
    pausedUntil.current = performance.now() + 15000;
    setCursor((c) => (c + delta + SLIDES.length) % SLIDES.length);
  };

  const slide = SLIDES[cursor];
  const captionText = `Just finished “${truncate(slide.title, 56)}”. Made a quick visual breakdown — what do you think?`;

  return (
    <div
      ref={rootRef}
      className="relative rotate-[1.2deg] transition-transform duration-500 ease-out hover:rotate-0 motion-reduce:rotate-0"
    >
      <div
        className={
          "transition-all duration-700 ease-out " +
          (postVisible ? "scale-100 opacity-100" : "scale-[0.98] opacity-0")
        }
      >
        <PostCard
          slide={slide}
          captionText={captionText}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
          index={cursor}
          count={SLIDES.length}
        />
      </div>
      {demoMounted && (
        <div
          className={
            "absolute inset-0 transition-opacity duration-700 " +
            (postVisible ? "pointer-events-none opacity-0" : "opacity-100")
          }
        >
          <HeroIntroDemo t={t} />
        </div>
      )}
    </div>
  );
}

function PostCard({
  slide,
  captionText,
  onPrev,
  onNext,
  index,
  count,
}: {
  slide: Slide;
  captionText: string;
  onPrev: () => void;
  onNext: () => void;
  index: number;
  count: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-paper-line bg-surface shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
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

      {/* Caption — derived from the slide so the persona's voice stays in
          sync with whichever panel is rotated in. */}
      <p className="px-4 pb-3 pt-2 text-[13px] leading-relaxed text-ink-soft">
        {captionText}
      </p>

      {/* Carousel area */}
      <div className="relative border-t border-paper-line bg-paper">
        <div className="group relative aspect-square w-full p-5 sm:p-6">
          <div
            key={slide.id}
            className="hero-post-fade flex h-full w-full items-center justify-center"
            dangerouslySetInnerHTML={{ __html: slide.svg }}
          />
          <button
            type="button"
            aria-label="Previous panel"
            onClick={onPrev}
            className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-paper-line bg-surface/90 text-ink opacity-0 shadow-sm backdrop-blur transition-all duration-200 hover:scale-110 hover:border-accent group-hover:opacity-100"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next panel"
            onClick={onNext}
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-paper-line bg-surface/90 text-ink opacity-0 shadow-sm backdrop-blur transition-all duration-200 hover:scale-110 hover:border-accent group-hover:opacity-100"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink/85 px-2.5 py-1 backdrop-blur">
            <span className="text-[10px] font-medium text-paper">
              {slide.page}
            </span>
            <span aria-hidden className="flex items-center gap-1">
              {Array.from({ length: count }, (_, i) => (
                <span
                  key={i}
                  className={
                    "h-1 w-1 rounded-full transition-colors duration-300 " +
                    (i === index ? "bg-accent" : "bg-paper/40")
                  }
                />
              ))}
            </span>
          </div>
        </div>
        {/* Slim caption / heading under the carousel */}
        <div className="border-t border-paper-line bg-paper-soft/60 px-4 py-2.5">
          <div className="truncate text-[12px] font-medium text-ink">
            {slide.heading}
          </div>
          <div className="truncate text-[10px] text-ink-muted">
            from {slide.source}
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

const URL_TEXT = "hackernoon.com/securing-rag-systems";
const AGENTS = ["Read", "Understand", "Outline", "Plan", "Draw", "Assemble"];
const AGENT_START = 2100;
const AGENT_MS = 500;
const PANEL_AT = 5100;

const LAYERS = [
  {
    n: 4,
    title: "Client interface",
    sub: "User-facing controls",
    box: "border-paper-line bg-white",
    titleCls: "text-ink",
    subCls: "text-ink-muted",
  },
  {
    n: 3,
    title: "API gateway",
    sub: "Authentication and rate limiting",
    box: "border-[#ECA77F] bg-[#F9E5D9]",
    titleCls: "text-ink",
    subCls: "text-[#8F3210]",
  },
  {
    n: 2,
    title: "Application logic",
    sub: "Business rules and validation",
    box: "border-[#E85D2A] bg-[#ECA77F]",
    titleCls: "text-ink",
    subCls: "text-[#8F3210]",
  },
  {
    n: 1,
    title: "Data layer security",
    sub: "Row-level access enforced by the database",
    box: "border-[#101010] bg-[#101010]",
    titleCls: "text-[#F7F3EA]",
    subCls: "text-[#ABA395]",
  },
];

function HeroIntroDemo({ t }: { t: number }) {
  const typedCount = Math.round(
    Math.min(1, Math.max(0, (t - 300) / 1300)) * URL_TEXT.length
  );
  const typed = URL_TEXT.slice(0, typedCount);
  const generating = t >= 1600;
  const pressed = t >= 1600 && t < 1850;
  const workingIdx = Math.min(
    AGENTS.length - 1,
    Math.max(0, Math.floor((t - AGENT_START) / AGENT_MS))
  );
  const layerIdx = Math.min(4, Math.max(1, Math.floor((t - 5700) / 450) + 1));
  const status =
    t < 1600
      ? "Paste any article URL"
      : t < AGENT_START
      ? "Fetching article…"
      : t < PANEL_AT
      ? `${AGENTS[workingIdx]} agent working…`
      : t < 5700
      ? "Composing panels…"
      : t < 7900
      ? `Drawing layer ${layerIdx} of 4…`
      : "Explainer ready — here's the post";
  const showSkeleton = t >= 500 && t < AGENT_START + 500;
  const showAgents = t >= AGENT_START && t < PANEL_AT + 500;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-paper-line bg-surface shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
      {/* URL bar */}
      <div className="flex items-center gap-2 border-b border-paper-line bg-paper-soft/60 px-4 py-3">
        <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-paper-line bg-surface px-3">
          <span className="truncate font-mono text-[11px] text-ink">
            {typed}
            {t < 1600 && (
              <span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-ink align-middle" />
            )}
          </span>
        </div>
        <div
          className={
            "shrink-0 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 " +
            (generating
              ? "bg-accent text-paper shadow-[0_0_0_3px_rgba(27,27,27,0.22)]"
              : "bg-ink text-paper") +
            (pressed ? " scale-90" : " scale-100")
          }
        >
          Generate
        </div>
      </div>

      {/* Stage */}
      <div className="relative flex-1 overflow-hidden bg-paper">
        {/* Article skeleton being fetched + scanned */}
        {showSkeleton && (
          <div
            className={
              "absolute inset-0 flex items-center justify-center transition-opacity duration-500 " +
              (t < AGENT_START ? "opacity-100" : "opacity-0")
            }
          >
            <div className="relative w-full max-w-[280px] force-light overflow-hidden rounded-lg border border-paper-line bg-white p-5">
              <div className="h-3 w-3/4 animate-[introUp_400ms_both] rounded-sm bg-ink/30" />
              {[100, 92, 96, 100, 88, 64].map((w, i) => (
                <div
                  key={i}
                  className="mt-2 h-2 animate-[introUp_400ms_both] rounded-sm bg-ink/10"
                  style={{
                    width: `${w}%`,
                    animationDelay: `${150 + i * 110}ms`,
                  }}
                />
              ))}
              {generating && (
                <div
                  className="pointer-events-none absolute inset-x-0 -top-12 h-12 animate-[introScan_1100ms_ease-in-out_infinite] bg-gradient-to-b from-transparent via-accent/20 to-transparent"
                  aria-hidden
                />
              )}
            </div>
          </div>
        )}

        {/* Agent checklist */}
        {showAgents && (
          <div
            className={
              "absolute inset-0 flex items-center justify-center transition-opacity duration-500 " +
              (t < PANEL_AT ? "opacity-100" : "opacity-0")
            }
          >
            {/* Sketch doodles: the agents "thinking on paper" around the list. */}
            <svg
              aria-hidden
              viewBox="0 0 400 400"
              className="pointer-events-none absolute inset-0 h-full w-full text-accent/50"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle
                cx="58"
                cy="64"
                r="22"
                pathLength={1}
                className="animate-[introSketch_700ms_ease-out_200ms_both]"
              />
              <path
                d="M330 52 l 36 0 m -18 -18 l 0 36"
                pathLength={1}
                className="animate-[introSketch_600ms_ease-out_700ms_both]"
              />
              <path
                d="M40 330 c 14 -12, 22 10, 36 -2 c 14 -12, 22 10, 36 -2"
                pathLength={1}
                className="animate-[introSketch_700ms_ease-out_1200ms_both]"
              />
              <path
                d="M322 318 l 44 24 m -8 -22 l 8 22 l -23 -3"
                pathLength={1}
                className="animate-[introSketch_700ms_ease-out_1700ms_both]"
              />
              <rect
                x="318"
                y="170"
                width="34"
                height="26"
                rx="6"
                pathLength={1}
                className="animate-[introSketch_700ms_ease-out_2200ms_both]"
              />
              <path
                d="M44 180 a 20 20 0 1 1 8 38"
                pathLength={1}
                className="animate-[introSketch_700ms_ease-out_2700ms_both]"
              />
            </svg>
            <div className="w-full max-w-[280px] space-y-2 px-6">
              {AGENTS.map((a, i) => {
                const done = t >= AGENT_START + (i + 1) * AGENT_MS;
                const working = !done && t >= AGENT_START + i * AGENT_MS;
                return (
                  <div
                    key={a}
                    className={
                      "flex animate-[introRow_400ms_ease-out_backwards] items-center gap-2.5 rounded-md border bg-surface px-3 py-2 transition-all duration-300 " +
                      (working
                        ? "border-accent shadow-[0_0_0_3px_rgba(27,27,27,0.15)]"
                        : done
                        ? "border-paper-line"
                        : "border-paper-line opacity-40")
                    }
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span
                      className={
                        "flex h-4 w-4 items-center justify-center rounded-full border text-[8px] font-bold " +
                        (done
                          ? "border-accent bg-accent text-paper"
                          : working
                          ? "border-accent text-accent"
                          : "border-paper-line text-transparent")
                      }
                    >
                      {done ? (
                        <span className="animate-[introPop_300ms_ease-out]">✓</span>
                      ) : working ? (
                        <span className="block h-2 w-2 animate-spin rounded-full border border-accent border-t-transparent" />
                      ) : null}
                    </span>
                    <span className="flex-1 text-xs font-medium text-ink">{a}</span>
                    <span className="font-mono text-[9px] uppercase text-ink-faint">
                      {done ? "done" : working ? "…" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Panel composing */}
        <div
          className={
            "absolute inset-4 transition-opacity duration-500 sm:inset-6 " +
            (t >= PANEL_AT ? "opacity-100" : "opacity-0")
          }
        >
          <div className="flex h-full flex-col rounded-lg border border-paper-line bg-surface p-4 sm:p-5">
            <div
              className={
                "h-1 w-7 origin-left rounded-full bg-[#E85D2A] " +
                (t >= 5250
                  ? "animate-[introGrow_400ms_ease-out_both]"
                  : "opacity-0")
              }
            />
            <div
              className={
                "mt-2 font-display text-lg font-medium text-ink " +
                (t >= 5350 ? "animate-[introUp_350ms_both]" : "opacity-0")
              }
            >
              Layered defense
            </div>
            <div
              className={
                "text-[11px] text-ink-muted " +
                (t >= 5500 ? "animate-[introUp_350ms_both]" : "opacity-0")
              }
            >
              Four checks between a prompt and your data
            </div>
            <div className="mt-3 flex flex-1 flex-col gap-2">
              {LAYERS.map((l, i) => {
                const on = t >= 5700 + i * 450;
                return (
                  <div
                    key={l.n}
                    className={
                      "flex flex-1 items-center gap-3 rounded-lg border px-3 " +
                      l.box +
                      " " +
                      (on
                        ? "animate-[introLayer_550ms_cubic-bezier(0.34,1.56,0.64,1)_both]"
                        : "opacity-0")
                    }
                  >
                    <span className="font-mono text-[10px] text-ink-faint">
                      {l.n}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={
                          "block truncate text-xs font-semibold " + l.titleCls
                        }
                      >
                        {l.title}
                      </span>
                      <span
                        className={"block truncate text-[10px] " + l.subCls}
                      >
                        {l.sub}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Status line + overall progress */}
      <div className="border-t border-paper-line">
        <div className="h-0.5 w-full bg-paper-soft">
          <div
            className="h-full bg-accent transition-[width] duration-150 ease-linear"
            style={{ width: `${Math.min(100, (t / DEMO_MS) * 100)}%` }}
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-pulse" />
          <span
            key={status}
            className="animate-[introUp_250ms_both] font-mono text-[11px] text-ink-soft"
          >
            {status}
          </span>
        </div>
      </div>
      <style>{`
        @keyframes introUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes introRow {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes introPop {
          0% { transform: scale(0.4); }
          60% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        @keyframes introLayer {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes introGrow {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes introScan {
          from { top: -3rem; }
          to { top: 100%; }
        }
        @keyframes introSketch {
          from { stroke-dasharray: 1; stroke-dashoffset: 1; }
          to { stroke-dasharray: 1; stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
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
